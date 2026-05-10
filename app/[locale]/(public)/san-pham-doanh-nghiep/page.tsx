import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { AgarwoodPlaceholder } from "@/components/ui/AgarwoodPlaceholder"
import { BRAND_BLUR_DATA_URL } from "@/lib/imageBlur"

export const revalidate = 600

export const metadata: Metadata = {
  title: "Chợ Sản phẩm Trầm Hương | Hội Trầm Hương Việt Nam",
  description:
    "Chợ sản phẩm trầm hương — nơi hội viên và doanh nghiệp đăng sản phẩm, quảng bá thương hiệu. Sản phẩm chứng nhận được ưu tiên hiển thị.",
  alternates: { canonical: "/san-pham-doanh-nghiep" },
  openGraph: {
    title: "Chợ Sản phẩm Trầm Hương | Hội Trầm Hương Việt Nam",
    description:
      "Mua bán, quảng bá sản phẩm trầm hương từ hội viên và doanh nghiệp — ưu tiên sản phẩm đã được Hội chứng nhận.",
    type: "website",
  },
}

const PAGE_SIZE = 24

const CATEGORIES = [
  { label: "Trầm tự nhiên",   icon: "🌿", value: "Trầm tự nhiên" },
  { label: "Trầm nuôi cấy",   icon: "🌱", value: "Trầm nuôi cấy" },
  { label: "Tinh dầu",         icon: "💧", value: "Tinh dầu" },
  { label: "Nhang trầm",       icon: "🪔", value: "Nhang trầm" },
  { label: "Vòng trầm",        icon: "📿", value: "Vòng trầm" },
  { label: "Phong thủy",       icon: "🏮", value: "Phong thủy" },
  { label: "Mỹ nghệ",          icon: "🎨", value: "Mỹ nghệ" },
  { label: "Thực phẩm",        icon: "🍵", value: "Thực phẩm" },
]

type SourceFilter = "all" | "certified" | "business" | "individual"

function buildUrl(p: number, filter: SourceFilter, category?: string) {
  const params = new URLSearchParams()
  if (p > 1) params.set("page", String(p))
  if (filter && filter !== "all") params.set("filter", filter)
  if (category) params.set("category", category)
  const qs = params.toString()
  return `/san-pham-doanh-nghiep${qs ? `?${qs}` : ""}`
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string; category?: string }>
}) {
  const [locale, t] = await Promise.all([getLocale() as Promise<Locale>, getTranslations("marketplace")])
  const l = <T extends Record<string, unknown>>(record: T, field: string) => localize(record, field, locale) as string
  const [params, session] = await Promise.all([searchParams, auth()])
  const page = Math.max(1, Number(params.page ?? 1))
  const filter = (params.filter ?? "all") as SourceFilter
  const categoryFilter = params.category ?? ""

  // Base where — all published products from active users
  const baseWhere = {
    isPublished: true,
    owner: { isActive: true },
    ...(categoryFilter && { category: categoryFilter }),
  }

  // Additional filter by source type
  const sourceWhere = (() => {
    switch (filter) {
      case "certified":
        return { ...baseWhere, certStatus: "APPROVED" as const }
      case "business":
        return { ...baseWhere, companyId: { not: null } as any }
      case "individual":
        return { ...baseWhere, companyId: null }
      default:
        return baseWhere
    }
  })()

  // totalFiltered trùng với total khi filter=all → skip query thừa; ngược lại
  // parallel trong cùng Promise.all thay vì sequential sau đó.
  const isAllFilter = filter === "all"
  const [total, certifiedCount, businessCount, products, totalFilteredRaw] = await Promise.all([
    prisma.product.count({ where: baseWhere }),
    prisma.product.count({ where: { ...baseWhere, certStatus: "APPROVED" } }),
    prisma.product.count({ where: { ...baseWhere, companyId: { not: null } } }),
    prisma.product.findMany({
      where: sourceWhere,
      orderBy: [
        { isFeatured: "desc" },
        { ownerPriority: "desc" },
        { featuredOrder: "asc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true, name_en: true, name_zh: true, name_ar: true,
        slug: true,
        imageUrls: true,
        category: true, category_en: true, category_zh: true, category_ar: true,
        priceRange: true,
        certStatus: true,
        isFeatured: true,
        featuredOrder: true,
        companyId: true,
        createdAt: true,
        owner: {
          select: { name: true, avatarUrl: true },
        },
        company: {
          select: {
            name: true, name_en: true, name_zh: true, name_ar: true,
            slug: true,
            logoUrl: true,
            isVerified: true,
          },
        },
        _count: { select: { comments: { where: { deletedAt: null } } } },
      },
    }),
    isAllFilter
      ? Promise.resolve(null) // re-use `total` below — tránh chạy 2 COUNT trùng
      : prisma.product.count({ where: sourceWhere }),
  ])

  // Sort certified products to the top within page results
  const sortedProducts = [...products].sort((a, b) => {
    const aCert = a.certStatus === "APPROVED" ? 0 : 1
    const bCert = b.certStatus === "APPROVED" ? 0 : 1
    if (aCert !== bCert) return aCert - bCert
    const aFeat = a.isFeatured ? 0 : 1
    const bFeat = b.isFeatured ? 0 : 1
    if (aFeat !== bFeat) return aFeat - bFeat
    if (a.featuredOrder !== null && b.featuredOrder !== null) {
      return a.featuredOrder - b.featuredOrder
    }
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  const totalFiltered = totalFilteredRaw ?? total
  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE)
  const individualCount = total - businessCount
  const isLoggedIn = !!session?.user

  return (
    <div className="min-h-screen bg-brand-50/60">
      {/* ── Page Banner ─────────────────────────────────────────────── */}
      <div className="bg-brand-800 py-14 px-4 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl text-brand-100">
          {t("pageTitle")}
        </h1>
        <p className="mt-2 text-brand-300 text-base max-w-2xl mx-auto">
          {t("subtitleBefore")}{" "}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white align-middle">
            {t("certifiedBadge")}
          </span>{" "}
          {t("subtitleAfter")}
        </p>
        {isLoggedIn && (
          <Link
            href={`/${locale}/feed/tao-bai?category=PRODUCT`}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-400 text-brand-900 font-semibold px-6 py-2.5 hover:bg-brand-300 transition-colors text-sm"
          >
            {t("registerProduct")}
          </Link>
        )}
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────────── */}
      <div className="border-b border-brand-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-2 flex-wrap">
          <Link
            href={buildUrl(1, "all", categoryFilter)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
              filter === "all"
                ? "bg-brand-800 text-white border-brand-800"
                : "bg-white text-brand-700 border-brand-200 hover:bg-brand-50",
            )}
          >
            {t("filterAll")} ({total})
          </Link>
          <Link
            href={buildUrl(1, "certified", categoryFilter)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
              filter === "certified"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50",
            )}
          >
            {t("certifiedBadge")} ({certifiedCount})
          </Link>
          <Link
            href={buildUrl(1, "business", categoryFilter)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
              filter === "business"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50",
            )}
          >
            {t("filterBusiness")} ({businessCount})
          </Link>
          <Link
            href={buildUrl(1, "individual", categoryFilter)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
              filter === "individual"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50",
            )}
          >
            {t("filterIndividual")} ({individualCount})
          </Link>
        </div>
      </div>

      {/* ── Content card — bọc categories + grid + pagination ─────── */}
      <div className="mx-auto max-w-7xl px-4 pt-8">
      <div className="bg-white rounded-2xl border border-brand-200 shadow-sm p-4 sm:p-6 lg:p-8">

      {/* ── Categories grid ──────────────────────────────────────────── */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.value}
              href={buildUrl(1, filter, categoryFilter === cat.value ? "" : cat.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:shadow-md",
                categoryFilter === cat.value
                  ? "bg-brand-800 text-white border-brand-800 shadow-md"
                  : "bg-white text-brand-700 border-brand-200 hover:border-brand-400",
              )}
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-xs font-medium leading-tight">{cat.label}</span>
            </Link>
          ))}
        </div>
        {categoryFilter && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-brand-600">
              {t("filteringBy")}: <strong>{categoryFilter}</strong>
            </span>
            <Link
              href={buildUrl(1, filter)}
              className="text-xs text-brand-400 hover:text-red-500 transition-colors"
            >
              {t("clearFilter")}
            </Link>
          </div>
        )}
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      <div className="pt-8">
        {sortedProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-brand-200 p-16 text-center">
            <AgarwoodPlaceholder className="w-20 h-20 mx-auto mb-4" size="lg" shape="full" tone="light" />
            <p className="text-brand-700 text-lg font-medium">
              {filter === "certified" ? t("emptyCertified") : t("emptyDefault")}
            </p>
            <p className="text-brand-500 text-sm mt-2">{t("emptySubtitle")}</p>
            {isLoggedIn && (
              <Link
                href={`/${locale}/feed/tao-bai?category=PRODUCT`}
                className="mt-4 inline-flex items-center rounded-lg bg-brand-700 text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-800 transition-colors"
              >
                {t("registerProduct")}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedProducts.map((product) => {
              const cover = product.imageUrls[0] ?? null
              const isCertified = product.certStatus === "APPROVED"
              const isBusinessProduct = !!product.companyId && !!product.company
              return (
                <Link
                  key={product.id}
                  href={`/san-pham/${product.slug}`}
                  className={cn(
                    "group relative bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col",
                    isCertified
                      ? "border-emerald-300 hover:border-emerald-500 ring-1 ring-emerald-100"
                      : "border-brand-200 hover:border-brand-400",
                  )}
                >
                  {/* Image */}
                  <div className="relative h-52 bg-brand-100 overflow-hidden">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={l(product, "name")}
                        fill
                        placeholder="blur"
                        blurDataURL={BRAND_BLUR_DATA_URL}
                        className={cn(
                          "object-cover transition-transform duration-300 group-hover:scale-105",
                          !isCertified && "opacity-90",
                        )}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <AgarwoodPlaceholder className="w-full h-full" size="lg" shape="square" />
                    )}

                    {/* Certified badge */}
                    {isCertified && (
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-lg ring-2 ring-white">
                        {t("certifiedBadge")}
                      </span>
                    )}

                    {/* Featured badge */}
                    {product.isFeatured && !isCertified && (
                      <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow">
                        {t("featuredBadge")}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1 gap-1.5">
                    <h2
                      className={cn(
                        "font-semibold leading-snug transition-colors line-clamp-2",
                        isCertified
                          ? "text-brand-900 group-hover:text-emerald-700"
                          : "text-brand-800 group-hover:text-brand-700",
                      )}
                    >
                      {l(product, "name")}
                    </h2>

                    {/* Seller info */}
                    <div className="flex items-center gap-1.5">
                      {isBusinessProduct ? (
                        <>
                          <div className="relative w-5 h-5 rounded-full overflow-hidden bg-brand-700 shrink-0 flex items-center justify-center">
                            {product.company!.logoUrl ? (
                              <Image
                                src={product.company!.logoUrl}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="20px"
                              />
                            ) : (
                              <span className="text-[9px] font-bold text-brand-100">
                                {product.company!.name[0]}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-brand-500 line-clamp-1">
                            {product.company!.name}
                            {product.company!.isVerified && (
                              <span className="text-green-600 ml-0.5">✓</span>
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="relative w-5 h-5 rounded-full overflow-hidden bg-brand-200 shrink-0 flex items-center justify-center">
                            {product.owner.avatarUrl ? (
                              <Image
                                src={product.owner.avatarUrl}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="20px"
                              />
                            ) : (
                              <span className="text-[9px] font-bold text-brand-600">
                                {product.owner.name[0]}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-brand-400 line-clamp-1">
                            {product.owner.name}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="mt-auto pt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {l(product, "category") && (
                          <span className="text-brand-500">{l(product, "category")}</span>
                        )}
                        {product._count.comments > 0 && (
                          <span className="text-brand-400">{product._count.comments} bình luận</span>
                        )}
                      </div>
                      {product.priceRange && (
                        <span
                          className={cn(
                            "font-semibold",
                            isCertified ? "text-emerald-700" : "text-brand-700",
                          )}
                        >
                          {product.priceRange}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={buildUrl(page - 1, filter, categoryFilter)}
                className="px-4 py-2 rounded-lg border border-brand-300 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                Trước
              </Link>
            )}
            <span className="px-4 py-2 text-sm text-brand-600">
              Trang {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildUrl(page + 1, filter, categoryFilter)}
                className="px-4 py-2 rounded-lg border border-brand-300 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                Tiếp
              </Link>
            )}
          </div>
        )}
      </div>
      </div>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <div className="bg-brand-800 py-12 text-center text-white">
        {isLoggedIn ? (
          <>
            <p className="text-brand-200 mb-4 text-sm">{t("ctaLoggedIn")}</p>
            <Link
              href={`/${locale}/feed/tao-bai?category=PRODUCT`}
              className="inline-flex items-center justify-center rounded-lg bg-brand-400 text-brand-900 font-semibold px-6 py-3 hover:bg-brand-300 transition-colors"
            >
              {t("registerProductNow")}
            </Link>
          </>
        ) : (
          <>
            <p className="text-brand-200 mb-4 text-sm">{t("ctaGuest")}</p>
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center justify-center rounded-lg bg-brand-400 text-brand-900 font-semibold px-6 py-3 hover:bg-brand-300 transition-colors"
            >
              {t("ctaLogin")}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
