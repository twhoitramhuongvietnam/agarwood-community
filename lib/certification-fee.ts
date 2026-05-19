import type { ReviewMode } from "@prisma/client"

export const CERT_FEE_OFFLINE = 200_000_000
export const CERT_FEE_ONLINE_MIN = 1_000_000
export const CERT_FEE_ONLINE_MAX = 20_000_000
export const CERT_FEE_ONLINE_RATE = 0.02

/** Phí endorsement FAST_TRACK — SP đã có CN nhà nước, Hội chỉ xác minh
 *  giấy gốc + cấp endorsement, không cần HĐTĐ vote. Mức 500k đang là default;
 *  có thể move sang SiteConfig nếu khách hàng muốn admin chỉnh được. */
export const CERT_FEE_FAST_TRACK = 500_000

export function calcCertFee(mode: ReviewMode, salePriceVnd: number | null | undefined): number {
  if (mode === "OFFLINE") return CERT_FEE_OFFLINE
  if (mode === "FAST_TRACK") return CERT_FEE_FAST_TRACK
  const price = Number(salePriceVnd ?? 0)
  if (!Number.isFinite(price) || price <= 0) return CERT_FEE_ONLINE_MIN
  const raw = Math.round(price * CERT_FEE_ONLINE_RATE)
  return Math.max(CERT_FEE_ONLINE_MIN, Math.min(CERT_FEE_ONLINE_MAX, raw))
}

export function formatVnd(amount: number | bigint): string {
  return Number(amount).toLocaleString("vi-VN") + "đ"
}
