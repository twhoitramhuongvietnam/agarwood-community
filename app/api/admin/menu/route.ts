import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin, canAdminWrite } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { clearMenuCache } from "@/lib/menu"

export async function GET() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const items = await prisma.menuItem.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
  })
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const {
    label,
    label_en,
    label_zh,
    href,
    menuKey,
    parentId,
    sortOrder,
    isVisible,
    isNew,
    comingSoon,
    openInNewTab,
    matchPrefixes,
  } = body as Record<string, unknown>

  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "Thiếu label" }, { status: 400 })
  }
  if (typeof href !== "string" || !href.trim()) {
    return NextResponse.json({ error: "Thiếu href" }, { status: 400 })
  }

  // Strict: chặn duplicate href. Mỗi page chỉ được biểu diễn bởi đúng 1
  // menu item — đảm bảo không có state mâu thuẫn (vd row A đang dùng + row
  // B chưa dùng cùng trỏ về 1 trang).
  const trimmedHref = href.trim()
  const dup = await prisma.menuItem.findFirst({
    where: { href: trimmedHref },
    select: { id: true, label: true, isVisible: true },
  })
  if (dup) {
    return NextResponse.json(
      {
        error: `Đường dẫn "${trimmedHref}" đã có ở mục "${dup.label}" (${dup.isVisible ? "đang dùng" : "chưa dùng"}). Sửa mục đó thay vì tạo mới.`,
      },
      { status: 409 },
    )
  }

  const item = await prisma.menuItem.create({
    data: {
      label: label.trim(),
      label_en: typeof label_en === "string" && label_en.trim() ? label_en.trim() : null,
      label_zh: typeof label_zh === "string" && label_zh.trim() ? label_zh.trim() : null,
      href: trimmedHref,
      menuKey: typeof menuKey === "string" && menuKey.trim() ? menuKey.trim() : null,
      parentId: typeof parentId === "string" && parentId ? parentId : null,
      sortOrder: Number(sortOrder) || 0,
      isVisible: isVisible !== false,
      isNew: !!isNew,
      comingSoon: !!comingSoon,
      openInNewTab: !!openInNewTab,
      matchPrefixes: Array.isArray(matchPrefixes)
        ? matchPrefixes.filter((s): s is string => typeof s === "string" && s.trim() !== "")
        : [],
    },
  })
  clearMenuCache()
  return NextResponse.json({ item })
}
