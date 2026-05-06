"use client"

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import { ThumbsUp, MessageSquare, Link2, Check } from "lucide-react"

// Lightbox chỉ mở khi user click ảnh → dynamic import giảm initial JS bundle.
// ssr:false vì component touches document.body + keydown listener.
const FeedLightbox = dynamic(
  () => import("./FeedLightbox").then((m) => m.FeedLightbox),
  { ssr: false },
)

// Promote modal — Phase 3.7 round 4 (2026-04). Admin click "Đẩy lên trang
// chủ" mở modal categorize + pin. Lazy load vì chỉ admin dùng.
const PromotePostModal = dynamic(
  () =>
    import("@/components/features/admin/PromotePostModal").then(
      (m) => m.PromotePostModal,
    ),
  { ssr: false },
)
type NewsCategoryValue =
  | "GENERAL"
  | "RESEARCH"
  | "BUSINESS"
  | "EXTERNAL_NEWS"
  | "AGRICULTURE"

// InlinePostCreator ~500 dòng state + upload logic, chỉ VIP/ADMIN dùng khi
// muốn đăng bài. Dynamic import + ssr:false để defer parse cost tới sau khi
// feed đã LCP, giảm TBT ~100-150ms trên mobile Slow 4G. Loading state là
// 1 placeholder compact để tránh layout shift khi component load xong.
const InlinePostCreator = dynamic(
  () => import("./InlinePostCreator").then((m) => m.InlinePostCreator),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-xl border border-brand-200 p-4">
        <div className="h-12 animate-pulse rounded-lg bg-brand-50" />
      </div>
    ),
  },
)
import { PRODUCT_CATEGORIES } from "@/lib/constants/agarwood"
import { cn } from "@/lib/utils"
import { hasMemberAccess } from "@/lib/roles"
import { cloudinaryResize, rewriteCloudinaryInHtml } from "@/lib/cloudinary"
import { BLUR_DATA_URL } from "@/lib/seo/blur-placeholder"
import {
  saveMyRecentPost,
  loadMyRecentPosts,
  pruneMyRecentPosts,
  removeMyRecentPost,
} from "@/lib/my-recent-posts"
import { useLocale, useTranslations } from "next-intl"

// ── Types ────────────────────────────────────────────────────────────────────

export type PostAuthor = {
  id: string
  name: string
  avatarUrl: string | null
  role: string
  accountType: string
  contributionTotal: number
  company: { name: string; slug: string } | null
}

export type ProductSidecar = {
  id: string
  name: string
  slug: string
  priceRange: string | null
  category: string | null
  badgeUrl: string | null
  certStatus: string
  /** Admin toggle — true → product hiện trong "Sản phẩm tiêu biểu" carousel/page */
  isFeatured: boolean
}

type PromotionRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

export type Post = {
  id: string
  authorId: string
  title: string | null
  content: string
  imageUrls: string[]
  status: string
  category?: string
  isPremium: boolean
  isPromoted: boolean
  newsCategories?: string[]
  authorPriority: number
  viewCount: number
  reportCount: number
  lockedAt: string | null
  lockedBy: string | null
  lockReason: string | null
  /** Moderation reject reason — set bởi admin khi reject. Khác với lockReason
   *  của auto-lock từ report. Hiển thị cho owner biết cần sửa gì. */
  moderationNote?: string | null
  /** Chỉ attach khi viewer === author. Dùng để hiện badge "đang chờ duyệt"
   *  hay "bị từ chối (lý do)" trên card của chính owner. */
  latestPromotionRequest?: {
    status: PromotionRequestStatus
    reviewNote: string | null
  } | null
  createdAt: string
  updatedAt: string
  author: PostAuthor
  product?: ProductSidecar | null
  reactions: { type: string }[]
  _count: { reactions: number; comments: number }
  // ── Optimistic posting state (client-only, not persisted) ──
  /** True while upload + POST are in flight. Card is dimmed + reactions
   *  disabled until the real post ID comes back from the server. */
  isPending?: boolean
  /** Non-null when the optimistic upload/POST failed. Card shows a red
   *  banner with the message + a dismiss button. */
  pendingError?: string | null
}

export type FilterKey = "NEWS" | "PRODUCT" | "MINE" | "PINNED"
/** Filter "MINE" không có composer (không biết tạo category nào) — dùng
 *  type này để narrow prop `mode` cho InlinePostCreator. */
export type ComposerMode = Exclude<FilterKey, "MINE">

// FILTERS moved inside component to access translations

function buildFeedUrl(filter: FilterKey, cursor?: string | null) {
  const params = new URLSearchParams()
  if (filter === "MINE") {
    params.set("mine", "1")
  } else if (filter === "PINNED") {
    params.set("pinned", "1")
  } else {
    params.set("category", filter)
  }
  if (cursor) params.set("cursor", cursor)
  return `/api/posts?${params.toString()}`
}

/** Canonical detail URL cho 1 post.
 *  PRODUCT category + có Product sidecar → /san-pham/{slug} (marketplace
 *  page là canonical). Khác → /bai-viet/{id}. Phase 3.6 follow-up: yêu cầu
 *  từ khách hàng để PRODUCT post route về SP detail thay vì /bai-viet. */
function postUrl(post: Post): string {
  if (post.category === "PRODUCT" && post.product?.slug) {
    return `/san-pham/${post.product.slug}`
  }
  return `/bai-viet/${post.id}`
}

type TopContributor = {
  id: string
  name: string
  avatarUrl: string | null
  contributionTotal: number
  accountType: string
  company: { name: string } | null
}

export type MembershipInfo = {
  expires: string | null
  contributionTotal: number
  displayPriority: number
  accountType: string
  company: { name: string; slug: string } | null
}

/** Quota tháng cho 1 user — `limit=-1` nghĩa unlimited (Gold/Admin/Infinite/PoC),
 *  UI sẽ ẩn progress bar. `resetAt` là ISO string đầu tháng tiếp theo. */
export type QuotaSlot = {
  used: number
  limit: number
  resetAt: string
}
export type QuotaInfo = {
  posts: QuotaSlot
  products: QuotaSlot
  banners: QuotaSlot
}

type FeedClientProps = {
  initialPosts: Post[]
  /** Tab được chọn khi mount — match với filter đã dùng ở server-side query.
   *  Vào thẳng /feed → "NEWS"; từ section "Sản phẩm hội viên" trang chủ
   *  (`/feed?category=PRODUCT`) → "PRODUCT". */
  initialFilter?: FilterKey
  currentUserId: string | null
  currentUserRole: string | null
  currentUserName: string | null
  currentUserAvatarUrl: string | null
  membershipInfo: MembershipInfo | null
  tierSilver?: number
  tierGold?: number
  tierIndSilver?: number
  tierIndGold?: number
  topContributors: TopContributor[]
  quotaInfo: QuotaInfo | null
  sidebarBannersSlot: ReactNode
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function timeAgo(dateStr: string, now: number, t: any): string {
  if (now === 0) return ""
  const diffMs = now - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return t("timeJustNow")
  if (mins < 60) return t("timeMinutes", { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t("timeHours", { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t("timeDays", { count: days })
  return new Date(dateStr).toLocaleDateString()
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
}

/**
 * Pull image URLs out of sanitized HTML. Used for posts created via the
 * inline composer, which embeds <img> tags directly in `content` rather
 * than populating the `imageUrls` column. Falling back to this keeps the
 * thumbnail grid + lightbox working for older posts too.
 */
function extractImageUrlsFromHtml(html: string): string[] {
  const matches = html.match(/<img[^>]+src=["']([^"']+)["']/g) ?? []
  return matches
    .map((tag) => {
      const m = tag.match(/src=["']([^"']+)["']/)
      return m ? m[1] : null
    })
    .filter((u): u is string => !!u)
}

/** Remove <img> tags from HTML so images aren't rendered twice when we
 *  display them separately as thumbnails. */
function stripImgTagsFromHtml(html: string): string {
  return html.replace(/<img[^>]*>/g, "")
}

// Lightbox component moved to FeedLightbox.tsx — lazy-loaded qua
// next/dynamic ở đầu file. Tránh ship ~4 kB + hydration cho lightbox
// mà đa số user không mở.

// ── PostImageGrid — Facebook-style image layout ─────────────────────────────
// 1 ảnh: full width, aspect-video.
// 2 ảnh: grid 2 cột, aspect-video total.
// 3 ảnh: 1 big left (row-span-2) + 2 nhỏ stacked right, aspect-square total.
// 4+ ảnh: 2×2 grid, ảnh thứ 4 có overlay "+N" nếu total > 4.
//
// Click thumbnail → onImageClick(index) → caller mở Lightbox tại index đó.

function FeedThumb({
  url,
  index,
  onClick,
  overlay,
  sizes = "(max-width: 768px) 50vw, 400px",
}: {
  url: string
  index: number
  onClick: (i: number) => void
  overlay?: ReactNode
  sizes?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(index)}
      className="relative h-full w-full overflow-hidden bg-brand-100 transition-opacity hover:opacity-95"
      aria-label={`Xem ảnh ${index + 1}`}
    >
      <Image
        src={cloudinaryResize(url, 1000)}
        alt=""
        fill
        className="object-cover"
        sizes={sizes}
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
      />
      {overlay}
    </button>
  )
}

function PostImageGrid({
  images,
  onImageClick,
}: {
  images: string[]
  onImageClick: (index: number) => void
}) {
  const count = images.length
  if (count === 0) return null

  if (count === 1) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-brand-100">
        <FeedThumb
          url={images[0]}
          index={0}
          onClick={onImageClick}
          sizes="(max-width: 768px) 100vw, 600px"
        />
      </div>
    )
  }

  if (count === 2) {
    return (
      <div className="grid aspect-video w-full grid-cols-2 gap-1 overflow-hidden rounded-lg">
        <FeedThumb url={images[0]} index={0} onClick={onImageClick} />
        <FeedThumb url={images[1]} index={1} onClick={onImageClick} />
      </div>
    )
  }

  if (count === 3) {
    return (
      <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-lg">
        <div className="row-span-2">
          <FeedThumb
            url={images[0]}
            index={0}
            onClick={onImageClick}
            sizes="(max-width: 768px) 50vw, 400px"
          />
        </div>
        <FeedThumb url={images[1]} index={1} onClick={onImageClick} />
        <FeedThumb url={images[2]} index={2} onClick={onImageClick} />
      </div>
    )
  }

  // count >= 4 — show 4 tiles trong 2×2 grid, ảnh thứ 4 overlay "+N" nếu còn
  const extra = count - 4
  return (
    <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-lg">
      <FeedThumb url={images[0]} index={0} onClick={onImageClick} />
      <FeedThumb url={images[1]} index={1} onClick={onImageClick} />
      <FeedThumb url={images[2]} index={2} onClick={onImageClick} />
      <FeedThumb
        url={images[3]}
        index={3}
        onClick={onImageClick}
        overlay={
          extra > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="text-2xl font-bold text-white">+{extra}</span>
            </div>
          ) : undefined
        }
      />
    </div>
  )
}

function getTierBadge(
  contribution: number,
  accountType: string,
  bizSilver: number = 10_000_000,
  bizGold: number = 20_000_000,
  indSilver: number = 3_000_000,
  indGold: number = 5_000_000,
) {
  const silverT = accountType === "INDIVIDUAL" ? indSilver : bizSilver
  const goldT = accountType === "INDIVIDUAL" ? indGold : bizGold
  if (contribution >= goldT) return { label: "★★★", cls: "bg-yellow-400 text-yellow-900" }
  if (contribution >= silverT) return { label: "★★", cls: "bg-brand-300 text-brand-900" }
  return { label: "★", cls: "bg-brand-200 text-brand-800" }
}

const GUEST_VISIBLE_COUNT = 3

// ── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  currentUserRole,
  index,
  isMounted,
  now,
  onReact,
  onLock,
  onDelete,
  onDismiss,
  onPromote,
  onToggleFeatured,
  onRequestPromotion,
  onCancelRequest,
  tierSilver,
  tierGold,
  tierIndSilver,
  tierIndGold,
}: {
  post: Post
  currentUserId: string | null
  currentUserRole: string | null
  index: number
  onReact: (id: string) => void
  onLock: (id: string) => void
  onDelete: (id: string) => void
  /** Used for optimistic-post error dismissal only (removes the failed card
   *  from the feed). No-op for normal posts. */
  onDismiss: (id: string) => void
  /** Admin action: toggle isPromoted. */
  onPromote: (id: string) => void
  /** Admin action: toggle Product.isFeatured (chỉ áp dụng PRODUCT post). */
  onToggleFeatured: (postId: string, productId: string, nextFeatured: boolean) => void
  /** Owner action: submit promotion request. */
  onRequestPromotion: (id: string) => void
  /** Owner action: cancel pending request. */
  onCancelRequest: (id: string) => void
  tierSilver?: number
  tierGold?: number
  tierIndSilver?: number
  tierIndGold?: number
  isMounted: boolean
  now: number
}) {
  const t = useTranslations("feed")
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const isLocked = post.status === "LOCKED"
  const isPendingModeration = post.status === "PENDING"
  const isRejected = isLocked && !!post.moderationNote

  // Unify image sources: use the DB column when populated, otherwise pull
  // from embedded <img> tags in the sanitized HTML content. Posts from
  // the inline composer fall into the latter bucket.
  const displayImages = post.imageUrls.length > 0
    ? (post.imageUrls as string[])
    : extractImageUrlsFromHtml(post.content)
  // Collapse → Facebook style (text intro trên, grid ảnh phía dưới).
  // Expand → giữ nguyên format bài post: nếu content có <img> đan xen với
  // text (post từ PostEditor rich text), render nguyên HTML để text+ảnh
  // hiện đúng thứ tự tác giả viết. Post không có <img> trong content
  // (composer upload tách rời) → expand vẫn dùng layout tách (content chỉ
  // có text, không có gì để đan xen).
  const contentHasInlineImages = /<img\b/i.test(post.content)
  const useInterleavedLayout = expanded && contentHasInlineImages
  const contentForProse = useInterleavedLayout
    ? post.content
    : displayImages.length > 0
      ? stripImgTagsFromHtml(post.content)
      : post.content
  // Lightbox indexing phải khớp DOM order của <img> đang hiển thị. Khi
  // interleaved, dùng extract từ content (cùng order với render); khi tách
  // layout, dùng displayImages (chính là grid order).
  const lightboxImages = useInterleavedLayout
    ? extractImageUrlsFromHtml(post.content)
    : displayImages
  const userHasReacted = post.reactions.some((r) => r.type === "LIKE")
  const isAuthor = currentUserId === post.authorId
  const isAdmin = currentUserRole === "ADMIN"
  const isGuest = !currentUserRole || currentUserRole === "GUEST"
  // On server, always assume blurred for safety and to match initial client render
  const isGuestBlurred = (!isMounted || isGuest) && index >= GUEST_VISIBLE_COUNT

  const tier = getTierBadge(post.author.contributionTotal, post.author.accountType, tierSilver, tierGold, tierIndSilver, tierIndGold)

  // Strip HTML for truncation. Use the image-stripped content so <img>
  // tags don't inflate the character count for text-only truncation.
  // Threshold ~140 chars ≈ 2 dòng text-sm ở width ~600px — match với
  // line-clamp-2 CSS dưới. Vượt threshold → hiển thị "... Xem thêm".
  const plainText = contentForProse.replace(/<[^>]*>/g, "")
  const needsTruncation = plainText.length > 140

  // Promotion state helpers
  const promoStatus = post.latestPromotionRequest?.status
  const hasPendingRequest = promoStatus === "PENDING"
  const canRequestPromotion =
    isAuthor &&
    !post.isPromoted &&
    !hasPendingRequest &&
    post.status === "PUBLISHED"

  // Edit URL theo category — mirror ProductActionsMenu trên detail page.
  // PRODUCT → ProductForm (có spec sheet + variants + reason field built-in).
  // NEWS/GENERAL → PostEditor (rich text). Admin edit NEWS phải kèm
  // `adminMode=1` để hiện UI reason field (server enforce ≥10 ký tự).
  const isProductPost = post.category === "PRODUCT" && post.product?.slug
  const editHrefAuthor = isProductPost
    ? `/san-pham/${post.product!.slug}/sua`
    : `/feed/tao-bai?edit=${post.id}`
  const editHrefAdminMod = isProductPost
    ? `/admin/san-pham/${post.product!.slug}/sua`
    : `/feed/tao-bai?edit=${post.id}&adminMode=1&returnTo=/feed`

  // Menu options based on role
  const menuItems: { label: string; action: () => void; destructive?: boolean }[] = []
  if (isAuthor) {
    menuItems.push({ label: t("menuEdit"), action: () => { window.location.href = editHrefAuthor } })
    if (canRequestPromotion) {
      menuItems.push({ label: t("menuRequestPromotion"), action: () => onRequestPromotion(post.id) })
    }
    if (hasPendingRequest) {
      menuItems.push({ label: t("menuCancelPromotionRequest"), action: () => onCancelRequest(post.id) })
    }
    menuItems.push({ label: t("menuDelete"), action: () => onDelete(post.id), destructive: true })
  }
  // Admin moderation — chỉ khi admin xem bài của người khác. Tránh case
  // INFINITE author thấy "Khoá bài / Đẩy lên trang chủ / Featured" trên bài
  // của họ. Moderation luôn dành cho người khác kiểm duyệt.
  if (isAdmin && !isAuthor) {
    menuItems.push({
      label: t("menuEdit"),
      action: () => { window.location.href = editHrefAdminMod },
    })
    menuItems.push({ label: isLocked ? t("menuUnlock") : t("menuLock"), action: () => onLock(post.id) })
    if (post.status === "PUBLISHED") {
      menuItems.push({
        label: post.isPromoted ? t("menuUnpromote") : t("menuPromote"),
        action: () => onPromote(post.id),
      })
      // Sản phẩm tiêu biểu — chỉ áp dụng PRODUCT post (có Product sidecar).
      // Trưng bày only — không cấp cert, không qua hội đồng (KH 2026-04-29).
      if (post.category === "PRODUCT" && post.product) {
        const productId = post.product.id
        const isFeatured = post.product.isFeatured
        menuItems.push({
          label: isFeatured ? t("menuUnfeatureProduct") : t("menuFeatureProduct"),
          action: () => onToggleFeatured(post.id, productId, !isFeatured),
        })
      }
    }
    menuItems.push({ label: t("menuDelete"), action: () => onDelete(post.id), destructive: true })
  }
  // Lịch sử thay đổi — owner + admin đều xem được (xem /bai-viet/[id]/lich-su).
  if (isAuthor || isAdmin) {
    menuItems.push({
      label: t("menuHistory"),
      action: () => { window.location.href = `/bai-viet/${post.id}/lich-su` },
    })
  }
  if (currentUserRole && currentUserRole !== "GUEST" && !isAuthor) {
    menuItems.push({ label: t("menuReport"), action: () => handleReport(post.id) })
  }

  async function handleReport(postId: string) {
    const reason = window.prompt(t("reportPrompt"))
    if (!reason) return
    try {
      await fetch(`/api/posts/${postId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      alert(t("reportSent"))
    } catch {
      alert(t("genericError"))
    }
    setMenuOpen(false)
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}${postUrl(post)}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // clipboard API unavailable (http, older browsers) — fallback
      const ta = document.createElement("textarea")
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand("copy") } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <article className={cn(
      "bg-white rounded-xl border border-brand-200 p-5 transition-opacity",
      isLocked && "opacity-60",
      post.isPending && "opacity-70",
      post.pendingError && "border-red-300 bg-red-50/30",
    )}>
      {/* Optimistic-post state banners */}
      {post.isPending && (
        <div className="mb-3 flex items-center gap-2 text-xs text-brand-600 bg-brand-50 rounded-md px-3 py-1.5">
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span>{t("pendingLabel")}</span>
        </div>
      )}
      {post.pendingError && (
        <div className="mb-3 flex items-start justify-between gap-2 text-xs text-red-700 bg-red-100 rounded-md px-3 py-2 border border-red-200">
          <span className="flex-1">
            <strong className="font-semibold">{t("pendingErrorPrefix")}</strong> {post.pendingError}
          </span>
          <button
            type="button"
            onClick={() => onDismiss(post.id)}
            className="text-red-600 font-semibold hover:text-red-800 whitespace-nowrap"
          >
            {t("pendingDismiss")}
          </button>
        </div>
      )}
      {/* Moderation PENDING — chỉ owner thấy (query đã filter PENDING + authorId).
          Thông báo cho user biết bài chưa công khai tới khi admin duyệt. */}
      {isPendingModeration && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" strokeLinecap="round" />
          </svg>
          <span className="font-semibold">Chờ duyệt</span>
          <span className="text-xs text-amber-700">
            — Bài đang chờ admin kiểm duyệt. Chỉ bạn thấy được bài này cho đến khi được duyệt.
          </span>
        </div>
      )}

      {/* Moderation REJECTED (= LOCKED + moderationNote) — admin đã từ chối.
          Hiển thị lý do để owner biết cần sửa gì. Người khác không thấy. */}
      {isRejected ? (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          <p className="font-semibold">❌ Bị từ chối</p>
          <p className="mt-1 text-xs text-red-700">
            Lý do: {post.moderationNote}
          </p>
          <p className="mt-1 text-xs text-red-600">
            Bạn có thể chỉnh sửa bài và gửi lại để admin duyệt.
          </p>
        </div>
      ) : (
        /* Locked từ auto-report (không có moderationNote) → banner cũ */
        isLocked && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            Bài viết đã bị tạm khoá
            {post.lockReason && <span className="text-xs text-amber-600">— {post.lockReason}</span>}
          </div>
        )
      )}

      {/* Author row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-brand-200 flex items-center justify-center shrink-0 overflow-hidden">
            {post.author.avatarUrl ? (
              <Image src={post.author.avatarUrl} alt="" fill className="object-cover" sizes="40px" />
            ) : (
              <span className="text-sm font-bold text-brand-700">{getInitials(post.author.name)}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-brand-900 text-sm">{post.author.name}</span>
              {post.author.company ? (
                <span className="text-sm text-brand-500">· {post.author.company.name}</span>
              ) : post.author.accountType === "INDIVIDUAL" ? (
                <span className="text-sm text-brand-500">· Chuyên gia</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none", tier.cls)}>
                {tier.label}
              </span>
              <span className="text-xs text-brand-400" suppressHydrationWarning>
                {timeAgo(post.createdAt, now, t)}
              </span>
            </div>
          </div>
        </div>

        {/* 3-dot menu */}
        {menuItems.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-brand-400 hover:text-brand-700 p-2.5 -m-1.5 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              ···
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 bg-white rounded-lg border border-brand-200 shadow-lg py-1 min-w-[200px]">
                  {menuItems.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => { item.action(); setMenuOpen(false) }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm whitespace-nowrap hover:bg-brand-50 transition-colors",
                        item.destructive ? "text-red-600" : "text-brand-700",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Promoted badge — hiển thị cho tất cả viewer khi bài đang được đẩy. */}
      {post.isPromoted && (
        <span className="inline-flex text-xs font-medium bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full mb-2">
          {t("promotedBadge")}
        </span>
      )}

      {/* Promotion request status — chỉ owner thấy (API đã filter). */}
      {isAuthor && !post.isPromoted && post.latestPromotionRequest && (
        <>
          {post.latestPromotionRequest.status === "PENDING" && (
            <span className="inline-flex text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full mb-2">
              {t("promotionPendingBadge")}
            </span>
          )}
          {post.latestPromotionRequest.status === "REJECTED" && (
            <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <p className="font-semibold">{t("promotionRejectedBadge")}</p>
              {post.latestPromotionRequest.reviewNote && (
                <p className="mt-1 leading-relaxed">
                  {post.latestPromotionRequest.reviewNote}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Product sidecar strip — hiện khi bài post là sản phẩm */}
      {post.category === "PRODUCT" && post.product && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-white border border-brand-200 px-2 py-0.5 font-semibold text-brand-700">
            🛍️ {t("productBadge")}
          </span>
          {post.product.certStatus === "APPROVED" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-semibold text-emerald-700">
              ✓ {t("certifiedBadge")}
            </span>
          )}
          {post.product.category && (
            <span className="text-brand-600">{post.product.category}</span>
          )}
          {post.product.priceRange && (
            <span className="font-semibold text-brand-900">{post.product.priceRange}</span>
          )}
          <Link
            href={`/san-pham/${post.product.slug}`}
            className="ml-auto font-semibold text-brand-700 hover:text-brand-900 underline underline-offset-2"
          >
            {t("viewDetail")}
          </Link>
        </div>
      )}

      {/* Title — clickable to detail. PRODUCT → /san-pham/{slug}, else /bai-viet/{id}. */}
      {post.title && (
        <h2 className="font-semibold text-brand-900 text-base mb-2 leading-snug">
          <Link href={postUrl(post)} className="hover:text-brand-700 transition-colors">
            {post.title}
          </Link>
        </h2>
      )}

      {/* TEXT TRƯỚC — line-clamp-2, "... Xem thêm" nếu vượt threshold.
          Facebook-style: text intro → hình ảnh phía dưới. */}
      {isGuestBlurred ? (
        <div className="relative mb-3" suppressHydrationWarning>
          <div className="line-clamp-2 text-sm text-brand-800 blur-sm select-none">
            {plainText}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Link
              href="/login"
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-brand-800"
            >
              Đăng nhập để đọc
            </Link>
          </div>
        </div>
      ) : isLocked && !isAdmin ? (
        <p className="mb-3 text-sm italic text-brand-400">
          Nội dung đã bị ẩn do vi phạm quy định.
        </p>
      ) : (
        <div className="mb-3" suppressHydrationWarning>
          <div
            onClick={(e) => {
              const target = e.target as HTMLElement
              // Click inline <img> ở interleaved view → mở lightbox tại
              // đúng index của ảnh trong DOM order. Không trigger toggle
              // collapse trong case này.
              if (useInterleavedLayout && target.tagName === "IMG") {
                e.preventDefault()
                e.stopPropagation()
                const imgs = (e.currentTarget as HTMLElement).querySelectorAll("img")
                const idx = Array.from(imgs).indexOf(target as HTMLImageElement)
                if (idx >= 0) setLightboxIndex(idx)
                return
              }
              if (!needsTruncation) return
              // Bấm vào link/button bên trong prose phải hoạt động bình thường,
              // không trigger toggle (closest fail-safe).
              if (target.closest("a, button")) return
              setExpanded((prev) => !prev)
            }}
            className={cn(
              "prose prose-sm max-w-none text-sm text-brand-800",
              !expanded && needsTruncation && "line-clamp-2",
              needsTruncation && "cursor-pointer",
              useInterleavedLayout && "[&_img]:cursor-zoom-in",
            )}
            /* Content từ DB đã được sanitize tại save-time (xem
               /api/posts POST/PATCH dùng DOMPurify.sanitize). Trust content
               trên client để tránh ship isomorphic-dompurify (~40KB gzip) +
               CPU sanitize per-post render. */
            dangerouslySetInnerHTML={{
              __html: rewriteCloudinaryInHtml(contentForProse, 800),
            }}
          />
          {needsTruncation && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
            >
              {expanded ? t("readLess") : t("readMore")}
            </button>
          )}
        </div>
      )}

      {/* IMAGES SAU — Facebook-style grid khi collapse (hoặc khi expand bài
          không có inline imgs). Khi expand+interleaved, ảnh đã render
          inline trong prose ở trên, không cần grid riêng. */}
      {!isGuestBlurred && !useInterleavedLayout && displayImages.length > 0 && (
        <div className="mb-3">
          <PostImageGrid
            images={displayImages}
            onImageClick={setLightboxIndex}
          />
        </div>
      )}

      {lightboxIndex !== null && (
        <FeedLightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Stats + reaction bar — 3 nút action: Like (có label), Bình luận +
          Sao chép link (icon-only với tooltip). */}
      {!isLocked && !isGuestBlurred && (
        <div className="flex items-center justify-between pt-3 border-t border-brand-200">
          <div className="flex items-center gap-2">
            {currentUserRole && currentUserRole !== "GUEST" ? (
              <button
                onClick={() => onReact(post.id)}
                disabled={post.isPending}
                aria-label="Like"
                title="Like"
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  userHasReacted ? "bg-brand-100 text-brand-700" : "text-brand-400 hover:bg-brand-50 hover:text-brand-700",
                )}
              >
                <ThumbsUp size={16} fill={userHasReacted ? "currentColor" : "none"} />
                {post._count.reactions > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white tabular-nums">
                    {post._count.reactions}
                  </span>
                )}
              </button>
            ) : (
              <span
                aria-label="Like"
                title="Like"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-brand-400"
              >
                <ThumbsUp size={16} />
                {post._count.reactions > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white tabular-nums">
                    {post._count.reactions}
                  </span>
                )}
              </span>
            )}
            {post.isPending ? (
              <span
                aria-label={t("comments")}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-400 opacity-40"
              >
                <MessageSquare size={16} />
              </span>
            ) : (
              <Link
                href={postUrl(post)}
                aria-label={t("comments")}
                title={t("comments")}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              >
                <MessageSquare size={16} />
                {post._count.comments > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white tabular-nums">
                    {post._count.comments}
                  </span>
                )}
              </Link>
            )}
            <button
              type="button"
              onClick={handleCopyLink}
              aria-label={linkCopied ? t("linkCopied") : t("copyLink")}
              title={linkCopied ? t("linkCopied") : t("copyLink")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                linkCopied
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-brand-400 hover:bg-brand-50 hover:text-brand-700",
              )}
            >
              {linkCopied ? <Check size={16} /> : <Link2 size={16} />}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}


// ── Membership Card ──────────────────────────────────────────────────────────

function MembershipCard({ info, now }: { info: MembershipInfo; now: number }) {
  const t = useTranslations("feed")
  const expires = info.expires ? new Date(info.expires) : null
  const daysLeft = expires && now ? Math.max(0, Math.ceil((expires.getTime() - now) / 86400000)) : 0
  const isActive = expires && now ? expires.getTime() > now : false

  return (
    <div className="bg-linear-to-br from-brand-800 to-brand-700 text-white rounded-xl p-4 space-y-3" suppressHydrationWarning>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-brand-200">{t("memberCard")}</span>
        <span className={cn("text-xs font-semibold rounded-full px-2 py-0.5", isActive ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300")}>
          {isActive ? t("statusActive") : t("statusExpired")}
        </span>
      </div>
      {expires && (
        <div>
          <p className="text-xs text-brand-300">{t("expiresLabel")}</p>
          <p className="text-sm font-medium">
            {expires.toLocaleDateString("vi-VN")}
            {isActive && <span className="ml-2 text-brand-300 text-xs">({daysLeft} ngày)</span>}
          </p>
        </div>
      )}
      <div className="flex gap-4 pt-2 border-t border-brand-600">
        <div>
          <p className="text-xs text-brand-300">{t("contributionLabel")}</p>
          <p className="text-sm font-semibold">{info.contributionTotal.toLocaleString("vi-VN")} ₫</p>
        </div>
        <div>
          <p className="text-xs text-brand-300">{t("priorityLabel")}</p>
          <p className="text-sm font-semibold">{info.displayPriority}</p>
        </div>
      </div>
    </div>
  )
}

// ── Quota Card ───────────────────────────────────────────────────────────────

/** Hạn mức tháng — informational only, KHÔNG enforce ở UI.
 *
 *  Lưu ý: project đang ở PoC mode (lib/poc-mode.ts default ON, env
 *  POC_UNLIMITED_POSTS=1) → server trả `limit=-1` cho mọi user. Card vẫn
 *  hiện stat "đã đăng" để user biết hoạt động của mình; chỉ render progress
 *  bar khi limit dương (post-PoC). Server enforce qua API, UI chỉ là gợi ý —
 *  không disable submit để tránh accidental enforcement nhầm trong PoC. */
function QuotaCard({ quota, now }: { quota: QuotaInfo; now: number }) {
  // Reset = đầu tháng tiếp theo. Hiển thị days remaining để user planning.
  const resetMs = new Date(quota.posts.resetAt).getTime()
  const daysToReset = now ? Math.max(0, Math.ceil((resetMs - now) / 86400000)) : 0

  // Upsell chỉ relevant khi limit thực sự enforce (limit > 0) và gần đầy.
  // PoC mode → cả 3 limit=-1 → không gợi ý nâng hạng (đỡ noise).
  const showUpsell =
    (quota.posts.limit > 0 && quota.posts.used / quota.posts.limit >= 0.8) ||
    (quota.products.limit > 0 && quota.products.used / quota.products.limit >= 0.8) ||
    (quota.banners.limit > 0 && quota.banners.used / quota.banners.limit >= 0.8)

  return (
    <div className="bg-white rounded-xl border border-brand-200 p-4 space-y-3" suppressHydrationWarning>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-900">Hoạt động tháng này</h3>
        {now > 0 && (
          <span className="text-[11px] text-brand-500">Reset sau {daysToReset}d</span>
        )}
      </div>
      <QuotaBar label="Bài đăng" slot={quota.posts} />
      <QuotaBar label="Sản phẩm" slot={quota.products} />
      <QuotaBar label="Banner QC" slot={quota.banners} />
      {showUpsell && (
        <Link
          href="/dich-vu"
          className="block text-center text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-1.5 hover:bg-amber-100"
        >
          Nâng hạng để tăng quota →
        </Link>
      )}
    </div>
  )
}

function QuotaBar({ label, slot }: { label: string; slot: QuotaSlot }) {
  // limit=-1 (PoC / Gold / Admin / Infinite): chỉ hiện count đã dùng — không
  // có thanh tiến trình vì không có ngưỡng để compare.
  if (slot.limit === -1) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-brand-700">{label}</span>
        <span className="font-semibold text-emerald-700 tabular-nums">
          {slot.used} <span className="text-brand-400 font-normal">· ∞</span>
        </span>
      </div>
    )
  }
  const limit = Math.max(slot.limit, 1)
  const pct = Math.min(100, Math.round((slot.used / limit) * 100))
  const isFull = slot.used >= slot.limit
  const isNear = pct >= 80
  const barColor = isFull ? "bg-red-500" : isNear ? "bg-amber-500" : "bg-emerald-500"
  const textColor = isFull ? "text-red-600" : isNear ? "text-amber-700" : "text-brand-800"

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-brand-700">{label}</span>
        <span className={cn("font-semibold tabular-nums", textColor)}>
          {slot.used}/{slot.limit}
        </span>
      </div>
      <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function FeedClient({
  initialPosts,
  initialFilter = "NEWS",
  currentUserId,
  currentUserRole,
  currentUserName,
  currentUserAvatarUrl,
  membershipInfo,
  topContributors,
  quotaInfo,
  sidebarBannersSlot,
  tierSilver,
  tierGold,
  tierIndSilver,
  tierIndGold,
}: FeedClientProps) {
  const t = useTranslations("feed")

  // MINE chỉ hiện khi đã login — guest không có "bài của tôi".
  // PINNED chỉ hiện cho ADMIN — để xem + bỏ ghim các bài đang isPromoted.
  // Phase 3.7 round 4 (2026-04).
  const isAdmin = currentUserRole === "ADMIN"
  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "NEWS", label: t("filterNews") },
    { key: "PRODUCT", label: t("filterProduct") },
    ...(currentUserId
      ? ([{ key: "MINE" as const, label: t("filterMine") }])
      : []),
    ...(isAdmin
      ? ([{ key: "PINNED" as const, label: "📌 Đang ghim" }])
      : []),
  ]

  const router = useRouter()
  const pathname = usePathname()

  const [isMounted, setIsMounted] = useState(false)
  const [now, setNow] = useState(0)
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [hasMore, setHasMore] = useState(initialPosts.length >= 10)
  const [filter, setFilter] = useState<FilterKey>(initialFilter)

  // Sync filter ↔ URL `?category=`. Khi user đổi tab, URL update để khi
  // họ navigate sang /feed/tao-bai rồi back về, mode được preserve. NEWS
  // = default (no param). Dùng `router.replace` (không scroll) để không
  // push history entry mỗi click chip.
  useEffect(() => {
    if (!isMounted) return
    const params = new URLSearchParams(window.location.search)
    if (filter === "NEWS") {
      params.delete("category")
    } else {
      params.set("category", filter)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [filter, isMounted, pathname, router])

  useEffect(() => {
    setNow(Date.now())
    setIsMounted(true)

    if (!currentUserId) return

    // Phase 1: hand-off 1 lần từ /feed/tao-bai PostEditor (sessionStorage).
    // Nếu có, chuyển vào localStorage sticky zone để từ giờ trở đi hiển thị
    // qua cơ chế chung (TTL 2h). Giữ tương thích ngược với PostEditor.
    try {
      const raw = sessionStorage.getItem("freshPost")
      if (raw) {
        sessionStorage.removeItem("freshPost")
        const fresh = JSON.parse(raw) as Partial<Post> & { id: string }
        const hydrated: Post = {
          imageUrls: [],
          status: "PUBLISHED",
          isPremium: false,
          isPromoted: false,
          authorPriority: 0,
          viewCount: 0,
          reportCount: 0,
          lockedAt: null,
          lockedBy: null,
          lockReason: null,
          reactions: [],
          _count: { reactions: 0, comments: 0 },
          ...fresh,
        } as Post
        saveMyRecentPost(currentUserId, hydrated)
      }
    } catch {
      /* ignore corrupt sessionStorage entry */
    }

    // Phase 2: prepend sticky zone của viewer (từ localStorage, TTL 2h).
    // Dedupe với initialPosts từ server — nếu bài đã xuất hiện qua rank thật,
    // prune khỏi localStorage luôn.
    setPosts((prev) => {
      const serverIds = new Set(prev.map((p) => p.id))
      pruneMyRecentPosts(serverIds)
      const sticky = loadMyRecentPosts<Post>(currentUserId, serverIds)
      return sticky.length > 0 ? [...sticky, ...prev] : prev
    })
  }, [currentUserId])
  const [loading, setLoading] = useState(false)
  const observerRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<string | null>(initialPosts.at(-1)?.id ?? null)

  // Refetch khi đổi filter (bỏ qua lần mount đầu — đã có initialPosts)
  const didMountFilter = useRef(false)
  useEffect(() => {
    if (!didMountFilter.current) {
      didMountFilter.current = true
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(buildFeedUrl(filter))
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setPosts(data.posts ?? [])
        setHasMore((data.posts?.length ?? 0) >= 10)
        cursorRef.current = data.posts?.at(-1)?.id ?? null
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filter])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursorRef.current) return
    setLoading(true)
    try {
      const res = await fetch(buildFeedUrl(filter, cursorRef.current))
      const data = await res.json()
      if (data.posts.length < 10) setHasMore(false)
      setPosts((prev) => [...prev, ...data.posts])
      cursorRef.current = data.posts.at(-1)?.id ?? null
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, filter])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loading) loadMore() },
      { threshold: 0.1 },
    )
    const el = observerRef.current
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  // Optimistic react
  async function handleReact(postId: string) {
    if (!currentUserId) return
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        const liked = p.reactions.some((r) => r.type === "LIKE")
        return {
          ...p,
          reactions: liked ? [] : [{ type: "LIKE" }],
          _count: { ...p._count, reactions: liked ? p._count.reactions - 1 : p._count.reactions + 1 },
        }
      }),
    )
    try {
      await fetch(`/api/posts/${postId}/react`, { method: "POST" })
    } catch {
      // Revert
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p
          const wasLiked = !p.reactions.some((r) => r.type === "LIKE")
          return {
            ...p,
            reactions: wasLiked ? [{ type: "LIKE" }] : [],
            _count: { ...p._count, reactions: wasLiked ? p._count.reactions + 1 : p._count.reactions - 1 },
          }
        }),
      )
    }
  }

  async function handleLock(postId: string) {
    try {
      const res = await fetch(`/api/posts/${postId}/lock`, { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status: data.status } : p)))
      }
    } catch { /* */ }
  }

  async function handleDelete(postId: string) {
    if (!window.confirm(t("deleteConfirm"))) return
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" })
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId))
        removeMyRecentPost(postId)
      }
    } catch { /* */ }
  }

  /** Admin: open modal "Đẩy lên trang chủ" — categorize + pin combined.
   *  Phase 3.7 round 4 (2026-04). Single confirm → modal flow; modal handles
   *  API call + result update. */
  function handlePromote(postId: string) {
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    setPromoteModalPostId(postId)
  }

  /** Admin: toggle Product.isFeatured cho post PRODUCT — shortcut "Sản phẩm
   *  tiêu biểu" mà không phải vào /admin/tieu-bieu chọn từng SP. Optimistic
   *  update, rollback nếu API fail. */
  async function handleToggleFeatured(postId: string, productId: string, nextFeatured: boolean) {
    // Optimistic
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId && p.product
          ? { ...p, product: { ...p.product, isFeatured: nextFeatured } }
          : p,
      ),
    )
    try {
      const res = await fetch(`/api/admin/products/${productId}/featured`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isFeatured: nextFeatured }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? t("genericError"))
        // Rollback
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId && p.product
              ? { ...p, product: { ...p.product, isFeatured: !nextFeatured } }
              : p,
          ),
        )
      }
    } catch {
      alert(t("genericError"))
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId && p.product
            ? { ...p, product: { ...p.product, isFeatured: !nextFeatured } }
            : p,
        ),
      )
    }
  }
  const [promoteModalPostId, setPromoteModalPostId] = useState<string | null>(null)
  const promoteModalPost = promoteModalPostId
    ? posts.find((p) => p.id === promoteModalPostId)
    : null

  /** Owner: xin admin đẩy bài lên trang chủ. */
  async function handleRequestPromotion(postId: string) {
    const reason = window.prompt(t("requestPromotionPrompt"))
    if (reason === null) return // user cancelled
    try {
      const res = await fetch(`/api/posts/${postId}/request-promotion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? t("genericError"))
        return
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                latestPromotionRequest: { status: "PENDING", reviewNote: null },
              }
            : p,
        ),
      )
      alert(t("requestPromotionSubmitted"))
    } catch {
      alert(t("genericError"))
    }
  }

  /** Owner: rút yêu cầu đang PENDING. */
  async function handleCancelRequest(postId: string) {
    if (!window.confirm(t("cancelRequestConfirm"))) return
    try {
      const res = await fetch(`/api/posts/${postId}/request-promotion`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        alert(data.error ?? t("genericError"))
        return
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                latestPromotionRequest: {
                  status: "CANCELLED",
                  reviewNote: null,
                },
              }
            : p,
        ),
      )
    } catch {
      alert(t("genericError"))
    }
  }

  function handlePostCreated(post: Post) {
    setPosts((prev) => [post, ...prev])
    setNow(Date.now())
  }

  /** Merge server data into an optimistic post (tempId → realId swap on
   *  success, or set pendingError on failure). Noop if the post was
   *  dismissed by the user before the background work finished. */
  function handlePostUpdated(tempId: string, patch: Partial<Post>) {
    setPosts((prev) => prev.map((p) => (p.id === tempId ? { ...p, ...patch } : p)))
  }

  /** Remove a failed optimistic post from the feed (after user clicks
   *  "Bỏ qua" on the error banner). */
  function handlePostDismiss(tempId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== tempId))
  }

  const isLoggedIn = !!currentUserId
  // VIP/ADMIN/INFINITE LUÔN được post. GUEST được post nếu có
  // membershipExpires trong tương lai (đã đóng phí nhưng role chưa upgrade).
  // Xem lib/roles.ts → hasMemberAccess.
  const isMember = hasMemberAccess(currentUserRole, membershipInfo?.expires)
  const canPost = isMember

  return (
    <div className="bg-white rounded-2xl border border-brand-200 shadow-sm p-4 sm:p-6 lg:p-8">
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ── Feed column ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Filter chips — ĐẶT TRƯỚC editor để chọn loại nội dung muốn đăng,
            editor sẽ đổi layout phù hợp (NEWS: textarea + ảnh; PRODUCT: form
            sản phẩm với tên/danh mục/giá/tiêu đề/nội dung). */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors",
                filter === f.key
                  ? "bg-brand-700 text-white border-brand-700"
                  : "bg-white text-brand-700 border-brand-200 hover:bg-brand-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Inline post creator — layout đổi theo filter (mode). Filter MINE
            là view-only (không tạo được) → ẩn composer + hint chuyển filter. */}
        {canPost && currentUserId && currentUserRole && filter !== "MINE" && (
          <InlinePostCreator
            mode={filter}
            currentUserName={currentUserName}
            currentUserAvatarUrl={currentUserAvatarUrl}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            membershipInfo={membershipInfo}
            onPostCreated={handlePostCreated}
            onPostUpdated={handlePostUpdated}
          />
        )}
        {filter === "MINE" && canPost && (
          <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-4 text-center text-sm text-brand-600">
            {t("mineComposerHint")}
          </div>
        )}

        {/* Posts */}
        {posts.length === 0 && !loading && (
          <div className="bg-white rounded-xl border border-brand-200 p-12 text-center space-y-2">
            <p className="text-brand-500">
              {filter === "MINE" ? t("mineEmpty") : t("feedEmpty")}
            </p>
            {canPost && filter !== "MINE" && (
              <Link href="/feed/tao-bai" className="text-sm text-brand-600 hover:text-brand-800 underline">
                Hãy là người đầu tiên đăng bài!
              </Link>
            )}
          </div>
        )}

        {posts.map((post, i) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            index={i}
            onReact={handleReact}
            onLock={handleLock}
            onDelete={handleDelete}
            onDismiss={handlePostDismiss}
            onPromote={handlePromote}
            onToggleFeatured={handleToggleFeatured}
            onRequestPromotion={handleRequestPromotion}
            onCancelRequest={handleCancelRequest}
            tierSilver={tierSilver}
            tierGold={tierGold}
            tierIndSilver={tierIndSilver}
            tierIndGold={tierIndGold}
            isMounted={isMounted}
            now={now}
          />
        ))}

        <div ref={observerRef} className="h-4" />
        {loading && posts.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <p className="text-center text-sm text-brand-400 py-4">{t("endOfFeed")}</p>
        )}
      </div>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-full lg:w-80 shrink-0 space-y-4 hidden lg:block">
        {!isMember ? (
          <div className="bg-white rounded-xl border border-brand-200 p-5 space-y-3">
            <h3 className="font-semibold text-brand-900 text-sm">{t("joinHeading")}</h3>
            <p className="text-xs text-brand-400">
              {isLoggedIn
                ? t("pendingMsg")
                : t("guestMsg")}
            </p>
            {!isLoggedIn && (
              <Link href="/login" className="flex w-full items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 transition-colors">
                {t("loginBtn")}
              </Link>
            )}
          </div>
        ) : (
          <>
            {membershipInfo && <MembershipCard info={membershipInfo} now={now} />}
            {quotaInfo && <QuotaCard quota={quotaInfo} now={now} />}
          </>
        )}

        {topContributors.length > 0 && (
          <div className="bg-white rounded-xl border border-brand-200 p-5">
            <h3 className="font-semibold text-brand-900 text-sm mb-4">{t("topContributors")}</h3>
            <ul className="space-y-3">
              {topContributors.map((c, i) => {
                const t = getTierBadge(c.contributionTotal, c.accountType, tierSilver, tierGold, tierIndSilver, tierIndGold)
                return (
                  <li key={c.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-brand-400 w-4 text-center">{i + 1}</span>
                    <div className="relative w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {c.avatarUrl ? (
                        <Image src={c.avatarUrl} alt="" fill className="object-cover" sizes="32px" />
                      ) : (
                        <span className="text-xs font-bold text-brand-700">{getInitials(c.name)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-900 truncate">{c.name}</p>
                      {c.company && <p className="text-xs text-brand-400 truncate">{c.company.name}</p>}
                    </div>
                    <span className={cn("text-[10px] font-bold rounded-full px-1.5 py-0.5", t.cls)}>{t.label}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Sticky vertical ad rail — fetched separately as a streamed server
            component so the feed renders without waiting on the banner query. */}
        {sidebarBannersSlot}
      </aside>
    </div>

    {/* Promote modal — render khi admin click "Đẩy lên trang chủ" trên menu post. */}
    {promoteModalPost && (
      <PromotePostModal
        postId={promoteModalPost.id}
        postTitle={promoteModalPost.title}
        initialCategories={
          (promoteModalPost.newsCategories ?? []) as NewsCategoryValue[]
        }
        initialPromoted={promoteModalPost.isPromoted}
        onClose={() => setPromoteModalPostId(null)}
        onSuccess={(next) => {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === promoteModalPost.id
                ? {
                    ...p,
                    isPromoted: next.isPromoted,
                    newsCategories: next.newsCategories,
                  }
                : p,
            ),
          )
          setPromoteModalPostId(null)
        }}
      />
    )}
    </div>
  )
}
