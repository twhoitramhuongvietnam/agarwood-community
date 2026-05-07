import type { Metadata } from "next"
import { Be_Vietnam_Pro, Noto_Sans_Arabic } from "next/font/google"
import Script from "next/script"
import { headers } from "next/headers"
import { Analytics } from "@vercel/analytics/next"
import { ProgressBar } from "@/components/features/layout/ProgressBar"
import { WebVitalsReporter } from "@/components/features/layout/WebVitalsReporter"
import { isRtlLocale, isValidLocale } from "@/i18n/config"
import "./globals.css"

// Weight 300 đã từng được thử nghiệm cho kiểu trang chủ mảnh mai nhưng không
// có class / CSS nào đang apply `font-weight: 300`. Bỏ để tiết kiệm ~80 kB
// font payload trên mobile Slow 4G.
// preload:false — public pages override sang Inter (trong (public)/layout),
// chỉ member + admin scopes mới fallback về Be VN Pro. Preload tất cả ở root
// → tải font file trên trang public không dùng → lãng phí hơn LCP budget.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
  preload: false,
})

// Arabic webfont — Be Vietnam Pro không phủ Arabic glyphs. Áp qua
// `html[lang="ar"]` rule trong globals.css. preload:false vì tuyệt đại đa số
// traffic là VI/EN/ZH — tránh tải 4 woff2 font Arabic trên mọi request.
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ar",
  display: "swap",
  preload: false,
})

// ĐÃ BỎ:
//   Playfair_Display — var `--font-heading` không được CSS rule nào apply
//   Noto_Sans_SC    — var `--font-zh` không được CSS rule nào apply
// (Trước đây tải 3–7 woff2 file trên mọi page load.)

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoitramhuong.vn"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hội Trầm Hương Việt Nam — Cộng đồng Doanh nghiệp Trầm Hương",
    template: "%s | Hội Trầm Hương Việt Nam",
  },
  description: "Cộng đồng kết nối, chứng nhận và truyền thông sản phẩm trầm hương Việt Nam. Nơi quy tụ doanh nghiệp trầm hương uy tín trên toàn quốc.",
  keywords: ["trầm hương", "hội trầm hương", "trầm hương Việt Nam", "chứng nhận trầm hương", "tinh dầu trầm hương", "nhang trầm", "trầm hương Khánh Hòa", "trầm hương Quảng Nam"],
  authors: [{ name: "Hội Trầm Hương Việt Nam" }],
  creator: "Hội Trầm Hương Việt Nam",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Hội Trầm Hương Việt Nam",
    title: "Hội Trầm Hương Việt Nam",
    description: "Cộng đồng kết nối, chứng nhận và truyền thông sản phẩm trầm hương Việt Nam.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hội Trầm Hương Việt Nam",
    description: "Cộng đồng kết nối, chứng nhận và truyền thông sản phẩm trầm hương Việt Nam.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()
  const headerLocale = h.get("x-locale")
  const lang = headerLocale && isValidLocale(headerLocale) ? headerLocale : "vi"
  const dir = isRtlLocale(lang) ? "rtl" : "ltr"

  return (
    <html
      lang={lang}
      dir={dir}
      className={`${beVietnamPro.variable} ${notoSansArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Pre-establish TCP+TLS to Cloudinary (cover + thumbnail host) so
            the first image byte arrives faster — 100–200ms LCP improvement
            on slow mobile when the LCP element is a Cloudinary image. */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        {/* RSS autodiscovery — cho Feedly / NewsBlur / Google News / Bing hiểu
            site có feed mà không cần vào robots.txt. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Hội Trầm Hương Việt Nam — Tin tức"
          href="/feed.xml"
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased refined-typography" suppressHydrationWarning>
        <ProgressBar />
        <WebVitalsReporter />
        {children}

        {/* Vercel Web Analytics — chỉ ghi nhận khi deployed lên Vercel
            (auto no-op trên localhost). Bật/tắt qua dashboard Vercel project. */}
        <Analytics />

        {/* Google Analytics 4 */}
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="lazyOnload" />
            <Script id="ga4" strategy="lazyOnload">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
