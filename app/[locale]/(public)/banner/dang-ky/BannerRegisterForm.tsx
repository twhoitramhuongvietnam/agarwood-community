"use client"

import { useTranslations } from "next-intl"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import type { BannerSlot } from "@prisma/client"
import { cn } from "@/lib/utils"
import { cloudinaryFit } from "@/lib/cloudinary"
import { getSlotShapeConfig, BANNER_SLOT_META } from "@/lib/banner-slots"
import { BannerSlotPicker } from "@/components/features/admin/BannerSlotPicker"

type Step = 1 | 2 | 3 | 4

type QuotaInfo = {
  used: number
  limit: number
  remaining: number
  resetAt: string
  pricePerMonth: number
}

type BankInfo = {
  bankName: string
  accountNumber: string
  accountName: string
  amount: number
  description: string
}

function todayPlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatVnd(n: number): string {
  return n.toLocaleString("vi-VN") + "đ"
}

export function BannerRegisterForm() {
  const t = useTranslations("bannerForm")

  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)

  // Step 1: schedule + slot
  const [startDate, setStartDate] = useState(todayPlusDays(1))
  const [endDate, setEndDate] = useState(todayPlusDays(31))
  const [slot, setSlot] = useState<BannerSlot | null>(null)

  // Step 2: content
  const [imageUrl, setImageUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState("")
  const [targetUrl, setTargetUrl] = useState("https://")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 3: payment
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch quota on mount
  useEffect(() => {
    fetch("/api/banner/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setQuota(data))
      .catch(() => {})
  }, [])

  // Tính số tháng + tổng tiền
  const monthsCount = (() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0
    const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000)
    return Math.max(1, Math.ceil(days / 30))
  })()
  const pricePerMonth = quota?.pricePerMonth ?? 1_000_000
  const totalPrice = monthsCount * pricePerMonth
  const quotaExhausted = quota && quota.limit !== -1 && quota.remaining === 0

  // ─── Step 1 ────────────────────────────────────────────────────────────
  function validateStep1(): string | null {
    if (!slot) return "Vui lòng chọn vị trí hiển thị banner"
    if (!startDate || !endDate) return "Vui lòng chọn ngày bắt đầu và kết thúc"
    if (new Date(endDate) <= new Date(startDate)) return "Ngày kết thúc phải sau ngày bắt đầu"
    if (monthsCount < 1) return "Thời gian tối thiểu 1 tháng"
    if (quotaExhausted) return "Đã đạt quota tháng này — không thể đăng ký thêm"
    return null
  }

  // ─── Step 2 ────────────────────────────────────────────────────────────
  async function handleImageUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "banner")
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      setImageUrl(data.secure_url ?? data.url)
    } catch {
      setError(t("uploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  function validateStep2(): string | null {
    if (!imageUrl) return "Vui lòng tải lên ảnh banner"
    if (!title || title.length < 5) return "Tiêu đề tối thiểu 5 ký tự"
    if (title.length > 100) return "Tiêu đề tối đa 100 ký tự"
    if (!targetUrl.startsWith("https://")) return "Đường dẫn đích phải bắt đầu bằng https://"
    if (targetUrl.length < 12) return "Đường dẫn đích không hợp lệ"
    return null
  }

  // ─── Step 3 → submit ───────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, targetUrl, title, startDate, endDate, slot }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t("genericError"))
        setSubmitting(false)
        return
      }
      setBankInfo(data.bankInfo)
      setStep(4)
    } catch {
      setError(t("genericError"))
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopyDescription() {
    if (!bankInfo) return
    navigator.clipboard.writeText(bankInfo.description)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDone() {
    router.push("/banner/lich-su")
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-brand-200 shadow-sm overflow-hidden">
      {/* Quota chip — informational. PoC mode (limit=-1) hiện count đã dùng
          + ∞ thay vì chỉ "không giới hạn" để user biết hoạt động của mình. */}
      {quota && (
        <div className="border-b border-brand-100 px-6 py-3 bg-brand-50/50 flex items-center justify-between">
          <span className="text-xs text-brand-600">{t("quotaLabel")}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              quota.limit === -1
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : quota.remaining === 0
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-brand-50 text-brand-700 border border-brand-200",
            )}
          >
            {quota.limit === -1
              ? `Đã đăng ${quota.used} · ∞`
              : `Đã dùng ${quota.used}/${quota.limit} mẫu`}
          </span>
        </div>
      )}

      {/* Step indicator */}
      <div className="px-6 pt-6">
        <ol className="flex items-center justify-between text-xs">
          {(["Thời gian", "Nội dung", t("stepPayment"), "Hoàn tất"] as const).map((label, idx) => {
            const stepNum = (idx + 1) as Step
            const active = step === stepNum
            const done = step > stepNum
            return (
              <li key={label} className="flex items-center gap-2 flex-1">
                <span
                  className={cn(
                    "inline-flex w-7 h-7 rounded-full items-center justify-center font-semibold",
                    done && "bg-emerald-600 text-white",
                    active && "bg-brand-700 text-white",
                    !done && !active && "bg-brand-100 text-brand-400",
                  )}
                >
                  {done ? "✓" : stepNum}
                </span>
                <span className={cn("flex-1", active ? "text-brand-900 font-medium" : "text-brand-500")}>
                  {label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="p-6 space-y-5">
        {/* ── Step 1 ── */}
        {step === 1 && (
          <>
            <div>
              <h2 className="text-lg font-bold text-brand-900">{t("step1Title")} hiển thị</h2>
              <p className="text-sm text-brand-500 mt-0.5">
                Banner sẽ hiển thị trên trang chủ trong khoảng thời gian này (tối thiểu 1 tháng).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-800 mb-2">
                {t("positionLabel")} hiển thị
              </label>
              <BannerSlotPicker value={slot} onChange={setSlot} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-800 mb-1">{t("startDate")}</label>
                <input
                  type="date"
                  value={startDate}
                  min={todayPlusDays(0)}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-800 mb-1">{t("endDate")}</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || todayPlusDays(1)}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-brand-600 uppercase tracking-wider">{t("total")}</p>
                <p className="text-2xl font-bold text-brand-900">
                  {monthsCount} tháng × {formatVnd(pricePerMonth)}{t("perMonth")}
                </p>
              </div>
              <p className="text-2xl font-bold text-brand-700">{formatVnd(totalPrice)}</p>
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}
            {quotaExhausted && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                ⚠ Bạn đã đạt quota {quota!.limit} mẫu tháng này. Quota sẽ reset vào{" "}
                <strong>{new Date(quota!.resetAt).toLocaleDateString("vi-VN")}</strong>. Hoặc{" "}
                <Link href="/landing" className="underline font-semibold">
                  nâng cấp Hội viên
                </Link>{" "}
                để tăng quota.
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!!quotaExhausted}
                onClick={() => {
                  const err = validateStep1()
                  if (err) return setError(err)
                  setError(null)
                  setStep(2)
                }}
                className="rounded-lg bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t("next")}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <>
            <div>
              <h2 className="text-lg font-bold text-brand-900">{t("step2Title")}</h2>
              <p className="text-sm text-brand-500 mt-0.5">
                {t("imageRequired")}, nhập tiêu đề và link đích. Hệ thống tự cắt ảnh
                theo trọng tâm cho 3 kích thước hiển thị.
              </p>
            </div>

            {/* Spec guideline */}
            <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-4 space-y-2 text-xs text-brand-700">
              <p className="font-semibold text-brand-900 text-sm">📐 Hướng dẫn kích thước</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  <strong>Khuyến nghị</strong>: ảnh ngang, tỉ lệ <strong>5:1</strong> — kích
                  thước tối ưu <strong>2560×512 px</strong> (≥1280×256)
                </li>
                <li>
                  Định dạng: JPG / PNG / WebP, dung lượng <strong>≤ 2MB</strong>
                </li>
                <li>
                  Hệ thống <strong>tự crop theo trọng tâm</strong> qua Cloudinary AI khi
                  hiển thị ở 3 kích thước responsive (5:1 desktop, 21:9 tablet, 16:9 mobile).
                  Đặt nội dung quan trọng vào <strong>vùng giữa</strong> để tránh bị cắt ở
                  màn hẹp.
                </li>
                <li>Tránh chữ quá nhỏ — tiêu đề trên ảnh nên ≥ 48px ở kích thước gốc.</li>
              </ul>
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-brand-800 mb-2">{t("bannerImageLabel")}</label>
              {imageUrl ? (
                <div className="space-y-3">
                  <div
                    className="relative w-full overflow-hidden rounded-lg border border-brand-200 bg-brand-50"
                    style={{ aspectRatio: "5 / 1" }}
                  >
                    <Image src={imageUrl} alt="Ảnh gốc" fill className="object-cover" sizes="600px" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Xóa ảnh và tải lại
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full rounded-lg border-2 border-dashed border-brand-300 bg-brand-50/50 hover:bg-brand-50 hover:border-brand-400 transition-colors flex flex-col items-center justify-center text-brand-500 disabled:opacity-50"
                  style={{ aspectRatio: "5 / 1" }}
                >
                  {uploading ? (
                    <div className="size-8 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="text-3xl mb-2">📷</span>
                      <span className="text-sm font-medium">Click để tải lên</span>
                      <span className="text-xs text-brand-400 mt-1">
                        Khuyến nghị 2560×512 (tỉ lệ 5:1), ≤ 2MB
                      </span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageUpload(file)
                  e.target.value = ""
                }}
              />
            </div>

            {/* Preview theo aspect của slot đã chọn */}
            {imageUrl && slot && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-brand-900">
                  {t("previewLabel")} hiển thị thực tế ({BANNER_SLOT_META[slot].label})
                </p>
                <BannerPreview imageUrl={imageUrl} slot={slot} />
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-brand-800 mb-1">
                {t("titleLabel")} <span className="text-xs text-brand-500">(5-100 ký tự)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Khuyến mãi 30% trầm hương Khánh Hòa"
                maxLength={100}
                className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm"
              />
              <p className="text-xs text-brand-400 mt-1">{title.length}/100 ký tự</p>
            </div>

            {/* Target URL */}
            <div>
              <label className="block text-sm font-medium text-brand-800 mb-1">
                Đường dẫn đích (https://...)
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com/san-pham/abc"
                className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm font-mono"
              />
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setStep(1)
                }}
                className="rounded-lg border border-brand-300 px-6 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                {t("backBtn")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const err = validateStep2()
                  if (err) return setError(err)
                  setError(null)
                  setStep(3)
                }}
                className="rounded-lg bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800"
              >
                {t("next")}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <>
            <div>
              <h2 className="text-lg font-bold text-brand-900">Xác nhận và thanh toán</h2>
              <p className="text-sm text-brand-500 mt-0.5">
                Vui lòng kiểm tra lại thông tin và thực hiện chuyển khoản.
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-600">{t("positionLabel")}:</span>
                <span className="font-semibold text-brand-900 text-right">
                  {slot ? BANNER_SLOT_META[slot].label : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-600">{t("titleLabel")}:</span>
                <span className="font-semibold text-brand-900 text-right">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-600">Link đích:</span>
                <span className="font-mono text-xs text-brand-700 truncate max-w-xs">{targetUrl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-600">{t("stepTime")}:</span>
                <span className="text-brand-900">
                  {new Date(startDate).toLocaleDateString("vi-VN")} -{" "}
                  {new Date(endDate).toLocaleDateString("vi-VN")} ({monthsCount} tháng)
                </span>
              </div>
              <div className="flex justify-between border-t border-brand-200 pt-3">
                <span className="text-brand-600 font-semibold">Tổng tiền:</span>
                <span className="text-xl font-bold text-brand-700">{formatVnd(totalPrice)}</span>
              </div>
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setStep(2)
                }}
                disabled={submitting}
                className="rounded-lg border border-brand-300 px-6 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                {t("backBtn")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {submitting ? t("processing") : "Xác nhận và lấy mã CK"}
              </button>
            </div>
          </>
        )}

        {/* ── Step 4 ── */}
        {step === 4 && bankInfo && (
          <>
            <div className="text-center">
              <div className="text-5xl mb-2">🏦</div>
              <h2 className="text-lg font-bold text-brand-900">{t("step4Title")} theo thông tin bên dưới</h2>
              <p className="text-sm text-brand-500 mt-0.5">
                Sau khi chuyển khoản, ban quản trị sẽ xác nhận trong vòng 24h.
              </p>
            </div>

            <div className="rounded-xl border-2 border-brand-300 bg-brand-50/30 p-5 space-y-3 text-sm">
              <BankRow label={t("bankLabel")} value={bankInfo.bankName} />
              <BankRow label={t("accountNumber")} value={bankInfo.accountNumber} mono />
              <BankRow label={t("accountHolder")} value={bankInfo.accountName} />
              <BankRow label={t("amountLabel")} value={formatVnd(bankInfo.amount)} highlight />
              <div>
                <p className="text-xs text-brand-600 mb-1">{t("transferDescLabel")} (quan trọng — copy chính xác)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-white border border-brand-200 px-3 py-2 text-sm font-bold text-brand-900">
                    {bankInfo.description}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyDescription}
                    className="rounded-lg bg-brand-700 text-white px-3 py-2 text-xs font-semibold hover:bg-brand-800"
                  >
                    {copied ? t("copied") : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              ⚠ <strong>Lưu ý:</strong> Phải nhập đúng nội dung CK để admin đối chiếu. Banner sẽ chuyển sang
              <strong> chờ duyệt content</strong> sau khi admin xác nhận chuyển khoản.
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleDone}
                className="rounded-lg bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Tôi đã chuyển khoản → Xem lịch sử
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </div>
  )
}

function BankRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-brand-600">{label}:</span>
      <span
        className={cn(
          "text-right",
          mono && "font-mono",
          highlight ? "text-xl font-bold text-brand-700" : "font-semibold text-brand-900",
        )}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Preview banner theo aspect của slot — TOP (970:90), MID (5:1 desktop / 21:9
 * tablet / 16:9 mobile), SIDEBAR (2:3 portrait).
 */
function BannerPreview({ imageUrl, slot }: { imageUrl: string; slot: BannerSlot }) {
  const cfg = getSlotShapeConfig(slot)
  const previews = (() => {
    if (cfg.aspectRatio === 970 / 90) {
      return [{ label: "Leaderboard (970×90)", ar: "970:90", w: 1280 }]
    }
    if (cfg.aspectRatio < 1) {
      return [{ label: "Sidebar dọc (2:3)", ar: "2:3", w: 800 }]
    }
    return [
      { label: "Desktop (≥1024px) — tỉ lệ 5:1", ar: "5:1", w: 1280 },
      { label: "Tablet (640-1023px) — tỉ lệ 21:9", ar: "21:9", w: 720 },
      { label: "Mobile (<640px) — tỉ lệ 16:9", ar: "16:9", w: 480 },
    ]
  })()

  return (
    <div className="space-y-3">
      {previews.map((p) => (
        <div key={p.ar} className="space-y-1">
          <p className="text-xs text-brand-500">{p.label}</p>
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-lg border border-brand-200 bg-brand-100",
              cfg.aspectRatio < 1 ? "max-w-xs" : "",
            )}
            style={{ aspectRatio: p.ar.replace(":", " / ") }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cloudinaryFit(imageUrl, { ar: p.ar, w: p.w })}
              alt={`Preview ${p.label}`}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-brand-500 italic">
        ⓘ Cloudinary AI tự chọn vùng trọng tâm khi cắt — nếu phần quan trọng bị cắt
        (logo / chữ chính), hãy upload lại ảnh có chủ thể nằm ở trung tâm.
      </p>
    </div>
  )
}
