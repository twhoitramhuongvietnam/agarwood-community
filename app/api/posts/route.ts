import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMonthlyQuota, startOfMonth, startOfNextMonth } from "@/lib/quota"
import { getMonthlyProductQuota } from "@/lib/product-quota"
import { writeProductRevision } from "@/lib/product-revision"
import { getSortedFeedPostIds } from "@/lib/feed-sort"
import {
  getCachedFeedFirstPage,
  getViewerReactions,
  mergeReactions,
} from "@/lib/feed-cache"
import {
  PRODUCT_DEFAULT_SHIPPING,
  PRODUCT_DEFAULT_RETURN,
} from "@/lib/constants/agarwood"
import DOMPurify from "isomorphic-dompurify"
import type { PostCategory } from "@prisma/client"

const POST_AUTHOR_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  role: true,
  accountType: true,
  contributionTotal: true,
  company: { select: { name: true, slug: true } },
} as const

/** Extract Cloudinary image URLs từ HTML */
function extractImageUrls(html: string): string[] {
  const matches = html.match(/https:\/\/res\.cloudinary\.com\/[^"'\s)]+/g)
  return matches ? [...new Set(matches)].slice(0, 10) : []
}

const VALID_CATEGORIES: PostCategory[] = ["GENERAL", "NEWS", "PRODUCT"]

// GET /api/posts?cursor=<postId>&category=NEWS|PRODUCT|GENERAL&certified=1
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const categoryParam = searchParams.get("category")
  const certifiedOnly = searchParams.get("certified") === "1"
  const mineOnly = searchParams.get("mine") === "1"
  const pinnedOnly = searchParams.get("pinned") === "1"
  const session = await auth()
  const userId = session?.user?.id
  const isAdminUser = session?.user?.role === "ADMIN"

  const category: PostCategory | undefined = VALID_CATEGORIES.includes(
    categoryParam as PostCategory,
  )
    ? (categoryParam as PostCategory)
    : undefined

  // `mine=1` chỉ có nghĩa khi đã login. Guest gửi mine=1 → bỏ qua, trả
  // feed mặc định (không empty cho viewer chưa login).
  const effectiveMine = mineOnly && !!userId
  // `pinned=1` chỉ admin được dùng (xem + gỡ ghim). Non-admin → ignore.
  // Phase 3.7 round 4 (2026-04).
  const effectivePinned = pinnedOnly && isAdminUser

  // Phase 3.7 round 4 (2026-04): PRODUCT + NEWS dùng thuật toán sort đặc
  // biệt (by-day VN → [cert PRODUCT only] → priority → createdAt). MINE/
  // PINNED giữ chronological. GENERAL/no-category giữ isPromoted+priority+date.
  const useFeedSort =
    !effectiveMine &&
    !effectivePinned &&
    (category === "PRODUCT" || category === "NEWS" || certifiedOnly)

  const POST_SELECT = {
    id: true,
    authorId: true,
    title: true,
    content: true,
    imageUrls: true,
    status: true,
    category: true,
    isPremium: true,
    isPromoted: true,
    newsCategories: true,
    authorPriority: true,
    viewCount: true,
    reportCount: true,
    lockedBy: true,
    lockReason: true,
    moderationNote: true,
    createdAt: true,
    updatedAt: true,
    lockedAt: true,
    author: {
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        role: true,
        accountType: true,
        contributionTotal: true,
        company: { select: { name: true, slug: true } },
      },
    },
    product: {
      select: {
        id: true,
        name: true,
        slug: true,
        priceRange: true,
        category: true,
        badgeUrl: true,
        certStatus: true,
        isFeatured: true,
      },
    },
    reactions: {
      where: { userId: userId ?? "none" },
      select: { type: true },
    },
    promotionRequests: {
      take: 1,
      orderBy: { createdAt: "desc" as const },
      select: { status: true, reviewNote: true },
    },
    _count: { select: { reactions: true } },
  } as const

  // Moderation visibility — match logic in feed/page.tsx:
  //  PUBLISHED → all; LOCKED no-note → all (auto-lock); LOCKED with note or
  //  PENDING → owner only.
  type DirectPostRow = Awaited<
    ReturnType<typeof prisma.post.findMany<{ select: typeof POST_SELECT }>>
  >[number]
  // Union type — cached path có dates dạng string (đã serialize), direct
  // query có Date instance. Consumer dùng toIso() normalize cuối cùng.
  type PostRow =
    | DirectPostRow
    | (Omit<DirectPostRow, "createdAt" | "updatedAt" | "lockedAt"> & {
        createdAt: string
        updatedAt: string
        lockedAt: string | null
      })
  let posts: PostRow[]
  if (useFeedSort) {
    // First page (cursor=null) cho NEWS/PRODUCT đi qua unstable_cache (60s)
    // — share giữa anon + logged-in. Reactions của viewer fetch riêng + merge.
    // Pagination (cursor != null) bypass cache vì biến thể nhiều.
    const helperCategory: PostCategory =
      certifiedOnly || category === "PRODUCT" ? "PRODUCT" : "NEWS"
    if (!cursor) {
      const cachedPosts = await getCachedFeedFirstPage(helperCategory, certifiedOnly)
      const reactionsMap = userId
        ? await getViewerReactions(userId, cachedPosts.map((p) => p.id))
        : new Map<string, string[]>()
      posts = mergeReactions(cachedPosts, reactionsMap) as PostRow[]
    } else {
      const ids = await getSortedFeedPostIds({
        category: helperCategory,
        userId: userId ?? null,
        certifiedOnly,
        cursor,
        take: 10,
      })
      if (ids.length === 0) {
        posts = []
      } else {
        const rows = await prisma.post.findMany({
          where: { id: { in: ids } },
          select: POST_SELECT,
        })
        const idxMap = new Map(ids.map((id, i) => [id, i]))
        rows.sort((a, b) => (idxMap.get(a.id) ?? 0) - (idxMap.get(b.id) ?? 0))
        posts = rows
      }
    }
  } else {
    posts = await prisma.post.findMany({
      where: effectivePinned
        ? { isPromoted: true, status: "PUBLISHED" }
        : effectiveMine
          ? { authorId: userId, status: { not: "DELETED" } }
          : {
              ...(userId
                ? {
                    OR: [
                      { status: "PUBLISHED" },
                      { status: "LOCKED", moderationNote: null },
                      { status: "PENDING", authorId: userId },
                      { status: "LOCKED", moderationNote: { not: null }, authorId: userId },
                    ],
                  }
                : {
                    OR: [
                      { status: "PUBLISHED" },
                      { status: "LOCKED", moderationNote: null },
                    ],
                  }),
              ...(category ? { category } : {}),
            },
      // MINE / PINNED chronological; NEWS/GENERAL giữ isPromoted+priority+date.
      orderBy:
        effectiveMine || effectivePinned
          ? [{ createdAt: "desc" }]
          : [
              { isPromoted: "desc" },
              { authorPriority: "desc" },
              { createdAt: "desc" },
            ],
      take: 10,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: POST_SELECT,
    })
  }

  // Date normalizer — cached path (lib/feed-cache) trả ISO string, direct
  // query trả Date instance. Wrap để cả 2 đều xử lý được.
  const toIso = (d: Date | string | null | undefined): string | null => {
    if (d == null) return null
    return typeof d === "string" ? d : d.toISOString()
  }

  const response = NextResponse.json({
    posts: posts.map((p) => {
      const { promotionRequests, ...rest } = p
      return {
        ...rest,
        createdAt: toIso(p.createdAt) as string,
        updatedAt: toIso(p.updatedAt) as string,
        lockedAt: toIso(p.lockedAt),
        // Only expose promotion state to the author of the post.
        latestPromotionRequest:
          userId && p.authorId === userId
            ? (promotionRequests[0] ?? null)
            : null,
      }
    }),
  })
  // Cache-Control: KHÔNG dùng `public, s-maxage` vì response chứa reactions
  // của viewer + post status PENDING/LOCKED của chính user → CDN cache lẫn
  // giữa users sẽ leak personalized data. unstable_cache ở `getCachedFeed-
  // FirstPage` đã handle shared-data caching ở app layer (an toàn — chỉ
  // base post+author+product, reactions per-user merge runtime).
  response.headers.set("Cache-Control", "private, max-age=0, must-revalidate")
  return response
}

// POST /api/posts
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, content, category, coverImageUrl, product } = body as {
    title?: string
    content?: string
    category?: string
    /** Phase 3.7 round 4 (2026-04): thumbnail 16:9 cho homepage card.
     *  Optional — UI fallback từ imageUrls[0] / content nếu để trống. */
    coverImageUrl?: string
    product?: {
      name?: string
      slug?: string
      category?: string
      priceRange?: string
      /** Phase 3.5 (2026-04): admin đăng SP hộ DN — chỉ định DN cụ thể.
       *  Server validate role + chuyển ownerId sang chủ DN. Non-admin gửi
       *  field này sẽ bị ignore (override bằng auto company lookup). */
      companyId?: string
      /** Phase 4 (2026-04-29): spec sheet + variants — đồng bộ với
       *  ProductForm. Optional; null/empty → bỏ qua. */
      origin?: string
      treeAge?: string
      packagingNote?: string
      scentProfile?: string
      variants?: Array<{ name?: string; priceRange?: string }>
      /** Phase 4 follow-up (2026-04-29): policy text. Empty → server fill
       *  default từ PRODUCT_DEFAULT_SHIPPING / PRODUCT_DEFAULT_RETURN. */
      shippingPolicy?: string
      returnPolicy?: string
    }
  }

  if (!content || content.trim().length < 50) {
    return NextResponse.json({ error: "Nội dung quá ngắn (tối thiểu 50 ký tự)" }, { status: 400 })
  }

  const cat: PostCategory = VALID_CATEGORIES.includes(category as PostCategory)
    ? (category as PostCategory)
    : "GENERAL"

  const wantsProduct = cat === "PRODUCT" && !!product?.name && !!product?.slug
  const userId = session.user.id

  // Validate product fields synchronously before hitting the DB
  let productSlug = ""
  if (wantsProduct) {
    productSlug = product!.slug!.trim()
    if (!/^[a-z0-9-]+$/.test(productSlug) || productSlug.length < 2) {
      return NextResponse.json({ error: "Slug sản phẩm chỉ chứa a-z, 0-9, dấu gạch ngang, tối thiểu 2 ký tự" }, { status: 400 })
    }
    if (!product!.name || product!.name.trim().length < 2) {
      return NextResponse.json({ error: "Tên sản phẩm tối thiểu 2 ký tự" }, { status: 400 })
    }
  }

  // ── All independent reads in one round-trip ─────────────────────────────
  // Single user fetch (was duplicated 3x previously) + counts + slug check
  // + company lookup, all parallel via Promise.all.
  const monthStart = startOfMonth()
  const [user, postCount, productCount, slugConflict, company] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        contributionTotal: true,
        accountType: true,
        displayPriority: true,
      },
    }),
    prisma.post.count({
      where: {
        authorId: userId,
        createdAt: { gte: monthStart },
        status: { in: ["PUBLISHED", "LOCKED"] },
      },
    }),
    wantsProduct
      ? prisma.product.count({ where: { ownerId: userId, createdAt: { gte: monthStart } } })
      : Promise.resolve(0),
    wantsProduct
      ? prisma.product.findUnique({ where: { slug: productSlug }, select: { id: true } })
      : Promise.resolve(null),
    // Phase 3.5: admin override → query DN theo id thay vì auto-match
    // userId. Validate role inline; non-admin gửi companyId sẽ bị ignore.
    wantsProduct
      ? (product?.companyId && (session.user.role === "ADMIN" || session.user.role === "INFINITE")
          ? prisma.company.findUnique({
              where: { id: product.companyId },
              select: { id: true, ownerId: true },
            })
          : prisma.company.findUnique({
              where: { ownerId: userId },
              select: { id: true, ownerId: true },
            }))
      : Promise.resolve(null),
  ])

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Quota checks (siteConfig is cached 60s — usually a no-op DB call)
  const limit = await getMonthlyQuota({
    role: user.role,
    contributionTotal: user.contributionTotal,
    accountType: user.accountType,
  })
  if (limit !== -1 && postCount >= limit) {
    return NextResponse.json(
      {
        error: `Bạn đã đăng ${postCount}/${limit} bài tháng này. Hạn mức sẽ được làm mới vào đầu tháng sau. Nâng cấp VIP để tăng hạn mức.`,
        quota: { used: postCount, limit, remaining: 0, resetAt: startOfNextMonth() },
      },
      { status: 429 },
    )
  }

  if (wantsProduct) {
    const productLimit = await getMonthlyProductQuota({
      role: user.role,
      contributionTotal: user.contributionTotal,
      accountType: user.accountType,
    })
    if (productLimit !== -1 && productCount >= productLimit) {
      return NextResponse.json(
        { error: `Đã đạt hạn mức ${productLimit} sản phẩm/tháng. Hạn mức sẽ làm mới vào ${startOfNextMonth().toLocaleDateString("vi-VN")}.` },
        { status: 429 },
      )
    }
    if (slugConflict) {
      return NextResponse.json({ error: "Slug sản phẩm đã được sử dụng — vui lòng chọn slug khác" }, { status: 409 })
    }
  }

  const sanitizedContent = DOMPurify.sanitize(content)

  // Moderation: ADMIN bypass (auto-PUBLISHED), mọi role khác vào hàng PENDING
  // chờ admin duyệt. Không bypass cho VIP/INFINITE để giữ công bằng mọi tier.
  const initialStatus: "PENDING" | "PUBLISHED" =
    session.user.role === "ADMIN" ? "PUBLISHED" : "PENDING"

  // Sanitize coverImageUrl: chỉ accept Cloudinary domain (đã upload xong).
  const sanitizedCover =
    typeof coverImageUrl === "string" &&
    coverImageUrl.startsWith("https://res.cloudinary.com/")
      ? coverImageUrl
      : null

  // Trường hợp đơn giản — chỉ tạo Post
  if (!wantsProduct) {
    const post = await prisma.post.create({
      data: {
        authorId: userId,
        title: title || null,
        content: sanitizedContent,
        imageUrls: [],
        coverImageUrl: sanitizedCover,
        category: cat,
        status: initialStatus,
        // INFINITE = "full quyền VIP Vàng" per schema — their posts get
        // the premium badge alongside regular VIP. Admins don't typically
        // post via this flow, so they're left out.
        isPremium: session.user.role === "VIP" || session.user.role === "INFINITE",
        authorPriority: user.displayPriority,
      },
      include: { author: { select: POST_AUTHOR_SELECT } },
    })
    // Invalidate the /feed ISR cache so the new post shows up on the
    // next visit instead of waiting up to 60s for the revalidate tick.
    revalidatePath("/[locale]/feed", "page")
    revalidateTag("feed", "max")
    return NextResponse.json({ post }, { status: 201 })
  }

  // Trường hợp gộp — tạo Post + Product trong 1 transaction, link qua postId
  const productImages = extractImageUrls(sanitizedContent)
  // Bug fix (2026-04-29): lưu sanitized HTML thay vì plain text. Detail page
  // render description bằng prose + dangerouslySetInnerHTML → kỳ vọng HTML.
  // ProductForm edit cũng dùng RichTextEditor (HTML output), nên field này
  // luôn là HTML. Cap 15000 ký tự để khớp zod schema bên _actions.ts.
  const productDescription = sanitizedContent.slice(0, 15_000)

  // Phase 3.5 (2026-04): admin override → effective owner = chủ DN, không
  // phải session.user.id. Post + Product cùng attribute về chủ DN để bài
  // hiển thị như do thành viên đại diện đăng (admin "ghosts").
  const adminOverride = !!(
    product?.companyId &&
    company?.ownerId &&
    company.ownerId !== userId &&
    (session.user.role === "ADMIN" || session.user.role === "INFINITE")
  )
  let effectiveOwnerId = userId
  let effectiveOwnerPriority = user.displayPriority
  let effectiveOwnerRole: "ADMIN" | "INFINITE" | "VIP" | "GUEST" | string = user.role
  if (adminOverride && company?.ownerId) {
    const ownerInfo = await prisma.user.findUnique({
      where: { id: company.ownerId },
      select: { displayPriority: true, role: true },
    })
    if (ownerInfo) {
      effectiveOwnerId = company.ownerId
      effectiveOwnerPriority = ownerInfo.displayPriority
      effectiveOwnerRole = ownerInfo.role
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        authorId: effectiveOwnerId,
        title: title || product!.name!,
        content: sanitizedContent,
        imageUrls: productImages,
        coverImageUrl: sanitizedCover,
        category: "PRODUCT",
        // Admin override → vẫn giữ moderation status như flow non-admin
        // bình thường (PENDING) để không "lén" auto-publish bài hộ DN.
        status: initialStatus,
        // INFINITE = "full quyền VIP Vàng" per schema — their posts get
        // the premium badge alongside regular VIP. Admin override → kế thừa
        // tier của chủ DN (effectiveOwnerRole).
        isPremium: effectiveOwnerRole === "VIP" || effectiveOwnerRole === "INFINITE",
        authorPriority: effectiveOwnerPriority,
      },
      include: { author: { select: POST_AUTHOR_SELECT } },
    })
    // Phase 4 (2026-04-29): clean variants — trim + bỏ row trống + cap 10.
    const cleanedVariants = Array.isArray(product?.variants)
      ? product!.variants!
          .map((v) => ({
            name: typeof v?.name === "string" ? v.name.trim() : "",
            priceRange: typeof v?.priceRange === "string" ? v.priceRange.trim() : "",
          }))
          .filter((v) => v.name && v.name.length <= 50)
          .slice(0, 10)
      : []

    const newProduct = await tx.product.create({
      data: {
        ownerId: effectiveOwnerId,
        companyId: company?.id ?? null,
        postId: post.id,
        name: product!.name!.trim(),
        slug: productSlug,
        description: productDescription || null,
        category: product!.category?.trim() || null,
        priceRange: product!.priceRange?.trim() || null,
        imageUrls: productImages,
        ownerPriority: effectiveOwnerPriority,
        // Phase 4 (2026-04-29): spec sheet + variants — đồng bộ với ProductForm.
        origin: product!.origin?.trim() || null,
        treeAge: product!.treeAge?.trim() || null,
        packagingNote: product!.packagingNote?.trim() || null,
        scentProfile: product!.scentProfile?.trim() || null,
        variants: cleanedVariants.length > 0 ? cleanedVariants : undefined,
        // Phase 4 follow-up: create flow → fill default nếu user bỏ trống.
        shippingPolicy: product!.shippingPolicy?.trim() || PRODUCT_DEFAULT_SHIPPING,
        returnPolicy: product!.returnPolicy?.trim() || PRODUCT_DEFAULT_RETURN,
      },
    })
    // Seed v0 audit snapshot. Nếu admin override, đánh editedRole=ADMIN +
    // ghi reason để revision history nhận biết SP do admin tạo hộ.
    await writeProductRevision({
      product: newProduct,
      editedBy: userId,
      editedRole: adminOverride ? "ADMIN" : "OWNER",
      reason: adminOverride ? "Admin đăng SP hộ DN qua /feed/tao-bai" : undefined,
      tx,
    })
    return { post, product: newProduct }
  })

  revalidatePath("/[locale]/feed", "page")
  revalidateTag("feed", "max")
  return NextResponse.json(
    { post: { ...created.post, product: created.product } },
    { status: 201 },
  )
}
