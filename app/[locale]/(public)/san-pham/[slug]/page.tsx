import { cache } from "react"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import DOMPurify from "isomorphic-dompurify"
import { CloudinaryImage } from "@/components/ui/CloudinaryImage"
import { rewriteCloudinaryInHtml } from "@/lib/cloudinary"
import { ProductGallery } from "./ProductGallery"
import { ProductActionsMenu } from "./ProductActionsMenu"
import { ProductPriceBlock, type ProductVariant } from "./ProductPriceBlock"
import { CommentsSection } from "@/components/features/comments/CommentsSection"
import {
  PRODUCT_DEFAULT_SHIPPING,
  PRODUCT_DEFAULT_RETURN,
} from "@/lib/constants/agarwood"

export const revalidate = 3600

type Props = { params: Promise<{ slug: string }> }

/** React.cache dedupe giữa generateMetadata và main page — 1 query/request. */
const getProductBySlug = cache(async (slug: string) =>
  prisma.product.findUnique({
    where: { slug, isPublished: true },
    include: {
      owner: {
        select: {
          id: true, name: true, avatarUrl: true, phone: true,
          role: true, contributionTotal: true,
        },
      },
      company: {
        select: {
          name: true, name_en: true, name_zh: true, name_ar: true, slug: true, logoUrl: true, isVerified: true,
          ownerId: true, phone: true, website: true,
          // Phase 4 (2026-04-29): seller card cần thêm các stat về DN
          description: true, description_en: true, description_zh: true, description_ar: true,
          foundedYear: true, address: true,
          representativeName: true, representativePosition: true,
        },
      },
      certifications: {
        where: { status: "APPROVED" },
        orderBy: { approvedAt: "desc" },
        take: 1,
        select: { id: true, certCode: true, approvedAt: true, reviewMode: true },
      },
      // Phase 4 (2026-04-29): post linked qua Product.postId — cần fields
      // status/isPromoted/newsCategories/category cho ProductActionsMenu
      // (Khoá / Đẩy lên trang chủ / Xoá — đồng bộ với feed admin menu).
      // promotionRequests: owner flow "Xin đẩy lên trang chủ" / "Rút yêu cầu".
      post: {
        select: {
          id: true,
          status: true,
          isPromoted: true,
          newsCategories: true,
          category: true,
          title: true,
          promotionRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      },
    },
  }),
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: "Not found" }
  return {
    title: `${product.name} | Hội Trầm Hương Việt Nam`,
    description: product.description?.slice(0, 160) ?? undefined,
    openGraph: {
      title: product.name,
      description: product.description?.slice(0, 160) ?? undefined,
      images: product.imageUrls.length > 0 ? [{ url: product.imageUrls[0] as string }] : [],
    },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const tP = await getTranslations("productDetail")

  const locale = await getLocale() as Locale
  const l = <T extends Record<string, unknown>>(record: T, field: string) => localize(record, field, locale) as string
  const { slug } = await params
  const session = await auth()

  const product = await getProductBySlug(slug)
  if (!product) notFound()

  // Phase 4 (2026-04-29): Tách thành 2 query —
  //  1. sameCompanyProducts: SP khác cùng DN (cho Zone 4 "Khác từ DN này")
  //  2. companyProductsCount: tổng SP của DN cho seller card stat
  // Bỏ "related products" gộp lẫn cả category + owner + company — tách rõ.
  const [sameCompanyProducts, companyProductsCount] = await Promise.all([
    product.companyId
      ? prisma.product.findMany({
          where: {
            isPublished: true,
            companyId: product.companyId,
            slug: { not: slug },
          },
          take: 4,
          orderBy: [{ certStatus: "desc" }, { createdAt: "desc" }],
          select: {
            id: true, name: true, name_en: true, name_zh: true, name_ar: true, slug: true, imageUrls: true,
            category: true, category_en: true, category_zh: true, category_ar: true, priceRange: true, certStatus: true,
          },
        })
      : Promise.resolve([]),
    product.companyId
      ? prisma.product.count({ where: { isPublished: true, companyId: product.companyId } })
      : Promise.resolve(0),
  ])

  const imageUrls = product.imageUrls as string[]
  const approvedCert = product.certifications[0] ?? null
  const certDate = approvedCert?.approvedAt
    ? new Date(approvedCert.approvedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null

  // Role-based CTA logic
  const isOwner = session?.user?.id === product.owner.id
  const viewerIsAdmin = isAdmin(session?.user?.role)
  // canProductWrite bao gồm ADMIN và committee TRUYEN_THONG — họ đi qua
  // admin edit route (audit trail). Owner self-edit đi qua owner route.
  const canProductWrite = session?.user?.id
    ? hasPermission(await getUserPermissions(session.user.id), "product:write")
    : false
  const hasCompany = !!product.company

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description?.slice(0, 300),
    image: imageUrls[0] ?? undefined,
    category: product.category ?? undefined,
    brand: product.company
      ? { "@type": "Organization", name: product.company.name }
      : { "@type": "Person", name: product.owner.name },
    ...(product.certStatus === "APPROVED" && certDate ? {
      certification: {
        "@type": "Certification",
        name: "Chứng nhận Hội Trầm Hương Việt Nam",
        certificationStatus: "CertificationActive",
        datePublished: approvedCert?.approvedAt ? new Date(approvedCert.approvedAt).toISOString() : undefined,
        issuedBy: { "@type": "Organization", name: "Hội Trầm Hương Việt Nam" },
      },
    } : {}),
  }

  return (
    <div className="bg-brand-50/60 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />

      {/* Breadcrumb — outside the card, on page background */}
      <nav className="flex items-center gap-2 text-sm text-brand-500 mb-6 flex-wrap">
        <Link href="/" className="hover:text-brand-700">Trang chủ</Link>
        <span>/</span>
        <Link href="/san-pham-chung-nhan" className="hover:text-brand-700">Sản phẩm Chứng nhận</Link>
        {l(product, "category") && (
          <>
            <span>/</span>
            <span className="text-brand-500">{l(product, "category")}</span>
          </>
        )}
        <span>/</span>
        <span className="text-brand-800 font-medium line-clamp-1">{l(product, "name")}</span>
      </nav>

      <div className="space-y-6 lg:space-y-8">

      {/* ─────────────────────────────────────────────────────────────────
          ZONE 1 — VÙNG SẢN PHẨM (Lazada-flush style)
          KH yêu cầu (2026-04-29): tỉ lệ ảnh + typography + no-border + zoom
          theo Lazada. Card chỉ giữ bg trắng, bỏ border bao quanh; gallery
          flush không border; label typography subtle gray uppercase; spacing
          rộng rãi.
          ───────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-brand-200 shadow-sm p-6 sm:p-8">
        {/* Tỉ lệ 2:5 / 3:5 (gallery / info) — KH yêu cầu Lazada-like (info
            column rộng hơn để typography và CTA thoáng). Mobile vẫn 1 col. */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 sm:gap-8 lg:gap-10">
          {/* Left: gallery flush, hover-zoom (col-span-2 / 5) */}
          <div className="md:col-span-2">
            <ProductGallery imageUrls={imageUrls} productName={l(product, "name")} />
          </div>

          {/* Right: buying info (col-span-3 / 5) — typography hierarchy Lazada */}
          <div className="md:col-span-3 space-y-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                {/* Title — medium-bold, không quá to */}
                <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900 leading-snug">
                  {l(product, "name")}
                </h1>
                <ProductActionsMenu
                  productId={product.id}
                  slug={slug}
                  isOwner={isOwner}
                  canProductWrite={canProductWrite}
                  isAdminViewer={viewerIsAdmin}
                  certStatus={product.certStatus}
                  initialIsFeatured={product.isFeatured}
                  post={product.post}
                />
              </div>

              {/* Mini company line — subtle */}
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {hasCompany ? (
                  <>
                    <span className="text-neutral-500">Thương hiệu:</span>
                    <Link href={`/doanh-nghiep/${product.company!.slug}`} className="font-medium text-amber-700 hover:text-amber-800 hover:underline">
                      {product.company!.name}
                    </Link>
                    {product.company!.isVerified && (
                      <span className="shrink-0 whitespace-nowrap text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">{tP("verified")}</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-neutral-500">Người bán:</span>
                    <span className="font-medium text-neutral-900">{product.owner.name}</span>
                    {(product.owner.role === "VIP" || product.owner.role === "INFINITE") && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">{tP("member")}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Category pill — subtle outlined */}
            {l(product, "category") && (
              <div className="flex flex-wrap gap-2">
                <span className="border border-neutral-200 bg-neutral-50 text-neutral-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  {l(product, "category")}
                </span>
              </div>
            )}

            {/* Price block — compact label hàng trên, giá to hàng dưới (Lazada) */}
            <ProductPriceBlock
              defaultPriceRange={product.priceRange}
              variants={
                Array.isArray(product.variants)
                  ? (product.variants as unknown as ProductVariant[])
                  : null
              }
            />

            {/* Trust signals + chính sách — row style Lazada (label trái + value phải).
                Spec ngắn (Xuất xứ / Tuổi cây) đặt ở đầu vì là decision factors.
                Sau đó: Chứng nhận (chỉ APPROVED) / Giao hàng / Đổi trả / Loại SP. */}
            <div className="space-y-2 border-t border-neutral-100 pt-4">
              {product.origin && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 w-36 text-neutral-500 text-xs uppercase tracking-wide pt-0.5">Xuất xứ:</span>
                  <span className="flex-1 text-neutral-800">{product.origin}</span>
                </div>
              )}
              {product.treeAge && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 w-36 text-neutral-500 text-xs uppercase tracking-wide pt-0.5">Tuổi cây:</span>
                  <span className="flex-1 text-neutral-800">{product.treeAge}</span>
                </div>
              )}
              {product.certStatus === "APPROVED" && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 w-36 text-neutral-500 text-xs uppercase tracking-wide pt-0.5">Chứng nhận:</span>
                  <span className="flex-1 text-neutral-800">
                    {/* Click → trang xác minh chứng nhận. Ưu tiên certCode chính
                        thức (HTHVN-YYYY-NNNN); fallback slug cho cert legacy
                        chưa có certCode. */}
                    <Link
                      href={`/verify/${approvedCert?.certCode ?? product.slug}`}
                      title="Xem chứng nhận chính thức"
                      className="inline-flex items-center gap-1 font-medium text-amber-800 underline-offset-2 hover:underline hover:text-amber-900"
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-white text-[10px] font-bold">✓</span>
                      Hội Trầm Hương Việt Nam
                    </Link>
                    {certDate && (
                      <span className="ml-1 text-xs text-neutral-500">— Cấp {certDate}</span>
                    )}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-3 text-sm">
                <span className="shrink-0 w-36 text-neutral-500 text-xs uppercase tracking-wide pt-0.5">Giao hàng:</span>
                <span className="flex-1 text-neutral-800 whitespace-pre-line">
                  {product.shippingPolicy?.trim() || PRODUCT_DEFAULT_SHIPPING}
                </span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <span className="shrink-0 w-36 text-neutral-500 text-xs uppercase tracking-wide pt-0.5">Đổi trả &amp; Bảo hành:</span>
                <span className="flex-1 text-neutral-800 whitespace-pre-line">
                  {product.returnPolicy?.trim() || PRODUCT_DEFAULT_RETURN}
                </span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <span className="shrink-0 w-36 text-neutral-500 text-xs uppercase tracking-wide pt-0.5">Loại sản phẩm:</span>
                <span className="flex-1 text-neutral-800">Đóng hộp</span>
              </div>
            </div>

            {product.certStatus === "PENDING" || product.certStatus === "UNDER_REVIEW" ? (
              <p className="text-xs text-yellow-700 italic">⏳ Đang chờ xét duyệt chứng nhận</p>
            ) : product.certStatus !== "APPROVED" ? (
              <p className="text-xs text-neutral-400 italic">Sản phẩm chưa có chứng nhận từ Hội</p>
            ) : null}

            {/* Visitor CTA — guests/non-admin/non-owner. Full-width như Lazada */}
            {!isOwner && !viewerIsAdmin && (
              <div className="space-y-2 pt-2">
                {hasCompany && (
                  <Link
                    href={`/doanh-nghiep/${product.company!.slug}`}
                    className="block w-full rounded-lg bg-amber-700 text-white text-center px-4 py-3 text-sm font-semibold hover:bg-amber-800 transition-colors"
                  >
                    Liên hệ doanh nghiệp
                  </Link>
                )}
                {!hasCompany && product.owner.phone && (
                  <a
                    href={`tel:${product.owner.phone}`}
                    className="block w-full rounded-lg bg-amber-700 text-white text-center px-4 py-3 text-sm font-semibold hover:bg-amber-800 transition-colors"
                  >
                    📞 Gọi: {product.owner.phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          ZONE 2 — VÙNG CÔNG TY
          Seller card — pattern Lazada "Sold by". Logo to + name + verified
          + description ngắn + stats grid (số SP, năm thành lập, địa chỉ)
          + CTA "Xem trang doanh nghiệp" + "Gọi". Ẩn nếu product không có
          company (cá nhân tự đăng).
          ───────────────────────────────────────────────────────────── */}
      {hasCompany && (
        <section className="bg-white rounded-2xl border border-brand-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Logo */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-brand-100 overflow-hidden shrink-0">
              <CloudinaryImage
                src={product.company!.logoUrl}
                alt={product.company!.name}
                fill
                className="object-cover"
                sizes="96px"
                maxWidth={200}
                fallbackSize="sm"
              />
            </div>

            {/* Info column */}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/doanh-nghiep/${product.company!.slug}`}
                  className="text-lg sm:text-xl font-bold text-brand-900 hover:text-brand-700"
                >
                  {l(product.company!, "name")}
                </Link>
                {product.company!.isVerified && (
                  <span className="shrink-0 whitespace-nowrap text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {tP("verified")}
                  </span>
                )}
              </div>

              {/* Address (trái) + CTAs (phải) cùng 1 hàng — KH yêu cầu
                  2026-04-29. Mobile <sm: stack dọc, CTA full-width tránh
                  tràn border khi phone dài (vd "1900 9279"). Desktop sm+:
                  giữ layout 2 cột justify-between. */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                {product.company!.address && (
                  <dl className="text-sm sm:flex-1 sm:min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-brand-500">Địa chỉ</dt>
                    <dd className="text-sm text-brand-800 line-clamp-2" title={product.company!.address ?? ""}>
                      {product.company!.address}
                    </dd>
                  </dl>
                )}
                <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:shrink-0">
                  <Link
                    href={`/doanh-nghiep/${product.company!.slug}`}
                    className="rounded-lg border border-brand-700 text-brand-700 px-3 py-1.5 text-xs font-semibold hover:bg-brand-700 hover:text-white transition-colors"
                  >
                    Xem trang doanh nghiệp
                  </Link>
                  {product.company!.phone && (
                    <a
                      href={`tel:${product.company!.phone}`}
                      className="rounded-lg border border-brand-300 text-brand-700 px-3 py-1.5 text-xs font-semibold hover:bg-brand-50 transition-colors whitespace-nowrap"
                    >
                      📞 {product.company!.phone}
                    </a>
                  )}
                  {product.company!.website && (
                    <a
                      href={product.company!.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-brand-300 text-brand-700 px-3 py-1.5 text-xs font-semibold hover:bg-brand-50 transition-colors whitespace-nowrap"
                    >
                      🌐 Website
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          ZONE 3 — VÙNG CHI TIẾT + ĐÁNH GIÁ
          Gom Description (long) + Spec sheet + Comments. Pattern Lazada
          "Description / Specifications / Reviews" — không dùng tabs vì
          content ngắn, scroll thẳng tự nhiên hơn.
          ───────────────────────────────────────────────────────────── */}
      {(l(product, "description") ||
        product.packagingNote ||
        product.scentProfile) && (
        <section className="bg-white rounded-2xl border border-brand-200 shadow-sm p-6 sm:p-8 space-y-8">
          {l(product, "description") && (
            <div>
              <h2 className="text-base font-bold text-brand-900 mb-3">Mô tả sản phẩm</h2>
              <div
                className="prose prose-sm max-w-none text-brand-700 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(rewriteCloudinaryInHtml(l(product, "description") ?? "", 1024)),
                }}
              />
            </div>
          )}

          {(product.packagingNote || product.scentProfile) && (
            <div>
              <h2 className="text-base font-bold text-brand-900 mb-3">Thông số sản phẩm</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm rounded-lg border border-brand-200 bg-brand-50/40 p-4">
                {product.packagingNote && (
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] uppercase tracking-wide text-brand-500">Quy cách đóng gói</dt>
                    <dd className="text-brand-800 leading-snug whitespace-pre-line">{product.packagingNote}</dd>
                  </div>
                )}
                {product.scentProfile && (
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] uppercase tracking-wide text-brand-500">Mùi hương / Đặc điểm</dt>
                    <dd className="text-brand-800 leading-snug whitespace-pre-line">{product.scentProfile}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </section>
      )}

      {/* Comments — section riêng (Zone 3 phần 2) */}
      <section className="bg-white rounded-2xl border border-brand-200 shadow-sm p-6 sm:p-8">
        <h2 className="text-base font-bold text-brand-900 mb-3">Đánh giá &amp; Bình luận</h2>
        <CommentsSection
          productId={product.id}
          currentUserId={session?.user?.id ?? null}
          currentUserRole={session?.user?.role}
          currentUserName={session?.user?.name}
          currentUserAvatar={session?.user?.image}
        />
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          ZONE 4 — VÙNG SẢN PHẨM CÙNG CÔNG TY
          Carousel grid SP khác từ DN này. Pattern Lazada "From This Shop".
          Ẩn nếu DN chỉ có duy nhất SP đang xem.
          ───────────────────────────────────────────────────────────── */}
      {sameCompanyProducts.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between gap-3 mb-5">
            <h2 className="text-xl font-semibold text-brand-900">
              Sản phẩm khác từ {l(product.company!, "name")}
            </h2>
            <Link
              href={`/doanh-nghiep/${product.company!.slug}`}
              className="text-sm text-brand-600 hover:text-brand-800 underline shrink-0"
            >
              Xem tất cả ({companyProductsCount})
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {sameCompanyProducts.map((rp) => {
              const rpImages = rp.imageUrls as string[]
              return (
                <Link
                  key={rp.id}
                  href={`/san-pham/${rp.slug}`}
                  className="group block bg-white border border-brand-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-square bg-brand-100">
                    <CloudinaryImage
                      src={rpImages[0]}
                      alt={l(rp, "name")}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 25vw"
                      maxWidth={480}
                    />
                    {rp.certStatus === "APPROVED" && (
                      <span className="absolute top-2 right-2 bg-amber-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full shadow">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold text-brand-900 group-hover:text-brand-700 line-clamp-2 leading-snug">
                      {l(rp, "name")}
                    </p>
                    {l(rp, "category") && (
                      <p className="text-xs text-brand-500">{l(rp, "category")}</p>
                    )}
                    {rp.priceRange && (
                      <p className="text-sm font-bold text-amber-700">{rp.priceRange}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
      </div>
      </div>
    </div>
  )
}
