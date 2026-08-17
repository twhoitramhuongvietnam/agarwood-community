"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type LeaderCardData = {
  id: string
  name: string
  honorific: string | null
  title: string
  workTitle: string | null
  bio: string | null
  photoUrl: string | null
  term: string
  category: "BTV" | "BCH" | "BKT" | "HDTD"
}

export type LeaderSection = {
  category: "BTV" | "BCH" | "BKT" | "HDTD"
  label: string
  description: string
  members: LeaderCardData[]
}

function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase()
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-brand-700 text-white font-bold",
        className,
      )}
    >
      {initials}
    </div>
  )
}

export function LeaderSectionGrid({ sections }: { sections: LeaderSection[] }) {
  const [selected, setSelected] = useState<LeaderCardData | null>(null)

  return (
    <>
      {sections.map(({ category, label, description, members }) => {
        if (members.length === 0) return null
        return (
          <section key={category} className="mb-14">
            <header className="mb-6 text-center">
              <h2 className="text-xl font-bold text-brand-900 sm:text-2xl">{label}</h2>
              <p className="mt-1 text-sm text-brand-500">{description}</p>
            </header>

            <div className="grid gap-6 max-w-5xl mx-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {members.map((leader) => (
                <button
                  key={leader.id}
                  type="button"
                  onClick={() => setSelected(leader)}
                  className="group flex flex-col items-center rounded-xl border border-brand-200 bg-white p-6 text-center shadow-sm hover:shadow-md hover:border-brand-300 transition-all cursor-pointer"
                >
                  {leader.photoUrl ? (
                    <div className="relative h-20 w-20 rounded-full overflow-hidden mb-4 border-2 border-brand-100 group-hover:border-brand-300">
                      <Image
                        src={leader.photoUrl}
                        alt={leader.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  ) : (
                    <InitialsAvatar name={leader.name} className="h-20 w-20 text-xl mb-4" />
                  )}
                  <h3 className="font-bold text-brand-900 text-base group-hover:text-brand-700">
                    {leader.name}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-amber-700">{leader.title}</p>
                  {leader.workTitle && (
                    <p className="mt-2 text-xs text-brand-500 leading-relaxed line-clamp-2">
                      {leader.workTitle}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>
        )
      })}

      {selected && <LeaderModal leader={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function LeaderModal({ leader, onClose }: { leader: LeaderCardData; onClose: () => void }) {
  const t = useTranslations("leadershipTabs")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/90 border border-brand-200 hover:bg-brand-100 transition-colors"
          aria-label={t("close")}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 p-6 md:p-8">
          <div className="relative w-full aspect-4/5 rounded-xl overflow-hidden bg-brand-100 shrink-0">
            {leader.photoUrl ? (
              <Image
                src={leader.photoUrl}
                alt={leader.name}
                fill
                sizes="240px"
                className="object-cover"
              />
            ) : (
              <InitialsAvatar name={leader.name} className="w-full h-full text-5xl rounded-xl" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider font-semibold text-brand-500">
              {leader.term}
            </p>
            <h3 className="mt-1 text-2xl sm:text-3xl font-bold text-brand-900 leading-tight">
              {leader.honorific ? `${leader.honorific} ` : ""}
              {leader.name}
            </h3>
            <p className="mt-2 text-base font-semibold text-amber-700">{leader.title}</p>
            {leader.workTitle && (
              <p className="mt-2 text-sm text-brand-600 leading-relaxed">{leader.workTitle}</p>
            )}

            {leader.bio ? (
              <div className="mt-5 pt-5 border-t border-brand-200">
                <p className="text-xs uppercase tracking-wider font-semibold text-brand-500 mb-2">
                  {t("biography")}
                </p>
                <div className="prose prose-sm max-w-none text-brand-800 whitespace-pre-line leading-relaxed">
                  {leader.bio}
                </div>
              </div>
            ) : (
              <div className="mt-5 pt-5 border-t border-brand-200">
                <p className="text-sm italic text-brand-400">{t("bioUpdating")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
