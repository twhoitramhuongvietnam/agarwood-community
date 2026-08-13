import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { canAdminWrite } from "@/lib/roles"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { memberId } = await params
  const body = await req.json()

  const member = await prisma.affiliatedUnitMember.update({
    where: { id: memberId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...("name_en" in body && { name_en: body.name_en || null }),
      ...("name_zh" in body && { name_zh: body.name_zh || null }),
      ...("name_ar" in body && { name_ar: body.name_ar || null }),
      ...(body.title !== undefined && { title: body.title }),
      ...("title_en" in body && { title_en: body.title_en || null }),
      ...("title_zh" in body && { title_zh: body.title_zh || null }),
      ...("title_ar" in body && { title_ar: body.title_ar || null }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  })

  revalidatePath("/chi-hoi")
  revalidatePath("/ban-lanh-dao")

  return NextResponse.json(member)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { memberId } = await params
  await prisma.affiliatedUnitMember.delete({ where: { id: memberId } })

  revalidatePath("/chi-hoi")
  revalidatePath("/ban-lanh-dao")

  return NextResponse.json({ success: true })
}
