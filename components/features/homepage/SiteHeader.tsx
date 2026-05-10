import Link from "next/link"
import Image from "next/image"
import { getLocale, getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Locale } from "@/i18n/config"
import { CategoryBar, type CategoryBarItem } from "./CategoryBar"
import { LocaleFlags } from "./LocaleFlags"
import { UserMenu } from "@/components/features/layout/UserMenu"
import { getMenuTree, type MenuNode } from "@/lib/menu"
import { localize } from "@/i18n/localize"

// Routes nội bộ (không có [locale] segment) — không prefix locale vào href.
// Khớp danh sách trong Navbar để consistent.
const INTERNAL_PREFIXES = [
  "/tong-quan", "/admin", "/dashboard", "/ho-so",
  "/gia-han", "/chung-nhan", "/company", "/doanh-nghiep-cua-toi",
  "/doanh-nghiep/chinh-sua", "/san-pham/tao-moi", "/certification",
  "/thanh-toan", "/ket-nap", "/tai-lieu", "/members", "/certifications",
  "/media-orders",
]
function isInternalHref(href: string): boolean {
  return INTERNAL_PREFIXES.some((p) => href === p || href.startsWith(p + "/"))
}

function localizeMenuForCategoryBar(nodes: MenuNode[], locale: Locale): CategoryBarItem[] {
  function prefixHref(href: string): string {
    if (isInternalHref(href)) return href
    return href === "/" ? `/${locale}` : `/${locale}${href}`
  }
  function prefixMatchPrefixes(prefixes: string[]): string[] {
    return prefixes.map((p) => (isInternalHref(p) ? p : `/${locale}${p}`))
  }
  return nodes.map((n) => ({
    menuKey: n.menuKey,
    label: localize(n, "label", locale) as string,
    href: prefixHref(n.href),
    isNew: n.isNew,
    comingSoon: n.comingSoon,
    openInNewTab: n.openInNewTab,
    matchPrefixes: prefixMatchPrefixes(n.matchPrefixes),
    children: n.children.map((c) => ({
      menuKey: c.menuKey,
      label: localize(c, "label", locale) as string,
      href: prefixHref(c.href),
      matchPrefixes: prefixMatchPrefixes(c.matchPrefixes),
      openInNewTab: c.openInNewTab,
    })),
  }))
}

// Map app locale → BCP-47 tag Intl.DateTimeFormat hiểu. Giữ dải hẹp vì
// mỗi locale chỉ có duy nhất một region-hint chính thức trong dự án.
const DATE_LOCALE_TAG: Record<Locale, string> = {
  vi: "vi-VN",
  en: "en-US",
  zh: "zh-CN",
  ar: "ar-SA",
}

function formatToday(locale: Locale): string {
  const fmt = new Intl.DateTimeFormat(DATE_LOCALE_TAG[locale], {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  })
  // Intl đã sinh output đúng quy ước từng locale — không tự capitalize
  // hay format lại (tiếng Việt "thứ hai" vẫn là thứ hai, tiếng Anh "Monday"
  // đã hoa sẵn, Trung + Ả-rập không có khái niệm hoa thường). Trả nguyên
  // `format()` để giữ dấu phẩy/khoảng cách đúng ngữ cảnh.
  return fmt.format(new Date())
}

export async function SiteHeader() {
  const [locale, session, tCommon, tNav, menuTree] = await Promise.all([
    getLocale() as Promise<Locale>,
    auth(),
    getTranslations("common"),
    getTranslations("navbar"),
    getMenuTree(),
  ])
  const today = formatToday(locale)
  const user = session?.user
  const siteName = tCommon("siteName")
  const categoryItems = localizeMenuForCategoryBar(menuTree, locale)

  // Nếu user là đại diện doanh nghiệp, fetch tên + slug company để UserMenu
  // dẫn về `/{locale}/doanh-nghiep/{slug}`. Chỉ query khi đã login.
  const userCompany = user?.id
    ? await prisma.company.findUnique({
        where: { ownerId: user.id },
        select: { name: true, slug: true },
      })
    : null

  return (
    // Fragment — để header + CategoryBar rơi trực tiếp vào parent layout
    // (data-page="public" div với min-h-screen). Nếu bọc trong <div> không
    // có height, sticky range sẽ bị giới hạn trong div đó → nav scroll mất.
    <>
      <header>
        {/* Top utility strip — báo chí style: ngày bên trái, locale + utility links bên phải */}
        <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 text-[13px] text-neutral-600 sm:px-6 lg:px-8">
          <span className="uppercase tracking-wide">{today}</span>
          <nav aria-label={tNav("utilityLabel")} className="flex items-center gap-4 sm:gap-5">
            <LocaleFlags current={locale} />
            {/* Login/register CTA cho guest đã chuyển sang CategoryBar;
                UserMenu (khi đã login) đã move xuống masthead bên phải để
                đối xứng với logo. Utility strip giờ chỉ có date + locale. */}
          </nav>
        </div>
      </div>

      {/* Masthead — logo trái, UserMenu phải (khi đã login) đối xứng. */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-5 sm:gap-4 sm:px-6 lg:px-8 lg:py-6">
          {/* Logo block: mobile compact (ẩn eyebrow + tagline + title nhỏ hơn)
              để chừa chỗ cho UserMenu bên phải. `min-w-0` + `truncate` ở text
              block tránh overflow khi title dài + viewport hẹp. */}
          <Link href="/" className="relative flex min-w-0 items-center gap-3">
            <Image
              src="/logo.png"
              alt={siteName}
              width={64}
              height={64}
              priority
              className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14 lg:h-16 lg:w-16"
            />
            <div className="min-w-0 leading-tight">
              {/* Eyebrow cố tình giữ nguyên tiếng Anh — đây là tên đăng ký
                  chính thức của Hội với đối tác quốc tế (như Apple Inc.),
                  không dịch theo locale người xem. */}
              <p className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700 sm:block">
                Vietnam Agarwood Association
              </p>
              {/* H1 + badge overlay — Phase 3.7 (2026-04). Badge position
                  absolute đè lên phần đuôi H1; vùng trắng opaque quanh badge
                  PNG blend tự nhiên với masthead bg-white → nhìn như badge
                  "dán" lên title. Mobile ẩn (chật), từ sm trở lên show. */}
              <div className="relative">
                <h1 className="truncate pr-2 text-base font-black uppercase tracking-tight text-brand-900 sm:mt-0.5 sm:pr-28 sm:text-2xl lg:pr-40 lg:text-[26px]">
                  {siteName}
                </h1>
                {/* Desktop badge — anchor vào H1 wrapper (đè title). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/badge_demo.png"
                  alt="Phiên bản đang thử nghiệm"
                  className="pointer-events-none absolute hidden h-14 w-auto bg-white sm:block sm:-top-6 sm:-right-[35px] lg:-top-10 lg:h-20"
                  title="Phiên bản đang thử nghiệm — vui lòng đóng góp ý kiến để hoàn thiện"
                />
              </div>
              <p className="mt-0.5 hidden text-[11px] text-neutral-500 sm:block">
                {tCommon("officialTagline")}
              </p>
            </div>
            {/* Mobile-only badge — anchor vào <Link> (logo block) corner.
                sm+ ẩn vì desktop dùng badge khác đè title. Phase 3.7 (2026-04). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/badge_demo.png"
              alt="Phiên bản đang thử nghiệm"
              className="pointer-events-none absolute -top-[15px] -right-[35px] h-8 w-auto bg-white sm:hidden"
              title="Phiên bản đang thử nghiệm — vui lòng đóng góp ý kiến để hoàn thiện"
            />
          </Link>

          {/* UserMenu — phía phải masthead, đối xứng với logo Hội.
              variant="light": avatar 56–64px bằng logo, tên user TRƯỚC avatar
              với màu + weight match H1 masthead. Guest dùng CTA ở CategoryBar. */}
          {user && (
            <div className="shrink-0">
              <UserMenu
                name={user.name}
                email={user.email}
                image={user.image}
                role={user.role}
                company={userCompany}
                variant="light"
              />
            </div>
          )}
        </div>
      </div>
      </header>

      {/* CategoryBar RA NGOÀI <header> để position:sticky không bị containing
          block của <header> chặn — khi scroll, top strip + masthead đi lên
          mất, nhưng category bar pin cứng top viewport.
          loggedIn={!!user} → guest thấy thêm 2 CTA Đăng nhập + Đăng ký ở cuối
          dãy menu. */}
      <CategoryBar loggedIn={!!user} items={categoryItems} />
    </>
  )
}
