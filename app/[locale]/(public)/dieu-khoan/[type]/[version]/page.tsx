import { notFound } from "next/navigation"
import DOMPurify from "isomorphic-dompurify"
import Link from "next/link"
import { getTermsDocument, CURRENT_VERSION, type TermsTypeKey } from "@/lib/terms"
import { TermsType } from "@prisma/client"

type Params = Promise<{ locale: string; type: string; version: string }>

const TYPE_LABEL: Record<TermsTypeKey, string> = {
  REGISTRATION: "Cam kết hội viên",
  PRODUCT_LISTING: "Cam kết đăng sản phẩm",
}

function isTermsType(v: string): v is TermsTypeKey {
  return v in TermsType
}

export async function generateMetadata({ params }: { params: Params }) {
  const { type, version } = await params
  if (!isTermsType(type)) return { title: "Điều khoản không tồn tại" }
  const doc = getTermsDocument(type, version)
  if (!doc) return { title: "Điều khoản không tồn tại" }
  return {
    title: `${doc.title} (${version})`,
    robots: { index: false, follow: true },
  }
}

export default async function TermsVersionPage({ params }: { params: Params }) {
  const { type, version } = await params
  if (!isTermsType(type)) notFound()
  const doc = getTermsDocument(type, version)
  if (!doc) notFound()

  const isCurrent = CURRENT_VERSION[type] === version
  const effective = new Date(doc.effectiveDate).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })

  return (
    <div className="bg-brand-50/60 min-h-screen">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="bg-white rounded-2xl border border-brand-200 shadow-sm p-6 sm:p-10 space-y-8">
          <header className="space-y-3 border-b border-brand-200 pb-6">
            <p className="text-xs uppercase tracking-wider font-semibold text-brand-500">
              {TYPE_LABEL[type]} — Phiên bản {version}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-brand-900">
              {doc.title}
            </h1>
            <p className="text-sm text-brand-500">
              Có hiệu lực từ: <strong>{effective}</strong>
              {!isCurrent && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Phiên bản lưu trữ (đã có bản mới)
                </span>
              )}
              {isCurrent && (
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  Phiên bản hiện hành
                </span>
              )}
            </p>
          </header>

          <article
            className="prose prose-brand max-w-none text-brand-800 prose-headings:text-brand-900 prose-strong:text-brand-900"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(doc.html) }}
          />

          <div className="border-t border-brand-200 pt-4 text-xs text-brand-500">
            <p>
              Bằng việc tích vào ô đồng ý và gửi đơn, bạn xác nhận đã đọc và
              hiểu toàn bộ nội dung trên. Hệ thống sẽ lưu lại thời điểm, địa
              chỉ IP và trình duyệt của bạn làm bằng chứng có thể trích xuất
              khi cơ quan chức năng yêu cầu hợp pháp.
            </p>
            <p className="mt-2">
              Trở lại{" "}
              <Link
                href={type === "REGISTRATION" ? "/dang-ky" : "/san-pham/tao-moi"}
                className="text-brand-700 underline font-medium"
              >
                {type === "REGISTRATION" ? "trang đăng ký" : "trang đăng sản phẩm"}
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
