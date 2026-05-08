import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import DOMPurify from "isomorphic-dompurify"
import { writePostRevision } from "@/lib/post-revision"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, title: true, content: true, coverImageUrl: true, authorId: true },
  })

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only author or admin can read for editing
  if (post.authorId !== session.user.id && !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({ post })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const post = await prisma.post.findUnique({
    where: { id },
    select: { authorId: true },
  })

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const isAdminEdit = isAdmin(session.user.role) && post.authorId !== session.user.id
  if (post.authorId !== session.user.id && !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { title, content, coverImageUrl, reason } = await req.json() as {
    title?: string
    content?: string
    coverImageUrl?: string | null
    /** Phase 3.6: bắt buộc khi admin edit — giải thích lý do để owner hiểu. */
    reason?: string
  }
  if (!content || content.trim().length < 50) {
    return NextResponse.json({ error: "Nội dung quá ngắn (tối thiểu 50 ký tự)" }, { status: 400 })
  }
  if (isAdminEdit && (!reason || reason.trim().length < 10)) {
    return NextResponse.json(
      { error: "Admin chỉnh sửa cần ghi rõ lý do (tối thiểu 10 ký tự) để owner hiểu thay đổi." },
      { status: 400 },
    )
  }

  const sanitizedContent = DOMPurify.sanitize(content)

  // Phase 3.6 (2026-04): atomic update + revision write. Author edit →
  // quay lại PENDING để admin duyệt lại phần edit. Admin edit → giữ nguyên
  // status (preserve moderation state). Mỗi lần save tạo PostRevision row
  // để build audit history.
  await prisma.$transaction(async (tx) => {
    // Sanitize coverImageUrl: chỉ accept Cloudinary URL, hoặc null để xóa.
    const sanitizedCover =
      coverImageUrl === null
        ? null
        : typeof coverImageUrl === "string" &&
            coverImageUrl.startsWith("https://res.cloudinary.com/")
          ? coverImageUrl
          : undefined // undefined = không update field
    const updated = await tx.post.update({
      where: { id },
      data: {
        title: title || null,
        content: sanitizedContent,
        ...(sanitizedCover !== undefined ? { coverImageUrl: sanitizedCover } : {}),
        ...(isAdminEdit
          ? {}
          : { status: "PENDING", moderationNote: null, moderatedAt: null, moderatedBy: null }),
      },
    })
    await writePostRevision({
      post: updated,
      editedBy: session.user.id,
      editedRole: isAdminEdit ? "ADMIN" : "OWNER",
      reason: isAdminEdit ? reason!.trim() : (reason?.trim() || null),
      tx,
    })
  })

  revalidateTag("feed", "max")
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const post = await prisma.post.findUnique({
    where: { id },
    select: { authorId: true },
  })

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (post.authorId !== session.user.id && !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.post.update({
    where: { id },
    data: { status: "DELETED" },
  })

  revalidateTag("feed", "max")
  // Soft-delete giảm quota count → invalidate cache để UI hiện số mới ngay.
  revalidateTag(`quota:${post.authorId}`, "max")
  return NextResponse.json({ success: true })
}
