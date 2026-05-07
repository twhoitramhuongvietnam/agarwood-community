import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { cn } from "@/lib/utils"
import { PaymentActionRow } from "./PaymentActionRow"

export const revalidate = 0 // per-request — readOnly state phụ thuộc role

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  MEMBERSHIP_FEE:    { label: "Membership",    cls: "bg-blue-100 text-blue-700" },
  CERTIFICATION_FEE: { label: "Chứng nhận",    cls: "bg-yellow-100 text-yellow-700" },
  MEDIA_SERVICE:     { label: "Truyền thông",  cls: "bg-purple-100 text-purple-700" },
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  SUCCESS: { label: "✓ Đã xác nhận", cls: "bg-green-100 text-green-700" },
  FAILED:  { label: "✗ Từ chối",     cls: "bg-red-100 text-red-700" },
}

function formatVND(n: number) { return n.toLocaleString("vi-VN") + "đ" }
function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
function timeAgo(d: Date) {
  const diffMs = Date.now() - new Date(d).getTime()
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return `${Math.floor(diffMs / 60000)} phút trước`
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

export default async function AdminPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; period?: string }>
}) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) notFound()

  const params = await searchParams
  const filterType = params.type ?? ""
  const filterPeriod = params.period ?? ""

  // Period filter
  let dateFrom: Date | undefined
  if (filterPeriod === "today") {
    dateFrom = new Date()
    dateFrom.setHours(0, 0, 0, 0)
  } else if (filterPeriod === "week") {
    dateFrom = new Date(Date.now() - 7 * 86400000)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingWhere: any = { status: "PENDING" }
  if (filterType) pendingWhere.type = filterType
  if (dateFrom) pendingWhere.createdAt = { gte: dateFrom }

  const [pendingPayments, recentProcessed, pendingCount] = await Promise.all([
    prisma.payment.findMany({
      where: pendingWhere,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        amount: true,
        payosOrderCode: true,
        description: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
            bankName: true,
            bankAccountNumber: true,
            bankAccountName: true,
          },
        },
        certification: { select: { product: { select: { name: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { status: { in: ["SUCCESS", "FAILED"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        amount: true,
        status: true,
        failureReason: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.payment.count({ where: { status: "PENDING" } }),
  ])

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    if (filterType) p.set("type", filterType)
    if (filterPeriod) p.set("period", filterPeriod)
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v); else p.delete(k)
    }
    return `/admin/thanh-toan${p.toString() ? `?${p}` : ""}`
  }

  const typeTabs = [
    { key: "", label: "Tất cả" },
    { key: "MEMBERSHIP_FEE", label: "Membership" },
    { key: "CERTIFICATION_FEE", label: "Chứng nhận" },
  ]
  const periodTabs = [
    { key: "", label: "Tất cả" },
    { key: "today", label: "Hôm nay" },
    { key: "week", label: "Tuần này" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Xác nhận Chuyển khoản</h1>
          <p className="text-sm text-brand-500 mt-1">
            {pendingCount > 0
              ? <span className="font-semibold text-amber-700">{pendingCount} chờ xử lý</span>
              : <span className="text-green-600">Không có yêu cầu chờ</span>}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg border border-brand-200 bg-brand-50 p-1">
          {typeTabs.map((t) => (
            <a
              key={t.key}
              href={buildUrl({ type: t.key || undefined })}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                filterType === t.key ? "bg-brand-700 text-white" : "text-brand-700 hover:bg-brand-100",
              )}
            >
              {t.label}
            </a>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-brand-200 bg-brand-50 p-1">
          {periodTabs.map((t) => (
            <a
              key={t.key}
              href={buildUrl({ period: t.key || undefined })}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                filterPeriod === t.key ? "bg-brand-700 text-white" : "text-brand-700 hover:bg-brand-100",
              )}
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>

      {/* Pending payments */}
      {pendingPayments.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <p className="text-green-700 font-medium">Không có yêu cầu nào đang chờ xác nhận ✓</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingPayments.map((p) => {
            const typeBadge = TYPE_BADGE[p.type] ?? { label: p.type, cls: "bg-gray-100 text-gray-600" }
            return (
              <div key={p.id} className="bg-white border-2 border-amber-200 rounded-2xl p-5 space-y-3">
                {/* Row 1: user + type + amount */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-brand-900 text-sm">{p.user.name ?? "—"}</p>
                    <p className="text-sm text-brand-500">{p.user.email}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <span className={cn("inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full", typeBadge.cls)}>
                      {typeBadge.label}
                    </span>
                    <p className="font-bold text-brand-900">{formatVND(p.amount)}</p>
                  </div>
                </div>

                {/* CK description */}
                {p.description && (
                  <p className="text-xs text-brand-600">
                    Nội dung CK: <span className="font-mono font-bold text-brand-900 bg-brand-50 px-1.5 py-0.5 rounded">{p.description}</span>
                  </p>
                )}

                {/* Cert product */}
                {p.type === "CERTIFICATION_FEE" && p.certification?.product && (
                  <p className="text-xs text-brand-500">
                    Sản phẩm: <span className="font-semibold text-brand-700">{p.certification.product.name}</span>
                  </p>
                )}

                {/* Date + actions */}
                <div className="flex items-end justify-between gap-3 pt-1 border-t border-brand-200 flex-wrap">
                  <span className="text-sm text-brand-500">
                    Gửi: {formatDate(p.createdAt)} ({timeAgo(p.createdAt)})
                  </span>
                  <PaymentActionRow
                    id={p.id}
                    userName={p.user.name ?? ""}
                    userEmail={p.user.email}
                    paymentType={p.type}
                    userBankInfo={{
                      bankName: p.user.bankName,
                      accountNumber: p.user.bankAccountNumber,
                      accountName: p.user.bankAccountName,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recently processed */}
      {recentProcessed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-brand-500 uppercase tracking-wide">Đã xử lý gần đây</h2>
          <div className="bg-white border border-brand-200 rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-brand-200 text-xs text-brand-500 font-medium">
                  <th className="text-left px-4 py-3">Người dùng</th>
                  <th className="text-left px-4 py-3">Loại</th>
                  <th className="text-left px-4 py-3">Số tiền</th>
                  <th className="text-left px-4 py-3">Trạng thái</th>
                  <th className="text-left px-4 py-3">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {recentProcessed.map((p) => {
                  const typeBadge = TYPE_BADGE[p.type] ?? { label: p.type, cls: "bg-gray-100 text-gray-600" }
                  const stBadge = STATUS_BADGE[p.status] ?? { label: p.status, cls: "bg-gray-100 text-gray-600" }
                  return (
                    <tr key={p.id} className="hover:bg-brand-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-900 text-xs">{p.user.name ?? "—"}</p>
                        <p className="text-brand-400 text-xs">{p.user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", typeBadge.cls)}>{typeBadge.label}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs">{formatVND(p.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", stBadge.cls)}>{stBadge.label}</span>
                        {p.failureReason && <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={p.failureReason}>Lý do: {p.failureReason}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-brand-500 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
