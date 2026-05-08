"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { cloudinaryResize } from "@/lib/cloudinary"
import {
  calcCertFee,
  CERT_FEE_ONLINE_MIN,
  CERT_FEE_ONLINE_MAX,
} from "@/lib/certification-fee"

type BankInfo = {
  bankName: string
  accountNumber: string
  accountName: string
  amount: number
  description: string
}

type Product = {
  id: string
  name: string
  slug: string
  certStatus: string
  certExpiredAt: string | null
  imageUrls: string[]
  // True nếu SP đang có đơn DRAFT/PENDING/UNDER_REVIEW trong bảng
  // Certification. Đây là tín hiệu duy nhất để block không cho user nộp đơn
  // mới — không dùng `certStatus` vì field này default DRAFT cho mọi SP mới
  // tạo (dù chưa có đơn nào).
  hasActiveCert: boolean
}

type ReviewMode = "ONLINE" | "OFFLINE"

type Step1Data = {
  productId: string
  productName: string
}

type Step2Data = {
  applicantNote: string
  reviewMode: ReviewMode
  productSalePrice: string
  bankAccountName: string
  bankAccountNumber: string
  bankName: string
}

type Step2Errors = Partial<Record<keyof Step2Data, string>>

// "Blocked" = đang có đơn DRAFT/PENDING/UNDER_REVIEW thực sự trong bảng
// Certification (dùng `hasActiveCert` từ API). KHÔNG dùng `certStatus` vì
// schema default DRAFT cho mọi SP mới tạo — sẽ false-positive block hết
// cả 11/12 SP mặc dù user chưa nộp đơn nào (bug 2026-05).
// APPROVED không block: user vẫn được nộp đơn gia hạn (renewal). Nếu đang
// có đơn renewal chạy dở thì hasActiveCert=true → block đúng.

const STEP_LABELS = [
  { step: 1, label: "Chọn sản phẩm" },
  { step: 2, label: "Hồ sơ & Tài liệu" },
  { step: 3, label: "Thanh toán" },
]

function formatVND(amount: number) {
  return amount.toLocaleString("vi-VN") + "đ"
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABELS.map((item, i) => (
        <div key={item.step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
                current === item.step
                  ? "bg-brand-700 border-brand-700 text-white"
                  : current > item.step
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-white border-brand-300 text-brand-400"
              )}
            >
              {current > item.step ? "✓" : item.step}
            </div>
            <span
              className={cn(
                "text-xs mt-1 font-medium w-24 text-center",
                current === item.step ? "text-brand-800" : "text-brand-400"
              )}
            >
              {item.label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={cn(
                "w-16 h-0.5 mb-5 mx-1",
                current > item.step ? "bg-green-500" : "bg-brand-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default function NopDonPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const renewProductId = searchParams.get("renew")
  const [currentStep, setCurrentStep] = useState(1)

  // Step 1 state
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [selectedProductId, setSelectedProductId] = useState("")
  // Search + filter + pagination để UI thân thiện khi user có nhiều sản phẩm
  // (1000+). Tất cả filter chạy client-side vì JSON từ /api/my-products đã
  // load 1 lần ở đầu — search 1k items qua includes() đủ instant.
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "renewal" | "review">("all")
  const [visibleCount, setVisibleCount] = useState(20)

  // Pre-select product khi đang gia hạn
  useEffect(() => {
    if (renewProductId && products.some((p) => p.id === renewProductId)) {
      setSelectedProductId(renewProductId)
    }
  }, [renewProductId, products])

  // Step 2 state
  const [applicantNote, setApplicantNote] = useState("")
  const [reviewMode, setReviewMode] = useState<ReviewMode>("ONLINE")
  const [productSalePrice, setProductSalePrice] = useState("")
  const [bankAccountName, setBankAccountName] = useState("")
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [step2Errors, setStep2Errors] = useState<Step2Errors>({})

  const salePriceNum = Number(productSalePrice.replace(/\D/g, "")) || 0
  const estimatedFee = useMemo(
    () => calcCertFee(reviewMode, salePriceNum),
    [reviewMode, salePriceNum],
  )

  // Step 3 state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [certBankInfo, setCertBankInfo] = useState<BankInfo | null>(null)
  const [certDone, setCertDone] = useState(false)

  // Restore from sessionStorage on mount
  useEffect(() => {
    const s1 = sessionStorage.getItem("cert_step1")
    const s2 = sessionStorage.getItem("cert_step2")
    if (s1) {
      const d: Step1Data = JSON.parse(s1)
      setSelectedProductId(d.productId)
    }
    if (s2) {
      const d: Step2Data = JSON.parse(s2)
      setApplicantNote(d.applicantNote)
      setReviewMode(d.reviewMode ?? "ONLINE")
      setProductSalePrice(d.productSalePrice ?? "")
      setBankAccountName(d.bankAccountName)
      setBankAccountNumber(d.bankAccountNumber)
      setBankName(d.bankName)
    }
  }, [])

  // Fetch products
  useEffect(() => {
    fetch("/api/my-products")
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products ?? [])
      })
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false))
  }, [])

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  // Đếm số sản phẩm theo từng status group để hiển thị badge trên filter chip
  const statusCounts = useMemo(() => {
    return products.reduce(
      (acc, p) => {
        if (p.hasActiveCert) acc.review++
        else if (p.certStatus === "APPROVED") acc.renewal++
        else acc.available++
        return acc
      },
      { available: 0, renewal: 0, review: 0 },
    )
  }, [products])

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return products
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q)) return false
        if (statusFilter === "all") return true
        const blocked = p.hasActiveCert
        const approved = p.certStatus === "APPROVED"
        if (statusFilter === "review") return blocked
        if (statusFilter === "renewal") return !blocked && approved
        if (statusFilter === "available") return !blocked && !approved
        return true
      })
      .sort((a, b) => {
        // Selectable (available + renewal) trước, blocked cuối cho user khỏi
        // mất công lướt qua sản phẩm không thể chọn.
        const aBlocked = a.hasActiveCert ? 1 : 0
        const bBlocked = b.hasActiveCert ? 1 : 0
        if (aBlocked !== bBlocked) return aBlocked - bBlocked
        return a.name.localeCompare(b.name, "vi")
      })
  }, [products, searchQuery, statusFilter])

  const visibleProducts = filteredProducts.slice(0, visibleCount)

  // Reset pagination khi filter đổi để user thấy kết quả từ đầu
  useEffect(() => {
    setVisibleCount(20)
  }, [searchQuery, statusFilter])

  function handleStep1Next() {
    if (!selectedProductId) return
    const step1Data: Step1Data = {
      productId: selectedProductId,
      productName: selectedProduct?.name ?? "",
    }
    sessionStorage.setItem("cert_step1", JSON.stringify(step1Data))
    setCurrentStep(2)
  }

  function validateStep2(): boolean {
    const errors: Step2Errors = {}
    if (reviewMode === "ONLINE" && salePriceNum <= 0)
      errors.productSalePrice = "Vui lòng khai báo giá bán sản phẩm (VND)"
    if (!bankAccountName.trim())
      errors.bankAccountName = "Vui lòng nhập tên chủ tài khoản"
    if (!bankAccountNumber.trim())
      errors.bankAccountNumber = "Vui lòng nhập số tài khoản"
    if (!bankName.trim()) errors.bankName = "Vui lòng nhập tên ngân hàng"
    setStep2Errors(errors)
    return Object.keys(errors).length === 0
  }

  function handleStep2Next() {
    if (!validateStep2()) return
    const step2Data: Step2Data = {
      applicantNote,
      reviewMode,
      productSalePrice,
      bankAccountName,
      bankAccountNumber,
      bankName,
    }
    sessionStorage.setItem("cert_step2", JSON.stringify(step2Data))
    setCurrentStep(3)
  }

  async function handleSubmitPayment() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/certification/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          applicantNote,
          reviewMode,
          productSalePrice: reviewMode === "ONLINE" ? salePriceNum : null,
          bankAccountName,
          bankAccountNumber,
          bankName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? "Đã xảy ra lỗi. Vui lòng thử lại.")
        if (data.redirectTo) {
          setTimeout(() => router.push(data.redirectTo), 2000)
        }
        return
      }
      setCertBankInfo(data.bankInfo)
    } catch {
      setSubmitError("Không thể kết nối. Vui lòng thử lại.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <h1 className="text-2xl font-bold text-brand-900 mb-3 text-center">
        {renewProductId ? "Gia hạn chứng nhận sản phẩm" : "Nộp đơn chứng nhận sản phẩm"}
      </h1>

      {renewProductId && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-center text-xs text-amber-900">
          🔄 Bạn đang <strong>gia hạn</strong> — quy trình thẩm định đầy đủ (5 thành viên hội đồng + phí đầy đủ) như nộp mới.
          Chứng nhận cũ giữ hiệu lực đến ngày hết hạn.
        </div>
      )}

      <StepIndicator current={currentStep} />

      {/* STEP 1: Select product */}
      {currentStep === 1 && (
        <div className="bg-white border border-brand-200 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-brand-900">
            Chọn sản phẩm cần chứng nhận
          </h2>

          {productsLoading ? (
            <p className="text-brand-400 text-sm">Đang tải sản phẩm...</p>
          ) : products.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-brand-500 text-sm">
                Bạn chưa có sản phẩm nào. Hãy thêm sản phẩm trước khi nộp đơn.
              </p>
              <Link
                href="/san-pham/tao-moi"
                className="inline-block bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors"
              >
                + Tạo sản phẩm mới
              </Link>
            </div>
          ) : (
            <>
              {/* Sticky banner — giữ "Đã chọn" hiển thị cả khi filter đẩy
                  item ra khỏi list để user không bị mất context. */}
              {selectedProduct && (
                <div className="rounded-lg bg-brand-50 border border-brand-300 p-3 flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-md bg-brand-100 overflow-hidden shrink-0">
                    {selectedProduct.imageUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cloudinaryResize(selectedProduct.imageUrls[0], 100)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-300 text-base font-bold">
                        {selectedProduct.name[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-500">Đã chọn</p>
                    <p className="font-semibold text-brand-900 text-sm truncate">{selectedProduct.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProductId("")}
                    className="text-xs text-brand-600 hover:text-brand-900 underline shrink-0"
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}

              {/* Search + filter chips — chỉ hiện khi >5 SP để UI gọn cho
                  list ngắn (đa số use case ban đầu). */}
              {products.length > 5 && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm sản phẩm theo tên..."
                      className="w-full rounded-lg border border-brand-300 bg-white pl-9 pr-9 py-2 text-sm text-brand-900 placeholder:text-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-brand-400 hover:text-brand-700"
                        aria-label="Xoá tìm kiếm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {[
                      { key: "all" as const, label: "Tất cả", count: products.length },
                      { key: "available" as const, label: "Có thể chứng nhận", count: statusCounts.available },
                      { key: "renewal" as const, label: "Cần gia hạn", count: statusCounts.renewal },
                      { key: "review" as const, label: "Đang xét duyệt", count: statusCounts.review },
                    ].map(({ key, label, count }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(key)}
                        className={cn(
                          "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap",
                          statusFilter === key
                            ? "bg-brand-700 text-white border-brand-700"
                            : "bg-white text-brand-700 border-brand-200 hover:bg-brand-50",
                        )}
                      >
                        {label}
                        <span className={cn(
                          "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
                          statusFilter === key ? "bg-white/20 text-white" : "bg-brand-100 text-brand-600",
                        )}>
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Product list — pagination chunk 20 row để DOM nhẹ kể cả 1000 SP */}
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-sm text-brand-500">
                  Không tìm thấy sản phẩm phù hợp với bộ lọc.
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleProducts.map((product) => {
                    const isBlocked = product.hasActiveCert
                    const isApproved = product.certStatus === "APPROVED"
                    const expiredAt = product.certExpiredAt ? new Date(product.certExpiredAt) : null
                    const daysLeft = expiredAt ? Math.floor((expiredAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null
                    const isRenewal = isApproved && daysLeft !== null
                    const thumb = product.imageUrls[0]
                    return (
                      <label
                        key={product.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                          isBlocked
                            ? "border-brand-200 bg-brand-50 opacity-60 cursor-not-allowed"
                            : selectedProductId === product.id
                            ? "border-brand-600 bg-brand-50 cursor-pointer"
                            : "border-brand-200 bg-white hover:border-brand-400 cursor-pointer"
                        )}
                      >
                        <input
                          type="radio"
                          name="product"
                          value={product.id}
                          disabled={isBlocked}
                          checked={selectedProductId === product.id}
                          onChange={() => setSelectedProductId(product.id)}
                          className="accent-brand-600 shrink-0"
                        />
                        <div className="relative w-12 h-12 rounded-md bg-brand-100 overflow-hidden shrink-0">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cloudinaryResize(thumb, 120)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brand-300 text-lg font-bold">
                              {product.name[0]?.toUpperCase() ?? "?"}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-brand-900 text-sm truncate">
                            {product.name}
                          </p>
                          {isBlocked ? (
                            <p className="text-xs text-brand-500 mt-0.5">
                              Đang trong quá trình xét duyệt
                            </p>
                          ) : isRenewal ? (
                            <p className={cn(
                              "text-xs mt-0.5",
                              daysLeft! <= 0 ? "text-red-600 font-semibold" : daysLeft! <= 60 ? "text-amber-700 font-semibold" : "text-brand-500",
                            )}>
                              {daysLeft! <= 0
                                ? `Đã hết hạn (gia hạn)`
                                : daysLeft! <= 60
                                  ? `Còn ${daysLeft} ngày — nên gia hạn`
                                  : `Hiệu lực đến ${expiredAt!.toLocaleDateString("vi-VN")}`}
                            </p>
                          ) : (
                            <p className="text-xs text-brand-500 mt-0.5">
                              {product.certStatus === "REJECTED"
                                ? "Đơn trước bị từ chối — có thể nộp lại"
                                : product.certStatus === "REFUNDED"
                                  ? "Đã hoàn tiền — có thể nộp lại"
                                  : "Chưa có đơn chứng nhận"}
                            </p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              {filteredProducts.length > 0 && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-brand-500 tabular-nums">
                    Hiển thị {Math.min(visibleCount, filteredProducts.length)} / {filteredProducts.length}
                    {searchQuery || statusFilter !== "all" ? " (đã lọc)" : ""}
                  </p>
                  {filteredProducts.length > visibleCount && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((c) => c + 20)}
                      className="text-xs font-medium text-brand-700 hover:text-brand-900 underline"
                    >
                      Xem thêm ({filteredProducts.length - visibleCount})
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleStep1Next}
              disabled={!selectedProductId}
              className="bg-brand-700 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Tiếp theo →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Documents & info */}
      {currentStep === 2 && (
        <div className="bg-white border border-brand-200 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-brand-900">
            Hồ sơ & Tài liệu
          </h2>

          {/* Applicant note */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-brand-700">
              Ghi chú cho admin
            </label>
            <textarea
              value={applicantNote}
              onChange={(e) => setApplicantNote(e.target.value)}
              rows={4}
              placeholder="Mô tả thêm về sản phẩm, quy trình sản xuất, nguồn gốc..."
              className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm text-brand-900 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Review method */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-brand-700">
              Hình thức thẩm định
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  value: "ONLINE" as const,
                  title: "Online",
                  desc: "Sản phẩm nhỏ, dễ di chuyển, giá trị thấp. Phí = 2% giá bán, tối thiểu 1tr, tối đa 20tr.",
                },
                {
                  value: "OFFLINE" as const,
                  title: "Offline",
                  desc: "Hội đồng thẩm định tại chỗ. Áp dụng cho sản phẩm giá trị cao, khó di chuyển. Phí cố định 200tr (all-inclusive).",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex flex-col gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all",
                    reviewMode === opt.value
                      ? "border-brand-600 bg-brand-50"
                      : "border-brand-200 bg-white hover:border-brand-400",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="reviewMode"
                      checked={reviewMode === opt.value}
                      onChange={() => setReviewMode(opt.value)}
                      className="accent-brand-600"
                    />
                    <span className="text-sm font-semibold text-brand-900">{opt.title}</span>
                  </div>
                  <p className="text-xs text-brand-500 pl-6">{opt.desc}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Sale price (chỉ khi ONLINE) */}
          {reviewMode === "ONLINE" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-brand-700">
                Giá bán sản phẩm (VND) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={productSalePrice ? Number(productSalePrice.replace(/\D/g, "")).toLocaleString("vi-VN") : ""}
                onChange={(e) => setProductSalePrice(e.target.value.replace(/\D/g, ""))}
                placeholder="Ví dụ: 50.000.000"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm text-brand-900 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500",
                  step2Errors.productSalePrice
                    ? "border-red-400 bg-red-50"
                    : "border-brand-300 bg-white",
                )}
              />
              {step2Errors.productSalePrice && (
                <p className="text-xs text-red-600">{step2Errors.productSalePrice}</p>
              )}
              <p className="text-xs text-brand-500">
                Phí thẩm định = 2% giá bán, clamp [{CERT_FEE_ONLINE_MIN.toLocaleString("vi-VN")}đ – {CERT_FEE_ONLINE_MAX.toLocaleString("vi-VN")}đ].
              </p>
            </div>
          )}

          {/* Live fee preview */}
          <div className="rounded-xl bg-linear-to-r from-brand-50 to-amber-50 border border-brand-200 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-brand-600">Phí thẩm định ({reviewMode === "ONLINE" ? "Online" : "Offline"})</p>
              <p className="text-lg font-bold text-brand-900">
                {estimatedFee.toLocaleString("vi-VN")}đ
              </p>
            </div>
            {reviewMode === "OFFLINE" && (
              <span className="text-xs text-brand-500 text-right max-w-48">
                Đã bao gồm chi phí đi lại & sinh hoạt của hội đồng
              </span>
            )}
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-brand-700">
              Tài liệu đính kèm
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="block w-full text-sm text-brand-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-100 file:text-brand-700 file:font-medium hover:file:bg-brand-200 cursor-pointer"
            />
            <p className="text-sm text-brand-500">
              Hỗ trợ: PDF, JPG, PNG (tối đa 10MB mỗi file)
            </p>
          </div>

          {/* Refund bank info */}
          <div className="space-y-3 bg-brand-50 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-base">🏦</span>
              <div>
                <p className="text-sm font-semibold text-brand-800">
                  Thông tin hoàn phí
                </p>
                <p className="text-xs text-brand-500 mt-0.5">
                  Thông tin này dùng để hoàn phí nếu đơn bị từ chối.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-brand-700">
                  Tên chủ tài khoản <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="NGUYEN VAN A"
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-sm text-brand-900 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500",
                    step2Errors.bankAccountName
                      ? "border-red-400 bg-red-50"
                      : "border-brand-300 bg-white"
                  )}
                />
                {step2Errors.bankAccountName && (
                  <p className="text-xs text-red-600">
                    {step2Errors.bankAccountName}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-brand-700">
                  Số tài khoản <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="0123456789"
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-sm text-brand-900 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500",
                    step2Errors.bankAccountNumber
                      ? "border-red-400 bg-red-50"
                      : "border-brand-300 bg-white"
                  )}
                />
                {step2Errors.bankAccountNumber && (
                  <p className="text-xs text-red-600">
                    {step2Errors.bankAccountNumber}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-brand-700">
                  Ngân hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Vietcombank, Techcombank..."
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-sm text-brand-900 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500",
                    step2Errors.bankName
                      ? "border-red-400 bg-red-50"
                      : "border-brand-300 bg-white"
                  )}
                />
                {step2Errors.bankName && (
                  <p className="text-xs text-red-600">{step2Errors.bankName}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setCurrentStep(1)}
              className="text-brand-600 px-4 py-2.5 rounded-lg font-medium hover:bg-brand-50 transition-colors border border-brand-200"
            >
              ← Quay lại
            </button>
            <button
              onClick={handleStep2Next}
              className="bg-brand-700 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-800 transition-colors"
            >
              Tiếp theo →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Payment summary */}
      {currentStep === 3 && (
        <div className="bg-white border border-brand-200 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-brand-900">
            Xác nhận & Thanh toán
          </h2>

          {/* Summary card — only shown before bank info is loaded */}
          {!certBankInfo && !certDone && (
            <>
              <div className="bg-brand-50 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-brand-600">Sản phẩm</span>
                  <span className="font-semibold text-brand-900">
                    {selectedProduct?.name ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-600">Hình thức thẩm định</span>
                  <span className="font-semibold text-brand-900">
                    {reviewMode === "ONLINE" ? "Online" : "Offline"}
                  </span>
                </div>
                {reviewMode === "ONLINE" && salePriceNum > 0 && (
                  <div className="flex justify-between">
                    <span className="text-brand-600">Giá bán khai báo</span>
                    <span className="font-semibold text-brand-900">
                      {salePriceNum.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-brand-600">Tài khoản hoàn phí</span>
                  <span className="font-semibold text-brand-900 text-right max-w-48 truncate">
                    {bankAccountName} — {bankName}
                  </span>
                </div>
                <div className="border-t border-brand-200 pt-3 flex justify-between">
                  <span className="text-brand-700 font-semibold">
                    Phí thẩm định
                  </span>
                  <span className="text-brand-900 font-bold text-lg">
                    {estimatedFee.toLocaleString("vi-VN")} VND
                  </span>
                </div>
              </div>

              <p className="text-xs text-brand-500">
                Sau khi thanh toán thành công, đơn sẽ được ghi nhận và chúng tôi
                sẽ liên hệ với bạn trong 3–5 ngày làm việc. Phí được hoàn lại nếu
                đơn bị từ chối.
              </p>

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-brand-600 px-4 py-2.5 rounded-lg font-medium hover:bg-brand-50 transition-colors border border-brand-200"
                >
                  ← Quay lại
                </button>
                <button
                  onClick={handleSubmitPayment}
                  disabled={submitting}
                  className="bg-brand-700 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? "Đang xử lý..." : "Gửi yêu cầu & Xem hướng dẫn CK"}
                </button>
              </div>
            </>
          )}

          {/* Bank transfer info card */}
          {certBankInfo && !certDone && (
            <div className="bg-white border-2 border-brand-300 rounded-2xl p-6 space-y-5">
              <h3 className="font-semibold text-brand-800">Hướng dẫn chuyển khoản phí xét duyệt</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-brand-200">
                  <span className="text-brand-500">Ngân hàng</span>
                  <span className="font-semibold text-brand-900">{certBankInfo.bankName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-brand-200">
                  <span className="text-brand-500">Số tài khoản</span>
                  <span className="font-semibold text-brand-900 font-mono">{certBankInfo.accountNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-brand-200">
                  <span className="text-brand-500">Chủ tài khoản</span>
                  <span className="font-semibold text-brand-900">{certBankInfo.accountName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-brand-200">
                  <span className="text-brand-500">Số tiền</span>
                  <span className="font-bold text-brand-700 text-base">{formatVND(certBankInfo.amount)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-brand-500">Nội dung CK</span>
                  <span className="font-bold text-brand-900 font-mono bg-brand-50 px-2 py-0.5 rounded">{certBankInfo.description}</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                ⚠️ Nhập đúng nội dung CK. Đơn chứng nhận sẽ được xét duyệt sau khi admin xác nhận thanh toán.
              </div>

              <button
                onClick={() => {
                  sessionStorage.removeItem("cert_step1")
                  sessionStorage.removeItem("cert_step2")
                  setCertDone(true)
                }}
                className="w-full bg-brand-700 text-white rounded-xl py-3 font-semibold hover:bg-brand-800 transition-colors"
              >
                Tôi đã chuyển khoản ✓
              </button>
            </div>
          )}

          {/* Done state */}
          {certDone && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-4">
              <div className="text-5xl">✅</div>
              <h2 className="text-xl font-semibold text-green-800">Đơn đã được ghi nhận!</h2>
              <p className="text-sm text-green-700">Admin sẽ xác nhận thanh toán trong 1–2 ngày làm việc. Sau đó đơn sẽ được đưa vào xét duyệt.</p>
              <Link href="/thanh-toan/lich-su" className="inline-block bg-green-700 text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-green-800 transition-colors">
                Xem lịch sử thanh toán
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
