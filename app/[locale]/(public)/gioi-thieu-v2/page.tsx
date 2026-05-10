import Link from "next/link"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getLocale, getTranslations } from "next-intl/server"
import { localize } from "@/i18n/localize"
import type { Locale } from "@/i18n/config"
import { LeadershipTabsV2, type LeaderItem } from "./LeadershipTabsV2"
import { MembersScrollV2, type MemberItem } from "./MembersScrollV2"
import { HeroAnimations } from "./HeroAnimations"
import { getStaticTexts } from "@/lib/static-texts"
import "./styles.css"

export const revalidate = 600

/** Leaders + VIP/INFINITE members — cache 10 phút để share giữa các visitor. */
const getLeadersAndMembers = unstable_cache(
  () =>
    Promise.all([
      prisma.leader.findMany({
        where: { isActive: true },
        orderBy: [{ term: "desc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          name: true, name_en: true, name_zh: true, name_ar: true,
          honorific: true, honorific_en: true, honorific_zh: true, honorific_ar: true,
          title: true, title_en: true, title_zh: true, title_ar: true,
          workTitle: true, workTitle_en: true, workTitle_zh: true, workTitle_ar: true,
          bio: true, bio_en: true, bio_zh: true, bio_ar: true,
          photoUrl: true,
          term: true,
          category: true,
          user: { select: { avatarUrl: true, bio: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: { in: ["VIP", "INFINITE"] }, isActive: true },
        orderBy: [
          { contributionTotal: "desc" },
          { displayPriority: "desc" },
          { createdAt: "asc" },
        ],
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          company: {
            select: { name: true, logoUrl: true, representativePosition: true },
          },
        },
      }),
    ]),
  ["gioi-thieu_leaders_members"],
  { revalidate: 600, tags: ["gioi-thieu", "leaders", "members"] },
)

export async function generateMetadata() {
  const t = await getTranslations("about")
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  }
}

function buildOrgJsonLd(associationEmail: string | null) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hội Trầm Hương Việt Nam",
    alternateName: "VAWA — Vietnam Agarwood Association",
    url: "https://hoitramhuong.vn",
    logo: "https://hoitramhuong.vn/logo.png",
    foundingDate: "2010-01-11",
    description:
      "Tổ chức xã hội nghề nghiệp kết nối, phát triển cộng đồng doanh nghiệp trầm hương Việt Nam.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Số 150, Đường Lý Chính Thắng, Phường Xuân Hòa",
      addressLocality: "Thành phố Hồ Chí Minh",
      postalCode: "700000",
      addressCountry: "VN",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: "+84-913-810-060",
        contactType: "Chairman",
        ...(associationEmail ? { email: associationEmail } : {}),
      },
      {
        "@type": "ContactPoint",
        telephone: "+84-938-334-647",
        contactType: "Vice Chairman",
      },
    ],
    sameAs: ["https://www.facebook.com/hoitramhuongvietnam.org"],
  }
}

const FOUNDING_YEAR = 2010

export default async function GioiThieuV2Page() {
  const locale = (await getLocale()) as Locale

  const [rawLeaders, rawMembers, t, emailRow] = await Promise.all([
    getLeadersAndMembers().then((res) => res[0]),
    getLeadersAndMembers().then((res) => res[1]),
    getStaticTexts("about", locale),
    prisma.siteConfig.findUnique({ where: { key: "association_email" } }),
  ])
  const associationEmail = emailRow?.value ?? null
  const orgJsonLd = buildOrgJsonLd(associationEmail)
  const totalMemberCount = rawMembers.length

  const currentTerm = rawLeaders[0]?.term ?? null
  const l = <T extends Record<string, unknown>>(record: T, field: string) =>
    localize(record, field, locale) as string | null

  const allLeaders: LeaderItem[] = rawLeaders.map((leader) => ({
    id: leader.id,
    name: l(leader, "name") ?? leader.name,
    honorific: l(leader, "honorific"),
    title: l(leader, "title") ?? leader.title,
    titleVi: leader.title,
    workTitle: l(leader, "workTitle"),
    bio: l(leader, "bio") ?? leader.user?.bio ?? null,
    photoUrl: leader.photoUrl ?? leader.user?.avatarUrl ?? null,
    term: leader.term,
    category: leader.category as "BTV" | "BCH" | "BKT" | "HDTD",
  }))
  // Chỉ hiển thị nhiệm kỳ hiện tại
  const currentLeaders = allLeaders.filter((l) => l.term === currentTerm)
  const currentLeaderCount = currentLeaders.length

  const members: MemberItem[] = rawMembers.map((m) => ({
    id: m.id,
    name: m.name,
    avatarUrl: m.avatarUrl ?? m.company?.logoUrl ?? null,
    companyName: m.company?.name ?? null,
    position: m.company?.representativePosition ?? null,
  }))

  const yearsActive = new Date().getFullYear() - FOUNDING_YEAR

  return (
    <div className="gtv2-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* 1. HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-rings" />
        <div className="hero-logo">
          <img src="/logo.png" alt="Logo Hội Trầm Hương Việt Nam — VAWA" />
        </div>
        <div className="hero-inner">
          <div className="eyebrow hero-eyebrow">
            {t("heroEyebrow")}
          </div>
          <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("heroTitle") }} />
          <p className="hero-sub">
            {t("heroSub")}
          </p>
          <div className="hero-logo hero-logo-mobile">
            <img src="/logo.png" alt="Logo Hội Trầm Hương Việt Nam — VAWA" />
          </div>
          <div className="hero-meta">
            <div className="hero-meta-item">
              <div className="hero-meta-label">{t("heroMetaFoundedLabel")}</div>
              <div className="hero-meta-value">{t("heroMetaFoundedValue")}</div>
            </div>
            <div className="hero-meta-item">
              <div className="hero-meta-label">{t("heroMetaHQLabel")}</div>
              <div className="hero-meta-value">{t("heroMetaHQValue")}</div>
            </div>
            <div className="hero-meta-item">
              <div className="hero-meta-label">{t("heroMetaScopeLabel")}</div>
              <div className="hero-meta-value">{t("heroMetaScopeValue")}</div>
            </div>
          </div>
        </div>
        <div className="hero-scroll">{t("heroScroll")}</div>
      </section>

      {/* 2. STATS */}
      <section className="stats">
        <div className="stats-grid">
          <div className="stat reveal">
            <div className="stat-num" data-counter={String(yearsActive)}>
              <em>+</em>
            </div>
            <div className="stat-label">{t("statYearsActive")}</div>
          </div>
          <div className="stat reveal">
            <div className="stat-num" data-counter={String(totalMemberCount)}>
              <em>+</em>
            </div>
            <div className="stat-label">{t("statMembersLabel")}</div>
          </div>
          <div className="stat reveal">
            <div className="stat-num" data-counter={String(currentLeaderCount)}></div>
            <div className="stat-label">{t("statLeadersLabel")}</div>
          </div>
          <div className="stat reveal">
            <div className="stat-num" data-counter="4"></div>
            <div className="stat-label">{t("statLanguagesLabel")}</div>
          </div>
        </div>
      </section>

      {/* 3. INTRO */}
      <section className="section intro">
        <div className="container">
          <div className="intro-grid">
            <div className="intro-text reveal reveal-from-bottom">
              <div className="eyebrow">{t("introEyebrow")}</div>
              <h2 className="display-1" dangerouslySetInnerHTML={{ __html: t("introTitle") }} />
              <p className="lead" dangerouslySetInnerHTML={{ __html: t("introLead1") }} />
              <p className="lead" dangerouslySetInnerHTML={{ __html: t("introLead2") }} />
              <blockquote className="intro-quote">
                &ldquo;{t("introQuote")}&rdquo;
              </blockquote>
            </div>
            <div className="intro-image reveal reveal-from-right">
              <img
                src={t("introImage") || "/rung-gio-bau.jpg"}
                alt={t("introImageCaption")}
              />
              <div className="intro-image-tag">{t("introImageCaption")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. LEADERSHIP */}
      <section className="section leadership">
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">{t("leadershipEyebrow")}</div>
            <h2
              className="display-1"
              style={{ marginTop: "1.25rem" }}
              dangerouslySetInnerHTML={{ __html: t("leadershipHeading") }}
            />
          </div>
          <LeadershipTabsV2 leaders={currentLeaders} />
        </div>
      </section>

      {/* 5. ORG CHART */}
      <section className="section org">
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">{t("orgEyebrow")}</div>
            <h2 className="display-1" style={{ marginTop: "1.25rem" }}>
              {t("orgTitle")}
            </h2>
            <p className="lead" style={{ marginTop: "1.25rem", color: "var(--gray-500)" }}>
              {t("orgSub")}
            </p>
          </div>

          <div className="org-tree reveal">
            <div className="org-node primary">{t("congress")}</div>
            <div className="org-line"></div>
            <div className="org-node accent">{t("executiveBoard")}</div>
            <div className="org-line"></div>
            <div className="org-node">{t("standingBoard")}</div>
            <div className="org-line"></div>
            <div className="org-row">
              <div className="org-leaf">
                <div className="org-line"></div>
                <div className="org-node">{t("inspectionBoard")}</div>
              </div>
              <div className="org-leaf">
                <div className="org-line"></div>
                <div className="org-node">{t("departments")}</div>
              </div>
              <div className="org-leaf">
                <div className="org-line"></div>
                <div className="org-node">{t("affiliates")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. MEMBERS */}
      <section className="section members">
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">{t("membersEyebrow")}</div>
            <h2
              className="display-1"
              style={{ marginTop: "1.25rem" }}
              dangerouslySetInnerHTML={{ __html: t("membersHeading") }}
            />
            <p className="lead" style={{ marginTop: "1.25rem", color: "var(--gray-500)" }}>
              {t("membersLead", { count: totalMemberCount })}
            </p>
          </div>
          <MembersScrollV2 members={members} totalCount={totalMemberCount} />
        </div>
      </section>

      {/* 7. CONTACT */}
      <section className="section contact">
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">{t("contactEyebrow")}</div>
            <h2
              className="display-1"
              style={{ marginTop: "1.25rem" }}
              dangerouslySetInnerHTML={{ __html: t("contactTitle") }}
            />
          </div>
          <div className="contact-grid">
            <div className="contact-map reveal">
              <iframe
                src="https://www.google.com/maps?q=10.785890,106.684595&hl=vi&z=18&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                title={t("mapTitle")}
              />
            </div>
            <div className="contact-card reveal">
              <div className="eyebrow">VAWA</div>
              <h3>{t("contactName")}</h3>
              <ul className="contact-list">
                <li>
                  <div className="ic">◎</div>
                  <div>{t("contactAddress")}</div>
                </li>
                <li>
                  <div className="ic">☏</div>
                  <div>0913 810 060 · 0938 334 647</div>
                </li>
                {associationEmail && (
                  <li>
                    <div className="ic">✉</div>
                    <div>{associationEmail}</div>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 8. CTA */}
      <section className="cta">
        <div className="cta-bg" />
        <div className="cta-inner reveal">
          <div className="eyebrow">{t("ctaEyebrow")}</div>
          <h2 dangerouslySetInnerHTML={{ __html: t("ctaTitle") }} />
          <p>{t("ctaDesc")}</p>
          <Link href={`/${locale}/dang-ky`} className="btn">
            {t("ctaButton")}
          </Link>
        </div>
      </section>

      <HeroAnimations />
    </div>
  )
}

