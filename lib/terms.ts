import "server-only"
import type { Prisma, PrismaClient } from "@prisma/client"
import { TermsType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import registration_v1 from "@/content/terms/registration_v1"
import product_listing_v1 from "@/content/terms/product_listing_v1"

/**
 * Registry điều khoản — mỗi (type, version) trỏ tới 1 file content/terms/<type>_<version>.ts.
 *
 * Khi cần ra phiên bản mới:
 * 1. Copy file v1 → v2, sửa nội dung, update `version` + `effectiveDate`.
 * 2. Import file v2 ở đây và thêm vào TERMS_REGISTRY.
 * 3. Bump CURRENT_VERSION[type] sang "v2".
 * Row TermsAcceptance cũ vẫn trỏ về "v1" → có thể trace user đã đồng ý nội dung nào.
 */

export type TermsTypeKey = keyof typeof TermsType

export type TermsDocument = {
  type: TermsTypeKey
  version: string
  effectiveDate: string // ISO date "YYYY-MM-DD"
  title: string
  html: string
}

const TERMS_REGISTRY: Record<TermsTypeKey, Record<string, TermsDocument>> = {
  REGISTRATION: {
    v1: registration_v1,
  },
  PRODUCT_LISTING: {
    v1: product_listing_v1,
  },
}

/** Phiên bản hiện hành cho mỗi loại điều khoản — checkbox UI luôn yêu cầu version này. */
export const CURRENT_VERSION: Record<TermsTypeKey, string> = {
  REGISTRATION: "v1",
  PRODUCT_LISTING: "v1",
}

/** Trả về document hoặc null nếu không tìm thấy. */
export function getTermsDocument(
  type: TermsTypeKey,
  version: string,
): TermsDocument | null {
  return TERMS_REGISTRY[type]?.[version] ?? null
}

/** Trả về document phiên bản hiện hành. */
export function getCurrentTerms(type: TermsTypeKey): TermsDocument {
  const doc = getTermsDocument(type, CURRENT_VERSION[type])
  if (!doc) {
    throw new Error(`Missing current terms document for type=${type}`)
  }
  return doc
}

/** Danh sách tất cả versions của 1 type — dùng cho admin filter. */
export function listVersions(type: TermsTypeKey): string[] {
  return Object.keys(TERMS_REGISTRY[type] ?? {}).sort()
}

/**
 * Lấy IP client từ headers — ưu tiên Vercel `x-forwarded-for`, fallback `x-real-ip`.
 * Không throw nếu không có — trả về null để insert ipAddress=null.
 */
export function getClientIpFromHeaders(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]?.trim() || null
  const xri = headers.get("x-real-ip")
  if (xri) return xri.trim() || null
  return null
}

type TxOrPrisma = PrismaClient | Prisma.TransactionClient

type RecordAcceptanceInput = {
  userId: string
  type: TermsTypeKey
  version: string
  ipAddress?: string | null
  userAgent?: string | null
  /** productId khi type=PRODUCT_LISTING; null khi REGISTRATION. */
  contextRef?: string | null
}

/**
 * Ghi 1 row TermsAcceptance. Validate version có thật trong registry —
 * tránh ghi pointer "v9" trỏ vào file không tồn tại.
 *
 * Truyền `client` = tx khi gọi trong $transaction để đảm bảo atomic với
 * action chính (vd user.create / product.create). Bỏ trống → dùng prisma global.
 */
export async function recordTermsAcceptance(
  input: RecordAcceptanceInput,
  client: TxOrPrisma = prisma,
) {
  const { userId, type, version, ipAddress, userAgent, contextRef } = input

  if (!getTermsDocument(type, version)) {
    throw new Error(
      `Cannot record acceptance: terms ${type}@${version} not in registry`,
    )
  }

  return client.termsAcceptance.create({
    data: {
      userId,
      type,
      version,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent?.slice(0, 1000) ?? null, // cap UA length
      contextRef: contextRef ?? null,
    },
  })
}
