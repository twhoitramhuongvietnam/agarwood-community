import Link from "next/link"
import Image from "next/image"
import {
  getTopVipMemberPosts,
  getMemberPostsPool,
  pickRotatingMembers,
  type HomepagePost,
} from "@/lib/homepage"
import { BRAND_BLUR_DATA_URL } from "@/lib/imageBlur"
import { AgarwoodPlaceholder } from "@/components/ui/AgarwoodPlaceholder"
import { getTranslations } from "next-intl/server"

function getCover(post: HomepagePost): string | null {
  if (post.imageUrls && post.imageUrls.length > 0) return post.imageUrls[0]
  const m = post.content.match(/https:\/\/res\.cloudinary\.com\/[^"'\s)]+/)
  return m ? m[0] : null
}

function plainTitle(post: HomepagePost, n = 80): string {
  if (post.title) return post.title
  return post.content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n)
}

export async function MemberRail() {
  // Fetch top posts + pool + translations song song.
  const [top, pool, t] = await Promise.all([
    getTopVipMemberPosts(),
    getMemberPostsPool(),
    getTranslations("homepage"),
  ])
  const rotating = pickRotatingMembers(
    pool,
    top.map((p) => p.id),
  )

  if (top.length === 0 && rotating.length === 0) {
    return (
      <aside
        aria-label={t("memberNewsTitle")}
        className="border border-brand-200 bg-white p-5"
      >
        <p className="py-6 text-center text-sm italic text-brand-500">
          {t("memberNewsEmpty")}
        </p>
      </aside>
    )
  }

  return (
    <aside aria-label={t("memberNewsTitle")}>
      {top.length > 0 && (
        <ul className="divide-y divide-brand-200 border-t border-b border-brand-200">
          {top.map((post) => (
            <li key={post.id}>
              <TopItem post={post} />
            </li>
          ))}
        </ul>
      )}

      {rotating.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {rotating.map((post) => (
            <li key={post.id}>
              <CompactItem post={post} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

function TopItem({ post }: { post: HomepagePost }) {
  const cover = getCover(post)
  const name = post.author.company?.name ?? post.author.name
  const title = plainTitle(post)
  return (
    <Link
      href={`/bai-viet/${post.id}`}
      className="group flex items-start gap-3 py-3"
    >
      {cover ? (
        <div className="relative h-14 w-20 shrink-0 overflow-hidden bg-brand-100">
          <Image
            src={cover}
            alt=""
            fill
            placeholder="blur"
            blurDataURL={BRAND_BLUR_DATA_URL}
            sizes="80px"
            className="object-cover"
          />
        </div>
      ) : (
        <AgarwoodPlaceholder
          className="h-14 w-20 shrink-0"
          size="sm"
          shape="square"
          tone="light"
        />
      )}
      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 text-sm font-bold leading-snug text-brand-900 underline-offset-2 decoration-brand-700 group-hover:text-brand-700 group-hover:underline">
          {title}
        </h4>
        <p className="mt-0.5 truncate text-[11px] uppercase tracking-wide text-brand-500">
          {name}
        </p>
      </div>
    </Link>
  )
}

function CompactItem({ post }: { post: HomepagePost }) {
  const title = plainTitle(post)
  return (
    <Link
      href={`/bai-viet/${post.id}`}
      className="group flex gap-2 text-sm"
    >
      <span className="shrink-0 font-bold text-brand-700">▸</span>
      <span className="line-clamp-2 font-bold leading-snug text-brand-900 group-hover:text-brand-700 group-hover:underline">
        {title}
      </span>
    </Link>
  )
}
