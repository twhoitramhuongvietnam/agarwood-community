import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Resend } from "resend"
import { calcCertFee } from "@/lib/certification-fee"

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key")

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role === "GUEST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { membershipExpires: true, name: true, email: true },
  })
  if (!user?.membershipExpires || user.membershipExpires < new Date()) {
    return NextResponse.json(
      { error: "Membership đã hết hạn. Vui lòng gia hạn trước.", redirectTo: "/gia-han" },
      { status: 403 },
    )
  }

  const {
    productId,
    applicantNote,
    reviewMode,
    productSalePrice,
    bankAccountName,
    bankAccountNumber,
    bankName,
    documentUrls,
    govCertNumber,
    govCertIssuedAt,
    govCertIssuer,
  } = await request.json()

  if (!productId) {
    return NextResponse.json({ error: "Thiếu thông tin sản phẩm" }, { status: 400 })
  }

  if (reviewMode !== "ONLINE" && reviewMode !== "OFFLINE" && reviewMode !== "FAST_TRACK") {
    return NextResponse.json({ error: "Hình thức xét duyệt không hợp lệ" }, { status: 400 })
  }

  const salePrice = reviewMode === "ONLINE" ? Number(productSalePrice) : null
  if (reviewMode === "ONLINE") {
    if (!Number.isFinite(salePrice!) || (salePrice as number) <= 0) {
      return NextResponse.json({ error: "Vui lòng khai báo giá bán sản phẩm (VND) cho thẩm định online" }, { status: 400 })
    }
  }

  // FAST_TRACK bắt buộc khai báo thông tin CN nhà nước + đính kèm ảnh giấy gốc.
  // Hội xác minh giấy gốc trước khi endorse — thiếu = không thể audit, từ chối.
  let govIssuedAt: Date | null = null
  let cleanDocumentUrls: string[] = []
  if (reviewMode === "FAST_TRACK") {
    if (!govCertNumber || typeof govCertNumber !== "string" || !govCertNumber.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập số/ký hiệu giấy chứng nhận nhà nước" }, { status: 400 })
    }
    if (!govCertIssuer || typeof govCertIssuer !== "string" || !govCertIssuer.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập cơ quan cấp giấy chứng nhận" }, { status: 400 })
    }
    if (!govCertIssuedAt || typeof govCertIssuedAt !== "string") {
      return NextResponse.json({ error: "Vui lòng nhập ngày cấp giấy chứng nhận" }, { status: 400 })
    }
    const parsed = new Date(govCertIssuedAt)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Ngày cấp không hợp lệ" }, { status: 400 })
    }
    if (parsed > new Date()) {
      return NextResponse.json({ error: "Ngày cấp không được nằm trong tương lai" }, { status: 400 })
    }
    govIssuedAt = parsed
    if (!Array.isArray(documentUrls) || documentUrls.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng đính kèm ảnh/PDF giấy CN nhà nước để Hội xác minh" },
        { status: 400 },
      )
    }
    cleanDocumentUrls = documentUrls.filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    )
    if (cleanDocumentUrls.length === 0) {
      return NextResponse.json({ error: "Tài liệu đính kèm không hợp lệ" }, { status: 400 })
    }
  } else if (Array.isArray(documentUrls)) {
    // ONLINE/OFFLINE: documentUrls optional — vẫn chấp nhận nếu user upload.
    cleanDocumentUrls = documentUrls.filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    )
  }

  // Check for duplicate pending cert on same product
  const existingCert = await prisma.certification.findFirst({
    where: {
      productId,
      status: { in: ["DRAFT", "PENDING", "UNDER_REVIEW"] },
    },
  })
  if (existingCert) {
    return NextResponse.json({ error: "Sản phẩm này đang có đơn chứng nhận đang xử lý" }, { status: 409 })
  }

  if (!bankAccountName || !bankAccountNumber || !bankName) {
    return NextResponse.json({ error: "Vui lòng điền đầy đủ thông tin ngân hàng hoàn tiền" }, { status: 400 })
  }

  const fee = calcCertFee(reviewMode, salePrice)

  // Generate CK description: HOITRAMHUONG-CERT-{INITIALS}-{YYYYMMDD}
  const initials = user.name.split(" ").map((w) => w[0]?.toUpperCase()).filter(Boolean).join("")
  const now = new Date()
  const dateStr = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("")
  const description = `HOITRAMHUONG-CERT-${initials}-${dateStr}`
  const orderCode = String(Date.now())

  const configs = await prisma.siteConfig.findMany({
    where: { key: { in: ["bank_name", "bank_account_number", "bank_account_name"] } },
  })
  const cfg = Object.fromEntries(configs.map((c) => [c.key, c.value]))
  const bankInfo = {
    bankName: cfg.bank_name ?? "Vietcombank",
    accountNumber: cfg.bank_account_number ?? "1234567890",
    accountName: cfg.bank_account_name ?? "HOI TRAM HUONG VIET NAM",
    amount: fee,
    description,
  }

  const cert = await prisma.certification.create({
    data: {
      productId,
      applicantId: session.user.id,
      status: "DRAFT",
      documentUrls: cleanDocumentUrls,
      applicantNote: applicantNote ?? null,
      reviewMode,
      productSalePrice: salePrice != null ? BigInt(Math.round(salePrice)) : null,
      feePaid: fee,
      refundBankName: bankName,
      refundAccountName: bankAccountName,
      refundAccountNo: bankAccountNumber,
      // FAST_TRACK only — null cho ONLINE/OFFLINE.
      govCertNumber: reviewMode === "FAST_TRACK" ? govCertNumber!.trim() : null,
      govCertIssuer: reviewMode === "FAST_TRACK" ? govCertIssuer!.trim() : null,
      govCertIssuedAt: govIssuedAt,
    },
  })

  const payment = await prisma.payment.create({
    data: {
      userId: session.user.id,
      type: "CERTIFICATION_FEE",
      status: "PENDING",
      amount: fee,
      payosOrderCode: orderCode,
      certificationId: cert.id,
      description: `Phí chứng nhận SP | ND: ${description}`,
    },
  })

  try {
    const adminEmail = (await prisma.siteConfig.findUnique({ where: { key: "association_email" } }))?.value ?? "admin@hoi-tram-huong.vn"
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true } })
    const feeText = fee.toLocaleString("vi-VN") + "đ"
    const modeText =
      reviewMode === "ONLINE"
        ? "Online (HĐTĐ vote)"
        : reviewMode === "OFFLINE"
          ? "Offline (HĐTĐ thẩm định trực tiếp)"
          : "Fast-track (endorse CN nhà nước)"
    await resend.emails.send({
      from: "Hội Trầm Hương Việt Nam <noreply@hoitramhuong.vn>",
      to: adminEmail,
      subject: `[Hội Trầm Hương] ${user.name} nộp đơn chứng nhận SP — ${product?.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h3>${user.name} (${user.email})</h3>
          <p>Vừa nộp đơn chứng nhận sản phẩm <strong>${product?.name}</strong> (${modeText}) và xác nhận chuyển khoản <strong>${feeText}</strong>.</p>
          <p>Nội dung CK: <strong>${description}</strong></p>
          <p><a href="${process.env.NEXTAUTH_URL}/admin/thanh-toan" style="display:inline-block;background:#1a5632;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Xác nhận CK</a></p>
        </div>
      `,
    })
  } catch (err) {
    console.error("Failed to send admin cert notification:", err)
  }

  return NextResponse.json({ certId: cert.id, paymentId: payment.id, orderCode, bankInfo, fee })
}
