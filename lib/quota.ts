import { prisma } from "./prisma"
import { calcTier } from "./tier"
import { isPocUnlimitedMode } from "./poc-mode"
import type { Role } from "@prisma/client"

/**
 * Quota bài đăng theo tháng. Giá trị `-1` = unlimited.
 *
 * Quy tắc (Phase 2):
 *  - Tài khoản cơ bản   :  5 bài/tháng
 *  - Hội viên ★          : 15 bài/tháng
 *  - Hội viên ★★ Bạc     : 30 bài/tháng
 *  - Hội viên ★★★ Vàng   : unlimited
 *  - ADMIN              : unlimited
 *
 * Số quota có thể override qua SiteConfig keys:
 *   quota_guest_monthly, quota_vip_1_monthly, quota_vip_2_monthly, quota_vip_3_monthly
 */

export const QUOTA_KEYS = [
  "quota_guest_monthly",
  "quota_vip_1_monthly",
  "quota_vip_2_monthly",
  "quota_vip_3_monthly",
] as const

const DEFAULTS = {
  quota_guest_monthly: 5,
  quota_vip_1_monthly: 15,
  quota_vip_2_monthly: 30,
  quota_vip_3_monthly: -1,
} as const

// Cache 60s để tránh query SiteConfig trên mỗi POST
let cached: { values: Record<string, number>; ts: number } | null = null
const CACHE_TTL = 60_000

async function loadQuotaConfig(): Promise<Record<string, number>> {
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.values

  const rows = await prisma.siteConfig.findMany({
    where: { key: { in: [...QUOTA_KEYS] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]))

  const values: Record<string, number> = {}
  for (const k of QUOTA_KEYS) {
    values[k] = Number.isFinite(map[k]) ? map[k] : DEFAULTS[k]
  }

  cached = { values, ts: Date.now() }
  return values
}

/** Force-refresh cache (gọi sau khi admin lưu cài đặt) */
export function clearQuotaCache() {
  cached = null
}

/**
 * Trả về quota tháng cho 1 user. `-1` = unlimited.
 * Cần biết role + (nếu VIP) contributionTotal + accountType để tính tier.
 */
export async function getMonthlyQuota(args: {
  role: Role
  contributionTotal?: number
  accountType?: "BUSINESS" | "INDIVIDUAL"
}): Promise<number> {
  // PoC mode: mọi account đã kích hoạt đều unlimit. Xem lib/poc-mode.ts để tắt.
  if (isPocUnlimitedMode()) return -1
  if (args.role === "ADMIN" || args.role === "INFINITE") return -1

  const config = await loadQuotaConfig()

  if (args.role === "GUEST") return config.quota_guest_monthly

  // VIP — quota theo tier (số sao)
  const tier = calcTier(args.contributionTotal ?? 0)
  // tier.stars: 1 = base, 2 = Bạc, 3 = Vàng (cũng dùng cho INDIVIDUAL với threshold riêng nếu cần)
  // accountType reserved cho future override; hiện tại dùng chung quota config
  void args.accountType
  if (tier.stars >= 3) return config.quota_vip_3_monthly
  if (tier.stars >= 2) return config.quota_vip_2_monthly
  return config.quota_vip_1_monthly
}

export type QuotaUsage = {
  used: number
  limit: number // -1 = unlimited
  remaining: number // -1 = unlimited
  resetAt: Date // đầu tháng tiếp theo
}

/** Đếm số bài đã đăng trong tháng hiện tại + tính remaining. */
export async function getQuotaUsage(userId: string): Promise<QuotaUsage> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, contributionTotal: true, accountType: true },
  })
  if (!user) {
    return { used: 0, limit: 0, remaining: 0, resetAt: startOfNextMonth() }
  }

  const limit = await getMonthlyQuota({
    role: user.role,
    contributionTotal: user.contributionTotal,
    accountType: user.accountType,
  })

  const monthStart = startOfMonth()
  const used = await prisma.post.count({
    where: {
      authorId: userId,
      createdAt: { gte: monthStart },
      // Đếm mọi post user đã tạo trong tháng — gồm cả PENDING (chờ duyệt
      // mặc định cho non-admin sau migration post_status_pending_default).
      // Loại trừ DELETED để chống gian lận xóa-rồi-đăng-lại để reset quota.
      // LOCKED (admin reject hoặc auto-lock từ report) vẫn count vì user đã
      // "dùng" lượt đăng đó. PENDING count vì nếu không, user sẽ thấy quota
      // không giảm sau khi vừa đăng → confusing UX.
      status: { not: "DELETED" },
    },
  })

  return {
    used,
    limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - used),
    resetAt: startOfNextMonth(),
  }
}

export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export function startOfNextMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0)
}
