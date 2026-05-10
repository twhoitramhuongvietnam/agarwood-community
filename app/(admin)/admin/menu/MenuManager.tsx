"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useAdminReadOnly, READ_ONLY_TOOLTIP } from "@/components/features/admin/AdminReadOnlyContext"
import { MultiLangInput, extractLangValues } from "@/components/ui/multi-lang-input"

type Item = {
  id: string
  menuKey: string | null
  label: string
  label_en: string | null
  label_zh: string | null
  href: string
  parentId: string | null
  sortOrder: number
  isVisible: boolean
  isNew: boolean
  comingSoon: boolean
  openInNewTab: boolean
  matchPrefixes: string[]
  createdAt: string
  updatedAt: string
}

type FormState = Omit<Item, "id" | "createdAt" | "updatedAt"> & { id?: string }

const EMPTY_FORM: FormState = {
  label: "",
  label_en: null,
  label_zh: null,
  href: "",
  menuKey: null,
  parentId: null,
  sortOrder: 0,
  isVisible: true,
  isNew: false,
  comingSoon: false,
  openInNewTab: false,
  matchPrefixes: [],
}

export function MenuManager({ initialItems }: { initialItems: Item[] }) {
  const router = useRouter()
  const readOnly = useAdminReadOnly()
  const [items, setItems] = useState(initialItems)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const topLevel = items.filter((i) => !i.parentId).sort((a, b) => a.sortOrder - b.sortOrder)
  const childrenOf = (id: string) =>
    items.filter((i) => i.parentId === id).sort((a, b) => a.sortOrder - b.sortOrder)

  function refresh() {
    fetch("/api/admin/menu")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items)
        router.refresh()
      })
  }

  function startEdit(it: Item) {
    setForm({ ...it })
    setError(null)
  }
  function startCreate(parentId: string | null = null) {
    setForm({ ...EMPTY_FORM, parentId, sortOrder: (parentId ? childrenOf(parentId) : topLevel).length + 1 })
    setError(null)
  }

  function save() {
    setError(null)
    const isUpdate = !!form.id
    const url = isUpdate ? `/api/admin/menu/${form.id}` : "/api/admin/menu"
    const method = isUpdate ? "PATCH" : "POST"
    startTransition(async () => {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? "Lỗi lưu")
        return
      }
      setForm(EMPTY_FORM)
      refresh()
    })
  }

  function remove(id: string) {
    if (!confirm("Xóa menu này? Mọi submenu con cũng sẽ bị xóa.")) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/menu/${id}`, { method: "DELETE" })
      if (!res.ok) { setError("Lỗi xóa"); return }
      if (form.id === id) setForm(EMPTY_FORM)
      refresh()
    })
  }

  function toggleVisible(it: Item) {
    startTransition(async () => {
      await fetch(`/api/admin/menu/${it.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isVisible: !it.isVisible }),
      })
      refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
      {/* Tree */}
      <div className="bg-white rounded-xl border border-brand-200 p-4 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-brand-900">Cấu trúc menu</h2>
          <button
            onClick={() => startCreate(null)}
            disabled={readOnly}
            title={readOnly ? READ_ONLY_TOOLTIP : undefined}
            className="rounded-md bg-brand-700 text-white px-3 py-1.5 text-sm hover:bg-brand-800 disabled:opacity-50"
          >
            + Thêm menu cha
          </button>
        </div>

        {topLevel.length === 0 && (
          <p className="text-sm text-brand-500 italic">Chưa có menu nào.</p>
        )}

        {topLevel.map((it) => (
          <div key={it.id} className="border border-brand-200 rounded-lg">
            <Row
              it={it}
              readOnly={readOnly}
              onEdit={() => startEdit(it)}
              onDelete={() => remove(it.id)}
              onToggle={() => toggleVisible(it)}
              onAddChild={() => startCreate(it.id)}
            />
            <div className="ml-6 border-l border-brand-100 pl-2 pb-2 space-y-1">
              {childrenOf(it.id).map((child) => (
                <Row
                  key={child.id}
                  it={child}
                  readOnly={readOnly}
                  isChild
                  onEdit={() => startEdit(child)}
                  onDelete={() => remove(child.id)}
                  onToggle={() => toggleVisible(child)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-brand-200 p-4 space-y-3 h-fit sticky top-4">
        <h2 className="font-semibold text-brand-900">
          {form.id ? "Sửa menu" : "Tạo menu mới"}
        </h2>

        <MultiLangInput
          name="label"
          label="Label"
          values={extractLangValues(form as unknown as Record<string, unknown>, "label")}
          onChange={(key, value) => setForm({ ...form, [key]: value })}
          placeholder="MXH Trầm Hương"
          disabled={readOnly}
        />

        <Field label="Href (đường dẫn)">
          <input
            value={form.href}
            onChange={(e) => setForm({ ...form, href: e.target.value })}
            disabled={readOnly}
            className="input"
            placeholder="/feed"
          />
        </Field>

        <Field label="Menu key (slug nối với route registry)">
          <input
            value={form.menuKey ?? ""}
            onChange={(e) => setForm({ ...form, menuKey: e.target.value || null })}
            disabled={readOnly}
            className="input font-mono text-xs"
            placeholder="vd: mxh, nghien-cuu, hoi-vien"
          />
          <p className="text-[11px] text-brand-500 mt-1">
            Slug nối menu này với route registry code (fallback mặc định cho route
            admin chưa khai báo ở Match prefixes). Giữ cố định sau khi đặt.
          </p>
        </Field>

        <Field label="Menu cha">
          <select
            value={form.parentId ?? ""}
            onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}
            disabled={readOnly}
            className="input"
          >
            <option value="">— (top-level)</option>
            {topLevel.filter((i) => i.id !== form.id).map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Thứ tự (sortOrder)">
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            disabled={readOnly}
            className="input"
          />
        </Field>

        <Field label="Match prefixes (mỗi dòng 1 prefix)">
          <textarea
            value={form.matchPrefixes.join("\n")}
            onChange={(e) =>
              setForm({ ...form, matchPrefixes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
            }
            disabled={readOnly}
            rows={3}
            className="input font-mono text-xs"
            placeholder="/feed&#10;/bai-viet"
          />
          <p className="text-[11px] text-brand-500 mt-1">
            Khi user vào trang khớp prefix, menu này được highlight (vd: <code>/bai-viet</code> → highlight MXH).
            <strong> Cấu hình ở đây thắng route registry code</strong> — sửa ở đây có hiệu lực ngay.
          </p>
        </Field>

        <div className="flex flex-wrap gap-3 text-sm pt-1">
          <Toggle label="Đang dùng (hiện trên menu)" checked={form.isVisible} onChange={(v) => setForm({ ...form, isVisible: v })} disabled={readOnly} />
          <Toggle label="Badge MỚI" checked={form.isNew} onChange={(v) => setForm({ ...form, isNew: v })} disabled={readOnly} />
          <Toggle label="Sắp có" checked={form.comingSoon} onChange={(v) => setForm({ ...form, comingSoon: v })} disabled={readOnly} />
          <Toggle label="Mở tab mới" checked={form.openInNewTab} onChange={(v) => setForm({ ...form, openInNewTab: v })} disabled={readOnly} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            disabled={pending || readOnly}
            title={readOnly ? READ_ONLY_TOOLTIP : undefined}
            className="rounded-md bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-800 disabled:opacity-50"
          >
            {pending ? "Đang lưu..." : form.id ? "Cập nhật" : "Tạo"}
          </button>
          {form.id && (
            <button
              onClick={() => setForm(EMPTY_FORM)}
              className="rounded-md border border-brand-300 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
            >
              Huỷ
            </button>
          )}
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid rgb(229 213 191);
          font-size: 0.875rem;
          background: white;
        }
        .input:disabled { background: rgb(247 240 230); cursor: not-allowed; }
        .input:focus { outline: 2px solid rgb(180 140 90); outline-offset: -1px; }
      `}</style>
    </div>
  )
}

function Row({
  it,
  readOnly,
  isChild,
  onEdit,
  onDelete,
  onToggle,
  onAddChild,
}: {
  it: Item
  readOnly: boolean
  isChild?: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onAddChild?: () => void
}) {
  return (
    // Mobile: stack — info trên, action button group dưới (4 nút full-row).
    // Trước đó row `flex items-center` ép label container `flex-1 min-w-0` về
    // 0px khi 4 button chiếm hết viewport hẹp → label biến mất hoàn toàn.
    // sm+: layout 1 hàng như cũ.
    <div className={"flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-2 " + (isChild ? "" : "bg-brand-50 rounded-t-lg")}>
      <div className="flex items-start gap-2 min-w-0 flex-1 sm:items-center">
        <span className="text-xs text-brand-400 w-6 text-right shrink-0 mt-0.5 sm:mt-0">#{it.sortOrder}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={"font-medium " + (it.isVisible ? "text-brand-900" : "text-brand-400")}>
              {it.label}
            </span>
            {it.isNew && <Tag color="red">MỚI</Tag>}
            {it.comingSoon && <Tag color="gray">Sắp có</Tag>}
            {it.openInNewTab && <Tag color="blue">↗</Tag>}
          </div>
          <div className="text-xs text-brand-500 truncate">
            {it.href}
            {it.menuKey && <span className="ml-2 text-[10px] font-mono px-1 bg-brand-100 rounded">key:{it.menuKey}</span>}
          </div>
        </div>
      </div>
      {/* Mobile: nút thụt 32px (#sortOrder 24 + gap 8) để align với cột label,
          không sát mép trái. flex-wrap dự phòng nếu vẫn không đủ chỗ. */}
      <div className="flex flex-wrap items-center gap-2 ml-8 sm:ml-0 sm:flex-nowrap sm:shrink-0">
        <button
          onClick={onToggle}
          disabled={readOnly}
          title={readOnly ? READ_ONLY_TOOLTIP : it.isVisible ? "Bấm để ẩn khỏi menu" : "Bấm để hiển thị trên menu"}
          className={
            "text-xs px-3 py-1 rounded-full font-medium border transition-colors disabled:opacity-50 whitespace-nowrap " +
            (it.isVisible
              ? "bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
              : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200")
          }
        >
          {it.isVisible ? "✓ Đang dùng" : "○ Chưa dùng"}
        </button>
        {onAddChild && (
          <button
            onClick={onAddChild}
            disabled={readOnly}
            title={readOnly ? READ_ONLY_TOOLTIP : "Thêm submenu"}
            className="text-xs px-2 py-1 rounded border border-brand-300 text-brand-600 hover:bg-brand-100 disabled:opacity-50 whitespace-nowrap"
          >
            + Sub
          </button>
        )}
        <button
          onClick={onEdit}
          className="text-xs px-2 py-1 rounded border border-brand-300 text-brand-700 hover:bg-brand-100"
        >
          Sửa
        </button>
        <button
          onClick={onDelete}
          disabled={readOnly}
          title={readOnly ? READ_ONLY_TOOLTIP : undefined}
          className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Xoá
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-brand-700 mb-1">{label}</span>
      {children}
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={"inline-flex items-center gap-1.5 " + (disabled ? "opacity-60" : "cursor-pointer")}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="text-brand-700">{label}</span>
    </label>
  )
}

function Tag({ color, children }: { color: "red" | "gray" | "blue"; children: React.ReactNode }) {
  const cls =
    color === "red" ? "bg-red-100 text-red-700" :
    color === "blue" ? "bg-blue-100 text-blue-700" :
    "bg-gray-100 text-gray-600"
  return <span className={"text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded " + cls}>{children}</span>
}
