import "server-only"
import { prisma } from "@/lib/prisma"
import type { ReviewVote } from "@prisma/client"
import {
  COUNCIL_SIZE,
  CERT_VALIDITY_YEARS,
} from "@/lib/certification-council-constants"

// Re-export để các server importer cũ không phải đổi import path.
export { COUNCIL_SIZE, CERT_VALIDITY_YEARS }

function addYears(d: Date, years: number): Date {
  const next = new Date(d)
  next.setFullYear(next.getFullYear() + years)
  return next
}

export class CouncilError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export async function assignCouncil(certId: string, reviewerIds: string[]) {
  if (reviewerIds.length !== COUNCIL_SIZE) {
    throw new CouncilError(`Cần chỉ định đúng ${COUNCIL_SIZE} thẩm định viên`)
  }
  if (new Set(reviewerIds).size !== COUNCIL_SIZE) {
    throw new CouncilError("Không được trùng thẩm định viên")
  }

  return prisma.$transaction(async (tx) => {
    const cert = await tx.certification.findUnique({ where: { id: certId } })
    if (!cert) throw new CouncilError("Không tìm thấy đơn", 404)
    if (cert.status !== "PENDING") {
      throw new CouncilError("Chỉ chỉ định hội đồng khi đơn ở trạng thái PENDING")
    }
    if (cert.reviewMode === "FAST_TRACK") {
      throw new CouncilError(
        "Đơn FAST_TRACK không qua HĐTĐ — dùng API approve/reject trực tiếp",
      )
    }
    if (reviewerIds.includes(cert.applicantId)) {
      throw new CouncilError("Người nộp đơn không thể tham gia hội đồng thẩm định chính đơn của mình")
    }

    const reviewers = await tx.user.findMany({
      where: { id: { in: reviewerIds }, isCouncilMember: true },
      select: { id: true },
    })
    if (reviewers.length !== COUNCIL_SIZE) {
      throw new CouncilError("Một số thẩm định viên không hợp lệ (phải là thành viên hội đồng)")
    }

    await tx.certificationReview.createMany({
      data: reviewerIds.map((reviewerId) => ({
        certificationId: certId,
        reviewerId,
        vote: "PENDING" as const,
      })),
    })

    await tx.certification.update({
      where: { id: certId },
      data: { status: "UNDER_REVIEW" },
    })
  })
}

/**
 * Đổi thành viên hội đồng cho đơn đang UNDER_REVIEW.
 * Chỉ được đổi reviewer đang có vote `PENDING` (chưa vote). Đã APPROVE/REJECT
 * thì coi như ý kiến đã ghi nhận, không thay được nữa — bảo toàn tính minh bạch.
 */
export async function replaceReviewer(
  certId: string,
  oldReviewerId: string,
  newReviewerId: string,
) {
  if (oldReviewerId === newReviewerId) {
    throw new CouncilError("Người mới phải khác người cũ")
  }

  return prisma.$transaction(async (tx) => {
    const cert = await tx.certification.findUnique({
      where: { id: certId },
      include: { reviews: true },
    })
    if (!cert) throw new CouncilError("Không tìm thấy đơn", 404)
    if (cert.status !== "UNDER_REVIEW") {
      throw new CouncilError("Chỉ đổi thành viên khi đơn còn trong quá trình thẩm định")
    }
    if (newReviewerId === cert.applicantId) {
      throw new CouncilError("Người nộp đơn không thể tham gia hội đồng thẩm định chính đơn của mình")
    }

    const oldReview = cert.reviews.find((r) => r.reviewerId === oldReviewerId)
    if (!oldReview) {
      throw new CouncilError("Không tìm thấy thành viên cần đổi trong hội đồng đơn này", 404)
    }
    if (oldReview.vote !== "PENDING") {
      throw new CouncilError("Không thể đổi thành viên đã vote — chỉ đổi được người chưa vote")
    }

    if (cert.reviews.some((r) => r.reviewerId === newReviewerId)) {
      throw new CouncilError("Người mới đã có trong hội đồng đơn này")
    }

    const newUser = await tx.user.findFirst({
      where: { id: newReviewerId, isCouncilMember: true },
      select: { id: true },
    })
    if (!newUser) {
      throw new CouncilError("Người mới không phải thành viên hội đồng thẩm định")
    }

    // Update record cũ thay vì delete + create — giữ createdAt để audit. Reset
    // votedAt và comment vì đây là người mới.
    await tx.certificationReview.update({
      where: { id: oldReview.id },
      data: {
        reviewerId: newReviewerId,
        vote: "PENDING",
        comment: null,
        votedAt: null,
      },
    })
  })
}

type VoteResult =
  | { finalDecision: null }
  | { finalDecision: "REJECTED" }
  | { finalDecision: "APPROVED"; certCode: string }

/**
 * Approve FAST_TRACK — admin endorse dựa trên CN nhà nước đã đính kèm.
 * Không cần HĐTĐ, single-admin action. certExpiredAt = null = TRỌN ĐỜI.
 * Sinh certCode tuần tự như flow vote bình thường.
 */
export async function approveFastTrack(
  certId: string,
  adminUserId: string,
  reviewNote?: string,
): Promise<{ certCode: string }> {
  return prisma.$transaction(async (tx) => {
    const cert = await tx.certification.findUnique({ where: { id: certId } })
    if (!cert) throw new CouncilError("Không tìm thấy đơn", 404)
    if (cert.reviewMode !== "FAST_TRACK") {
      throw new CouncilError(
        "Chỉ approve trực tiếp đơn FAST_TRACK — đơn ONLINE/OFFLINE phải qua HĐTĐ",
      )
    }
    if (cert.status !== "PENDING") {
      throw new CouncilError("Chỉ approve đơn đang ở trạng thái PENDING")
    }
    if (!cert.govCertNumber || !cert.govCertIssuer) {
      throw new CouncilError(
        "Đơn FAST_TRACK thiếu thông tin CN nhà nước — không thể endorse",
      )
    }

    const now = new Date()
    const year = now.getFullYear()
    const approvedCount = await tx.certification.count({
      where: { status: "APPROVED", approvedAt: { gte: new Date(`${year}-01-01`) } },
    })
    const certCode = `HTHVN-${year}-${String(approvedCount + 1).padStart(4, "0")}`

    await tx.certification.update({
      where: { id: certId },
      data: {
        status: "APPROVED",
        approvedAt: now,
        reviewedAt: now,
        reviewedBy: adminUserId,
        reviewNote: reviewNote?.trim() || null,
        certCode,
      },
    })
    await tx.product.update({
      where: { id: cert.productId },
      data: {
        certStatus: "APPROVED",
        certApprovedAt: now,
        // TRỌN ĐỜI — null = không expire. Verify page + product detail
        // dùng null check để hiển thị "Trọn đời" thay vì ngày hết hạn.
        certExpiredAt: null,
        badgeUrl: "/badge-chung-nhan.png",
      },
    })
    return { certCode }
  })
}

/**
 * Reject FAST_TRACK — admin từ chối endorse (vd giấy gốc giả mạo, hết hiệu lực,
 * không đúng SP). Đơn → REJECTED → flow refund như ONLINE/OFFLINE.
 */
export async function rejectFastTrack(
  certId: string,
  adminUserId: string,
  reviewNote: string,
): Promise<void> {
  const trimmedNote = reviewNote.trim()
  if (!trimmedNote) {
    throw new CouncilError("Bắt buộc ghi lý do khi từ chối endorse FAST_TRACK")
  }

  await prisma.$transaction(async (tx) => {
    const cert = await tx.certification.findUnique({ where: { id: certId } })
    if (!cert) throw new CouncilError("Không tìm thấy đơn", 404)
    if (cert.reviewMode !== "FAST_TRACK") {
      throw new CouncilError(
        "Chỉ reject trực tiếp đơn FAST_TRACK — đơn ONLINE/OFFLINE phải qua HĐTĐ",
      )
    }
    if (cert.status !== "PENDING") {
      throw new CouncilError("Chỉ reject đơn đang ở trạng thái PENDING")
    }

    const now = new Date()
    await tx.certification.update({
      where: { id: certId },
      data: {
        status: "REJECTED",
        rejectedAt: now,
        reviewedAt: now,
        reviewedBy: adminUserId,
        reviewNote: trimmedNote,
      },
    })
    await tx.product.update({
      where: { id: cert.productId },
      data: { certStatus: "REJECTED" },
    })
  })
}

export async function castVote(
  certId: string,
  reviewerId: string,
  vote: ReviewVote,
  comment: string,
): Promise<VoteResult> {
  if (vote !== "APPROVE" && vote !== "REJECT") {
    throw new CouncilError("Vote phải là APPROVE hoặc REJECT")
  }
  const trimmedComment = comment.trim()
  if (!trimmedComment) {
    throw new CouncilError("Bắt buộc phải để lại nhận xét khi vote")
  }

  return prisma.$transaction(async (tx) => {
    const cert = await tx.certification.findUnique({
      where: { id: certId },
      include: { reviews: true },
    })
    if (!cert) throw new CouncilError("Không tìm thấy đơn", 404)
    if (cert.status !== "UNDER_REVIEW") {
      throw new CouncilError("Đơn không còn trong quá trình thẩm định")
    }

    const myReview = cert.reviews.find((r) => r.reviewerId === reviewerId)
    if (!myReview) {
      throw new CouncilError("Bạn không phải thành viên hội đồng thẩm định đơn này", 403)
    }
    // Cho phép đổi vote khi đơn còn UNDER_REVIEW (chưa đủ 5 APPROVE và chưa
    // có REJECT nào kích veto). Khi đơn chuyển APPROVED/REJECTED thì check
    // `cert.status !== "UNDER_REVIEW"` ở trên đã chặn.

    const now = new Date()

    await tx.certificationReview.update({
      where: { id: myReview.id },
      data: { vote, comment: trimmedComment, votedAt: now },
    })

    // Defer veto: chỉ chốt quyết định khi đủ 5 phiếu — tránh tình huống
    // bất cẩn click REJECT làm khóa luôn cả đơn (KH yêu cầu 2026-04-29).
    // Trong lúc còn PENDING, mọi reviewer được phép đổi vote tự do.
    const updatedReviews = cert.reviews.map((r) =>
      r.id === myReview.id ? { ...r, vote } : r,
    )
    const allVoted =
      updatedReviews.length === COUNCIL_SIZE &&
      updatedReviews.every((r) => r.vote !== "PENDING")

    if (!allVoted) {
      return { finalDecision: null }
    }

    // Đủ 5 phiếu → chốt: 1 REJECT = veto → REJECTED; 5/5 APPROVE → APPROVED.
    const hasReject = updatedReviews.some((r) => r.vote === "REJECT")

    if (hasReject) {
      const rejectVotes = updatedReviews.filter((r) => r.vote === "REJECT")
      const reviewNote = `Bị phủ quyết bởi hội đồng (${rejectVotes.length}/5 REJECT).`
      await tx.certification.update({
        where: { id: certId },
        data: {
          status: "REJECTED",
          rejectedAt: now,
          reviewedAt: now,
          reviewedBy: reviewerId,
          reviewNote,
        },
      })
      await tx.product.update({
        where: { id: cert.productId },
        data: { certStatus: "REJECTED" },
      })
      return { finalDecision: "REJECTED" }
    }

    // 5/5 APPROVE → APPROVED + generate certCode
    const year = now.getFullYear()
    const approvedCount = await tx.certification.count({
      where: { status: "APPROVED", approvedAt: { gte: new Date(`${year}-01-01`) } },
    })
    const certCode = `HTHVN-${year}-${String(approvedCount + 1).padStart(4, "0")}`

    await tx.certification.update({
      where: { id: certId },
      data: {
        status: "APPROVED",
        approvedAt: now,
        reviewedAt: now,
        reviewedBy: reviewerId,
        certCode,
      },
    })
    await tx.product.update({
      where: { id: cert.productId },
      data: {
        certStatus: "APPROVED",
        certApprovedAt: now,
        certExpiredAt: addYears(now, CERT_VALIDITY_YEARS),
        badgeUrl: "/badge-chung-nhan.png",
      },
    })
    return { finalDecision: "APPROVED", certCode }
  })
}
