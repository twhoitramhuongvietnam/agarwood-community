import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { RegisterSection } from "./RegisterSection"

export async function generateMetadata() {
  const t = await getTranslations("register")
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  }
}

export const revalidate = 0

function formatVnd(amount: number): string {
  return amount.toLocaleString("vi-VN") + "đ"
}

export default async function DangKyPage() {
  const t = await getTranslations("register")

  const benefits = [
    { icon: "📝", title: t("b1Title"), desc: t("b1Desc") },
    { icon: "🏅", title: t("b2Title"), desc: t("b2Desc") },
    { icon: "🏢", title: t("b3Title"), desc: t("b3Desc") },
    { icon: "🤝", title: t("b4Title"), desc: t("b4Desc") },
  ]

  const steps = [
    { step: 1, title: t("s1Title"), desc: t("s1Desc") },
    { step: 2, title: t("s2Title"), desc: t("s2Desc") },
    { step: 3, title: t("s3Title"), desc: t("s3Desc") },
    { step: 4, title: t("s4Title"), desc: t("s4Desc") },
  ]

  // Lấy phí chính thức theo Điều lệ Hội
  const feeKeys = [
    "join_fee_individual",
    "join_fee_organization",
    "individual_fee_min",
    "membership_fee_min",
  ]
  const feeConfigs = await prisma.siteConfig.findMany({
    where: { key: { in: feeKeys } },
  })
  const fee = Object.fromEntries(feeConfigs.map((c) => [c.key, Number(c.value)]))
  const joinFeeIndividual = fee.join_fee_individual ?? 1_000_000
  const joinFeeOrganization = fee.join_fee_organization ?? 2_000_000
  const annualFeeIndividual = fee.individual_fee_min ?? 1_000_000
  const annualFeeOrganization = fee.membership_fee_min ?? 2_000_000

  return (
    <div>
      {/* Hero */}
      <section className="bg-brand-800 py-16 px-4 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl text-brand-100">{t("heroTitle")}</h1>
        <p className="mt-3 text-brand-300 text-base max-w-2xl mx-auto">
          {t("heroDesc")}
        </p>
      </section>

      {/* Form — Nộp đơn (section đầu theo yêu cầu khách, user thấy CTA ngay).
          max-w-3xl cho phép các row grid 2-cột (email/phone, industry/address)
          hiển thị đúng 2 cột trên desktop → khung lùn hơn, ít scroll hơn. */}
      <section className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white rounded-2xl border border-brand-200 p-6 sm:p-8 lg:p-10 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-brand-900 text-center">{t("submitForm")}</h2>
          <RegisterSection />
        </div>
      </section>

      {/* Process — Quy trình đăng ký */}
      <section className="bg-brand-50 py-14 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-brand-900 text-center mb-10">{t("processTitle")}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.step} className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-brand-700 text-white flex items-center justify-center text-lg font-bold mx-auto">{s.step}</div>
                <h3 className="font-semibold text-brand-900 text-sm">{s.title}</h3>
                <p className="text-sm text-brand-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Official fees — Phí hội viên */}
      <section className="bg-white py-14 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-brand-900 text-center mb-3">
            {t("feeTitle")}
          </h2>
          <p className="text-center text-sm text-brand-500 mb-10">
            {t("feeSubtitle")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👤</span>
                <div>
                  <h3 className="font-bold text-brand-900">{t("individualTitle")}</h3>
                  <p className="text-xs text-brand-500">{t("individualDesc")}</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between items-baseline">
                  <span className="text-brand-700">{t("joinFee")}</span>
                  <span className="font-bold text-brand-900">{formatVnd(joinFeeIndividual)}</span>
                </li>
                <li className="flex justify-between items-baseline">
                  <span className="text-brand-700">{t("annualFee")}</span>
                  <span className="font-bold text-brand-900">{formatVnd(annualFeeIndividual)}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-brand-200 bg-brand-50 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏢</span>
                <div>
                  <h3 className="font-bold text-brand-900">{t("orgTitle")}</h3>
                  <p className="text-xs text-brand-500">{t("orgDesc")}</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between items-baseline">
                  <span className="text-brand-700">{t("joinFee")}</span>
                  <span className="font-bold text-brand-900">{formatVnd(joinFeeOrganization)}</span>
                </li>
                <li className="flex justify-between items-baseline">
                  <span className="text-brand-700">{t("annualFee")}</span>
                  <span className="font-bold text-brand-900">{formatVnd(annualFeeOrganization)}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Approval notice — rich text qua t.rich() để giữ link + emphasis trong i18n */}
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">📝</span>
              <div className="space-y-2 text-amber-900">
                <p className="font-semibold">{t("approvalTitle")}</p>
                <p className="leading-relaxed">
                  {t.rich("approvalP1", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
                <p className="leading-relaxed">
                  {t.rich("approvalP2", {
                    em: (chunks) => <em>{chunks}</em>,
                    applicationLink: (chunks) => (
                      <Link href="/ket-nap" className="underline font-semibold text-amber-800 hover:text-amber-950">
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
                <p className="leading-relaxed">
                  {t.rich("approvalP3", {
                    charterLink: (chunks) => (
                      <Link href="/dieu-le" className="underline font-semibold text-amber-800 hover:text-amber-950">
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits — Quyền lợi (section cuối) */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold text-brand-900 text-center mb-10">{t("benefitsTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b) => (
            <div key={b.title} className="bg-white rounded-xl border border-brand-200 p-5 space-y-2">
              <span className="text-2xl">{b.icon}</span>
              <h3 className="font-semibold text-brand-900">{b.title}</h3>
              <p className="text-sm text-brand-600 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
