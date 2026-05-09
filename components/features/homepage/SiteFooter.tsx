import Image from "next/image"
import Link from "next/link"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"
import { getStaticTexts } from "@/lib/static-texts"

// Fetch Chủ tịch + Phó CT + TTK + CVP cho cột "Lãnh đạo Hội".
// Match title bằng regex vì admin nhập free-text (đồng bộ cách Footer v1 đang làm).
const getLeadership = unstable_cache(
  async () =>
    prisma.leader.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: "Chủ tịch", mode: "insensitive" } },
          { title: { contains: "Tổng Thư ký", mode: "insensitive" } },
          { title: { contains: "Chánh Văn Phòng", mode: "insensitive" } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        name_en: true,
        name_zh: true,
        name_ar: true,
        title: true,
      },
      take: 10,
    }),
  ["site_footer_leadership"],
  { revalidate: 600, tags: ["footer", "leaders"] },
)

const getAssociationEmail = unstable_cache(
  async () =>
    (await prisma.siteConfig.findUnique({ where: { key: "association_email" } }))?.value ?? null,
  ["site_footer_association_email"],
  { revalidate: 600, tags: ["footer", "site-config"] },
)

export async function SiteFooter() {
  const locale = (await getLocale()) as Locale
  const [leaders, associationEmail, t, tCommon, tNav] = await Promise.all([
    getLeadership(),
    getAssociationEmail(),
    // pageKey "home" + fallbackNamespace "footer" → admin /admin/trang-tinh
    // ?page=home edit text trực tiếp, không cần thay đổi messages files.
    getStaticTexts("home", locale, "footer"),
    getTranslations("common"),
    getTranslations("navbar"),
  ])
  const year = new Date().getFullYear()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lName = (r: any) =>
    (localize(r as Record<string, unknown>, "name", locale) as string) ?? ""

  const chuTich = leaders.find((l) => /^Chủ tịch\s*$/i.test(l.title.trim()))
  const phoChuTich = leaders
    .filter((l) => /Phó Chủ tịch/i.test(l.title))
    .slice(0, 3)
  const tongThuKy = leaders.find((l) => /Tổng Thư ký/i.test(l.title))
  const chanhVanPhong = leaders.find((l) => /Chánh Văn Phòng/i.test(l.title))

  const hasLeadership =
    chuTich || phoChuTich.length > 0 || tongThuKy || chanhVanPhong

  return (
    <footer className="bg-brand-900 text-neutral-200">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-6 lg:gap-10 lg:px-8 lg:py-12">
        {/* About — full width mobile + sm, col-span-2 on desktop */}
        <div className="col-span-2 lg:col-span-2">
          <div className="mb-3 flex items-center gap-3">
            <Image
              src="/logo.png"
              alt={tCommon("siteName")}
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 object-contain"
            />
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">
              {tCommon("siteName")}
            </h3>
          </div>
          <p className="text-[13px] leading-relaxed text-neutral-300">
            {t("brandDescDefault")}
          </p>
          <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
            {t("establishedNotice")}
          </p>
          {/* Anti-copy sticky note — cảnh báo các trang giả mạo. Dùng amber
              để nổi bật trên nền brand-900 dark. Border-l đậm tạo cảm giác
              "sticker dán" thay vì block phẳng. */}
          <div
            role="note"
            className="mt-4 border-l-4 border-amber-400 bg-amber-50/95 px-3 py-2 text-[11px] leading-relaxed text-amber-900 shadow-sm"
          >
            {t("copyrightNoticeDefault")}
          </div>
        </div>

        {/* Leadership */}
        {hasLeadership && (
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">
              {t("leadership")}
            </h3>
            <ul className="space-y-2 text-[13px] leading-snug text-neutral-300">
              {chuTich && (
                <li>
                  <span className="block text-[11px] uppercase tracking-wide text-neutral-400">
                    {t("chairman")}
                  </span>
                  <span className="font-semibold text-white">
                    {lName(chuTich)}
                  </span>
                </li>
              )}
              {phoChuTich.map((l) => (
                <li key={l.id}>
                  <span className="block text-[11px] uppercase tracking-wide text-neutral-400">
                    {t("viceChairman")}
                  </span>
                  <span>{lName(l)}</span>
                </li>
              ))}
              {tongThuKy && (
                <li>
                  <span className="block text-[11px] uppercase tracking-wide text-neutral-400">
                    {t("secretaryGeneral")}
                  </span>
                  <span>{lName(tongThuKy)}</span>
                </li>
              )}
              {chanhVanPhong && (
                <li>
                  <span className="block text-[11px] uppercase tracking-wide text-neutral-400">
                    {t("chiefOfOffice")}
                  </span>
                  <span>{lName(chanhVanPhong)}</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Quick links */}
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">
            {t("quickLinks")}
          </h3>
          <ul className="space-y-1.5 text-[13px]">
            <li>
              <Link href="/gioi-thieu-v2" className="hover:text-white hover:underline">
                {tNav("about")}
              </Link>
            </li>
            <li>
              <Link href="/dieu-le" className="hover:text-white hover:underline">
                {tNav("charter")}
              </Link>
            </li>
            <li>
              <Link href="/ban-lanh-dao" className="hover:text-white hover:underline">
                {tNav("leadership")}
              </Link>
            </li>
            <li>
              <Link href="/tin-tuc" className="hover:text-white hover:underline">
                {tNav("news")}
              </Link>
            </li>
            <li>
              <Link href="/nghien-cuu" className="hover:text-white hover:underline">
                {tNav("research")}
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact — address cố tình giữ tiếng Việt: tên đường/phường là
            danh từ riêng, dịch ra tiếng nước ngoài sẽ sai lệch khi tra cứu
            bản đồ/giao nhận thư từ. Chỉ dịch heading. */}
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">
            {t("contact")}
          </h3>
          <address className="text-[13px] not-italic leading-relaxed text-neutral-300">
            Số 150, Đường Lý Chính Thắng
            <br />
            Phường Xuân Hòa
            <br />
            Thành phố Hồ Chí Minh
            {associationEmail && (
              <>
                <br />
                <a
                  href={`mailto:${associationEmail}`}
                  className="hover:text-white hover:underline"
                >
                  {associationEmail}
                </a>
              </>
            )}
          </address>
        </div>

        {/* Working hours */}
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">
            {t("workingHours")}
          </h3>
          <p className="text-[13px] leading-relaxed text-neutral-300">
            {t("workingHoursDefault")}
          </p>
          <div className="mt-4 flex gap-3">
            <a
              href="https://www.facebook.com/hoitramhuongvietnam.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center border border-neutral-500 text-xs font-bold text-neutral-300 hover:border-white hover:text-white"
              aria-label="Facebook"
            >
              f
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-brand-800 bg-black/30">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 px-4 py-4 text-[12px] text-neutral-400 sm:flex-row sm:px-6 lg:px-8">
          <span>{t("copyright", { year })}</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white hover:underline">
              {t("privacyPolicy")}
            </Link>
            <Link href="/terms" className="hover:text-white hover:underline">
              {t("termsOfService")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
