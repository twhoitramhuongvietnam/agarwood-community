import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import type { BannerSlot } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBannerPricePerMonth, getBannerQuotaUsage } from "@/lib/bannerQuota"
import { BANNER_SLOT_META, getSlotShape } from "@/lib/banner-slots"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key")

/**
 * POST /api/banner
 * Tạo banner mới (mọi user đăng nhập). Tạo Banner + Payment PENDING (chưa có user CK).
 *
 * Body:
 *  { imageUrl, targetUrl, title, startDate, endDate }  // ISO date strings
 *
 * Response: { bannerId, paymentId, bankInfo, price }
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { imageUrl, targetUrl, title, startDate, endDate, slots } = body as {
    imageUrl?: string
    targetUrl?: string
    title?: string
    startDate?: string
    endDate?: string
    slots?: string[]
  }

  // Validate fields
  if (!imageUrl || !targetUrl || !title || !startDate || !endDate) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
  }
  if (!Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: "Cần chọn ít nhất 1 vùng hiển thị." }, { status: 400 })
  }
  for (const s of slots) {
    if (!(s in BANNER_SLOT_META)) {
      return NextResponse.json({ error: `Slot không hợp lệ: ${s}` }, { status: 400 })
    }
  }
  const validSlots = slots as BannerSlot[]
  if (new Set(validSlots.map(getSlotShape)).size > 1) {
    return NextResponse.json({ error: "Các vùng phải cùng aspect ratio." }, { status: 400 })
  }
  const uniqueSlots = Array.from(new Set(validSlots))
  if (!/^https:\/\//.test(targetUrl)) {
    return NextResponse.json({ error: "Đường dẫn đích phải bắt đầu bằng https://" }, { status: 400 })
  }
  if (title.length < 5 || title.length > 100) {
    return NextResponse.json({ error: "Tiêu đề từ 5 đến 100 ký tự" }, { status: 400 })
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Ngày không hợp lệ" }, { status: 400 })
  }
  if (start < new Date(new Date().setHours(0, 0, 0, 0))) {
    return NextResponse.json({ error: "Ngày bắt đầu phải từ hôm nay trở đi" }, { status: 400 })
  }
  if (end <= start) {
    return NextResponse.json({ error: "Ngày kết thúc phải sau ngày bắt đầu" }, { status: 400 })
  }

  // Tính số tháng — làm tròn lên (ceiling)
  const msPerDay = 86_400_000
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / msPerDay)
  const monthsDiff = Math.max(1, Math.ceil(daysDiff / 30))
  if (monthsDiff < 1) {
    return NextResponse.json({ error: "Thời gian tối thiểu 1 tháng" }, { status: 400 })
  }

  // Check quota tháng
  const usage = await getBannerQuotaUsage(session.user.id)
  if (usage.limit !== -1 && usage.used >= usage.limit) {
    return NextResponse.json(
      {
        error: `Đã đạt quota ${usage.used}/${usage.limit} mẫu banner tháng này. Nâng cấp VIP để tăng quota.`,
        quota: usage,
      },
      { status: 429 },
    )
  }

  // Tính giá
  const pricePerMonth = await getBannerPricePerMonth()
  const totalPrice = pricePerMonth * monthsDiff

  // Fetch user info + bank info song song
  const [user, bankConfigs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    }),
    prisma.siteConfig.findMany({
      where: { key: { in: ["bank_name", "bank_account_number", "bank_account_name"] } },
    }),
  ])
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const bankCfg = Object.fromEntries(bankConfigs.map((c) => [c.key, c.value]))

  // Generate CK description: HTHVN-BANNER-{INITIALS}-{YYYYMMDD}
  const initials = user.name
    .split(" ")
    .map((w) => w[0]?.toUpperCase())
    .filter(Boolean)
    .join("")
  const now = new Date()
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("")
  const description = `HTHVN-BANNER-${initials}-${dateStr}`
  const orderCode = `BANNER-${Date.now()}`

  // Tạo Banner + Payment trong 1 transaction
  const result = await prisma.$transaction(async (tx) => {
    const banner = await tx.banner.create({
      data: {
        userId: session.user.id,
        imageUrl,
        targetUrl,
        title,
        startDate: start,
        endDate: end,
        status: "PENDING_PAYMENT",
        price: totalPrice,
        positions: uniqueSlots,
      },
    })
    const payment = await tx.payment.create({
      data: {
        userId: session.user.id,
        type: "BANNER_FEE",
        status: "PENDING",
        amount: totalPrice,
        payosOrderCode: orderCode,
        bannerId: banner.id,
        description: `Đăng ký banner ${monthsDiff} tháng - ${totalPrice.toLocaleString("vi-VN")}đ | ND: ${description}`,
      },
    })
    return { banner, payment }
  })

  const bankInfo = {
    bankName: bankCfg.bank_name ?? "Vietcombank",
    accountNumber: bankCfg.bank_account_number ?? "1234567890",
    accountName: bankCfg.bank_account_name ?? "HOI TRAM HUONG VIET NAM",
    amount: totalPrice,
    description,
  }

  // Email admin (non-blocking)
  try {
    const adminEmail =
      (await prisma.siteConfig.findUnique({ where: { key: "association_email" } }))?.value ??
      "admin@hoitramhuong.vn"
    await resend.emails.send({
      from: "Hội Trầm Hương Việt Nam <noreply@hoitramhuong.vn>",
      to: adminEmail,
      subject: `[Banner mới] ${user.name} - ${totalPrice.toLocaleString("vi-VN")}đ`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h3>${user.name} (${user.email}) vừa đăng ký banner mới</h3>
          <p><strong>Tiêu đề:</strong> ${title}</p>
          <p><strong>Thời gian:</strong> ${monthsDiff} tháng (${start.toLocaleDateString("vi-VN")} - ${end.toLocaleDateString("vi-VN")})</p>
          <p><strong>Số tiền:</strong> ${totalPrice.toLocaleString("vi-VN")}đ</p>
          <p><strong>ND CK:</strong> ${description}</p>
          <p><a href="${process.env.NEXTAUTH_URL}/admin/banner" style="display:inline-block;background:#1a5632;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Xem tại admin</a></p>
        </div>
      `,
    })
  } catch (err) {
    console.error("Failed to send admin notification:", err)
  }

  // Invalidate quota cache cho user — UI sidebar feed sẽ hiện số banner mới
  // ngay thay vì stale tới 60s.
  revalidateTag(`quota:${session.user.id}`, "max")
  return NextResponse.json({
    bannerId: result.banner.id,
    paymentId: result.payment.id,
    bankInfo,
    price: totalPrice,
    months: monthsDiff,
  })
}
