"use client"

import { useMemo, useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { X } from "lucide-react"

// V2-styled leadership tabs — visual khác với LeadershipTabs cũ.
// Logic phân cấp giống nhau (chairman/vice/member infer từ titleVi).
// CSS được scope bởi class .gtv2-page ở wrapper page.tsx.

export type LeaderItem = {
  id: string
  name: string
  honorific: string | null
  title: string
  titleVi: string
  workTitle: string | null
  bio: string | null
  photoUrl: string | null
  term: string
  category: "BTV" | "BCH" | "BKT" | "HDTD"
}

type TabKey = "BTV" | "BCH" | "BKT" | "HDTD"

function useTabLabels(): Record<TabKey, string> {
  const t = useTranslations("about")
  return {
    BTV: t("tabBTV"),
    BCH: t("tabBCH"),
    BKT: t("tabBKT"),
    HDTD: t("tabHDTD"),
  }
}

function rankFromTitle(title: string): "chairman" | "vice" | "member" {
  const t = title.toLowerCase()
  if (/^chủ tịch\b/.test(t)) return "chairman"
  if (/phó chủ tịch/.test(t)) return "vice"
  return "member"
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

function LeaderCard({
  leader,
  featured = false,
  onClick,
}: {
  leader: LeaderItem
  featured?: boolean
  onClick: () => void
}) {
  const initials = getInitials(leader.name)
  return (
    <button
      type="button"
      className={`leader-card${featured ? " featured" : ""}`}
      onClick={onClick}
    >
      <div className="leader-photo">
        {leader.photoUrl ? (
          <img
            src={leader.photoUrl}
            alt={leader.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initials
        )}
      </div>
      <div className="leader-info">
        {leader.honorific && (
          <div className="leader-honorific">{leader.honorific}</div>
        )}
        <div className="leader-name">{leader.name}</div>
        <div className="leader-title">{leader.title}</div>
      </div>
    </button>
  )
}

function LeaderModal({ leader, onClose }: { leader: LeaderItem; onClose: () => void }) {
  const t = useTranslations("about")
  const tabLabels = useTabLabels()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(26, 16, 8, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "720px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--white)",
          borderRadius: "4px",
          boxShadow: "0 30px 60px -20px rgba(26, 16, 8, 0.45)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("closeBtn")}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            zIndex: 10,
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "var(--white)",
            border: "1px solid var(--brown-200)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={20} />
        </button>

        <div className="leader-modal-grid">
          <div
            className="leader-modal-photo"
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4 / 5",
              borderRadius: "4px",
              overflow: "hidden",
              background: "linear-gradient(135deg, var(--brown-700), var(--brown-900))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cream)",
              fontFamily: "'Merriweather', serif",
              fontSize: "2.5rem",
              fontWeight: 700,
            }}
          >
            {leader.photoUrl ? (
              <img
                src={leader.photoUrl}
                alt={leader.name}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              getInitials(leader.name)
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                fontWeight: 600,
                color: "var(--gold-deep)",
              }}
            >
              {tabLabels[leader.category]} · {leader.term}
            </div>
            <h3
              style={{
                marginTop: "0.5rem",
                fontFamily: "'Merriweather', serif",
                fontSize: "clamp(1.5rem, 3vw, 2rem)",
                fontWeight: 700,
                color: "var(--brown-900)",
                lineHeight: 1.2,
              }}
            >
              {leader.honorific ? `${leader.honorific} ` : ""}
              {leader.name}
            </h3>
            <p style={{ marginTop: "0.5rem", color: "var(--gold-deep)", fontWeight: 600 }}>
              {leader.title}
            </p>
            {leader.workTitle && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--brown-600)" }}>
                {leader.workTitle}
              </p>
            )}
            {leader.bio && (
              <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--brown-100)" }}>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    fontWeight: 600,
                    color: "var(--brown-500)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {t("bioLabel")}
                </div>
                <p
                  style={{
                    color: "var(--brown-800)",
                    lineHeight: 1.7,
                    fontSize: "0.9375rem",
                    whiteSpace: "pre-line",
                  }}
                >
                  {leader.bio}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function LeadershipTabsV2({ leaders }: { leaders: LeaderItem[] }) {
  const t = useTranslations("about")
  const tabLabels = useTabLabels()
  const availableTabs = useMemo<TabKey[]>(() => {
    const all = new Set(leaders.map((l) => l.category))
    return (["BTV", "BCH", "BKT", "HDTD"] as TabKey[]).filter((cat) => all.has(cat))
  }, [leaders])

  const [activeTab, setActiveTab] = useState<TabKey>(availableTabs[0] ?? "BTV")
  const [selected, setSelected] = useState<LeaderItem | null>(null)

  const currentLeaders = useMemo(
    () => leaders.filter((l) => l.category === activeTab),
    [leaders, activeTab],
  )

  const chairman = currentLeaders.find((l) => rankFromTitle(l.titleVi) === "chairman")
  const vicePresidents = currentLeaders.filter((l) => rankFromTitle(l.titleVi) === "vice")
  const memberLeaders = currentLeaders.filter((l) => rankFromTitle(l.titleVi) === "member")
  const currentTerm = currentLeaders[0]?.term ?? null

  const tabCounts: Record<TabKey, number> = {
    BTV: leaders.filter((l) => l.category === "BTV").length,
    BCH: leaders.filter((l) => l.category === "BCH").length,
    BKT: leaders.filter((l) => l.category === "BKT").length,
    HDTD: leaders.filter((l) => l.category === "HDTD").length,
  }

  if (availableTabs.length === 0) {
    return (
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--brown-100)",
          padding: "3rem",
          textAlign: "center",
          color: "var(--brown-500)",
          fontStyle: "italic",
          maxWidth: "720px",
          margin: "0 auto",
        }}
      >
        {t("noLeaders")}
      </div>
    )
  }

  return (
    <>
      <div className="tabs reveal">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab${tab === activeTab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tabLabels[tab]} <span className="tab-count">({tabCounts[tab]})</span>
          </button>
        ))}
      </div>

      {/* Không dùng class "reveal" trong các khối bên dưới: IntersectionObserver
          ở HeroAnimations.tsx chỉ quét DOM 1 lần lúc mount trang. Các khối này
          unmount/remount mỗi khi đổi tab (vd tab không có ai giữ chức Chủ tịch
          thì chairman-row biến mất rồi tạo lại) → phần tử mới tạo sau không
          còn ai observe → kẹt vĩnh viễn ở opacity:0 (class .reveal mặc định),
          nhìn như khoảng trống sau khi bấm đổi tab vài lần. */}
      {currentTerm && <div className="term-label">{currentTerm}</div>}

      {chairman && (
        <div className="chairman-row">
          <LeaderCard leader={chairman} featured onClick={() => setSelected(chairman)} />
        </div>
      )}

      {vicePresidents.length > 0 && (
        <div className="leader-grid">
          {vicePresidents.map((l) => (
            <LeaderCard key={l.id} leader={l} onClick={() => setSelected(l)} />
          ))}
        </div>
      )}

      {memberLeaders.length > 0 && (
        <>
          {(chairman || vicePresidents.length > 0) && (
            <div className="leader-divider">
              {activeTab === "BTV" ? t("dividerStanding") : t("dividerOther")}
            </div>
          )}
          <div className="leader-grid">
            {memberLeaders.map((l) => (
              <LeaderCard key={l.id} leader={l} onClick={() => setSelected(l)} />
            ))}
          </div>
        </>
      )}

      {selected && <LeaderModal leader={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
