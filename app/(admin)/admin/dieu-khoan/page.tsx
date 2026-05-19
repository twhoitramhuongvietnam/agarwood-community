import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { TermsType, Prisma } from "@prisma/client"
import { CURRENT_VERSION, listVersions, type TermsTypeKey } from "@/lib/terms"

export const metadata = {
  title: "Lịch sử đồng ý điều khoản | Admin",
}

export const revalidate = 0

const TYPE_LABEL: Record<TermsTypeKey, string> = {
  REGISTRATION: "Đăng ký hội viên",
  PRODUCT_LISTING: "Đăng sản phẩm",
}

const PAGE_SIZE = 50

type SearchParams = {
  type?: string
  version?: string
  q?: string
  page?: string
  from?: string
  to?: string
}

export default async function AdminDieuKhoanPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) notFound()

  const params = await searchParams
  const filterType =
    params.type && params.type in TermsType ? (params.type as TermsTypeKey) : null
  const filterVersion = params.version?.trim() || null
  const query = (params.q || "").trim()
  const fromDate = params.from ? new Date(params.from) : null
  const toDate = params.to ? new Date(params.to) : null
  // Clamp toDate to end-of-day so range filter is inclusive of the chosen day.
  if (toDate && !isNaN(toDate.getTime())) toDate.setHours(23, 59, 59, 999)
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1)

  const where: Prisma.TermsAcceptanceWhereInput = {
    ...(filterType && { type: filterType }),
    ...(filterVersion && { version: filterVersion }),
    ...(query && {
      user: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
    }),
    ...(fromDate && !isNaN(fromDate.getTime()) && {
      acceptedAt: { gte: fromDate, ...(toDate && !isNaN(toDate.getTime()) && { lte: toDate }) },
    }),
    ...(!fromDate && toDate && !isNaN(toDate.getTime()) && {
      acceptedAt: { lte: toDate },
    }),
  }

  const [total, rows, statsRaw] = await Promise.all([
    prisma.termsAcceptance.count({ where }),
    prisma.termsAcceptance.findMany({
      where,
      orderBy: { acceptedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        type: true,
        version: true,
        acceptedAt: true,
        ipAddress: true,
        userAgent: true,
        contextRef: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.termsAcceptance.groupBy({
      by: ["type", "version"],
      _count: { _all: true },
    }),
  ])

  // Resolve contextRef → product name khi type = PRODUCT_LISTING (1 query gộp).
  const productIds = rows
    .filter((r) => r.type === "PRODUCT_LISTING" && r.contextRef)
    .map((r) => r.contextRef as string)
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, slug: true },
      })
    : []
  const productMap = new Map(products.map((p) => [p.id, p]))

  const stats: Record<TermsTypeKey, Record<string, number>> = {
    REGISTRATION: {},
    PRODUCT_LISTING: {},
  }
  for (const s of statsRaw) {
    stats[s.type as TermsTypeKey][s.version] = s._count._all
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Build query string for CSV export (keep current filters)
  const csvHref = (() => {
    const qs = new URLSearchParams()
    if (filterType) qs.set("type", filterType)
    if (filterVersion) qs.set("version", filterVersion)
    if (query) qs.set("q", query)
    if (params.from) qs.set("from", params.from)
    if (params.to) qs.set("to", params.to)
    return `/api/admin/dieu-khoan/export?${qs.toString()}`
  })()

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-brand-900">Lịch sử đồng ý điều khoản</h1>
        <p className="text-sm text-brand-600">
          Bằng chứng pháp lý — mỗi lần user đồng ý điều khoản đăng ký hoặc đăng
          sản phẩm sẽ sinh 1 row. Trích xuất CSV khi cơ quan chức năng yêu cầu.
        </p>
      </header>

      {/* Stats card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(TYPE_LABEL) as TermsTypeKey[]).map((t) => {
          const versions = listVersions(t)
          const currentV = CURRENT_VERSION[t]
          return (
            <div key={t} className="bg-white rounded-xl border border-brand-200 p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold text-brand-900">{TYPE_LABEL[t]}</h2>
                <span className="text-xs text-brand-500">
                  Hiện hành: <strong>{currentV}</strong>
                </span>
              </div>
              <ul className="space-y-1 text-sm">
                {versions.map((v) => (
                  <li key={v} className="flex justify-between">
                    <Link
                      href={`/dieu-khoan/${t}/${v}`}
                      target="_blank"
                      rel="noopener"
                      className="text-brand-700 hover:underline"
                    >
                      Phiên bản {v}
                    </Link>
                    <span className="font-mono text-brand-900">
                      {stats[t][v] ?? 0}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <form className="bg-white rounded-xl border border-brand-200 p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-brand-700">Loại</label>
          <select
            name="type"
            defaultValue={filterType ?? ""}
            className="w-full rounded-lg border border-brand-200 px-2 py-1.5"
          >
            <option value="">Tất cả</option>
            {(Object.keys(TYPE_LABEL) as TermsTypeKey[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-brand-700">Phiên bản</label>
          <input
            type="text"
            name="version"
            defaultValue={filterVersion ?? ""}
            placeholder="v1"
            className="w-full rounded-lg border border-brand-200 px-2 py-1.5"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-brand-700">Từ ngày</label>
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="w-full rounded-lg border border-brand-200 px-2 py-1.5"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-brand-700">Đến ngày</label>
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="w-full rounded-lg border border-brand-200 px-2 py-1.5"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-brand-700">Tên / Email</label>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Nguyễn Văn A"
            className="w-full rounded-lg border border-brand-200 px-2 py-1.5"
          />
        </div>
        <div className="sm:col-span-5 flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Lọc
          </button>
          <Link
            href="/admin/dieu-khoan"
            className="rounded-lg border border-brand-300 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
          >
            Xoá bộ lọc
          </Link>
          <a
            href={csvHref}
            className="ml-auto rounded-lg border border-brand-300 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
          >
            ⬇ Xuất CSV (toàn bộ kết quả)
          </a>
        </div>
      </form>

      {/* Results */}
      <div className="bg-white rounded-xl border border-brand-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-200 text-sm text-brand-600">
          Tổng: <strong>{total.toLocaleString("vi-VN")}</strong> bản ghi
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-50 text-left text-xs uppercase text-brand-600">
              <tr>
                <th className="px-3 py-2 font-medium">Thời điểm</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Loại / Phiên bản</th>
                <th className="px-3 py-2 font-medium">Context</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">User-Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-brand-400 italic">
                    Không có bản ghi nào khớp.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const product =
                  r.type === "PRODUCT_LISTING" && r.contextRef
                    ? productMap.get(r.contextRef)
                    : null
                return (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 font-mono text-xs text-brand-700 whitespace-nowrap">
                      {r.acceptedAt.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/hoi-vien/${r.user.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {r.user.name}
                      </Link>
                      <div className="text-xs text-brand-500">{r.user.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
                        {TYPE_LABEL[r.type as TermsTypeKey]}
                      </span>
                      <Link
                        href={`/dieu-khoan/${r.type}/${r.version}`}
                        target="_blank"
                        rel="noopener"
                        className="ml-2 text-xs text-brand-600 underline"
                      >
                        {r.version}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {product ? (
                        <Link
                          href={`/san-pham/${product.slug}`}
                          target="_blank"
                          className="text-brand-700 hover:underline"
                        >
                          {product.name}
                        </Link>
                      ) : r.contextRef ? (
                        <span className="font-mono text-brand-400">{r.contextRef}</span>
                      ) : (
                        <span className="text-brand-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-brand-700">
                      {r.ipAddress ?? <span className="text-brand-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-brand-600 max-w-[16rem] truncate" title={r.userAgent ?? ""}>
                      {r.userAgent ?? <span className="text-brand-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-brand-200 flex items-center justify-between text-sm">
            <span className="text-brand-600">
              Trang <strong>{page}</strong> / {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <PageLink params={params} page={page - 1} label="← Trang trước" />
              )}
              {page < totalPages && (
                <PageLink params={params} page={page + 1} label="Trang sau →" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PageLink({
  params,
  page,
  label,
}: {
  params: SearchParams
  page: number
  label: string
}) {
  const qs = new URLSearchParams()
  if (params.type) qs.set("type", params.type)
  if (params.version) qs.set("version", params.version)
  if (params.q) qs.set("q", params.q)
  if (params.from) qs.set("from", params.from)
  if (params.to) qs.set("to", params.to)
  qs.set("page", String(page))
  return (
    <Link
      href={`/admin/dieu-khoan?${qs.toString()}`}
      className="rounded-lg border border-brand-300 px-3 py-1.5 text-brand-700 hover:bg-brand-50"
    >
      {label}
    </Link>
  )
}
