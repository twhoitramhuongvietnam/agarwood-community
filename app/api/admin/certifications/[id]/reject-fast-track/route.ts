import { NextResponse } from "next/server"
import { Resend } from "resend"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAdminWrite } from "@/lib/roles"
import { rejectFastTrack, CouncilError } from "@/lib/certification-council"

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

  if (!body.reviewNote || body.reviewNote.trim().length < 10) {
    return NextResponse.json(
      { error: "Lý do từ chối tối thiểu 10 ký tự" },
      { status: 400 },
    )
  }

  try {
    await rejectFastTrack(id, session.user.id, body.reviewNote)

    void notifyApplicant(id, body.reviewNote.trim()).catch((err) =>
      console.error("reject-fast-track: notify applicant failed:", err),
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof CouncilError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("reject-fast-track failed:", err)
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 })
  }
}

async function notifyApplicant(certId: string, reviewNote: string) {
  const cert = await prisma.certification.findUnique({
    where: { id: certId },
    select: {
      product: { select: { name: true } },
      applicant: { select: { name: true, email: true } },
    },
  })
  if (!cert) return

  await resend.emails.send({
    from: "Hội Trầm Hương Việt Nam <noreply@hoitramhuong.vn>",
    to: cert.applicant.email,
    subject: `[Đơn endorsement bị từ chối] ${cert.product.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Chào ${cert.applicant.name},</h2>
        <p>Đơn endorsement cho sản phẩm <strong>${cert.product.name}</strong> đã bị từ chối.</p>
        <p><strong>Lý do từ chối:</strong></p>
        <blockquote style="border-left:3px solid #eee;padding-left:12px;color:#555;">${reviewNote}</blockquote>
        <p>Phí đã đóng sẽ được Hội hoàn lại vào tài khoản ngân hàng anh/chị đã cung cấp. Vui lòng theo dõi qua trang Lịch sử thanh toán.</p>
      </div>
    `,
  })
}
