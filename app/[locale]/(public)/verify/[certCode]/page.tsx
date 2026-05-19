import QRCode from "qrcode"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { PrintButton } from "./PrintButton"

export const revalidate = 300

type Props = { params: Promise<{ certCode: string }> }

const CERT_CODE_PATTERN = /^HTHVN-\d{4}-\d{4,}$/

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { certCode } = await params
  return {
    title: `Xác minh chứng nhận ${certCode} | Hội Trầm Hương Việt Nam`,
  }
}

async function resolveCertification(code: string) {
  // Ưu tiên lookup bằng certCode chính thức (HTHVN-YYYY-NNNN).
  if (CERT_CODE_PATTERN.test(code)) {
    const cert = await prisma.certification.findUnique({
      where: { certCode: code },
      include: {
        product: {
          select: {
            name: true,
            slug: true,
            category: true,
            certStatus: true,
            certApprovedAt: true,
            certExpiredAt: true,
            company: { select: { name: true, slug: true } },
          },
        },
        reviews: {
          orderBy: { createdAt: "asc" },
          include: {
            reviewer: { select: { name: true } },
          },
        },
      },
    })
    return cert
  }

  // Fallback: legacy QR code dùng product slug (cert chưa có certCode do seed trước Sprint 3).
  const product = await prisma.product.findUnique({
    where: { slug: code },
    select: {
      name: true,
      slug: true,
      certStatus: true,
      certApprovedAt: true,
      certExpiredAt: true,
      company: { select: { name: true, slug: true } },
      certifications: {
        where: { status: "APPROVED" },
        orderBy: { approvedAt: "desc" },
        take: 1,
        include: {
          reviews: {
            orderBy: { createdAt: "asc" },
            include: { reviewer: { select: { name: true } } },
          },
        },
      },
    },
  })
  if (!product) return null
  const latestCert = product.certifications[0]
  if (!latestCert) {
    // Sản phẩm có certStatus=APPROVED nhưng không qua workflow (seed / legacy) → vẫn trả metadata tối thiểu.
    return {
      id: "legacy",
      certCode: null,
      approvedAt: product.certApprovedAt,
      rejectedAt: null,
      reviewMode: null,
      status: product.certStatus,
      productSalePrice: null,
      govCertNumber: null,
      govCertIssuer: null,
      govCertIssuedAt: null,
      product: {
        name: product.name,
        slug: product.slug,
        category: null as string | null,
        certStatus: product.certStatus,
        certApprovedAt: product.certApprovedAt,
        certExpiredAt: product.certExpiredAt,
        company: product.company,
      },
      reviews: [] as Array<{ id: string; comment: string | null; reviewer: { name: string } }>,
    }
  }
  return {
    id: latestCert.id,
    certCode: latestCert.certCode,
    approvedAt: latestCert.approvedAt,
    rejectedAt: latestCert.rejectedAt,
    reviewMode: latestCert.reviewMode,
    status: product.certStatus,
    productSalePrice: latestCert.productSalePrice,
    govCertNumber: latestCert.govCertNumber,
    govCertIssuer: latestCert.govCertIssuer,
    govCertIssuedAt: latestCert.govCertIssuedAt,
    product: {
      name: product.name,
      slug: product.slug,
      category: null,
      certStatus: product.certStatus,
      certApprovedAt: product.certApprovedAt,
      certExpiredAt: product.certExpiredAt,
      company: product.company,
    },
    reviews: latestCert.reviews.map((r) => ({ id: r.id, comment: r.comment, reviewer: r.reviewer })),
  }
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default async function VerifyPage({ params }: Props) {
  const { certCode } = await params
  const cert = await resolveCertification(certCode)

  if (!cert) {
    return <NotFound code={certCode} />
  }

  if (cert.product.certStatus !== "APPROVED") {
    return <NotApproved name={cert.product.name} />
  }

  // FAST_TRACK = trọn đời → certExpiredAt=null, skip expiry check. ONLINE/OFFLINE
  // có certExpiredAt → check như cũ.
  const isFastTrack = cert.reviewMode === "FAST_TRACK"
  const isExpired =
    !isFastTrack &&
    cert.product.certExpiredAt &&
    new Date(cert.product.certExpiredAt) < new Date()
  if (isExpired) {
    return <Expired name={cert.product.name} />
  }

  const siteUrl = process.env.NEXTAUTH_URL ?? ""
  const verifyUrl = `${siteUrl}/verify/${cert.certCode ?? cert.product.slug}`
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 180,
    color: { dark: "#1a5632", light: "#ffffff" },
  })

  const displayDate = formatDate(cert.approvedAt ?? cert.product.certApprovedAt)
  const displayExpiredAt = isFastTrack
    ? "Trọn đời"
    : formatDate(cert.product.certExpiredAt)
  const displayCode = cert.certCode ?? "—"
  const govCertIssuedAtStr = cert.govCertIssuedAt
    ? formatDate(cert.govCertIssuedAt)
    : null

  return (
    <div className="bg-linear-to-br from-amber-50/40 via-white to-amber-50/40 min-h-screen py-8 print:bg-white print:py-0">
      {/* Print: ép khổ A4 ngang, bỏ margin để article fill cả tờ */}
      <style>{`@media print { @page { size: A4 landscape; margin: 0 } }`}</style>

      <div className="mx-auto max-w-[1180px] px-4 print:px-0 print:max-w-none">
        {/* Toolbar (hidden on print) */}
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Link href="/" className="text-sm text-brand-600 hover:text-brand-800 underline">
            ← Về trang chủ
          </Link>
          <PrintButton />
        </div>

        {/* Certificate — landscape A4 (1.414:1). Layered borders + corner
            ornaments + watermark logo cho cảm giác bằng khen cao cấp. */}
        <article className="relative aspect-[1.414/1] overflow-hidden bg-[#fdf8ec] shadow-2xl print:shadow-none ring-1 ring-amber-900/10">
          {/* Outer thick gold band */}
          <div className="absolute inset-0 border-10 border-amber-700 print:border-8" />
          {/* Inner thin gold rule */}
          <div className="pointer-events-none absolute inset-[18px] border border-amber-600/70" />
          {/* Even tighter inner rule for double-line elegance */}
          <div className="pointer-events-none absolute inset-[24px] border border-amber-500/40" />

          {/* Corner ornaments — fleurons tạo điểm nhấn 4 góc */}
          {(["top-[14px] left-[14px]", "top-[14px] right-[14px]", "bottom-[14px] left-[14px]", "bottom-[14px] right-[14px]"] as const).map((pos, i) => (
            <span
              key={i}
              aria-hidden
              className={`absolute ${pos} h-8 w-8 text-amber-700 select-none`}
            >
              <svg viewBox="0 0 32 32" className="h-full w-full">
                <path
                  d="M2 2 L14 2 M2 2 L2 14 M6 2 L6 6 L2 6 M10 2 L10 4 L8 4 L8 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  transform={
                    i === 1
                      ? "translate(32 0) scale(-1 1)"
                      : i === 2
                        ? "translate(0 32) scale(1 -1)"
                        : i === 3
                          ? "translate(32 32) scale(-1 -1)"
                          : undefined
                  }
                />
              </svg>
            </span>
          ))}

          {/* Watermark logo — center, mờ, dùng làm anti-counterfeit visual */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.05]">
            <Image
              src="/logo.png"
              alt=""
              width={520}
              height={520}
              className="h-[60%] w-auto"
            />
          </div>

          {/* Content layer */}
          <div className="relative h-full flex flex-col px-14 py-8 print:px-16 print:py-10">
            {/* ── Header band ─────────────────────────────────────────── */}
            <header className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Hội Trầm Hương Việt Nam"
                  width={70}
                  height={70}
                  className="h-[60px] w-auto"
                />
                <div className="leading-tight">
                  <p className="text-[10px] tracking-[0.28em] text-amber-900 font-bold uppercase">
                    Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam
                  </p>
                  <p className="text-[10px] text-amber-800 italic">Độc lập — Tự do — Hạnh phúc</p>
                  <p className="text-[13px] font-bold text-amber-900 mt-1 tracking-wide">
                    HỘI TRẦM HƯƠNG VIỆT NAM
                  </p>
                  <p className="text-[9px] tracking-[0.25em] text-amber-700/80 uppercase">
                    Vietnam Agarwood Association
                  </p>
                </div>
              </div>

              {/* Cert code badge — góc phải, formal nhưng không lấn hero */}
              <div className="text-right">
                <p className="text-[9px] tracking-[0.3em] text-amber-700 uppercase">Mã chứng nhận</p>
                <p className="text-base font-mono font-bold text-amber-900 tracking-wide">
                  {displayCode}
                </p>
                <p className="text-[10px] text-amber-700 mt-0.5">Cấp ngày {displayDate}</p>
                <p className="text-[10px] text-amber-700 font-semibold">
                  {isFastTrack ? "Hiệu lực " : "Hiệu lực đến "}
                  {displayExpiredAt}
                </p>
              </div>
            </header>

            {/* ── Hero / Title ─────────────────────────────────────────── */}
            <div className="text-center mt-3">
              <p className="text-[11px] tracking-[0.5em] text-amber-700 uppercase">Giấy</p>
              <h1 className="font-serif-headline text-5xl text-amber-900 tracking-wide uppercase mt-1 leading-none print:text-[44pt]">
                Chứng Nhận Sản Phẩm
              </h1>
              {/* Ornamental divider: thin line — fleuron — thin line */}
              <div className="flex items-center justify-center gap-3 mt-2">
                <span className="h-px w-24 bg-linear-to-r from-transparent to-amber-700" />
                <span className="text-amber-700 text-base leading-none" aria-hidden>
                  ❦
                </span>
                <span className="h-px w-24 bg-linear-to-l from-transparent to-amber-700" />
              </div>
              <p className="text-[10px] tracking-[0.4em] text-amber-700/80 uppercase mt-1">
                Product Certification · VAWA
              </p>
            </div>

            {/* ── Body: product + company + praise ─────────────────────── */}
            <div className="text-center mt-4 px-8">
              <p className="text-sm text-amber-900 italic">Trân trọng chứng nhận sản phẩm</p>
              <p className="font-serif-headline text-3xl text-amber-950 mt-2 tracking-wide leading-tight print:text-[26pt]">
                &ldquo;{cert.product.name}&rdquo;
              </p>
              {cert.product.company && (
                <p className="text-base text-amber-800 mt-2">
                  của doanh nghiệp{" "}
                  <span className="font-semibold text-amber-950">
                    {cert.product.company.name}
                  </span>
                </p>
              )}
              {isFastTrack ? (
                <p className="text-[13px] text-amber-900 max-w-[680px] mx-auto leading-relaxed mt-3">
                  đã được <strong>Hội Trầm Hương Việt Nam</strong> xác minh và
                  cấp <strong>endorsement</strong> dựa trên Giấy chứng nhận của
                  cơ quan nhà nước có thẩm quyền
                  {cert.govCertIssuer && (
                    <>
                      {" "}
                      — <strong>{cert.govCertIssuer}</strong>
                    </>
                  )}
                  {cert.govCertNumber && (
                    <>
                      , số <strong className="font-mono">{cert.govCertNumber}</strong>
                    </>
                  )}
                  {govCertIssuedAtStr && (
                    <>
                      {" "}
                      cấp ngày <strong>{govCertIssuedAtStr}</strong>
                    </>
                  )}
                  .
                </p>
              ) : (
                <p className="text-[13px] text-amber-900 max-w-[680px] mx-auto leading-relaxed mt-3">
                  đã được <strong>Hội đồng thẩm định</strong> gồm{" "}
                  <strong>{cert.reviews.length || 5}</strong> thành viên của{" "}
                  <strong>Hội Trầm Hương Việt Nam</strong> xem xét, đánh giá và nhất
                  trí cấp chứng nhận theo đúng quy trình thẩm định.
                </p>
              )}
            </div>

            <div className="flex-1" />

            {/* ── Footer: 3-col QR | Council | Signature ──────────────── */}
            <footer className="grid grid-cols-12 items-end gap-6 pt-3 border-t border-amber-700/30">
              {/* QR + verify URL */}
              <div className="col-span-3 flex flex-col items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="QR xác minh"
                  className="w-[88px] h-[88px] rounded-sm border border-amber-700/30 bg-white p-1"
                />
                <p className="text-[9px] text-amber-700 mt-1.5 italic">
                  Quét QR để xác minh tại
                </p>
                <p className="text-[10px] font-mono text-amber-800 break-all">
                  {siteUrl.replace(/^https?:\/\//, "")}/verify/{displayCode}
                </p>
              </div>

              {/* Middle column: HĐTĐ list (ONLINE/OFFLINE) hoặc Endorsement
                  source (FAST_TRACK). Tuỳ loại đơn — mỹ thuật giữ chỗ. */}
              <div className="col-span-5 self-stretch flex flex-col">
                {isFastTrack ? (
                  <>
                    <p className="text-[9px] tracking-[0.35em] text-amber-700 uppercase text-center mb-2">
                      Endorsement nguồn gốc
                    </p>
                    <div className="text-center text-[11px] leading-tight text-amber-900 px-2 space-y-0.5">
                      <p className="font-semibold">{cert.govCertIssuer ?? "—"}</p>
                      <p className="font-mono text-[10px]">{cert.govCertNumber ?? "—"}</p>
                      {govCertIssuedAtStr && (
                        <p className="text-[10px] text-amber-700">
                          cấp {govCertIssuedAtStr}
                        </p>
                      )}
                      <p className="text-[9px] italic text-amber-700 mt-1">
                        Hội xác minh & cấp endorsement
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[9px] tracking-[0.35em] text-amber-700 uppercase text-center mb-2">
                      Hội đồng thẩm định
                    </p>
                    <ul className="grid grid-cols-1 gap-1 text-[12px] leading-tight text-amber-900 px-2">
                      {cert.reviews.slice(0, 5).map((r) => (
                        <li key={r.id} className="flex items-baseline gap-2 justify-center">
                          <span className="text-amber-700" aria-hidden>
                            ✦
                          </span>
                          <span className="font-medium">{r.reviewer.name}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* Signature + stamp */}
              <div className="col-span-4 flex flex-col items-center">
                <p className="text-[10px] text-amber-800 italic">T/M Ban Chấp hành</p>
                <p className="text-[13px] font-bold text-amber-900 tracking-wide">Chủ tịch Hội</p>
                <div className="relative h-[110px] w-[200px] mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/cert/signature-placeholder.svg"
                    alt="Chữ ký"
                    className="absolute left-0 top-2 w-[150px] h-auto"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/cert/stamp-placeholder.svg"
                    alt="Mộc đỏ"
                    className="absolute -top-1 right-0 w-[120px] h-[120px] opacity-90 mix-blend-multiply"
                  />
                </div>
              </div>
            </footer>
          </div>
        </article>

        {/* Meta info (hidden on print) */}
        <div className="mt-5 text-center text-xs text-brand-600 print:hidden">
          <p>
            Chứng nhận này được xác minh bởi Hội Trầm Hương Việt Nam. Nếu bạn nhận
            được sản phẩm với QR / mã chứng nhận này và nghi ngờ giả mạo, vui lòng
            liên hệ Hội.
          </p>
          {cert.product.slug && (
            <Link
              href={`/san-pham/${cert.product.slug}`}
              className="inline-block mt-2 text-brand-700 hover:text-brand-900 underline"
            >
              Xem trang sản phẩm →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Error states ────────────────────────────────────────────────────

function NotFound({ code }: { code: string }) {
  return (
    <div className="bg-brand-50/60 min-h-screen">
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-2xl">✗</span>
        </div>
        <h1 className="text-xl font-bold text-brand-900">Mã chứng nhận không hợp lệ</h1>
        <p className="text-sm text-brand-500">
          Không tìm thấy chứng nhận với mã &quot;{code}&quot;. Vui lòng kiểm tra lại mã trên
          bao bì sản phẩm.
        </p>
        <Link href="/" className="inline-block text-sm text-brand-600 hover:text-brand-800 underline">
          Về trang chủ
        </Link>
      </div>
    </div>
  )
}

function NotApproved({ name }: { name: string }) {
  return (
    <div className="bg-brand-50/60 min-h-screen">
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-yellow-100 flex items-center justify-center">
          <span className="text-2xl">⚠</span>
        </div>
        <h1 className="text-xl font-bold text-brand-900">Chứng nhận chưa có hiệu lực</h1>
        <p className="text-sm text-brand-500">
          Sản phẩm &quot;{name}&quot; chưa được Hội Trầm Hương Việt Nam chứng nhận hoặc đang
          trong quá trình xét duyệt.
        </p>
      </div>
    </div>
  )
}

function Expired({ name }: { name: string }) {
  return (
    <div className="bg-brand-50/60 min-h-screen">
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-2xl">⏰</span>
        </div>
        <h1 className="text-xl font-bold text-brand-900">Chứng nhận đã hết hiệu lực</h1>
        <p className="text-sm text-brand-500">
          Chứng nhận cho sản phẩm &quot;{name}&quot; đã hết hạn. Doanh nghiệp cần nộp đơn
          gia hạn.
        </p>
      </div>
    </div>
  )
}
