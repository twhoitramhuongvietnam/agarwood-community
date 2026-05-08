"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { revalidatePath, revalidateTag } from "next/cache"
import { z } from "zod"
import { getProductQuotaUsage } from "@/lib/product-quota"
import { writeProductRevision } from "@/lib/product-revision"
import {
  PRODUCT_DEFAULT_SHIPPING,
  PRODUCT_DEFAULT_RETURN,
} from "@/lib/constants/agarwood"

const variantSchema = z.object({
  name: z.string().min(1).max(50),
  priceRange: z.string().max(50).optional().or(z.literal("")),
})

const productSchema = z.object({
  name: z.string().min(2, "Ten san pham toi thieu 2 ky tu"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug chi chua a-z, 0-9, dau gach ngang").min(2),
  description: z.string().max(15000).optional().or(z.literal("")),
  description_en: z.string().nullable().optional(),
  description_zh: z.string().nullable().optional(),
  category: z.string().optional().or(z.literal("")),
  category_en: z.string().nullable().optional(),
  category_zh: z.string().nullable().optional(),
  name_en: z.string().nullable().optional(),
  name_zh: z.string().nullable().optional(),
  priceRange: z.string().optional().or(z.literal("")),
  imageUrls: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  // Phase 4 (2026-04-29): spec sheet + variants
  origin: z.string().max(100).nullable().optional(),
  treeAge: z.string().max(50).nullable().optional(),
  packagingNote: z.string().max(1000).nullable().optional(),
  scentProfile: z.string().max(1000).nullable().optional(),
  variants: z.array(variantSchema).max(10).nullable().optional(),
  // Phase 4 follow-up (2026-04-29): policy text. Create flow: empty →
  // default. Update flow: empty → null (user clear, hiển thị default ở UI).
  shippingPolicy: z.string().max(1000).nullable().optional(),
  returnPolicy: z.string().max(1000).nullable().optional(),
})

export async function createProduct(formData: Record<string, unknown>) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Chua dang nhap" }

  const parsed = productSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Check product quota
  const quota = await getProductQuotaUsage(session.user.id)
  if (quota.limit !== -1 && quota.remaining <= 0) {
    return { error: `Ban da dat gioi han ${quota.limit} san pham/thang. Vui long doi den ${quota.resetAt.toLocaleDateString("vi-VN")}.` }
  }

  // Check slug uniqueness
  const slugExists = await prisma.product.findUnique({ where: { slug: parsed.data.slug } })
  if (slugExists) return { error: "Slug da duoc su dung" }

  // Get company if user has one (VIP)
  const company = await prisma.company.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  })

  // Get user displayPriority for denormalized ownerPriority
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayPriority: true },
  })

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        ownerId: session.user.id,
        companyId: company?.id ?? null,
        name: parsed.data.name,
        name_en: parsed.data.name_en || null,
        name_zh: parsed.data.name_zh || null,
        slug: parsed.data.slug,
        description: parsed.data.description || null,
        description_en: parsed.data.description_en || null,
        description_zh: parsed.data.description_zh || null,
        category: parsed.data.category || null,
        category_en: parsed.data.category_en || null,
        category_zh: parsed.data.category_zh || null,
        priceRange: parsed.data.priceRange || null,
        imageUrls: parsed.data.imageUrls ?? [],
        isPublished: parsed.data.isPublished ?? true,
        ownerPriority: user?.displayPriority ?? 0,
        origin: parsed.data.origin || null,
        treeAge: parsed.data.treeAge || null,
        packagingNote: parsed.data.packagingNote || null,
        scentProfile: parsed.data.scentProfile || null,
        variants: parsed.data.variants && parsed.data.variants.length > 0 ? parsed.data.variants : undefined,
        // Phase 4 follow-up: create flow → fill default nếu user bỏ trống.
        shippingPolicy: parsed.data.shippingPolicy?.trim() || PRODUCT_DEFAULT_SHIPPING,
        returnPolicy: parsed.data.returnPolicy?.trim() || PRODUCT_DEFAULT_RETURN,
      },
    })
    await writeProductRevision({
      product: created,
      editedBy: session.user.id,
      editedRole: "OWNER",
      tx,
    })
    return created
  })

  revalidatePath("/san-pham-doanh-nghiep")
  revalidatePath("/san-pham-chung-nhan")
  // Invalidate quota cache cho user — UI sidebar feed sẽ hiện số SP mới ngay
  // thay vì stale tới 60s.
  revalidateTag(`quota:${session.user.id}`, "max")
  return { success: true, slug: product.slug }
}

export async function updateProduct(productId: string, formData: Record<string, unknown>) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Chua dang nhap" }

  const parsed = productSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Verify ownership via ownerId
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, ownerId: true },
  })
  if (!product || product.ownerId !== session.user.id) {
    return { error: "Khong co quyen chinh sua" }
  }

  // Check slug uniqueness (exclude self)
  if (parsed.data.slug !== product.slug) {
    const slugExists = await prisma.product.findFirst({
      where: { slug: parsed.data.slug, id: { not: productId } },
    })
    if (slugExists) return { error: "Slug da duoc su dung" }
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        name: parsed.data.name,
        name_en: parsed.data.name_en || null,
        name_zh: parsed.data.name_zh || null,
        slug: parsed.data.slug,
        description: parsed.data.description || null,
        description_en: parsed.data.description_en || null,
        description_zh: parsed.data.description_zh || null,
        category: parsed.data.category || null,
        category_en: parsed.data.category_en || null,
        category_zh: parsed.data.category_zh || null,
        priceRange: parsed.data.priceRange || null,
        imageUrls: parsed.data.imageUrls ?? [],
        isPublished: parsed.data.isPublished ?? true,
        origin: parsed.data.origin || null,
        treeAge: parsed.data.treeAge || null,
        packagingNote: parsed.data.packagingNote || null,
        scentProfile: parsed.data.scentProfile || null,
        // Variants — empty array → DB NULL (clear data); có item → save array.
        // Prisma Json? field cần Prisma.DbNull (literal null không hợp lệ).
        variants:
          parsed.data.variants !== undefined
            ? parsed.data.variants && parsed.data.variants.length > 0
              ? parsed.data.variants
              : Prisma.DbNull
            : undefined,
        // Phase 4 follow-up: update flow → save what user inputs (clear =
        // null, hiển thị default ở UI). Default chỉ apply ở create.
        shippingPolicy: parsed.data.shippingPolicy?.trim() || null,
        returnPolicy: parsed.data.returnPolicy?.trim() || null,
      },
    })
    await writeProductRevision({
      product: updated,
      editedBy: session.user.id,
      editedRole: "OWNER",
      tx,
    })
  })

  revalidatePath("/san-pham/" + parsed.data.slug)
  revalidatePath("/san-pham-doanh-nghiep")
  revalidatePath("/san-pham-chung-nhan")
  return { success: true, slug: parsed.data.slug }
}
