import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTierThresholds } from "@/lib/tier"
import { getSortedFeedPostIds } from "@/lib/feed-sort"
import { getQuotaUsage } from "@/lib/quota"
import { getProductQuotaUsage } from "@/lib/product-quota"
import { getBannerQuotaUsage } from "@/lib/bannerQuota"
import { getCachedFeedFirstPage, getViewerReactions, mergeReactions } from "@/lib/feed-cache"
import { FeedClient } from "./FeedClient"
import { SidebarBanners, SidebarBannersSkeleton } from "./SidebarBanners"
import { TopContributorsCard, TopContributorsCardSkeleton } from "./TopContributorsCard"

export const revalidate = 60 // 1 min — feed updates are not real-time critical

type FeedFilter = "NEWS" | "PRODUCT" | "MINE" | "PINNED"

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const session = await auth()
  const userId = session?.user?.id
  const isAdminUser = session?.user?.role === "ADMIN"
  // Homepage link qua `/feed?category=NEWS|PRODUCT|MINE|PINNED`. MINE chỉ
  // cho user đã login. PINNED chỉ cho admin. Phase 3.7 round 4 (2026-04).
  const { category: rawCategory } = await searchParams
  const initialFilter: FeedFilter =
    rawCategory === "PRODUCT" ? "PRODUCT"
    : rawCategory === "MINE" && userId ? "MINE"
    : rawCategory === "PINNED" && isAdminUser ? "PINNED"
    : "NEWS"

  // Initial 10 posts — promoted first, then by authorPriority + createdAt.
  // Smaller initial page = faster TTFB; cursor pagination loads 10 more on scroll.
  //
  // Moderation visibility rules:
  //  - PUBLISHED → visible to all
  //  - LOCKED + moderationNote=null → auto-lock tu 5+ reports → visible to all
  //    (show banner "Bai da bi tam khoa")
  //  - LOCKED + moderationNote!=null → admin REJECTED trong moderation → CHI
  //    owner thay (voi banner do + ly do). Hien cho public se trai tinh than
  //    moderation (bai xau khong nen lo ra cho moi nguoi).
  //  - PENDING → CHI owner thay (banner vang "Cho duyet")
  // Initial render khớp với filter = initialFilter (default NEWS, hoặc
  // PRODUCT nếu vào từ section "Sản phẩm hội viên" trên trang chủ).
  //
  // Performance (2026-05): NEWS/PRODUCT first page đi qua `unstable_cache`
  // (60s TTL, tag "feed") — share giữa anon + logged-in để tận dụng cache
  // hit. Reactions của viewer fetch riêng (per-user, không cache) rồi merge.
  // PINNED/MINE giữ direct query (mỗi cái 1 user perspective, low traffic).
  const useCachedFeed = initialFilter === "NEWS" || initialFilter === "PRODUCT"

  const POST_INITIAL_SELECT = {
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
    reactions: {
      where: { userId: userId ?? "none" },
      select: { type: true },
    },
    promotionRequests: {
      take: 1,
      orderBy: { createdAt: "desc" as const },
      select: { status: true, reviewNote: true },
    },
    _count: { select: { reactions: true, comments: { where: { deletedAt: null } } } },
  } as const

  type DirectPostShape = Awaited<
    ReturnType<typeof prisma.post.findMany<{ select: typeof POST_INITIAL_SELECT }>>
  >[number]
  // Union type — cached path có dates dạng string (đã serialize), direct
  // query có Date instance. Consumer dùng toIso() normalize cuối cùng.
  type InitialPostShape =
    | DirectPostShape
    | (Omit<DirectPostShape, "createdAt" | "updatedAt" | "lockedAt"> & {
        createdAt: string
        updatedAt: string
        lockedAt: string | null
      })
  let initialPosts: InitialPostShape[]
  if (useCachedFeed) {
    // Cached query (no reactions field) → merge reactions per-viewer.
    const cachedPosts = await getCachedFeedFirstPage(
      initialFilter as "NEWS" | "PRODUCT",
      false,
    )
    const reactionsMap = userId
      ? await getViewerReactions(userId, cachedPosts.map((p) => p.id))
      : new Map<string, string[]>()
    initialPosts = mergeReactions(cachedPosts, reactionsMap) as InitialPostShape[]
  } else {
    initialPosts = await prisma.post.findMany({
      where:
        initialFilter === "PINNED"
          ? { isPromoted: true, status: "PUBLISHED" }
          : initialFilter === "MINE"
            ? { authorId: userId!, status: { not: "DELETED" } }
            : userId
              ? {
                  category: initialFilter,
                  OR: [
                    { status: "PUBLISHED" },
                    { status: "LOCKED", moderationNote: null },
                    { status: "PENDING", authorId: userId },
                    { status: "LOCKED", moderationNote: { not: null }, authorId: userId },
                  ],
                }
              : {
                  category: initialFilter,
                  OR: [
                    { status: "PUBLISHED" },
                    { status: "LOCKED", moderationNote: null },
                  ],
                },
      orderBy:
        initialFilter === "MINE" || initialFilter === "PINNED"
          ? [{ createdAt: "desc" }]
          : [
              { isPromoted: "desc" },
              { authorPriority: "desc" },
              { createdAt: "desc" },
            ],
      take: 10,
      select: POST_INITIAL_SELECT,
    })
  }

  // Date normalizer — cached path trả ISO string, direct query trả Date.
  // unstable_cache deserialize JSON → Date instance bị mất → consumer
  // call .toISOString() trên string sẽ throw. Fallback wrapping để cả 2
  // đều ra string.
  const toIso = (d: Date | string | null | undefined): string | null => {
    if (d == null) return null
    return typeof d === "string" ? d : d.toISOString()
  }

  const posts = initialPosts.map((p) => {
    const { promotionRequests, ...rest } = p
    return {
      ...rest,
      createdAt: toIso(p.createdAt) as string,
      updatedAt: toIso(p.updatedAt) as string,
      lockedAt: toIso(p.lockedAt),
      latestPromotionRequest:
        userId && p.authorId === userId
          ? (promotionRequests[0] ?? null)
          : null,
    }
  })

  // Sidebar data — gộp các query CHẶN render chính vào 1 Promise.all.
  // Tier thresholds + membership + quota chặn vì:
  //  - tierSilver/Gold dùng để render badge cho từng PostCard (LCP element).
  //  - membershipInfo + quotaInfo gate composer + sidebar membership card.
  // Top contributors KHÔNG chặn — đã tách sang <TopContributorsCard> server
  // component, stream vào sidebar qua Suspense slot (2026-05 perf pass).
  const [
    membershipInfo,
    postQuota,
    productQuota,
    bannerQuota,
    bizTier,
    indTier,
  ] = await Promise.all([
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { membershipExpires: true, contributionTotal: true, displayPriority: true, accountType: true, company: { select: { name: true, slug: true } } },
        })
      : null,
    userId ? getQuotaUsage(userId) : null,
    userId ? getProductQuotaUsage(userId) : null,
    userId ? getBannerQuotaUsage(userId) : null,
    getTierThresholds("BUSINESS"),
    getTierThresholds("INDIVIDUAL"),
  ])

  const quotaInfo = postQuota && productQuota && bannerQuota
    ? {
        posts: {
          used: postQuota.used,
          limit: postQuota.limit,
          resetAt: postQuota.resetAt.toISOString(),
        },
        products: {
          used: productQuota.used,
          limit: productQuota.limit,
          resetAt: productQuota.resetAt.toISOString(),
        },
        banners: {
          used: bannerQuota.used,
          limit: bannerQuota.limit,
          resetAt: bannerQuota.resetAt.toISOString(),
        },
      }
    : null

  return (
    <FeedClient
      initialPosts={posts}
      initialFilter={initialFilter}
      currentUserId={userId ?? null}
      currentUserRole={session?.user?.role ?? null}
      currentUserName={session?.user?.name ?? null}
      currentUserAvatarUrl={session?.user?.image ?? null}
      tierSilver={bizTier.silver}
      tierGold={bizTier.gold}
      tierIndSilver={indTier.silver}
      tierIndGold={indTier.gold}
      membershipInfo={
        membershipInfo
          ? {
              expires: membershipInfo.membershipExpires?.toISOString() ?? null,
              contributionTotal: membershipInfo.contributionTotal,
              displayPriority: membershipInfo.displayPriority,
              accountType: membershipInfo.accountType,
              company: membershipInfo.company,
            }
          : null
      }
      quotaInfo={quotaInfo}
      topContributorsSlot={
        <Suspense key="top-contributors" fallback={<TopContributorsCardSkeleton key="top-contributors-fallback" />}>
          <TopContributorsCard key="top-contributors-content" />
        </Suspense>
      }
      sidebarBannersSlot={
        <Suspense key="sidebar-banners" fallback={<SidebarBannersSkeleton key="sidebar-banners-fallback" />}>
          <SidebarBanners key="sidebar-banners-content" />
        </Suspense>
      }
    />
  )
}
