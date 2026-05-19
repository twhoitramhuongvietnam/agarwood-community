import { NextResponse } from "next/server"
import { Resend } from "resend"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAdminWrite } from "@/lib/roles"
import { approveFastTrack, CouncilError } from "@/lib/certification-council"

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key")

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { reviewNote?: string }

  try {
    const { certCode } = await approveFastTrack(
      id,
      session.user.id,
      body.reviewNote,
    )

    // Notify applicant — endorsement đã cấp, không cần chờ HĐTĐ.
    void notifyApplicant(id, certCode).catch((err) =>
      console.error("approve-fast-track: notify applicant failed:", err),
    )

    return NextResponse.json({ success: true, certCode })
  } catch (err) {
    if (err instanceof CouncilError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("approve-fast-track failed:", err)
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 })
  }
}

async function notifyApplicant(certId: string, certCode: string) {
  const cert = await prisma.certification.findUnique({
    where: { id: certId },
    select: {
      product: { select: { name: true, slug: true } },
      applicant: { select: { name: true, email: true } },
    },
  })
  if (!cert) return

  const siteUrl = process.env.NEXTAUTH_URL ?? ""
  const verifyUrl = `${siteUrl}/verify/${certCode}`
  const productUrl = `${siteUrl}/san-pham/${cert.product.slug}`

  await resend.emails.send({
    from: "Hội Trầm Hương Việt Nam <noreply@hoitramhuong.vn>",
    to: cert.applicant.email,
    subject: `[Endorsement đã cấp] ${cert.product.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Chào ${cert.applicant.name},</h2>
        <p>Hội Trầm Hương Việt Nam đã xác minh giấy chứng nhận nhà nước và cấp <strong>endorsement trọn đời</strong> cho sản phẩm <strong>${cert.product.name}</strong>.</p>
        <p><strong>Mã endorsement:</strong> ${certCode}</p>
        <p>Endorsement có hiệu lực <strong>trọn đời</strong>, dựa trên CN nhà nước anh/chị đã cung cấp. Hội có quyền thu hồi nếu CN nhà nước bị hết hiệu lực/thu hồi.</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block;background:#1a5632;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px;">Xem endorsement</a>
          <a href="${productUrl}" style="display:inline-block;background:#fff;color:#1a5632;border:1px solid #1a5632;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Trang sản phẩm</a>
        </p>
      </div>
    `,
  })
}
