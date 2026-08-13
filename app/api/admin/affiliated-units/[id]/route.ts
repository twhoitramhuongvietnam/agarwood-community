import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { canAdminWrite } from "@/lib/roles"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  const unit = await prisma.affiliatedUnit.update({
    where: { id },
    data: {
      ...(body.type !== undefined && { type: body.type }),
      ...(body.name !== undefined && { name: body.name }),
      ...("name_en" in body && { name_en: body.name_en || null }),
      ...("name_zh" in body && { name_zh: body.name_zh || null }),
      ...("name_ar" in body && { name_ar: body.name_ar || null }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...("description_en" in body && { description_en: body.description_en || null }),
      ...("description_zh" in body && { description_zh: body.description_zh || null }),
      ...("description_ar" in body && { description_ar: body.description_ar || null }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    include: { members: { orderBy: { sortOrder: "asc" } } },
  })

  revalidatePath("/chi-hoi")
  revalidatePath("/ban-lanh-dao")

  return NextResponse.json(unit)
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
  await prisma.affiliatedUnit.delete({ where: { id } })

  revalidatePath("/chi-hoi")
  revalidatePath("/ban-lanh-dao")

  return NextResponse.json({ success: true })
}
