"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { UserPlus, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Floating badge — desktop = pill (icon + text + X); mobile = circle compact
 * (tap để expand thành pill rồi mới có CTA + X).
 *
 * Per-page dismiss: pathname đổi → reset cả `dismissed` lẫn `mobileExpanded`
 * (Next.js layouts persist qua navigation nên useState không tự reset).
 *
 * Position dynamic: BackToTop hiện ở `bottom-6 right-6` khi scrollY > 400.
 * Badge ở `bottom-6` khi alone, đẩy lên `bottom-20` khi BackToTop xuất hiện
 * → 2 nút stack đẹp, không chồng.
 */
export function JoinFloatingBadgeClient() {
  const t = useTranslations("registerNudge")
  const locale = useLocale()
  const pathname = usePathname()
  const registerHref = `/${locale}/dang-ky`

  const [dismissed, setDismissed] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState(false)

  // Reset state khi đổi trang
  useEffect(() => {
    setDismissed(false)
    setMobileExpanded(false)
  }, [pathname])

  // Track scroll để biết khi nào BackToTop xuất hiện (cùng threshold 400)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 400)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (dismissed) return null

  const positionClass = scrolled ? "bottom-20" : "bottom-6"

  return (
    <>
      {/* ── Desktop pill ────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed right-6 z-40 hidden sm:block transition-[bottom] duration-200 print:hidden",
          positionClass,
        )}
      >
        <div className="flex items-center gap-1 rounded-full bg-linear-to-br from-amber-500 to-amber-700 py-1 pl-3 pr-1 shadow-lg ring-1 ring-amber-900/20">
          <UserPlus className="h-4 w-4 text-white shrink-0" aria-hidden />
          <Link
            href={registerHref}
            className="px-1 text-sm font-semibold text-white whitespace-nowrap hover:underline"
          >
            {t("badgeText")} →
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={t("badgeDismiss")}
            className="ml-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Mobile: collapsed circle / expanded pill ────────────────── */}
      <div
        className={cn(
          "fixed right-6 z-40 sm:hidden transition-[bottom] duration-200 print:hidden",
          positionClass,
        )}
      >
        {!mobileExpanded ? (
          <button
            type="button"
            onClick={() => setMobileExpanded(true)}
            aria-label={t("badgeText")}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-amber-700 text-white shadow-lg ring-1 ring-amber-900/20 active:scale-95 transition-transform"
          >
            <UserPlus className="h-5 w-5" />
            {/* Pulse dot — kéo chú ý nhẹ, không động đậy quá lố */}
            <span className="pointer-events-none absolute -top-0.5 -right-0.5 inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-1 rounded-full bg-linear-to-br from-amber-500 to-amber-700 py-1 pl-3 pr-1 shadow-lg ring-1 ring-amber-900/20">
            <Link
              href={registerHref}
              className="px-1 text-sm font-semibold text-white whitespace-nowrap"
            >
              {t("badgeText")} →
            </Link>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={t("badgeDismiss")}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
