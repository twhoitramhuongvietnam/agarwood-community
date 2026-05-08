"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Search, X } from "lucide-react"
import { DirectoryCard, type CompanyCardData } from "./DirectoryCard"

/**
 * Client-side filter cho danh bạ doanh nghiệp. Dataset ~30 DN nên
 * `name + address`.toLowerCase().includes() là đủ instant — không cần debounce
 * hoặc fetch server.
 *
 * Hidden cards qua CSS class `hidden` (display:none) thay vì unmount để
 * stagger animation chỉ chạy 1 lần ở mount đầu — user clear/đổi query không
 * gây "wave" re-animate gây jitter.
 */
export function DirectorySearch({
  cards,
  spotlightIds,
  isAdmin,
  visitWebsiteLabel,
  eyebrowLabel,
  titleLabel,
}: {
  cards: CompanyCardData[]
  /** ID các DN đã hiển thị ở spotlight phía trên — ẩn khỏi grid khi không có
   *  query để tránh duplicate, nhưng vẫn cho match khi user search. */
  spotlightIds?: string[]
  isAdmin: boolean
  visitWebsiteLabel: string
  /** Section header — server truyền xuống để admin CMS override được. */
  eyebrowLabel: string
  titleLabel: string
}) {
  const t = useTranslations("companies")
  const [query, setQuery] = useState("")
  const cardLabels = {
    visitWebsite: visitWebsiteLabel,
    featuredBadge: t("featuredBadge"),
    verified: t("verified"),
    viewDetails: t("viewDetails"),
    certBadge: (count: number) => t("cardCertBadge", { count }),
    foundedSince: (year: number) => t("foundedSince", { year }),
  }
  const spotlightSet = useMemo(
    () => new Set(spotlightIds ?? []),
    [spotlightIds],
  )

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Default view: ẩn các DN đang ở spotlight (đã render trên đầu).
      return new Set(
        cards.filter((c) => !spotlightSet.has(c.id)).map((c) => c.id),
      )
    }
    return new Set(
      cards
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.address.toLowerCase().includes(q),
        )
        .map((c) => c.id),
    )
  }, [cards, query, spotlightSet])

  const visibleCount = matches.size
  const hasQuery = query.trim().length > 0

  return (
    <>
      {/* Title row — title trái, search bar phải. Mobile stack dọc. */}
      <div className="mb-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-700">
            <span className="h-px w-10 bg-brand-700/40" />
            {eyebrowLabel}
          </p>
          <h2 className="font-serif-headline mt-2 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            {titleLabel}
          </h2>
        </div>

        {/* Search bar — pill input, full-width mobile, max-w-xs desktop */}
        <div className="relative w-full sm:w-72 sm:shrink-0">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("directorySearchPlaceholder")}
            aria-label={t("directorySearchAriaLabel")}
            className="w-full rounded-full border border-brand-300 bg-white py-2.5 pl-10 pr-10 text-sm text-brand-900 placeholder:text-brand-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("directoryClearSearch")}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-brand-400 transition-colors hover:bg-brand-100 hover:text-brand-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Empty: không có DN nào trong danh bạ (server data rỗng) */}
      {cards.length === 0 && (
        <p className="py-10 text-center text-brand-500">
          {t("directoryEmpty")}
        </p>
      )}

      {/* Empty: search miss */}
      {cards.length > 0 && hasQuery && visibleCount === 0 && (
        <div className="py-10 text-center">
          <p className="text-brand-500">
            {t("directoryNoMatch")}{" "}
            <span className="font-semibold text-brand-900">&ldquo;{query}&rdquo;</span>.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 text-sm font-semibold text-brand-700 underline hover:text-brand-900"
          >
            {t("directoryViewAll")}
          </button>
        </div>
      )}

      {/* Grid — luôn render đầy đủ cards, ẩn cái không match qua `hidden` */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <DirectoryCard
            key={c.id}
            card={c}
            isAdmin={isAdmin}
            visitWebsiteLabel={visitWebsiteLabel}
            labels={cardLabels}
            index={i}
            hidden={!matches.has(c.id)}
          />
        ))}
      </div>

      {/* Counter — chỉ hiện khi đang filter để thông báo còn lại bao nhiêu */}
      {hasQuery && visibleCount > 0 && (
        <p className="mt-6 text-center text-xs text-brand-500 tabular-nums">
          {t("directoryShowingCount", { visible: visibleCount, total: cards.length })}
        </p>
      )}
    </>
  )
}
