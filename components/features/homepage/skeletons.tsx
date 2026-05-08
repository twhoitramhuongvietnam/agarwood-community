import { Skeleton } from "@/components/ui/skeleton"

export function NewsSectionSkeleton() {
  // Mirror NewsSection thực tế: 12-col grid với hero (col-7) bên trái,
  // 2 ExcerptCards (col-5) bên phải span 2 rows, 3 stacked items dưới hero.
  // Match layout này để tránh CLS khi content stream in.
  return (
    <section aria-hidden>
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Hero — left col row 1 */}
        <div className="min-w-0 lg:col-span-7 lg:col-start-1 lg:row-start-1">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="mt-3 h-6 w-5/6" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>

        {/* Side excerpts — right col span 2 rows */}
        <div className="min-w-0 space-y-6 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>

        {/* 3 stacked items — left col row 2 */}
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:col-start-1 lg:row-start-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-20 w-28 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function MemberRailSkeleton() {
  // Mirror MemberRail thực tế: 4 TopItem (cover h-14 + 2 dòng tiêu đề) +
  // 7 CompactItem (bullet + 2 dòng tiêu đề). Đồng bộ chiều cao để tránh CLS
  // khi Suspense resolve.
  return (
    <aside>
      <ul className="divide-y divide-brand-200 border-t border-b border-brand-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <div className="flex items-start gap-3 py-3">
              <Skeleton className="h-14 w-20 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-2.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={i}>
            <div className="flex gap-2">
              <span className="shrink-0 font-bold text-brand-700">▸</span>
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export function CarouselSkeleton({ title = "Đang tải..." }: { title?: string }) {
  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
          <span className="sr-only">{title}</span>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-56 shrink-0 space-y-2">
              <Skeleton className="h-56 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LatestPostsSkeleton() {
  return (
    <section className="bg-white py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-xl border border-brand-200 bg-white shadow-sm"
            >
              <Skeleton className="h-44 w-full" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function BannerSlotSkeleton() {
  return (
    <section className="bg-brand-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </section>
  )
}

export function PartnersCarouselSkeleton() {
  return (
    <section className="bg-brand-50 py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="w-44 h-44 shrink-0 rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  )
}
