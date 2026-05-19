"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  PromotePostModal,
  type NewsCategoryValue,
} from "@/components/features/admin/PromotePostModal"

type PromotionRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

type LinkedPost = {
  id: string
  status: string
  isPromoted: boolean
  newsCategories: string[]
  category: string
  title: string | null
  promotionRequests: { status: PromotionRequestStatus }[]
}

interface Props {
  productId: string
  slug: string
  isOwner: boolean
  /** ADMIN hoặc committee TRUYEN_THONG (đi qua admin edit route). */
  canProductWrite: boolean
  /** ADMIN-specific actions (Khoá, Đẩy lên trang chủ, Featured, Xoá). */
  isAdminViewer: boolean
  /** product.certStatus — DRAFT → cho phép owner nộp đơn cert. */
  certStatus: string
  /** Product.isFeatured initial state. */
  initialIsFeatured: boolean
  /** Linked Post (Product.postId). Null cho Product legacy không gắn Post. */
  post: LinkedPost | null
}

/**
 * Dropdown `⋮` cho trang chi tiết sản phẩm. Gom action của owner/admin —
 * Edit / History / Cert / Featured + post-level (Khoá / Đẩy lên trang chủ /
 * Xoá) qua Product.postId. Đồng bộ tính năng với feed admin menu.
 */
export function ProductActionsMenu({
  productId,
  slug,
  isOwner,
  canProductWrite,
  isAdminViewer,
  certStatus,
  initialIsFeatured,
  post,
}: Props) {
  const t = useTranslations("feed")
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [isFeatured, setIsFeatured] = useState(initialIsFeatured)
  const [postState, setPostState] = useState({
    status: post?.status ?? "PUBLISHED",
    isPromoted: post?.isPromoted ?? false,
    newsCategories: (post?.newsCategories ?? []) as NewsCategoryValue[],
    latestPromoStatus: post?.promotionRequests[0]?.status ?? null,
  })
  const [promoteModalOpen, setPromoteModalOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  const isPostLocked = postState.status === "LOCKED"

  function go(href: string) {
    setOpen(false)
    window.location.href = href
  }

  async function toggleFeatured() {
    setOpen(false)
    if (!isAdminViewer) return
    const next = !isFeatured
    setIsFeatured(next)
    try {
      const res = await fetch(`/api/admin/products/${productId}/featured`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isFeatured: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? "Lỗi")
        setIsFeatured(!next)
      } else {
        router.refresh()
      }
    } catch {
      alert("Lỗi kết nối")
      setIsFeatured(!next)
    }
  }

  async function lockToggle() {
    setOpen(false)
    if (!post) return
    try {
      const res = await fetch(`/api/posts/${post.id}/lock`, { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setPostState((s) => ({ ...s, status: data.status }))
        router.refresh()
      } else {
        alert(data.error ?? "Lỗi")
      }
    } catch {
      alert("Lỗi kết nối")
    }
  }

  async function deletePost() {
    setOpen(false)
    if (!post) return
    if (!window.confirm(t("deleteConfirm"))) return
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" })
      if (res.ok) {
        // DELETE handler soft-delete Post (status=DELETED) + unpublish Product
        // gắn liền (isPublished=false) trong 1 transaction. SP biến mất khỏi
        // mọi listing/detail (đều filter isPublished=true). Reversible — có
        // thể republish sau, không bị wipe ProductRevision/Cert/Comment.
        router.push("/san-pham-chung-nhan")
      } else {
        alert("Xoá thất bại.")
      }
    } catch {
      alert("Lỗi kết nối")
    }
  }

  function openPromote() {
    setOpen(false)
    setPromoteModalOpen(true)
  }

  /** Owner: xin admin đẩy bài lên trang chủ. */
  async function handleRequestPromotion() {
    setOpen(false)
    if (!post) return
    const reason = window.prompt(t("requestPromotionPrompt"))
    if (reason === null) return
    try {
      const res = await fetch(`/api/posts/${post.id}/request-promotion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? t("genericError")); return }
      setPostState((s) => ({ ...s, latestPromoStatus: "PENDING" }))
      alert(t("requestPromotionSubmitted"))
    } catch { alert(t("genericError")) }
  }

  /** Owner: rút yêu cầu PENDING. */
  async function handleCancelRequest() {
    setOpen(false)
    if (!post) return
    if (!window.confirm(t("cancelRequestConfirm"))) return
    try {
      const res = await fetch(`/api/posts/${post.id}/request-promotion`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        alert(data.error ?? t("genericError"))
        return
      }
      setPostState((s) => ({ ...s, latestPromoStatus: "CANCELLED" }))
    } catch { alert(t("genericError")) }
  }

  // Không có action nào → ẩn nút
  if (!isOwner && !canProductWrite) return null

  // Owner edit dùng owner route, admin (non-owner) dùng admin route.
  const editHref = isOwner ? `/san-pham/${slug}/sua` : `/admin/san-pham/${slug}/sua`
  const historyHref = `/san-pham/${slug}/lich-su`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Tuỳ chọn"
        className="rounded-full p-2 text-brand-500 hover:bg-brand-50 hover:text-brand-800"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {/* Edit — cả owner lẫn admin (route khác nhau) */}
          <button
            type="button"
            onClick={() => go(editHref)}
            className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
          >
            {t("menuEdit")}
            {!isOwner && canProductWrite && (
              <span className="ml-1 text-[10px] text-neutral-400">(Admin)</span>
            )}
          </button>

          {/* Admin moderation — chỉ khi admin xem SP của người khác (không
              phải SP của chính mình). Tránh case INFINITE owner thấy "Khoá
              bài / Đẩy lên trang chủ" trên SP của họ — moderation luôn dành
              cho người khác kiểm duyệt. */}
          {isAdminViewer && !isOwner && post && (
            <>
              <button
                type="button"
                onClick={lockToggle}
                className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
              >
                {isPostLocked ? t("menuUnlock") : t("menuLock")}
              </button>
              {postState.status === "PUBLISHED" && (
                <button
                  type="button"
                  onClick={openPromote}
                  className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                >
                  {postState.isPromoted ? t("menuUnpromote") : t("menuPromote")}
                </button>
              )}
            </>
          )}

          {/* Đưa vào Sản phẩm tiêu biểu — admin only, không phải owner */}
          {isAdminViewer && !isOwner && (
            <button
              type="button"
              onClick={toggleFeatured}
              className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
            >
              {isFeatured ? t("menuUnfeatureProduct") : t("menuFeatureProduct")}
            </button>
          )}

          {/* Owner: Xin / Rút yêu cầu đẩy lên trang chủ — chỉ khi có linked
              Post + post chưa promoted + status PUBLISHED. */}
          {isOwner && post && (() => {
            const hasPending = postState.latestPromoStatus === "PENDING"
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
                    {t("menuRequestPromotion")}
                  </button>
                )}
                {hasPending && (
                  <button
                    type="button"
                    onClick={handleCancelRequest}
                    className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
                  >
                    {t("menuCancelPromotionRequest")}
                  </button>
                )}
              </>
            )
          })()}

          {/* Submit cert — chỉ owner khi product còn DRAFT */}
          {isOwner && certStatus === "DRAFT" && (
            <button
              type="button"
              onClick={() => go("/chung-nhan/nop-don")}
              className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
            >
              Nộp đơn chứng nhận
            </button>
          )}

          {/* History — owner + admin */}
          <button
            type="button"
            onClick={() => go(historyHref)}
            className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
          >
            {t("menuHistory")}
          </button>

          {/* Delete — admin (non-owner) hoặc owner. Cascade xoá Product qua
              Post.id (Product.postId onDelete: Cascade). Cần linked Post. */}
          {(isOwner || isAdminViewer) && post && (
            <>
              <div className="my-1 border-t border-neutral-100" />
              <button
                type="button"
                onClick={deletePost}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                {t("menuDelete")}
              </button>
            </>
          )}
        </div>
      )}

      {/* Promote modal — admin "Đẩy lên trang chủ" với category tagging */}
      {promoteModalOpen && post && (
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
