"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAdminReadOnly, READ_ONLY_TOOLTIP } from "@/components/features/admin/AdminReadOnlyContext"

interface Props {
  certId: string
  govCertNumber: string | null
  govCertIssuer: string | null
  govCertIssuedAt: Date | string | null
  documentUrls: string[]
}

/**
 * Panel cho admin endorse đơn FAST_TRACK — single-admin action, không qua
 * HĐTĐ. Approve → certExpiredAt=null (trọn đời) + sinh certCode. Reject →
 * REJECTED → flow refund như ONLINE/OFFLINE.
 */
export function FastTrackPanel({
  certId,
  govCertNumber,
  govCertIssuer,
  govCertIssuedAt,
  documentUrls,
}: Props) {
  const router = useRouter()
  const readOnly = useAdminReadOnly()
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const issuedAtStr = govCertIssuedAt
    ? new Date(govCertIssuedAt).toLocaleDateString("vi-VN")
    : "—"

  async function handleApprove() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/certifications/${certId}/approve-fast-track`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewNote: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra")
        return
      }
      router.refresh()
    } catch {
      setError("Có lỗi xảy ra. Vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    if (note.trim().length < 10) {
      setError("Lý do từ chối tối thiểu 10 ký tự")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/certifications/${certId}/reject-fast-track`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewNote: note.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra")
        return
      }
      router.refresh()
    } catch {
      setError("Có lỗi xảy ra. Vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-2">
        <span className="text-base">📜</span>
        <div>
          <h2 className="text-base font-bold text-emerald-900">
            Endorse CN nhà nước (Fast-track)
          </h2>
          <p className="text-xs text-emerald-700 mt-0.5">
            Single-admin action — không qua HĐTĐ. Xác minh giấy gốc trước khi
            approve. Hiệu lực <strong>trọn đời</strong>.
          </p>
        </div>
      </div>

      {/* Gov cert info card */}
      <div className="rounded-lg bg-white border border-emerald-200 p-3 space-y-2 text-sm">
        <div>
          <p className="text-xs text-emerald-700">Số/ký hiệu giấy CN</p>
          <p className="font-mono font-medium text-emerald-900">
            {govCertNumber ?? <span className="text-red-600">— (thiếu)</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-emerald-700">Cơ quan cấp</p>
          <p className="font-medium text-emerald-900">
            {govCertIssuer ?? <span className="text-red-600">— (thiếu)</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-emerald-700">Ngày cấp</p>
          <p className="font-medium text-emerald-900">{issuedAtStr}</p>
        </div>
      </div>

      {/* Documents preview */}
      {documentUrls.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-emerald-900">
            Ảnh giấy gốc đính kèm ({documentUrls.length})
          </p>
          <div className="grid grid-cols-3 gap-2">
            {documentUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Tài liệu ${i + 1}`}
                  className="w-full aspect-square rounded-md border border-emerald-200 object-cover hover:opacity-80 transition-opacity"
                />
              </a>
            ))}
          </div>
          <p className="text-[11px] text-emerald-700 italic">
            Click ảnh để mở full size & verify chi tiết.
          </p>
        </div>
      )}

      {/* Action buttons / reason form */}
      {mode === "idle" && (
        <div className="flex gap-2">
          <button
            onClick={() => setMode("approve")}
            disabled={readOnly || !govCertNumber || !govCertIssuer}
            title={
              readOnly
                ? READ_ONLY_TOOLTIP
                : !govCertNumber || !govCertIssuer
                  ? "Thiếu thông tin CN nhà nước — không thể endorse"
                  : undefined
            }
            className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
          >
            ✓ Endorse & cấp chứng nhận trọn đời
          </button>
          <button
            onClick={() => setMode("reject")}
            disabled={readOnly}
            title={readOnly ? READ_ONLY_TOOLTIP : undefined}
            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            ✗ Từ chối + hoàn phí
          </button>
        </div>
      )}

      {mode === "approve" && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-emerald-900">
            Ghi chú (tuỳ chọn — hiển thị trong audit log)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder='VD: "Đã xác minh trên cổng thông tin Sở NN&PTNT Khánh Hoà ngày 19/05/2026."'
            className="w-full rounded-lg border border-emerald-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("idle"); setNote(""); setError("") }}
              disabled={loading}
              className="flex-1 rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-50"
            >
              Huỷ
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {loading ? "Đang xử lý..." : "Xác nhận endorse"}
            </button>
          </div>
        </div>
      )}

      {mode === "reject" && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-red-700">
            Lý do từ chối <span className="text-red-500">*</span> (tối thiểu 10 ký tự)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="VD: Giấy CN nhà nước đã hết hiệu lực ngày .../...
Giấy CN không khớp với SP đăng tải.
Không liên hệ được cơ quan cấp để xác minh."
            className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-red-700">
            {note.trim().length}/10 ký tự tối thiểu
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("idle"); setNote(""); setError("") }}
              disabled={loading}
              className="flex-1 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              Huỷ
            </button>
            <button
              onClick={handleReject}
              disabled={loading || note.trim().length < 10}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Đang xử lý..." : "Xác nhận từ chối"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
