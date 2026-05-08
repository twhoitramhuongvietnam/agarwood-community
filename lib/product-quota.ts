import { unstable_cache } from "next/cache"
import { prisma } from "./prisma"
import { calcTier } from "./tier"
import { isPocUnlimitedMode } from "./poc-mode"
import type { Role } from "@prisma/client"

/**
 * Quota sản phẩm đăng theo tháng. Giá trị `-1` = unlimited.
 *
 * Quy tắc:
 *  - Tài khoản cơ bản   :  3 SP/tháng
 *  - Hội viên ★          : 10 SP/tháng
 *  - Hội viên ★★ Bạc     : 25 SP/tháng
 *  - Hội viên ★★★ Vàng   : unlimited
 *  - ADMIN              : unlimited
 *
 * Override qua SiteConfig keys:
 *   product_quota_guest_monthly, product_quota_vip_1_monthly, ...
 */

export const PRODUCT_QUOTA_KEYS = [
  "product_quota_guest_monthly",
  "product_quota_vip_1_monthly",
  "product_quota_vip_2_monthly",
  "product_quota_vip_3_monthly",
] as const

const DEFAULTS = {
  product_quota_guest_monthly: 3,
  product_quota_vip_1_monthly: 10,
  product_quota_vip_2_monthly: 25,
  product_quota_vip_3_monthly: -1,
} as const

let cached: { values: Record<string, number>; ts: number } | null = null
const CACHE_TTL = 60_000

async function loadProductQuotaConfig(): Promise<Record<string, number>> {
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.values

  const rows = await prisma.siteConfig.findMany({
    where: { key: { in: [...PRODUCT_QUOTA_KEYS] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]))

  const values: Record<string, number> = {}
  for (const k of PRODUCT_QUOTA_KEYS) {
    values[k] = Number.isFinite(map[k]) ? map[k] : DEFAULTS[k]
  }

  cached = { values, ts: Date.now() }
  return values
}

/** Force-refresh cache (gọi sau khi admin lưu cài đặt) */
export function clearProductQuotaCache() {
  cached = null
}

/**
 * Trả về quota SP/tháng cho 1 user. `-1` = unlimited.
 */
export async function getMonthlyProductQuota(args: {
  role: Role
  contributionTotal?: number
  accountType?: "BUSINESS" | "INDIVIDUAL"
}): Promise<number> {
  // PoC mode: mọi account đã kích hoạt đều unlimit. Xem lib/poc-mode.ts để tắt.
  if (isPocUnlimitedMode()) return -1
  if (args.role === "ADMIN" || args.role === "INFINITE") return -1

  const config = await loadProductQuotaConfig()

  if (args.role === "GUEST") return config.product_quota_guest_monthly

  const tier = calcTier(args.contributionTotal ?? 0)
  if (tier.stars >= 3) return config.product_quota_vip_3_monthly
  if (tier.stars >= 2) return config.product_quota_vip_2_monthly
  return config.product_quota_vip_1_monthly
}

export type ProductQuotaUsage = {
  used: number
  limit: number
  remaining: number
  resetAt: Date
}

/** Đếm số SP đã đăng trong tháng hiện tại + tính remaining.
 *  Cache 60s per-user — invalidate qua `revalidateTag(\`quota:${userId}\`)`
 *  trong action tạo SP (xem app/(member)/san-pham/_actions.ts). */
export async function getProductQuotaUsage(userId: string): Promise<ProductQuotaUsage> {
  const cached = await unstable_cache(
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, contributionTotal: true, accountType: true },
      })
      if (!user) {
        return { used: 0, limit: 0, remaining: 0, resetAtIso: startOfNextMonth().toISOString() }
      }

      const limit = await getMonthlyProductQuota({
        role: user.role,
        contributionTotal: user.contributionTotal,
        accountType: user.accountType,
      })

      const monthStart = startOfMonth()
      const used = await prisma.product.count({
        where: {
          ownerId: userId,
          createdAt: { gte: monthStart },
        },
      })

      return {
        used,
        limit,
        remaining: limit === -1 ? -1 : Math.max(0, limit - used),
        resetAtIso: startOfNextMonth().toISOString(),
      }
    },
    ["quota_product_usage", userId],
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
