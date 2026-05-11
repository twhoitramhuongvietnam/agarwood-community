import Image from "next/image"
import { unstable_cache } from "next/cache"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { getTierThresholds } from "@/lib/tier"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Top contributors — đồng nhất cho mọi viewer, cache 10 phút.
 *  Phase 3.7 round 4: mở rộng role filter sang INFINITE (hội viên cấp cao
 *  nhất bị strict "VIP" filter cũ ẩn khỏi sidebar dù contribution lớn). */
const getTopContributors = unstable_cache(
  () =>
    prisma.user.findMany({
      where: { role: { in: ["VIP", "INFINITE"] }, isActive: true },
      orderBy: { contributionTotal: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        contributionTotal: true,
        accountType: true,
        company: { select: { name: true } },
      },
    }),
  ["feed_top_contributors"],
  { revalidate: 600, tags: ["feed", "users"] },
)

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
}

function tierBadge(
  contribution: number,
  accountType: string,
  bizSilver: number,
  bizGold: number,
  indSilver: number,
  indGold: number,
) {
  const silver = accountType === "INDIVIDUAL" ? indSilver : bizSilver
  const gold = accountType === "INDIVIDUAL" ? indGold : bizGold
  if (contribution >= gold) return { label: "★★★", cls: "bg-yellow-400 text-yellow-900" }
  if (contribution >= silver) return { label: "★★", cls: "bg-brand-300 text-brand-900" }
  return { label: "★", cls: "bg-brand-200 text-brand-800" }
}

export async function TopContributorsCard() {
  const [contributors, tBiz, tInd, t] = await Promise.all([
    getTopContributors(),
    getTierThresholds("BUSINESS"),
    getTierThresholds("INDIVIDUAL"),
    getTranslations("feed"),
  ])
  if (contributors.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-brand-200 p-5">
      <h3 className="font-semibold text-brand-900 text-sm mb-4">
        {t("topContributors")}
      </h3>
      <ul className="space-y-3">
        {contributors.map((c, i) => {
          const badge = tierBadge(
            c.contributionTotal,
            c.accountType,
            tBiz.silver,
            tBiz.gold,
            tInd.silver,
            tInd.gold,
          )
          return (
            <li key={c.id} className="flex items-center gap-3">
              <span className="text-xs font-bold text-brand-400 w-4 text-center">
                {i + 1}
              </span>
              <div className="relative w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center shrink-0 overflow-hidden">
                {c.avatarUrl ? (
                  <Image
                    src={c.avatarUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                ) : (
                  <span className="text-xs font-bold text-brand-700">
                    {getInitials(c.name)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-900 truncate">
                  {c.company ? c.company.name : c.name}
                </p>
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold rounded-full px-1.5 py-0.5",
                  badge.cls,
                )}
              >
                {badge.label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function TopContributorsCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-brand-200 p-5">
      <Skeleton className="h-4 w-32 mb-4" />
      <ul className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="w-4" />
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-6 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  )
}
