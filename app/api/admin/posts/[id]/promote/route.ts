import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

/**
 * PATCH /api/admin/posts/[id]/promote
 *
 * Admin "Đẩy lên trang chủ" — Phase 3.7 round 4 (2026-04) workflow:
 *  1. Tag bài vào 1-3 News categories (newsCategories[]) → bài xuất hiện
 *     trong list page tương ứng (/tin-tuc, /nghien-cuu, ...).
 *  2. Optional: pin top homepage MemberRail (isPromoted boolean).
 *
 * Body: {
 *   newsCategories?: NewsCategory[]  // max 3, validate enum
 *   isPromoted?: boolean              // optional pin top
 * }
 *
 * Backward-compat: body cũ `{ promote: boolean }` vẫn được hiểu (chỉ toggle
 * isPromoted, không touch newsCategories).
 *
 * Side effects khi isPromoted=true:
 *  - Auto-approve PostPromotionRequest PENDING (tránh request mồ côi).
 *  - Revalidate homepage + feed.
 *
 * Side effects khi newsCategories thay đổi:
 *  - Revalidate list pages tương ứng (/tin-tuc, /nghien-cuu, ...).
 *
 * Chỉ ADMIN. INFINITE read-only không đụng được.
 */
const VALID_NEWS_CATEGORIES = [
  "GENERAL", "RESEARCH", "LEGAL", "SPONSORED_PRODUCT",
  "BUSINESS", "PRODUCT", "EXTERNAL_NEWS", "AGRICULTURE",
] as const
type NewsCat = (typeof VALID_NEWS_CATEGORIES)[number]

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "post:promote")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as {
    promote?: boolean
    isPromoted?: boolean
    newsCategories?: string[]
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, isPromoted: true, status: true, newsCategories: true },
  })
  if (!post) {
    return NextResponse.json({ error: "Không tìm thấy bài" }, { status: 404 })
  }
  if (post.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "Chỉ bài đã xuất bản mới được đẩy lên trang chủ." },
      { status: 409 },
    )
  }

  // Resolve isPromoted target: prefer `isPromoted` if provided, fallback
  // `promote` (backward-compat), else keep current.
  let newPromoted: boolean = post.isPromoted
  if (typeof body.isPromoted === "boolean") {
    newPromoted = body.isPromoted
  } else if (typeof body.promote === "boolean") {
    newPromoted = body.promote
  }

  // Resolve newsCategories: validate + dedupe + max 3. Nếu body không gửi
  // field, giữ nguyên giá trị hiện tại.
  let newCategories: NewsCat[] | undefined
  if (Array.isArray(body.newsCategories)) {
    newCategories = [
      ...new Set(
        body.newsCategories.filter(
          (c: unknown): c is NewsCat =>
            typeof c === "string" &&
            (VALID_NEWS_CATEGORIES as readonly string[]).includes(c),
        ),
      ),
    ].slice(0, 3)
  }

  const now = new Date()

  // Auto-unpromote theo thời gian — promotedAt đánh dấu thời điểm bài
  // transition unpromoted → promoted. Cron unpromote-stale daily gỡ cả 2 cờ
  // sau 2 ngày. "Promoted" = isPromoted=true HOẶC newsCategories non-empty.
  // Re-save không reset window — admin có thể chỉ đổi categories array.
  const wasPromoted = post.isPromoted || post.newsCategories.length > 0
  const finalCategories = newCategories ?? post.newsCategories
  const willBePromoted = newPromoted || finalCategories.length > 0
  const promotedAtUpdate: { promotedAt?: Date | null } = {}
  if (!wasPromoted && willBePromoted) promotedAtUpdate.promotedAt = new Date()
  else if (wasPromoted && !willBePromoted) promotedAtUpdate.promotedAt = null

  // Atomic: post.update + request.updateMany
  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id },
      data: {
        isPromoted: newPromoted,
        ...(newCategories !== undefined ? { newsCategories: newCategories } : {}),
        ...promotedAtUpdate,
      },
    })
    if (newPromoted && !post.isPromoted) {
      await tx.postPromotionRequest.updateMany({
        where: { postId: id, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedBy: session.user.id,
          reviewedAt: now,
          reviewNote: "Được duyệt khi admin chủ động đẩy lên trang chủ.",
        },
      })
    }
  })

  // Revalidate cache. Tags + paths đủ cover homepage + feed + list pages.
  revalidateTag("homepage", "max")
  revalidateTag("posts", "max")
  revalidateTag("news", "max") // list pages query Post + News merged → cùng tag
  revalidatePath("/[locale]", "layout")
  revalidatePath("/[locale]/feed", "page")
  revalidatePath("/[locale]/tin-tuc", "page")
  revalidatePath("/[locale]/nghien-cuu", "page")
  revalidatePath("/[locale]/khuyen-nong", "page")
  revalidatePath("/[locale]/tin-bao-chi", "page")

  return NextResponse.json({
    isPromoted: newPromoted,
    newsCategories: newCategories ?? post.newsCategories,
  })
}
