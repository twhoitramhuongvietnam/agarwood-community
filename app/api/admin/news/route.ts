import { NextResponse, after } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { sanitizeArticleHtml } from "@/lib/sanitize"
import { scoreSeo } from "@/lib/seo/score"
import { getPreviousTitles } from "@/lib/news-seo-cache"
import { autoTranslateNewsMissing } from "@/lib/news-auto-translate"
import { writeProductRevision } from "@/lib/product-revision"
import { creditNewsRoyaltyOnPublish } from "@/lib/news-royalty"

export const maxDuration = 300

// ── Phase 3.3 Q5 helpers (PRODUCT productMode) ───────────────────────────

/** Strip HTML tags + collapse whitespace. Dùng để derive excerpt từ HTML
 *  description/content khi không có excerpt riêng. */
function stripHtml(html: string | null | undefined): string {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

/** Escape user-supplied plain text trước khi nhúng vào HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/** Plain text → HTML paragraphs (split on blank lines, single line break = <br>).
 *  Intro từ <textarea> nên là plain text, không phải HTML. */
function paragraphsFromText(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n")
}

/** Compose News.content từ intro (plain text) + Product.description (HTML).
 *  Intro wrap trong .news-intro để CSS có thể style riêng (italic, accent).
 *  Sanitize ở caller. */
function composeProductNewsContent(
  intro: string,
  productDescription: string | null,
): string {
  const parts: string[] = []
  const introHtml = paragraphsFromText(intro)
  if (introHtml) parts.push(`<div class="news-intro">${introHtml}</div>`)
  if (productDescription && productDescription.trim()) {
    parts.push(productDescription)
  }
  return parts.join("\n")
}

/** Derive excerpt: ưu tiên intro (plain), fallback strip(description) cắt 200. */
function deriveExcerpt(
  intro: string | null,
  description: string | null,
): string | null {
  const introText = (intro ?? "").trim()
  if (introText.length >= 30) return introText.slice(0, 200)
  const descText = stripHtml(description)
  if (!descText) return null
  return descText.slice(0, 200)
}

/** Đảm bảo News.slug duy nhất. Append `-1`, `-2`,... nếu trùng (tối đa 50 lần). */
async function ensureUniqueNewsSlug(base: string): Promise<string> {
  let candidate = base
  for (let i = 0; i < 50; i++) {
    const exists = await prisma.news.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
    candidate = `${base}-${i + 1}`
  }
  // Cực hiếm — fallback timestamp
  return `${base}-${Date.now()}`
}

/**
 * Invalidate surfaces depending on News table.
 *
 * `publicFacing=false` (default true) → skip re-validating public pages +
 * sitemap/feed. Dùng cho save nháp (`isPublished=false` cả trước + sau): nội
 * dung không ra ngoài thì không cần đẩy cache homepage/tin-tuc/sitemap.
 *
 * Luôn invalidate admin list (`/admin/tin-tuc`) vì admin mong thấy status
 * mới ngay sau CRUD, và cache tag "news:titles" để SEO-score endpoint
 * re-query nếu title vừa đổi.
 */
function revalidateNewsSurfaces({ publicFacing = true }: { publicFacing?: boolean } = {}) {
  revalidatePath("/admin/tin-tuc")
  revalidateTag("news:titles", "max")
  if (!publicFacing) return
  revalidatePath("/sitemap.xml")
  revalidatePath("/feed.xml")
  revalidatePath("/[locale]/tin-tuc", "layout")
  revalidatePath("/[locale]/nghien-cuu", "layout")
  revalidateTag("homepage", "max")
  revalidateTag("news", "max")
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "news:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // Ai không có `news:publish` → force nháp. Admin (admin:full) + Ban
  // Truyền thông (có news:publish) bật publish được. Infinite + Ban Thư ký
  // chỉ write được, phải chờ admin bật xuất bản.
  const canPublish = hasPermission(perms, "news:publish")

  const body = await req.json()
  const {
    title, title_en, title_zh, title_ar,
    slug,
    excerpt, excerpt_en, excerpt_zh, excerpt_ar,
    content, content_en, content_zh, content_ar,
    coverImageUrl,
    category,
    template,
    relatedCompanyId,
    relatedProductId,
    /** Phase 3.3 Q5 (2026-04): khi admin tạo News PRODUCT, gửi productData
     *  để server tạo Product mới gắn vào DN đã chọn. Bỏ ProductPicker —
     *  khách hàng nói chỉ cần tạo SP chưa có. */
    productData,
    /** "Lời giới thiệu" — đoạn mở đầu admin viết riêng cho bài tin (1-2 câu).
     *  Plain text từ textarea; server escape + wrap <p>, prepend vào News.content
     *  trước Product.description. VI-only (intro ngắn, hiếm cần dịch riêng). */
    intro,
    /** Phase 3.5 (2026-04): EXTERNAL_NEWS attribution. Bắt buộc khi
     *  category=EXTERNAL_NEWS — server reject nếu thiếu. */
    sourceName,
    sourceUrl,
    gallery,
    isPublished,
    isPinned,
    publishedAt,
    /** Override authorId — chỉ ADMIN (admin:full) mới được set khác current user.
     *  Dùng khi đăng hộ tác giả khác (vd Thư ký đăng giùm Chủ tịch). */
    authorId: authorIdOverride,
    // SEO fields
    seoTitle, seoTitle_en, seoTitle_zh, seoTitle_ar,
    seoDescription, seoDescription_en, seoDescription_zh, seoDescription_ar,
    coverImageAlt, coverImageAlt_en, coverImageAlt_zh, coverImageAlt_ar,
    focusKeyword,
    secondaryKeywords,
    // Flag → schedule after() dịch các locale thiếu (xem PATCH route comment).
    autoTranslateMissing,
  } = body

  // Resolve final authorId: chỉ admin:full mới được override; còn lại =
  // session.user.id. Validate user tồn tại để tránh broken FK.
  let finalAuthorId = session.user.id
  if (typeof authorIdOverride === "string" && authorIdOverride && authorIdOverride !== session.user.id) {
    if (!hasPermission(perms, "admin:full")) {
      return NextResponse.json(
        { error: "Chỉ Admin mới được chỉ định tác giả khác" },
        { status: 403 },
      )
    }
    const exists = await prisma.user.findUnique({
      where: { id: authorIdOverride },
      select: { id: true },
    })
    if (!exists) {
      return NextResponse.json({ error: "Tác giả không tồn tại" }, { status: 400 })
    }
    finalAuthorId = authorIdOverride
  }

  // Phase 3.3 Q5: PRODUCT + productData = "simplified mode" — admin không
  // gửi title/slug, server derive từ Product. Skip validation cho mode này.
  const productMode = category === "PRODUCT" && !!productData
  if (!productMode) {
    if (!title || !slug || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Tiêu đề và slug là bắt buộc" },
        { status: 400 }
      )
    }
  }

  const validCategory =
    category === "RESEARCH"
      ? "RESEARCH"
      : category === "LEGAL"
        ? "LEGAL"
        : category === "SPONSORED_PRODUCT"
          ? "SPONSORED_PRODUCT"
          : category === "BUSINESS"
            ? "BUSINESS"
            : category === "PRODUCT"
              ? "PRODUCT"
              : category === "EXTERNAL_NEWS"
                ? "EXTERNAL_NEWS"
                : category === "AGRICULTURE"
                  ? "AGRICULTURE"
                  : "GENERAL"

  // Phase 3.7 round 4 (2026-04): secondary categories — max 3, exclude
  // primary, mỗi value phải là NewsCategory hợp lệ.
  const VALID_NEWS_CATEGORIES = [
    "GENERAL",
    "RESEARCH",
    "LEGAL",
    "SPONSORED_PRODUCT",
    "BUSINESS",
    "PRODUCT",
    "EXTERNAL_NEWS",
    "AGRICULTURE",
  ] as const
  const rawSecondary = Array.isArray(body.secondaryCategories)
    ? body.secondaryCategories
    : []
  const validSecondaryCategories = [
    ...new Set(
      rawSecondary
        .filter((c: unknown): c is string =>
          typeof c === "string" && (VALID_NEWS_CATEGORIES as readonly string[]).includes(c),
        )
        .filter((c: string) => c !== validCategory),
    ),
  ].slice(0, 3) as (typeof VALID_NEWS_CATEGORIES)[number][]

  // Phase 3.7 round 4 (2026-04): admin-only pin per-section trên trang chủ.
  // Không validate phải subset của primary+secondary — bài có thể được pin
  // lên section nào tùy admin (vd pin RESEARCH bài primary BUSINESS để
  // promote cross-list). Filter chỉ cho admin:full + value enum hợp lệ.
  const isAdminFull = hasPermission(perms, "admin:full")
  const rawPinned = Array.isArray(body.pinnedInCategories)
    ? body.pinnedInCategories
    : []
  const validPinnedInCategories = isAdminFull
    ? ([
        ...new Set(
          rawPinned.filter((c: unknown): c is string =>
            typeof c === "string" && (VALID_NEWS_CATEGORIES as readonly string[]).includes(c),
          ),
        ),
      ] as (typeof VALID_NEWS_CATEGORIES)[number][])
    : []

  // Validate template + Phase 3 fields. PHOTO/VIDEO yêu cầu gallery có ít
  // nhất 1 entry; BUSINESS yêu cầu relatedCompanyId; PRODUCT yêu cầu cả 2.
  const validTemplate =
    template === "PHOTO" ? "PHOTO" : template === "VIDEO" ? "VIDEO" : "NORMAL"
  const galleryArray = Array.isArray(gallery)
    ? gallery
        .filter((g): g is { url: string; caption?: string } => g && typeof g.url === "string")
        .map((g) => ({ url: g.url, caption: typeof g.caption === "string" ? g.caption : "" }))
    : []
  if ((validTemplate === "PHOTO" || validTemplate === "VIDEO") && galleryArray.length === 0) {
    return NextResponse.json(
      { error: `Tin ${validTemplate === "PHOTO" ? "ảnh" : "video"} cần ít nhất 1 mục.` },
      { status: 400 },
    )
  }
  if (validCategory === "BUSINESS" && !relatedCompanyId) {
    return NextResponse.json({ error: "Tin doanh nghiệp cần chọn doanh nghiệp." }, { status: 400 })
  }
  if (validCategory === "EXTERNAL_NEWS") {
    const srcName = typeof sourceName === "string" ? sourceName.trim() : ""
    const srcUrl = typeof sourceUrl === "string" ? sourceUrl.trim() : ""
    if (!srcName) {
      return NextResponse.json({ error: "Tin báo chí ngoài cần điền tên báo nguồn." }, { status: 400 })
    }
    if (!/^https?:\/\/.+/i.test(srcUrl)) {
      return NextResponse.json({ error: "URL bài gốc phải bắt đầu bằng http:// hoặc https://" }, { status: 400 })
    }
  }
  // PRODUCT: hoặc gửi `productData` (Phase 3.3 Q5 — admin đăng hộ, server tạo
  // SP mới gắn DN đã chọn) hoặc gửi `relatedProductId` cho tương thích cũ.
  // Cần `relatedCompanyId` trong cả 2 path.
  if (validCategory === "PRODUCT") {
    if (!relatedCompanyId) {
      return NextResponse.json(
        { error: "Tin sản phẩm cần chọn doanh nghiệp." },
        { status: 400 },
      )
    }
    if (!productData && !relatedProductId) {
      return NextResponse.json(
        { error: "Tin sản phẩm cần thông tin sản phẩm hoặc liên kết sản phẩm có sẵn." },
        { status: 400 },
      )
    }
  }

  // Phase 3.3 Q5 (2026-04): khi tạo News PRODUCT + có productData, server
  // tự tạo Product mới gắn vào DN đã chọn. Owner = Company.owner (hội viên
  // đã trả tiền nhờ admin đăng) — admin không cần chỉ định ownerUserId.
  // Validation (read queries) chạy trước transaction; create Product +
  // create News bọc trong transaction để đảm bảo atomic — nếu News fail
  // (vd slug conflict), Product không bị orphan.
  let pendingProductInput: {
    ownerId: string
    companyId: string
    name: string
    name_en: string | null
    name_zh: string | null
    name_ar: string | null
    slug: string
    description: string | null
    description_en: string | null
    description_zh: string | null
    description_ar: string | null
    category: string | null
    category_en: string | null
    category_zh: string | null
    category_ar: string | null
    priceRange: string | null
    imageUrls: string[]
    isPublished: boolean
    ownerPriority: number
  } | null = null
  if (validCategory === "PRODUCT" && productData) {
    const pd = productData as Record<string, unknown>
    const productName = typeof pd.name === "string" ? pd.name.trim() : ""
    const productSlug = typeof pd.slug === "string" ? pd.slug.trim() : ""
    const imageUrls = Array.isArray(pd.imageUrls) ? (pd.imageUrls as unknown[]).filter((x): x is string => typeof x === "string") : []
    if (productName.length < 2) {
      return NextResponse.json(
        { error: "Tên sản phẩm tối thiểu 2 ký tự." },
        { status: 400 },
      )
    }
    if (!/^[a-z0-9-]+$/.test(productSlug)) {
      return NextResponse.json(
        { error: "Slug sản phẩm không hợp lệ." },
        { status: 400 },
      )
    }
    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "Cần ít nhất 1 ảnh sản phẩm." },
        { status: 400 },
      )
    }

    const company = await prisma.company.findUnique({
      where: { id: relatedCompanyId as string },
      select: { id: true, ownerId: true },
    })
    if (!company) {
      return NextResponse.json(
        { error: "Doanh nghiệp không tồn tại." },
        { status: 400 },
      )
    }
    const slugConflict = await prisma.product.findUnique({
      where: { slug: productSlug },
      select: { id: true },
    })
    if (slugConflict) {
      return NextResponse.json(
        { error: `Slug sản phẩm "${productSlug}" đã tồn tại. Vui lòng đổi slug.` },
        { status: 409 },
      )
    }
    const owner = await prisma.user.findUnique({
      where: { id: company.ownerId },
      select: { displayPriority: true },
    })

    pendingProductInput = {
      ownerId: company.ownerId,
      companyId: company.id,
      name: productName,
      name_en: typeof pd.name_en === "string" ? pd.name_en : null,
      name_zh: typeof pd.name_zh === "string" ? pd.name_zh : null,
      name_ar: typeof pd.name_ar === "string" ? pd.name_ar : null,
      slug: productSlug,
      description: typeof pd.description === "string" ? pd.description : null,
      description_en: typeof pd.description_en === "string" ? pd.description_en : null,
      description_zh: typeof pd.description_zh === "string" ? pd.description_zh : null,
      description_ar: typeof pd.description_ar === "string" ? pd.description_ar : null,
      category: typeof pd.category === "string" ? pd.category : null,
      category_en: typeof pd.category_en === "string" ? pd.category_en : null,
      category_zh: typeof pd.category_zh === "string" ? pd.category_zh : null,
      category_ar: typeof pd.category_ar === "string" ? pd.category_ar : null,
      priceRange: typeof pd.priceRange === "string" ? pd.priceRange : null,
      imageUrls,
      isPublished: true,
      ownerPriority: owner?.displayPriority ?? 0,
    }
  }

  // Phase 3.3 Q5: derive News fields from Product khi productMode. News chỉ
  // là wrapper view trên Product — admin không cần điền title/slug/excerpt/
  // cover/content riêng. Slug News có namespace riêng (table news vs product),
  // nên dùng cùng slug Product được — chỉ cần check unique trong news table.
  let derivedTitle = title as string | undefined
  let derivedTitleEn: string | null = title_en ?? null
  let derivedTitleZh: string | null = title_zh ?? null
  let derivedTitleAr: string | null = title_ar ?? null
  let derivedSlug = slug as string | undefined
  let derivedExcerpt: string | null = excerpt ?? null
  let derivedExcerptEn: string | null = excerpt_en ?? null
  let derivedExcerptZh: string | null = excerpt_zh ?? null
  let derivedExcerptAr: string | null = excerpt_ar ?? null
  let derivedCoverImageUrl: string | null = coverImageUrl ?? null
  let derivedContent = content as string | undefined
  let derivedContentEn: string | null = content_en ?? null
  let derivedContentZh: string | null = content_zh ?? null
  let derivedContentAr: string | null = content_ar ?? null

  if (productMode && pendingProductInput) {
    derivedTitle = pendingProductInput.name
    derivedTitleEn = pendingProductInput.name_en
    derivedTitleZh = pendingProductInput.name_zh
    derivedTitleAr = pendingProductInput.name_ar

    derivedSlug = await ensureUniqueNewsSlug(pendingProductInput.slug)

    // Cover = ảnh đại diện SP (imageUrls[0]).
    derivedCoverImageUrl = pendingProductInput.imageUrls[0] ?? null

    // Build content = intro (text → wrap p) + Product.description (HTML).
    // Snapshot tại lúc tạo — nếu Product.description đổi sau, News.content
    // không đồng bộ tự động (acceptable cho MVP, document để admin biết).
    const introText = typeof intro === "string" ? intro : ""
    derivedContent = composeProductNewsContent(introText, pendingProductInput.description)
    // Locale content chỉ kèm Product.description_xx (intro VI-only, không
    // chèn vào bản dịch). Null nếu Product chưa có bản dịch.
    derivedContentEn = pendingProductInput.description_en ?? null
    derivedContentZh = pendingProductInput.description_zh ?? null
    derivedContentAr = pendingProductInput.description_ar ?? null

    // Excerpt = intro (nếu có) hoặc 200 ký tự đầu của description.
    derivedExcerpt = deriveExcerpt(introText, pendingProductInput.description)
    derivedExcerptEn = deriveExcerpt(null, pendingProductInput.description_en)
    derivedExcerptZh = deriveExcerpt(null, pendingProductInput.description_zh)
    derivedExcerptAr = deriveExcerpt(null, pendingProductInput.description_ar)
  }

  // Compute SEO score against VI content (source-of-truth). previousTitles
  // đi qua unstable_cache (tag "news:titles"); mỗi save chỉ invalidate 1
  // lần ở cuối, không scan 1000 row mỗi keystroke.
  const sanitizedContent = derivedContent ? sanitizeArticleHtml(derivedContent) : ""
  const previousTitles = await getPreviousTitles()
  const translatedLocaleCount = [derivedTitleEn, derivedTitleZh, derivedTitleAr].filter(
    (t) => typeof t === "string" && t.trim().length > 0,
  ).length
  const seoResult = scoreSeo({
    title: derivedTitle ?? "",
    seoTitle: seoTitle || null,
    excerpt: derivedExcerpt ?? null,
    seoDescription: seoDescription || null,
    content: sanitizedContent,
    focusKeyword: focusKeyword || null,
    secondaryKeywords: Array.isArray(secondaryKeywords) ? secondaryKeywords : [],
    coverImageUrl: derivedCoverImageUrl ?? null,
    coverImageAlt: coverImageAlt || null,
    slug: derivedSlug ?? "",
    previousTitles,
    translatedLocaleCount,
  })

  const finalIsPublished = canPublish ? (isPublished ?? false) : false
  // Defensive (Phase 3.7 round 4, 2026-04): publish lần đầu mà client không
  // gửi publishedAt (vd React state batching ở editor làm onClick auto-fill
  // chưa kịp commit khi onSubmit chạy) → auto-set now() để bài có ngày hợp
  // lệ. Section trang chủ + public list sort by date — null = tụt cuối.
  const finalPublishedAt = publishedAt
    ? new Date(publishedAt)
    : finalIsPublished
      ? new Date()
      : null

  // Atomic create: nếu Product mới được tạo (PRODUCT + productData), gắn vào
  // News trong cùng transaction để tránh orphan khi News fail unique slug.
  const { news, createdProductId } = await prisma.$transaction(async (tx) => {
    let createdProductId: string | null = null
    if (pendingProductInput) {
      const created = await tx.product.create({ data: pendingProductInput })
      // v0 revision — đồng bộ với feed flow ở `_actions.ts/createProduct`.
      // editedRole=ADMIN để revision history nhận biết SP gốc do admin tạo
      // hộ owner (vs OWNER khi member tự đăng).
      await writeProductRevision({
        product: created,
        editedBy: session.user.id,
        editedRole: "ADMIN",
        reason: "Tạo qua tin tức admin (đăng hộ DN)",
        tx,
      })
      createdProductId = created.id
    }
    const finalRelatedProductId =
      validCategory === "PRODUCT"
        ? createdProductId ?? (relatedProductId as string | null) ?? null
        : null
    const created = await tx.news.create({
      data: {
        title: derivedTitle as string,
        title_en: derivedTitleEn || null,
        title_zh: derivedTitleZh || null,
        title_ar: derivedTitleAr || null,
        slug: derivedSlug as string,
        excerpt: derivedExcerpt ?? null,
        excerpt_en: derivedExcerptEn || null,
        excerpt_zh: derivedExcerptZh || null,
        excerpt_ar: derivedExcerptAr || null,
        content: sanitizedContent,
        content_en: derivedContentEn ? sanitizeArticleHtml(derivedContentEn) : null,
        content_zh: derivedContentZh ? sanitizeArticleHtml(derivedContentZh) : null,
        content_ar: derivedContentAr ? sanitizeArticleHtml(derivedContentAr) : null,
        coverImageUrl: derivedCoverImageUrl ?? null,
        category: validCategory,
        secondaryCategories: validSecondaryCategories,
        pinnedInCategories: validPinnedInCategories,
        template: validTemplate,
        relatedCompanyId: validCategory === "BUSINESS" || validCategory === "PRODUCT"
          ? (relatedCompanyId as string)
          : null,
        relatedProductId: finalRelatedProductId,
        gallery: validTemplate !== "NORMAL" ? galleryArray : undefined,
        isPublished: finalIsPublished,
        isPinned: isPinned ?? false,
        publishedAt: finalPublishedAt,
        authorId: finalAuthorId,
        // SEO
        seoTitle: seoTitle || null,
        seoTitle_en: seoTitle_en || null,
        seoTitle_zh: seoTitle_zh || null,
        seoTitle_ar: seoTitle_ar || null,
        seoDescription: seoDescription || null,
        seoDescription_en: seoDescription_en || null,
        seoDescription_zh: seoDescription_zh || null,
        seoDescription_ar: seoDescription_ar || null,
        coverImageAlt: coverImageAlt || null,
        coverImageAlt_en: coverImageAlt_en || null,
        coverImageAlt_zh: coverImageAlt_zh || null,
        coverImageAlt_ar: coverImageAlt_ar || null,
        focusKeyword: focusKeyword || null,
        secondaryKeywords: Array.isArray(secondaryKeywords) ? secondaryKeywords : [],
        seoScore: seoResult.legacyScore,
        seoScoreDetail: seoResult as unknown as object,
        // Phase 3.5: EXTERNAL_NEWS attribution. Strip cho non-EXTERNAL.
        sourceName: validCategory === "EXTERNAL_NEWS"
          ? (typeof sourceName === "string" ? sourceName.trim() : null) || null
          : null,
        sourceUrl: validCategory === "EXTERNAL_NEWS"
          ? (typeof sourceUrl === "string" ? sourceUrl.trim() : null) || null
          : null,
      },
    })
    // Cộng tiền nhuận bút cho tác giả khi bài được publish ngay lúc tạo.
    // Idempotent — nếu bài này đã credit trước thì skip (PATCH route cũng
    // gọi cùng helper khi bài chuyển từ draft → publish).
    if (finalIsPublished) {
      await creditNewsRoyaltyOnPublish(tx, {
        newsId: created.id,
        authorId: created.authorId,
        title: created.title,
        createdByAdminId: session.user!.id!,
      })
    }
    return { news: created, createdProductId }
  })

  // Bài mới mà để nháp → chỉ invalidate admin list + titles cache, không
  // cần đánh cache /tin-tuc, /nghien-cuu, sitemap, feed (chưa có gì public).
  revalidateNewsSurfaces({ publicFacing: finalIsPublished })

  // SP mới gắn vào marketplace surfaces — invalidate chỉ khi News public.
  // Nháp thì chưa cần (Product cũng chưa có ai biết tới qua News).
  if (createdProductId && finalIsPublished) {
    revalidatePath("/san-pham-doanh-nghiep")
    revalidatePath("/san-pham-chung-nhan")
  }

  // Auto-translate missing locales trong nền (xem PATCH route).
  if (autoTranslateMissing === true) {
    const snapshot = {
      title: news.title ?? "",
      excerpt: news.excerpt ?? "",
      content: news.content ?? "",
    }
    after(async () => {
      try {
        await autoTranslateNewsMissing({ newsId: news.id, expectedVi: snapshot })
      } catch (e) {
        console.error(`[news/${news.id}] auto-translate after() failed:`, e)
      }
    })
  }

  return NextResponse.json({ news }, { status: 201 })
}
