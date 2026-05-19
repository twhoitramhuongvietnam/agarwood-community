"use client"

import { useLocale, useTranslations } from "next-intl"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { sanitizeArticleHtml } from "@/lib/sanitize"
import { cn } from "@/lib/utils"
import { AgarwoodPlaceholder } from "@/components/ui/AgarwoodPlaceholder"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"
import { CompanyGallery, type GalleryImage } from "./CompanyGallery"
import { ProductCardMenu } from "./ProductCardMenu"

type Product = {
  id: string
  name: string
  slug: string
  imageUrls: string[]
  category: string | null
  priceRange: string | null
  certStatus: string
  badgeUrl: string | null
  /** Post.id gắn với Product — null cho SP legacy. Menu Xoá ẩn nếu null. */
  postId: string | null
  /** Có đơn chứng nhận đang DRAFT/PENDING/UNDER_REVIEW → menu sẽ ẩn item
   *  "Chứng nhận sản phẩm" để tránh nộp đơn trùng. */
  hasActiveCert: boolean
}

export type CompanyNewsItem = {
  id: string
  slug: string
  title: string
  title_en: string | null
  title_zh: string | null
  title_ar: string | null
  excerpt: string | null
  excerpt_en: string | null
  excerpt_zh: string | null
  excerpt_ar: string | null
  coverImageUrl: string | null
  publishedAt: Date | string | null
}

type Props = {
  companyId: string
  description: string | null | undefined
  products: Product[]
  galleryImages: GalleryImage[]
  newsItems: CompanyNewsItem[]
  companyName: string
  companySlug: string
  foundedYear?: number | null
  employeeCount?: string | null
  businessLicense?: string | null
  address?: string | null
  phone?: string | null
  website?: string | null
  postCount: number
  canEdit: boolean
  /** Tách khỏi canEdit để menu Sửa biết route owner vs admin. */
  isOwner: boolean
}

type TabId = "intro" | "products" | "gallery" | "news" | "info"

export function CompanyTabs({
  companyId,
  description,
  products,
  galleryImages,
  newsItems,
  companyName,
  companySlug,
  foundedYear,
  employeeCount,
  businessLicense,
  address,
  phone,
  website,
  postCount,
  canEdit,
  isOwner,
}: Props) {
  const t = useTranslations("companyTabs")
  const locale = useLocale()
  const l = <T extends Record<string, unknown>>(rec: T, field: string) =>
    localize(rec, field, locale as Locale) as string

  const [activeTab, setActiveTab] = useState<TabId>("intro")

  const tabs: { id: TabId; label: string }[] = [
    { id: "intro", label: t("tabIntro") },
    { id: "products", label: `${t("tabProducts")} (${products.length})` },
    { id: "gallery", label: `${t("tabGallery")} (${galleryImages.length})` },
    { id: "news", label: `${t("tabNews")} (${newsItems.length})` },
    { id: "info", label: t("tabInfo") },
  ]

  return (
    <div className="mt-6">
      {/* Tab bar — mobile: scroll-x thay vì wrap. Label như "Thư viện ảnh
          (5)" dễ rớt 2 dòng trong button khi viewport hẹp. whitespace-nowrap
          giữ label 1 dòng; overflow-x-auto cho phép quẹt ngang khi tổng
          chiều rộng tabs vượt container. */}
      <div className="flex gap-1 overflow-x-auto border-b border-brand-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-brand-600 text-brand-800"
                : "border-transparent text-brand-500 hover:text-brand-700 hover:border-brand-300",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {/* ── {t("tabIntro")} ──────────────────────────────────────────────── */}
        {activeTab === "intro" && (
          <div className="prose max-w-none text-brand-800 leading-relaxed">
            {description ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(description) }} />
            ) : (
              <p className="text-brand-400 italic">{t("noDescription")}</p>
            )}
          </div>
        )}

        {/* ── {t("tabProducts")} ────────────────────────────────────────────────── */}
        {activeTab === "products" && (
          <div>
            {canEdit && (
              <div className="mb-4">
                <Link
                  href={`/${locale}/feed/tao-bai?category=PRODUCT`}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-medium hover:bg-brand-800 transition-colors"
                >
                  {t("addProduct")}
                </Link>
              </div>
            )}

            {products.length === 0 ? (
              <p className="text-brand-400 italic text-sm">{t("noProducts")}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => (
                  <div key={product.id} className="relative">
                    <Link
                      href={`/san-pham/${product.slug}`}
                      className="group block bg-white border border-brand-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="relative aspect-square bg-brand-100">
                        {product.imageUrls.length > 0 ? (
                          <Image src={product.imageUrls[0]} alt={product.name} fill className="object-cover" sizes="(max-width: 640px) 50vw, 33vw" />
                        ) : (
                          <AgarwoodPlaceholder className="w-full h-full" size="md" shape="square" tone="light" />
                        )}
                        {product.certStatus === "APPROVED" && (
                          <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-brand-500 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-md">
                            {t("certified")}
                          </span>
                        )}
                      </div>
                      <div className="p-3 space-y-1">
                        <h3 className="text-sm font-semibold text-brand-900 group-hover:text-brand-700 transition-colors line-clamp-2 leading-snug">
                          {product.name}
                        </h3>
                        {product.category && <p className="text-xs text-brand-500">{product.category}</p>}
                        {product.priceRange && <p className="text-xs font-medium text-brand-700">{product.priceRange}</p>}
                      </div>
                    </Link>
                    {/* Menu Sửa/Xoá/Chứng nhận overlay góc trái-trên — owner/
                        admin only. Sống ngoài <Link> để click không trigger
                        navigate vào detail page. */}
                    {canEdit && (
                      <ProductCardMenu
                        productId={product.id}
                        productSlug={product.slug}
                        postId={product.postId}
                        isOwner={isOwner}
                        certStatus={product.certStatus}
                        hasActiveCert={product.hasActiveCert}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── {t("tabGallery")} ─────────────────────────────────────────── */}
        {activeTab === "gallery" && (
          <CompanyGallery
            companyId={companyId}
            images={galleryImages}
            canEdit={canEdit}
          />
        )}

        {/* ── {t("tabNews")} — News rows liên kết DN qua relatedCompanyId.
             Phase 3.3 (2026-04): gộp BUSINESS + PRODUCT cùng 1 tab theo
             quyết định Q4 customer. Click → /tin-tuc/{slug}. ───────── */}
        {activeTab === "news" && (
          <div>
            {newsItems.length === 0 ? (
              <p className="text-brand-400 italic text-sm">{t("noNews")}</p>
            ) : (
              <ul className="divide-y divide-brand-100">
                {newsItems.map((n) => (
                  <li key={n.id} className="py-4 first:pt-0 last:pb-0">
                    <Link
                      href={`/${locale}/tin-tuc/${n.slug}`}
                      className="group flex gap-4"
                    >
                      <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-brand-100 sm:h-24 sm:w-40">
                        {n.coverImageUrl ? (
                          <Image
                            src={n.coverImageUrl}
                            alt={l(n, "title")}
                            fill
                            sizes="(max-width: 640px) 128px, 160px"
                            className="object-cover"
                          />
                        ) : (
                          <AgarwoodPlaceholder className="h-full w-full" size="sm" shape="square" tone="light" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-base font-semibold text-brand-900 group-hover:text-brand-700">
                          {l(n, "title")}
                        </h3>
                        {l(n, "excerpt") && (
                          <p className="mt-1 line-clamp-2 text-sm text-brand-600">
                            {l(n, "excerpt")}
                          </p>
                        )}
                        {n.publishedAt && (
                          <time className="mt-1 block text-xs text-brand-400">
                            {new Date(n.publishedAt).toLocaleDateString(locale, {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </time>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── {t("tabInfo")} ────────────────────────────────────────────────── */}
        {activeTab === "info" && (
          <dl className="divide-y divide-brand-100 text-sm">
            <InfoRow label={t("companyName")} value={companyName} />
            {foundedYear && <InfoRow label={t("foundedYear")} value={String(foundedYear)} />}
            {employeeCount && <InfoRow label={t("employeeCount")} value={`${employeeCount} ${t("people")}`} />}
            {businessLicense && <InfoRow label={t("businessLicense")} value={businessLicense} />}
            {address && <InfoRow label={t("address")} value={address} />}
            {phone && <InfoRow label={t("phone")} value={phone} />}
            {website && (
              <div className="py-3 flex items-start gap-4">
                <dt className="w-40 shrink-0 text-brand-500 font-medium">{t("website")}</dt>
                <dd>
                  <a href={website} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline break-all">
                    {website}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3 flex items-start gap-4">
      <dt className="w-40 shrink-0 text-brand-500 font-medium">{label}</dt>
      <dd className="text-brand-800">{value}</dd>
    </div>
  )
}
