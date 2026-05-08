import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"

/**
 * Cron daily — gỡ ghim các bài News đã pin quá 2 ngày.
 *
 * Chạy qua Vercel Cron (vercel.json) — daily-only trên Hobby tier nên thực
 * tế bài có thể được pin tới ~3 ngày (window 2 ngày + 1 lần cron tick).
 * Auth: Bearer token = CRON_SECRET env var (Vercel auto inject header).
 *
 * Logic:
 *   updateMany WHERE pinnedAt < now-2days AND pinnedAt IS NOT NULL AND
 *     (isPinned=true OR pinnedInCategories non-empty)
 *   → set isPinned=false, pinnedInCategories=[], pinnedAt=null
 *
 * 2 cơ chế ghim trong schema (xem prisma/schema.prisma News model):
 *   - isPinned (global) — /tin-tuc hero + Tin Hội + sidebar featured
 *   - pinnedInCategories[] — top section homepage (BUSINESS, RESEARCH, ...)
 * Cron clear cả 2 để giải phóng admin khỏi việc unpin tay.
 *
 * `pinnedAt IS NOT NULL` quan trọng: bài pin TRƯỚC khi feature triển khai
 * (chưa được backfill) có pinnedAt=null → cron skip. Bài đã pin sau khi
 * feature live mới bị auto-unpin.
 *
 * Trả về: { unpinned: number, cutoff: ISO, timestamp: ISO }
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server" },
      { status: 500 },
    )
  }
  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() - 2 * 86_400_000)

  const result = await prisma.news.updateMany({
    where: {
      pinnedAt: { lt: cutoff, not: null },
      OR: [
        { isPinned: true },
        { pinnedInCategories: { isEmpty: false } },
      ],
    },
    data: {
      isPinned: false,
      pinnedInCategories: { set: [] },
      pinnedAt: null,
    },
  })

  // Bust cache nếu có gỡ ghim — pinned bài lên đầu listings, gỡ là xáo trộn
  // thứ tự nên cần invalidate news + tin-tuc + homepage surfaces.
  if (result.count > 0) {
    revalidateTag("news", "max")
    revalidateTag("tin-tuc", "max")
    revalidateTag("homepage", "max")
  }

  return NextResponse.json({
    unpinned: result.count,
    cutoff: cutoff.toISOString(),
    timestamp: now.toISOString(),
  })
}
