"use client"

import { useEffect, useRef, useState } from "react"
import { Upload, X, FileText, FileSpreadsheet, File as FileIcon } from "lucide-react"

/**
 * Chứng từ Sổ quỹ — multi-attachment. User chọn 1 hoặc nhiều file cùng lúc,
 * mỗi file thành 1 item trong list. Upload Drive chỉ chạy khi TransactionForm
 * submit (tránh orphan file khi user bỏ ngang).
 *
 * Mỗi item là một AttachmentItem:
 *  - kind "existing": chứng từ đã có (edit mode), giữ nguyên metadata Drive
 *  - kind "pending":  file mới đã chọn (đã nén nếu ảnh), blob URL preview,
 *                     chờ upload khi submit
 *
 * Parent (TransactionForm) gọi `uploadPendingAttachments` ở submit để upload
 * các pending items song song và trả về array Attachment cuối cùng.
 */

const ACCEPT_TYPES = [
  "image/*",
  "application/pdf",
  ".xls",
  ".xlsx",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc",
  ".docx",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
].join(",")

const MAX_IMAGE_DIM = 2000
const IMAGE_QUALITY = 0.85
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB sau khi nén / file

/** Shape của 1 attachment đã lưu trên Drive — match JSON column shape. */
export type Attachment = {
  driveFileId: string
  driveViewUrl: string
  fileName: string
  mimeType: string
}

export type AttachmentItem =
  | { id: string; kind: "existing"; value: Attachment }
  | {
      id: string
      kind: "pending"
      file: File
      previewUrl: string | null // blob URL cho image; null cho non-image
      mimeType: string
      fileName: string
    }

function isImageMime(m: string | null | undefined): boolean {
  return !!m && m.startsWith("image/")
}
function isPdfMime(m: string | null | undefined): boolean {
  return m === "application/pdf"
}
function isExcelMime(m: string | null | undefined): boolean {
  if (!m) return false
  return (
    m === "application/vnd.ms-excel" ||
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    m === "text/csv"
  )
}

/** Nén ảnh qua canvas → file WebP. Fallback nguyên file nếu trình duyệt
 *  không decode được (vd HEIC iOS). */
async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/webp", IMAGE_QUALITY)
    })
    if (!blob) return file
    const baseName = file.name.replace(/\.[^.]+$/, "")
    return new File([blob], `${baseName}.webp`, { type: "image/webp" })
  } catch {
    return file
  }
}

let pendingIdCounter = 0
function newId(prefix: string): string {
  pendingIdCounter += 1
  return `${prefix}-${Date.now()}-${pendingIdCounter}`
}

export function ReceiptUpload({
  items,
  onChange,
}: {
  items: AttachmentItem[]
  onChange: (next: AttachmentItem[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  // Cleanup blob URLs khi unmount.
  useEffect(() => {
    return () => {
      for (const it of items) {
        if (it.kind === "pending" && it.previewUrl) {
          URL.revokeObjectURL(it.previewUrl)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFiles(rawFiles: FileList) {
    setError(null)
    setProcessing(`Đang xử lý ${rawFiles.length} file...`)
    try {
      const additions: AttachmentItem[] = []
      const errors: string[] = []
      for (let i = 0; i < rawFiles.length; i++) {
        const raw = rawFiles[i]
        let file = raw
        if (raw.type.startsWith("image/")) {
          file = await compressImage(raw)
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          errors.push(
            `${raw.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB vượt giới hạn 20MB`,
          )
          continue
        }
        const isImage = file.type.startsWith("image/")
        additions.push({
          id: newId("pending"),
          kind: "pending",
          file,
          previewUrl: isImage ? URL.createObjectURL(file) : null,
          mimeType: file.type || "application/octet-stream",
          fileName: file.name,
        })
      }
      if (additions.length > 0) onChange([...items, ...additions])
      if (errors.length > 0) setError(errors.join(" · "))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xử lý file thất bại")
    } finally {
      setProcessing("")
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function handleRemove(id: string) {
    const target = items.find((it) => it.id === id)
    if (target && target.kind === "pending" && target.previewUrl) {
      URL.revokeObjectURL(target.previewUrl)
    }
    onChange(items.filter((it) => it.id !== id))
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {items.map((it) => (
            <AttachmentCard key={it.id} item={it} onRemove={() => handleRemove(it.id)} />
          ))}
        </div>
      )}

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!processing}
          className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-brand-300 px-4 py-3 text-sm text-brand-600 hover:border-brand-500 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Upload className="h-4 w-4" />
          {processing ||
            (items.length > 0
              ? "+ Thêm chứng từ"
              : "Chọn chứng từ (ảnh / PDF / Excel / Word)")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files
            if (files && files.length > 0) handleFiles(files)
          }}
        />
        <p className="text-xs text-brand-400">
          Chọn nhiều file cùng lúc (Ctrl/Cmd + click). Ảnh tự nén. Tối đa 20MB/file.
          Tải lên Drive khi bạn lưu giao dịch.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}

function AttachmentCard({
  item,
  onRemove,
}: {
  item: AttachmentItem
  onRemove: () => void
}) {
  const isExisting = item.kind === "existing"
  const isImage =
    item.kind === "existing"
      ? isImageMime(item.value.mimeType)
      : isImageMime(item.mimeType)
  const fileName = item.kind === "existing" ? item.value.fileName : item.fileName
  const mimeType = item.kind === "existing" ? item.value.mimeType : item.mimeType
  const thumbnail =
    item.kind === "existing"
      ? `https://drive.google.com/thumbnail?id=${item.value.driveFileId}&sz=w400`
      : item.previewUrl
  const openUrl = item.kind === "existing" ? item.value.driveViewUrl : item.previewUrl

  return (
    <div className="relative w-44 rounded-lg border border-brand-200 bg-white p-2">
      {isImage && thumbnail ? (
        <a
          href={openUrl ?? "#"}
          target={openUrl?.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          className="block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt={fileName}
            className="h-28 w-full rounded object-cover bg-brand-50"
            referrerPolicy="no-referrer"
          />
        </a>
      ) : (
        <div className="flex h-28 w-full flex-col items-center justify-center rounded bg-brand-50 text-brand-600">
          <FileTypeIcon mime={mimeType} />
          <span className="mt-1 text-[10px] uppercase tracking-wide">
            {fileTypeLabel(mimeType, fileName)}
          </span>
        </div>
      )}
      <p className="mt-2 truncate text-xs font-medium text-brand-900" title={fileName}>
        {fileName}
      </p>
      <p
        className={
          "text-[10px] " + (isExisting ? "text-emerald-700" : "text-amber-700")
        }
      >
        {isExisting ? "✓ Đã lưu" : "⏳ Chờ tải lên khi lưu"}
      </p>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow"
        title={isExisting ? "Xóa khỏi danh sách (sẽ xóa Drive khi lưu)" : "Gỡ file"}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function FileTypeIcon({ mime }: { mime: string | null | undefined }) {
  if (isPdfMime(mime)) return <FileText className="h-8 w-8" />
  if (isExcelMime(mime)) return <FileSpreadsheet className="h-8 w-8" />
  return <FileIcon className="h-8 w-8" />
}

function fileTypeLabel(
  mime: string | null | undefined,
  fileName: string | null | undefined,
): string {
  if (isPdfMime(mime)) return "PDF"
  if (isExcelMime(mime)) return "Excel"
  if (mime?.includes("word")) return "Word"
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase()
    if (ext) return ext.toUpperCase()
  }
  return "File"
}

/** Upload song song tất cả pending items lên Drive. Trả về array Attachment
 *  cuối cùng (existing giữ nguyên metadata cũ, pending → metadata mới).
 *  Nếu bất kỳ upload nào fail → trả error; các file đã upload trước đó vẫn ở
 *  Drive (orphan) — server sẽ KHÔNG biết về chúng. Trade-off chấp nhận được
 *  cho UX hiếm gặp này; nếu fail user retry sẽ tạo bản mới + cleanup khi save.
 */
export async function uploadPendingAttachments(
  items: AttachmentItem[],
  year: number,
): Promise<
  | { ok: true; data: Attachment[] }
  | { ok: false; error: string }
> {
  const tasks = items.map(async (it): Promise<Attachment> => {
    if (it.kind === "existing") return it.value
    const fd = new FormData()
    fd.append("file", it.file)
    fd.append("year", String(year))
    const res = await fetch("/api/admin/thu-chi/upload-receipt", {
      method: "POST",
      body: fd,
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error ?? `Upload ${it.fileName} thất bại`)
    }
    const data = (await res.json()) as {
      receiptUrl: string
      receiptDriveFileId: string
      receiptFileName: string
      receiptMimeType: string
    }
    return {
      driveFileId: data.receiptDriveFileId,
      driveViewUrl: data.receiptUrl,
      fileName: data.receiptFileName,
      mimeType: data.receiptMimeType,
    }
  })
  try {
    const data = await Promise.all(tasks)
    return { ok: true, data }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Upload thất bại",
    }
  }
}

/** Khởi tạo items từ attachments JSON ở DB (edit mode). */
export function existingItemsFrom(attachments: Attachment[]): AttachmentItem[] {
  return attachments.map((a) => ({
    id: newId("existing"),
    kind: "existing",
    value: a,
  }))
}
