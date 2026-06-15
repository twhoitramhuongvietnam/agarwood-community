import { cache, Suspense } from "react"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/utils"
import { BASE_URL, SITE_NAME, hreflangAlternates, localizedUrl } from "@/lib/seo/site"
import { addAnchorIdsToH2 } from "@/lib/seo/toc"
import { rewriteCloudinaryInHtml } from "@/lib/cloudinary"
import { CloudinaryImage } from "@/components/ui/CloudinaryImage"
import { Section } from "@/components/features/homepage/Section"
import { HomepageBannerSlot } from "@/components/features/homepage/HomepageBannerSlot"
import { SidebarList } from "@/components/features/article/SidebarList"
import { CopyLinkButton } from "./CopyLinkButton"
import { ArticleToolbar } from "./ArticleToolbar"
import { TIN_TUC_PUBLIC_CATEGORIES } from "../categories"
import { auth } from "@/lib/auth"
import { CommentsSection } from "@/components/features/comments/CommentsSection"
import { extractYoutubeId } from "@/lib/multimedia-from-news"

export const revalidate = 1800

type Props = { params: Promise<{ locale: Locale; slug: string }> }

/** Tất cả field cần cho metadata + main render — dedupe qua React.cache.
 *  Explicit select thay vì findFirst không select (over-fetch). */
const getNewsBySlug = cache(async (slug: string) =>
  prisma.news.findFirst({
    where: {
      slug,
      isPublished: true,
      OR: [
        { category: { in: [...TIN_TUC_PUBLIC_CATEGORIES] } },
        { secondaryCategories: { hasSome: [...TIN_TUC_PUBLIC_CATEGORIES] } },
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
      // Phase 3.3: template + gallery cho tin ảnh / tin video.
      template: true,
      gallery: true,
    },
  }),
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const news = await getNewsBySlug(slug)
  if (!news) return { title: "Tin tức không tồn tại" }
  // Prefer SEO override; fall back to article title/excerpt when null.
  const title =
    (localize(news, "seoTitle", locale) as string | null) ||
    (localize(news, "title", locale) as string)
  const excerpt =
    ((localize(news, "seoDescription", locale) as string | null) ||
      (localize(news, "excerpt", locale) as string | null)) ?? undefined
  const path = `/tin-tuc/${slug}`
  return {
    title: `${title} | ${SITE_NAME}`,
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
      section: "Tin tức",
      tags:
        news.secondaryKeywords && news.secondaryKeywords.length > 0
          ? news.secondaryKeywords
          : undefined,
      siteName: SITE_NAME,
      locale: locale === "vi" ? "vi_VN" : locale === "en" ? "en_US" : locale === "zh" ? "zh_CN" : "ar_AR",
    },
  }
}

export default async function NewsDetailPage({ params }: Props) {
  const [locale, t] = await Promise.all([
    getLocale() as Promise<Locale>,
    getTranslations("news"),
  ])
  const l = <T extends Record<string, unknown>>(record: T, field: string) => localize(record, field, locale) as string
  const tc = await getTranslations("common")
  const { slug } = await params
  const session = await auth()

  const news = await getNewsBySlug(slug)

  // If not found, try slugifying the input
  if (!news) {
    const normalizedSlug = slugify(slug)
    if (normalizedSlug !== slug) {
      const redirectedNews = await prisma.news.findFirst({
        where: {
          slug: normalizedSlug,
          isPublished: true,
          OR: [
            { category: { in: [...TIN_TUC_PUBLIC_CATEGORIES] } },
            { secondaryCategories: { hasSome: [...TIN_TUC_PUBLIC_CATEGORIES] } },
          ],
        },
      })
      if (redirectedNews) {
        redirect(`/tin-tuc/${normalizedSlug}`)
      }
    }
  }

  // Still no hit: the slug may belong to a News row of a different
  // category — send the user to the correct public URL instead of 404.
  // Handles old bookmarks / cached sitemap entries like
  // /tin-tuc/chinh-sach-bao-mat (LEGAL → /privacy) or a research slug.
  if (!news) {
    const other = await prisma.news.findFirst({
      where: { slug, isPublished: true },
      select: { category: true, slug: true },
    })
    if (other) {
      if (other.category === "LEGAL") {
        if (other.slug === "chinh-sach-bao-mat") redirect("/privacy")
        if (other.slug === "dieu-khoan-su-dung") redirect("/terms")
        // LEGAL khác → hub văn bản pháp quy
        redirect("/phap-ly")
      }
      if (other.category === "RESEARCH") {
        redirect(`/nghien-cuu/${other.slug}`)
      }
    }
  }

  if (!news) notFound()

  // Related + author + sidebar data đều phụ thuộc `news` → parallel.
  // Sidebar: pinned news (editor's pick) + latest news — dùng cho rail phải.
  const SIDEBAR_LIST_SELECT = {
    id: true,
    title: true, title_en: true, title_zh: true, title_ar: true,
    slug: true,
    coverImageUrl: true,
    publishedAt: true,
    template: true, gallery: true, // Phase 3.7 round 4 — sidebar fallback thumb
  } as const
  const [relatedPool, author, sidebarPinned] = await Promise.all([
    prisma.news.findMany({
      where: {
        isPublished: true,
        slug: { not: slug },
        AND: [
          {
            OR: [
              { category: { in: [...TIN_TUC_PUBLIC_CATEGORIES] } },
              { secondaryCategories: { hasSome: [...TIN_TUC_PUBLIC_CATEGORIES] } },
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
          { category: { in: [...TIN_TUC_PUBLIC_CATEGORIES] } },
          { secondaryCategories: { hasSome: [...TIN_TUC_PUBLIC_CATEGORIES] } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: SIDEBAR_LIST_SELECT,
    }),
  ])

  // Fallback: if keyword search returned fewer than 3, top up by recency.
  let related = relatedPool
  if (related.length < 3) {
    const fill = await prisma.news.findMany({
      where: {
        isPublished: true,
        slug: { not: slug },
        id: { notIn: related.map((r) => r.id) },
        OR: [
          { category: { in: [...TIN_TUC_PUBLIC_CATEGORIES] } },
          { secondaryCategories: { hasSome: [...TIN_TUC_PUBLIC_CATEGORIES] } },
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
  // Display name falls back to the crawl-import `originalAuthor` string
  // (used when we ingested articles from the old website without matching
  // to a real User row).
  const authorDisplayName = news.originalAuthor || author?.name || SITE_NAME
  const authorBio = author ? (l(author, "bio") as string | null) : null
  const authorUrl = author ? localizedUrl(`/thanh-vien/${author.id}`, locale) : BASE_URL

  // Inject anchor IDs into H2 tags + extract TOC.
  // Also rewrite any Cloudinary URLs in the body to include width limit +
  // f_auto + q_auto — saves bandwidth for readers on mobile since the
  // content HTML can't use Next.js Image.
  // Content đã sanitize lúc lưu (api/admin/news + news-auto-translate). Không
  // sanitize lại lúc render để tránh load jsdom (rất nặng CPU) mỗi cold start.
  const sanitizedContent = l(news, "content") ?? ""
  const optimizedContent = rewriteCloudinaryInHtml(sanitizedContent, 1024)
  const contentWithAnchors = addAnchorIdsToH2(optimizedContent)

  const articleUrl = localizedUrl(`/tin-tuc/${slug}`, locale)
  // SEO override → article title/excerpt fallback (mirrors generateMetadata).
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
      { "@type": "ListItem", position: 2, name: t("breadcrumbNews"), item: localizedUrl("/tin-tuc", locale) },
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

  // tags === keywords — derivation giống hệt, reuse để tránh dedup 2 lần.
  const tags = keywords
  const siteAbbr = "VAWA" // Vietnam Agarwood Association — prefix sapo kiểu VTV.vn
  const publishedTimeLabel = news.publishedAt
    ? new Date(news.publishedAt).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* 2-column layout — main article + right rail sidebar (sticky ≥ lg).
          Grid 12-col: 9 cho body, 3 cho sidebar. Sidebar dính ~60px từ top
          để không chồng lên CategoryBar sticky.
          Lưu ý: breadcrumb visual đã bỏ theo yêu cầu, nhưng vẫn còn
          BreadcrumbList JSON-LD ở trên để Google crawl hierarchy. */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-10">
        <article className="relative min-w-0 lg:col-span-9">
          {/* Floating left toolbar — chỉ hiện từ breakpoint xl trở lên. */}
          <ArticleToolbar articleUrl={articleUrl} />

          {/* Headline — Merriweather serif, VTV-style 28px weight 700 */}
          <h1 className="font-serif-headline mb-4 text-[24px] font-bold leading-tight text-neutral-900 sm:text-[28px] lg:text-[30px]">
            {l(news, "title")}
          </h1>

          {/* Sapo — bold paragraph với prefix site abbreviation. Không italic,
              không accent bar — theo đúng convention báo mạng VN.
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

          {/* Cover image — full width of article column, figcaption nhỏ bên dưới */}
          {news.coverImageUrl && (
            <figure className="mb-6">
              <div className="relative aspect-video w-full bg-neutral-100">
                <CloudinaryImage
                  src={news.coverImageUrl}
                  alt={coverAlt}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 860px"
                  maxWidth={1280}
                />
              </div>
              {hasDistinctCaption && (
                <figcaption className="mt-2 text-center text-[13px] italic leading-relaxed text-neutral-600">
                  {coverAlt}
                </figcaption>
              )}
            </figure>
          )}

          {/* TOC removed (2026-04 customer feedback) — anchor IDs vẫn được
              inject vào H2 để link share #section vẫn hoạt động, nhưng không
              render block "Mục lục" nữa. */}

          {/* Article body — editorial prose cho template=NORMAL.
              Tin ảnh / Tin video (template=PHOTO/VIDEO) render gallery riêng
              ở dưới — không có RichTextEditor content. */}
          {news.template === "NORMAL" && (
            <div
              data-article-body
              className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-neutral-900 prose-p:text-neutral-800 prose-p:leading-[1.8] prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-neutral-900 prose-img:mx-auto prose-figcaption:text-center prose-figcaption:italic prose-figcaption:text-[13px] prose-figcaption:text-neutral-600"
              dangerouslySetInnerHTML={{ __html: contentWithAnchors }}
            />
          )}

          {/* Tin ảnh — gallery 1 cột, mỗi ảnh full width + caption ở dưới.
              Phase 3.3 (2026-04). */}
          {news.template === "PHOTO" && Array.isArray(news.gallery) && (
            <div data-article-body className="space-y-6">
              {(news.gallery as Array<{ url: string; caption?: string }>).map(
                (item, i) =>
                  item.url ? (
                    <figure key={`${item.url}-${i}`} className="space-y-2">
                      <CloudinaryImage
                        src={item.url}
                        alt={item.caption ?? ""}
                        loading={i === 0 ? "eager" : "lazy"}
                        className="w-full h-auto rounded-lg"
                        maxWidth={1280}
                      />
                      {item.caption && (
                        <figcaption className="text-center text-[13px] italic text-neutral-600 leading-snug">
                          {item.caption}
                        </figcaption>
                      )}
                    </figure>
                  ) : null,
              )}
            </div>
          )}

          {/* Tin video — gallery 1 cột, mỗi video iframe responsive 16:9 +
              caption. Phase 3.3 (2026-04). */}
          {news.template === "VIDEO" && Array.isArray(news.gallery) && (
            <div data-article-body className="space-y-8">
              {(news.gallery as Array<{ url: string; caption?: string }>).map(
                (item, i) => {
                  if (!item.url) return null
                  // YouTube watch URL bị X-Frame-Options chặn nếu nhúng vào iframe.
                  // Migration script (drop_multimedia) lưu watch URL → cần
                  // convert sang embed URL trước khi render. Phase 3.7 round 4
                  // (2026-04). URL không phải YouTube giữ nguyên.
                  const ytId = extractYoutubeId(item.url)
                  const src = ytId
                    ? `https://www.youtube.com/embed/${ytId}`
                    : item.url
                  return (
                    <figure key={`${item.url}-${i}`} className="space-y-2">
                      <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
                        <iframe
                          src={src}
                          className="absolute inset-0 h-full w-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          loading={i === 0 ? "eager" : "lazy"}
                          title={item.caption || `Video ${i + 1}`}
                        />
                      </div>
                      {item.caption && (
                        <figcaption className="text-center text-[13px] italic text-neutral-600 leading-snug">
                          {item.caption}
                        </figcaption>
                      )}
                    </figure>
                  )
                },
              )}
            </div>
          )}

          {/* Tags — nếu article có focusKeyword / secondaryKeywords.
              TODO: chuyển "Từ khoá" sang key i18n khi translations bổ sung. */}
          {tags.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Từ khoá:
              </span>
              {tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tin-tuc?q=${encodeURIComponent(tag)}`}
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
              {t("shareArticle")}
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
                <CloudinaryImage
                  src={author.avatarUrl}
                  alt={author.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                  maxWidth={200}
                  fallbackSize="sm"
                  fallbackTone="brand"
                />
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

          {/* Comments — Phase 3.4 (2026-04), Phase 3.7 round 4 (2026-04):
              chuyển INTO article column thay vì ngoài grid để tránh gap khi
              article ngắn (vd template=VIDEO chỉ có iframe) + sidebar dài. */}
          <div className="mt-10">
            <CommentsSection
              newsId={news.id}
              currentUserId={session?.user?.id ?? null}
              currentUserRole={session?.user?.role}
              currentUserName={session?.user?.name}
              currentUserAvatar={session?.user?.image}
            />
          </div>
        </article>

        {/* Right rail — sticky trên desktop, ẩn mobile dồn xuống cuối article. */}
        <aside className="mt-10 min-w-0 space-y-8 lg:col-span-3 lg:mt-0 lg:sticky lg:top-16 lg:self-start">
          {/* Tin nổi bật — pinned articles (editor's pick).
              TODO: chuyển label sang i18n khi translations bổ sung. */}
          <SidebarList
            title="Tin nổi bật"
            items={sidebarPinned}
            locale={locale}
            itemHrefPrefix="/tin-tuc"
          />

          {/* Banner SIDEBAR — poster dọc 2:3, ẩn nếu không có banner active */}
          <Suspense fallback={null}>
            <HomepageBannerSlot slot="NEWS_DETAIL_SIDEBAR" />
          </Suspense>
        </aside>
      </div>

      {/* Related — full-width grid ở cuối, dùng Section header chuẩn */}
      {related.length > 0 && (
        <div className="mt-14">
          <Section title={t("relatedNews")} titleHref="/tin-tuc">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/tin-tuc/${item.slug}`}
                  className="group block"
                >
                    <div className="relative aspect-16/10 w-full overflow-hidden bg-neutral-100">
                      <CloudinaryImage
                        src={item.coverImageUrl}
                        alt={l(item, "title")}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        maxWidth={480}
                      />
                    </div>
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

