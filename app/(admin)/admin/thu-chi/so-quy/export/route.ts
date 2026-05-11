import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import { parseDateInput } from "@/lib/ledger"
import type { Prisma } from "@prisma/client"
import ExcelJS from "exceljs"

/**
 * Excel export - Dùng ExcelJS để tạo file .xlsx có định dạng chuyên nghiệp.
 * Bao gồm: Title, Header màu sắc, Border, Alternating rows, Currency formatting.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "ledger:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const filterType = url.searchParams.get("type")
  const filterCategory = url.searchParams.get("category")
  const filterFrom = url.searchParams.get("from")
  const filterTo = url.searchParams.get("to")
  const search = url.searchParams.get("q")?.trim()

  const where: Prisma.LedgerTransactionWhereInput = {}
  if (filterType === "INCOME" || filterType === "EXPENSE") where.type = filterType
  if (filterCategory) where.categoryId = filterCategory

  const fromDate = filterFrom ? parseDateInput(filterFrom) : null
  const toDate = filterTo ? parseDateInput(filterTo) : null
  if (fromDate || toDate) {
    where.transactionDate = {}
    if (fromDate) where.transactionDate.gte = fromDate
    if (toDate) {
      const next = new Date(toDate)
      next.setUTCDate(next.getUTCDate() + 1)
      where.transactionDate.lt = next
    }
  }
  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { referenceNo: { contains: search, mode: "insensitive" } },
    ]
  }

  const rows = await prisma.ledgerTransaction.findMany({
    where,
    orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    select: {
      transactionDate: true,
      type: true,
      category: { select: { name: true } },
      description: true,
      referenceNo: true,
      paymentMethod: true,
      amount: true,
      receiptUrl: true,
      attachments: true,
      recordedBy: { select: { name: true } },
      createdAt: true,
    },
  })

  // --- Bắt đầu tạo Excel ---
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Sổ quỹ")

  // 1. Cấu hình cột
  sheet.columns = [
    { header: "Ngày", key: "date", width: 15 },
    { header: "Loại", key: "type", width: 10 },
    { header: "Danh mục", key: "category", width: 25 },
    { header: "Diễn giải", key: "desc", width: 45 },
    { header: "Số phiếu / Mã GD", key: "ref", width: 20 },
    { header: "Hình thức", key: "method", width: 15 },
    { header: "Số tiền (VNĐ)", key: "amount", width: 20 },
    { header: "Lũy kế (VNĐ)", key: "balance", width: 20 },
    { header: "Chứng từ", key: "receipt", width: 12 },
    { header: "Ghi nhận bởi", key: "by", width: 20 },
  ]

  // 2. Chèn Title & Meta (Dời header xuống dòng 5)
  sheet.insertRows(1, [
    ["SỔ QUỸ CHI TIẾT - CỘNG ĐỒNG TRẦM HƯƠNG VIỆT NAM"],
    [`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")} ${new Date().toLocaleTimeString("vi-VN")}`],
    [`Bộ lọc: ${getFilterText({ filterType, filterFrom, filterTo, search })}`],
    [], // Dòng trống
  ])

  // Merge & Style Title
  sheet.mergeCells("A1:J1")
  const titleCell = sheet.getCell("A1")
  titleCell.font = { size: 16, bold: true, color: { argb: "FF1D4ED8" } } // Brand blue
  titleCell.alignment = { horizontal: "center", vertical: "middle" }

  sheet.mergeCells("A2:J2")
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF6B7280" } }
  sheet.getCell("A2").alignment = { horizontal: "center" }

  sheet.mergeCells("A3:J3")
  sheet.getCell("A3").font = { size: 10, color: { argb: "FF374151" } }
  sheet.getCell("A3").alignment = { horizontal: "center" }

  // 3. Style Header Row (Dòng 5)
  const headerRow = sheet.getRow(5)
  headerRow.height = 25
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" }, // Dark gray/black
    }
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    }
  })

  // 4. Fill Data Rows
  let balance = BigInt(0)
  let totalIncome = BigInt(0)
  let totalExpense = BigInt(0)

  rows.forEach((r, idx) => {
    const signed = r.type === "INCOME" ? r.amount : -r.amount
    balance += signed
    if (r.type === "INCOME") totalIncome += r.amount
    else totalExpense += r.amount

    const row = sheet.addRow({
      date: r.transactionDate,
      type: r.type === "INCOME" ? "Thu" : "Chi",
      category: r.category.name,
      desc: r.description,
      ref: r.referenceNo || "",
      method: r.paymentMethod === "BANK" ? "Chuyển khoản" : "Tiền mặt",
      amount: Number(signed),
      balance: Number(balance),
      receipt:
        Array.isArray(r.attachments) && r.attachments.length > 0
          ? `Có (${r.attachments.length})`
          : r.receiptUrl
            ? "Có (cũ)"
            : "-",
      by: r.recordedBy.name,
    })

    // Formatting data row
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      }
      cell.alignment = { vertical: "middle" }

      // Zebra striping
      if (idx % 2 !== 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        }
      }

      // Currency formatting
      if (colNumber === 7 || colNumber === 8) {
        cell.numFmt = '#,##0"₫";[Red]-#,##0"₫"'
        cell.alignment = { horizontal: "right" }
        if (colNumber === 7) {
          cell.font = {
            color: { argb: r.type === "INCOME" ? "FF059669" : "FFDC2626" },
            bold: true,
          }
        }
      }
      
      if (colNumber === 1) {
        cell.numFmt = "dd/mm/yyyy"
        cell.alignment = { horizontal: "center" }
      }
      
      if (colNumber === 2) {
        cell.alignment = { horizontal: "center" }
      }
    })
  })

  // 5. Footer Summary
  sheet.addRow([]) // Blank line
  const summaryRow = sheet.addRow([
    "TỔNG CỘNG",
    "",
    "",
    "",
    "",
    "",
    Number(totalIncome - totalExpense),
    "",
    "",
    "",
  ])
  sheet.mergeCells(`A${summaryRow.number}:F${summaryRow.number}`)
  summaryRow.getCell(1).font = { bold: true }
  summaryRow.getCell(1).alignment = { horizontal: "right" }
  summaryRow.getCell(7).font = { bold: true, size: 12 }
  summaryRow.getCell(7).numFmt = '#,##0"₫"'
  summaryRow.getCell(7).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFF00" }, // Yellow highlight
  }

  // Freeze top rows (1-5)
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 5 }]

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `so-quy_${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

function getFilterText(o: {
  filterType: string | null
  filterFrom: string | null
  filterTo: string | null
  search: string | undefined
}) {
  const parts = []
  if (o.filterType) parts.push(`Loại: ${o.filterType === "INCOME" ? "Thu" : "Chi"}`)
  if (o.filterFrom) parts.push(`Từ: ${o.filterFrom}`)
  if (o.filterTo) parts.push(`Đến: ${o.filterTo}`)
  if (o.search) parts.push(`Tìm: "${o.search}"`)
  return parts.length > 0 ? parts.join(" | ") : "Tất cả giao dịch"
}
