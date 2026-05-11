import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import { formatLedgerDate, getActiveCategories, parseDateInput } from "@/lib/ledger"
import { formatVnd } from "@/lib/certification-fee"
import { cn } from "@/lib/utils"
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  Download,
  PlusCircle,
  Receipt,
} from "lucide-react"
import type { Prisma } from "@prisma/client"

export const revalidate = 0

const PAGE_SIZE = 25

export default async function SoQuyPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string
    category?: string
    from?: string
    to?: string
    q?: string
    page?: string
  }>
}) {
  const session = await auth()
  if (!session?.user?.id) notFound()
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "ledger:read")) notFound()
  const canWrite = hasPermission(perms, "ledger:write")

  const params = await searchParams
  const filterType = params.type === "INCOME" || params.type === "EXPENSE" ? params.type : ""
  const filterCategory = params.category ?? ""
  const filterFrom = params.from ?? ""
  const filterTo = params.to ?? ""
  const search = params.q?.trim() ?? ""
  const page = Math.max(1, Number(params.page) || 1)

  const where: Prisma.LedgerTransactionWhereInput = {}
  if (filterType) where.type = filterType
  if (filterCategory) where.categoryId = filterCategory

  const fromDate = filterFrom ? parseDateInput(filterFrom) : null
  const toDate = filterTo ? parseDateInput(filterTo) : null
  if (fromDate || toDate) {
    where.transactionDate = {}
    if (fromDate) where.transactionDate.gte = fromDate
    if (toDate) {
      // include toàn bộ ngày `to` → +1 ngày exclusive
      const next = new Date(toDate)
      next.setUTCDate(next.getUTCDate() + 1)
      where.transactionDate.lt = next
    }
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { referenceNo: { contains: search, mode: "insensitive" } },
    ]
  }

  const [rows, total, allCategories, totalsAgg] = await Promise.all([
    prisma.ledgerTransaction.findMany({
      where,
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        amount: true,
        transactionDate: true,
        description: true,
        referenceNo: true,
        receiptUrl: true,
        attachments: true,
        paymentMethod: true,
        relatedPaymentId: true,
        category: { select: { name: true } },
      },
    }),
    prisma.ledgerTransaction.count({ where }),
    getActiveCategories(),
    Promise.all([
      prisma.ledgerTransaction.aggregate({
        where: { ...where, type: "INCOME" },
        _sum: { amount: true },
      }),
      prisma.ledgerTransaction.aggregate({
        where: { ...where, type: "EXPENSE" },
        _sum: { amount: true },
      }),
    ]),
  ])

  const totalIncome = Number(totalsAgg[0]._sum.amount ?? BigInt(0))
  const totalExpense = Number(totalsAgg[1]._sum.amount ?? BigInt(0))
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    if (filterType) p.set("type", filterType)
    if (filterCategory) p.set("category", filterCategory)
    if (filterFrom) p.set("from", filterFrom)
    if (filterTo) p.set("to", filterTo)
    if (search) p.set("q", search)
    if (page > 1) p.set("page", String(page))
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "") p.delete(k)
      else p.set(k, v)
    }
    return `/admin/thu-chi/so-quy${p.toString() ? `?${p}` : ""}`
  }

  // Excel export — pass full filter context, server route renders với same where
  const excelUrl = `/admin/thu-chi/so-quy/export${buildExportQuery({ filterType, filterCategory, filterFrom, filterTo, search })}`

  const typeTabs = [
    { key: "", label: "Tất cả" },
    { key: "INCOME", label: "Thu" },
    { key: "EXPENSE", label: "Chi" },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Link
            href="/admin/thu-chi"
            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Tổng quan
          </Link>
          <h1 className="text-2xl font-bold text-brand-900 mt-1">Sổ quỹ chi tiết</h1>
          <p className="text-sm text-brand-500 mt-1">
            {total.toLocaleString("vi-VN")} giao dịch
            {filterType || filterCategory || filterFrom || filterTo || search
              ? " (đã lọc)"
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={excelUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Excel (.xlsx)
          </a>
          {canWrite && (
            <Link
              href="/admin/thu-chi/them"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Thêm giao dịch
            </Link>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <form
        method="get"
        className="bg-white border border-brand-200 rounded-2xl p-4 space-y-3"
      >
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex gap-1 rounded-lg border border-brand-200 bg-brand-50 p-1">
            {typeTabs.map((t) => (
              <a
                key={t.key}
                href={buildUrl({ type: t.key || undefined, page: undefined })}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  filterType === t.key
                    ? "bg-brand-700 text-white"
                    : "text-brand-700 hover:bg-brand-100",
                )}
              >
                {t.label}
              </a>
            ))}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-brand-500">Danh mục</span>
            <select
              name="category"
              defaultValue={filterCategory}
              className="rounded-md border border-brand-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="">-- Tất cả --</option>
              {allCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.type === "INCOME" ? "Thu" : "Chi"}] {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-brand-500">Từ ngày</span>
            <input
              type="date"
              name="from"
              defaultValue={filterFrom}
              className="rounded-md border border-brand-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-brand-500">Đến ngày</span>
            <input
              type="date"
              name="to"
              defaultValue={filterTo}
              className="rounded-md border border-brand-300 px-2 py-1.5 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <span className="text-xs text-brand-500">Tìm trong diễn giải / số phiếu</span>
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Tìm..."
              className="rounded-md border border-brand-300 px-2 py-1.5 text-sm"
            />
          </label>

          {/* preserve type when submitting via form (filters bar uses ?type=) */}
          {filterType && <input type="hidden" name="type" value={filterType} />}

          <button
            type="submit"
            className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
          >
            Lọc
          </button>
          {(filterCategory || filterFrom || filterTo || search) && (
            <a
              href={buildUrl({
                category: undefined,
                from: undefined,
                to: undefined,
                q: undefined,
                page: undefined,
              })}
              className="text-xs text-brand-500 hover:text-brand-700 underline"
            >
              Xóa lọc
            </a>
          )}
        </div>

        {/* Tổng theo filter hiện tại — giúp dò nhanh khi xem 1 danh mục/khoảng */}
        <div className="flex flex-wrap gap-4 pt-2 border-t border-brand-100 text-xs">
          <span className="text-brand-500">
            Thu (theo lọc):{" "}
            <strong className="text-emerald-700 tabular-nums">
              +{formatVnd(totalIncome)}
            </strong>
          </span>
          <span className="text-brand-500">
            Chi (theo lọc):{" "}
            <strong className="text-red-700 tabular-nums">−{formatVnd(totalExpense)}</strong>
          </span>
          <span className="text-brand-500">
            Chênh lệch:{" "}
            <strong
              className={cn(
                "tabular-nums",
                totalIncome - totalExpense >= 0 ? "text-emerald-700" : "text-red-700",
              )}
            >
              {totalIncome - totalExpense >= 0 ? "+" : "−"}
              {formatVnd(Math.abs(totalIncome - totalExpense))}
            </strong>
          </span>
        </div>
      </form>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-white border border-brand-200 rounded-2xl p-12 text-center text-sm text-brand-500">
          Không có giao dịch khớp bộ lọc
        </div>
      ) : (
        <div className="bg-white border border-brand-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-200 text-xs text-brand-500 font-medium bg-brand-50/50">
                <th className="text-left px-4 py-3 w-24">Ngày</th>
                <th className="text-left px-4 py-3">Diễn giải</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Danh mục</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Số phiếu</th>
                <th className="text-right px-4 py-3 w-32">Số tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {rows.map((tx) => (
                <tr key={tx.id} className="hover:bg-brand-50/50 transition-colors">
                  <td className="px-4 py-3 text-brand-700 whitespace-nowrap">
                    {formatLedgerDate(tx.transactionDate)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/thu-chi/${tx.id}`}
                      className="font-medium text-brand-900 hover:text-brand-700 line-clamp-1"
                    >
                      {tx.description}
                    </Link>
                    <div className="flex gap-2 mt-0.5">
                      {(() => {
                        const count = Array.isArray(tx.attachments) ? tx.attachments.length : 0
                        const hasLegacy = !!tx.receiptUrl
                        if (count === 0 && !hasLegacy) return null
                        return (
                          <span className="inline-flex items-center gap-0.5 text-xs text-brand-500">
                            <Receipt className="h-3 w-3" />
                            {count > 0 ? `${count} CT` : "Có CT"}
                          </span>
                        )
                      })()}
                      {tx.relatedPaymentId && (
                        <span className="text-xs text-amber-700">⚡ Tự động từ CK</span>
                      )}
                      <span className="text-xs text-brand-400">
                        {tx.paymentMethod === "BANK" ? "Chuyển khoản" : "Tiền mặt"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brand-600 hidden md:table-cell">
                    {tx.category.name}
                  </td>
                  <td className="px-4 py-3 text-brand-500 font-mono text-xs hidden lg:table-cell">
                    {tx.referenceNo ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span
                      className={cn(
                        "font-bold tabular-nums inline-flex items-center gap-1",
                        tx.type === "INCOME" ? "text-emerald-700" : "text-red-700",
                      )}
                    >
                      {tx.type === "INCOME" ? (
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      )}
                      {tx.type === "INCOME" ? "+" : "−"}
                      {formatVnd(Number(tx.amount))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-brand-500">
            Trang {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={buildUrl({ page: String(page - 1) })}
                className="rounded-md border border-brand-300 px-3 py-1.5 text-xs hover:bg-brand-50"
              >
                ← Trước
              </a>
            )}
            {page < totalPages && (
              <a
                href={buildUrl({ page: String(page + 1) })}
                className="rounded-md border border-brand-300 px-3 py-1.5 text-xs hover:bg-brand-50"
              >
                Sau →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function buildExportQuery(o: {
  filterType: string
  filterCategory: string
  filterFrom: string
  filterTo: string
  search: string
}) {
  const p = new URLSearchParams()
  if (o.filterType) p.set("type", o.filterType)
  if (o.filterCategory) p.set("category", o.filterCategory)
  if (o.filterFrom) p.set("from", o.filterFrom)
  if (o.filterTo) p.set("to", o.filterTo)
  if (o.search) p.set("q", o.search)
  return p.toString() ? `?${p}` : ""
}
