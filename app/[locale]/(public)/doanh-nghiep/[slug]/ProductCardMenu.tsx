"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

interface Props {
  productId: string
  productSlug: string
  /** Post.id liên kết với Product. null = SP legacy không có Post → ẩn Xoá. */
  postId: string | null
  /** Owner xài route /san-pham/[slug]/sua, admin (non-owner) xài route admin. */
  isOwner: boolean
  certStatus: string
  /** True nếu có đơn DRAFT/PENDING/UNDER_REVIEW → ẩn menu Chứng nhận để tránh
   *  nộp đơn trùng. */
  hasActiveCert: boolean
}

/**
 * Menu `⋮` trên thumbnail product card ở trang DN. Owner/admin actions:
 *  - Sửa: vào trang edit
 *  - Chứng nhận: nộp đơn cert mới (DRAFT/REJECTED/REFUNDED) hoặc
 *    Gia hạn (APPROVED) — pre-select sản phẩm.
 *  - Xoá: soft-delete post + unpublish product
 *
 * Click vào dropdown items sẽ stopPropagation để KHÔNG trigger Link wrap card.
 */
export function ProductCardMenu({
  productId,
  productSlug,
  postId,
  isOwner,
  certStatus,
  hasActiveCert,
}: Props) {
  const t = useTranslations("feed")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  const editHref = isOwner
    ? `/san-pham/${productSlug}/sua`
    : `/admin/san-pham/${productSlug}/sua`

  // APPROVED → gia hạn (kèm banner renewal); còn lại (DRAFT/REJECTED/REFUNDED)
  // → đơn mới. PENDING/UNDER_REVIEW (hasActiveCert) ẩn hoàn toàn — đang xử lý.
  const isApproved = certStatus === "APPROVED"
  const certHref = isApproved
    ? `/chung-nhan/nop-don?renew=${productId}`
    : `/chung-nhan/nop-don?product=${productId}`
  const certLabel = isApproved ? "Gia hạn chứng nhận" : "Chứng nhận sản phẩm"
  const showCertOption = !hasActiveCert

  function stop(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleEdit(e: React.MouseEvent) {
    stop(e)
    setOpen(false)
    window.location.href = editHref
  }

  function handleCert(e: React.MouseEvent) {
    stop(e)
    setOpen(false)
    window.location.href = certHref
  }

  async function handleDelete(e: React.MouseEvent) {
    stop(e)
    setOpen(false)
    if (!postId) return
    if (!window.confirm(t("deleteConfirm"))) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" })
      if (res.ok) {
        // Server đã revalidatePath cho trang DN listing — router.refresh
        // sẽ pull fresh data, card biến mất khỏi grid ngay.
        router.refresh()
      } else {
        alert("Xoá thất bại.")
        setDeleting(false)
      }
    } catch {
      alert("Lỗi kết nối")
      setDeleting(false)
    }
  }

  return (
    <div
      ref={ref}
      className="absolute top-2 left-2 z-10"
      onClick={stop}
    >
      <button
        type="button"
        onClick={(e) => {
          stop(e)
          setOpen((v) => !v)
        }}
        aria-label="Tuỳ chọn sản phẩm"
        disabled={deleting}
        className="rounded-full bg-white/90 backdrop-blur p-1.5 text-brand-700 shadow-sm hover:bg-white hover:text-brand-900 transition-colors disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={handleEdit}
            className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
          >
            {t("menuEdit")}
            {!isOwner && (
              <span className="ml-1 text-[10px] text-neutral-400">(Admin)</span>
            )}
          </button>

          {showCertOption && (
            <button
              type="button"
              onClick={handleCert}
              className="block w-full px-4 py-2 text-left text-sm text-brand-800 hover:bg-brand-50"
            >
              {isApproved ? "🔄 " : "🏅 "}
              {certLabel}
            </button>
          )}

          {hasActiveCert && (
            <div className="px-4 py-2 text-xs text-neutral-400 italic">
              ⏳ Đơn chứng nhận đang xử lý
            </div>
          )}

          {postId && (
            <>
              <div className="my-1 border-t border-neutral-100" />
              <button
                type="button"
                onClick={handleDelete}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                {t("menuDelete")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
