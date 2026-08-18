"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * Tìm + chọn hội viên để link vào Leader profile. Dùng debounce 300ms
 * để tránh spam API khi admin gõ.
 *
 * UX:
 *  - Nhập tên/email → dropdown liệt kê tối đa 10 user match
 *  - Click 1 user → set selected, hiển thị chip
 *  - Nút "x" → unlink (selectedUserId = null)
 *  - Empty state: hint "Leave blank for external leader"
 */

export type UserSummary = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: string
  accountType: string
  isActive: boolean
  company: { name: string } | null
}

type Props = {
  /** Currently-linked user (null = external / chưa link). */
  value: UserSummary | null
  onChange: (user: UserSummary | null) => void
  disabled?: boolean
  /** Label cho nút clear khi đã có value. Default "Bỏ link" (Leader context).
   *  NewsEditor truyền "Đổi" cho rõ nghĩa "đổi tác giả khác". */
  unlinkLabel?: string
  /** Tooltip cho nút clear. */
  unlinkTitle?: string
  /** Placeholder cho input search. */
  placeholder?: string
  /** Hint text dưới input (Leader context cần text khác News context). */
  hint?: string
}

export function UserPicker({
  value,
  onChange,
  disabled,
  unlinkLabel = "Bỏ link",
  unlinkTitle = "Bỏ link, giữ Leader làm external",
  placeholder = "Tìm hội viên theo tên hoặc email...",
  hint = "Để trống nếu là khách mời/cố vấn không phải hội viên hệ thống (external leader).",
}: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/users/search?q=${encodeURIComponent(q)}&limit=10`,
      )
      if (!res.ok) return
      const data = (await res.json()) as { users: UserSummary[] }
      setResults(data.users ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runSearch(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  // Click outside closes dropdown
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  function selectUser(user: UserSummary) {
    onChange(user)
    setQuery("")
    setResults([])
    setOpen(false)
  }

  function unlink() {
    onChange(null)
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Selected chip — thay thế input khi đã chọn */}
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-brand-100">
            {value.avatarUrl ? (
              <Image
                src={value.avatarUrl}
                alt=""
                fill
                sizes="32px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-bold text-brand-500">
                {value.name.charAt(0)?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-brand-900">
              {value.name}
            </p>
            <p className="truncate text-xs text-brand-500">
              {value.email}
              {value.company?.name && (
                <span className="ml-1 text-brand-400">· {value.company.name}</span>
              )}
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={unlink}
              className="rounded-md border border-brand-200 bg-white px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:border-brand-300"
              title={unlinkTitle}
            >
              {unlinkLabel}
            </button>
          )}
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-brand-50/40"
          />
          {open && query.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-brand-200 bg-white shadow-lg">
              {loading ? (
                <p className="px-3 py-3 text-sm text-brand-400">Đang tìm...</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-brand-400 italic">
                  Không có hội viên khớp &quot;{query}&quot;
                </p>
              ) : (
                <ul>
                  {results.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => selectUser(u)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-brand-50 transition-colors",
                          !u.isActive && "opacity-50",
                        )}
                      >
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-brand-100">
                          {u.avatarUrl ? (
                            <Image
                              src={u.avatarUrl}
                              alt=""
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-xs font-bold text-brand-500">
                              {u.name.charAt(0)?.toUpperCase() ?? "?"}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-brand-900">
                            {u.name}
                            {!u.isActive && (
                              <span className="ml-1 text-[10px] text-amber-700">(inactive)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-brand-500">
                            {u.email}
                            {u.company?.name && (
                              <span className="ml-1 text-brand-400">
                                · {u.company.name}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold uppercase text-brand-400">
                          {u.role}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {hint && (
            <p className="mt-1 text-[11px] text-brand-400 leading-snug">
              {hint}
            </p>
          )}
        </>
      )}
    </div>
  )
}
