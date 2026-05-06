import { NextResponse, after } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { canAdminWrite } from "@/lib/roles"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { sanitizeArticleHtml } from "@/lib/sanitize"
import { scoreSeo } from "@/lib/seo/score"
import { getPreviousTitles } from "@/lib/news-seo-cache"
import {
  collectNewsCloudinaryIds,
  destroyCloudinaryByPublicIds,
} from "@/lib/cloudinary-server"
import { autoTranslateNewsMissing } from "@/lib/news-auto-translate"
import { creditNewsRoyaltyOnPublish } from "@/lib/news-royalty"

// Kéo lên 5 phút để `after()` auto-translate có đủ budget cho bài dài
// (content 10k chars × 3 locale). Vercel Pro/Hobby đều cho maxDuration=300s.
export const maxDuration = 300

/** Xem ghi chú ở `app/api/admin/news/route.ts`. */
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // GET để editor load bài — cần news:write (Ban Thư ký soạn/sửa) hoặc
  // admin:read. `admin:full` tự động match cả 2 qua `hasPermission`.
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "news:write") && !hasPermission(perms, "admin:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const news = await prisma.news.findUnique({ where: { id } })
  if (!news) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Fetch author info kèm response để editor preset selector. authorId
  // không có FK relation trong schema (legacy) → query rời tay.
  const author = news.authorId
    ? await prisma.user.findUnique({
        where: { id: news.authorId },
        select: { id: true, name: true, email: true, avatarUrl: true },
      })
    : null

  return NextResponse.json({ news, author })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "news:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // `isPublished` chỉ ai có news:publish mới flip được. Không có → strip
  // khỏi patch body bên dưới (trường cũ giữ nguyên).
  const canPublish = hasPermission(perms, "news:publish")

  const { id } = await params
  const body = await req.json()
  const {
    title, title_en, title_zh, title_ar,
    slug,
    excerpt, excerpt_en, excerpt_zh, excerpt_ar,
    content, content_en, content_zh, content_ar,
    coverImageUrl,
    category,
    isPublished,
    isPinned,
    publishedAt,
    seoTitle, seoTitle_en, seoTitle_zh, seoTitle_ar,
    seoDescription, seoDescription_en, seoDescription_zh, seoDescription_ar,
    coverImageAlt, coverImageAlt_en, coverImageAlt_zh, coverImageAlt_ar,
    focusKeyword,
    secondaryKeywords,
    // Flag từ NewsEditor: true → sau khi save, server schedule `after()`
    // để dịch các locale còn thiếu content dựa trên VI vừa lưu.
    autoTranslateMissing,
  } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (title !== undefined) data.title = title
  if ("title_en" in body) data.title_en = title_en || null
  if ("title_zh" in body) data.title_zh = title_zh || null
  if ("title_ar" in body) data.title_ar = title_ar || null
  if (slug !== undefined) data.slug = slug
  if (excerpt !== undefined) data.excerpt = excerpt
  if ("excerpt_en" in body) data.excerpt_en = excerpt_en || null
  if ("excerpt_zh" in body) data.excerpt_zh = excerpt_zh || null
  if ("excerpt_ar" in body) data.excerpt_ar = excerpt_ar || null
  if (content !== undefined) data.content = content ? sanitizeArticleHtml(content) : ""
  if ("content_en" in body) data.content_en = content_en ? sanitizeArticleHtml(content_en) : null
  if ("content_zh" in body) data.content_zh = content_zh ? sanitizeArticleHtml(content_zh) : null
  if ("content_ar" in body) data.content_ar = content_ar ? sanitizeArticleHtml(content_ar) : null
  if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl
  if (category !== undefined)
    data.category =
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
  // Phase 3.7 round 4 (2026-04): admin-only pin per-section trên trang chủ.
  // Khác secondaryCategories (max 3, exclude primary), pinned không có ràng
  // buộc phải subset primary+secondary — admin có thể pin RESEARCH cho bài
  // BUSINESS để promote cross-list. Chỉ admin:full được set; user khác →
  // strip khỏi patch (giữ giá trị cũ).
  if ("pinnedInCategories" in body && hasPermission(perms, "admin:full")) {
    const VALID_NEWS_CATEGORIES = [
      "GENERAL", "RESEARCH", "LEGAL", "SPONSORED_PRODUCT",
      "BUSINESS", "PRODUCT", "EXTERNAL_NEWS", "AGRICULTURE",
    ]
    const raw = Array.isArray(body.pinnedInCategories) ? body.pinnedInCategories : []
    data.pinnedInCategories = [
      ...new Set(
        raw.filter((c: unknown): c is string =>
          typeof c === "string" && VALID_NEWS_CATEGORIES.includes(c),
        ),
      ),
    ]
  }
  // Phase 3.7 round 4 (2026-04): secondary categories — max 3, exclude primary.
  if ("secondaryCategories" in body) {
    const VALID_NEWS_CATEGORIES = [
      "GENERAL", "RESEARCH", "LEGAL", "SPONSORED_PRODUCT",
      "BUSINESS", "PRODUCT", "EXTERNAL_NEWS", "AGRICULTURE",
    ]
    const raw = Array.isArray(body.secondaryCategories) ? body.secondaryCategories : []
    // Determine effective primary (newly set or existing). Caller có thể PATCH
    // chỉ secondaryCategories mà không touch category — query DB để lấy primary
    // hiện tại để loại trừ. Để đơn giản: dùng data.category nếu set, else
    // không exclude (tin cậy client).
    const effectivePrimary =
      typeof data.category === "string"
        ? data.category
        : null
    data.secondaryCategories = [
      ...new Set(
        raw
          .filter((c: unknown): c is string =>
            typeof c === "string" && VALID_NEWS_CATEGORIES.includes(c),
          )
          .filter((c: string) => effectivePrimary === null || c !== effectivePrimary),
      ),
    ].slice(0, 3)
  }
  if (body.template !== undefined) {
    data.template =
      body.template === "PHOTO"
        ? "PHOTO"
        : body.template === "VIDEO"
          ? "VIDEO"
          : "NORMAL"
  }
  if ("relatedCompanyId" in body) {
    data.relatedCompanyId = body.relatedCompanyId || null
  }
  if ("relatedProductId" in body) {
    data.relatedProductId = body.relatedProductId || null
  }
  // Phase 3.5: EXTERNAL_NEWS attribution. Pass-through nullable.
  if ("sourceName" in body) {
    data.sourceName = typeof body.sourceName === "string" && body.sourceName.trim()
      ? body.sourceName.trim()
      : null
  }
  if ("sourceUrl" in body) {
    data.sourceUrl = typeof body.sourceUrl === "string" && body.sourceUrl.trim()
      ? body.sourceUrl.trim()
      : null
  }
  if ("gallery" in body) {
    data.gallery = Array.isArray(body.gallery)
      ? body.gallery
          .filter((g: { url?: unknown }) => g && typeof g.url === "string")
          .map((g: { url: string; caption?: unknown }) => ({
            url: g.url,
            caption: typeof g.caption === "string" ? g.caption : "",
          }))
      : null
  }
  if (isPublished !== undefined && canPublish) data.isPublished = isPublished
  if (isPinned !== undefined) data.isPinned = isPinned
  if (publishedAt !== undefined)
    data.publishedAt = publishedAt ? new Date(publishedAt) : null
  // Author change: chỉ admin:full mới được. Validate user tồn tại.
  if ("authorId" in body && typeof body.authorId === "string" && body.authorId) {
    if (!hasPermission(perms, "admin:full")) {
      return NextResponse.json(
        { error: "Chỉ Admin mới được đổi tác giả" },
        { status: 403 },
      )
    }
    const exists = await prisma.user.findUnique({
      where: { id: body.authorId },
      select: { id: true },
    })
    if (!exists) {
      return NextResponse.json({ error: "Tác giả không tồn tại" }, { status: 400 })
    }
    data.authorId = body.authorId
  }

  // SEO field passthrough — only set when key present in body so we don't
  // accidentally null out fields the editor didn't send.
  const seoKeys = [
    "seoTitle", "seoTitle_en", "seoTitle_zh", "seoTitle_ar",
    "seoDescription", "seoDescription_en", "seoDescription_zh", "seoDescription_ar",
    "coverImageAlt", "coverImageAlt_en", "coverImageAlt_zh", "coverImageAlt_ar",
    "focusKeyword",
  ] as const
  const seoLocals: Record<string, string | null | undefined> = {
    seoTitle, seoTitle_en, seoTitle_zh, seoTitle_ar,
    seoDescription, seoDescription_en, seoDescription_zh, seoDescription_ar,
    coverImageAlt, coverImageAlt_en, coverImageAlt_zh, coverImageAlt_ar,
    focusKeyword,
  }
  for (const k of seoKeys) {
    if (k in body) data[k] = seoLocals[k] || null
  }
  if ("secondaryKeywords" in body) {
    data.secondaryKeywords = Array.isArray(secondaryKeywords) ? secondaryKeywords : []
  }

  // Re-score on every save. Pull current row to fill gaps for fields the
  // editor didn't send.
  const current = await prisma.news.findUnique({ where: { id } })
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  // Defensive (Phase 3.7 round 4, 2026-04): bài public mà publishedAt null
  // sẽ tụt cuối list public + biến mất khỏi top 6 section trang chủ (sort
  // by date). Auto-fill now() khi state cuối là isPublished=true mà chưa
  // có ngày — covers both "vừa flip publish" và "đã true sẵn nhưng client
  // không gửi publishedAt do React batching ở editor".
  const finalIsPublished = "isPublished" in data ? data.isPublished : current.isPublished
  const finalPublishedAt = "publishedAt" in data ? data.publishedAt : current.publishedAt
  if (finalIsPublished === true && !finalPublishedAt) {
    data.publishedAt = new Date()
  }
  const merged = { ...current, ...data } as typeof current

  // Phase 3.7 round 4 (2026-04): admin được đổi primary category sau khi
  // tạo (vd post nhầm GENERAL → BUSINESS). Validate required field cho
  // loại mới — mirror POST route. So sánh với `merged` để cover cả case
  // chỉ patch category mà không gửi relatedCompanyId/source* (giữ giá trị
  // cũ), và case patch cả 2.
  if (merged.category === "BUSINESS" || merged.category === "PRODUCT") {
    if (!merged.relatedCompanyId) {
      return NextResponse.json(
        {
          error: `Tin ${merged.category === "BUSINESS" ? "doanh nghiệp" : "sản phẩm"} cần chọn doanh nghiệp.`,
        },
        { status: 400 },
      )
    }
  }
  if (merged.category === "EXTERNAL_NEWS") {
    const srcName = merged.sourceName?.trim() ?? ""
    const srcUrl = merged.sourceUrl?.trim() ?? ""
    if (!srcName) {
      return NextResponse.json(
        { error: "Tin báo chí ngoài cần điền tên báo nguồn." },
        { status: 400 },
      )
    }
    if (!/^https?:\/\/.+/i.test(srcUrl)) {
      return NextResponse.json(
        { error: "URL bài gốc phải bắt đầu bằng http:// hoặc https://" },
        { status: 400 },
      )
    }
  }

  // Defensive: nếu admin đổi primary mà secondary cũ chứa loại đó thì strip.
  // Ban đầu secondaryCategories build dùng `data.category` để exclude — chỉ
  // hoạt động khi caller patch cả 2. Khi chỉ patch `category`, secondary cũ
  // có thể trùng → loại trừ tại đây để giữ invariant secondary ⊄ primary.
  if (
    Array.isArray(merged.secondaryCategories) &&
    merged.secondaryCategories.includes(merged.category)
  ) {
    data.secondaryCategories = merged.secondaryCategories.filter(
      (c) => c !== merged.category,
    )
  }
  // Dùng cache (tag "news:titles"), loại trừ chính bài đang edit.
  const previousTitles = await getPreviousTitles(id)
  const translatedLocaleCount = [merged.title_en, merged.title_zh, merged.title_ar].filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0,
  ).length
  const seoResult = scoreSeo({
    title: merged.title,
    seoTitle: merged.seoTitle,
    excerpt: merged.excerpt,
    seoDescription: merged.seoDescription,
    content: merged.content ?? "",
    focusKeyword: merged.focusKeyword,
    secondaryKeywords: merged.secondaryKeywords,
    coverImageUrl: merged.coverImageUrl,
    coverImageAlt: merged.coverImageAlt,
    slug: merged.slug,
    previousTitles,
    translatedLocaleCount,
  })
  data.seoScore = seoResult.legacyScore
  data.seoScoreDetail = seoResult as unknown as object

  const news = await prisma.news.update({ where: { id }, data })

  // Bài chuyển từ draft (hoặc đã unpublish) sang public lần đầu → cộng
  // tiền nhuận bút cho tác giả. Helper idempotent: dùng marker [news:{id}]
  // trong reason để skip nếu đã credit trước đó (vd unpublish rồi publish
  // lại không trả lần 2). Lỗi credit không revert news update — log riêng.
  if (!current.isPublished && news.isPublished) {
    try {
      await prisma.$transaction(async (tx) => {
        await creditNewsRoyaltyOnPublish(tx, {
          newsId: news.id,
          authorId: news.authorId,
          title: news.title,
          createdByAdminId: session.user!.id!,
        })
      })
    } catch (e) {
      console.error(`[news/${id}] royalty credit failed:`, e)
    }
  }

  // Bài đã publish hoặc vừa publish lần đầu → cần invalidate mọi public
  // surface. Nếu draft-before + draft-after → content chưa bao giờ ra ngoài,
  // không cần chạm cache homepage/tin-tuc/sitemap/feed.
  const publicFacing = current.isPublished || news.isPublished
  revalidateNewsSurfaces({ publicFacing })

  // Dọn Cloudinary orphan: diff public_id giữa state cũ (current) và mới
  // (news). Ảnh bị replace cover hoặc bị xoá trong editor → destroy.
  // Fire-and-forget; sweep nền là safety net nếu lỗi.
  const oldIds = collectNewsCloudinaryIds(current)
  const newIds = collectNewsCloudinaryIds(news)
  const removed = [...oldIds].filter((id) => !newIds.has(id))
  if (removed.length > 0) {
    void destroyCloudinaryByPublicIds(removed)
      .then((r) =>
        console.log(
          `[news/${id}] cloudinary cleanup (patch): ${r.deleted} deleted, ${r.failed} failed`,
        ),
      )
      .catch((e) => console.error(`[news/${id}] cloudinary cleanup failed:`, e))
  }

  // Auto-translate missing locales trong nền. `after()` giữ function alive
  // tới maxDuration (300s) kể cả khi response đã trả, client đã rời trang.
  // Hàm helper snapshot VI tại thời điểm save + optimistic concurrency check
  // trước write — nếu user Save lại với VI khác, task cũ skip, task mới cover.
  if (autoTranslateMissing === true) {
    const snapshot = {
      title: news.title ?? "",
      excerpt: news.excerpt ?? "",
      content: news.content ?? "",
    }
    after(async () => {
      try {
        await autoTranslateNewsMissing({ newsId: id, expectedVi: snapshot })
      } catch (e) {
        console.error(`[news/${id}] auto-translate after() failed:`, e)
      }
    })
  }

  return NextResponse.json({ news })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Fetch state trước khi xoá: isPublished để biết có cần revalidate public
  // cache không, cover + content 4-locale để biết ảnh nào cần destroy trên
  // Cloudinary.
  const target = await prisma.news.findUnique({
    where: { id },
    select: {
      isPublished: true,
      coverImageUrl: true,
      content: true,
      content_en: true,
      content_zh: true,
      content_ar: true,
    },
  })
  await prisma.news.delete({ where: { id } })
  revalidateNewsSurfaces({ publicFacing: target?.isPublished === true })

  // Dọn ảnh trên Cloudinary. Fire-and-forget sau khi DB đã xoá —
  // nếu destroy fail, sweep nền (scripts/sweep-cloudinary-orphans.ts)
  // sẽ dọn orphan ở lần chạy tiếp.
  if (target) {
    const ids = collectNewsCloudinaryIds(target)
    if (ids.size > 0) {
      void destroyCloudinaryByPublicIds(ids)
        .then((r) =>
          console.log(
            `[news/${id}] cloudinary cleanup (delete): ${r.deleted} deleted, ${r.failed} failed`,
          ),
        )
        .catch((e) => console.error(`[news/${id}] cloudinary cleanup failed:`, e))
    }
  }

  return NextResponse.json({ success: true })
}
