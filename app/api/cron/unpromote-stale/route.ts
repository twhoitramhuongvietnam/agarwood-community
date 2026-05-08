import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"

/**
 * Cron daily — gỡ promote các bài Post (feed) đã promoted quá 2 ngày.
 *
 * Chạy qua Vercel Cron (vercel.json) — daily-only trên Hobby tier nên thực
 * tế bài có thể promoted tới ~3 ngày (window 2 ngày + 1 lần cron tick).
 * Auth: Bearer token = CRON_SECRET env var (Vercel auto inject header).
 *
 * Logic:
 *   updateMany WHERE promotedAt < now-2days AND promotedAt IS NOT NULL AND
 *     (isPromoted=true OR newsCategories non-empty)
 *   → set isPromoted=false, newsCategories=[], promotedAt=null
 *
 * 2 cơ chế promote song song:
 *   - isPromoted (global) — pin top MemberRail homepage + top feed
 *   - newsCategories[] — bài hiện ở /tin-tuc, /nghien-cuu, etc.
 * Cron clear cả 2 để giải phóng admin khỏi việc gỡ tay.
 *
 * KHÔNG đụng PostPromotionRequest (request log riêng). User vẫn có thể
 * submit request mới sau khi cron unpromote.
 *
 * Trả về: { unpromoted: number, cutoff: ISO, timestamp: ISO }
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

  const result = await prisma.post.updateMany({
    where: {
      promotedAt: { lt: cutoff, not: null },
      OR: [
        { isPromoted: true },
        { newsCategories: { isEmpty: false } },
      ],
    },
    data: {
      isPromoted: false,
      newsCategories: { set: [] },
      promotedAt: null,
    },
  })

  // Bust cache nếu có gỡ — bài bị tụt khỏi top feed/homepage MemberRail và
  // khỏi list pages /tin-tuc, /nghien-cuu, ... (Phase 3.7 round 4 merge
  // Post+News). Cùng tags với promote route.
  if (result.count > 0) {
    revalidateTag("posts", "max")
    revalidateTag("feed", "max")
    revalidateTag("homepage", "max")
    revalidateTag("news", "max")
    revalidatePath("/[locale]", "layout")
    revalidatePath("/[locale]/feed", "page")
    revalidatePath("/[locale]/tin-tuc", "page")
    revalidatePath("/[locale]/nghien-cuu", "page")
    revalidatePath("/[locale]/khuyen-nong", "page")
    revalidatePath("/[locale]/tin-bao-chi", "page")
  }

  return NextResponse.json({
    unpromoted: result.count,
    cutoff: cutoff.toISOString(),
    timestamp: now.toISOString(),
  })
}
