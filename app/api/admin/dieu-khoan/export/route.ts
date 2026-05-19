import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { TermsType, Prisma } from "@prisma/client"

/** Tối đa 50k row/export — đủ cho 1 năm dữ liệu của hội cỡ vừa.
 *  Vượt → admin phải lọc theo khoảng thời gian nhỏ hơn. */
const MAX_ROWS = 50_000

function csvEscape(value: string | null | undefined): string {
  if (value == null) return ""
  const s = String(value)
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const url = new URL(request.url)
  const type = url.searchParams.get("type")
  const version = url.searchParams.get("version")?.trim() || null
  const query = (url.searchParams.get("q") || "").trim()
  const fromStr = url.searchParams.get("from")
  const toStr = url.searchParams.get("to")
  const fromDate = fromStr ? new Date(fromStr) : null
  const toDate = toStr ? new Date(toStr) : null
  if (toDate && !isNaN(toDate.getTime())) toDate.setHours(23, 59, 59, 999)

  const where: Prisma.TermsAcceptanceWhereInput = {
    ...(type && type in TermsType && { type: type as keyof typeof TermsType }),
    ...(version && { version }),
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

  const rows = await prisma.termsAcceptance.findMany({
    where,
    orderBy: { acceptedAt: "desc" },
    take: MAX_ROWS,
    select: {
      id: true,
      type: true,
      version: true,
      acceptedAt: true,
      ipAddress: true,
      userAgent: true,
      contextRef: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  })

  // Resolve productId → name for context column.
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

  const header = [
    "id",
    "loai",
    "phien_ban",
    "thoi_diem_dong_y",
    "ho_ten",
    "email",
    "so_dien_thoai",
    "user_id",
    "san_pham",
    "san_pham_id",
    "ip",
    "user_agent",
  ]
  const lines: string[] = [header.join(",")]
  for (const r of rows) {
    const product =
      r.type === "PRODUCT_LISTING" && r.contextRef ? productMap.get(r.contextRef) : null
    lines.push(
      [
        csvEscape(r.id),
        csvEscape(r.type),
        csvEscape(r.version),
        csvEscape(r.acceptedAt.toISOString()),
        csvEscape(r.user.name),
        csvEscape(r.user.email),
        csvEscape(r.user.phone),
        csvEscape(r.user.id),
        csvEscape(product?.name ?? null),
        csvEscape(r.contextRef),
        csvEscape(r.ipAddress),
        csvEscape(r.userAgent),
      ].join(","),
    )
  }

  // BOM giúp Excel mở UTF-8 đúng (tiếng Việt không bị mojibake).
  const body = "﻿" + lines.join("\r\n") + "\r\n"
  const stamp = new Date().toISOString().slice(0, 10)
  const fname = `dieu-khoan-${stamp}.csv`

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  })
}
