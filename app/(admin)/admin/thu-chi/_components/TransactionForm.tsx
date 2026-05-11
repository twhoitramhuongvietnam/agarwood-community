"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ReceiptUpload,
  uploadPendingAttachments,
  existingItemsFrom,
  type AttachmentItem,
  type Attachment,
} from "./ReceiptUpload"
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../_actions"
import {
  formatAmountInput,
  parseAmountInput,
} from "@/lib/ledger-utils"

type LedgerType = "INCOME" | "EXPENSE"
type PaymentMethod = "CASH" | "BANK"

export type CategoryOption = {
  id: string
  name: string
  type: LedgerType
  isSystem: boolean
}

export type TransactionInitial = {
  id: string
  type: LedgerType
  categoryId: string
  amount: number // BigInt converted ở server
  transactionDate: string // YYYY-MM-DD
  paymentMethod: PaymentMethod
  referenceNo: string | null
  description: string
  /** Legacy Cloudinary URL — display-only badge, không edit được. */
  receiptUrl: string | null
  /** Chứng từ Drive đính kèm (0..N item). */
  attachments: Attachment[]
  isSystem: boolean
  hasRelatedPayment: boolean
}

export function TransactionForm({
  categories,
  initial,
}: {
  categories: CategoryOption[]
  initial?: TransactionInitial
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [type, setType] = useState<LedgerType>(initial?.type ?? "INCOME")
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? "")
  const [amount, setAmount] = useState(
    initial ? formatAmountInput(initial.amount) : "",
  )
  const [transactionDate, setTransactionDate] = useState<string>(
    initial?.transactionDate ?? new Date().toISOString().slice(0, 10),
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initial?.paymentMethod ?? "BANK",
  )
  const [referenceNo, setReferenceNo] = useState(initial?.referenceNo ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [attachments, setAttachments] = useState<AttachmentItem[]>(() =>
    initial ? existingItemsFrom(initial.attachments) : [],
  )

  const isEdit = !!initial
  const isSystem = initial?.isSystem ?? false
  const hasRelatedPayment = initial?.hasRelatedPayment ?? false

  // Categories cho type hiện tại — reset categoryId nếu user đổi type sang
  // loại khác mà category cũ không còn hợp lệ.
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  )

  function onTypeChange(next: LedgerType) {
    setType(next)
    // Nếu category hiện tại không thuộc type mới → clear
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat || cat.type !== next) setCategoryId("")
  }

  function onAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const parsed = parseAmountInput(raw)
    if (parsed === null) {
      if (raw === "") setAmount("")
      return
    }
    setAmount(formatAmountInput(parsed))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      // Upload Drive chỉ khi user submit. Năm gán theo transactionDate để
      // file vào đúng folder năm của giao dịch.
      const year = Number(transactionDate.slice(0, 4)) || new Date().getFullYear()
      const uploadResult = await uploadPendingAttachments(attachments, year)
      if (!uploadResult.ok) {
        setError(uploadResult.error)
        return
      }
      const payload = {
        type,
        categoryId,
        amount,
        transactionDate,
        paymentMethod,
        referenceNo,
        description,
        attachments: uploadResult.data,
      }
      const res = isEdit
        ? await updateTransaction(initial!.id, payload)
        : await createTransaction(payload)
      if ("error" in res && res.error) {
        setError(res.error)
        return
      }
      if (isEdit) {
        router.refresh()
      } else if ("id" in res && res.id) {
        router.push(`/admin/thu-chi/${res.id}`)
      }
    })
  }

  function onDelete() {
    if (!initial) return
    if (!window.confirm("Xóa giao dịch này? Hành động không thể hoàn tác.")) return
    startDelete(async () => {
      const res = await deleteTransaction(initial.id)
      if (res && "error" in res && res.error) {
        setError(res.error)
      }
      // Khi xóa thành công server đã redirect → không cần làm gì thêm
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-3xl">
      {/* Type toggle */}
      <div className="inline-flex rounded-lg border border-brand-200 p-1 bg-brand-50">
        <button
          type="button"
          onClick={() => onTypeChange("INCOME")}
          disabled={isSystem}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            type === "INCOME" ? "bg-emerald-600 text-white" : "text-brand-700 hover:bg-white"
          }`}
        >
          ↓ Thu
        </button>
        <button
          type="button"
          onClick={() => onTypeChange("EXPENSE")}
          disabled={isSystem}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            type === "EXPENSE" ? "bg-red-600 text-white" : "text-brand-700 hover:bg-white"
          }`}
        >
          ↑ Chi
        </button>
      </div>

      {(isSystem || hasRelatedPayment) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {isSystem
            ? "Đây là giao dịch hệ thống (Số dư đầu kỳ) — chỉ cho sửa số tiền/ngày/ghi chú, không được đổi loại hay danh mục."
            : "Đây là giao dịch tự động sinh từ xác nhận chuyển khoản — sửa số tiền/danh mục có thể gây lệch với bảng /admin/thanh-toan."}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-brand-800">
            Số tiền (VNĐ) <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            required
            value={amount}
            onChange={onAmountChange}
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 text-right font-mono text-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-brand-800">
            Ngày <span className="text-red-500">*</span>
          </span>
          <input
            type="date"
            required
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-brand-800">
            Danh mục <span className="text-red-500">*</span>
          </span>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={isSystem}
            className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-brand-50 disabled:cursor-not-allowed"
          >
            <option value="">-- Chọn danh mục --</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isSystem ? " (HT)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-brand-800">Hình thức</span>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="BANK">Chuyển khoản</option>
            <option value="CASH">Tiền mặt</option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-brand-800">Số phiếu / Mã GD</span>
          <input
            type="text"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            placeholder="VD: PT-2026-001 hoặc mã giao dịch ngân hàng"
            className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-brand-800">
            Diễn giải <span className="text-red-500">*</span>
          </span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Mô tả nội dung giao dịch..."
            className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>
      </div>

      <div>
        <span className="text-sm font-medium text-brand-800 block mb-2">
          Chứng từ {attachments.length > 0 && (
            <span className="text-xs text-brand-500 font-normal">({attachments.length} file)</span>
          )}
        </span>
        <ReceiptUpload items={attachments} onChange={setAttachments} />
        {initial?.receiptUrl && (
          <p className="mt-2 text-xs text-amber-700">
            ⚠ Giao dịch này có chứng từ cũ (Cloudinary):{" "}
            <a
              href={initial.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-amber-900"
            >
              Xem
            </a>
            . Dữ liệu Cloudinary chỉ đọc — admin có thể bổ sung file mới qua nút trên.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-brand-200">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition-colors"
        >
          {pending ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo giao dịch"}
        </button>
        <Link
          href={isEdit ? `/admin/thu-chi/${initial!.id}` : "/admin/thu-chi/so-quy"}
          className="rounded-lg border border-brand-300 px-5 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          Hủy
        </Link>
        {isEdit && !isSystem && !hasRelatedPayment && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="ml-auto rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? "Đang xóa..." : "Xóa giao dịch"}
          </button>
        )}
      </div>
    </form>
  )
}
