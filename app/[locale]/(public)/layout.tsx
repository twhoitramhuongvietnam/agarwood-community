import { Suspense } from "react"
import { Inter, Merriweather } from "next/font/google"
import { SiteHeader } from "@/components/features/homepage/SiteHeader"
import { SiteFooter } from "@/components/features/homepage/SiteFooter"
import { BackToTop } from "@/components/features/layout/BackToTop"
import { JoinFloatingBadge } from "@/components/features/register-nudge/JoinFloatingBadge"

function SiteFooterSkeleton() {
  return <footer aria-hidden className="min-h-[380px] bg-brand-900" />
}

// Inter: primary font cho phong cách thuần báo chí (Option VTV-style).
// Scoped trong public layout — member/admin layouts giữ Be Vietnam Pro.
// Weights: 400 (body), 500 (font-medium ~120 chỗ trong public), 600
// (font-semibold), 700 (font-bold + serif-headline). Bỏ 900 (font-black) —
// trước chỉ dùng ở ZaloIcon, đã chuyển sang font-bold. Mỗi weight subset
// vietnamese ~60KB → cắt 1 weight ~20% font payload mobile.
const inter = Inter({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
})

// Merriweather: serif nhấn mạnh cho article headline (VTV-style).
// Không subset "vietnamese" vì Merriweather không hỗ trợ — fallback về latin
// coverage có đủ dấu Việt cơ bản qua combining diacritics.
// Chỉ tải weight 700 — duy nhất được dùng via `.font-serif-headline` (h1
// detail + h2 hero list đều là font-bold). Giảm ~40% font payload so với 3
// weights.
// display:'optional' (thay vì 'swap') — chỉ dùng cho headline nên FOIT 100ms
// chấp nhận được; tránh font-swap gây CLS sau khi document đã render.
const merriweather = Merriweather({
  subsets: ["latin", "latin-ext"],
  weight: ["700"],
  variable: "--font-merriweather",
  display: "optional",
})

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      data-page="public"
      className={`${inter.variable} ${merriweather.variable} min-h-screen bg-white`}
    >
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <Suspense fallback={<SiteFooterSkeleton />}>
        <SiteFooter />
      </Suspense>
      <BackToTop />
      {/* Floating badge "Đăng ký thành viên" — guest only, gate ở server.
          Per-page dismiss (state reset khi đổi pathname). */}
      <Suspense fallback={null}>
        <JoinFloatingBadge />
      </Suspense>
    </div>
  )
}
