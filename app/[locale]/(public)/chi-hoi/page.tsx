import Link from "next/link"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"

export const revalidate = 600

const getChiHoiUnits = unstable_cache(
  () =>
    prisma.affiliatedUnit.findMany({
      where: { type: "CHI_HOI", isActive: true },
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
  ["chi-hoi_units"],
  { revalidate: 600, tags: ["affiliated-units"] },
)

function InitialsAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase()
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-700 text-lg font-bold text-white">
      {initials}
    </div>
  )
}

export async function generateMetadata() {
  const t = await getTranslations("chiHoi")
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { canonical: "/chi-hoi" },
  }
}

export default async function ChiHoiPage() {
  const [units, t, locale] = await Promise.all([
    getChiHoiUnits(),
    getTranslations("chiHoi"),
    getLocale() as Promise<Locale>,
  ])

  const l = <T extends Record<string, unknown>>(record: T, field: string) =>
    (localize(record, field, locale) as string | null) ?? null

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">{t("pageTitle")}</h1>
        <p className="mt-2 text-sm text-brand-500">{t("subtitle")}</p>
      </div>

      {units.length === 0 ? (
        <p className="text-center text-brand-400 italic">{t("emptyState")}</p>
      ) : (
        <div className="space-y-14">
          {units.map((unit) => {
            const unitName = l(unit, "name") ?? unit.name
            const unitDesc = l(unit, "description")
            return (
              <section key={unit.id}>
                <header className="mb-6 text-center">
                  <h2 className="text-xl font-bold text-brand-900 sm:text-2xl">{unitName}</h2>
                  {unitDesc && <p className="mt-1 text-sm text-brand-500">{unitDesc}</p>}
                </header>

                {unit.members.length === 0 ? (
                  <p className="text-center text-sm text-brand-400 italic">
                    {t("noMembersYet")}
                  </p>
                ) : (
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

      <div className="mt-14 text-center">
        <Link
          href="/gioi-thieu-v2"
          className="inline-flex items-center text-sm font-medium text-brand-700 hover:text-brand-900 transition-colors"
        >
          {t("backToAbout")}
        </Link>
      </div>
    </div>
  )
}
