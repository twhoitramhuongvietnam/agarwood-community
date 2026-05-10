import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canAdminWrite } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { clearMenuCache } from "@/lib/menu"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (typeof body.label === "string") data.label = body.label.trim()
  if ("label_en" in body) data.label_en = typeof body.label_en === "string" && body.label_en.trim() ? body.label_en.trim() : null
  if ("label_zh" in body) data.label_zh = typeof body.label_zh === "string" && body.label_zh.trim() ? body.label_zh.trim() : null
  if (typeof body.href === "string") {
    const newHref = body.href.trim()
    if (newHref) {
      // Strict dedup: chặn nếu đường dẫn này đã có ở mục KHÁC. Bỏ qua chính
      // item đang sửa (id khớp) — admin có thể save lại mà không đổi href.
      const dup = await prisma.menuItem.findFirst({
        where: { href: newHref, id: { not: id } },
        select: { id: true, label: true, isVisible: true },
      })
      if (dup) {
        return NextResponse.json(
          {
            error: `Đường dẫn "${newHref}" đã có ở mục "${dup.label}" (${dup.isVisible ? "đang dùng" : "chưa dùng"}). Mỗi đường dẫn chỉ được dùng 1 lần.`,
          },
          { status: 409 },
        )
      }
      data.href = newHref
    }
  }
  if ("menuKey" in body) {
    const k = body.menuKey
    data.menuKey = typeof k === "string" && k.trim() ? k.trim() : null
  }
  if ("parentId" in body) {
    const p = body.parentId
    data.parentId = typeof p === "string" && p ? p : null
    if (data.parentId === id) {
      return NextResponse.json({ error: "Không thể đặt menu là cha của chính nó" }, { status: 400 })
    }
  }
  if ("sortOrder" in body) data.sortOrder = Number(body.sortOrder) || 0
  if ("isVisible" in body) data.isVisible = !!body.isVisible
  if ("isNew" in body) data.isNew = !!body.isNew
  if ("comingSoon" in body) data.comingSoon = !!body.comingSoon
  if ("openInNewTab" in body) data.openInNewTab = !!body.openInNewTab
  if ("matchPrefixes" in body && Array.isArray(body.matchPrefixes)) {
    data.matchPrefixes = body.matchPrefixes.filter(
      (s: unknown): s is string => typeof s === "string" && s.trim() !== "",
    )
  }

  // Chặn vòng cha-con (con không thể là cha của tổ tiên)
  if (data.parentId) {
    const newParent = await prisma.menuItem.findUnique({
      where: { id: data.parentId as string },
      select: { parentId: true },
    })
    if (newParent?.parentId) {
      return NextResponse.json({ error: "Chỉ hỗ trợ 1 cấp submenu" }, { status: 400 })
    }
  }

  const item = await prisma.menuItem.update({ where: { id }, data })
  clearMenuCache()
  return NextResponse.json({ item })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  await prisma.menuItem.delete({ where: { id } })
  clearMenuCache()
  return NextResponse.json({ ok: true })
}
