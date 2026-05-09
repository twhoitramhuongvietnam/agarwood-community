import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import {
  formatLedgerDate,
  getCurrentBalance,
  getRangeTotals,
  hasOpeningBalance,
} from "@/lib/ledger"
import { formatVnd } from "@/lib/certification-fee"
import { OpeningBalanceWizard } from "./_components/OpeningBalanceWizard"
import {
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  Wallet,
  ListChecks,
  BarChart3,
  Tags,
} from "lucide-react"

export const revalidate = 0

export default async function ThuChiDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) notFound()
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "ledger:read")) notFound()

  const canWrite = hasPermission(perms, "ledger:write")

  const opened = await hasOpeningBalance()

  if (!opened) {
    return (
      <div className="space-y-6">
        <Header canWrite={canWrite} />
        {canWrite ? (
          <OpeningBalanceWizard />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            Sổ quỹ chưa được khởi tạo. Cần admin nhập số dư đầu kỳ.
          </div>
        )}
      </div>
    )
  }

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const nextYearStart = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1))

  const [balance, monthTotals, yearTotals, recent] = await Promise.all([
    getCurrentBalance(),
    getRangeTotals(monthStart, nextMonthStart),
    getRangeTotals(yearStart, nextYearStart),
    prisma.ledgerTransaction.findMany({
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        type: true,
        amount: true,
        transactionDate: true,
        description: true,
        category: { select: { name: true } },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <Header canWrite={canWrite} />

      {/* Balance + monthly cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-linear-to-br from-brand-700 to-brand-900 text-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-brand-100 text-xs font-medium uppercase tracking-wide">
            <Wallet className="h-3.5 w-3.5" /> Số dư hiện tại
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatVnd(balance)}</p>
          <p className="mt-1 text-xs text-brand-100">
            Cập nhật {formatLedgerDate(now)}
          </p>
        </div>

        <div className="bg-white border border-brand-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-brand-500 text-xs font-medium uppercase tracking-wide">
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" /> Thu tháng này
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">
            +{formatVnd(monthTotals.income)}
          </p>
          <p className="mt-1 text-xs text-brand-500">
            {monthTotals.incomeCount} giao dịch
          </p>
        </div>

        <div className="bg-white border border-brand-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-brand-500 text-xs font-medium uppercase tracking-wide">
            <ArrowUpRight className="h-3.5 w-3.5 text-red-600" /> Chi tháng này
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700 tabular-nums">
            −{formatVnd(monthTotals.expense)}
          </p>
          <p className="mt-1 text-xs text-brand-500">
            {monthTotals.expenseCount} giao dịch
          </p>
        </div>
      </div>

      {/* Year summary */}
      <div className="bg-white border border-brand-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-brand-500 uppercase tracking-wide mb-3">
          Tổng kết năm {now.getUTCFullYear()}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-brand-500">Tổng thu</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">
              +{formatVnd(yearTotals.income)}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-500">Tổng chi</p>
            <p className="text-lg font-bold text-red-700 tabular-nums">
              −{formatVnd(yearTotals.expense)}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-500">Chênh lệch</p>
            <p
              className={`text-lg font-bold tabular-nums ${
                yearTotals.income - yearTotals.expense >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {yearTotals.income - yearTotals.expense >= 0 ? "+" : "−"}
              {formatVnd(Math.abs(yearTotals.income - yearTotals.expense))}
            </p>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white border border-brand-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-700">Giao dịch gần đây</h2>
          <Link
            href="/admin/thu-chi/so-quy"
            className="text-xs text-brand-600 hover:text-brand-800 font-medium"
          >
            Xem tất cả →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-8 text-center text-sm text-brand-500">Chưa có giao dịch nào</p>
        ) : (
          <ul className="divide-y divide-brand-100">
            {recent.map((tx) => (
              <li key={tx.id} className="px-5 py-3 flex items-center gap-3 hover:bg-brand-50/50">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    tx.type === "INCOME" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {tx.type === "INCOME" ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/admin/thu-chi/${tx.id}`}
                    className="text-sm font-medium text-brand-900 hover:text-brand-700 line-clamp-1"
                  >
                    {tx.description}
                  </Link>
                  <p className="text-xs text-brand-500">
                    {tx.category.name} · {formatLedgerDate(tx.transactionDate)}
                  </p>
                </div>
                <p
                  className={`font-bold tabular-nums text-sm whitespace-nowrap ${
                    tx.type === "INCOME" ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {tx.type === "INCOME" ? "+" : "−"}
                  {formatVnd(Number(tx.amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Header({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Sổ quỹ thu chi</h1>
        <p className="text-sm text-brand-500 mt-1">
          Quản lý ngân quỹ của Hội — ghi nhận thực tế, cập nhật hàng ngày.
        </p>
      </div>
      <nav className="flex flex-wrap gap-2">
        <NavBtn href="/admin/thu-chi/so-quy" icon={ListChecks}>
          Sổ quỹ
        </NavBtn>
        <NavBtn href="/admin/thu-chi/bao-cao" icon={BarChart3}>
          Báo cáo
        </NavBtn>
        <NavBtn href="/admin/thu-chi/danh-muc" icon={Tags}>
          Danh mục
        </NavBtn>
        {canWrite && (
          <Link
            href="/admin/thu-chi/them"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 transition-colors"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Thêm giao dịch
          </Link>
        )}
      </nav>
    </div>
  )
}

function NavBtn({
  href,
  icon: Icon,
  children,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </Link>
  )
}
