import Link from "next/link"
import Image from "next/image"
import { getAssociationNews, newsHref, type HomepageNewsItem } from "@/lib/homepage"
import { AgarwoodPlaceholder } from "@/components/ui/AgarwoodPlaceholder"
import { BRAND_BLUR_DATA_URL } from "@/lib/imageBlur"
import { newsCoverImage } from "@/lib/multimedia-from-news"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"

export async function NewsSection() {
  const [news, t, locale] = await Promise.all([
    getAssociationNews(),
    getTranslations("homepage"),
    getLocale() as Promise<Locale>,
  ])
  const hero = news[0] ?? null
  const underHero = news.slice(1, 4)
  const sideItems = news.slice(4, 6)

  return (
    <section aria-label="Tin Hội">
      {hero || underHero.length > 0 || sideItems.length > 0 ? (
        // DOM order = mobile order: hero → side excerpts → 3 stacked.
        // Desktop restores the original layout via explicit grid placement
        // (side excerpts span both rows of the right column).
        <div className="grid gap-8 lg:grid-cols-12">
          {/* 1. Hero — mobile line 1 / desktop left col row 1 */}
          <div className="min-w-0 lg:col-span-7 lg:col-start-1 lg:row-start-1">
            {hero && (
              <Hero
                item={hero}
                label={t("newsFeatured")}
                locale={locale}
              />
            )}
          </div>

          {/* 2. Side excerpts — mobile line 2-3 / desktop right col spanning 2 rows */}
          {sideItems.length > 0 && (
            <div className="min-w-0 space-y-6 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
              {sideItems.map((n) => (
                <ExcerptCard key={n.id} item={n} locale={locale} />
              ))}
            </div>
          )}

          {/* 3. Three stacked items — mobile line 4-6 / desktop left col row 2 */}
          {underHero.length > 0 && (
            <div className="min-w-0 lg:col-span-7 lg:col-start-1 lg:row-start-2">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-4">
                {underHero.map((n) => (
                  <StackedItem key={n.id} item={n} locale={locale} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white p-12 text-center italic text-neutral-500">
          {t("newsEmpty")}
        </div>
      )}
    </section>
  )
}

function Hero({
  item,
  label,
  locale,
}: {
  item: HomepageNewsItem
  label: string
  locale: Locale
}) {
  const title = localize(item, "title", locale) as string
  const excerpt = localize(item, "excerpt", locale) as string | null
  const cover = newsCoverImage(item)
  return (
    <Link href={newsHref(item.category, item.slug)} className="group block">
      <div className="relative aspect-video w-full overflow-hidden bg-brand-100">
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            priority
            placeholder="blur"
            blurDataURL={BRAND_BLUR_DATA_URL}
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
        ) : (
          <AgarwoodPlaceholder className="h-full w-full" size="xl" shape="square" />
        )}
        {item.isPinned && (
          <span className="absolute left-0 top-3 bg-brand-700 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {label}
          </span>
        )}
      </div>
      <h3 className="mt-4 text-2xl font-bold leading-tight text-brand-900 underline-offset-2 decoration-brand-700 group-hover:text-brand-700 group-hover:underline lg:text-[28px]">
        {title}
      </h3>
      {excerpt && (
        <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-neutral-700">
          {excerpt}
        </p>
      )}
    </Link>
  )
}

function ExcerptCard({
  item,
  locale,
}: {
  item: HomepageNewsItem
  locale: Locale
}) {
  const title = localize(item, "title", locale) as string
  const excerpt = localize(item, "excerpt", locale) as string | null
  const cover = newsCoverImage(item)
  return (
    <Link href={newsHref(item.category, item.slug)} className="group block">
      <div className="relative aspect-video w-full overflow-hidden bg-brand-100">
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            placeholder="blur"
            blurDataURL={BRAND_BLUR_DATA_URL}
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover"
          />
        ) : (
          <AgarwoodPlaceholder className="h-full w-full" size="lg" shape="square" />
        )}
      </div>
      <h3 className="mt-3 text-lg font-bold leading-tight text-brand-900 underline-offset-2 decoration-brand-700 group-hover:text-brand-700 group-hover:underline">
        {title}
      </h3>
      {excerpt && (
        <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-neutral-700">
          {excerpt}
        </p>
      )}
    </Link>
  )
}

function StackedItem({
  item,
  locale,
}: {
  item: HomepageNewsItem
  locale: Locale
}) {
  const title = localize(item, "title", locale) as string
  const cover = newsCoverImage(item)
  return (
    <Link href={newsHref(item.category, item.slug)} className="group block">
      {cover ? (
        <div className="relative aspect-video w-full overflow-hidden bg-brand-100">
          <Image
            src={cover}
            alt=""
            fill
            placeholder="blur"
            blurDataURL={BRAND_BLUR_DATA_URL}
            sizes="(max-width: 1024px) 90vw, 20vw"
            className="object-cover"
          />
        </div>
      ) : (
        <AgarwoodPlaceholder
          className="aspect-video w-full"
          size="sm"
          shape="square"
          tone="light"
        />
      )}
      <h4
        className="mt-2 text-[14px] font-bold leading-snug text-brand-900 underline-offset-2 decoration-brand-700 line-clamp-3 group-hover:text-brand-700 group-hover:underline"
        title={title}
      >
        {title}
      </h4>
    </Link>
  )
}
