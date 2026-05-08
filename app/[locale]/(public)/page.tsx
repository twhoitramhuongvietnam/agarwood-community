import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { NewsSection } from "@/components/features/homepage/NewsSection"
import { MemberRail } from "@/components/features/homepage/MemberRail"
import { MultimediaSection } from "@/components/features/homepage/MultimediaSection"
import { CertifiedProducts } from "@/components/features/homepage/CertifiedProducts"
import { ResearchSection } from "@/components/features/homepage/ResearchSection"
import { AgricultureSection } from "@/components/features/homepage/AgricultureSection"
import { PostsSection } from "@/components/features/homepage/PostsSection"
import { FeaturedCompanies } from "@/components/features/homepage/FeaturedCompanies"
import { Partners } from "@/components/features/homepage/Partners"
import { HomepageBannerSlot } from "@/components/features/homepage/HomepageBannerSlot"
import { HomepageTopBannerRow } from "@/components/features/homepage/HomepageTopBannerRow"
import { BreakingTicker } from "@/components/features/homepage/BreakingTicker"
import { HomepageJoinBanner } from "@/components/features/register-nudge/HomepageJoinBanner"
import {
  BannerSlotSkeleton,
  LatestPostsSkeleton,
  NewsSectionSkeleton,
  MemberRailSkeleton,
} from "@/components/features/homepage/skeletons"

export async function generateMetadata() {
  const t = await getTranslations("meta")
  return {
    title: t("titleDefault"),
    description: t("description"),
    alternates: { canonical: "/" },
    openGraph: {
      title: t("titleDefault"),
      description: t("description"),
      type: "website",
    },
  }
}

export const revalidate = 300

export default async function HomePage() {
  // auth() resolved tại parent để JoinBanner render đồng bộ — tránh stream-in
  // gây CLS ~0.2-0.3 khi banner ~500px push footer xuống.
  const [t, session] = await Promise.all([
    getTranslations("homepage"),
    auth(),
  ])

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hội Trầm Hương Việt Nam",
    alternateName: "VAWA — Vietnam Agarwood Association",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoitramhuong.vn",
    description:
      "Cộng đồng kết nối, chứng nhận và truyền thông sản phẩm trầm hương Việt Nam.",
    foundingDate: "2010-01-11",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Số 150, Đường Lý Chính Thắng, Phường Xuân Hòa",
      addressLocality: "Thành phố Hồ Chí Minh",
      addressCountry: "VN",
    },
    sameAs: ["https://www.facebook.com/hoitramhuongvietnam.org"],
  }

  return (
    <>
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-4 sm:px-6 lg:px-8 lg:py-6 lg:space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* Top 2 banner trái/phải song song — mỗi banner 485×90, tổng 970×90.
          HomepageTopBannerRow pre-check cả 2 slot, return null nếu cả 2 rỗng
          → wrapper aspect-970/90 không reserve space khi không có banner. */}
      <HomepageTopBannerRow />

      <Suspense fallback={<div className="h-10 border-y border-neutral-200 bg-white" />}>
        <BreakingTicker />
      </Suspense>

      <div className="grid gap-8 lg:grid-cols-4">
        <div className="min-w-0 lg:col-span-3">
          <Suspense fallback={<NewsSectionSkeleton />}>
            <NewsSection />
          </Suspense>
        </div>
        <div className="min-w-0 lg:col-span-1">
          <Suspense fallback={<MemberRailSkeleton />}>
            <MemberRail />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<LatestPostsSkeleton />}>
        <MultimediaSection />
      </Suspense>

      <Suspense fallback={<LatestPostsSkeleton />}>
        <CertifiedProducts />
      </Suspense>

      <Suspense fallback={<BannerSlotSkeleton />}>
        <HomepageBannerSlot slot="HOMEPAGE_MID" />
      </Suspense>

      <Suspense fallback={<LatestPostsSkeleton />}>
        <ResearchSection />
      </Suspense>

      <Suspense fallback={<LatestPostsSkeleton />}>
        <AgricultureSection />
      </Suspense>

      {/* Tin DN + Tin SP song song — KH yêu cầu đa dạng bố cục (2026-04-29).
          Tỉ lệ 7:5 lệch chuẩn (≠ 1:1) + 2 variant khác nhau (column-feature
          editorial vs column-grid commerce) tạo rhythm khác section full-
          width xung quanh. Mobile stack tự nhiên qua flex-col → lg:grid. */}
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="min-w-0 lg:col-span-7">
          <Suspense fallback={<LatestPostsSkeleton />}>
            {/* Q0=C (Phase 3.3 2026-04): gộp Post.NEWS + News.BUSINESS — bài
                user-feed về tin doanh nghiệp + tin admin BUSINESS chung 1 list,
                sort theo date desc. */}
            <PostsSection
              category="NEWS"
              newsCategory="BUSINESS"
              title={t("businessNews")}
              emptyText={t("businessNewsEmpty")}
              variant="column-feature"
            />
          </Suspense>
        </div>
        <div className="min-w-0 lg:col-span-5">
          <Suspense fallback={<LatestPostsSkeleton />}>
            {/* Q0=C: gộp Post.PRODUCT + News.PRODUCT — admin tin sản phẩm vào
                chung list với bài user khoe sản phẩm. */}
            <PostsSection
              category="PRODUCT"
              newsCategory="PRODUCT"
              title={t("productNews")}
              emptyText={t("productNewsEmpty")}
              variant="column-grid"
            />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <FeaturedCompanies />
      </Suspense>

      <Suspense fallback={null}>
        <Partners />
      </Suspense>
    </div>

    {/* Hero CTA banner — full-width, ngoài max-w-7xl container để gradient
        bg fill toàn viewport. Chỉ hiện cho guest, gate ở server-side.
        Render đồng bộ (không Suspense) để tránh CLS — auth() đã resolve ở
        parent nên không thêm wait time. */}
    {!session?.user && <HomepageJoinBanner />}
    </>
  )
}
