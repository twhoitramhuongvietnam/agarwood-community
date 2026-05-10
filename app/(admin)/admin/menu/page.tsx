import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { MenuManager } from "./MenuManager"

export const revalidate = 0

export default async function AdminMenuPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) notFound()

  const items = await prisma.menuItem.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Quản lý Menu</h1>
        <p className="text-sm text-brand-500 mt-1">
          Sửa cấu trúc menu navbar công khai. Hỗ trợ 1 cấp submenu.
          Dùng <code className="px-1 bg-brand-100 rounded">matchPrefixes</code> để
          highlight menu cha khi user vào trang con (vd: <code>/bai-viet</code>).
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-brand-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            <strong>Đang dùng</strong> — hiển thị trên thanh menu trang chủ.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" />
            <strong>Chưa dùng</strong> — ẩn khỏi menu (vẫn truy cập được qua URL trực tiếp).
          </span>
        </div>
      </div>
      <MenuManager initialItems={items.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      }))} />
    </div>
  )
}
