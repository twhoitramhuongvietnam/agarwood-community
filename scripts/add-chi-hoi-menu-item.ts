/**
 * Thêm menu item "Chi hội trực thuộc" (/chi-hoi) vào dropdown "Giới thiệu"
 * nếu chưa có. Idempotent: skip nếu đã tồn tại menu item với href này.
 */
import { readFileSync, existsSync } from "fs"
function loadEnvLocal(): void {
  if (!existsSync(".env.local")) return
  for (const line of readFileSync(".env.local", "utf-8").split(/\r?\n/)) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("="); if (eq === -1) continue
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}
loadEnvLocal()
/* eslint-disable @typescript-eslint/no-require-imports */
const { prisma } = require("../lib/prisma") as typeof import("../lib/prisma")
/* eslint-enable @typescript-eslint/no-require-imports */

const HREF = "/chi-hoi"
const PARENT_MENU_KEY = "about" // menu cha "Giới thiệu"

async function main() {
  const exists = await prisma.menuItem.findFirst({ where: { href: HREF }, select: { id: true } })
  if (exists) { console.log("Đã tồn tại, skip."); return }

  const parent = await prisma.menuItem.findFirst({ where: { menuKey: PARENT_MENU_KEY } })
  if (!parent) {
    console.log(`Không tìm thấy menu cha menuKey="${PARENT_MENU_KEY}" — bỏ qua.`)
    return
  }

  const last = await prisma.menuItem.findFirst({
    where: { parentId: parent.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })

  const created = await prisma.menuItem.create({
    data: {
      menuKey: "chi_hoi",
      label: "Chi hội trực thuộc",
      label_en: "Local Chapters",
      label_zh: "下属分会",
      label_ar: "الفروع الإقليمية",
      href: HREF,
      parentId: parent.id,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      isVisible: true,
    },
  })
  console.log("Tạo menu item:", created.id, "dưới parent:", parent.label)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
