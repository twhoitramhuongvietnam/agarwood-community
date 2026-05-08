import { Suspense } from "react"
import { Inter, Merriweather } from "next/font/google"
import { SiteHeader } from "@/components/features/homepage/SiteHeader"
import { SiteFooter } from "@/components/features/homepage/SiteFooter"
import { BackToTop } from "@/components/features/layout/BackToTop"
import { JoinFloatingBadge } from "@/components/features/register-nudge/JoinFloatingBadge"

function SiteFooterSkeleton() {
  return <footer aria-hidden className="min-h-[380px] bg-brand-900" />
}

// Inter + Merriweather — cùng setup với (public) layout để chrome (SiteHeader
// masthead + CategoryBar + hero serif) render thống nhất cho user đã đăng
// nhập vào feed. Dup import ở 2 layout là chấp nhận được; Next.js dedupe file
// font vì config trùng nhau.
const inter = Inter({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-inter",
  display: "swap",
})

// display:'optional' (thay vì 'swap') — đồng bộ với (public) layout. Chỉ
// dùng cho headline serif → FOIT 100ms chấp nhận được, tránh font-swap CLS.
const merriweather = Merriweather({
  subsets: ["latin", "latin-ext"],
  weight: ["700"],
  variable: "--font-merriweather",
  display: "optional",
})

export default function MemberLayout({
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
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <Suspense fallback={<SiteFooterSkeleton />}>
        <SiteFooter />
      </Suspense>
      <BackToTop />
      {/* Floating badge "Đăng ký thành viên" — guest only, gate ở server.
          Đồng bộ với (public) layout để guest landing /feed cũng thấy CTA
          giống các trang khác. */}
      <Suspense fallback={null}>
        <JoinFloatingBadge />
      </Suspense>
    </div>
  )
}
