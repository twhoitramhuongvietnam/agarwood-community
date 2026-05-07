/**
 * Cache feed first-page query — share giữa mọi visitor (anon + logged-in)
 * vì base data (post + author + product + counts) không phụ thuộc viewer.
 * User-specific data (reactions của viewer) fetch riêng + merge sau.
 *
 * Cache TTL 60s + tag "feed" để mutation route invalidate. Sau khi user post
 * bài mới qua /api/posts POST, gọi `revalidateTag("feed")` → cache rebuild
 * lần next request.
 *
 * Pagination (cursor != null) bypass cache vì biến thể quá nhiều.
 */
import { unstable_cache } from "next/cache"
import { prisma } from "./prisma"
import { getSortedFeedPostIds } from "./feed-sort"
import type { PostCategory } from "@prisma/client"

const POST_SELECT_NO_REACTIONS = {
  id: true,
  authorId: true,
  title: true,
  content: true,
  imageUrls: true,
  status: true,
  category: true,
  isPremium: true,
  isPromoted: true,
  newsCategories: true,
  authorPriority: true,
  viewCount: true,
  reportCount: true,
  lockedBy: true,
  lockReason: true,
  moderationNote: true,
  createdAt: true,
  updatedAt: true,
  lockedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
      accountType: true,
      contributionTotal: true,
      company: { select: { name: true, slug: true } },
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      priceRange: true,
      category: true,
      badgeUrl: true,
      certStatus: true,
      isFeatured: true,
    },
  },
  promotionRequests: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
    select: { status: true, reviewNote: true },
  },
  _count: { select: { reactions: true, comments: { where: { deletedAt: null } } } },
} as const

type PrismaPostRow = Awaited<
  ReturnType<typeof prisma.post.findMany<{ select: typeof POST_SELECT_NO_REACTIONS }>>
>[number]

/** Cached version có Date đã serialize thành ISO string — `unstable_cache`
 *  tuần tự hoá output qua JSON, Date sẽ về string sau lần read 2+. Để tránh
 *  consumer call `.toISOString()` trên string, ta serialize sẵn ở producer. */
export type CachedFeedPost = Omit<PrismaPostRow, "createdAt" | "updatedAt" | "lockedAt"> & {
  createdAt: string
  updatedAt: string
  lockedAt: string | null
}

function serializePostDates(p: PrismaPostRow): CachedFeedPost {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    lockedAt: p.lockedAt ? p.lockedAt.toISOString() : null,
  }
}

/** First page (10 bài) cho filter NEWS/PRODUCT. Đếm là filter "anonymous
 *  view" — tức là user logged-in vẫn nhận cùng cache, chỉ thiếu pending bài
 *  của chính họ (đã có local-storage `my-recent-posts` xử lý). */
export const getCachedFeedFirstPage = unstable_cache(
  async (filter: "NEWS" | "PRODUCT", certifiedOnly: boolean): Promise<CachedFeedPost[]> => {
    const helperCategory: PostCategory =
      certifiedOnly || filter === "PRODUCT" ? "PRODUCT" : "NEWS"

    const ids = await getSortedFeedPostIds({
      category: helperCategory,
      userId: null,
      certifiedOnly,
      cursor: null,
      take: 10,
    })
    if (ids.length === 0) return []

    const rows = await prisma.post.findMany({
      where: { id: { in: ids } },
      select: POST_SELECT_NO_REACTIONS,
    })
    const idxMap = new Map(ids.map((id, i) => [id, i]))
    rows.sort((a, b) => (idxMap.get(a.id) ?? 0) - (idxMap.get(b.id) ?? 0))
    return rows.map(serializePostDates)
  },
  ["feed_first_page"],
  { revalidate: 60, tags: ["feed", "posts"] },
)

/** Fetch reactions của viewer cho 1 list post IDs. ~10-50ms — không cache
 *  vì per-user. Trả map {postId → array of reaction types}. */
export async function getViewerReactions(
  userId: string,
  postIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (postIds.length === 0) return map

  const reactions = await prisma.postReaction.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true, type: true },
  })
  for (const r of reactions) {
    const arr = map.get(r.postId) ?? []
    arr.push(r.type)
    map.set(r.postId, arr)
  }
  return map
}

/** Merge cached posts + viewer reactions. Output có shape giống posts.findMany
 *  với `reactions: Array<{type}>` để code consumer không phải đổi.
 *
 *  Lưu ý: dates ở dạng ISO string (cached form). Consumer dùng trực tiếp,
 *  KHÔNG call `.toISOString()` lần nữa (sẽ throw vì không phải Date). */
export function mergeReactions(
  posts: CachedFeedPost[],
  reactionsByPostId: Map<string, string[]>,
): Array<CachedFeedPost & { reactions: { type: string }[] }> {
  return posts.map((p) => ({
    ...p,
    reactions: (reactionsByPostId.get(p.id) ?? []).map((type) => ({ type })),
  }))
}
