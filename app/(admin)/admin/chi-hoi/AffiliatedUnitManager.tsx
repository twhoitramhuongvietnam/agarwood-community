"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAdminReadOnly, READ_ONLY_TOOLTIP } from "@/components/features/admin/AdminReadOnlyContext"
import { LangTabsBar, computeHasContent, type Locale } from "@/components/ui/lang-tabs-bar"

type UnitType = "CHI_HOI" | "BAN"

type Member = {
  id: string
  name: string
  name_en: string | null
  name_zh: string | null
  name_ar: string | null
  title: string
  title_en: string | null
  title_zh: string | null
  title_ar: string | null
  sortOrder: number
}

type Unit = {
  id: string
  type: UnitType
  name: string
  name_en: string | null
  name_zh: string | null
  name_ar: string | null
  description: string | null
  description_en: string | null
  description_zh: string | null
  description_ar: string | null
  sortOrder: number
  isActive: boolean
  members: Member[]
}

type UnitFormData = {
  type: UnitType
  name: string
  name_en: string
  name_zh: string
  name_ar: string
  description: string
  description_en: string
  description_zh: string
  description_ar: string
  sortOrder: number
}

type MemberFormData = {
  name: string
  name_en: string
  name_zh: string
  name_ar: string
  title: string
  title_en: string
  title_zh: string
  title_ar: string
  sortOrder: number
}

const EMPTY_UNIT_FORM: UnitFormData = {
  type: "CHI_HOI",
  name: "",
  name_en: "",
  name_zh: "",
  name_ar: "",
  description: "",
  description_en: "",
  description_zh: "",
  description_ar: "",
  sortOrder: 0,
}

const EMPTY_MEMBER_FORM: MemberFormData = {
  name: "",
  name_en: "",
  name_zh: "",
  name_ar: "",
  title: "",
  title_en: "",
  title_zh: "",
  title_ar: "",
  sortOrder: 0,
}

const TYPE_LABELS: Record<UnitType, string> = {
  CHI_HOI: "Chi hội",
  BAN: "Ban trực thuộc",
}

const TYPE_COLORS: Record<UnitType, string> = {
  CHI_HOI: "bg-emerald-100 text-emerald-800",
  BAN: "bg-brand-100 text-brand-700",
}

function unitLangKey(name: "name" | "description", locale: Locale): keyof UnitFormData {
  return (locale === "vi" ? name : `${name}_${locale}`) as keyof UnitFormData
}

function memberLangKey(name: "name" | "title", locale: Locale): keyof MemberFormData {
  return (locale === "vi" ? name : `${name}_${locale}`) as keyof MemberFormData
}

async function aiTranslateFields(
  fields: Record<string, string>,
  target: Locale,
): Promise<Record<string, string>> {
  const res = await fetch("/api/admin/ai/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields, targetLocale: target }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Lỗi khi dịch.")
  return (data.fields ?? {}) as Record<string, string>
}

export function AffiliatedUnitManager({ initialUnits }: { initialUnits: Unit[] }) {
  const router = useRouter()
  const readOnly = useAdminReadOnly()
  const [units, setUnits] = useState(initialUnits)
  const [filterType, setFilterType] = useState<UnitType | "ALL">("ALL")
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialUnits.map((u) => u.id)),
  )
  const [saving, setSaving] = useState(false)

  // ── Unit form state ──
  const [editingUnit, setEditingUnit] = useState<string | null>(null)
  const [unitForm, setUnitForm] = useState<UnitFormData>(EMPTY_UNIT_FORM)
  const [unitLocale, setUnitLocale] = useState<Locale>("vi")

  // ── Member form state (scoped tới 1 unit tại 1 thời điểm) ──
  const [memberUnitId, setMemberUnitId] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<string | null>(null) // "new" | memberId
  const [memberForm, setMemberForm] = useState<MemberFormData>(EMPTY_MEMBER_FORM)
  const [memberLocale, setMemberLocale] = useState<Locale>("vi")

  function toggleExpanded(unitId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(unitId)) next.delete(unitId)
      else next.add(unitId)
      return next
    })
  }

  const filtered = units.filter((u) => filterType === "ALL" || u.type === filterType)
  const countByType = (t: UnitType) => units.filter((u) => u.type === t).length

  // ── Unit CRUD ──
  function startCreateUnit() {
    setEditingUnit("new")
    setUnitForm({ ...EMPTY_UNIT_FORM, type: filterType === "BAN" ? "BAN" : "CHI_HOI" })
    setUnitLocale("vi")
  }

  function startEditUnit(u: Unit) {
    setEditingUnit(u.id)
    setUnitForm({
      type: u.type,
      name: u.name,
      name_en: u.name_en ?? "",
      name_zh: u.name_zh ?? "",
      name_ar: u.name_ar ?? "",
      description: u.description ?? "",
      description_en: u.description_en ?? "",
      description_zh: u.description_zh ?? "",
      description_ar: u.description_ar ?? "",
      sortOrder: u.sortOrder,
    })
    setUnitLocale("vi")
  }

  function cancelUnit() {
    setEditingUnit(null)
    setUnitForm(EMPTY_UNIT_FORM)
  }

  async function handleUnitAiTranslate(target: Locale) {
    if (target === "vi") return
    const vi = { name: unitForm.name, description: unitForm.description }
    if (!vi.name.trim() && !vi.description.trim()) {
      throw new Error("Vui lòng nhập tên / mô tả tiếng Việt trước khi dịch.")
    }
    const tx = await aiTranslateFields(vi, target)
    setUnitForm((prev) => ({
      ...prev,
      ...(tx.name && { [unitLangKey("name", target)]: tx.name }),
      ...(tx.description && { [unitLangKey("description", target)]: tx.description }),
    }))
  }

  async function saveUnit() {
    if (!unitForm.name.trim()) return
    setSaving(true)
    try {
      if (editingUnit === "new") {
        const res = await fetch("/api/admin/affiliated-units", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(unitForm),
        })
        if (!res.ok) throw new Error("Failed to create")
        const created: Unit = await res.json()
        setUnits((prev) => [...prev, created])
        setExpanded((prev) => new Set(prev).add(created.id))
      } else if (editingUnit) {
        const res = await fetch(`/api/admin/affiliated-units/${editingUnit}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(unitForm),
        })
        if (!res.ok) throw new Error("Failed to update")
        const updated: Unit = await res.json()
        setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      }
      cancelUnit()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function toggleUnitActive(u: Unit) {
    const res = await fetch(`/api/admin/affiliated-units/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    })
    if (!res.ok) return
    setUnits((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, isActive: !x.isActive } : x)),
    )
    router.refresh()
  }

  async function removeUnit(id: string) {
    if (!confirm("Xóa đơn vị này và toàn bộ thành viên trong đó?")) return
    const res = await fetch(`/api/admin/affiliated-units/${id}`, { method: "DELETE" })
    if (!res.ok) return
    setUnits((prev) => prev.filter((u) => u.id !== id))
    router.refresh()
  }

  // ── Member CRUD ──
  function startCreateMember(unitId: string) {
    setMemberUnitId(unitId)
    setEditingMember("new")
    setMemberForm(EMPTY_MEMBER_FORM)
    setMemberLocale("vi")
  }

  function startEditMember(unitId: string, m: Member) {
    setMemberUnitId(unitId)
    setEditingMember(m.id)
    setMemberForm({
      name: m.name,
      name_en: m.name_en ?? "",
      name_zh: m.name_zh ?? "",
      name_ar: m.name_ar ?? "",
      title: m.title,
      title_en: m.title_en ?? "",
      title_zh: m.title_zh ?? "",
      title_ar: m.title_ar ?? "",
      sortOrder: m.sortOrder,
    })
    setMemberLocale("vi")
  }

  function cancelMember() {
    setMemberUnitId(null)
    setEditingMember(null)
    setMemberForm(EMPTY_MEMBER_FORM)
  }

  async function handleMemberAiTranslate(target: Locale) {
    if (target === "vi") return
    const vi = { name: memberForm.name, title: memberForm.title }
    if (!vi.name.trim() && !vi.title.trim()) {
      throw new Error("Vui lòng nhập họ tên / chức vụ tiếng Việt trước khi dịch.")
    }
    const tx = await aiTranslateFields(vi, target)
    setMemberForm((prev) => ({
      ...prev,
      ...(tx.name && { [memberLangKey("name", target)]: tx.name }),
      ...(tx.title && { [memberLangKey("title", target)]: tx.title }),
    }))
  }

  async function saveMember() {
    if (!memberUnitId || !memberForm.name.trim() || !memberForm.title.trim()) return
    setSaving(true)
    try {
      if (editingMember === "new") {
        const res = await fetch(`/api/admin/affiliated-units/${memberUnitId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(memberForm),
        })
        if (!res.ok) throw new Error("Failed to create")
        const created: Member = await res.json()
        setUnits((prev) =>
          prev.map((u) =>
            u.id === memberUnitId ? { ...u, members: [...u.members, created] } : u,
          ),
        )
      } else if (editingMember) {
        const res = await fetch(
          `/api/admin/affiliated-units/${memberUnitId}/members/${editingMember}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(memberForm),
          },
        )
        if (!res.ok) throw new Error("Failed to update")
        const updated: Member = await res.json()
        setUnits((prev) =>
          prev.map((u) =>
            u.id === memberUnitId
              ? { ...u, members: u.members.map((m) => (m.id === updated.id ? updated : m)) }
              : u,
          ),
        )
      }
      cancelMember()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(unitId: string, memberId: string) {
    if (!confirm("Xóa thành viên này khỏi đơn vị?")) return
    const res = await fetch(`/api/admin/affiliated-units/${unitId}/members/${memberId}`, {
      method: "DELETE",
    })
    if (!res.ok) return
    setUnits((prev) =>
      prev.map((u) =>
        u.id === unitId ? { ...u, members: u.members.filter((m) => m.id !== memberId) } : u,
      ),
    )
    router.refresh()
  }

  // ── Render helpers ──
  function renderUnitForm() {
    const langVals = {
      name: {
        vi: unitForm.name,
        en: unitForm.name_en,
        zh: unitForm.name_zh,
        ar: unitForm.name_ar,
      },
      description: {
        vi: unitForm.description,
        en: unitForm.description_en,
        zh: unitForm.description_zh,
        ar: unitForm.description_ar,
      },
    }
    return (
      <div className="rounded-xl border border-brand-300 bg-brand-50 p-5 space-y-4">
        <h3 className="font-semibold text-foreground">
          {editingUnit === "new" ? "Thêm đơn vị mới" : "Chỉnh sửa đơn vị"}
        </h3>

        <LangTabsBar
          activeLocale={unitLocale}
          onLocaleChange={setUnitLocale}
          hasContent={computeHasContent(langVals.name, langVals.description)}
          disabled={readOnly}
          onAiTranslate={handleUnitAiTranslate}
          helperText={
            unitLocale === "vi"
              ? "Nhập tên / mô tả tiếng Việt trước. Dùng AI dịch khi sang EN / 中文."
              : undefined
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Loại đơn vị *
            </label>
            <select
              value={unitForm.type}
              onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value as UnitType })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="CHI_HOI">Chi hội (hiện ở /chi-hoi)</option>
              <option value="BAN">Ban trực thuộc (hiện ở /ban-lanh-dao)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Tên đơn vị {unitLocale === "vi" && "*"}
            </label>
            <input
              type="text"
              value={langVals.name[unitLocale]}
              onChange={(e) =>
                setUnitForm({ ...unitForm, [unitLangKey("name", unitLocale)]: e.target.value })
              }
              placeholder={
                unitLocale === "vi"
                  ? "VD: Chi hội trầm hương khu vực Bình Phước"
                  : "Translated name"
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Mô tả ngắn
            </label>
            <textarea
              value={langVals.description[unitLocale]}
              onChange={(e) =>
                setUnitForm({
                  ...unitForm,
                  [unitLangKey("description", unitLocale)]: e.target.value,
                })
              }
              rows={2}
              placeholder={unitLocale === "vi" ? "Mô tả ngắn về đơn vị..." : "Translated description"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Thứ tự hiển thị
            </label>
            <input
              type="number"
              value={unitForm.sortOrder}
              onChange={(e) => setUnitForm({ ...unitForm, sortOrder: Number(e.target.value) })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={saveUnit}
            disabled={saving || readOnly}
            title={readOnly ? READ_ONLY_TOOLTIP : undefined}
            className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
          <button
            type="button"
            onClick={cancelUnit}
            className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Hủy
          </button>
        </div>
      </div>
    )
  }

  function renderMemberForm() {
    const langVals = {
      name: {
        vi: memberForm.name,
        en: memberForm.name_en,
        zh: memberForm.name_zh,
        ar: memberForm.name_ar,
      },
      title: {
        vi: memberForm.title,
        en: memberForm.title_en,
        zh: memberForm.title_zh,
        ar: memberForm.title_ar,
      },
    }
    return (
      <div className="rounded-lg border border-brand-200 bg-white p-4 space-y-3">
        <LangTabsBar
          activeLocale={memberLocale}
          onLocaleChange={setMemberLocale}
          hasContent={computeHasContent(langVals.name, langVals.title)}
          disabled={readOnly}
          onAiTranslate={handleMemberAiTranslate}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Họ tên {memberLocale === "vi" && "*"}
            </label>
            <input
              type="text"
              value={langVals.name[memberLocale]}
              onChange={(e) =>
                setMemberForm({
                  ...memberForm,
                  [memberLangKey("name", memberLocale)]: e.target.value,
                })
              }
              placeholder={memberLocale === "vi" ? "VD: Nguyễn Văn A" : "Translated name"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Chức vụ {memberLocale === "vi" && "*"}
            </label>
            <input
              type="text"
              value={langVals.title[memberLocale]}
              onChange={(e) =>
                setMemberForm({
                  ...memberForm,
                  [memberLangKey("title", memberLocale)]: e.target.value,
                })
              }
              placeholder={memberLocale === "vi" ? "VD: Chi hội trưởng" : "Translated title"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Thứ tự hiển thị
            </label>
            <input
              type="number"
              value={memberForm.sortOrder}
              onChange={(e) =>
                setMemberForm({ ...memberForm, sortOrder: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveMember}
            disabled={saving || readOnly}
            title={readOnly ? READ_ONLY_TOOLTIP : undefined}
            className="rounded-lg bg-brand-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Đang lưu..." : "Lưu thành viên"}
          </button>
          <button
            type="button"
            onClick={cancelMember}
            className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            Hủy
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Type filter + Add button */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "ALL" as const, label: "Tất cả" },
            { key: "CHI_HOI" as const, label: "Chi hội" },
            { key: "BAN" as const, label: "Ban trực thuộc" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilterType(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filterType === key
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {label}
            {key !== "ALL" && <span className="ml-1 opacity-60">({countByType(key)})</span>}
          </button>
        ))}
        <button
          type="button"
          onClick={startCreateUnit}
          disabled={readOnly}
          title={readOnly ? READ_ONLY_TOOLTIP : undefined}
          className="ml-auto rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50 transition-colors"
        >
          + Thêm đơn vị
        </button>
      </div>

      {editingUnit === "new" && renderUnitForm()}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Chưa có đơn vị nào.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((u) =>
              editingUnit === u.id ? (
                <div key={u.id}>{renderUnitForm()}</div>
              ) : (
                <div
                  key={u.id}
                  className={cn(
                    "rounded-xl border bg-card p-4 transition-colors",
                    u.isActive ? "border-border" : "border-border opacity-50",
                  )}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(u.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Mở/thu gọn"
                    >
                      {expanded.has(u.id) ? "▾" : "▸"}
                    </button>
                    <h3 className="font-semibold text-foreground text-sm">{u.name}</h3>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        TYPE_COLORS[u.type],
                      )}
                    >
                      {TYPE_LABELS[u.type]}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {u.members.length} thành viên
                    </span>
                    {!u.isActive && (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Ẩn
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      #{u.sortOrder}
                    </span>

                    <div className="ml-auto flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEditUnit(u)}
                        disabled={readOnly}
                        title={readOnly ? READ_ONLY_TOOLTIP : undefined}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 transition-colors"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleUnitActive(u)}
                        disabled={readOnly}
                        title={readOnly ? READ_ONLY_TOOLTIP : undefined}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
                      >
                        {u.isActive ? "Ẩn" : "Hiện"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeUnit(u.id)}
                        disabled={readOnly}
                        title={readOnly ? READ_ONLY_TOOLTIP : undefined}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>

                  {u.description && (
                    <p className="mt-2 ml-7 text-xs text-muted-foreground">{u.description}</p>
                  )}

                  {expanded.has(u.id) && (
                    <div className="mt-3 ml-7 space-y-2 border-l-2 border-brand-100 pl-4">
                      {u.members
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((m) =>
                          memberUnitId === u.id && editingMember === m.id ? (
                            <div key={m.id}>{renderMemberForm()}</div>
                          ) : (
                            <div
                              key={m.id}
                              className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5"
                            >
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-foreground">
                                  {m.name}
                                </span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {m.title}
                                </span>
                              </div>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                #{m.sortOrder}
                              </span>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEditMember(u.id, m)}
                                  disabled={readOnly}
                                  title={readOnly ? READ_ONLY_TOOLTIP : undefined}
                                  className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 transition-colors"
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeMember(u.id, m.id)}
                                  disabled={readOnly}
                                  title={readOnly ? READ_ONLY_TOOLTIP : undefined}
                                  className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          ),
                        )}

                      {memberUnitId === u.id && editingMember === "new" ? (
                        renderMemberForm()
                      ) : (
                        <button
                          type="button"
                          onClick={() => startCreateMember(u.id)}
                          disabled={readOnly}
                          title={readOnly ? READ_ONLY_TOOLTIP : undefined}
                          className="rounded-lg border border-dashed border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 transition-colors"
                        >
                          + Thêm thành viên
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ),
            )}
        </div>
      )}
    </div>
  )
}
