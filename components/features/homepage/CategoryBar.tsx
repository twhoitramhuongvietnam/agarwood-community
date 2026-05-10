"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { locales } from "@/i18n/config"

// Phase 3.7 round 5 (2026-05): menu chuyển từ hardcode → CMS-driven. Items
// được fetch ở SiteHeader (server) qua getMenuTree() và đã localize trước khi
// truyền xuống. Admin sửa ở /admin/menu → effect ngay tại đây sau cache 60s
// (xem lib/menu.ts).
export type CategoryBarSubItem = {
  menuKey: string | null
  label: string
  href: string
  matchPrefixes?: string[]
  openInNewTab?: boolean
}
export type CategoryBarItem = {
  menuKey: string | null
  label: string
  href: string
  isNew?: boolean
  comingSoon?: boolean
  openInNewTab?: boolean
  matchPrefixes?: string[]
  children?: CategoryBarSubItem[]
}

/** Strip locale prefix (/vi, /en, ...) để so khớp với href đã khai báo. */
function stripLocale(path: string): string {
  for (const loc of locales) {
    if (path === `/${loc}`) return "/"
    if (path.startsWith(`/${loc}/`)) return path.slice(loc.length + 1)
  }
  return path
}

/** Match exact hoặc prefix (để trang detail `/tin-tuc/foo` vẫn highlight
 *  parent `/tin-tuc`). Trang chủ `/` phải match chính xác, không ăn mọi path.
 *  Đã loại bỏ locale prefix (vd "/vi") khỏi cả `pathname` và item.href trước
 *  khi gọi — xem stripLocale dưới. */
function matchesPath(itemHref: string, pathname: string, prefixes: string[] = []): boolean {
  const exact = itemHref === "/" ? pathname === "/" : (pathname === itemHref || pathname.startsWith(itemHref + "/"))
  if (exact) return true
  for (const p of prefixes) {
    if (!p) continue
    if (pathname === p || pathname.startsWith(p + "/")) return true
  }
  return false
}

function isItemActive(item: CategoryBarItem, pathname: string): boolean {
  const itemHref = stripLocale(item.href)
  if (matchesPath(itemHref, pathname, item.matchPrefixes ?? [])) return true
  if (item.children && item.children.length > 0) {
    return item.children.some((c) =>
      matchesPath(stripLocale(c.href), pathname, c.matchPrefixes ?? []),
    )
  }
  return false
}

const BASE_TRIGGER =
  "inline-flex items-center gap-1 px-3.5 py-2.5 text-[13px] font-semibold uppercase tracking-wide transition-colors"

/** Guest → hiện 2 CTA auth prominent (Đăng nhập + Đăng ký hội viên) ở cuối
 *  CategoryBar. Logged-in → skip vì UserMenu đã ở utility strip. */
type Props = {
  loggedIn?: boolean
  items: CategoryBarItem[]
}

export function CategoryBar({ loggedIn = false, items }: Props) {
  const pathname = stripLocale(usePathname() || "/")
  const t = useTranslations("navbar")

  // Submenu open state — render dropdown qua portal vào document.body để
  // escape overflow clipping của <ul> parent (overflow-x-auto + overflow-y-
  // hidden bắt buộc do browser spec, dropdown absolute trong <li> sẽ bị
  // clip khỏi viewport, đặc biệt mobile khi không có lg:overflow-visible).
  const [openHref, setOpenHref] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number } | null>(null)
  const triggerRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const ulRef = useRef<HTMLUListElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Đánh dấu mounted để portal không SSR (createPortal ngoài body chỉ
  // hợp lệ ở client; render gì đó SSR rồi swap qua portal sẽ flicker).
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close dropdown khi chuyển trang
  useEffect(() => {
    setOpenHref(null)
  }, [pathname])

  // Mobile: scroll item active vào giữa scroll-x container để user thấy
  // được vị trí của họ trong dải menu. Desktop có lg:overflow-visible nên
  // scrollLeft no-op (clientWidth = scrollWidth → delta = 0). Dùng
  // getBoundingClientRect thay vì offsetLeft vì <ul> không phải offsetParent
  // (không có position). useLayoutEffect → set trước paint, không flash.
  useLayoutEffect(() => {
    const ul = ulRef.current
    if (!ul) return
    const active = ul.querySelector('[aria-current="page"]') as HTMLElement | null
    if (!active) return
    const ulBox = ul.getBoundingClientRect()
    const aBox = active.getBoundingClientRect()
    const delta = aBox.left + aBox.width / 2 - (ulBox.left + ulBox.width / 2)
    ul.scrollLeft = Math.max(0, ul.scrollLeft + delta)
  }, [pathname])

  const recomputePos = useCallback((href: string) => {
    const trigger = triggerRefs.current[href]
    if (!trigger) {
      setDropdownPos(null)
      return
    }
    const rect = trigger.getBoundingClientRect()
    setDropdownPos({ left: rect.left, top: rect.bottom })
  }, [])

  // Khi openHref đổi, compute position của dropdown tương ứng
  useLayoutEffect(() => {
    if (openHref) recomputePos(openHref)
    else setDropdownPos(null)
  }, [openHref, recomputePos])

  // Đóng khi click ngoài + recompute position khi scroll/resize
  useEffect(() => {
    if (!openHref) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest("[data-cb-trigger]") || target.closest("[data-cb-dropdown]")) return
      setOpenHref(null)
    }
    const onScroll = () => setOpenHref(null)
    const onResize = () => setOpenHref(null)
    document.addEventListener("click", onDocClick)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onResize)
    return () => {
      document.removeEventListener("click", onDocClick)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onResize)
    }
  }, [openHref])

  // Hover handlers — mở khi enter trigger HOẶC dropdown, schedule close
  // 120ms khi leave để mouse có thể di chuyển từ trigger xuống dropdown
  // (giữa có gap nhỏ vì dropdown nằm ngoài trigger bounds).
  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])
  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setOpenHref(null), 120)
  }, [cancelClose])

  const openMenu = (href: string) => {
    cancelClose()
    setOpenHref(href)
  }

  // Tìm item đang mở để render children trong portal
  const openItem = openHref
    ? items.find((it) => it.href === openHref && it.children && it.children.length > 0)
    : undefined

  return (
    <nav
      aria-label={t("categoriesLabel")}
      /* `sticky top-0` — thanh pin đầu viewport khi scroll.
         `isolation-isolate`: tạo stacking context riêng để tránh bị content
         overlay trên một số trình duyệt mobile.
         `will-change: transform` hint cho GPU layer → giảm jitter iOS Safari
         khi URL bar collapse/expand lúc scroll.
         `bg-white pt-0.5 sm:pt-2` (Phase 3.7 round 4 — 2026-04): outer nav
         nền trắng khớp masthead. Mobile chừa 2px trắng (badge -top-0.5),
         desktop chừa 8px trắng (badge sm:-top-2) — đủ để badge "Demo" trên
         menu MXH nằm gọn trong vùng trắng nav, không bị viewport top cắt
         khi nav đang sticky-pinned.
         Brown strip + shadow-md được chuyển xuống inner div để effect đúng
         với phần menu (không phải vùng trắng padding). */
      className="sticky top-0 z-40 isolate bg-white will-change-transform pt-0.5 sm:pt-2"
    >
      <div className="bg-brand-700 text-white shadow-md">
      <div className="mx-auto max-w-7xl px-2 sm:px-4">
        {/* overflow-x-auto on mobile để scroll ngang; lg:overflow-visible để
            dropdown của "Giới thiệu" không bị clip trên desktop.
            `pt-0.5 sm:pt-0` (Phase 3.7 round 4): mobile có 2px padding-top
            để badge Demo (-top-0.5) khớp ngay ul-top (không bị overflow-y-hidden
            của ul cắt mất). Desktop reset về 0 vì badge ở vùng trắng nav
            (sm:pt-2) và ul:lg:overflow-visible đã không cắt.
            R-mobile-fix: dropdown đã chuyển sang portal (renders vào body),
            không còn phụ thuộc overflow của ul → mobile dropdown work. */}
        <ul ref={ulRef} className="category-scroll flex overflow-x-auto overflow-y-hidden whitespace-nowrap [touch-action:pan-x] pt-0.5 sm:pt-0 lg:overflow-visible">
          {items.map((item) => {
            const active = isItemActive(item, pathname)
            const hasChildren = !!(item.children && item.children.length > 0)
            const isOpen = openHref === item.href
            const triggerClass = [
              BASE_TRIGGER,
              active
                ? "bg-brand-900 text-white"
                : "text-white/95 hover:bg-brand-800",
              // Giữ highlight trên parent khi dropdown đang mở
              hasChildren && !active && isOpen ? "bg-brand-800" : "",
            ]
              .filter(Boolean)
              .join(" ")

            return hasChildren ? (
              <li
                key={item.href}
                className="relative"
                data-cb-trigger
                ref={(el) => {
                  triggerRefs.current[item.href] = el
                }}
                onMouseEnter={() => openMenu(item.href)}
                onMouseLeave={scheduleClose}
              >
                <Link
                  href={item.href}
                  className={triggerClass}
                  aria-haspopup="true"
                  aria-expanded={isOpen}
                  aria-current={active ? "page" : undefined}
                  target={item.openInNewTab ? "_blank" : undefined}
                  rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                  onClick={(e) => {
                    // First tap (touch hoặc mouse): mở dropdown thay vì navigate.
                    // Tap lần 2 trên parent (khi đã open) → navigate bình thường.
                    if (!isOpen) {
                      e.preventDefault()
                      openMenu(item.href)
                    }
                  }}
                >
                  {item.label}
                  <Chevron />
                </Link>
              </li>
            ) : (
              <li key={item.href} className="relative">
                <Link
                  href={item.href}
                  className={triggerClass}
                  aria-current={active ? "page" : undefined}
                  target={item.openInNewTab ? "_blank" : undefined}
                  rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                >
                  {item.label}
                </Link>
                {/* Phase 3.7 (2026-04): badge demo cho MXH Trầm Hương —
                    nhắc user tính năng đang ở giai đoạn beta. Dùng CSS
                    thuần thay vì PNG vì file demo_icon.png có pixel xung
                    quanh bubble là white-opaque (alpha=255) — bất kỳ blend
                    mode nào cũng phá readability của chữ DEMO trong bubble.
                    Phase 3.7 round 5 (2026-05): match qua menuKey thay vì
                    labelKey vì menu đã chuyển sang DB-driven. */}
                {item.menuKey === "feed" && (
                  <span
                    className="pointer-events-none absolute right-0.5 -top-0.5 inline-flex items-center justify-center rounded-md bg-red-600 px-1 py-px text-[8px] font-extrabold uppercase tracking-wide text-white shadow-md ring-1 ring-red-700/40 sm:right-1 sm:-top-2 sm:px-1.5 sm:py-0.5 sm:text-[10px] sm:tracking-wider"
                    title="Tính năng đang trong giai đoạn demo"
                  >
                    Demo
                  </span>
                )}
              </li>
            )
          })}

          {/* Auth CTA — chỉ hiện nút "Đăng nhập" cho guest, đẩy phải bằng
              ml-auto trên desktop. Nút "Đăng ký hội viên" đã chuyển hoàn toàn
              sang các nudge banner (hero, comment, floating badge) để menu
              gọn lại và CTA không lặp 2 chỗ. */}
          {!loggedIn && (
            <li className="lg:ml-auto">
              <Link
                href="/login"
                className="inline-flex items-center px-3.5 py-2.5 text-[13px] font-semibold uppercase tracking-wide text-white/95 border border-white/40 ml-2 transition-colors hover:bg-white/10"
              >
                {t("login")}
              </Link>
            </li>
          )}
        </ul>
      </div>
      </div>

      {/* Portal dropdown — render vào document.body để không bị overflow
          clipping của <ul> parent. Position: fixed với coords từ trigger's
          getBoundingClientRect → khớp đúng vị trí trigger, không phụ thuộc
          ancestor stacking context. */}
      {mounted && openItem && dropdownPos &&
        createPortal(
          <ul
            data-cb-dropdown
            role="menu"
            className="fixed z-50 min-w-[220px] bg-brand-800 shadow-lg"
            style={{ left: dropdownPos.left, top: dropdownPos.top }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            {openItem.children!.map((sub) => {
              const subActive = matchesPath(stripLocale(sub.href), pathname, sub.matchPrefixes ?? [])
              return (
                <li key={sub.href} role="none">
                  <Link
                    href={sub.href}
                    role="menuitem"
                    target={sub.openInNewTab ? "_blank" : undefined}
                    rel={sub.openInNewTab ? "noopener noreferrer" : undefined}
                    onClick={() => setOpenHref(null)}
                    className={[
                      "block px-4 py-2.5 text-[13px] font-medium uppercase tracking-wide transition-colors",
                      subActive
                        ? "bg-brand-900 text-white"
                        : "text-white/95 hover:bg-brand-900",
                    ].join(" ")}
                    aria-current={subActive ? "page" : undefined}
                  >
                    {sub.label}
                  </Link>
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </nav>
  )
}

function Chevron() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 opacity-70"
    >
      <path d="m3 4.5 3 3 3-3" />
    </svg>
  )
}
