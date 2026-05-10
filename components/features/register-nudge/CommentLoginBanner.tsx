"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

/**
 * Banner gợi ý đăng ký hội viên — render thay text "Đăng nhập để bình luận"
 * khi guest xem bài có comment. Mục tiêu: đủ "đặc sắc" để user chú ý mà
 * không lấn át nội dung bài viết.
 *
 * Layout: 2 cột — left visual block (brand-700) + right content (cream).
 * Trên mobile chỉ giữ cột content (left block hidden) để gọn gàng.
 */
export function CommentLoginBanner() {
  const t = useTranslations("registerNudge")
  const locale = useLocale()

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-amber-300/60 bg-white shadow-md ring-1 ring-amber-900/5">
      <div className="flex flex-col sm:flex-row">
        {/* Visual block (desktop only) — brand emblem trong vòng tròn vàng */}
        <div className="hidden sm:flex relative w-32 shrink-0 items-center justify-center bg-linear-to-br from-brand-800 to-brand-900 p-4">
          {/* Subtle gold ring around emblem */}
          <div className="relative h-20 w-20 rounded-full bg-linear-to-br from-amber-300 to-amber-600 p-[2px] shadow-lg">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-brand-900">
              <span className="text-2xl">💬</span>
            </div>
          </div>
          {/* Decorative dots */}
          <span className="absolute top-3 right-3 h-1 w-1 rounded-full bg-amber-400" />
          <span className="absolute bottom-3 left-3 h-1 w-1 rounded-full bg-amber-400" />
        </div>

        {/* Content block */}
        <div className="relative flex-1 bg-linear-to-br from-amber-50/80 via-white to-amber-50/40 p-5 sm:p-6">
          <p className="text-[10px] tracking-[0.3em] text-amber-700 font-bold uppercase">
            ✦ Hội Trầm Hương Việt Nam ✦
          </p>
          <h3 className="mt-1.5 text-base sm:text-lg font-bold text-brand-900 leading-snug">
            {t("commentTitle")}
          </h3>
          <p className="mt-1.5 text-xs sm:text-sm text-brand-700 leading-relaxed">
            {t("commentText")}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href={`/${locale}/dang-ky`}
              className="group inline-flex items-center gap-1.5 rounded-lg bg-linear-to-br from-amber-600 to-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-amber-500 hover:to-amber-700 transition-all duration-200"
            >
              {t("commentRegisterCta")}
              <span className="inline-block transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <Link
              href={`/${locale}/login`}
              className="text-xs sm:text-sm text-brand-700 hover:text-brand-900 underline underline-offset-2 font-medium"
            >
              {t("commentLoginCta")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
