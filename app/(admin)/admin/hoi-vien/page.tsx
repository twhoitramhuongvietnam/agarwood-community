import { prisma } from "@/lib/prisma"
import { getTierThresholds } from "@/lib/tier"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { MemberActionCell } from "./MemberActionCell"
import type { Role } from "@prisma/client"

export const revalidate = 0 // per-request — readOnly state phụ thuộc role

const PAGE_SIZE = 20

function getMembershipStatus(user: {
  isActive: boolean
  membershipExpires: Date | null
}): { label: string; cls: string; sort: number } {
  // Thứ tự ưu tiên: state nào mô tả membership chính xác nhất.
  // `expires=null` → membership chưa từng được kích hoạt → "Chờ kích hoạt"
  // bất kể account on/off (admin chỉ cần activate là xong cả 2). Đặt check
  // này TRƯỚC `!isActive` để tab "Chờ kích hoạt" và cell trạng thái khớp
  // nhau (xem note ở filter `pending` bên dưới).
  if (!user.membershipExpires) {
    return { label: "Chờ kích hoạt", cls: "bg-blue-100 text-blue-700", sort: 3 }
  }
  if (!user.isActive) {
    return { label: "Vô hiệu hoá", cls: "bg-gray-100 text-gray-600", sort: 4 }
  }
  const daysLeft = Math.ceil((new Date(user.membershipExpires).getTime() - Date.now()) / (86400000))
  if (daysLeft <= 0) {
    return { label: "Đã hết hạn", cls: "bg-red-100 text-red-700", sort: 2 }
  }
  if (daysLeft <= 30) {
    return { label: `Sắp hết hạn (${daysLeft}d)`, cls: "bg-yellow-100 text-yellow-700", sort: 1 }
  }
  return { label: "Active", cls: "bg-green-100 text-green-700", sort: 0 }
}

function getTierBadge(
  contribution: number,
  accountType: string,
  biz: { silver: number; gold: number },
  ind: { silver: number; gold: number },
): { label: string; cls: string } {
  const { silver, gold } = accountType === "INDIVIDUAL" ? ind : biz
  if (contribution >= gold) return { label: "Vàng", cls: "text-yellow-700" }
  if (contribution >= silver) return { label: "Bạc", cls: "text-brand-500" }
  return { label: "—", cls: "text-brand-500" }
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q ?? ""
  const status = params.status ?? ""
  const page = Math.max(1, Number(params.page ?? 1))

  const now = new Date()
  const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: any = { role: { in: ["VIP", "GUEST", "INFINITE"] } }

  // Phase 3.7 round 4 (2026-04): mở rộng filter VIP → VIP + INFINITE.
  // Trước đây strict role="VIP" → hội viên cấp cao nhất (INFINITE) bị ẩn
  // hoàn toàn khỏi admin/hoi-vien, không quản lý được. Tab `registration`
  // giữ nguyên GUEST vì là nhóm chờ duyệt riêng.
  const VIP_LIKE = { in: ["VIP", "INFINITE"] satisfies Role[] }

  if (status === "active") {
    where = { role: VIP_LIKE, isActive: true, membershipExpires: { gt: thirtyDaysLater } }
  } else if (status === "expiring") {
    where = { role: VIP_LIKE, isActive: true, membershipExpires: { gt: now, lte: thirtyDaysLater } }
  } else if (status === "expired") {
    // Chỉ user đã từng có hạn membership và đã lapse — KHÔNG bao gồm
    // expires=null (those đang "Chờ kích hoạt", không phải "Hết hạn").
    where = { role: VIP_LIKE, isActive: true, membershipExpires: { lte: now } }
  } else if (status === "pending") {
    // Mọi user chưa từng kích hoạt membership (expires=null), bất kể account
    // on/off. Khớp đúng cell label "Chờ kích hoạt" do getMembershipStatus
    // trả về (check !expires trước !isActive).
    where = { role: VIP_LIKE, membershipExpires: null }
  } else if (status === "registration") {
    where = { role: "GUEST", isActive: false }
  } else if (status === "disabled") {
    where = { role: VIP_LIKE, isActive: false, membershipExpires: { not: null } }
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
    ]
  }

  // Counts for header + tabs
  const [
    members,
    total,
    countAll,
    countActive,
    countExpiring,
    countExpired,
    countPending,
    countDisabled,
    countRegistration,
    maxSlotCfg,
  ] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: [{ contributionTotal: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        isActive: true,
        membershipExpires: true,
        contributionTotal: true,
        role: true,
        accountType: true,
        company: { select: { name: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { role: VIP_LIKE } }),
    prisma.user.count({ where: { role: VIP_LIKE, isActive: true, membershipExpires: { gt: thirtyDaysLater } } }),
    prisma.user.count({ where: { role: VIP_LIKE, isActive: true, membershipExpires: { gt: now, lte: thirtyDaysLater } } }),
    prisma.user.count({ where: { role: VIP_LIKE, isActive: true, membershipExpires: { lte: now } } }),
    prisma.user.count({ where: { role: VIP_LIKE, membershipExpires: null } }),
    prisma.user.count({ where: { role: VIP_LIKE, isActive: false, membershipExpires: { not: null } } }),
    prisma.user.count({ where: { role: "GUEST", isActive: false } }),
    prisma.siteConfig.findUnique({ where: { key: "max_vip_accounts" } }),
  ])

  const maxSlot = Number(maxSlotCfg?.value ?? 100)
  const [bizTier, indTier] = await Promise.all([
    getTierThresholds("BUSINESS"),
    getTierThresholds("INDIVIDUAL"),
  ])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const tabs = [
    { key: "",             label: "Tất cả",         count: countAll },
    { key: "registration", label: "Chờ duyệt",      count: countRegistration },
    { key: "active",       label: "Active",          count: countActive },
    { key: "expiring",     label: "Sắp hết hạn",    count: countExpiring },
    { key: "expired",      label: "Hết hạn",         count: countExpired },
    { key: "pending",      label: "Chờ kích hoạt",   count: countPending },
    { key: "disabled",     label: "Vô hiệu hoá",    count: countDisabled },
  ]

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    if (q) p.set("q", q)
    if (status) p.set("status", status)
    if (page > 1) p.set("page", String(page))
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== "") p.set(k, v)
      else p.delete(k)
    }
    return `/admin/hoi-vien${p.toString() ? `?${p}` : ""}`
  }

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Quản lý Hội viên</h1>
          <p className="text-sm text-brand-500 mt-1">
            <span className="font-semibold text-brand-700">{countAll}/{maxSlot}</span> slot
            {countExpiring > 0 && <span className="ml-2 text-yellow-700">· {countExpiring} sắp hết hạn</span>}
            {countPending > 0 && <span className="ml-2 text-blue-700">· {countPending} chờ kích hoạt</span>}
          </p>
        </div>
        <Link
          href="/admin/hoi-vien/tao-moi"
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors shrink-0",
            countAll >= maxSlot ? "bg-brand-400 cursor-not-allowed" : "bg-brand-700 hover:bg-brand-800",
          )}
          {...(countAll >= maxSlot ? { "aria-disabled": true, tabIndex: -1 } : {})}
        >
          + Tạo hội viên mới
        </Link>
      </div>

      {/* ── Slot warning ────────────────────────────────────────────────── */}
      {countAll >= maxSlot && (
        <div className="rounded-xl border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 font-medium">
          Đã đạt giới hạn {maxSlot} tài khoản VIP. Tăng giới hạn tại Cài đặt.
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form method="GET" className="flex-1">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Tìm tên, email, công ty..."
            className="w-full rounded-lg border border-brand-200 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          {status && <input type="hidden" name="status" value={status} />}
        </form>

        <div className="flex gap-1 rounded-lg border border-brand-200 bg-brand-50 p-1 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={buildUrl({ status: t.key || undefined, page: undefined })}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                status === t.key ? "bg-brand-700 text-white" : "text-brand-700 hover:bg-brand-100",
              )}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1 opacity-70">{t.count}</span>}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-brand-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-brand-800">Hội viên</th>
              <th className="px-4 py-3 text-left font-semibold text-brand-800 hidden sm:table-cell">Doanh nghiệp</th>
              <th className="px-4 py-3 text-left font-semibold text-brand-800">Đóng góp</th>
              <th className="px-4 py-3 text-left font-semibold text-brand-800">Trạng thái</th>
              <th className="px-4 py-3 text-left font-semibold text-brand-800 hidden md:table-cell">Hết hạn</th>
              <th className="px-4 py-3 text-right font-semibold text-brand-800">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-brand-400">
                  Không tìm thấy hội viên nào
                </td>
              </tr>
            )}
            {members.map((m) => {
              const st = getMembershipStatus(m)
              const tier = getTierBadge(m.contributionTotal, m.accountType, bizTier, indTier)
              const expires = m.membershipExpires
                ? new Date(m.membershipExpires).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
                : "—"
              return (
                <tr key={m.id} className="hover:bg-brand-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/hoi-vien/${m.id}`} className="flex items-center gap-3 group">
                      <div className="relative w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center shrink-0 overflow-hidden">
                        {m.avatarUrl ? (
                          <Image src={m.avatarUrl} alt="" fill className="object-cover" sizes="32px" />
                        ) : (
                          <span className="text-xs font-bold text-brand-800">{m.name[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-brand-900 group-hover:text-brand-700 transition-colors truncate">{m.name}</p>
                        <p className="text-sm text-brand-500 truncate">{m.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-brand-500 hidden sm:table-cell">{m.company?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-brand-800">{(m.contributionTotal / 1_000_000).toFixed(1)}M</span>
                    {tier.label !== "—" && (
                      <span className={cn("ml-1.5 text-xs font-semibold", tier.cls)}>{tier.label}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-sm font-medium", st.cls)}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-500 hidden md:table-cell">{expires}</td>
                  <td className="px-4 py-3">
                    <MemberActionCell memberId={m.id} memberName={m.name} isActive={m.isActive} isRegistration={m.role === "GUEST" && !m.isActive} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-brand-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
          </p>
          <div className="flex gap-1">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })} className="rounded-md border border-brand-200 px-3 py-1.5 hover:bg-brand-50">
                &larr;
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
              .map((p) => (
                <Link
                  key={p}
                  href={buildUrl({ page: String(p) })}
                  className={cn(
                    "rounded-md border px-3 py-1.5 transition-colors",
                    p === page ? "bg-brand-700 text-white border-brand-700" : "border-brand-200 hover:bg-brand-50",
                  )}
                >
                  {p}
                </Link>
              ))}
            {page < totalPages && (
              <Link href={buildUrl({ page: String(page + 1) })} className="rounded-md border border-brand-200 px-3 py-1.5 hover:bg-brand-50">
                &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      <p className="text-sm text-brand-500">Không có chức năng xoá tài khoản. Chỉ vô hiệu hoá.</p>
    </div>
  )
}
