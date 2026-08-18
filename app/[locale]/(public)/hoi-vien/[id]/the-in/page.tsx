import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getMemberCardQrDataUrl } from "@/lib/memberQrCache"
import { calcTier, getTierThresholds } from "@/lib/tier"
import { generateMemberCardId, tierFromRole } from "@/lib/memberCard"
import { MemberCardFront } from "@/components/features/member-card/MemberCardFront"
import { MemberCardBack } from "@/components/features/member-card/MemberCardBack"
import { PrintButton } from "./PrintButton"
import type { Locale } from "@/i18n/config"

export async function generateMetadata() {
  const t = await getTranslations("printCard")
  return { title: t("title"), robots: { index: false, follow: false } }
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoitramhuong.vn"

export default async function PrintMemberCardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [tP, locale] = await Promise.all([
    getTranslations("printCard"),
    getLocale() as Promise<Locale>,
  ])

  const { id } = await params

  const [member, businessThresholds, individualThresholds, configs] =
    await Promise.all([
      prisma.user.findFirst({
        where: { id, role: { in: ["VIP", "INFINITE"] }, isActive: true },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          role: true,
          accountType: true,
          contributionTotal: true,
          memberCategory: true,
          membershipExpires: true,
          createdAt: true,
          company: {
            select: {
              name: true,
              logoUrl: true,
              representativePosition: true,
            },
          },
        },
      }),
      getTierThresholds("BUSINESS"),
      getTierThresholds("INDIVIDUAL"),
      prisma.siteConfig.findMany({
        where: {
          key: {
            in: ["association_email", "association_phone", "association_website"],
          },
        },
      }),
    ])

  if (!member) notFound()

  const cfg = Object.fromEntries(configs.map((c) => [c.key, c.value]))
  const thresholds =
    member.accountType === "INDIVIDUAL" ? individualThresholds : businessThresholds
  const tierInfo = calcTier(
    member.contributionTotal,
    thresholds.silver,
    thresholds.gold,
  )
  const memberCardId = generateMemberCardId(member.id, member.createdAt)
  const verifyUrl = `${SITE_URL}/hoi-vien/${member.id}`
  const tier = tierFromRole(member.role, tierInfo.stars)

  // QR cache deterministic (memberId, siteUrl) — không re-gen mỗi request.
  const qrDataUrl = await getMemberCardQrDataUrl(member.id, SITE_URL)

  const frontData = {
    name: member.name,
    avatarUrl: member.avatarUrl ?? member.company?.logoUrl ?? null,
    title: member.company?.representativePosition ?? null,
    companyName: member.company?.name ?? null,
    memberCategory: member.memberCategory,
    memberCardId,
    validFrom: member.createdAt,
    validTo: member.membershipExpires,
    tier,
  } as const

  const cardFrontLabels = {
    cardId: tP("cardIdLabel"),
    validity: tP("validityLabel"),
  }
  const cardBackLabels = {
    verifyMember: tP("verifyMemberLabel"),
    qrAlt: tP("qrAlt"),
    established: tP("establishedText"),
  }

  return (
    <div className="bg-brand-50 min-h-screen py-10 print:min-h-0 print:bg-white print:py-0">
      {/* Controls — ẩn khi in */}
      <div className="max-w-4xl mx-auto px-4 mb-8 print:hidden">
        <h1 className="text-2xl font-bold text-brand-900 mb-2">
          {tP("pageHeading", { name: member.name })}
        </h1>
        <p className="text-sm text-brand-600 mb-4">{tP("instructions")}</p>
        <div className="flex gap-3">
          <PrintButton />
          <Link
            href={`/${locale}/hoi-vien`}
            className="rounded-lg border border-brand-200 px-5 py-2.5 text-sm font-medium text-brand-700 hover:bg-white transition-colors"
          >
            {tP("back")}
          </Link>
        </div>

        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">{tP("guideTitle")}</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>{tP("guide1")}</li>
            <li>{tP("guide2")}</li>
            <li>{tP("guide3")}</li>
          </ul>
        </div>
      </div>

      {/* Print area — on-screen 2 thẻ cách nhau (space-y-8); khi in vẫn
          chừa khoảng cách 6mm (print:space-y-[6mm]) để dễ phân biệt/cắt,
          nhưng gộp chung 1 trang PDF cao 114mm (54+54+6) thay vì 2 trang */}
      <div className="max-w-xl mx-auto px-4 space-y-8 print:space-y-[6mm] print:max-w-none print:mx-0 print:px-0">
        {/* Front */}
        <div className="print-card-page">
          <div className="mx-auto" style={{ width: "85.6mm" }}>
            <MemberCardFront data={frontData} labels={cardFrontLabels} />
          </div>
          <p className="mt-2 text-center text-xs text-brand-500 print:hidden">
            {tP("front")}
          </p>
        </div>

        {/* Back */}
        <div className="print-card-page">
          <div className="mx-auto" style={{ width: "85.6mm" }}>
            <MemberCardBack
              tier={tier}
              memberCardId={memberCardId}
              qrDataUrl={qrDataUrl}
              verifyUrl={verifyUrl}
              associationEmail={cfg.association_email ?? ""}
              associationPhone={cfg.association_phone ?? ""}
              associationWebsite={cfg.association_website ?? SITE_URL}
              labels={cardBackLabels}
            />
          </div>
          <p className="mt-2 text-center text-xs text-brand-500 print:hidden">
            {tP("rear")}
          </p>
        </div>
      </div>

      {/* Print-specific CSS — gộp mặt trước + mặt sau (mỗi mặt CR80
          85.6×54mm, cách nhau 6mm nhờ print:space-y-[6mm] ở trên) vào
          đúng 1 trang PDF cao 114mm, không trang thừa, không chrome.
          print-color-adjust: exact — Chrome mặc định bỏ qua background-color
          khi in để tiết kiệm mực, khiến màu nền theo tier (vàng/bạc/đen)
          của thẻ bị mất, chỉ còn border. Bắt buộc giữ nguyên màu. */}
      <style>{`
        @media print {
          @page {
            size: 85.6mm 114mm;
            margin: 0;
          }
          html, body {
            background: #fff !important;
            margin: 0;
            padding: 0;
          }
          .print-card-page {
            page-break-inside: avoid;
          }
          .print-card-page, .print-card-page * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  )
}
