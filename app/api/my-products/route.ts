import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // `hasActiveCert` = đang có 1 đơn chứng nhận chạy dở (DRAFT/PENDING/
  // UNDER_REVIEW). User view dùng cờ này để block không cho chọn SP đó —
  // đúng semantic hơn `Product.certStatus` (vốn default DRAFT cho mọi SP
  // mới tạo, dù user chưa nộp đơn). API create-order cũng check duplicate
  // dựa trên Certification table → consistency.
  const products = await prisma.product.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      certStatus: true,
      certExpiredAt: true,
      imageUrls: true,
      companyId: true,
      certifications: {
        where: { status: { in: ["DRAFT", "PENDING", "UNDER_REVIEW"] } },
        select: { id: true },
        take: 1,
      },
    },
  })

  return NextResponse.json({
    products: products.map(({ certifications, ...p }) => ({
      ...p,
      hasActiveCert: certifications.length > 0,
    })),
  })
}
