import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Resend } from "resend"
import { z } from "zod"
import { COMPANY_FIELDS, COMPANY_FIELD_LABELS_VI, type CompanyFieldKey } from "@/lib/constants/agarwood"

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key")

const registerSchema = z.object({
  accountType: z.enum(["BUSINESS", "INDIVIDUAL"]).default("BUSINESS"),
  name: z.string().min(2, "Ho ten toi thieu 2 ky tu"),
  email: z.string().email("Email khong hop le"),
  phone: z.string().regex(/^(0|\+84)[0-9]{8,9}$/, "So dien thoai khong hop le"),
  companyName: z.string().optional().or(z.literal("")),
  companyField: z.enum(COMPANY_FIELDS).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  reason: z.string().min(10, "Ly do gia nhap toi thieu 10 ky tu"),
  honeypot: z.string().max(0).optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Anti-bot: honeypot field must be empty
    if (body.honeypot) {
      return NextResponse.json({ success: true }) // Silently accept but do nothing
    }

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { accountType, name, email, phone, companyName, companyField, address, reason } = parsed.data

    // Lĩnh vực được client gửi dưới dạng canonical key (vd "natural_agarwood").
    // Map sang label tiếng Việt cho admin email & Company.description (admin là VN).
    const companyFieldLabelVi = companyField
      ? COMPANY_FIELD_LABELS_VI[companyField as CompanyFieldKey]
      : ""

    // Validate: BUSINESS requires companyName
    if (accountType === "BUSINESS" && (!companyName || companyName.length < 2)) {
      return NextResponse.json({ error: "Ten doanh nghiep la bat buoc" }, { status: 400 })
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Email nay da duoc su dung" }, { status: 409 })
    }

    // Phase 2: bỏ slot limit cho GUEST — GUEST là free tier, đăng ký không giới hạn.
    // `max_vip_accounts` chỉ enforce ở flow nâng cấp lên VIP (đóng phí), không ở đây.

    // Phase 3 (Cách A — duyệt thủ công): user đăng ký vào trạng thái CHỜ DUYỆT
    // (isActive=false). Chưa đăng nhập được — phải chờ admin approve trong
    // /admin/hoi-vien?status=registration. Khi admin approve → gửi email link
    // đặt mật khẩu → sau khi đặt xong mới set isActive=true.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userData: any = {
      email,
      name,
      phone,
      role: "GUEST",
      accountType,
      isActive: false,
      accounts: {
        create: {
          type: "credentials",
          provider: "credentials",
          providerAccountId: email,
        },
      },
    }

    // Only create company for BUSINESS accounts
    if (accountType === "BUSINESS" && companyName) {
      userData.company = {
        create: {
          name: companyName,
          slug: companyName
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            + "-" + Date.now().toString(36),
          description: `Lĩnh vực: ${companyFieldLabelVi}\nĐịa chỉ: ${address || "Chưa cung cấp"}\n\nLý do đăng ký:\n${reason}`,
          address: address || null,
          isVerified: false,
          isPublished: false,
        },
      }
    }

    const user = await prisma.user.create({ data: userData })

    // Email admin about new registration
    try {
      const adminEmail = (await prisma.siteConfig.findUnique({ where: { key: "association_email" } }))?.value ?? "admin@hoitramhuong.vn"
      await resend.emails.send({
        from: "Hội Trầm Hương Việt Nam <noreply@hoitramhuong.vn>",
        to: adminEmail,
        subject: `[Đăng ký mới] ${name}${companyName ? ` — ${companyName}` : " (Cá nhân)"}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;">
            <h3>Đơn đăng ký hội viên mới</h3>
            <p><strong>Loại:</strong> ${accountType === "BUSINESS" ? "Doanh nghiệp" : "Cá nhân / Chuyên gia"}</p>
            <p><strong>Họ tên:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>SĐT:</strong> ${phone}</p>
            ${companyName ? `<p><strong>Doanh nghiệp:</strong> ${companyName}</p>` : ""}
            ${companyFieldLabelVi ? `<p><strong>Lĩnh vực:</strong> ${companyFieldLabelVi}</p>` : ""}
            ${address ? `<p><strong>${accountType === "INDIVIDUAL" ? "Chuyên môn" : "Địa chỉ"}:</strong> ${address}</p>` : ""}
            <p><strong>Lý do đăng ký:</strong></p>
            <p style="background:#f5f5f5;padding:12px;border-radius:8px;">${reason}</p>
            <p><a href="${process.env.NEXTAUTH_URL}/admin/hoi-vien?status=pending" style="display:inline-block;background:#1a5632;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Xem đơn đăng ký</a></p>
          </div>
        `,
      })
    } catch (err) {
      console.error("Failed to send registration email:", err)
    }

    // Email xác nhận đã nhận đơn — KHÔNG kèm link đặt mật khẩu.
    // Link đặt mật khẩu chỉ gửi khi admin approve trong /admin/hoi-vien.
    try {
      await resend.emails.send({
        from: "Hội Trầm Hương Việt Nam <noreply@hoitramhuong.vn>",
        to: email,
        subject: "Đã nhận đơn đăng ký — Hội Trầm Hương Việt Nam",
        html: `
          <div style="font-family:sans-serif;max-width:600px;">
            <h2>Xin chào ${name},</h2>
            <p>Chúng tôi đã <strong>tiếp nhận đơn đăng ký hội viên</strong> của bạn.</p>
            <p>Ban quản trị sẽ xem xét và phản hồi trong vòng <strong>1–2 ngày làm việc</strong>. Khi đơn được chấp thuận, bạn sẽ nhận được email kèm liên kết để đặt mật khẩu và kích hoạt tài khoản.</p>
            <p style="color:#888;font-size:13px;margin-top:20px;">Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p style="color:#888;font-size:12px;">Hội Trầm Hương Việt Nam</p>
          </div>
        `,
      })
    } catch (err) {
      console.error("[Register] Failed to send acknowledgement email:", err)
    }

    return NextResponse.json({ success: true, userId: user.id })
  } catch (err) {
    console.error("Registration error:", err)
    return NextResponse.json({ error: "Da xay ra loi. Vui long thu lai." }, { status: 500 })
  }
}
