"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link2, MessageSquare, Printer } from "lucide-react"

const ZOOM_SIZES = [14, 18, 22, 26] as const
const DEFAULT_ZOOM_INDEX = 1 // 18px — gần với prose-lg mặc định
// Base px ở desktop (xl+, nơi toolbar hiện) cho từng scalable element:
// H1 `.font-serif-headline` = 30px (lg:text-[30px]);
// Sapo `[data-article-lede]` = 17px (text-[17px]);
// Body `[data-article-body]` = ZOOM_SIZES[DEFAULT_ZOOM_INDEX] = 18px.
const H1_BASE_PX = 30
const LEDE_BASE_PX = 17

type Props = {
  articleUrl: string
  commentCount?: number
}

/**
 * Floating vertical toolbar sát mép trái article — kiểu VTV.
 * Chỉ hiện từ breakpoint `xl` (≥1280px); dưới đó dùng share bar cuối bài.
 *
 * Zoom scale lên 3 element: H1 (title), sapo, và body. Tính theo tỉ lệ so với
 * 18px (default) → áp inline `fontSize` trực tiếp cho từng element. Không đụng
 * byline/tags/share bar — chúng giữ size cố định.
 */
export function ArticleToolbar({ articleUrl, commentCount = 0 }: Props) {
  const [zoomIdx, setZoomIdx] = useState<number>(DEFAULT_ZOOM_INDEX)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Áp zoom lên H1 / sapo / body mỗi khi index thay đổi.
  useEffect(() => {
    const article = document.querySelector("article")
    if (!article) return
    const bodyPx = ZOOM_SIZES[zoomIdx]
    const scale = bodyPx / ZOOM_SIZES[DEFAULT_ZOOM_INDEX]

    const body = article.querySelector<HTMLElement>("[data-article-body]")
    const h1 = article.querySelector<HTMLElement>("h1.font-serif-headline")
    const lede = article.querySelector<HTMLElement>("[data-article-lede]")

    if (body) body.style.fontSize = `${bodyPx}px`
    if (h1) h1.style.fontSize = `${Math.round(H1_BASE_PX * scale)}px`
    if (lede) lede.style.fontSize = `${Math.round(LEDE_BASE_PX * scale)}px`
  }, [zoomIdx])

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const shareFacebook = useCallback(() => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=500",
    )
  }, [articleUrl])

  const shareZalo = useCallback(() => {
    window.open(
      `https://zalo.me/share?url=${encodeURIComponent(articleUrl)}`,
      "_blank",
      "noopener,noreferrer",
    )
  }, [articleUrl])

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(articleUrl)
      showToast("Đã sao chép đường dẫn")
    } catch {
      showToast("Không thể sao chép — vui lòng sao tay")
    }
  }, [articleUrl, showToast])

  const print = useCallback(() => window.print(), [])

  const onComment = useCallback(() => {
    showToast("Tính năng bình luận đang được phát triển")
  }, [showToast])

  const zoomIn = () => {
    setZoomIdx((i) => {
      const next = Math.min(ZOOM_SIZES.length - 1, i + 1)
      if (next === i) showToast("Đã đạt cỡ chữ lớn nhất")
      return next
    })
  }
  const zoomOut = () => {
    setZoomIdx((i) => {
      const next = Math.max(0, i - 1)
      if (next === i) showToast("Đã đạt cỡ chữ nhỏ nhất")
      return next
    })
  }

  return (
    <>
      <div
        className="hidden xl:block absolute top-0 right-full h-full pr-4"
        aria-label="Công cụ bài viết"
      >
        <div className="sticky top-24 flex flex-col items-center gap-2">
          <IconButton label="Chia sẻ Facebook" onClick={shareFacebook}>
            <FacebookIcon />
          </IconButton>

          <IconButton label="Chia sẻ Zalo" onClick={shareZalo}>
            <ZaloIcon />
          </IconButton>

          <IconButton label="Sao chép link" onClick={copyLink}>
            <Link2 size={16} />
          </IconButton>

          <IconButton label={`Bình luận (${commentCount})`} onClick={onComment}>
            <div className="flex flex-col items-center leading-none">
              <MessageSquare size={16} />
              <span className="mt-0.5 text-[10px] font-semibold text-neutral-500">
                {commentCount}
              </span>
            </div>
          </IconButton>

          <IconButton label="In bài" onClick={print}>
            <Printer size={16} />
          </IconButton>

          {/* Zoom cluster */}
          <div className="mt-2 flex flex-col items-center gap-1 rounded-full border border-neutral-200 bg-white py-1">
            <button
              type="button"
              onClick={zoomIn}
              aria-label="Tăng cỡ chữ"
              disabled={zoomIdx >= ZOOM_SIZES.length - 1}
              className="h-6 w-8 text-neutral-600 transition-colors hover:text-brand-700 disabled:cursor-not-allowed disabled:text-neutral-300"
            >
              +
            </button>
            <span
              className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
              title={`${ZOOM_SIZES[zoomIdx]}px`}
            >
              Aa
            </span>
            <button
              type="button"
              onClick={zoomOut}
              aria-label="Giảm cỡ chữ"
              disabled={zoomIdx <= 0}
              className="h-6 w-8 text-neutral-600 transition-colors hover:text-brand-700 disabled:cursor-not-allowed disabled:text-neutral-300"
            >
              −
            </button>
          </div>
        </div>
      </div>

      {/* Toast — centred fixed bottom, cross-viewport (mọi kích thước màn). */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 animate-[toast-in_160ms_ease-out] rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-brand-700 hover:text-brand-700"
    >
      {children}
    </button>
  )
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  )
}

function ZaloIcon() {
  return (
    <span aria-hidden="true" className="text-[11px] font-bold tracking-tighter">
      Zalo
    </span>
  )
}
