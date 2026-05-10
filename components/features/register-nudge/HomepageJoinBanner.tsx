import Link from "next/link"
import Image from "next/image"
import { auth } from "@/lib/auth"
import { getLocale, getTranslations } from "next-intl/server"

/**
 * Hero CTA banner gợi ý đăng ký hội viên — render trước footer trên trang chủ
 * cho user CHƯA đăng nhập. Server-render gate auth → user logged in không
 * thấy gì (không flash).
 *
 * Visual: dark brand-900 background + gold accents, paper-card center với
 * double border (đồng bộ ngôn ngữ thiết kế của giấy chứng nhận → cảm giác
 * "premium membership" thay vì banner quảng cáo thông thường).
 */
export async function HomepageJoinBanner() {
  const [session, t, locale] = await Promise.all([
    auth(),
    getTranslations("registerNudge"),
    getLocale(),
  ])

  if (session?.user) return null

  return (
    <section
      aria-label="Đăng ký hội viên"
      className="relative overflow-hidden bg-linear-to-br from-brand-900 via-brand-950 to-brand-900 py-16 sm:py-20"
    >
      {/* Decorative top/bottom gold lines */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-500/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-amber-500/60 to-transparent" />

      {/* Watermark logo — large, very faint, anti-counterfeit feel */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
        <Image
          src="/logo.png"
          alt=""
          width={520}
          height={520}
          className="h-[80%] w-auto"
        />
      </div>

      {/* Subtle radial glow accent */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Eyebrow with sparkles */}
        <p className="flex items-center justify-center gap-3 text-[11px] sm:text-xs tracking-[0.4em] font-bold text-amber-400 uppercase">
          <span aria-hidden>✦</span>
          {t("heroEyebrow")}
          <span aria-hidden>✦</span>
        </p>

        {/* Lead text */}
        <p className="mt-4 text-sm sm:text-base text-amber-50/80 leading-relaxed max-w-xl mx-auto">
          {t("heroText")}
        </p>

        {/* Benefits grid */}
        <ul className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4 text-left">
          {[t("heroBenefit1"), t("heroBenefit2"), t("heroBenefit3")].map(
            (benefit, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-lg bg-white/5 backdrop-blur-sm p-3 ring-1 ring-amber-500/20"
              >
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-brand-900 text-xs font-bold"
                >
                  ✓
                </span>
                <span className="text-xs sm:text-sm text-amber-50 leading-snug">
                  {benefit}
                </span>
              </li>
            ),
          )}
        </ul>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href={`/${locale}/dang-ky`}
            className="group inline-flex items-center gap-2 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 px-8 py-3.5 text-base sm:text-lg font-bold text-brand-950 shadow-xl shadow-amber-900/30 hover:shadow-2xl hover:shadow-amber-500/40 hover:scale-[1.03] transition-all duration-200"
          >
            {t("heroCta")}
            <span className="inline-block transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
          <Link
            href={`/${locale}/login`}
            className="text-xs sm:text-sm text-amber-200/80 hover:text-amber-100 underline underline-offset-4"
          >
            {t("heroLogin")}
          </Link>
        </div>
      </div>
    </section>
  )
}
