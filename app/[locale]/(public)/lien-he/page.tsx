import { cn } from "@/lib/utils"
import { getLocale, getTranslations } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { prisma } from "@/lib/prisma"
import { ContactForm } from "./ContactForm"
import { OfficialChannelsBlock } from "@/components/features/layout/OfficialChannelsBlock"
import { getStaticTexts } from "@/lib/static-texts"

export const revalidate = 600

export async function generateMetadata() {
  const t = await getTranslations("contact")
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { canonical: "/lien-he" },
  }
}

export default async function LienHePage() {
  const locale = (await getLocale()) as Locale
  // `t` đọc StaticPageConfig (admin CMS override) trước, fallback messages —
  // admin /admin/trang-tinh?page=contact có thể chỉnh trực tiếp.
  const [t, emailRow] = await Promise.all([
    getStaticTexts("contact", locale),
    prisma.siteConfig.findUnique({ where: { key: "association_email" } }),
  ])
  const associationEmail = emailRow?.value ?? null

  return (
    <div>
      {/* ── Content wrapper ── */}
      <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="overflow-hidden">

      {/* ── Contact Info + Form ── */}
      <section className="py-16 px-6 sm:px-10">
        <div>
          <div className="grid gap-12 md:grid-cols-2 md:items-start">
            {/* Left: Contact info */}
            <div>
              <h2 className="text-xl font-bold text-brand-900 mb-6">
                {t("contactInfo")}
              </h2>

              <ul className="space-y-5">
                <li className="flex items-start gap-4">
                  <span className="mt-0.5 shrink-0 text-xl">📞</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 mb-0.5">
                      {t("phone")}
                    </p>
                    <a href="tel:+84913810060" className="block text-brand-800 font-medium hover:text-brand-600 hover:underline">
                      0913 810 060
                    </a>
                    <p className="text-xs text-brand-500">Ông Phạm Văn Du — Chủ tịch Hội</p>
                    <a href="tel:+84938334647" className="mt-1 block text-brand-800 font-medium hover:text-brand-600 hover:underline">
                      0938 334 647
                    </a>
                    <p className="text-xs text-brand-500">Ông Nguyễn Văn Hùng — Phó Chủ tịch Hội</p>
                  </div>
                </li>

                {associationEmail && (
                  <li className="flex items-start gap-4">
                    <span className="mt-0.5 shrink-0 text-xl">📧</span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 mb-0.5">{t("email")}</p>
                      <a href={`mailto:${associationEmail}`} className="text-brand-800 font-medium hover:text-brand-600 hover:underline break-all">
                        {associationEmail}
                      </a>
                    </div>
                  </li>
                )}

                <li className="flex items-start gap-4">
                  <span className="mt-0.5 shrink-0 text-xl">📍</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 mb-0.5">{t("address")}</p>
                    <p className="text-brand-800 font-medium">
                      Số 150, Đường Lý Chính Thắng,<br />
                      Phường Xuân Hòa, TP. Hồ Chí Minh
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <span className="mt-0.5 shrink-0 text-xl">🌐</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 mb-0.5">{t("website")}</p>
                    <a href="https://hoitramhuong.vn" target="_blank" rel="noopener noreferrer" className="text-brand-800 font-medium hover:text-brand-600 hover:underline">
                      hoitramhuong.vn
                    </a>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <span className="mt-0.5 shrink-0 text-xl">🕐</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 mb-0.5">{t("workingHours")}</p>
                    <p className="text-brand-800 font-medium">{t("workingHoursValue")}</p>
                  </div>
                </li>
              </ul>

              {/* Social links */}
              <div className="mt-8">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 mb-3">
                  {t("socialMedia")}
                </p>
                <div className="flex gap-3">
                  <a
                    href="https://www.facebook.com/hoitramhuongvietnam.org"
                    target="_blank" rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white",
                      "px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors",
                    )}
                  >
                    Facebook
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Quick form */}
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-8">
              <h2 className="text-xl font-bold text-brand-900 mb-6">{t("quickMessage")}</h2>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── Cảnh báo giả mạo — ẩn grid badge kênh (Facebook/Zalo/…) vì
           thông tin liên hệ đã hiển thị ở cột trái bên trên. ─────────── */}
      <section className="py-12 lg:py-16 border-t border-brand-100">
        <OfficialChannelsBlock variant="full" showChannels={false} />
      </section>

      </div>
      </div>
    </div>
  )
}
