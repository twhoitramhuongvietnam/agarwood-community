"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useAdminReadOnly, READ_ONLY_TOOLTIP } from "@/components/features/admin/AdminReadOnlyContext"
import { LangTabsBar, computeHasContent, type Locale } from "@/components/ui/lang-tabs-bar"
import { UserPicker } from "./UserPicker"

const LANG_FIELDS = ["name", "title", "workTitle", "bio"] as const
type LangFieldName = (typeof LANG_FIELDS)[number]

function langKey(name: LangFieldName, locale: Locale): keyof FormData {
  return (locale === "vi" ? name : `${name}_${locale}`) as keyof FormData
}

type LeaderCategory = "BTV" | "BCH" | "BKT" | "HDTD"

type LinkedUser = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: string
  accountType: string
  isActive: boolean
  company: { name: string } | null
}

type Leader = {
  id: string
  name: string
  honorific: string | null
  title: string
  category: LeaderCategory
  workTitle: string | null
  bio: string | null
  photoUrl: string | null
  term: string
  sortOrder: number
  isActive: boolean
  userId: string | null
  user: LinkedUser | null
}

type FormData = {
  name: string
  name_en: string
  name_zh: string
  name_ar: string
  honorific: string
  title: string
  title_en: string
  title_zh: string
  title_ar: string
  category: LeaderCategory
  workTitle: string
  workTitle_en: string
  workTitle_zh: string
  workTitle_ar: string
  bio: string
  bio_en: string
  bio_zh: string
  bio_ar: string
  photoUrl: string
  term: string
  sortOrder: number
  userId: string | null
}

const EMPTY_FORM: FormData = {
  name: "",
  name_en: "",
  name_zh: "",
  name_ar: "",
  honorific: "Ông",
  title: "",
  title_en: "",
  title_zh: "",
  title_ar: "",
  category: "BCH",
  workTitle: "",
  workTitle_en: "",
  workTitle_zh: "",
  workTitle_ar: "",
  bio: "",
  bio_en: "",
  bio_zh: "",
  bio_ar: "",
  photoUrl: "",
  term: "",
  sortOrder: 0,
  userId: null,
}

const CATEGORY_LABELS: Record<LeaderCategory, string> = {
  BTV: "Ban Thường vụ",
  BKT: "Ban Kiểm tra",
  HDTD: "Hội đồng thẩm định",
  BCH: "UV Ban Chấp hành",
}

const CATEGORY_COLORS: Record<LeaderCategory, string> = {
  BTV: "bg-amber-100 text-amber-800",
  BKT: "bg-blue-100 text-blue-800",
  HDTD: "bg-emerald-100 text-emerald-800",
  BCH: "bg-brand-100 text-brand-700",
}

export function LeaderManager({
  initialLeaders,
  initialTerms,
}: {
  initialLeaders: Leader[]
  initialTerms: string[]
}) {
  const router = useRouter()
  const readOnly = useAdminReadOnly()
  const [leaders, setLeaders] = useState(initialLeaders)
  // Derive từ `leaders` (không snapshot cứng initialTerms) — nhiệm kỳ mới
  // gõ vào form "Nhiệm kỳ" hiện tag filter ngay sau khi lưu, không cần
  // reload cả trang (router.refresh() không remount client component nên
  // useState(initialTerms) trước đây bị stale).
  const terms = useMemo(
    () => Array.from(new Set(leaders.map((l) => l.term))),
    [leaders],
  )
  const [selectedTerm, setSelectedTerm] = useState(initialTerms[0] ?? "")
  const [filterCat, setFilterCat] = useState<LeaderCategory | "ALL">("ALL")
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  // Tách linkedUser khỏi `form` vì UserPicker cần full object (avatar, email…)
  // còn form.userId chỉ là string id để POST body. 2 state luôn được sync
  // qua handleLinkedUserChange.
  const [linkedUser, setLinkedUser] = useState<LinkedUser | null>(null)
  const [activeLocale, setActiveLocale] = useState<Locale>("vi")
  const [saving, setSaving] = useState(false)

  function handleLinkedUserChange(user: LinkedUser | null) {
    setLinkedUser(user)
    setForm((prev) => {
      if (!user) return { ...prev, userId: null }
      // Auto-fill name từ user nếu form.name đang trống — tiện cho flow
      // tạo mới. Không overwrite nếu admin đã gõ tên khác.
      const autoFillName = !prev.name.trim()
      return {
        ...prev,
        userId: user.id,
        ...(autoFillName && { name: user.name }),
      }
    })
  }

  function langValues(name: LangFieldName): { vi: string; en: string; zh: string; ar: string } {
    return {
      vi: (form[langKey(name, "vi")] as string) ?? "",
      en: (form[langKey(name, "en")] as string) ?? "",
      zh: (form[langKey(name, "zh")] as string) ?? "",
      ar: (form[langKey(name, "ar")] as string) ?? "",
    }
  }

  function setLangValue(name: LangFieldName, locale: Locale, value: string) {
    setForm((prev) => ({ ...prev, [langKey(name, locale)]: value }))
  }

  async function handleAiTranslate(target: Locale) {
    if (target === "vi") return
    const vi = Object.fromEntries(
      LANG_FIELDS.map((n) => [n, (form[langKey(n, "vi")] as string) ?? ""]),
    )
    if (!vi.name?.trim() && !vi.title?.trim() && !vi.bio?.trim()) {
      throw new Error("Vui lòng nhập họ tên / chức danh / tiểu sử tiếng Việt trước khi dịch.")
    }
    const res = await fetch("/api/admin/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: vi, targetLocale: target }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Lỗi khi dịch.")
    const tx = (data.fields ?? {}) as Record<string, string>
    setForm((prev) => {
      const next = { ...prev }
      for (const n of LANG_FIELDS) {
        if (tx[n]) next[langKey(n, target)] = tx[n] as FormData[keyof FormData] as never
      }
      return next
    })
  }

  const filtered = leaders
    .filter((l) => l.term === selectedTerm)
    .filter((l) => filterCat === "ALL" || l.category === filterCat)

  const countByCategory = (cat: LeaderCategory) =>
    leaders.filter((l) => l.term === selectedTerm && l.category === cat).length

  function startCreate() {
    setEditing("new")
    setForm({ ...EMPTY_FORM, term: selectedTerm })
    setLinkedUser(null)
  }

  function startEdit(leader: Leader) {
    setEditing(leader.id)
    setForm({
      name: leader.name,
      name_en: (leader as Record<string, unknown>).name_en as string ?? "",
      name_zh: (leader as Record<string, unknown>).name_zh as string ?? "",
      name_ar: (leader as Record<string, unknown>).name_ar as string ?? "",
      honorific: leader.honorific ?? "Ông",
      title: leader.title,
      title_en: (leader as Record<string, unknown>).title_en as string ?? "",
      title_zh: (leader as Record<string, unknown>).title_zh as string ?? "",
      title_ar: (leader as Record<string, unknown>).title_ar as string ?? "",
      category: leader.category,
      workTitle: leader.workTitle ?? "",
      workTitle_en: (leader as Record<string, unknown>).workTitle_en as string ?? "",
      workTitle_zh: (leader as Record<string, unknown>).workTitle_zh as string ?? "",
      workTitle_ar: (leader as Record<string, unknown>).workTitle_ar as string ?? "",
      bio: leader.bio ?? "",
      bio_en: (leader as Record<string, unknown>).bio_en as string ?? "",
      bio_zh: (leader as Record<string, unknown>).bio_zh as string ?? "",
      bio_ar: (leader as Record<string, unknown>).bio_ar as string ?? "",
      photoUrl: leader.photoUrl ?? "",
      term: leader.term,
      sortOrder: leader.sortOrder,
      userId: leader.userId,
    })
    setLinkedUser(leader.user)
  }

  function cancel() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setLinkedUser(null)
  }

  async function save() {
    if (!form.name.trim() || !form.title.trim() || !form.term.trim()) return
    setSaving(true)
    try {
      if (editing === "new") {
        const res = await fetch("/api/admin/leaders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error("Failed to create")
        const created = await res.json()
        setLeaders((prev) => [...prev, created])
        // Nhảy sang tab nhiệm kỳ vừa lưu — quan trọng khi admin gõ 1 nhiệm
        // kỳ mới chưa từng có, để thấy ngay thành viên vừa tạo.
        setSelectedTerm(created.term)
      } else {
        const res = await fetch(`/api/admin/leaders/${editing}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error("Failed to update")
        const updated = await res.json()
        setLeaders((prev) =>
          prev.map((l) => (l.id === updated.id ? updated : l)),
        )
        // Nếu admin đổi nhiệm kỳ của thành viên này, nhảy theo để không
        // có cảm giác thành viên "biến mất" khỏi tab đang xem.
        setSelectedTerm(updated.term)
      }
      cancel()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(leader: Leader) {
    const res = await fetch(`/api/admin/leaders/${leader.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !leader.isActive }),
    })
    if (!res.ok) return
    setLeaders((prev) =>
      prev.map((l) =>
        l.id === leader.id ? { ...l, isActive: !l.isActive } : l,
      ),
    )
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm("Xóa thành viên này khỏi ban lãnh đạo?")) return
    const res = await fetch(`/api/admin/leaders/${id}`, { method: "DELETE" })
    if (!res.ok) return
    setLeaders((prev) => prev.filter((l) => l.id !== id))
    router.refresh()
  }

  // ── Form JSX được dùng chung cho cả "tạo mới" (đầu trang) và "sửa" (inline) ──
  function renderForm() {
    return (
      <div className="rounded-xl border border-brand-300 bg-brand-50 p-5 space-y-4">
        <h3 className="font-semibold text-foreground">
          {editing === "new" ? "Thêm thành viên mới" : "Chỉnh sửa"}
        </h3>

        <LangTabsBar
          activeLocale={activeLocale}
          onLocaleChange={setActiveLocale}
          hasContent={computeHasContent(
            langValues("name"),
            langValues("title"),
            langValues("workTitle"),
            langValues("bio"),
          )}
          disabled={readOnly}
          onAiTranslate={handleAiTranslate}
          helperText={
            activeLocale === "vi"
              ? "Nhập thông tin tiếng Việt trước. Dùng AI dịch khi sang EN / 中文 để dịch cả 4 trường (họ tên, chức danh, chức vụ công tác, tiểu sử)."
              : undefined
          }
        />

        {/* Link hội viên — ưu tiên đặt trên cùng vì đây là quan hệ quan trọng
            nhất. Link rồi thì system tự match Leader ↔ CommitteeMembership. */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Link hội viên (tuỳ chọn)
          </label>
          <UserPicker
            value={linkedUser}
            onChange={handleLinkedUserChange}
            disabled={readOnly}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Xưng hô
            </label>
            <select
              value={form.honorific}
              onChange={(e) => setForm({ ...form, honorific: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="Ông">Ông</option>
              <option value="Bà">Bà</option>
              <option value="">(Không hiển thị)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Họ tên {activeLocale === "vi" && "*"}
            </label>
            <input
              type="text"
              value={langValues("name")[activeLocale]}
              onChange={(e) => setLangValue("name", activeLocale, e.target.value)}
              placeholder={activeLocale === "vi" ? "VD: Phạm Văn Du" : "Translated name"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Chức danh trong Hội {activeLocale === "vi" && "*"}
            </label>
            <input
              type="text"
              value={langValues("title")[activeLocale]}
              onChange={(e) => setLangValue("title", activeLocale, e.target.value)}
              placeholder={activeLocale === "vi" ? "VD: Chủ tịch, Phó Chủ tịch..." : "Translated title"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Nhóm *
            </label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as LeaderCategory })
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="BTV">Ban Thường vụ</option>
              <option value="BKT">Ban Kiểm tra</option>
              <option value="HDTD">Hội đồng thẩm định</option>
              <option value="BCH">UV Ban Chấp hành</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Thứ tự hiển thị
            </label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Chức vụ đơn vị công tác
            </label>
            <input
              type="text"
              value={langValues("workTitle")[activeLocale]}
              onChange={(e) => setLangValue("workTitle", activeLocale, e.target.value)}
              placeholder={activeLocale === "vi" ? "VD: Giám đốc Công ty TNHH..." : "Translated work title"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Nhiệm kỳ *
            </label>
            <input
              type="text"
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="VD: Nhiệm kỳ III (2023–2028)"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              URL ảnh đại diện
            </label>
            <input
              type="text"
              value={form.photoUrl}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Tiểu sử
            </label>
            <textarea
              value={langValues("bio")[activeLocale]}
              onChange={(e) => setLangValue("bio", activeLocale, e.target.value)}
              rows={3}
              placeholder={activeLocale === "vi" ? "Mô tả ngắn về vai trò, kinh nghiệm..." : "Translated bio"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={saving || readOnly}
            title={readOnly ? READ_ONLY_TOOLTIP : undefined}
            className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
          <button
            type="button"
            onClick={cancel}
            className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Hủy
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Term selector + Add button */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-foreground">
          Nhiệm kỳ:
        </label>
        <div className="flex flex-wrap gap-2">
          {terms.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setSelectedTerm(t)
                setFilterCat("ALL")
                cancel()
              }}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                t === selectedTerm
                  ? "border-brand-500 bg-brand-700 text-white"
                  : "border-border bg-card text-foreground hover:bg-accent",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={readOnly}
          title={readOnly ? READ_ONLY_TOOLTIP : undefined}
          className="ml-auto rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50 transition-colors"
        >
          + Thêm thành viên
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "ALL" as const, label: "Tất cả" },
            { key: "BTV" as const, label: "Ban Thường vụ" },
            { key: "BKT" as const, label: "Ban Kiểm tra" },
            { key: "HDTD" as const, label: "Hội đồng thẩm định" },
            { key: "BCH" as const, label: "UV Ban Chấp hành" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilterCat(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filterCat === key
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {label}
            {key !== "ALL" && (
              <span className="ml-1 opacity-60">
                ({countByCategory(key)})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Form inline tạo mới — chỉ hiển thị ở đầu trang */}
      {editing === "new" && renderForm()}

      {/* Leaders list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Chưa có thành viên nào
          {filterCat !== "ALL" && ` trong ${CATEGORY_LABELS[filterCat]}`}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((leader) =>
              editing === leader.id ? (
                <div key={leader.id}>{renderForm()}</div>
              ) : (
              <div
                key={leader.id}
                className={cn(
                  "flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors",
                  leader.isActive
                    ? "border-border"
                    : "border-border opacity-50",
                )}
              >
                {/* Photo */}
                <div className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden bg-brand-100">
                  {leader.photoUrl ? (
                    <Image
                      src={leader.photoUrl}
                      alt={leader.name}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-brand-700 text-white font-bold text-xs">
                      {leader.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(-2)
                        .join("")}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground text-sm">
                      {leader.name}
                    </h3>
                    <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                      {leader.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        CATEGORY_COLORS[leader.category],
                      )}
                    >
                      {CATEGORY_LABELS[leader.category]}
                    </span>
                    {leader.userId ? (
                      <span
                        className="shrink-0 inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-medium text-sky-700"
                        title={
                          leader.user
                            ? `Linked với ${leader.user.name} <${leader.user.email}>`
                            : "Đã link hội viên"
                        }
                      >
                        🔗 {leader.user?.name ?? "Linked"}
                      </span>
                    ) : (
                      <span
                        className="shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                        title="Chưa link hội viên — Leader này sẽ không hiện badge 'Có profile' ở tab Theo ban"
                      >
                        ⚠ Chưa link
                      </span>
                    )}
                    {!leader.isActive && (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Ẩn
                      </span>
                    )}
                  </div>
                  {leader.workTitle && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {leader.workTitle}
                    </p>
                  )}
                  {leader.bio && (
                    <p className="mt-1 text-xs text-brand-600 line-clamp-2 leading-relaxed">
                      {leader.bio}
                    </p>
                  )}
                </div>

                {/* Sort order */}
                <span className="shrink-0 text-xs text-muted-foreground">
                  #{leader.sortOrder}
                </span>

                {/* Actions */}
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(leader)}
                    disabled={readOnly}
                    title={readOnly ? READ_ONLY_TOOLTIP : undefined}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 transition-colors"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(leader)}
                    disabled={readOnly}
                    title={readOnly ? READ_ONLY_TOOLTIP : undefined}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
                  >
                    {leader.isActive ? "Ẩn" : "Hiện"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(leader.id)}
                    disabled={readOnly}
                    title={readOnly ? READ_ONLY_TOOLTIP : undefined}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
