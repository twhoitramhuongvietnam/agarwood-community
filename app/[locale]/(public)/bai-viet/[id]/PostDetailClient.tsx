"use client"

import { useTranslations } from "next-intl"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import DOMPurify from "isomorphic-dompurify"
import { cn } from "@/lib/utils"
import { isAdmin } from "@/lib/roles"
import { CommentLoginBanner } from "@/components/features/register-nudge/CommentLoginBanner"
import {
  PromotePostModal,
  type NewsCategoryValue,
} from "@/components/features/admin/PromotePostModal"

// ── Types ────────────────────────────────────────────────────────────────────

type Author = {
  id: string
  name: string
  avatarUrl: string | null
  role: string
  accountType: string
  contributionTotal: number
  company: { name: string; slug: string } | null
}

type PromotionRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

type PostData = {
  id: string
  authorId: string
  title: string | null
  content: string
  imageUrls: string[]
  status: string
  category: string
  newsCategories: string[]
  isPremium: boolean
  isPromoted: boolean
  viewCount: number
  createdAt: string
  updatedAt: string
  author: Author
  product: { id: string; slug: string; isFeatured: boolean } | null
  latestPromotionRequest: { status: PromotionRequestStatus; reviewNote: string | null } | null
  reactions: { type: string }[]
  _count: { reactions: number; comments: number }
}

type CommentData = {
  id: string
  content: string
  parentId: string | null
  createdAt: string
  updatedAt: string
  author: { id: string; name: string; avatarUrl: string | null; role: string }
  likeCount: number
  replyCount: number
  isLiked: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Vừa xong"
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(dateStr).toLocaleDateString("vi-VN")
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}

// ── Component ────────────────────────────────────────────────────────────────

export function PostDetailClient({
  post,
  currentUserId,
  currentUserRole,
  currentUserName,
  currentUserAvatar,
  adminEditedAfterOwner = false,
}: {
  post: PostData
  currentUserId: string | null
  currentUserRole: string | null
  currentUserName: string | null
  currentUserAvatar: string | null
  /** Phase 3.6: hiện banner cảnh báo cho owner khi admin đã sửa bài SAU bản
   *  cuối của owner. Click "Xem so sánh" → /bai-viet/[id]/lich-su. */
  adminEditedAfterOwner?: boolean
}) {
  const t = useTranslations("postDetail")
  const tFeed = useTranslations("feed")
  const router = useRouter()

  const [isMounted, setIsMounted] = useState(false)
  const [reactionCount, setReactionCount] = useState(post._count.reactions)
  const [hasReacted, setHasReacted] = useState(post.reactions.some((r) => r.type === "LIKE"))
  const [comments, setComments] = useState<CommentData[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Admin/owner action menu state
  const [menuOpen, setMenuOpen] = useState(false)
  const [postState, setPostState] = useState({
    status: post.status,
    isPromoted: post.isPromoted,
    newsCategories: post.newsCategories as NewsCategoryValue[],
    productIsFeatured: post.product?.isFeatured ?? false,
    latestPromotionRequest: post.latestPromotionRequest,
  })
  const [promoteModalOpen, setPromoteModalOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setIsMounted(true), [])

  // Close menu khi click ngoài
  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [menuOpen])

  const isAuthor = currentUserId === post.authorId
  const isAdminViewer = isAdmin(currentUserRole)
  const isLoggedInNonGuest = !!currentUserRole && currentUserRole !== "GUEST"
  // Menu hiện cho author (chỉnh sửa/xoá), admin (moderation), hoặc bất kỳ user
  // đăng nhập non-GUEST (chỉ để báo cáo bài).
  const canSeeMenu = isAuthor || isAdminViewer || (isLoggedInNonGuest && !isAuthor)
  const isPostLocked = postState.status === "LOCKED"

  // ── Admin/owner action handlers ─────────────────────────────────────────
  async function handleLockToggle() {
    setMenuOpen(false)
    try {
      const res = await fetch(`/api/posts/${post.id}/lock`, { method: "POST" })
      const data = await res.json()
      if (res.ok) setPostState((s) => ({ ...s, status: data.status }))
      else alert(data.error ?? "Lỗi")
    } catch { alert("Lỗi kết nối") }
  }

  async function handleDelete() {
    setMenuOpen(false)
    if (!window.confirm(tFeed("deleteConfirm"))) return
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" })
      if (res.ok) router.push("/feed")
      else alert("Xoá thất bại.")
    } catch { alert("Lỗi kết nối") }
  }

  async function handleToggleFeatured() {
    setMenuOpen(false)
    if (!post.product) return
    const next = !postState.productIsFeatured
    setPostState((s) => ({ ...s, productIsFeatured: next }))
    try {
      const res = await fetch(`/api/admin/products/${post.product.id}/featured`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isFeatured: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? "Lỗi")
        setPostState((s) => ({ ...s, productIsFeatured: !next }))
      }
    } catch {
      alert("Lỗi kết nối")
      setPostState((s) => ({ ...s, productIsFeatured: !next }))
    }
  }

  // Edit URL theo category — mirror FeedClient + ProductActionsMenu.
  // PRODUCT → ProductForm; NEWS → PostEditor (+ adminMode khi admin sửa hộ).
  const isProductPost = post.category === "PRODUCT" && post.product?.slug
  const viewerIsAuthor = currentUserId === post.author.id
  const editHrefSelf = isProductPost
    ? `/san-pham/${post.product!.slug}/sua`
    : `/feed/tao-bai?edit=${post.id}`
  const editHrefAdminMod = isProductPost
    ? `/admin/san-pham/${post.product!.slug}/sua`
    : `/feed/tao-bai?edit=${post.id}&adminMode=1&returnTo=/bai-viet/${post.id}`

  function openEdit() {
    setMenuOpen(false)
    window.location.href = viewerIsAuthor ? editHrefSelf : editHrefAdminMod
  }
  function openHistory() {
    setMenuOpen(false)
    window.location.href = `/bai-viet/${post.id}/lich-su`
  }
  function openPromoteModal() {
    setMenuOpen(false)
    setPromoteModalOpen(true)
  }

  /** Owner: xin admin đẩy bài lên trang chủ. */
  async function handleRequestPromotion() {
    setMenuOpen(false)
    const reason = window.prompt(tFeed("requestPromotionPrompt"))
    if (reason === null) return // user cancelled
    try {
      const res = await fetch(`/api/posts/${post.id}/request-promotion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? tFeed("genericError")); return }
      setPostState((s) => ({
        ...s,
        latestPromotionRequest: { status: "PENDING", reviewNote: null },
      }))
      alert(tFeed("requestPromotionSubmitted"))
    } catch { alert(tFeed("genericError")) }
  }

  /** Non-author logged-in users: báo cáo bài. */
  async function handleReport() {
    setMenuOpen(false)
    const reason = window.prompt(tFeed("reportPrompt"))
    if (!reason) return
    try {
      await fetch(`/api/posts/${post.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      alert(tFeed("reportSent"))
    } catch { alert(tFeed("genericError")) }
  }

  /** Owner: rút yêu cầu PENDING. */
  async function handleCancelRequest() {
    setMenuOpen(false)
    if (!window.confirm(tFeed("cancelRequestConfirm"))) return
    try {
      const res = await fetch(`/api/posts/${post.id}/request-promotion`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        alert(data.error ?? tFeed("genericError"))
        return
      }
      setPostState((s) => ({
        ...s,
        latestPromotionRequest: { status: "CANCELLED", reviewNote: null },
      }))
    } catch { alert(tFeed("genericError")) }
  }

  // Load comments
  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?postId=${post.id}`)
      const data = await res.json()
      setComments(data.comments ?? [])
    } finally {
      setLoadingComments(false)
    }
  }, [post.id])

  useEffect(() => { loadComments() }, [loadComments])

  async function handleReact() {
    if (!currentUserId) return
    setHasReacted((v) => !v)
    setReactionCount((v) => (hasReacted ? v - 1 : v + 1))
    try {
      await fetch(`/api/posts/${post.id}/react`, { method: "POST" })
    } catch {
      setHasReacted((v) => !v)
      setReactionCount((v) => (hasReacted ? v + 1 : v - 1))
    }
  }

  async function handleSubmitComment() {
    if (!newComment.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment.trim(),
          postId: post.id,
          parentId: replyTo?.id || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setComments((prev) => [...prev, data.comment])
        setNewComment("")
        setReplyTo(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLikeComment(commentId: string) {
    if (!currentUserId) return
    // Optimistic
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, isLiked: !c.isLiked, likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1 }
          : c,
      ),
    )
    try {
      await fetch(`/api/comments/${commentId}/like`, { method: "POST" })
    } catch {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, isLiked: !c.isLiked, likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1 }
            : c,
        ),
      )
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm(t("deleteComment"))) return
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" })
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      }
    } catch { /* */ }
  }

  const isLoggedIn = !!currentUserId
  const isLocked = post.status === "LOCKED"

  // Separate root comments and replies
  const rootComments = comments.filter((c) => !c.parentId)
  const repliesMap = new Map<string, CommentData[]>()
  for (const c of comments) {
    if (c.parentId) {
      const arr = repliesMap.get(c.parentId) ?? []
      arr.push(c)
      repliesMap.set(c.parentId, arr)
    }
  }

  return (
    <div className="bg-brand-50/60 min-h-screen">
    <div className="max-w-7xl mx-auto space-y-6 py-6 px-4 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/feed"
        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 transition-colors"
      >
        {t("backToCommunity")}
      </Link>

      {/* Phase 3.6 (2026-04): owner notification — admin đã sửa bài. Chỉ
          hiện cho owner (không hiện cho admin/người khác). */}
      {adminEditedAfterOwner && currentUserId === post.author.id && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white text-sm font-bold shrink-0">
            ✎
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Bài viết đã được Admin chỉnh sửa
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Admin đã sửa nội dung bài của bạn sau bản cuối của bạn. Bạn có
              thể so sánh và xem lý do trong lịch sử.
            </p>
          </div>
          <Link
            href={`/bai-viet/${post.id}/lich-su`}
            className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Xem so sánh →
          </Link>
        </div>
      )}

      {/* Post */}
      <article className="bg-white rounded-xl border border-brand-200 p-6 space-y-4">
        {/* Locked banner */}
        {isLocked && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            {t("postLocked")}
          </div>
        )}

        {/* Author + admin/owner action menu */}
        <div className="flex items-start gap-3">
          <div className="relative w-12 h-12 rounded-full bg-brand-200 flex items-center justify-center shrink-0 overflow-hidden">
            {post.author.avatarUrl ? (
              <Image src={post.author.avatarUrl} alt="" fill className="object-cover" sizes="48px" />
            ) : (
              <span className="text-sm font-bold text-brand-700">{getInitials(post.author.name)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {post.author.company ? (
                <Link
                  href={`/doanh-nghiep/${post.author.company.slug}`}
                  className="font-semibold text-brand-900 hover:text-brand-700"
                >
                  {post.author.company.name}
                </Link>
              ) : (
                <span className="font-semibold text-brand-900">{post.author.name}</span>
              )}
            </div>
            <span className="text-xs text-brand-400" suppressHydrationWarning>
              {isMounted ? timeAgo(post.createdAt) : ""}
            </span>
          </div>

          {/* Action menu — chỉ hiện cho author hoặc admin */}
          {canSeeMenu && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Tuỳ chọn"
                className="rounded-full p-2 text-brand-500 hover:bg-brand-50 hover:text-brand-800"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                  {/* Author actions */}
                  {isAuthor && (
                    <>
                      <button
                        type="button"
                        onClick={openEdit}
                        className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                      >
                        {tFeed("menuEdit")}
                      </button>
                      {/* Request / Cancel promotion — author flow. canRequest
                          khi: chưa promoted + không có pending + status PUBLISHED. */}
                      {(() => {
                        const promoStatus = postState.latestPromotionRequest?.status
                        const hasPending = promoStatus === "PENDING"
                        const canRequest =
                          !postState.isPromoted &&
                          !hasPending &&
                          postState.status === "PUBLISHED"
                        return (
                          <>
                            {canRequest && (
                              <button
                                type="button"
                                onClick={handleRequestPromotion}
                                className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                              >
                                {tFeed("menuRequestPromotion")}
                              </button>
                            )}
                            {hasPending && (
                              <button
                                type="button"
                                onClick={handleCancelRequest}
                                className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                              >
                                {tFeed("menuCancelPromotionRequest")}
                              </button>
                            )}
                          </>
                        )
                      })()}
                    </>
                  )}
                  {/* Admin moderation — chỉ khi admin xem bài của người khác.
                      Tránh case INFINITE author thấy "Khoá / Đẩy lên trang chủ"
                      trên bài của họ — moderation luôn là người khác kiểm duyệt. */}
                  {isAdminViewer && !isAuthor && (
                    <>
                      <button
                        type="button"
                        onClick={openEdit}
                        className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                      >
                        {tFeed("menuEdit")}
                      </button>
                      <button
                        type="button"
                        onClick={handleLockToggle}
                        className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                      >
                        {isPostLocked ? tFeed("menuUnlock") : tFeed("menuLock")}
                      </button>
                      {postState.status === "PUBLISHED" && (
                        <>
                          <button
                            type="button"
                            onClick={openPromoteModal}
                            className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                          >
                            {postState.isPromoted ? tFeed("menuUnpromote") : tFeed("menuPromote")}
                          </button>
                          {post.category === "PRODUCT" && post.product && (
                            <button
                              type="button"
                              onClick={handleToggleFeatured}
                              className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                            >
                              {postState.productIsFeatured
                                ? tFeed("menuUnfeatureProduct")
                                : tFeed("menuFeatureProduct")}
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {/* History — author + admin */}
                  {(isAuthor || isAdminViewer) && (
                    <button
                      type="button"
                      onClick={openHistory}
                      className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                    >
                      {tFeed("menuHistory")}
                    </button>
                  )}
                  {/* Report — user đăng nhập non-GUEST, không phải author */}
                  {isLoggedInNonGuest && !isAuthor && (
                    <button
                      type="button"
                      onClick={handleReport}
                      className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                    >
                      {tFeed("menuReport")}
                    </button>
                  )}
                  {/* Delete — author hoặc admin (admin chỉ khi !isAuthor để
                      tránh duplicate item) */}
                  {(isAuthor || (isAdminViewer && !isAuthor)) && (
                    <>
                      <div className="my-1 border-t border-neutral-100" />
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        {tFeed("menuDelete")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Promoted */}
        {post.isPromoted && (
          <span className="inline-flex text-xs font-medium bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
            {t("pinnedByAdmin")}
          </span>
        )}

        {/* Title */}
        {post.title && (
          <h1 className="text-xl font-bold text-brand-900 leading-snug">{post.title}</h1>
        )}

        {/* Content */}
        {isLocked && !isAdmin(currentUserRole) ? (
          <p className="text-sm text-brand-400 italic">{t("contentHidden")}</p>
        ) : (
          <div
            className="prose prose-sm max-w-none text-brand-800"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
          />
        )}

        {/* Images */}
        {post.imageUrls.length > 0 && (
          <div className={cn("gap-2 rounded-lg overflow-hidden", post.imageUrls.length === 1 ? "" : "grid grid-cols-2")}>
            {post.imageUrls.slice(0, 4).map((url, i) => (
              <Image key={i} src={url} alt="" width={700} height={500} className="w-full object-cover rounded-lg max-h-80" sizes="700px" />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between pt-4 border-t border-brand-200">
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <button
                onClick={handleReact}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 transition-colors",
                  hasReacted ? "bg-brand-100 text-brand-700" : "text-brand-400 hover:bg-brand-50 hover:text-brand-700",
                )}
              >
                {hasReacted ? "✓" : "○"} {t("helpful")} ({reactionCount})
              </button>
            ) : (
              <span className="text-sm text-brand-400">{t("helpful")} ({reactionCount})</span>
            )}
            <span className="text-sm text-brand-400">💬 {comments.length} {t("comments")}</span>
          </div>
        </div>

        {/* Phase 3.6 (2026-04): owner + admin actions row.
            - Owner: edit + xem lịch sử (nếu admin đã sửa).
            - Admin (không phải owner): edit (mở admin mode) + xem lịch sử. */}
        {isLoggedIn && (currentUserId === post.author.id || isAdmin(currentUserRole)) && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-brand-100">
            {viewerIsAuthor ? (
              <Link
                href={editHrefSelf}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
              >
                ✎ Chỉnh sửa bài
              </Link>
            ) : (
              <Link
                href={editHrefAdminMod}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                title="Sửa bài hộ owner — thay đổi sẽ được log lại"
              >
                ✎ Admin sửa bài
              </Link>
            )}
            <Link
              href={`/bai-viet/${post.id}/lich-su`}
              className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
            >
              📜 Lịch sử chỉnh sửa
            </Link>
          </div>
        )}
      </article>

      {/* Comments section */}
      <section className="bg-white rounded-xl border border-brand-200 p-6 space-y-5">
        <h2 className="font-semibold text-brand-900">{t("comments")} ({comments.length})</h2>

        {/* Comment input */}
        {isLoggedIn ? (
          <div className="flex gap-3">
            <div className="relative w-9 h-9 rounded-full bg-brand-200 flex items-center justify-center shrink-0 overflow-hidden">
              {currentUserAvatar ? (
                <Image src={currentUserAvatar} alt="" fill className="object-cover" sizes="36px" />
              ) : (
                <span className="text-xs font-bold text-brand-700">
                  {currentUserName?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              {replyTo && (
                <div className="flex items-center gap-2 text-xs text-brand-500">
                  <span>{t("reply")} <strong>{replyTo.name}</strong></span>
                  <button onClick={() => setReplyTo(null)} className="text-brand-400 hover:text-red-500">✕</button>
                </div>
              )}
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyTo ? `Trả lời ${replyTo.name}...` : t("writePlaceholder")}
                rows={2}
                className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  className="rounded-lg bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50 transition-colors"
                >
                  {submitting ? t("sending") : t("send")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <CommentLoginBanner />
        )}

        {/* Comments list */}
        {loadingComments ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-brand-400 text-center py-4">{t("noComments")}</p>
        ) : (
          <div className="space-y-4">
            {rootComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                replies={repliesMap.get(comment.id) ?? []}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onReply={(id, name) => setReplyTo({ id, name })}
                onLike={handleLikeComment}
                onDelete={handleDeleteComment}
                isMounted={isMounted}
              />
            ))}
          </div>
        )}
      </section>
    </div>

    {/* Promote modal — admin "Đẩy lên trang chủ" with category tagging */}
    {promoteModalOpen && (
      <PromotePostModal
        postId={post.id}
        postTitle={post.title}
        initialCategories={postState.newsCategories}
        initialPromoted={postState.isPromoted}
        onClose={() => setPromoteModalOpen(false)}
        onSuccess={(next) => {
          setPostState((s) => ({
            ...s,
            isPromoted: next.isPromoted,
            newsCategories: next.newsCategories,
          }))
          setPromoteModalOpen(false)
          router.refresh()
        }}
      />
    )}
    </div>
  )
}

// ── Comment Item ─────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  replies,
  currentUserId,
  currentUserRole,
  onReply,
  onLike,
  onDelete,
  isMounted,
  isReply = false,
}: {
  comment: CommentData
  replies: CommentData[]
  currentUserId: string | null
  currentUserRole: string | null
  onReply: (id: string, name: string) => void
  onLike: (id: string) => void
  onDelete: (id: string) => void
  isMounted: boolean
  isReply?: boolean
}) {
  const t = useTranslations("postDetail")
  const isOwn = currentUserId === comment.author.id
  const viewerIsAdmin = isAdmin(currentUserRole)
  const canDelete = isOwn || viewerIsAdmin
  const isLoggedIn = !!currentUserId

  return (
    <div className={cn("flex gap-3", isReply && "ml-12")}>
      <div className="relative w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center shrink-0 overflow-hidden">
        {comment.author.avatarUrl ? (
          <Image src={comment.author.avatarUrl} alt="" fill className="object-cover" sizes="32px" />
        ) : (
          <span className="text-xs font-bold text-brand-700">{getInitials(comment.author.name)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-brand-50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-brand-900">{comment.author.name}</span>
            {isAdmin(comment.author.role) && (
              <span className="text-[10px] font-bold bg-brand-700 text-white rounded-full px-1.5 py-0.5">Admin</span>
            )}
          </div>
          <p className="text-sm text-brand-800 whitespace-pre-wrap wrap-break-word">{comment.content}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 px-1">
          <span className="text-xs text-brand-400" suppressHydrationWarning>
            {isMounted ? timeAgo(comment.createdAt) : ""}
          </span>
          {isLoggedIn && (
            <button
              onClick={() => onLike(comment.id)}
              className={cn(
                "text-xs font-medium transition-colors",
                comment.isLiked ? "text-brand-700" : "text-brand-400 hover:text-brand-600",
              )}
            >
              {comment.isLiked ? t("liked") : t("like")}{comment.likeCount > 0 ? ` (${comment.likeCount})` : ""}
            </button>
          )}
          {isLoggedIn && (
            <button
              onClick={() => onReply(comment.id, comment.author.name)}
              className="text-xs font-medium text-brand-400 hover:text-brand-600 transition-colors"
            >
              {t("reply")}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
            >
              {t("delete")}
            </button>
          )}
        </div>

        {/* Nested replies */}
        {replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                replies={[]}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onReply={onReply}
                onLike={onLike}
                onDelete={onDelete}
                isMounted={isMounted}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
