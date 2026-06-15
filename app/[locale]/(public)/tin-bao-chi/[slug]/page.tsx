import { cache, Suspense } from "react"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/utils"
import { AgarwoodPlaceholder } from "@/components/ui/AgarwoodPlaceholder"
import { BASE_URL, SITE_NAME, hreflangAlternates, localizedUrl } from "@/lib/seo/site"
import { addAnchorIdsToH2 } from "@/lib/seo/toc"
import { cloudinaryResize, rewriteCloudinaryInHtml } from "@/lib/cloudinary"
import { BLUR_DATA_URL } from "@/lib/seo/blur-placeholder"
import { Section } from "@/components/features/homepage/Section"
import { HomepageBannerSlot } from "@/components/features/homepage/HomepageBannerSlot"
import { SidebarList } from "@/components/features/article/SidebarList"
import { CopyLinkButton } from "../../tin-tuc/[slug]/CopyLinkButton"
import { ArticleToolbar } from "../../tin-tuc/[slug]/ArticleToolbar"
import { auth } from "@/lib/auth"
import { CommentsSection } from "@/components/features/comments/CommentsSection"

export const revalidate = 1800

type Props = { params: Promise<{ locale: Locale; slug: string }> }

/** React.cache dedupe giữa generateMetadata và main page — 1 query/request. */
const getExternalNewsBySlug = cache(async (slug: string) =>
  prisma.news.findFirst({
    where: {
      slug,
      isPublished: true,
      OR: [
        { category: "EXTERNAL_NEWS" },
        { secondaryCategories: { has: "EXTERNAL_NEWS" } },
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true, title_en: true, title_zh: true, title_ar: true,
      excerpt: true, excerpt_en: true, excerpt_zh: true, excerpt_ar: true,
      content: true, content_en: true, content_zh: true, content_ar: true,
      seoTitle: true, seoTitle_en: true, seoTitle_zh: true, seoTitle_ar: true,
      seoDescription: true, seoDescription_en: true, seoDescription_zh: true, seoDescription_ar: true,
      coverImageAlt: true, coverImageAlt_en: true, coverImageAlt_zh: true, coverImageAlt_ar: true,
      coverImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      authorId: true,
      originalAuthor: true,
      focusKeyword: true,
      secondaryKeywords: true,
      // Phase 3.5 (2026-04): EXTERNAL_NEWS attribution.
      sourceName: true,
      sourceUrl: true,
    },
  }),
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const news = await getExternalNewsBySlug(slug)
  if (!news) return { title: "Tin báo chí không tồn tại" }
  const title =
    (localize(news, "seoTitle", locale) as string | null) ||
    (localize(news, "title", locale) as string)
  const excerpt =
    ((localize(news, "seoDescription", locale) as string | null) ||
      (localize(news, "excerpt", locale) as string | null)) ?? undefined
  const path = `/tin-bao-chi/${slug}`
  return {
    title: `${title} | Nghiên cứu khoa học | ${SITE_NAME}`,
    description: excerpt,
    alternates: hreflangAlternates(path),
    openGraph: {
      title,
      description: excerpt,
      url: localizedUrl(path, locale),
      images: news.coverImageUrl ? [{ url: news.coverImageUrl }] : [],
      type: "article",
      publishedTime: news.publishedAt?.toISOString(),
      modifiedTime: news.updatedAt?.toISOString(),
      authors: news.originalAuthor ? [news.originalAuthor] : undefined,
      section: "Tin báo chí",
      tags:
        news.secondaryKeywords && news.secondaryKeywords.length > 0
          ? news.secondaryKeywords
          : undefined,
      siteName: SITE_NAME,
      locale: locale === "vi" ? "vi_VN" : locale === "en" ? "en_US" : locale === "zh" ? "zh_CN" : "ar_AR",
    },
  }
}

export default async function ExternalNewsDetailPage({ params }: Props) {
  const [locale, t, tc] = await Promise.all([
    getLocale() as Promise<Locale>,
    getTranslations("news"),
    getTranslations("common"),
  ])
  const l = <T extends Record<string, unknown>>(record: T, field: string) => localize(record, field, locale) as string
  const { slug } = await params
  const session = await auth()

  const news = await getExternalNewsBySlug(slug)

  // If not found, try slugifying the input (e.g. user typed with diacritics)
  if (!news) {
    const normalizedSlug = slugify(slug)
    if (normalizedSlug !== slug) {
      const redirectedNews = await prisma.news.findFirst({
        where: {
          slug: normalizedSlug,
          isPublished: true,
          OR: [
            { category: "EXTERNAL_NEWS" },
            { secondaryCategories: { has: "EXTERNAL_NEWS" } },
          ],
        },
      })
      if (redirectedNews) {
        redirect(`/tin-bao-chi/${normalizedSlug}`)
      }
    }
  }

  if (!news) notFound()

  // Related + author + sidebar data đều phụ thuộc news → parallel.
  // Sidebar: pinned research (editor's pick) + latest research.
  const SIDEBAR_LIST_SELECT = {
    id: true,
    title: true, title_en: true, title_zh: true, title_ar: true,
    slug: true,
    coverImageUrl: true,
    publishedAt: true,
    template: true, gallery: true, // Phase 3.7 round 4 — sidebar fallback thumb
  } as const
  const [relatedPool, author, sidebarPinned, sidebarLatest] = await Promise.all([
    prisma.news.findMany({
      where: {
        isPublished: true,
        slug: { not: slug },
        AND: [
          {
            OR: [
              { category: "EXTERNAL_NEWS" },
              { secondaryCategories: { has: "EXTERNAL_NEWS" } },
            ],
          },
          ...(news.focusKeyword
            ? [
                {
                  OR: [
                    { focusKeyword: news.focusKeyword },
                    { secondaryKeywords: { has: news.focusKeyword } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true, title_en: true, title_zh: true, title_ar: true,
        slug: true,
        excerpt: true, excerpt_en: true, excerpt_zh: true, excerpt_ar: true,
        coverImageUrl: true,
        publishedAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: news.authorId },
      select: {
        id: true, name: true, avatarUrl: true, role: true,
        bio: true, bio_en: true, bio_zh: true, bio_ar: true,
      },
    }),
    prisma.news.findMany({
      where: {
        isPublished: true,
        isPinned: true,
        slug: { not: slug },
        OR: [
          { category: "EXTERNAL_NEWS" },
          { secondaryCategories: { has: "EXTERNAL_NEWS" } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: SIDEBAR_LIST_SELECT,
    }),
    prisma.news.findMany({
      where: {
        isPublished: true,
        slug: { not: slug },
        OR: [
          { category: "EXTERNAL_NEWS" },
          { secondaryCategories: { has: "EXTERNAL_NEWS" } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 6,
      select: SIDEBAR_LIST_SELECT,
    }),
  ])

  // Dedupe sidebar: latest không trùng pinned.
  const pinnedIdSet = new Set(sidebarPinned.map((n) => n.id))
  const sidebarRecent = sidebarLatest.filter((n) => !pinnedIdSet.has(n.id)).slice(0, 5)

  let related = relatedPool
  if (related.length < 3) {
    const fill = await prisma.news.findMany({
      where: {
        isPublished: true,
        slug: { not: slug },
        id: { notIn: related.map((r) => r.id) },
        OR: [
          { category: "EXTERNAL_NEWS" },
          { secondaryCategories: { has: "EXTERNAL_NEWS" } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 3 - related.length,
      select: {
        id: true,
        title: true, title_en: true, title_zh: true, title_ar: true,
        slug: true,
        excerpt: true, excerpt_en: true, excerpt_zh: true, excerpt_ar: true,
        coverImageUrl: true,
        publishedAt: true,
      },
    })
    related = [...related, ...fill]
  }
  const authorDisplayName = news.originalAuthor || author?.name || SITE_NAME
  const authorBio = author ? (l(author, "bio") as string | null) : null
  const authorUrl = author ? localizedUrl(`/thanh-vien/${author.id}`, locale) : BASE_URL

  // Inject H2 anchor IDs + extract TOC; rewrite Cloudinary URLs trong body.
  // Content đã sanitize lúc lưu (api/admin/news + news-auto-translate). Không
  // sanitize lại lúc render để tránh load jsdom (rất nặng CPU) mỗi cold start.
  const sanitizedContent = l(news, "content") ?? ""
  const optimizedContent = rewriteCloudinaryInHtml(sanitizedContent, 1024)
  const contentWithAnchors = addAnchorIdsToH2(optimizedContent)

  const articleUrl = localizedUrl(`/tin-bao-chi/${slug}`, locale)
  const seoTitle = (l(news, "seoTitle") as string | null) || l(news, "title")
  const seoDesc = (l(news, "seoDescription") as string | null) || l(news, "excerpt")
  const coverAlt = (l(news, "coverImageAlt") as string | null) || l(news, "title")
  const localizedContent = (l(news, "content") as string | undefined) ?? ""
  // Dedup: admin có thể nhập focusKeyword trùng với 1 secondaryKeyword
  // → trùng key React + SEO tag lặp. Set giữ thứ tự xuất hiện đầu tiên.
  const keywords = Array.from(
    new Set(
      [news.focusKeyword, ...(news.secondaryKeywords ?? [])]
        .filter((k): k is string => Boolean(k && k.trim()))
        .map((k) => k.trim()),
    ),
  )

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    headline: seoTitle,
    description: seoDesc || localizedContent.replace(/<[^>]*>/g, "").slice(0, 160),
    image: news.coverImageUrl ?? undefined,
    keywords: keywords.length > 0 ? keywords : undefined,
    inLanguage: locale === "vi" ? "vi-VN" : locale === "zh" ? "zh-CN" : locale,
    datePublished: news.publishedAt?.toISOString(),
    dateModified: news.updatedAt?.toISOString(),
    author: {
      "@type": "Person",
      name: authorDisplayName,
      url: authorUrl,
      ...(author?.avatarUrl ? { image: author.avatarUrl } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
    },
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tc("home"), item: localizedUrl("/", locale) },
      { "@type": "ListItem", position: 2, name: "Tin báo chí", item: localizedUrl("/tin-bao-chi", locale) },
      { "@type": "ListItem", position: 3, name: seoTitle, item: articleUrl },
    ],
  }

  const wasUpdatedAfterPublish =
    news.updatedAt &&
    news.publishedAt &&
    news.updatedAt.getTime() - news.publishedAt.getTime() > 24 * 60 * 60 * 1000
  const updatedDate = wasUpdatedAfterPublish && news.updatedAt
    ? new Date(news.updatedAt).toLocaleDateString("vi-VN")
    : null
  const excerpt = l(news, "excerpt") as string | null
  const hasDistinctCaption = coverAlt && coverAlt !== l(news, "title")
  const publishedTimeLabel = news.publishedAt
    ? new Date(news.publishedAt).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null
  const tags = keywords
  const siteAbbr = "VAWA"

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* 2-column layout — main article + right rail sidebar (sticky ≥ lg).
          Không render breadcrumb visible ở đây, nhưng giữ BreadcrumbList
          JSON-LD ở trên cho Google crawler. */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-10">
        <article className="relative min-w-0 lg:col-span-9">
          {/* Floating left toolbar — chỉ hiện từ breakpoint xl trở lên. */}
          <ArticleToolbar articleUrl={articleUrl} />

          {/* Headline — Merriweather serif, VTV-style */}
          <h1 className="font-serif-headline mb-4 text-[24px] font-bold leading-tight text-neutral-900 sm:text-[28px] lg:text-[30px]">
            {l(news, "title")}
          </h1>

          {/* Sapo — bold paragraph với prefix site abbreviation.
              `data-article-lede` là hook cho ArticleToolbar zoom. */}
          {excerpt && (
            <p
              data-article-lede
              className="mb-5 text-[17px] font-bold leading-[1.55] text-neutral-800"
            >
              <span className="text-brand-700">{siteAbbr} - </span>
              {excerpt}
            </p>
          )}

          {/* Byline — inline, nhẹ */}
          <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-200 pb-3 text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">{authorDisplayName}</span>
            {publishedTimeLabel && news.publishedAt && (
              <>
                <span className="text-neutral-300" aria-hidden>•</span>
                <time dateTime={news.publishedAt.toISOString()} className="text-neutral-500">
                  {publishedTimeLabel}
                </time>
              </>
            )}
            {updatedDate && (
              <>
                <span className="text-neutral-300" aria-hidden>•</span>
                <span className="text-xs italic text-neutral-500">
                  {t("updatedAt")} {updatedDate}
                </span>
              </>
            )}
          </div>

          {/* Phase 3.5: source attribution — bài curate từ báo chí ngoài.
              Hiển thị NGAY trên ảnh bìa để reader thấy trước khi đọc. */}
          {news.sourceName && (
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50/60 px-4 py-2.5 text-[13px] text-blue-900">
              <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>
                Theo <strong className="font-semibold">{news.sourceName}</strong>
                {news.sourceUrl && (
                  <>
                    {" — "}
                    <a
                      href={news.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="underline hover:text-blue-700"
                    >
                      đọc bài gốc
                    </a>
                  </>
                )}
              </span>
            </div>
          )}

          {/* Cover image — flush full-width, figcaption nhỏ */}
          {news.coverImageUrl && (
            <figure className="mb-6">
              <div className="relative aspect-video w-full bg-neutral-100">
                <Image
                  src={cloudinaryResize(news.coverImageUrl, 1280)}
                  alt={coverAlt}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 860px"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                />
              </div>
              {hasDistinctCaption && (
                <figcaption className="mt-2 text-center text-[13px] italic leading-relaxed text-neutral-600">
                  {coverAlt}
                </figcaption>
              )}
            </figure>
          )}

          {/* TOC removed (2026-04 customer feedback) — anchor IDs vẫn inject
              vào H2 để link share #section vẫn hoạt động. */}

          {/* Article body — `data-article-body` là hook cho zoom toolbar. */}
          <div
            data-article-body
            className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-neutral-900 prose-p:text-neutral-800 prose-p:leading-[1.8] prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-neutral-900 prose-img:mx-auto prose-figcaption:text-center prose-figcaption:italic prose-figcaption:text-[13px] prose-figcaption:text-neutral-600"
            dangerouslySetInnerHTML={{ __html: contentWithAnchors }}
          />

          {/* Phase 3.5: CTA "Đọc bài gốc" cuối article — nhắc reader rằng
              đây là biên tập, để xem nguyên văn cần qua nguồn báo. */}
          {news.sourceUrl && (
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50/40 px-5 py-4">
              <p className="text-[13px] text-blue-900 leading-relaxed">
                Bài viết này được biên tập tổng hợp bởi ban biên tập Hội Trầm Hương.
                {news.sourceName && (
                  <>
                    {" "}Để đọc nội dung nguyên gốc, vui lòng truy cập{" "}
                    <strong>{news.sourceName}</strong>.
                  </>
                )}
              </p>
              <a
                href={news.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Đọc bài gốc
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Từ khoá:
              </span>
              {tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tin-bao-chi?q=${encodeURIComponent(tag)}`}
                  className="border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition-colors hover:border-brand-700 hover:text-brand-700"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {/* Share bar */}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-neutral-300 py-4">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Chia sẻ bài nghiên cứu
            </span>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition-colors hover:border-[#1877F2] hover:text-[#1877F2]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
              Facebook
            </a>
            <a
              href={`https://zalo.me/share?url=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Zalo"
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition-colors hover:border-[#0068ff] hover:text-[#0068ff]"
            >
              <span className="font-bold tracking-tight">Zalo</span>
            </a>
            <CopyLinkButton />
          </div>

          {/* Author bio */}
          {author && (authorBio || author.avatarUrl) && (
            <aside className="mt-8 flex items-start gap-4 border-t-[3px] border-brand-700 pt-5">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-neutral-200">
                {author.avatarUrl ? (
                  <Image
                    src={author.avatarUrl}
                    alt={author.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-lg font-bold text-neutral-600">
                    {author.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                  {t("aboutAuthor")}
                </p>
                <p className="mt-1 text-lg font-bold text-neutral-900">{author.name}</p>
                {authorBio && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                    {authorBio}
                  </p>
                )}
              </div>
            </aside>
          )}
        </article>

        {/* Right rail — sticky desktop, mobile dồn xuống cuối article */}
        <aside className="mt-10 min-w-0 space-y-8 lg:col-span-3 lg:mt-0 lg:sticky lg:top-16 lg:self-start">
          <Suspense fallback={null}>
            <HomepageBannerSlot slot="PRESS_DETAIL_SIDEBAR" />
          </Suspense>

          <SidebarList
            title="Tin báo chí nổi bật"
            items={sidebarPinned}
            locale={locale}
            itemHrefPrefix="/tin-bao-chi"
          />

          <SidebarList
            title="Mới đăng"
            items={sidebarRecent}
            locale={locale}
            itemHrefPrefix="/tin-bao-chi"
            compact
          />
        </aside>
      </div>

      {/* Comments — full-width dưới article + sidebar. Phase 3.4 (2026-04). */}
      <div className="mt-10 lg:max-w-[calc(75%-1.25rem)]">
        <CommentsSection
          newsId={news.id}
          currentUserId={session?.user?.id ?? null}
          currentUserRole={session?.user?.role}
          currentUserName={session?.user?.name}
          currentUserAvatar={session?.user?.image}
        />
      </div>

      {/* Related — full-width grid cuối trang */}
      {related.length > 0 && (
        <div className="mt-14">
          <Section title="Tin báo chí liên quan" titleHref="/tin-bao-chi">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/tin-bao-chi/${item.slug}`}
                  className="group block"
                >
                  {item.coverImageUrl ? (
                    <div className="relative aspect-16/10 w-full overflow-hidden bg-neutral-100">
                      <Image
                        src={cloudinaryResize(item.coverImageUrl, 480)}
                        alt={l(item, "title")}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                  ) : (
                    <AgarwoodPlaceholder className="aspect-16/10 w-full" size="md" shape="square" />
                  )}
                  <div className="mt-3">
                    <h3 className="line-clamp-3 text-base font-bold leading-snug text-neutral-900 group-hover:text-brand-700">
                      {l(item, "title")}
                    </h3>
                    {item.publishedAt && (
                      <time
                        dateTime={item.publishedAt.toISOString()}
                        className="mt-1 block text-xs uppercase tracking-wide text-neutral-500"
                      >
                        {new Date(item.publishedAt).toLocaleDateString("vi-VN")}
                      </time>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

