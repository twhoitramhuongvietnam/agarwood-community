/**
 * Service quota fetchers — đọc usage từ Cloudinary / GDrive / Supabase tự
 * động qua API. Vercel free tier không có public usage API → admin nhập tay
 * qua /admin/giam-sat (xem `submitManualSnapshot()`).
 *
 * Mỗi fetcher trả về `Snapshot[]` (1 service có thể có nhiều metric: storage,
 * bandwidth, transformations,...). Cron route gọi tất cả + bulk insert vào
 * `service_quota_snapshots` table.
 */
import { v2 as cloudinary } from "cloudinary"
import { google } from "googleapis"
import { prisma } from "./prisma"
import type { ServiceQuotaService, ServiceQuotaSource } from "@prisma/client"

export type Snapshot = {
  service: ServiceQuotaService
  metric: string
  used: bigint
  limit: bigint
  unit: string
  source: ServiceQuotaSource
  note?: string | null
}

/** Extract message từ unknown error — Cloudinary SDK throw object dạng
 *  `{ error: { message, http_code }, ... }` không inherit Error → `e.message`
 *  ra undefined. Hàm này check nhiều shape phổ biến. */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message || e.name || "Error"
  if (typeof e === "string") return e
  if (e && typeof e === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = e as any
    if (typeof obj.message === "string") return obj.message
    if (obj.error && typeof obj.error.message === "string") {
      return `${obj.error.message}${obj.error.http_code ? ` (HTTP ${obj.error.http_code})` : ""}`
    }
    try {
      return JSON.stringify(e).slice(0, 300)
    } catch {
      return String(e)
    }
  }
  return String(e)
}

// ── Cloudinary ───────────────────────────────────────────────────────────────
// Free tier (2025): 25 credits/month — 1 credit = 1GB storage hoặc 1GB
// bandwidth hoặc 1000 transformations. API `/usage` trả raw numbers cho từng
// resource — chuyển sang quota chuẩn.
//
// API endpoint: GET https://api.cloudinary.com/v1_1/{cloud_name}/usage
// Auth: Basic (api_key:api_secret) — đã có sẵn cho upload route.

const CLOUDINARY_FREE_STORAGE_GB = 25
const CLOUDINARY_FREE_BANDWIDTH_GB = 25
const CLOUDINARY_FREE_TRANSFORMATIONS = 25_000

export async function fetchCloudinaryUsage(): Promise<Snapshot[]> {
  const missing: string[] = []
  if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push("CLOUDINARY_CLOUD_NAME")
  if (!process.env.CLOUDINARY_API_KEY) missing.push("CLOUDINARY_API_KEY")
  if (!process.env.CLOUDINARY_API_SECRET) missing.push("CLOUDINARY_API_SECRET")
  if (missing.length > 0) {
    return [
      {
        service: "CLOUDINARY",
        metric: "config_missing",
        used: BigInt(0),
        limit: BigInt(0),
        unit: "count",
        source: "AUTO",
        note: `Thiếu env: ${missing.join(", ")}`,
      },
    ]
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  // SDK trả raw object — type any vì shape không declared trong @types.
  // Catch nội bộ vì SDK throw `{error:{message,http_code}}` không phải Error
  // chuẩn → caller `fetchAllServiceUsage` không extract đúng message.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any
  try {
    res = await cloudinary.api.usage()
  } catch (e) {
    return [
      {
        service: "CLOUDINARY",
        metric: "fetch_error",
        used: BigInt(0),
        limit: BigInt(0),
        unit: "count",
        source: "AUTO",
        note: `Cloudinary /usage failed: ${errorMessage(e)}`,
      },
    ]
  }

  const snapshots: Snapshot[] = []

  // Storage tính theo bytes — limit 25GB cho free tier.
  if (res.storage?.usage != null) {
    snapshots.push({
      service: "CLOUDINARY",
      metric: "storage_bytes",
      used: BigInt(res.storage.usage),
      limit: BigInt(CLOUDINARY_FREE_STORAGE_GB) * BigInt(1024) * BigInt(1024) * BigInt(1024),
      unit: "bytes",
      source: "AUTO",
    })
  }
  // Bandwidth tháng hiện tại
  if (res.bandwidth?.usage != null) {
    snapshots.push({
      service: "CLOUDINARY",
      metric: "bandwidth_bytes_monthly",
      used: BigInt(res.bandwidth.usage),
      limit: BigInt(CLOUDINARY_FREE_BANDWIDTH_GB) * BigInt(1024) * BigInt(1024) * BigInt(1024),
      unit: "bytes",
      source: "AUTO",
    })
  }
  // Transformations tháng hiện tại
  if (res.transformations?.usage != null) {
    snapshots.push({
      service: "CLOUDINARY",
      metric: "transformations_monthly",
      used: BigInt(res.transformations.usage),
      limit: BigInt(CLOUDINARY_FREE_TRANSFORMATIONS),
      unit: "count",
      source: "AUTO",
    })
  }
  return snapshots
}

// ── Google Drive ─────────────────────────────────────────────────────────────
// `about.get({ fields: "storageQuota" })` trả `{ limit, usage, usageInDrive,
// usageInDriveTrash }`. Gmail account free tier = 15GB shared trên Drive +
// Gmail + Photos. Workspace bumped (30GB+) có quota riêng.

export async function fetchGoogleDriveUsage(): Promise<Snapshot[]> {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    return [
      {
        service: "GDRIVE",
        metric: "config_missing",
        used: BigInt(0),
        limit: BigInt(0),
        unit: "count",
        source: "AUTO",
        note: "Thiếu GOOGLE_DRIVE_REFRESH_TOKEN/CLIENT_ID/CLIENT_SECRET",
      },
    ]
  }

  const oauth = new google.auth.OAuth2(clientId, clientSecret)
  oauth.setCredentials({ refresh_token: refreshToken })
  const drive = google.drive({ version: "v3", auth: oauth })
  const res = await drive.about.get({ fields: "storageQuota" })
  const q = res.data.storageQuota

  if (!q?.limit || !q?.usage) {
    return [
      {
        service: "GDRIVE",
        metric: "storage_bytes",
        used: BigInt(0),
        limit: BigInt(0),
        unit: "bytes",
        source: "AUTO",
        note: "Drive trả storageQuota rỗng — có thể do Workspace unlimited",
      },
    ]
  }

  return [
    {
      service: "GDRIVE",
      metric: "storage_bytes",
      used: BigInt(q.usage),
      limit: BigInt(q.limit),
      unit: "bytes",
      source: "AUTO",
    },
  ]
}

// ── Supabase / Postgres ──────────────────────────────────────────────────────
// Free tier: 500MB DB + 50k MAU + 1GB file storage + 2GB egress.
// Đo qua DB query trực tiếp (đã có connection):
//  - `pg_database_size(current_database())` cho DB size
//  - `auth.users` count cho MAU proxy
// (File storage + egress không trace được từ DB → để dạng MANUAL nếu cần.)

const SUPABASE_FREE_DB_BYTES = BigInt(500) * BigInt(1024) * BigInt(1024)
const SUPABASE_FREE_USERS = BigInt(50_000)

export async function fetchSupabaseUsage(): Promise<Snapshot[]> {
  const snapshots: Snapshot[] = []

  // pg_database_size — query raw qua $queryRaw vì Prisma không có wrapper.
  try {
    const rows = await prisma.$queryRaw<Array<{ size: bigint }>>`
      SELECT pg_database_size(current_database())::bigint AS size
    `
    if (rows[0]?.size != null) {
      snapshots.push({
        service: "SUPABASE",
        metric: "db_size_bytes",
        used: rows[0].size,
        limit: SUPABASE_FREE_DB_BYTES,
        unit: "bytes",
        source: "AUTO",
      })
    }
  } catch (e) {
    snapshots.push({
      service: "SUPABASE",
      metric: "db_size_bytes",
      used: BigInt(0),
      limit: SUPABASE_FREE_DB_BYTES,
      unit: "bytes",
      source: "AUTO",
      note: `Lỗi query pg_database_size: ${(e as Error).message}`,
    })
  }

  // auth.users count — proxy cho MAU (free tier 50k). Schema "auth" có thể
  // không tồn tại trên local Postgres không-Supabase → catch + ghi note.
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM auth.users
    `
    if (rows[0]?.count != null) {
      snapshots.push({
        service: "SUPABASE",
        metric: "auth_users",
        used: rows[0].count,
        limit: SUPABASE_FREE_USERS,
        unit: "count",
        source: "AUTO",
      })
    }
  } catch {
    // Local Postgres không có schema auth → fallback đếm User table app.
    try {
      const userCount = await prisma.user.count()
      snapshots.push({
        service: "SUPABASE",
        metric: "auth_users",
        used: BigInt(userCount),
        limit: SUPABASE_FREE_USERS,
        unit: "count",
        source: "AUTO",
        note: "Local DB không có auth schema — đếm User table thay",
      })
    } catch {
      // bỏ qua, không thêm snapshot lỗi
    }
  }

  return snapshots
}

// ── Vercel ───────────────────────────────────────────────────────────────────
// Free Hobby plan KHÔNG có public Usage API → fetcher trả stub note. Dashboard
// /admin/giam-sat render link trực tiếp tới Vercel Usage page; admin click
// xem số trên Vercel UI (browser tự xử OAuth, mình không force account được).
// Khuyến nghị: bật Vercel email notifications (Settings → Notifications) để
// nhận cảnh báo 75% / 90% / 100%.

export async function fetchVercelUsage(): Promise<Snapshot[]> {
  return [
    {
      service: "VERCEL",
      metric: "external_dashboard_only",
      used: BigInt(0),
      limit: BigInt(0),
      unit: "count",
      source: "AUTO",
      note: "Vercel Hobby không có Usage API public — xem số trực tiếp trên Vercel Dashboard (link bên dưới). Khuyến nghị bật Vercel email notifications để nhận cảnh báo ngưỡng.",
    },
  ]
}

// ── Bulk fetcher ─────────────────────────────────────────────────────────────

/** Gọi tất cả fetcher song song, return flat array. Lỗi 1 service không stop
 *  service khác — convert sang snapshot có note error để admin biết. */
export async function fetchAllServiceUsage(): Promise<Snapshot[]> {
  const services: { name: ServiceQuotaService; fn: () => Promise<Snapshot[]> }[] = [
    { name: "CLOUDINARY", fn: fetchCloudinaryUsage },
    { name: "GDRIVE", fn: fetchGoogleDriveUsage },
    { name: "SUPABASE", fn: fetchSupabaseUsage },
    { name: "VERCEL", fn: fetchVercelUsage },
  ]
  const results = await Promise.all(
    services.map(async (s) => {
      try {
        return await s.fn()
      } catch (e) {
        return [
          {
            service: s.name,
            metric: "fetch_error",
            used: BigInt(0),
            limit: BigInt(0),
            unit: "count",
            source: "AUTO" as ServiceQuotaSource,
            note: `Fetch failed: ${errorMessage(e)}`,
          },
        ]
      }
    }),
  )
  return results.flat()
}

/** Persist vào DB. */
export async function saveSnapshots(snapshots: Snapshot[]) {
  if (snapshots.length === 0) return 0
  await prisma.serviceQuotaSnapshot.createMany({
    data: snapshots.map((s) => ({
      service: s.service,
      metric: s.metric,
      used: s.used,
      limit: s.limit,
      unit: s.unit,
      source: s.source,
      note: s.note ?? null,
    })),
  })
  return snapshots.length
}
