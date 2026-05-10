"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCcw } from "lucide-react"
import { cn } from "@/lib/utils"

/** Nút "Làm mới" — gọi POST /api/admin/quota-snapshot { trigger: "auto" }
 *  để fetch ngay tất cả service, không cần đợi cron daily. */
export function QuotaActions() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handleRefresh() {
    setMsg(null)
    try {
      const res = await fetch("/api/admin/quota-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "auto" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ type: "error", text: data.error ?? "Lỗi" })
        return
      }
      setMsg({ type: "success", text: `Đã ghi ${data.saved} snapshot` })
      startTransition(() => router.refresh())
    } catch (e) {
      setMsg({ type: "error", text: (e as Error).message })
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && (
        <span
          className={cn(
            "text-xs px-2 py-1 rounded",
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200",
          )}
        >
          {msg.text}
        </span>
      )}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
      >
        <RefreshCcw className={cn("w-4 h-4", pending && "animate-spin")} />
        {pending ? "Đang fetch..." : "Làm mới"}
      </button>
    </div>
  )
}
