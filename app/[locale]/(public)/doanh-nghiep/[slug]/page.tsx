import { cache } from "react"
import { auth } from "@/lib/auth"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"
import { prisma } from "@/lib/prisma"
import { getMemberTier } from "@/lib/tier"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { CompanyTabs } from "./CompanyTabs"

export const revalidate = 3600

type Props = { params: Promise<{ slug: string }> }

/** React.cache dedupe giữa generateMetadata và main page — 1 query/request
 *  thay vì 2. Trả đủ field cho cả metadata lẫn render. */
const getCompanyBySlug = cache(async (slug: string) =>
  prisma.company.findUnique({
    where: { slug, isPublished: true },
    include: {
      owner: { select: { id: true, name: true, role: true, contributionTotal: true } },
      products: {
        where: { isPublished: true },
        orderBy: { certStatus: "desc" },
        select: {
          id: true, name: true, name_en: true, name_zh: true, name_ar: true, slug: true, imageUrls: true,
          category: true, priceRange: true, certStatus: true, badgeUrl: true,
          // postId cần cho menu Xoá trên card — DELETE /api/posts/[postId]
          // sẽ soft-delete Post + unpublish Product. null = SP legacy không có
          // linked Post, menu sẽ ẩn item Xoá cho row đó.
          postId: true,
          // certStatus đã chọn ở trên; thêm dấu hiệu có đơn đang xử lý để menu
          // ẩn item "Chứng nhận" khi đang PENDING/UNDER_REVIEW. certStatus
          // default DRAFT cho mọi SP mới → không reliable, phải check
          // Certification trực tiếp.
          certifications: {
            where: { status: { in: ["DRAFT", "PENDING", "UNDER_REVIEW"] } },
            select: { id: true },
            take: 1,
          },
        },
      },
      galleryImages: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: { id: true, imageUrl: true, caption: true },
      },
    },
  }),
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const company = await getCompanyBySlug(slug)
  if (!company) return { title: "Not found" }
  return {
    title: `${company.name} | Hội Trầm Hương Việt Nam`,
    description: company.description?.slice(0, 160) ?? undefined,
    openGraph: {
      title: company.name,
      images: company.coverImageUrl ? [{ url: company.coverImageUrl }] : company.logoUrl ? [{ url: company.logoUrl }] : [],
      type: "profile",
    },
    other: {
      "application/ld+json": JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: company.name,
        description: company.description?.slice(0, 300),
        foundingDate: company.foundedYear ? String(company.foundedYear) : undefined,
        address: company.address ?? undefined,
      }),
    },
  }
}

export default async function CompanyProfilePage({ params }: Props) {
  const tC = await getTranslations("companyDetail")
  const tCT = await getTranslations("companyTabs")

  const locale = await getLocale() as Locale
  const l = <T extends Record<string, unknown>>(record: T, field: string) => localize(record, field, locale) as string
  const { slug } = await params
  const session = await auth()
  const currentUserId = session?.user?.id
  const currentUserRole = session?.user?.role

  const company = await getCompanyBySlug(slug)
  if (!company) notFound()

  const isOwner = currentUserId === company.ownerId
  const isAdmin = currentUserRole === "ADMIN"
  const canEdit = isOwner || isAdmin

  // VIP tier + posts count + tin tức về DN — fetch song song.
  // Q4 (Phase 3.3 2026-04): single tab "Tin tức về DN" gộp cả BUSINESS +
  // PRODUCT (theo quyết định customer). Filter relatedCompanyId match
  // company.id, isPublished, template=NORMAL (PHOTO/VIDEO push /multimedia).
  const [tier, postCount, newsItems] = await Promise.all([
    getMemberTier(company.owner.contributionTotal, "BUSINESS"),
    prisma.post.count({
      where: { authorId: company.ownerId, status: "PUBLISHED" },
    }),
    prisma.news.findMany({
      where: {
        isPublished: true,
        template: "NORMAL",
        relatedCompanyId: company.id,
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: 20,
      select: {
        id: true,
        slug: true,
        title: true, title_en: true, title_zh: true, title_ar: true,
        excerpt: true, excerpt_en: true, excerpt_zh: true, excerpt_ar: true,
        coverImageUrl: true,
        publishedAt: true,
      },
    }),
  ])

  return (
    <div>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* White card wrapping all company content */}
      <div className="bg-white rounded-2xl border border-brand-200 shadow-sm overflow-hidden">
      {/* Cover image — no overflow-hidden so the logo can half-overlap into
          the content area below. The outer card still clips to its rounded-2xl. */}
      <div className="relative w-full h-48 sm:h-64 md:h-72">
        {company.coverImageUrl ? (
          <Image src={company.coverImageUrl} alt={l(company, "name")} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 1024px" priority />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-brand-800 via-brand-700 to-brand-900" />
        )}

        {/* Logo overlay — half-sits below the cover's bottom edge */}
        <div className="absolute -bottom-10 left-6 sm:left-10 z-10">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-4 border-white shadow-lg overflow-hidden bg-brand-700">
            {company.logoUrl ? (
              <Image src={company.logoUrl} alt={l(company, "name")} fill className="object-cover" sizes="96px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-brand-100">
                {company.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
            )}
          </div>
        </div>

        {/* Edit button — admin pass ?slug để load đúng DN này (admin không
            có DN riêng nên fallback ownerId không work). Owner cũng dùng
            được link có slug — chính DN của họ. Phase 3.7 (2026-04). */}
        {canEdit && (
          <div className="absolute top-4 right-4">
            <Link
              href={`/doanh-nghiep/chinh-sua?slug=${company.slug}`}
              className="bg-white/90 text-brand-800 px-3 py-1.5 rounded-lg text-sm font-medium shadow hover:bg-white transition-colors"
            >
              {tC("edit")}
            </Link>
          </div>
        )}
      </div>

      {/* Company info */}
      <div className="mt-14 sm:mt-16 px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-900">{l(company, "name")}</h1>
          {company.isVerified && (
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
              {tC("verified")}
            </span>
          )}
          {(company.owner.role === "VIP" || company.owner.role === "INFINITE") && (
            <span className="inline-flex items-center gap-1 bg-brand-100 text-brand-700 text-xs font-medium px-2 py-1 rounded-full">
              {tC("associationMember")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
          {company.foundedYear && <span className="text-sm text-brand-700 font-medium">{tC("founded")} {company.foundedYear}</span>}
          {l(company, "address") && <span className="text-sm text-brand-600">{l(company, "address")}</span>}
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-sm font-semibold px-2 py-0.5 rounded-full">
            {"★".repeat(tier.stars)} {tier.label}
          </span>
        </div>

        {/* Contact row */}
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          {company.phone && (
            <a href={`tel:${company.phone}`} className="text-brand-600 hover:text-brand-800">{company.phone}</a>
          )}
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800 underline">
              {company.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>

        <CompanyTabs
          companyId={company.id}
          description={l(company, "description")}
          products={company.products.map((p) => ({
            ...p,
            imageUrls: p.imageUrls as string[],
            // Có đơn cert đang xử lý → menu sẽ ẩn item "Chứng nhận" cho card này
            hasActiveCert: p.certifications.length > 0,
          }))}
          galleryImages={company.galleryImages}
          newsItems={newsItems}
          companyName={l(company, "name")}
          companySlug={company.slug}
          foundedYear={company.foundedYear}
          employeeCount={company.employeeCount}
          businessLicense={company.businessLicense}
          address={l(company, "address")}
          phone={company.phone}
          website={company.website}
          postCount={postCount}
          canEdit={canEdit}
          isOwner={isOwner}
        />
      </div>
      </div>
    </div>
    </div>
  )
}
