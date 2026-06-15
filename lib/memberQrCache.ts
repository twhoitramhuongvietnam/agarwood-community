import QRCode from "qrcode"
import { unstable_cache } from "next/cache"

/**
 * QR data URL cho thẻ hội viên — deterministic theo (memberId, siteUrl), một
 * khi đã gen thì không bao giờ cần gen lại.
 *
 * Trước khi có cache: 59 members × ~8-15ms = ~500-900ms CPU mỗi lần render
 * trang /hoi-vien (kể cả cold-start lẫn ISR revalidation mỗi 10 phút).
 *
 * Sau khi cache (24h TTL, tag "member-qr"): chỉ gen một lần cho mỗi
 * member — revalidation page cũng giữ nguyên QR cũ.
 */
export const getMemberQrDataUrl = unstable_cache(
  async (memberId: string, siteUrl: string): Promise<string | null> => {
    const verifyUrl = `${siteUrl}/hoi-vien/${memberId}`
    try {
      return await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 256,
        color: { dark: "#000", light: "#fff" },
      })
    } catch {
      return null
    }
  },
  ["member-qr"],
  { revalidate: 86400, tags: ["member-qr"] },
)

/**
 * QR cho thẻ hội viên BẢN IN (errorCorrectionLevel "H", 512px) — to & chống lỗi
 * cao hơn bản list. Trang /hoi-vien/[id]/the-in dùng getLocale() (đọc header)
 * nên bị ép dynamic → không ISR được; nếu gen QR mỗi request thì raster "H"/512
 * tốn ~15-30ms CPU/lần. Cache deterministic theo (memberId, siteUrl) → chỉ gen
 * một lần, mọi request sau lấy lại từ cache.
 */
export const getMemberCardQrDataUrl = unstable_cache(
  async (memberId: string, siteUrl: string): Promise<string | null> => {
    const verifyUrl = `${siteUrl}/hoi-vien/${memberId}`
    try {
      return await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 512,
        color: { dark: "#000", light: "#fff" },
      })
    } catch {
      return null
    }
  },
  ["member-card-qr"],
  { revalidate: 86400, tags: ["member-qr"] },
)
