"use server"

import { prisma } from "@/lib/prisma"
import { TIN_TUC_PUBLIC_CATEGORIES, TIN_TUC_PUBLIC_TEMPLATE } from "./categories"

export type NewsListItem = {
  id: string
  title: string
  title_en: string | null
  title_zh: string | null
  title_ar: string | null
  slug: string
  excerpt: string | null
  excerpt_en: string | null
  excerpt_zh: string | null
  excerpt_ar: string | null
  coverImageUrl: string | null
  isPinned: boolean
  publishedAt: Date | null
  // Phase 3.7 round 4 (2026-04): khi source="post", item là feed Post được
  // admin tag vào News categories. Render badge "Bài hội viên" + href dùng
  // /bai-viet/[id] thay vì /tin-tuc/[slug]. Optional, default → "news".
  source?: "news" | "post"
}

export type LoadMoreResult = {
  items: NewsListItem[]
  hasMore: boolean
}

const NEWS_SELECT = {
  id: true,
  title: true, title_en: true, title_zh: true, title_ar: true,
  slug: true,
  excerpt: true, excerpt_en: true, excerpt_zh: true, excerpt_ar: true,
  coverImageUrl: true,
  isPinned: true,
  publishedAt: true,
} as const

/**
 * Server action: lazy-load thêm danh sách tin tức cho section "Mới nhất"
 * trên trang list. Dùng skip/take thay vì cursor vì order có isPinned desc
 * trước publishedAt — cursor phức tạp khi tie-break.
 *
 * Trick +1: take (n+1) items để biết còn data phía sau, sau đó slice(0, n)
 * để trả đúng n. Rẻ hơn 1 query COUNT riêng.
 */
export async function loadMoreNews(params: {
  skip: number
  take: number
  q?: string
}): Promise<LoadMoreResult> {
  const where = {
    isPublished: true,
    template: TIN_TUC_PUBLIC_TEMPLATE, // Q1=B: chỉ NORMAL; PHOTO/VIDEO → /multimedia
    AND: [
      {
        OR: [
          { category: { in: [...TIN_TUC_PUBLIC_CATEGORIES] } },
          { secondaryCategories: { hasSome: [...TIN_TUC_PUBLIC_CATEGORIES] } },
        ],
      },
      ...(params.q
        ? [
            {
              OR: [
                { title: { contains: params.q, mode: "insensitive" as const } },
                { excerpt: { contains: params.q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  }
  const items = await prisma.news.findMany({
    where,
    orderBy: [{ isPinned: "desc" }, { publishedAt: { sort: "desc", nulls: "last" } }],
    skip: params.skip,
    take: params.take + 1,
    select: NEWS_SELECT,
  })
  const hasMore = items.length > params.take
  return {
    items: hasMore ? items.slice(0, params.take) : items,
    hasMore,
  }
}
