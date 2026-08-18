"use client"

import Link from "next/link"
import { useDeferredValue, useMemo, useState } from "react"
import { useTranslations } from "next-intl"

// Members scroll + search — render TẤT CẢ hội viên trong server-side fetch,
// scope 600px scroll container chống section mở rộng. Search là client-side
// filter (in-memory), không gọi API → instant feedback. Khi pool data lớn
// (1000+ items), có thể switch sang server search qua API endpoint.

export type MemberItem = {
  id: string
  name: string
  avatarUrl: string | null
  companyName: string | null
  position: string | null
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(-2)
    .join("")
    .toUpperCase()
}

/**
 * Normalize Vietnamese text cho search:
 *   - lowercase
 *   - NFD decompose → strip combining diacritic marks (̀-ͯ)
 *   - đ/Đ → d (NFD không decompose đ → cần handle riêng)
 *   - trim
 *
 * Cho phép user gõ "pham", "tram", "dang" tìm được "Phạm", "Trầm", "Đặng".
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .trim()
}

export function MembersScrollV2({
  members,
  totalCount,
}: {
  members: MemberItem[]
  totalCount: number
}) {
  const t = useTranslations("about")
  const [query, setQuery] = useState("")
  // useDeferredValue: với pool nhỏ (~65) thì instant; nhưng chuẩn bị scale
  // — khi gõ nhanh, React có thể bỏ qua frames trung gian, chỉ commit final
  // input value (smooth typing trên list lớn).
  const deferredQuery = useDeferredValue(query)

  const normalizedQuery = useMemo(() => normalize(deferredQuery), [deferredQuery])

  // Pre-compute haystack mỗi member 1 lần (khi members thay đổi), tránh
  // re-normalize trên mỗi keystroke. Cache theo id để stable identity.
  const memberHaystacks = useMemo(
    () =>
      members.map((m) => ({
        member: m,
        haystack: normalize(
          [m.name, m.companyName ?? "", m.position ?? ""].join(" "),
        ),
      })),
    [members],
  )

  const filtered = useMemo(() => {
    if (!normalizedQuery) return members
    return memberHaystacks
      .filter(({ haystack }) => haystack.includes(normalizedQuery))
      .map(({ member }) => member)
  }, [normalizedQuery, memberHaystacks, members])

  const isSearching = normalizedQuery.length > 0
  const resultCount = filtered.length

  if (members.length === 0) {
    return (
      <div
        className="members-sentinel"
        data-done="true"
        style={{ maxWidth: "600px", margin: "0 auto" }}
      >
        <span className="loader-text">{t("noVipMembers")}</span>
      </div>
    )
  }

  return (
    <>
      <div className="members-toolbar reveal">
        <input
          type="search"
          className="members-search"
          placeholder={t("memberSearchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("memberSearchAriaLabel")}
        />
      </div>

      <div className="members-scroll">
        {filtered.length > 0 ? (
          // Không dùng "reveal": khối này unmount/remount theo kết quả tìm
          // kiếm (filtered.length chuyển 0 ↔ >0) — reveal-on-scroll IO chỉ
          // quét DOM 1 lần lúc mount trang nên bản remount sau sẽ kẹt
          // opacity:0 vĩnh viễn. Xem thêm ghi chú tương tự ở LeadershipTabsV2.
          <div className="members-grid">
            {filtered.map((m, i) => (
              <Link
                key={m.id}
                href={`/hoi-vien/${m.id}`}
                className="member"
                style={{ ["--i" as string]: i % 6 }}
              >
                <div className="member-avatar">
                  {m.avatarUrl ? (
                    <img
                      src={m.avatarUrl}
                      alt={m.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    getInitials(m.name)
                  )}
                </div>
                <div className="member-info">
                  <div className="member-name">{m.name}</div>
                  {m.position && <div className="member-position">{m.position}</div>}
                  {m.companyName && <div className="member-company">{m.companyName}</div>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: "3rem 1rem",
              textAlign: "center",
              color: "var(--brown-500)",
              fontStyle: "italic",
            }}
          >
            {t("memberNoMatch")} &ldquo;{deferredQuery}&rdquo;
          </div>
        )}

        <div className="members-sentinel" data-done="true">
          <span className="loader-dot">✦</span>
          <span className="loader-text">
            {isSearching ? (
              resultCount > 0 ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html:
                      resultCount < totalCount
                        ? t.markup("memberSearchResultsInTotal", {
                            count: resultCount,
                            total: totalCount,
                            strong: (chunks) => `<strong>${chunks}</strong>`,
                          })
                        : t.markup("memberSearchResults", {
                            count: resultCount,
                            strong: (chunks) => `<strong>${chunks}</strong>`,
                          }),
                  }}
                />
              ) : (
                t("memberSearchNoResult")
              )
            ) : (
              <span
                dangerouslySetInnerHTML={{
                  __html: t.markup("memberShowingAll", {
                    total: totalCount,
                    strong: (chunks) => `<strong>${chunks}</strong>`,
                  }),
                }}
              />
            )}
          </span>
        </div>
      </div>
    </>
  )
}
