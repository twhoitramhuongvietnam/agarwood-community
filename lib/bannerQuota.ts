import { unstable_cache } from "next/cache"
import { prisma } from "./prisma"
import type { Role } from "@prisma/client"

/**
 * Quota banner mỗi tháng theo tier (Phase 6).
 *
 * Quy tắc (chốt 04/2026):
 *  - Tài khoản cơ bản   :  1 mẫu/tháng
 *  - Hội viên ★          :  5 mẫu/tháng
 *  - Hội viên ★★ Bạc     : 10 mẫu/tháng
 *  - Hội viên ★★★ Vàng   : 20 mẫu/tháng
 *  - ADMIN              : unlimited (-1)
 *
 * Override qua SiteConfig:
 *   banner_quota_guest, banner_quota_vip_1, banner_quota_vip_2, banner_quota_vip_3
 *
 * Giá: flat 1tr/mẫu/tháng (key `banner_price_per_month`).
 *
 * Quy tắc đếm:
 *  - Đếm số banner CREATED trong tháng hiện tại (theo `createdAt`)
 *  - Bao gồm tất cả status (PENDING_PAYMENT, PENDING_APPROVAL, ACTIVE, REJECTED)
 *  - KHÔNG đếm gia hạn (renew chỉ extend endDate, không tạo Banner mới)
 *  - Reset 0h ngày 1 hằng tháng
 */

export const BANNER_QUOTA_KEYS = [
  "banner_quota_guest",
  "banner_quota_vip_1",
  "banner_quota_vip_2",
  "banner_quota_vip_3",
] as const

export const BANNER_PRICE_KEY = "banner_price_per_month"

const QUOTA_DEFAULTS = {
  banner_quota_guest: 1,
  banner_quota_vip_1: 5,
  banner_quota_vip_2: 10,
  banner_quota_vip_3: 20,
} as const

const PRICE_DEFAULT = 1_000_000

// Cache 60s để tránh query SiteConfig trên mỗi POST
let cached: { quota: Record<string, number>; price: number; ts: number } | null = null
const CACHE_TTL = 60_000

async function loadConfig() {
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached

  const rows = await prisma.siteConfig.findMany({
    where: { key: { in: [...BANNER_QUOTA_KEYS, BANNER_PRICE_KEY] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]))

  const quota: Record<string, number> = {}
  for (const k of BANNER_QUOTA_KEYS) {
    quota[k] = Number.isFinite(map[k]) ? map[k] : QUOTA_DEFAULTS[k]
  }
  const price = Number.isFinite(map[BANNER_PRICE_KEY]) ? map[BANNER_PRICE_KEY] : PRICE_DEFAULT

  cached = { quota, price, ts: Date.now() }
  return cached
}

export function clearBannerQuotaCache() {
  cached = null
}

/** Trả về quota tháng cho 1 user. `-1` = unlimited. */
export async function getBannerMonthlyQuota(args: {
  role: Role
  contributionTotal?: number
}): Promise<number> {
  if (args.role === "ADMIN" || args.role === "INFINITE") return -1

  const { quota } = await loadConfig()

  if (args.role === "GUEST") return quota.banner_quota_guest

  // VIP — quota theo tier (số sao tính từ contributionTotal)
  // Tận dụng cùng ngưỡng với membership tier (10tr / 20tr)
  const total = args.contributionTotal ?? 0
  if (total >= 20_000_000) return quota.banner_quota_vip_3 // Vàng
  if (total >= 10_000_000) return quota.banner_quota_vip_2 // Bạc
  return quota.banner_quota_vip_1 // ★
}

/** Trả về giá 1 tháng banner (VND). */
export async function getBannerPricePerMonth(): Promise<number> {
  const { price } = await loadConfig()
  return price
}

export type BannerQuotaUsage = {
  used: number
  limit: number // -1 = unlimited
  remaining: number // -1 = unlimited
  resetAt: Date // đầu tháng tiếp theo
}

/** Đếm số banner đã đăng ký trong tháng hiện tại + tính remaining.
 *  Cache 60s per-user — invalidate qua `revalidateTag(\`quota:${userId}\`)`
 *  trong route tạo banner (xem app/api/banner/route.ts). */
export async function getBannerQuotaUsage(userId: string): Promise<BannerQuotaUsage> {
  const cached = await unstable_cache(
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, contributionTotal: true },
      })
      if (!user) {
        return { used: 0, limit: 0, remaining: 0, resetAtIso: startOfNextMonth().toISOString() }
      }

      const limit = await getBannerMonthlyQuota({
        role: user.role,
        contributionTotal: user.contributionTotal,
      })

      const monthStart = startOfMonth()
      const used = await prisma.banner.count({
        where: {
          userId,
          createdAt: { gte: monthStart },
          // KHÔNG count banner EXPIRED của tháng trước (chỉ tháng hiện tại theo createdAt)
        },
      })

      return {
        used,
        limit,
        remaining: limit === -1 ? -1 : Math.max(0, limit - used),
        resetAtIso: startOfNextMonth().toISOString(),
      }
    },
    ["quota_banner_usage", userId],
    { revalidate: 60, tags: [`quota:${userId}`, "quota"] },
  )()
  return {
    used: cached.used,
    limit: cached.limit,
    remaining: cached.remaining,
    resetAt: new Date(cached.resetAtIso),
  }
}

function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function startOfNextMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0)
}
