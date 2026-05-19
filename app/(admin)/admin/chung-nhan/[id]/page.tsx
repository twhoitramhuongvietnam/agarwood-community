import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import DOMPurify from "isomorphic-dompurify"
import { CertActionPanel } from "./CertActionPanel"
import { AssignCouncilForm } from "./AssignCouncilForm"
import { ReviewProgress } from "./ReviewProgress"
import { FastTrackPanel } from "./FastTrackPanel"

type Props = { params: Promise<{ id: string }> }

export default async function CertReviewPage({ params }: Props) {
  const { id } = await params
  await auth() // ensure session context

  const cert = await prisma.certification.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          company: {
            select: {
              name: true,
              owner: {
                select: {
                  name: true,
                  email: true,
                  bankAccountName: true,
                  bankAccountNumber: true,
                  bankName: true,
                },
              },
            },
          },
        },
      },
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
          bankAccountName: true,
          bankAccountNumber: true,
          bankName: true,
        },
      },
      reviews: {
        orderBy: { createdAt: "asc" },
        include: {
          reviewer: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  if (!cert) notFound()

  // FAST_TRACK đơn không qua HĐTĐ → không cần candidates. Chỉ ONLINE/OFFLINE
  // mới load list thẩm định viên.
  const isFastTrack = cert.reviewMode === "FAST_TRACK"

  // Load candidate council members:
  //  - PENDING + chưa có reviews: dùng cho AssignCouncilForm (chỉ định lần đầu).
  //  - UNDER_REVIEW: dùng cho ReplaceReviewerButton (đổi reviewer chưa vote) — loại
  //    bỏ 5 reviewer hiện tại để admin chỉ thấy người khả dụng.
  const needsCandidates =
    !isFastTrack &&
    ((cert.status === "PENDING" && cert.reviews.length === 0) ||
      cert.status === "UNDER_REVIEW")
  const excludedIds = [cert.applicantId, ...cert.reviews.map((r) => r.reviewer.id)]
  const candidates = needsCandidates
    ? await prisma.user.findMany({
        where: {
          isCouncilMember: true,
          id: { notIn: excludedIds },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      })
    : []

  return (
    <div className="space-y-6">
      {/* Back + Heading */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/chung-nhan"
          className="text-brand-600 hover:text-brand-800 text-sm"
        >
          &larr; Danh sách chứng nhận
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-brand-900">
        Xét duyệt: {cert.product.name}
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left Column — 60% */}
        <div className="lg:col-span-3 space-y-6">
          {/* Product info */}
          <section className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-brand-900">
              Thông tin sản phẩm
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Tên sản phẩm</p>
                <p className="font-medium text-brand-900">{cert.product.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Danh mục</p>
                <p className="font-medium text-brand-900">
                  {cert.product.category ?? "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Mô tả</p>
                {cert.product.description ? (
                  // Description lưu HTML (từ RichTextEditor) — render qua prose
                  // + sanitize. Trước đây render plain text với whitespace-pre-wrap
                  // làm các tag <p>/<h2>/... lộ raw ra admin UI.
                  <div
                    className="prose prose-sm prose-brand max-w-none text-brand-800"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(cert.product.description),
                    }}
                  />
                ) : (
                  <p className="text-brand-400 italic">—</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Doanh nghiệp</p>
                <p className="font-medium text-brand-900">
                  {cert.product.company?.name ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Phương thức thẩm định
                </p>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${
                    cert.reviewMode === "ONLINE"
                      ? "bg-blue-100 text-blue-700"
                      : cert.reviewMode === "OFFLINE"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {cert.reviewMode === "ONLINE"
                    ? "Online (HĐTĐ — 1 năm)"
                    : cert.reviewMode === "OFFLINE"
                      ? "Offline (HĐTĐ — 1 năm)"
                      : "Fast-track (Endorse CN nhà nước — trọn đời)"}
                </span>
              </div>
              {cert.reviewMode === "ONLINE" && cert.productSalePrice != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Giá bán khai báo</p>
                  <p className="font-medium text-brand-900">
                    {cert.productSalePrice.toLocaleString("vi-VN")}đ
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Phí thẩm định</p>
                <p className="font-medium text-brand-900">
                  {cert.feePaid.toLocaleString("vi-VN")}đ
                </p>
              </div>
            </div>
          </section>

          {/* Documents */}
          {cert.documentUrls.length > 0 && (
            <section className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-brand-900">
                Tài liệu đính kèm
              </h2>
              <ul className="space-y-2">
                {cert.documentUrls.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-800 underline"
                    >
                      <span>📄</span>
                      <span>Tài liệu {i + 1}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Applicant info */}
          <section className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-brand-900">
              Thông tin người nộp đơn
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Họ tên</p>
                <p className="font-medium">{cert.applicant.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{cert.applicant.email}</p>
              </div>
            </div>
            {cert.applicantNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Ghi chú từ hội viên
                </p>
                <p className="rounded-lg bg-brand-50 p-3 text-sm whitespace-pre-wrap">
                  {cert.applicantNote}
                </p>
              </div>
            )}
          </section>

          {/* Refund bank info */}
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-amber-900">
              Thông tin hoàn tiền (khi từ chối)
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-amber-700">Ngân hàng</p>
                <p className="font-medium text-amber-900">
                  {cert.refundBankName ?? cert.applicant.bankName ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-amber-700">Chủ tài khoản</p>
                <p className="font-medium text-amber-900">
                  {cert.refundAccountName ??
                    cert.applicant.bankAccountName ??
                    "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-amber-700">Số tài khoản</p>
                <p className="font-mono font-medium text-amber-900">
                  {cert.refundAccountNo ??
                    cert.applicant.bankAccountNumber ??
                    "—"}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column — 40% */}
        <div className="lg:col-span-2 space-y-4">
          {/* FAST_TRACK + PENDING: single-admin endorse panel (không qua HĐTĐ) */}
          {isFastTrack && cert.status === "PENDING" && (
            <FastTrackPanel
              certId={cert.id}
              govCertNumber={cert.govCertNumber}
              govCertIssuer={cert.govCertIssuer}
              govCertIssuedAt={cert.govCertIssuedAt}
              documentUrls={cert.documentUrls}
            />
          )}

          {/* FAST_TRACK + APPROVED: hiện summary endorsement (không có vote list) */}
          {isFastTrack && cert.status === "APPROVED" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 shadow-sm space-y-2">
              <h2 className="text-base font-bold text-emerald-900">
                ✓ Đã endorse trọn đời
              </h2>
              <p className="text-sm text-emerald-800">
                Mã: <strong className="font-mono">{cert.certCode}</strong>
              </p>
              {cert.approvedAt && (
                <p className="text-xs text-emerald-700">
                  Cấp ngày {new Date(cert.approvedAt).toLocaleString("vi-VN")}
                </p>
              )}
              {cert.reviewNote && (
                <div className="pt-2 border-t border-emerald-200">
                  <p className="text-xs font-medium text-emerald-700">Ghi chú admin</p>
                  <p className="text-sm text-emerald-900 whitespace-pre-wrap">
                    {cert.reviewNote}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ONLINE/OFFLINE: HĐTĐ flow */}
          {/* PENDING + chưa chỉ định: hiển thị form chỉ định hội đồng */}
          {!isFastTrack &&
            cert.status === "PENDING" &&
            cert.reviews.length === 0 && (
              <AssignCouncilForm certId={cert.id} candidates={candidates} />
            )}

          {/* UNDER_REVIEW / APPROVED / REJECTED: tiến độ vote + nhận xét */}
          {!isFastTrack && cert.reviews.length > 0 && (
            <ReviewProgress
              certId={cert.id}
              status={cert.status}
              reviews={cert.reviews}
              certCode={cert.certCode}
              approvedAt={cert.approvedAt}
              rejectedAt={cert.rejectedAt}
              candidates={candidates}
            />
          )}

          {/* Refund flow chỉ hiện khi REJECTED/REFUNDED */}
          {(cert.status === "REJECTED" || cert.status === "REFUNDED") && (
            <CertActionPanel
              certId={cert.id}
              status={cert.status}
              approvedAt={cert.approvedAt}
              rejectedAt={cert.rejectedAt}
              refundBankName={
                cert.refundBankName ?? cert.applicant.bankName ?? null
              }
              refundAccountName={
                cert.refundAccountName ??
                cert.applicant.bankAccountName ??
                null
              }
              refundAccountNo={
                cert.refundAccountNo ??
                cert.applicant.bankAccountNumber ??
                null
              }
              refundedAt={cert.refundedAt}
            />
          )}
        </div>
      </div>
    </div>
  )
}
