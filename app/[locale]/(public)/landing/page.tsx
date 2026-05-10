import Link from "next/link"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { getLocale, getTranslations } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { getTierThresholds } from "@/lib/tier"

export const revalidate = 600

export async function generateMetadata() {
  const t = await getTranslations("landing")
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { canonical: "/landing" },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDesc"),
      type: "website",
      images: [{ url: "/landing-og.jpg", width: 1200, height: 630 }],
    },
  }
}

function formatVnd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}tr`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toString()
}

export default async function LandingPage() {
  const t = await getTranslations("landing")
  const tc = await getTranslations("common")
  const locale = (await getLocale()) as Locale

  const [
    vipCount,
    productCount,
    companyCount,
    researchCount,
    featuredCompanies,
    featuredProducts,
    businessThresholds,
  ] = await Promise.all([
    // Phase 3.7 round 4 (2026-04): mở rộng filter sang INFINITE — match
    // /admin/tieu-bieu để DN/SP của hội viên INFINITE được pin tiêu biểu
    // hiển thị đúng ở landing.
    prisma.user.count({ where: { role: { in: ["VIP", "INFINITE"] }, isActive: true } }),
    prisma.product.count({ where: { certStatus: "APPROVED" } }),
    prisma.company.count({ where: { isPublished: true } }),
    prisma.news.count({ where: { isPublished: true, category: "RESEARCH" } }),
    prisma.company.findMany({
      where: { isFeatured: true, isPublished: true, owner: { role: { in: ["VIP", "INFINITE"] } } },
      orderBy: [{ featuredOrder: "asc" }, { createdAt: "desc" }],
      take: 10,
      select: { id: true, name: true, slug: true, logoUrl: true, isVerified: true },
    }),
    prisma.product.findMany({
      where: { isFeatured: true, isPublished: true, owner: { role: { in: ["VIP", "INFINITE", "ADMIN"] } } },
      orderBy: [{ featuredOrder: "asc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true, name: true, slug: true, imageUrls: true, priceRange: true, certStatus: true,
        owner: { select: { name: true } }, company: { select: { name: true } },
      },
    }),
    getTierThresholds("BUSINESS"),
  ])

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hội Trầm Hương Việt Nam",
    alternateName: "VAWA — Vietnam Agarwood Association",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoitramhuong.vn",
    description: tc("siteDescription"),
    foundingDate: "2010-01-11",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Số 150, Đường Lý Chính Thắng, Phường Xuân Hòa",
      addressLocality: "Thành phố Hồ Chí Minh",
      addressCountry: "VN",
    },
    sameAs: ["https://www.facebook.com/hoitramhuongvietnam.org"],
    member: { "@type": "QuantitativeValue", value: vipCount, unitText: "members" },
  }

  const basicAccount = {
    name: t("basicTitle"),
    price: t("basicPrice"),
    color: "border-brand-200 bg-white",
    features: {
      quota: t("quota5"), homepage: false, certification: false,
      bannerQuota: t("banner1"), prioritySupport: false, verifiedBadge: false,
    },
    cta: { label: t("basicCta"), href: "/dang-ky" },
  }

  const tiers = [
    {
      name: t("tierStar1"), stars: "★",
      price: t("tierStar1Price"),
      color: "border-brand-300 bg-brand-50",
      features: {
        quota: t("quota15"), homepage: true, certification: true,
        bannerQuota: t("banner5"), prioritySupport: false, verifiedBadge: true,
      },
      cta: { label: t("tierStar1Cta"), href: "/dang-ky" },
    },
    {
      name: t("tierStar2"), stars: "★★",
      price: t("tierStar2Price", { amount: formatVnd(businessThresholds.silver) }),
      color: "border-amber-300 bg-amber-50 ring-2 ring-amber-200",
      popular: true,
      features: {
        quota: t("quota30"), homepage: true, certification: true,
        bannerQuota: t("banner10"), prioritySupport: true, verifiedBadge: true,
      },
      cta: { label: t("tierStar2Cta"), href: "/dang-ky" },
    },
    {
      name: t("tierStar3"), stars: "★★★",
      price: t("tierStar3Price", { amount: formatVnd(businessThresholds.gold) }),
      color: "border-yellow-400 bg-yellow-50",
      features: {
        quota: t("quotaUnlimited"), homepage: true, certification: true,
        bannerQuota: t("banner20"), prioritySupport: true, verifiedBadge: true,
      },
      cta: { label: t("tierStar3Cta"), href: "/dang-ky" },
    },
  ] as const

  const stats = [
    { value: vipCount, label: t("statMembers"), icon: "👥", href: "/hoi-vien" },
    { value: companyCount, label: t("statCompanies"), icon: "🏢", href: "/doanh-nghiep" },
    { value: productCount, label: t("statProducts"), icon: "✓", href: "/san-pham-chung-nhan" },
    { value: researchCount, label: t("statResearch"), icon: "📰", href: "/nghien-cuu" },
  ]

  const featureLabels = {
    quota: t("featureQuota"),
    homepage: t("featureHomepage"),
    cert: t("featureCert"),
    badge: t("featureBadge"),
    banner: t("featureBanner"),
    support: t("featureSupport"),
  }

  return (
    <div className="min-h-screen bg-brand-50/60">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* ── Page Banner ── */}
      <div className="bg-brand-800 py-14 px-4 text-center">
        <Image
          src="/logo.png"
          alt={tc("siteName")}
          width={96}
          height={96}
          className="h-20 w-20 mx-auto mb-3"
          priority
        />
        <h1 className="text-3xl font-bold sm:text-4xl text-brand-100">{t("bannerTitle")}</h1>
        <p className="mt-2 text-brand-300 text-base">{t("bannerSubtitle")}</p>
      </div>

      {/* ── Content card ── */}
      <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="bg-white rounded-2xl border border-brand-200 shadow-sm overflow-hidden">

      {/* ── Hero intro + CTAs ── */}
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-bold text-brand-900 sm:text-3xl lg:text-4xl leading-tight">
            {t("heroHeading")}{" "}
            <span className="text-brand-700">{t("heroHighlight")}</span>
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-base sm:text-lg text-brand-600">
            {t("heroDesc", { count: vipCount })}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}/dang-ky`}
              className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-8 py-5 text-base font-bold text-white shadow-sm transition-all hover:bg-brand-800 hover:shadow-md hover:-translate-y-0.5"
            >
              {t("heroCta")}
            </Link>
            <Link
              href="#tier-comparison"
              className="inline-flex items-center justify-center rounded-lg border-2 border-brand-300 px-8 py-5 text-base font-medium text-brand-700 transition-colors hover:bg-brand-50"
            >
              {t("heroCtaSecondary")}
            </Link>
          </div>

          <p className="mt-5 text-xs text-brand-500">{t("heroNote")}</p>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="border-t border-brand-100">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6">
            {stats.map(({ value, label, icon, href }) => (
              <Link key={label} href={href} className="text-center group cursor-pointer transition-transform hover:scale-105">
                <div className="text-3xl mb-1">{icon}</div>
                <p className="text-3xl font-bold text-brand-900 sm:text-4xl group-hover:text-brand-700 transition-colors">
                  {value.toLocaleString("vi-VN")}+
                </p>
                <p className="mt-1 text-sm font-medium text-brand-500 group-hover:text-brand-700 transition-colors">{label}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Top 10 Companies ── */}
      <section className="bg-brand-50/50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <header className="text-center mb-10">
            <p className="text-xs uppercase tracking-wider font-semibold text-brand-500 mb-2">{t("top10Label")}</p>
            <h2 className="text-3xl font-bold text-brand-900 sm:text-4xl">{t("top10Title")}</h2>
            <p className="mt-2 text-brand-600 max-w-2xl mx-auto">{t("top10Desc")}</p>
          </header>

          {featuredCompanies.length === 0 ? (
            <div className="rounded-2xl border border-brand-200 bg-white p-12 text-center text-brand-500 italic">
              {t("top10Empty")}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {featuredCompanies.map((company, idx) => (
                <Link
                  key={company.id}
                  href={`/doanh-nghiep/${company.slug}`}
                  className="group relative flex flex-col items-center rounded-2xl border-2 border-brand-200 bg-white p-5 text-center transition-all hover:border-brand-400 hover:shadow-lg hover:-translate-y-1"
                >
                  <span className="absolute -top-2 -left-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white font-bold text-xs shadow-md">
                    #{idx + 1}
                  </span>
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-brand-100 mb-3 bg-brand-50">
                    {company.logoUrl ? (
                      <Image src={company.logoUrl} alt={company.name} fill className="object-cover" sizes="(max-width: 640px) 64px, 80px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-brand-700 text-2xl font-bold text-brand-100">{company.name[0]}</div>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-brand-900 line-clamp-2 group-hover:text-brand-700">{company.name}</h3>
                  {company.isVerified && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">✓ Verified</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Top 20 Products ── */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <header className="text-center mb-10">
            <p className="text-xs uppercase tracking-wider font-semibold text-brand-500 mb-2">{t("top20Label")}</p>
            <h2 className="text-3xl font-bold text-brand-900 sm:text-4xl">{t("top20Title")}</h2>
            <p className="mt-2 text-brand-600 max-w-2xl mx-auto">{t("top20Desc")}</p>
          </header>

          {featuredProducts.length === 0 ? (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-12 text-center text-brand-500 italic">
              {t("top20Empty")}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {featuredProducts.map((product, idx) => {
                const cover = product.imageUrls[0] ?? null
                return (
                  <Link
                    key={product.id}
                    href={`/san-pham/${product.slug}`}
                    className="group relative bg-white rounded-xl border border-brand-200 shadow-sm overflow-hidden hover:shadow-lg hover:border-brand-400 transition-all"
                  >
                    <div className="relative aspect-square bg-brand-100 overflow-hidden">
                      {cover ? (
                        <Image src={cover} alt={product.name} fill className="object-cover transition-transform duration-300 group-hover:scale-110" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-brand-700 text-3xl">🌿</div>
                      )}
                      <span className="absolute top-2 left-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white font-bold text-xs shadow-md">#{idx + 1}</span>
                      {product.certStatus === "APPROVED" && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">✓</span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="line-clamp-2 text-sm font-semibold text-brand-900 group-hover:text-brand-700">{product.name}</h3>
                      <p className="mt-0.5 text-xs text-brand-500 line-clamp-1">{product.company?.name ?? product.owner.name}</p>
                      {product.priceRange && <p className="mt-1 text-xs font-bold text-brand-700">{product.priceRange}</p>}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <div className="mt-8 text-center">
            <Link href="/san-pham-doanh-nghiep" className="inline-flex items-center text-sm font-semibold text-brand-700 hover:text-brand-900 underline underline-offset-4">
              {t("viewAllProducts")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Basic Account ── */}
      <section className="py-16 lg:py-20 border-t border-brand-100">
        <div className="mx-auto max-w-md px-4">
          <header className="text-center mb-8">
            <p className="text-xs uppercase tracking-wider font-semibold text-brand-500 mb-2">{t("basicLabel")}</p>
            <h2 className="text-2xl font-bold text-brand-900 sm:text-3xl">{t("basicTitle")}</h2>
            <p className="mt-3 text-brand-600">{t("basicDesc")}</p>
          </header>

          <div className={`relative flex flex-col rounded-2xl border-2 p-6 shadow-sm ${basicAccount.color}`}>
            <div className="text-center mb-5">
              <h3 className="text-lg font-bold text-brand-900">{basicAccount.name}</h3>
              <p className="mt-1 text-sm text-brand-600">{basicAccount.price}</p>
            </div>

            <ul className="flex-1 space-y-3 text-sm border-t border-brand-200 pt-5">
              <FeatureRow label={featureLabels.quota}><span className="font-semibold text-brand-900">{basicAccount.features.quota}</span></FeatureRow>
              <FeatureRow label={featureLabels.homepage}><FeatureCheck on={basicAccount.features.homepage} /></FeatureRow>
              <FeatureRow label={featureLabels.cert}><FeatureCheck on={basicAccount.features.certification} /></FeatureRow>
              <FeatureRow label={featureLabels.badge}><FeatureCheck on={basicAccount.features.verifiedBadge} /></FeatureRow>
              <FeatureRow label={featureLabels.banner}><span className="text-xs font-semibold text-brand-900">{basicAccount.features.bannerQuota}</span></FeatureRow>
              <FeatureRow label={featureLabels.support}><FeatureCheck on={basicAccount.features.prioritySupport} /></FeatureRow>
            </ul>

            <Link
              href={basicAccount.cta.href}
              className="mt-6 inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors bg-brand-700 text-white hover:bg-brand-800"
            >
              {basicAccount.cta.label}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Tier Comparison ── */}
      <section id="tier-comparison" className="bg-brand-50/30 py-16 lg:py-24 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4">
          <header className="text-center mb-12">
            <p className="text-xs uppercase tracking-wider font-semibold text-brand-500 mb-2">{t("tierLabel")}</p>
            <h2 className="text-3xl font-bold text-brand-900 sm:text-4xl">{t("tierTitle")}</h2>
            <p className="mt-3 text-brand-600 max-w-2xl mx-auto">{t("tierDesc")}</p>
          </header>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {tiers.map((tier) => (
              <div key={tier.name} className={`relative flex flex-col rounded-2xl border-2 p-6 shadow-sm ${tier.color}`}>
                {"popular" in tier && tier.popular && (
                  <span className="absolute top-0 right-4 -translate-y-1/2 whitespace-nowrap inline-flex items-center gap-1 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-brand-900 shadow-lg ring-2 ring-white z-10">
                    {t("popularBadge")}
                  </span>
                )}
                <div className="text-center mb-5">
                  <p className="text-2xl font-bold text-amber-600 mb-1 min-h-8">{tier.stars}</p>
                  <h3 className="text-lg font-bold text-brand-900">{tier.name}</h3>
                  <p className="mt-1 text-sm text-brand-600">{tier.price}</p>
                </div>

                <ul className="flex-1 space-y-3 text-sm border-t border-brand-200 pt-5">
                  <FeatureRow label={featureLabels.quota}><span className="font-semibold text-brand-900">{tier.features.quota}</span></FeatureRow>
                  <FeatureRow label={featureLabels.homepage}><FeatureCheck on={tier.features.homepage} /></FeatureRow>
                  <FeatureRow label={featureLabels.cert}><FeatureCheck on={tier.features.certification} /></FeatureRow>
                  <FeatureRow label={featureLabels.badge}><FeatureCheck on={tier.features.verifiedBadge} /></FeatureRow>
                  <FeatureRow label={featureLabels.banner}><span className="text-xs font-semibold text-brand-900">{tier.features.bannerQuota}</span></FeatureRow>
                  <FeatureRow label={featureLabels.support}><FeatureCheck on={tier.features.prioritySupport} /></FeatureRow>
                </ul>

                <Link
                  href={tier.cta.href}
                  className="mt-6 inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors bg-brand-700 text-white hover:bg-brand-800"
                >
                  {tier.cta.label}
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-8 mx-auto max-w-2xl rounded-xl border border-brand-200 bg-brand-50/50 px-5 py-4 text-center text-xs text-brand-500 leading-relaxed">
            <p>
              {t("tierDisclaimer")}{" "}
              <Link href={`/${locale}/dieu-le`} className="underline underline-offset-2 text-brand-700 hover:text-brand-900">
                {t("charterLinkText")}
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      </div>
      </div>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden bg-brand-900 text-white py-20">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "radial-gradient(circle at 50% 50%, white 2px, transparent 2px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">{t("finalCtaTitle")}</h2>
          <p className="mt-4 text-brand-200 text-lg">{t("finalCtaDesc")}</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}/dang-ky`}
              className="inline-flex items-center justify-center rounded-lg bg-brand-400 px-8 py-4 text-base font-bold text-brand-900 shadow-lg transition-all hover:bg-brand-300 hover:shadow-xl hover:-translate-y-0.5"
            >
              {t("finalCtaButton")}
            </Link>
            <Link
              href="/lien-he"
              className="inline-flex items-center justify-center rounded-lg border-2 border-brand-300 px-8 py-4 text-base font-medium text-brand-300 transition-colors hover:bg-brand-300/10"
            >
              {t("finalCtaContact")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function FeatureRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-brand-600 text-xs">{label}</span>
      {children}
    </li>
  )
}

function FeatureCheck({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs">✓</span>
  ) : (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-300 text-xs">—</span>
  )
}
