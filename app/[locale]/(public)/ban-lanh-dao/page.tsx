import Link from "next/link"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"
import { LeaderSectionGrid, type LeaderCardData, type LeaderSection } from "./LeaderSectionGrid"

export const revalidate = 600

function InitialsAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase()
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
      {initials}
    </div>
  )
}

/** Ban chuyên môn trực thuộc (AffiliatedUnit type=BAN) — không gắn nhiệm kỳ
 *  BCH nên hiển thị cố định bên dưới, không lọc theo `term`. */
const getBanTrucThuoc = unstable_cache(
  () =>
    prisma.affiliatedUnit.findMany({
      where: { type: "BAN", isActive: true },
      orderBy: [{ sortOrder: "asc" }],
      select: {
        id: true,
        name: true, name_en: true, name_zh: true, name_ar: true,
        description: true, description_en: true, description_zh: true, description_ar: true,
        members: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true, name_en: true, name_zh: true, name_ar: true,
            title: true, title_en: true, title_zh: true, title_ar: true,
          },
        },
      },
    }),
  ["ban-lanh-dao_ban-truc-thuoc"],
  { revalidate: 600, tags: ["affiliated-units"] },
)

/** Leaders thay đổi chậm (admin CRUD), cache 10 phút. */
const getAllActiveLeaders = unstable_cache(
  () =>
    prisma.leader.findMany({
      where: { isActive: true },
      orderBy: [{ term: "desc" }, { category: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true, name_en: true, name_zh: true, name_ar: true,
        honorific: true, honorific_en: true, honorific_zh: true, honorific_ar: true,
        title: true, title_en: true, title_zh: true, title_ar: true,
        workTitle: true, workTitle_en: true, workTitle_zh: true, workTitle_ar: true,
        bio: true, bio_en: true, bio_zh: true, bio_ar: true,
        photoUrl: true,
        category: true,
        term: true,
      },
    }),
  ["ban-lanh-dao_leaders"],
  { revalidate: 600, tags: ["leaders"] },
)

export async function generateMetadata() {
  const t = await getTranslations("leadership")
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { canonical: "/ban-lanh-dao" },
  }
}

export default async function LeadershipPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>
}) {
  const [params, t, locale] = await Promise.all([
    searchParams,
    getTranslations("leadership"),
    getLocale() as Promise<Locale>,
  ])

  const [allLeaders, banTrucThuoc] = await Promise.all([
    getAllActiveLeaders(),
    getBanTrucThuoc(),
  ])

  const terms = [...new Set(allLeaders.map((l) => l.term))]
  const selectedTerm = params.term ?? terms[0] ?? null

  const l = <T extends Record<string, unknown>>(record: T, field: string) =>
    localize(record, field, locale) as string | null

  const leaders: LeaderCardData[] = (selectedTerm
    ? allLeaders.filter((leader) => leader.term === selectedTerm)
    : []
  ).map((leader) => ({
    id: leader.id,
    name: l(leader, "name") ?? leader.name,
    honorific: l(leader, "honorific"),
    title: l(leader, "title") ?? leader.title,
    workTitle: l(leader, "workTitle"),
    bio: l(leader, "bio"),
    photoUrl: leader.photoUrl,
    term: leader.term,
    category: leader.category as "BTV" | "BCH" | "BKT" | "HDTD",
  }))

  const sections: LeaderSection[] = [
    { category: "BTV", label: t("btvLabel"), description: t("btvDesc"), members: leaders.filter((x) => x.category === "BTV") },
    { category: "BKT", label: t("bktLabel"), description: t("bktDesc"), members: leaders.filter((x) => x.category === "BKT") },
    { category: "HDTD", label: t("hdtdLabel"), description: t("hdtdDesc"), members: leaders.filter((x) => x.category === "HDTD") },
    { category: "BCH", label: t("bchLabel"), description: t("bchDesc"), members: leaders.filter((x) => x.category === "BCH") },
  ]

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div>
          {/* Term selector */}
          {terms.length > 1 && (
            <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
              {terms.map((term) => (
                <Link
                  key={term}
                  href={`/ban-lanh-dao?term=${encodeURIComponent(term)}`}
                  className={cn(
                    "rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors",
                    term === selectedTerm
                      ? "border-brand-500 bg-brand-700 text-white"
                      : "border-brand-200 bg-white text-brand-700 hover:bg-brand-50",
                  )}
                >
                  {term}
                </Link>
              ))}
            </div>
          )}

          {selectedTerm && (
            <p className="text-center text-sm text-brand-500 mb-10">
              {selectedTerm} — {t("memberCount", { count: leaders.length })}
            </p>
          )}

          <LeaderSectionGrid sections={sections} />

          {/* Ban chuyên môn trực thuộc — cố định, không theo nhiệm kỳ BCH */}
          {banTrucThuoc.length > 0 && (
            <div className="mt-14 space-y-14">
              {banTrucThuoc.map((unit) => {
                const unitName = l(unit, "name") ?? unit.name
                const unitDesc = l(unit, "description")
                return (
                  <section key={unit.id}>
                    <header className="mb-6 text-center">
                      <h2 className="text-xl font-bold text-brand-900 sm:text-2xl">
                        {unitName}
                      </h2>
                      <p className="mt-1 text-sm text-brand-500">
                        {unitDesc || t("banTrucThuocDesc")}
                      </p>
                    </header>
                    {unit.members.length > 0 && (
                      <div className="grid gap-6 max-w-5xl mx-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {unit.members.map((member) => {
                          const memberName = l(member, "name") ?? member.name
                          const memberTitle = l(member, "title") ?? member.title
                          return (
                            <div
                              key={member.id}
                              className="flex items-center gap-4 rounded-xl border border-brand-200 bg-white p-4 shadow-sm"
                            >
                              <InitialsAvatar name={memberName} />
                              <div className="min-w-0">
                                <h3 className="font-bold text-brand-900 text-sm truncate">
                                  {memberName}
                                </h3>
                                <p className="mt-0.5 text-xs font-medium text-amber-700">
                                  {memberTitle}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}

          {/* Back link */}
          <div className="mt-10 text-center">
            <Link
              href="/gioi-thieu-v2"
              className="inline-flex items-center text-sm font-medium text-brand-700 hover:text-brand-900 transition-colors"
            >
              {t("backToAbout")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
