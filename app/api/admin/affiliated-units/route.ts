import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { canAdminWrite } from "@/lib/roles"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const {
    type,
    name,
    name_en,
    name_zh,
    name_ar,
    description,
    description_en,
    description_zh,
    description_ar,
    sortOrder,
  } = body

  if (!name || (type !== "CHI_HOI" && type !== "BAN")) {
    return NextResponse.json(
      { error: "name và type (CHI_HOI hoặc BAN) là bắt buộc" },
      { status: 400 },
    )
  }

  const unit = await prisma.affiliatedUnit.create({
    data: {
      type,
      name,
      name_en: name_en || null,
      name_zh: name_zh || null,
      name_ar: name_ar || null,
      description: description || null,
      description_en: description_en || null,
      description_zh: description_zh || null,
      description_ar: description_ar || null,
      sortOrder: sortOrder ?? 0,
      isActive: true,
    },
    include: { members: { orderBy: { sortOrder: "asc" } } },
  })

  revalidatePath("/chi-hoi")
  revalidatePath("/ban-lanh-dao")

  return NextResponse.json(unit, { status: 201 })
}
