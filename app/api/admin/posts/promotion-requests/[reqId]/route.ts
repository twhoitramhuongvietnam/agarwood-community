import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

/**
 * PATCH /api/admin/posts/promotion-requests/[reqId]
 *
 * Admin approve hoặc reject 1 promotion request.
 *
 * Body:
 *  { action: "approve" }               → status=APPROVED, Post.isPromoted=true
 *  { action: "reject", note: string }  → status=REJECTED, reviewNote=note
 *
 * Logic:
 *  - Chỉ xử lý request đang PENDING (tránh re-review).
 *  - Approve: update request + toggle Post.isPromoted trong transaction.
 *    Revalidate homepage + feed để bài lên ngay.
 *  - Reject: update request chỉ, không đụng Post. Note bắt buộc (hiện cho owner).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ reqId: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "post:promote")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { reqId } = await params
  const body = (await req.json().catch(() => ({}))) as {
    action?: "approve" | "reject"
    note?: string
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json(
      { error: "action phải là 'approve' hoặc 'reject'" },
      { status: 400 },
    )
  }

  const request = await prisma.postPromotionRequest.findUnique({
    where: { id: reqId },
    select: { id: true, postId: true, status: true },
  })
  if (!request) {
    return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404 })
  }
  if (request.status !== "PENDING") {
    return NextResponse.json(
      { error: "Yêu cầu đã được xử lý trước đó." },
      { status: 409 },
    )
  }

  const now = new Date()

  if (body.action === "approve") {
    // Cần state hiện tại để sync promotedAt — chỉ set new Date() khi bài
    // transition từ unpromoted sang promoted (cron unpromote-stale daily
    // sẽ gỡ sau 2 ngày). Nếu bài đã promoted (admin direct-promote trước
    // khi approve request), giữ promotedAt cũ để không reset window.
    const post = await prisma.post.findUnique({
      where: { id: request.postId },
      select: { isPromoted: true, newsCategories: true },
    })
    const wasPromoted =
      !!post && (post.isPromoted || post.newsCategories.length > 0)

    await prisma.$transaction(async (tx) => {
      await tx.postPromotionRequest.update({
        where: { id: reqId },
        data: {
          status: "APPROVED",
          reviewedBy: session.user.id,
          reviewedAt: now,
          reviewNote: null,
        },
      })
      await tx.post.update({
        where: { id: request.postId },
        data: {
          isPromoted: true,
          ...(wasPromoted ? {} : { promotedAt: now }),
        },
      })
    })

    revalidateTag("homepage", "max")
    revalidateTag("posts", "max")
    revalidatePath("/[locale]", "layout")
    revalidatePath("/[locale]/feed", "page")

    return NextResponse.json({ status: "APPROVED" })
  }

  // reject
  const note = (body.note ?? "").trim()
  if (!note) {
    return NextResponse.json(
      { error: "Cần lý do từ chối (note) để owner biết." },
      { status: 400 },
    )
  }
  if (note.length > 500) {
    return NextResponse.json(
      { error: "Lý do tối đa 500 ký tự." },
      { status: 400 },
    )
  }

  await prisma.postPromotionRequest.update({
    where: { id: reqId },
    data: {
      status: "REJECTED",
      reviewedBy: session.user.id,
      reviewedAt: now,
      reviewNote: note,
    },
  })

  return NextResponse.json({ status: "REJECTED" })
}
