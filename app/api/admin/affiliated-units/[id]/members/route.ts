import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { canAdminWrite } from "@/lib/roles"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: unitId } = await params
  const body = await req.json()
  const { name, name_en, name_zh, name_ar, title, title_en, title_zh, title_ar, sortOrder } = body

  if (!name || !title) {
    return NextResponse.json({ error: "name và title là bắt buộc" }, { status: 400 })
  }

  const member = await prisma.affiliatedUnitMember.create({
    data: {
      unitId,
      name,
      name_en: name_en || null,
      name_zh: name_zh || null,
      name_ar: name_ar || null,
      title,
      title_en: title_en || null,
      title_zh: title_zh || null,
      title_ar: title_ar || null,
      sortOrder: sortOrder ?? 0,
    },
  })

  revalidatePath("/chi-hoi")
  revalidatePath("/ban-lanh-dao")

  return NextResponse.json(member, { status: 201 })
}
