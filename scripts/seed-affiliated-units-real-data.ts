/**
 * Nạp dữ liệu thật cho Chi hội Bình Phước, Chi hội Quảng Ninh, và Ban Nghiên
 * cứu & Phát triển Trầm hương — theo các Quyết định thành lập của Hội.
 *
 * Idempotent theo `type` + `name`: nếu đơn vị đã tồn tại (kể cả data test
 * admin từng nhập tay) thì UPDATE lại field + xoá sạch members cũ, insert
 * lại danh sách members thật. Không tạo trùng đơn vị.
 *
 * Run: npx tsx scripts/seed-affiliated-units-real-data.ts
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

type MemberSeed = { name: string; title: string }
type UnitSeed = {
  type: "CHI_HOI" | "BAN"
  name: string
  description: string
  sortOrder: number
  /** Tên cũ có thể đã tồn tại trong DB (admin test data) — match theo type,
   *  ưu tiên tìm theo tên cũ trước khi tạo mới. */
  matchExistingNames: string[]
  members: MemberSeed[]
}

const UNITS: UnitSeed[] = [
  {
    type: "CHI_HOI",
    name: "Chi hội Trầm hương Quảng Ninh",
    description:
      "Theo Quyết định số 08/QĐ-HTHVN ngày 15/4/2026 của Chủ tịch Hội Trầm hương Việt Nam về việc thành lập Chi hội Trầm hương Quảng Ninh trực thuộc Hội.",
    sortOrder: 1,
    matchExistingNames: ["Chi hội Quảng Ninh", "Chi hội Trầm hương Quảng Ninh"],
    members: [
      { name: "Trịnh Đăng Thanh", title: "Chi hội trưởng" },
      { name: "Nguyễn Thị Thanh Vân", title: "Chi hội phó" },
      { name: "Đặng Thị Hương", title: "Ủy viên kiêm Thư ký" },
      { name: "Lê Ngọc Long", title: "Ủy viên" },
    ],
  },
  {
    type: "CHI_HOI",
    name: "Chi hội Trầm hương khu vực Bình Phước",
    description:
      "Theo Quyết định số 09/QĐ-HTHVN ngày 15/4/2026 của Chủ tịch Hội Trầm hương Việt Nam về việc thành lập Chi hội Trầm hương khu vực Bình Phước trực thuộc Hội.",
    sortOrder: 2,
    matchExistingNames: ["Chi hội Bình Phước", "Chi hội Trầm hương khu vực Bình Phước"],
    members: [
      { name: "Phạm Minh Tâm", title: "Chi hội trưởng" },
      { name: "Trần Văn Phước", title: "Chi hội phó" },
      { name: "Dương Văn Ngọc", title: "Chi hội phó" },
      { name: "Lê Quang Khanh", title: "Ủy viên kiêm Thư ký" },
      { name: "Đoàn Đắc Chinh", title: "Ủy viên" },
    ],
  },
  {
    type: "BAN",
    name: "Ban Nghiên cứu và Phát triển Trầm hương",
    description:
      "Theo Quyết định số 77/QĐ-HTHVN ngày 16/8/2025 của Chủ tịch Hội Trầm hương Việt Nam về việc thành lập Ban Nghiên cứu và Phát triển Trầm hương trực thuộc Hội.",
    sortOrder: 1,
    matchExistingNames: ["Ban nghiên cứu", "Ban Nghiên cứu và Phát triển Trầm hương"],
    members: [
      { name: "Nguyễn Thị Thu", title: "Trưởng Ban" },
      { name: "ThS. Nguyễn Văn Bình", title: "Ủy viên" },
      { name: "ThS. Nguyễn Văn Hùng", title: "Ủy viên" },
      { name: "ThS. Vương Bá Kiệt", title: "Ủy viên" },
      { name: "KS. Trần Văn Quyến", title: "Ủy viên" },
      { name: "Phạm Minh Tâm", title: "Ủy viên" },
      { name: "Đặng Văn Vụ", title: "Ủy viên" },
      { name: "Nguyễn Thế Lam", title: "Ủy viên" },
    ],
  },
]

async function main() {
  for (const unit of UNITS) {
    const existing = await prisma.affiliatedUnit.findFirst({
      where: { type: unit.type, name: { in: unit.matchExistingNames } },
    })

    const unitId = existing
      ? (
          await prisma.affiliatedUnit.update({
            where: { id: existing.id },
            data: {
              name: unit.name,
              description: unit.description,
              sortOrder: unit.sortOrder,
              isActive: true,
            },
          })
        ).id
      : (
          await prisma.affiliatedUnit.create({
            data: {
              type: unit.type,
              name: unit.name,
              description: unit.description,
              sortOrder: unit.sortOrder,
              isActive: true,
            },
          })
        ).id

    // Xoá sạch members cũ (kể cả data test) rồi insert lại danh sách thật.
    await prisma.affiliatedUnitMember.deleteMany({ where: { unitId } })
    for (let i = 0; i < unit.members.length; i++) {
      await prisma.affiliatedUnitMember.create({
        data: {
          unitId,
          name: unit.members[i].name,
          title: unit.members[i].title,
          sortOrder: i + 1,
        },
      })
    }

    console.log(
      `✓ ${unit.name} (${existing ? "updated" : "created"}) — ${unit.members.length} thành viên`,
    )
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
