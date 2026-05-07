import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "post:moderate")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const post = await prisma.post.findUnique({ where: { id }, select: { status: true } })
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const newStatus = post.status === "LOCKED" ? "PUBLISHED" : "LOCKED"

  await prisma.post.update({
    where: { id },
    data: {
      status: newStatus,
      lockedAt: newStatus === "LOCKED" ? new Date() : null,
      lockedBy: newStatus === "LOCKED" ? session.user.id : null,
    },
  })

  // Lock/unlock đổi visibility → invalidate feed cache.
  revalidateTag("feed", "max")
  return NextResponse.json({ status: newStatus })
}
