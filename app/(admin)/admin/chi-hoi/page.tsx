import { prisma } from "@/lib/prisma"
import { AffiliatedUnitManager } from "./AffiliatedUnitManager"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Chi hội & Ban trực thuộc — Quản trị" }
export const revalidate = 0

export default async function AffiliatedUnitsAdminPage() {
  const units = await prisma.affiliatedUnit.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    include: { members: { orderBy: { sortOrder: "asc" } } },
  })

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Chi hội & Ban trực thuộc</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quản lý danh sách chi hội khu vực (hiện ở /chi-hoi) và ban chuyên môn trực thuộc
          (hiện ở /ban-lanh-dao) cùng thành viên kèm chức vụ.
        </p>
      </div>

      <AffiliatedUnitManager initialUnits={units} />
    </div>
  )
}
