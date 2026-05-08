import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { cloudinaryResize } from "@/lib/cloudinary"
import { BLUR_DATA_URL } from "@/lib/seo/blur-placeholder"
import { AgarwoodPlaceholder } from "@/components/ui/AgarwoodPlaceholder"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"
import { BASE_URL, SITE_NAME, hreflangAlternates, localizedUrl } from "@/lib/seo/site"
import { Section } from "@/components/features/homepage/Section"
import { HomepageBannerSlot } from "@/components/features/homepage/HomepageBannerSlot"
import { SidebarList } from "@/components/features/article/SidebarList"
import { LatestNewsList } from "./LatestNewsList"
import { NewsListItemCard } from "./NewsListItemCard"
import { TIN_TUC_PUBLIC_CATEGORIES, TIN_TUC_PUBLIC_TEMPLATE } from "./categories"
import { mergeByDateDesc } from "../_lib/post-news-merge"

const NEWS_LIST_SELECT = {
  id: true,
  title: true, title_en: true, title_zh: true, title_ar: true,
  slug: true,
  excerpt: true, excerpt_en: true, excerpt_zh: true, excerpt_ar: true,
  coverImageUrl: true,
  isPinned: true,
  publishedAt: true,
} as const

/** Main list query cho default (no search). Cache 5 phút tag "news"
 *  → revalidate khi có bài mới. Huge win so với hit DB mỗi request. */
const getDefaultNewsList = unstable_cache(
  async (take: number) =>
    prisma.news.findMany({
      where: {
        isPublished: true,
        OR: [
          { category: { in: [...TIN_TUC_PUBLIC_CATEGORIES] } },
          { secondaryCategories: { hasSome: [...TIN_TUC_PUBLIC_CATEGORIES] } },
        ],
        template: TIN_TUC_PUBLIC_TEMPLATE,
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: { sort: "desc", nulls: "last" } }],
      take,
      select: NEWS_LIST_SELECT,
    }),
  ["tin-tuc_list_default"],
  { revalidate: 300, tags: ["news", "tin-tuc"] },
)

/** Sidebar "Tin nổi bật" — cache 10 phút, shape khớp SidebarList (thumb). */
const getSidebarFeaturedNews = unstable_cache(
  async () =>
    prisma.news.findMany({
      where: {
        isPublished: true,
        OR: [
          { category: { in: [...TIN_TUC_PUBLIC_CATEGORIES] } },
          { secondaryCategories: { hasSome: [...TIN_TUC_PUBLIC_CATEGORIES] } },
        ],
        template: TIN_TUC_PUBLIC_TEMPLATE,
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: { sort: "desc", nulls: "last" } }],
      take: 4,
      select: {
        id: true,
        title: true, title_en: true, title_zh: true, title_ar: true,
        slug: true, coverImageUrl: true, publishedAt: true, isPinned: true,
        // Phase 3.7 round 4 (2026-04): template + gallery để SidebarList
        // fallback thumbnail (YouTube thumb / gallery[0]) khi cover null.
        template: true, gallery: true,
      },
    }),
  ["tin-tuc_sidebar_featured_v2"],
  { revalidate: 600, tags: ["news", "tin-tuc"] },
)

/** Server component streaming sidebar featured list — wrap trong Suspense ở
 *  page.tsx để không block main article render. */
async function SidebarFeaturedBlock({
  title,
  locale,
}: {
  title: string
  locale: Locale
}) {
  const items = await getSidebarFeaturedNews()
  return (
    <SidebarList
      title={title}
      items={items}
      locale={locale}
      itemHrefPrefix="/tin-tuc"
    />
  )
}

/** Skeleton hiển thị trong lúc chờ stream. Match chiều cao ~6 items để
 *  tránh layout shift khi data xuống. */
function SidebarFeaturedSkeleton() {
  return (
    <div aria-hidden>
      <div className="mb-4 h-[20px] w-24 border-b-[3px] border-brand-700 bg-neutral-200" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="aspect-16/10 w-[92px] shrink-0 bg-neutral-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-full bg-neutral-100" />
              <div className="h-3 w-3/4 bg-neutral-100" />
              <div className="h-2 w-16 bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export async function generateMetadata() {
  const t = await getTranslations("news")
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: hreflangAlternates("/tin-tuc"),
  }
}

export const revalidate = 3600

/** Số item load mỗi batch (initial server-render + mỗi lần lazy load). */
const LIST_PAGE_SIZE = 10
/** Số hero items (hero + sub-hero) hiển thị đầu trang khi không search. */
const HERO_COUNT = 4

// `d` có thể là Date (từ Prisma) hoặc string (từ unstable_cache đã serialize JSON).
function formatDate(d: Date | string | null) {
  if (!d) return ""
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const [locale, t] = await Promise.all([
    getLocale() as Promise<Locale>,
    getTranslations("news"),
  ])
  const l = <T extends Record<string, unknown>>(record: T, field: string) => localize(record, field, locale) as string

  const params = await searchParams
  const q = params.q ?? ""
  const isSearch = q.length > 0

  const where = {
    isPublished: true,
    template: TIN_TUC_PUBLIC_TEMPLATE,
    AND: [
      // Phase 3.7 round 4 (2026-04): primary OR secondary category match.
      {
        OR: [
          { category: { in: [...TIN_TUC_PUBLIC_CATEGORIES] } },
          { secondaryCategories: { hasSome: [...TIN_TUC_PUBLIC_CATEGORIES] } },
        ],
      },
      ...(q
        ? [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { excerpt: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  }

  // Khi không search: fetch HERO_COUNT (hero + 3 sub-hero) + LIST_PAGE_SIZE + 1
  // (+1 để đoán hasMore). Khi search: chỉ fetch LIST_PAGE_SIZE + 1.
  // Default path đi qua cache (huge perf win); search path bypass cache vì q
  // là keyword động, cache miss đa phần.
  const initialTake = isSearch ? LIST_PAGE_SIZE + 1 : HERO_COUNT + LIST_PAGE_SIZE + 1
  const newsList = isSearch
    ? await prisma.news.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { publishedAt: { sort: "desc", nulls: "last" } }],
        take: initialTake,
        select: NEWS_LIST_SELECT,
      })
    : await getDefaultNewsList(initialTake)

  // Phase 3.7 round 4 (2026-04): Post curated bởi admin (newsCategories
  // chứa 1 trong TIN_TUC_PUBLIC_CATEGORIES) — bài feed chỉnh chu được tag
  // làm tư liệu cho mục Tin tức. Skip khi search (search chỉ áp News).
  const memberPosts = isSearch
    ? []
    : await prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          newsCategories: { hasSome: [...TIN_TUC_PUBLIC_CATEGORIES] },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          content: true,
          imageUrls: true,
          coverImageUrl: true,
          createdAt: true,
          author: { select: { name: true, avatarUrl: true } },
        },
      })

  const showHero = !isSearch
  const heroItem = showHero && newsList[0] ? newsList[0] : null
  const subHeroItems = showHero ? newsList.slice(1, HERO_COUNT) : []
  // List stream = phần còn lại; slice bỏ +1 item "hasMore probe".
  const heroConsumed = showHero ? HERO_COUNT : 0
  // Phase 3.7 round 4 (2026-04): merge Posts vào latest list theo date desc
  // (hero/sub-hero giữ News-only — editorial layout). Load-more vẫn fetch
  // News-only theo skip = heroConsumed + LIST_PAGE_SIZE → consistent.
  const newsForLatest = newsList.slice(heroConsumed, heroConsumed + LIST_PAGE_SIZE)
  const initialListItems = mergeByDateDesc(newsForLatest, memberPosts)
  const initialHasMore = newsList.length > heroConsumed + LIST_PAGE_SIZE

  const listingJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("metaTitle"),
    description: t("metaDesc"),
    url: localizedUrl("/tin-tuc", locale),
    inLanguage: locale === "vi" ? "vi-VN" : locale === "zh" ? "zh-CN" : locale,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: BASE_URL },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: newsList.length,
      itemListElement: newsList.slice(0, heroConsumed + LIST_PAGE_SIZE).map((item, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: localizedUrl(`/tin-tuc/${item.slug}`, locale),
        name: localize(item, "title", locale) as string,
      })),
    },
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listingJsonLd) }} />

      {/* Grid 2-col ≥ lg. DOM order: Hero → Aside → Latest — match thứ tự mobile
          mà user yêu cầu (hero, tin nổi bật, tin mới nhất). Desktop dùng grid
          explicit positioning (col-start + row-start) để đẩy aside sang phải
          span 2 row, hero + latest chồng nhau cột trái. */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-x-10">
        {/* ─── 1. Hero + sub-hero ───────────────────────────────────────── */}
        <div className="min-w-0 lg:col-span-9 lg:col-start-1 lg:row-start-1">
          <Section
            title={t("pageTitle")}
            titleHref="/tin-tuc"
            rightNav={
              <form method="GET" action="/tin-tuc" className="flex items-center gap-2">
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder={t("searchPlaceholder")}
                  className="w-40 border border-neutral-300 bg-white px-2.5 py-1 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:border-brand-700 focus:outline-none sm:w-56"
                />
                <button
                  type="submit"
                  className="border border-brand-700 bg-brand-700 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-800"
                >
                  {t("searchBtn")}
                </button>
                {isSearch && (
                  <Link
                    href="/tin-tuc"
                    className="text-[11px] uppercase tracking-wide text-neutral-500 hover:text-brand-700 hover:underline"
                  >
                    ✕
                  </Link>
                )}
              </form>
            }
          >
            {isSearch && (
              <p className="mb-6 -mt-2 text-sm text-neutral-600">
                {t("sectionSearch")}:{" "}
                <strong className="text-neutral-900">&ldquo;{q}&rdquo;</strong>
              </p>
            )}

            {/* HERO + SUB-HERO (chỉ trang 1, không search).
                VTV-style: hero ngang (image left + text panel right), rồi 3
                sub-hero đứng xếp hàng dưới. */}
            {heroItem && (
              <div className="mb-10">
                {/* Hero article — image left (2/3) + text panel right (1/3) */}
                <Link
                  href={`/tin-tuc/${heroItem.slug}`}
                  className="group block lg:grid lg:grid-cols-3 lg:gap-0"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 lg:col-span-2 lg:aspect-auto">
                    {heroItem.coverImageUrl ? (
                      <Image
                        src={cloudinaryResize(heroItem.coverImageUrl, 1280)}
                        alt={l(heroItem, "title")}
                        fill
                        priority
                        sizes="(max-width: 1024px) 100vw, 66vw"
                        className="object-cover"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                      />
                    ) : (
                      <AgarwoodPlaceholder className="h-full w-full" size="xl" shape="square" tone="dark" />
                    )}
                    {heroItem.isPinned && (
                      <span className="absolute left-3 top-3 bg-brand-700 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                        {t("featured")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col justify-center bg-neutral-100 p-5 lg:p-7">
                    <h2 className="font-serif-headline text-[20px] font-bold leading-tight text-neutral-900 group-hover:text-brand-700 lg:text-[22px]">
                      {l(heroItem, "title")}
                    </h2>
                    {l(heroItem, "excerpt") && (
                      <p className="mt-3 line-clamp-4 text-[14px] leading-relaxed text-neutral-700 lg:line-clamp-5">
                        <span className="font-bold text-brand-700">VAWA - </span>
                        {l(heroItem, "excerpt")}
                      </p>
                    )}
                    <time className="mt-3 block text-[11px] uppercase tracking-wide text-neutral-500">
                      {formatDate(heroItem.publishedAt)}
                    </time>
                  </div>
                </Link>

                {/* Sub-hero — 3 bài xếp hàng dưới, image on top + title below */}
                {subHeroItems.length > 0 && (
                  <div className="mt-8 grid gap-6 border-t border-neutral-200 pt-8 sm:grid-cols-3">
                    {subHeroItems.map((item) => (
                      <Link
                        key={item.id}
                        href={`/tin-tuc/${item.slug}`}
                        className="group block"
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-neutral-100">
                          {item.coverImageUrl ? (
                            <Image
                              src={cloudinaryResize(item.coverImageUrl, 480)}
                              alt={l(item, "title")}
                              fill
                              sizes="(max-width: 640px) 100vw, 33vw"
                              className="object-cover"
                              placeholder="blur"
                              blurDataURL={BLUR_DATA_URL}
                            />
                          ) : (
                            <AgarwoodPlaceholder className="h-full w-full" size="md" shape="square" />
                          )}
                        </div>
                        <h3 className="mt-3 line-clamp-3 text-[15px] font-bold leading-snug text-neutral-900 group-hover:text-brand-700">
                          {l(item, "title")}
                        </h3>
                        <time className="mt-1 block text-[11px] uppercase tracking-wide text-neutral-500">
                          {formatDate(item.publishedAt)}
                        </time>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* ─── 2. Aside (sidebar) — ngay dưới hero trên mobile; sticky cột
             phải trải dài 2 row trên desktop. ─────────────────────────── */}
        <aside className="mt-10 min-w-0 space-y-8 lg:col-span-3 lg:col-start-10 lg:row-start-1 lg:row-span-2 lg:mt-0 lg:sticky lg:top-16 lg:self-start">
          <Suspense fallback={<SidebarFeaturedSkeleton />}>
            <SidebarFeaturedBlock title={t("sidebarFeatured")} locale={locale} />
          </Suspense>
          <Suspense fallback={null}>
            <HomepageBannerSlot slot="NEWS_LIST_SIDEBAR" />
          </Suspense>
        </aside>

        {/* ─── 3. "Tin mới nhất" — dưới aside trên mobile; cột trái row 2
             trên desktop. Lazy-load 10 items/batch. ──────────────────── */}
        <div className="mt-10 min-w-0 lg:col-span-9 lg:col-start-1 lg:row-start-2 lg:mt-10">
          {heroItem && (
            <h2 className="mb-5 inline-block border-b-[3px] border-brand-700 pb-1 text-[13px] font-bold uppercase tracking-wider text-neutral-900">
              {t("sectionLatest")}
            </h2>
          )}
          {/* Server-render initial batch (10 items) trực tiếp → zero
              hydration cost cho những item này. Chỉ LatestNewsList tail
              mới là client island (nhẹ, không cần items prop). */}
          {initialListItems.length === 0 ? (
            <div className="border border-dashed border-neutral-300 py-16 text-center">
              <p className="text-base font-medium text-neutral-600">
                {isSearch ? t("emptySearch") : t("emptyViewAll")}
              </p>
            </div>
          ) : (
            <>
              <ul>
                {initialListItems.map((item, idx) => (
                  <NewsListItemCard
                    key={item.id}
                    item={item}
                    locale={locale}
                    pinnedLabel={t("pinned")}
                    isFirst={idx === 0}
                  />
                ))}
              </ul>
              <LatestNewsList
                locale={locale}
                q={q || undefined}
                initialOffset={heroConsumed + newsForLatest.length}
                initialHasMore={initialHasMore}
                pinnedLabel={t("pinned")}
                loadingLabel="Đang tải thêm…"
                endLabel="Đã hiển thị tất cả tin tức"
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
