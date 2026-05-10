/**
 * Bulk activate hội viên đang ở trạng thái "Chờ kích hoạt"
 * (membershipExpires=null, role=VIP|INFINITE) — set:
 *   - membershipExpires = 2027-04-30 23:59:59 (giờ VN)
 *   - isActive = true
 *
 * Idempotent: chỉ chạm các user expires=null. Re-run an toàn.
 * Run: npx tsx scripts/activate-pending-members.ts
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

// 30-Apr-2027 23:59:59 giờ Việt Nam (UTC+7) — membership hiệu lực hết ngày 30/04
// theo display vi-VN. Dùng offset rõ ràng thay vì new Date('2027-04-30') (sẽ
// thành 00:00 UTC = 07:00 sáng VN, hết hạn ngay trong ngày).
const NEW_EXPIRY = new Date("2027-04-30T23:59:59+07:00")

async function main() {
  const targets = await prisma.user.findMany({
    where: {
      role: { in: ["VIP", "INFINITE"] },
      membershipExpires: null,
    },
    select: { id: true, name: true, email: true, isActive: true },
  })

  if (targets.length === 0) {
    console.log("Không có user nào ở trạng thái Chờ kích hoạt — không cần update.")
    return
  }

  console.log(`Sắp update ${targets.length} user → expires=${NEW_EXPIRY.toISOString()}, isActive=true:`)
  for (const u of targets) {
    const flag = u.isActive ? "active" : "INACTIVE"
    console.log(`  - [${flag}] ${u.name.padEnd(30)} ${u.email}`)
  }

  const result = await prisma.user.updateMany({
    where: {
      role: { in: ["VIP", "INFINITE"] },
      membershipExpires: null,
    },
    data: {
      membershipExpires: NEW_EXPIRY,
      isActive: true,
    },
  })

  console.log(`\n✓ Đã update ${result.count} user thành Active, hạn 30/04/2027.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
