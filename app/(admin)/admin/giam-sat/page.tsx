import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { QuotaActions } from "./QuotaActions"
import type { ServiceQuotaService } from "@prisma/client"

/** Vercel team usage URL — Hobby plan không có public API, admin click để
 *  xem số trực tiếp trên Vercel UI. */
const VERCEL_TEAM_URL = "https://vercel.com/twhoitramhuongvietnam-projects/~/usage"
/** Google account đăng nhập Vercel — hint trong card để admin switch nếu
 *  Chrome đang sign-in account khác. */
const VERCEL_LOGIN_HINT = "twhoitramhuongvietnam@gmail.com"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Giám sát Free Tier | Admin",
}

const SERVICE_META: Record<
  ServiceQuotaService,
  { label: string; emoji: string; freeTierNote: string }
> = {
  CLOUDINARY: {
    label: "Cloudinary",
    emoji: "☁️",
    freeTierNote: "Free 25 credits/tháng = 25GB storage hoặc 25GB bandwidth hoặc 25k transformations",
  },
  GDRIVE: {
    label: "Google Drive",
    emoji: "📁",
    freeTierNote: "Free 15GB share Drive + Gmail + Photos (Workspace có ngưỡng riêng)",
  },
  SUPABASE: {
    label: "Supabase",
    emoji: "🗄️",
    freeTierNote: "Free 500MB DB + 50k MAU + 1GB file + 2GB egress",
  },
  VERCEL: {
    label: "Vercel",
    emoji: "▲",
    freeTierNote: "Hobby: 100GB bandwidth + 100h function + 6k build minutes / tháng",
  },
}

const ALL_SERVICES: ServiceQuotaService[] = ["CLOUDINARY", "GDRIVE", "SUPABASE", "VERCEL"]

/** Metric "stub" — fetcher dùng để báo trạng thái lỗi/cần input thay vì
 *  metric thật. Nếu service đã có metric thật mới hơn → ẩn stub.
 *  `external_dashboard_only` = Vercel Hobby (không có API), `manual_entry_required`
 *  = legacy snapshot từ trước khi bỏ manual form. */
const STUB_METRICS: ReadonlySet<string> = new Set([
  "fetch_error",
  "config_missing",
  "manual_entry_required",
  "external_dashboard_only",
])

type LatestRow = {
  id: string
  service: ServiceQuotaService
  metric: string
  used: bigint
  limit: bigint
  unit: string
  source: "AUTO" | "MANUAL"
  note: string | null
  capturedAt: Date
}

function pct(used: bigint, limit: bigint): number {
  if (limit <= BigInt(0)) return 0
  return Number((used * BigInt(10000)) / limit) / 100
}

function formatValue(value: bigint, unit: string): string {
  if (unit === "bytes") {
    const n = Number(value)
    if (n < 1024) return `${n} B`
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
    return `${(n / 1024 ** 3).toFixed(2)} GB`
  }
  return value.toLocaleString("vi-VN")
}

function metricLabel(service: ServiceQuotaService, metric: string): string {
  const map: Record<string, string> = {
    storage_bytes: "Storage",
    bandwidth_bytes_monthly: "Bandwidth (tháng)",
    transformations_monthly: "Transformations (tháng)",
    db_size_bytes: "Database size",
    auth_users: "Auth users",
    fetch_error: "⚠ Lỗi fetch",
    config_missing: "⚠ Thiếu config",
    manual_entry_required: "⚠ Cần nhập tay",
    external_dashboard_only: "ℹ Xem trên Vercel Dashboard",
  }
  void service
  return map[metric] ?? metric
}

export default async function QuotaMonitoringPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) notFound()

  // Latest snapshot mỗi (service, metric) combo. Postgres `DISTINCT ON` sẽ
  // gọn nhất, dùng raw query.
  const latest = await prisma.$queryRaw<LatestRow[]>`
    SELECT DISTINCT ON (service, metric)
      id, service, metric, used, "limit", unit, source, note, "capturedAt"
    FROM "service_quota_snapshots"
    ORDER BY service, metric, "capturedAt" DESC
  `

  // Group by service. Sau đó ẩn stub rows nếu service đã có ≥1 metric thật —
  // tránh hiện "Lỗi fetch" cũ bên cạnh progress bar mới khi đã fix lỗi.
  const byService = new Map<ServiceQuotaService, LatestRow[]>()
  for (const s of ALL_SERVICES) byService.set(s, [])
  for (const row of latest) {
    byService.get(row.service)?.push(row)
  }
  for (const [s, rows] of byService.entries()) {
    const hasReal = rows.some((r) => !STUB_METRICS.has(r.metric))
    if (hasReal) {
      byService.set(s, rows.filter((r) => !STUB_METRICS.has(r.metric)))
    }
  }

  const lastCaptured = latest.reduce<Date | null>(
    (max, r) => (max && max > r.capturedAt ? max : r.capturedAt),
    null,
  )

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Giám sát Free Tier</h1>
          <p className="mt-1 text-sm text-brand-500">
            Theo dõi dung lượng / requests / bandwidth của 4 service ngoài.
            Nhấn &quot;Làm mới&quot; để fetch ngay — Vercel free tier nhập tay tại form bên dưới.
          </p>
          {lastCaptured && (
            <p className="mt-1 text-xs text-brand-400">
              Snapshot mới nhất: {lastCaptured.toLocaleString("vi-VN")}
            </p>
          )}
        </div>
        <QuotaActions />
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {ALL_SERVICES.map((s) => {
          const rows = byService.get(s) ?? []
          const meta = SERVICE_META[s]
          // Highlight max % của service này để xếp service nguy hiểm nhất lên trên.
          const maxPct = rows.reduce((m, r) => Math.max(m, pct(r.used, r.limit)), 0)
          return (
            <section
              key={s}
              className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm space-y-4"
            >
              <header>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-brand-900">
                    <span className="mr-2">{meta.emoji}</span>
                    {meta.label}
                  </h2>
                  {rows.length > 0 && (
                    <span
                      className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                        maxPct >= 95
                          ? "bg-red-100 text-red-700"
                          : maxPct >= 80
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {maxPct >= 95 ? "Critical" : maxPct >= 80 ? "Warning" : "OK"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-brand-500">{meta.freeTierNote}</p>
              </header>

              {/* Vercel: chỉ render link button + account hint. Không hiện
                  stub note hay empty state vì admin xem số trực tiếp trên
                  Vercel UI. */}
              {s === "VERCEL" ? (
                <div className="space-y-2">
                  <Link
                    href={VERCEL_TEAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full rounded-lg bg-brand-900 hover:bg-brand-800 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors"
                  >
                    Mở Vercel Usage Dashboard →
                  </Link>
                  <p className="text-[11px] text-brand-500 text-center">
                    Đăng nhập bằng Google account{" "}
                    <code className="rounded bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] text-brand-700">
                      {VERCEL_LOGIN_HINT}
                    </code>
                  </p>
                </div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-brand-400 italic py-4 text-center">
                  Chưa có snapshot. Nhấn &quot;Làm mới&quot; để fetch.
                </p>
              ) : (
                <div className="space-y-3">
                  {rows.map((r) => (
                    <MetricRow key={r.id} row={r} service={s} />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

    </div>
  )
}

function MetricRow({ row, service }: { row: LatestRow; service: ServiceQuotaService }) {
  const isStub = STUB_METRICS.has(row.metric)
  if (isStub) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs font-semibold text-amber-800">{metricLabel(service, row.metric)}</p>
        {row.note && <p className="mt-1 text-xs text-amber-700">{row.note}</p>}
      </div>
    )
  }
  const percentage = pct(row.used, row.limit)
  const bar =
    percentage >= 95
      ? "bg-red-500"
      : percentage >= 80
        ? "bg-amber-500"
        : "bg-emerald-500"
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-brand-700">
          {metricLabel(service, row.metric)}
          {row.source === "MANUAL" && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-brand-400">manual</span>
          )}
        </span>
        <span className="font-semibold tabular-nums text-brand-900">
          {formatValue(row.used, row.unit)}
          <span className="mx-1 text-brand-400">/</span>
          {formatValue(row.limit, row.unit)}
          <span className="ml-2 text-brand-500">({percentage.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${bar}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  )
}
