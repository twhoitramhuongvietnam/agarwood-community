import type { Prisma } from "@prisma/client"
import { prisma } from "./prisma"

const DEFAULT_ROYALTY_VND = 1_000_000
const SITE_CONFIG_KEY = "news_royalty_amount"

/**
 * Đọc số tiền nhuận bút mặc định từ SiteConfig (admin có thể đổi tại
 * /admin/cai-dat). Fallback 1 triệu VND khi chưa cấu hình hoặc giá trị
 * không hợp lệ. Trả về 0 nếu admin set rỗng/0 → tắt tính năng.
 */
async function getRoyaltyAmount(): Promise<number> {
  const row = await prisma.siteConfig.findUnique({
    where: { key: SITE_CONFIG_KEY },
    select: { value: true },
  })
  if (!row) return DEFAULT_ROYALTY_VND
  const n = Number(row.value)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_ROYALTY_VND
  return Math.floor(n)
}

/**
 * Cộng tiền nhuận bút (HonoraryContribution category=OTHER) cho tác giả
 * khi bài tin tức được publish lần đầu. Tự update User.contributionTotal +
 * displayPriority + Post.authorPriority — đồng bộ với logic của
 * `/api/admin/honorary-contributions`.
 *
 * Idempotent qua marker `[news:{id}]` trong reason — nếu bài đã được trả
 * nhuận bút thì skip. Khác với endpoint honorary thông thường, ROYALTY tin
 * tức chấp nhận tác giả role=ADMIN (admin tự đăng bài cũng nhận nhuận bút).
 *
 * KHÔNG gia hạn membershipExpires (extendMonths=0): nhuận bút chỉ tính vào
 * contributionTotal cho tier ranking, không cấp thêm thời gian thành viên.
 *
 * @returns record vừa tạo, hoặc null nếu skip
 */
export async function creditNewsRoyaltyOnPublish(
  tx: Prisma.TransactionClient,
  args: {
    newsId: string
    authorId: string
    title: string
    createdByAdminId: string
  },
) {
  const { newsId, authorId, title, createdByAdminId } = args
  const amount = await getRoyaltyAmount()
  if (amount <= 0) return null

  const reasonTag = `[news:${newsId}]`
  const existing = await tx.honoraryContribution.findFirst({
    where: { reason: { contains: reasonTag } },
    select: { id: true },
  })
  if (existing) return null

  const author = await tx.user.findUnique({
    where: { id: authorId },
    select: {
      id: true,
      contributionTotal: true,
      isActive: true,
    },
  })
  if (!author) return null

  const safeTitle = title.length > 200 ? title.slice(0, 200) + "…" : title
  const reason = `Nhuận bút bài tin tức "${safeTitle}" ${reasonTag}`

  const record = await tx.honoraryContribution.create({
    data: {
      userId: authorId,
      creditAmount: amount,
      reason,
      category: "OTHER",
      extendMonths: 0,
      createdByAdminId,
    },
  })

  const newContrib = author.contributionTotal + amount
  const newPriority = Math.floor(newContrib / 1_000_000)

  await tx.user.update({
    where: { id: authorId },
    data: {
      contributionTotal: newContrib,
      displayPriority: newPriority,
      ...(author.isActive ? {} : { isActive: true }),
    },
  })

  await tx.post.updateMany({
    where: { authorId },
    data: { authorPriority: newPriority },
  })

  return record
}
