import "server-only"
import { unstable_cache } from "next/cache"
import { prisma } from "./prisma"
import type { PostCategory, NewsCategory } from "@prisma/client"
import { newsToMultimedia } from "./multimedia-from-news"

/**
 * Data fetchers cho trang chủ báo chí (Phase 3).
 *
 * Nguyên tắc:
 *  - Tất cả query "lên trang chủ" phải filter `isPremium: true` (chỉ bài VIP)
 *    NGOẠI TRỪ MemberNewsRail (Section 2) — section này show cả non-VIP ở slot rotate.
 *  - Section 1 (Tin Hội) dùng `News` model do admin đăng — không phải Post.
 *  - Section 5+6 lọc theo `category` (NEWS / PRODUCT).
 */

const POST_CARD_SELECT = {
  id: true,
  title: true,
  content: true,
  imageUrls: true,
  // Phase 3.7 round 4 (2026-04): coverImageUrl explicit thumbnail 16:9.
  // Fallback ở UI: coverImageUrl > imageUrls[0] > extract from content > placeholder.
  coverImageUrl: true,
  category: true,
  isPremium: true,
  isPromoted: true,
  authorPriority: true,
  createdAt: true,
  viewCount: true,
  author: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
      // Phase 3.7 round 4 (2026-04): contributionTotal dùng cho scoring
      // weighted random ở MemberRail rotating slot — đo độ cống hiến thực
      // tế của tác giả thay vì authorPriority (chỉ phản ánh tier).
      contributionTotal: true,
      company: { select: { name: true, slug: true } },
    },
  },
  // certStatus để áp feed-sort algo cho homepage Tin SP section.
  product: { select: { certStatus: true } },
} as const

// ── Section 1: Tin tức Hội ────────────────────────────────────────────────────

const NEWS_CARD_SELECT = {
  id: true,
  title: true,
  title_en: true,
  title_zh: true,
  title_ar: true,
  slug: true,
  excerpt: true,
  excerpt_en: true,
  excerpt_zh: true,
  excerpt_ar: true,
  coverImageUrl: true,
  publishedAt: true,
  isPinned: true,
  // Phase 3.7 round 4 (2026-04): admin pin per-section homepage. Cần ở
  // select để client-side sort (pin for this section → first).
  pinnedInCategories: true,
  category: true, // để href helper route theo category
  // Phase 3.7 round 4 (2026-04): cần template + gallery để derive thumbnail
  // fallback (YouTube thumb cho VIDEO, gallery[0] cho PHOTO) khi card không
  // có coverImageUrl explicit. Xem newsCoverImage() ở multimedia-from-news.ts.
  template: true,
  gallery: true,
} as const

/**
 * Href helper — route News item theo category.
 *  - GENERAL, SPONSORED_PRODUCT, BUSINESS, PRODUCT → /tin-tuc/[slug]
 *  - RESEARCH                                       → /nghien-cuu/[slug]
 *  - LEGAL                                          → /phap-ly (hub)
 *
 * Phase 3.3 (2026-04): BUSINESS + PRODUCT thêm cùng route /tin-tuc.
 *
 * LEGAL đặc biệt: 2 slug cố định chinh-sach-bao-mat / dieu-khoan-su-dung có
 * trang riêng /privacy /terms, nhưng từ section "Tin Hội" ta đều route về
 * /phap-ly để user browse toàn bộ văn bản pháp quy cùng chỗ.
 */
export function newsHref(category: string, slug: string): string {
  switch (category) {
    case "RESEARCH":
      return `/nghien-cuu/${slug}`
    case "LEGAL":
      return "/phap-ly"
    // Phase 3.5 (2026-04): 2 surface mới — tin báo chí ngoài + khuyến nông.
    case "EXTERNAL_NEWS":
      return `/tin-bao-chi/${slug}`
    case "AGRICULTURE":
      return `/khuyen-nong/${slug}`
    case "GENERAL":
    case "SPONSORED_PRODUCT":
    case "BUSINESS":
    case "PRODUCT":
    default:
      return `/tin-tuc/${slug}`
  }
}

export const getAssociationNews = unstable_cache(
  async () => {
    // Tất cả 4 category đổ chung vào section "Tin Hội" theo yêu cầu customer.
    // Trùng lặp với /nghien-cuu section là có chủ đích — RESEARCH quan trọng
    // xuất hiện ở cả 2 nơi. Click-through dùng newsHref() route đúng loại.
    //
    // Phase 3.7 round 4 (2026-04): admin pin per-section. GENERAL pin →
    // bài lên top section Tin Hội. Sort: GENERAL-pin → isPinned global →
    // publishedAt desc. Overfetch 3x cho JS re-rank (Prisma không sort
    // được trên `array.has`).
    const candidates = await prisma.news.findMany({
      where: { isPublished: true },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: 21,
      select: NEWS_CARD_SELECT,
    })
    return [...candidates]
      .sort((a, b) => {
        const aPin = a.pinnedInCategories.includes("GENERAL")
        const bPin = b.pinnedInCategories.includes("GENERAL")
        if (aPin !== bPin) return aPin ? -1 : 1
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
      })
      .slice(0, 7)
  },
  ["homepage_news"],
  { revalidate: 300, tags: ["homepage", "news"] },
)

// ── Section 3b: Bài nghiên cứu mới ──────────────────────────────────────────
// News với category=RESEARCH — hiển thị grid 3 cột tương tự LatestPostsSection.

export const getLatestResearchNews = unstable_cache(
  async (take = 3) => {
    // Phase 3.7 round 4 (2026-04): admin pin per-section. Mở rộng where với
    // pinnedInCategories (cho phép cross-list pin) + overfetch để có pool
    // re-rank ở JS (Prisma orderBy không support array `has` check trực tiếp).
    const candidates = await prisma.news.findMany({
      where: {
        isPublished: true,
        OR: [
          { category: "RESEARCH" },
          { pinnedInCategories: { has: "RESEARCH" } },
        ],
      },
      orderBy: [{ publishedAt: "desc" }],
      take: take * 3,
      select: NEWS_CARD_SELECT,
    })
    return [...candidates]
      .sort((a, b) => {
        const aPin = a.pinnedInCategories.includes("RESEARCH")
        const bPin = b.pinnedInCategories.includes("RESEARCH")
        if (aPin !== bPin) return aPin ? -1 : 1
        return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
      })
      .slice(0, take)
  },
  ["homepage_research"],
  { revalidate: 300, tags: ["homepage", "news"] },
)

// ── Section 3c: Tin khuyến nông ─────────────────────────────────────────────
// News với category=AGRICULTURE — Phase 3.7 round 4 (2026-04). Layout 3 cột
// (hero / 2 mid / 4 small) theo yêu cầu khách hàng — xem AgricultureSection.

export const getLatestAgricultureNews = unstable_cache(
  async (take = 7) => {
    // Primary OR pinned-for-AGRICULTURE — pin mở rộng visibility cross-list.
    // Secondary cross-listing không tự động lên homepage (chỉ áp /khuyen-nong
    // list page); nhưng admin có thể pin để override.
    const candidates = await prisma.news.findMany({
      where: {
        isPublished: true,
        OR: [
          { category: "AGRICULTURE" },
          { pinnedInCategories: { has: "AGRICULTURE" } },
        ],
      },
      orderBy: [{ publishedAt: "desc" }],
      take: take * 3,
      select: NEWS_CARD_SELECT,
    })
    return [...candidates]
      .sort((a, b) => {
        const aPin = a.pinnedInCategories.includes("AGRICULTURE")
        const bPin = b.pinnedInCategories.includes("AGRICULTURE")
        if (aPin !== bPin) return aPin ? -1 : 1
        return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
      })
      .slice(0, take)
  },
  ["homepage_agriculture"],
  { revalidate: 300, tags: ["homepage", "news"] },
)

// ── Section 2: Bản tin hội viên (right rail) ─────────────────────────────────

/**
 * Top 4 slots — order: promoted → ngày VN (by-day desc) → độ cống hiến tác
 * giả (contributionTotal desc) → createdAt desc tie-break.
 *
 * Lý do day-bucket: trong cùng 1 ngày, hội viên cống hiến cao luôn trên hội
 * viên cống hiến thấp; sang ngày khác, ngày mới hơn thắng — tránh case bài
 * cũ của contributor cao đè bài hôm nay của contributor thấp.
 *
 * Phase 3.7 round 4 (2026-04): không thể day-bucket sort native ở Postgres
 * (cần generated column hoặc raw SQL); overfetch (take 20) rồi sort JS với
 * VN timezone tương tự `getMergedFeedCached`.
 */
export const getTopVipMemberPosts = unstable_cache(
  async () => {
    const candidates = await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        // Mặc định chỉ VIP post lên homepage. Nếu admin chủ động
        // `isPromoted=true` (qua menu feed hoặc duyệt promotion-request)
        // thì override — bài được feature bất kể tier tác giả.
        OR: [{ isPremium: true }, { isPromoted: true }],
      },
      // Pool selection: lấy 20 promoted+premium gần nhất. JS sort sau đó
      // sẽ re-rank theo day-bucket → contribution → date.
      orderBy: [{ isPromoted: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: POST_CARD_SELECT,
    })

    const VN_TZ_OFFSET_MS = 7 * 60 * 60 * 1000
    const startOfDayVN = (ms: number) => {
      const vnLocal = ms + VN_TZ_OFFSET_MS
      return Math.floor(vnLocal / 86400000) * 86400000 - VN_TZ_OFFSET_MS
    }

    return [...candidates]
      .sort((a, b) => {
        if (a.isPromoted !== b.isPromoted) return a.isPromoted ? -1 : 1
        const dayA = startOfDayVN(a.createdAt.getTime())
        const dayB = startOfDayVN(b.createdAt.getTime())
        if (dayA !== dayB) return dayB - dayA
        const cA = a.author.contributionTotal ?? 0
        const cB = b.author.contributionTotal ?? 0
        if (cA !== cB) return cB - cA
        return b.createdAt.getTime() - a.createdAt.getTime()
      })
      .slice(0, 4)
  },
  ["homepage_top_vip_members"],
  { revalidate: 300, tags: ["homepage", "posts"] },
)

const MEMBER_POOL_WINDOWS = [3, 7, 30] as const

/**
 * Pool cho slot rotate — bài VIP+non-VIP mới nhất. 
 * Mở rộng cửa sổ thời gian nếu pool quá ít (3 ngày → 1 tuần → 1 tháng) để
 * đảm bảo trang chủ luôn có nội dung xoay vòng (yêu cầu 2026-05-03).
 */
export function getMemberPostsPool() {
  const bucket = Math.floor(Date.now() / 300_000) // 5-min bucket
  return getMemberPostsPoolCached(bucket)
}

const getMemberPostsPoolCached = unstable_cache(
  async (_bucket: number) => {
    void _bucket
    for (const days of MEMBER_POOL_WINDOWS) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const results = await prisma.post.findMany({
        where: { status: "PUBLISHED", createdAt: { gte: cutoff } },
        orderBy: [{ createdAt: "desc" }],
        take: 30,
        select: POST_CARD_SELECT,
      })
      // Nếu đủ 30 bài hoặc đã đạt tới giới hạn mở rộng cuối cùng (1 tháng)
      if (results.length >= 30 || days === MEMBER_POOL_WINDOWS[MEMBER_POOL_WINDOWS.length - 1]) {
        return results
      }
    }
    return []
  },
  ["homepage_member_posts_pool"],
  { revalidate: 300, tags: ["homepage", "posts"] },
)

/** Filter pool exclude top IDs + weighted random theo contributionTotal của
 *  tác giả. Shuffle deterministic theo bucket 5 phút để "xoay vòng" slot.
 *
 *  Score = (log10(contribution + 1) + 1) * (0.5 + rng())
 *
 *  Log10 scale vì contribution range rộng (0 → 20M+ VND) — linear sẽ làm
 *  hội viên contrib cao luôn thắng deterministic, mất hiệu ứng xoay vòng.
 *  Sau log10: 0 VND → 0, 1M → 6, 10M (Bạc) → 7, 20M (Vàng) → 7.3, 100M → 8.
 *  Khoảng cách 0.3-0.4 giữa các tier × random 0.5-1.5 = vừa giữ ưu thế cho
 *  contrib cao, vừa cho hội viên thường vẫn có cơ hội. +1 outer = baseline
 *  cho user 0 đồng có cơ hội vào pool (score = 1 × rng thay vì 0).
 */
export function pickRotatingMembers(
  pool: HomepagePost[],
  excludeIds: string[],
  count: number = 7,
): HomepagePost[] {
  const bucket = Math.floor(Date.now() / 300_000)
  const rng = mulberry32(bucket)
  const excludeSet = new Set(excludeIds)
  return pool
    .filter((p) => !excludeSet.has(p.id))
    .map((p) => ({
      post: p,
      score:
        (Math.log10((p.author.contributionTotal ?? 0) + 1) + 1) *
        (0.5 + rng()),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.post)
}

/** Backward-compat wrapper cho code cũ dùng `getRotatingMemberPosts(ids)`.
 *  Serial (pool then filter) — caller mới nên dùng getMemberPostsPool +
 *  pickRotatingMembers để fetch parallel. */
export async function getRotatingMemberPosts(excludeIds: string[]) {
  const pool = await getMemberPostsPool()
  return pickRotatingMembers(pool, excludeIds)
}

// Mulberry32 PRNG — small, fast, deterministic
function mulberry32(seed: number) {
  let a = seed | 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Section 3: Sản phẩm tiêu biểu (carousel) ─────────────────────────────────

export const getFeaturedProductsForHomepage = unstable_cache(
  async () => {
    return prisma.product.findMany({
      where: {
        isFeatured: true,
        isPublished: true,
        // Đồng bộ với /admin/tieu-bieu filter — bao gồm INFINITE để DN hội
        // viên INFINITE (Sản Xuất Trầm hương VN, ...) cũng được feature.
        owner: { role: { in: ["VIP", "INFINITE", "ADMIN"] } },
      },
      orderBy: [
        { featuredOrder: "asc" },
        { createdAt: "desc" },
      ],
      take: 12,
      select: {
        id: true,
        name: true,
        name_en: true,
        name_zh: true,
        name_ar: true,
        slug: true,
        imageUrls: true,
        priceRange: true,
        category: true,
        certStatus: true,
        owner: { select: { name: true } },
        company: { select: { name: true, name_en: true, name_zh: true, name_ar: true, slug: true } },
      },
    })
  },
  ["homepage_featured_products"],
  { revalidate: 600, tags: ["homepage", "products"] },
)

// ── Section "Tin doanh nghiệp / Tin sản phẩm mới nhất" — MERGED ─────────────
// Phase 3.3 (2026-04, Q0=C decision): mỗi section gộp cả Post (feed VIP) +
// News (admin đăng) cho đồng category, sort theo date desc, take N. Trước đây
// chỉ pull từ Post → admin News kg lên homepage. Giờ unified shape, click
// route đúng nguồn (/bai-viet vs /tin-tuc).

export type MergedFeedItem = {
  /** Unique key dùng cho React: prefix theo nguồn để Post.id và News.id
   *  không collide trong cùng list. */
  id: string
  /** Full path đã rewrite — Post → /bai-viet/{id}, News → /tin-tuc/{slug}. */
  href: string
  /** Source tag — useful cho analytics + có thể debug. */
  source: "post" | "news"
  title: string
  title_en: string | null
  title_zh: string | null
  title_ar: string | null
  coverUrl: string | null
  /** Date dùng để sort + render. Post = createdAt, News = publishedAt. */
  date: Date | string | null
  excerpt: string | null
  excerpt_en: string | null
  excerpt_zh: string | null
  excerpt_ar: string | null
}

/** Strip HTML tags + collapse whitespace — fallback khi Post không có title. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

/** Best-effort: extract Cloudinary URL đầu trong content khi imageUrls rỗng. */
function extractFirstImage(content: string): string | null {
  const m = content.match(/https:\/\/res\.cloudinary\.com\/[^"'\s)]+/)
  return m ? m[0] : null
}

export function getMergedFeed(
  postCategory: PostCategory,
  newsCategory: NewsCategory,
  take = 6,
) {
  return getMergedFeedCached(postCategory, newsCategory, take)
}

const getMergedFeedCached = unstable_cache(
  async (
    postCategory: PostCategory,
    newsCategory: NewsCategory,
    take: number,
  ): Promise<MergedFeedItem[]> => {
    // Overfetch (take * 2) mỗi nguồn — sau khi merge + sort, slice về take.
    // Cần overfetch vì 1 nguồn có thể "thắng" hết slot khi date của nguồn
    // kia tụt dốc (vd Post đăng ầm ầm, News thưa thớt).
    const [posts, news] = await Promise.all([
      prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          // VIP/INFINITE mặc định (isPremium); admin promote override
          // (isPromoted); ADMIN-authored bao gồm vì admin post = curated
          // content. Phase 3.7 round 4 (2026-04).
          OR: [
            { isPremium: true },
            { isPromoted: true },
            { author: { role: "ADMIN" } },
          ],
          category: postCategory,
        },
        // Pool selection: orderBy createdAt desc + overfetch để feed-sort
        // ở merge step có đủ candidate.
        orderBy: { createdAt: "desc" },
        take: take * 4, // overfetch nhiều hơn để comparator JS có dải candidate
        select: POST_CARD_SELECT,
      }),
      prisma.news.findMany({
        where: {
          isPublished: true,
          template: "NORMAL", // Q1=B: PHOTO/VIDEO đẩy /multimedia
          // Primary OR pinned-for-this-category — admin pin mở rộng visibility
          // cross-list (vd bài primary GENERAL được pin lên Tin DN section).
          OR: [
            { category: newsCategory },
            { pinnedInCategories: { has: newsCategory } },
          ],
        },
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
        take: take * 4,
        select: NEWS_CARD_SELECT,
      }),
    ])

    // Phase 3.7 round 4 (2026-04): apply feed-sort algo (by-day VN → cert
    // PRODUCT only → priority → date) cho merged list để homepage Tin SP/DN
    // section consistent với /vi/feed?category. News được treat như post
    // không có cert + priority=0 (thua cert/high-priority products cùng ngày).
    type Sortable = MergedFeedItem & {
      _meta: { dateMs: number; cert: boolean; priority: number; pinned: boolean }
    }

    const VN_TZ_OFFSET_MS = 7 * 60 * 60 * 1000
    const startOfDayVN = (ms: number) => {
      const vnLocal = ms + VN_TZ_OFFSET_MS
      return Math.floor(vnLocal / 86400000) * 86400000 - VN_TZ_OFFSET_MS
    }

    const postItems: Sortable[] = posts.map((p) => ({
      id: `post-${p.id}`,
      href: `/bai-viet/${p.id}`,
      source: "post",
      title: p.title || stripHtml(p.content).slice(0, 80),
      title_en: null,
      title_zh: null,
      title_ar: null,
      // Fallback chain: coverImageUrl explicit > imageUrls[0] > first
      // image extracted from content. Nếu cả 3 null, UI fallback placeholder.
      coverUrl: p.coverImageUrl || p.imageUrls?.[0] || extractFirstImage(p.content),
      date: p.createdAt,
      excerpt: stripHtml(p.content).slice(0, 200) || null,
      excerpt_en: null,
      excerpt_zh: null,
      excerpt_ar: null,
      _meta: {
        dateMs: p.createdAt.getTime(),
        cert: p.product?.certStatus === "APPROVED",
        priority: p.authorPriority,
        // Post không có concept pin per-section (chỉ News có pinnedInCategories).
        pinned: false,
      },
    }))

    const newsItems: Sortable[] = news.map((n) => ({
      id: `news-${n.id}`,
      href: newsHref(n.category, n.slug),
      source: "news",
      title: n.title,
      title_en: n.title_en,
      title_zh: n.title_zh,
      title_ar: n.title_ar,
      coverUrl: n.coverImageUrl,
      date: n.publishedAt,
      excerpt: n.excerpt,
      excerpt_en: n.excerpt_en,
      excerpt_zh: n.excerpt_zh,
      excerpt_ar: n.excerpt_ar,
      _meta: {
        dateMs: n.publishedAt ? n.publishedAt.getTime() : 0,
        cert: false, // News không có concept cert
        priority: 0, // News không có authorPriority — thua mọi VIP post tier
        // Phase 3.7 round 4 (2026-04): pin per-section trump day-bucket.
        pinned: n.pinnedInCategories.includes(newsCategory),
      },
    }))

    const includeCertTier = postCategory === "PRODUCT"
    return [...postItems, ...newsItems]
      .sort((a, b) => {
        // Tier 0 (Phase 3.7 round 4 2026-04): pin per-section trump tất cả.
        // Admin ghim bài lên section trang chủ → luôn ở top kể cả ngày cũ.
        if (a._meta.pinned !== b._meta.pinned) return a._meta.pinned ? -1 : 1
        // Tier 1: day desc (VN tz)
        const dayA = startOfDayVN(a._meta.dateMs)
        const dayB = startOfDayVN(b._meta.dateMs)
        if (dayA !== dayB) return dayB - dayA
        // Tier 2 (PRODUCT only): cert APPROVED first
        if (includeCertTier && a._meta.cert !== b._meta.cert) {
          return a._meta.cert ? -1 : 1
        }
        // Tier 3: priority desc
        if (a._meta.priority !== b._meta.priority) {
          return b._meta.priority - a._meta.priority
        }
        // Tier 4: date desc tie-break
        return b._meta.dateMs - a._meta.dateMs
      })
      .slice(0, take)
      // Strip _meta khỏi return value (chỉ internal sort use)
      .map(({ _meta, ...item }) => {
        void _meta
        return item
      })
  },
  ["homepage_merged_feed"],
  { revalidate: 300, tags: ["homepage", "posts", "news"] },
)

// ── Multimedia Section: ảnh bộ sưu tập + video YouTube ──────────────────────
// Phase 3.7 round 4 (2026-04): bảng Multimedia đã merge vào News (template
// PHOTO/VIDEO). Đọc từ News, adapt qua newsToMultimedia() để giữ shape data
// mà MultimediaSection.tsx + UI cũ đang dùng.

const MULTIMEDIA_NEWS_SELECT = {
  id: true,
  template: true,
  slug: true,
  title: true,
  title_en: true,
  title_zh: true,
  title_ar: true,
  excerpt: true,
  excerpt_en: true,
  excerpt_zh: true,
  excerpt_ar: true,
  coverImageUrl: true,
  gallery: true,
  publishedAt: true,
  isPinned: true,
} as const

export const getLatestMultimedia = unstable_cache(
  async (take = 3) => {
    const rows = await prisma.news.findMany({
      where: { isPublished: true, template: { in: ["PHOTO", "VIDEO"] } },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take,
      select: MULTIMEDIA_NEWS_SELECT,
    })
    return rows.flatMap((n) => {
      const mapped = newsToMultimedia(n)
      return mapped ? [mapped] : []
    })
  },
  ["homepage_multimedia"],
  { revalidate: 300, tags: ["homepage", "multimedia", "news"] },
)

/**
 * Filtered by type — dùng cho tabs "Hình ảnh" vs "Video" trong section
 * MULTIMEDIA trên trang chủ. Fetch song song cả 2 type để user switch không
 * cần round-trip server.
 */
export const getMultimediaByType = unstable_cache(
  async (type: "PHOTO_COLLECTION" | "VIDEO", take = 3) => {
    const template = type === "PHOTO_COLLECTION" ? "PHOTO" : "VIDEO"
    const rows = await prisma.news.findMany({
      where: { isPublished: true, template },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take,
      select: MULTIMEDIA_NEWS_SELECT,
    })
    return rows.flatMap((n) => {
      const mapped = newsToMultimedia(n)
      return mapped ? [mapped] : []
    })
  },
  ["homepage_multimedia_by_type"],
  { revalidate: 300, tags: ["homepage", "multimedia", "news"] },
)

// ── Type exports cho components ──────────────────────────────────────────────

export type HomepageNewsItem = Awaited<ReturnType<typeof getAssociationNews>>[number]
export type HomepagePost = Awaited<ReturnType<typeof getTopVipMemberPosts>>[number]
export type HomepageProduct = Awaited<ReturnType<typeof getFeaturedProductsForHomepage>>[number]
export type HomepageMultimediaItem = Awaited<ReturnType<typeof getLatestMultimedia>>[number]
