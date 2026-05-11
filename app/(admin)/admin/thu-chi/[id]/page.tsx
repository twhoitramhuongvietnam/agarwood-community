import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import { getActiveCategories, formatLedgerDate } from "@/lib/ledger"
import { formatVnd } from "@/lib/certification-fee"
import { TransactionForm } from "../_components/TransactionForm"
import { ChevronLeft, Receipt, FileText, FileSpreadsheet, File as FileIcon } from "lucide-react"

type Attachment = {
  driveFileId: string
  driveViewUrl: string
  fileName: string
  mimeType: string
}

/** Parse Json column attachments (Prisma trả JsonValue). Tolerant — bỏ qua item
 *  shape sai. */
function parseAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return []
  const out: Attachment[] = []
  for (const it of raw) {
    if (
      it &&
      typeof it === "object" &&
      typeof (it as Record<string, unknown>).driveFileId === "string" &&
      typeof (it as Record<string, unknown>).driveViewUrl === "string" &&
      typeof (it as Record<string, unknown>).fileName === "string" &&
      typeof (it as Record<string, unknown>).mimeType === "string"
    ) {
      out.push(it as Attachment)
    }
  }
  return out
}

export const revalidate = 0

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.id) notFound()
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "ledger:read")) notFound()
  const canWrite = hasPermission(perms, "ledger:write")

  const tx = await prisma.ledgerTransaction.findUnique({
    where: { id },
    include: {
      category: { select: { name: true, isSystem: true } },
      recordedBy: { select: { name: true, email: true } },
      payment: {
        select: {
          id: true,
          type: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  })
  if (!tx) notFound()

  // Read-only view cho người không có write perm
  if (!canWrite) {
    return (
      <div className="space-y-5 max-w-3xl">
        <div>
          <Link
            href="/admin/thu-chi/so-quy"
            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Sổ quỹ
          </Link>
          <h1 className="text-2xl font-bold text-brand-900 mt-1">Chi tiết giao dịch</h1>
        </div>
        <ReadOnlyView tx={tx} />
      </div>
    )
  }

  const categories = await getActiveCategories()

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/thu-chi/so-quy"
            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Sổ quỹ
          </Link>
          <h1 className="text-2xl font-bold text-brand-900 mt-1">Chi tiết giao dịch</h1>
          <p className="text-xs text-brand-500 mt-1">
            Ghi nhận bởi <strong>{tx.recordedBy.name}</strong> · {formatLedgerDate(tx.createdAt)}
          </p>
        </div>
      </div>

      <TransactionForm
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          isSystem: c.isSystem,
        }))}
        initial={{
          id: tx.id,
          type: tx.type,
          categoryId: tx.categoryId,
          amount: Number(tx.amount),
          transactionDate: tx.transactionDate.toISOString().slice(0, 10),
          paymentMethod: tx.paymentMethod,
          referenceNo: tx.referenceNo,
          description: tx.description,
          receiptUrl: tx.receiptUrl,
          attachments: parseAttachments(tx.attachments),
          isSystem: tx.isSystem,
          hasRelatedPayment: !!tx.relatedPaymentId,
        }}
      />

      {tx.payment && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 max-w-3xl">
          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">
            Liên kết payment
          </p>
          <p className="text-sm text-brand-800">
            {tx.payment.type} từ <strong>{tx.payment.user.name ?? tx.payment.user.email}</strong>
          </p>
          <Link
            href={`/admin/thanh-toan`}
            className="text-xs text-brand-600 hover:text-brand-800 inline-block mt-1"
          >
            → Xem trong /admin/thanh-toan
          </Link>
        </div>
      )}
    </div>
  )
}

function ReadOnlyView({
  tx,
}: {
  tx: {
    type: "INCOME" | "EXPENSE"
    amount: bigint
    transactionDate: Date
    description: string
    referenceNo: string | null
    receiptUrl: string | null
    attachments: unknown
    paymentMethod: "CASH" | "BANK"
    category: { name: string }
    recordedBy: { name: string }
    createdAt: Date
  }
}) {
  const attachments = parseAttachments(tx.attachments)
  return (
    <div className="bg-white border border-brand-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-baseline gap-3">
        <span
          className={`text-3xl font-bold tabular-nums ${
            tx.type === "INCOME" ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {tx.type === "INCOME" ? "+" : "−"}
          {formatVnd(Number(tx.amount))}
        </span>
        <span className="text-sm text-brand-500">{tx.category.name}</span>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-brand-500 text-xs uppercase tracking-wide">Ngày</dt>
          <dd className="text-brand-900">{formatLedgerDate(tx.transactionDate)}</dd>
        </div>
        <div>
          <dt className="text-brand-500 text-xs uppercase tracking-wide">Hình thức</dt>
          <dd className="text-brand-900">
            {tx.paymentMethod === "BANK" ? "Chuyển khoản" : "Tiền mặt"}
          </dd>
        </div>
        {tx.referenceNo && (
          <div>
            <dt className="text-brand-500 text-xs uppercase tracking-wide">Số phiếu / Mã GD</dt>
            <dd className="text-brand-900 font-mono">{tx.referenceNo}</dd>
          </div>
        )}
        <div>
          <dt className="text-brand-500 text-xs uppercase tracking-wide">Ghi nhận bởi</dt>
          <dd className="text-brand-900">
            {tx.recordedBy.name} · {formatLedgerDate(tx.createdAt)}
          </dd>
        </div>
      </dl>
      <div>
        <dt className="text-brand-500 text-xs uppercase tracking-wide">Diễn giải</dt>
        <dd className="text-brand-900 whitespace-pre-wrap mt-1">{tx.description}</dd>
      </div>
      {(attachments.length > 0 || tx.receiptUrl) && (
        <div className="space-y-2">
          <p className="text-brand-500 text-xs uppercase tracking-wide">
            Chứng từ {attachments.length > 0 && <span>({attachments.length})</span>}
          </p>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {attachments.map((a) => (
                <AttachmentTile key={a.driveFileId} attachment={a} />
              ))}
            </div>
          )}
          {tx.receiptUrl && (
            <a
              href={tx.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs text-amber-700 hover:text-amber-900 underline"
            >
              <Receipt className="h-3.5 w-3.5" /> Chứng từ cũ (Cloudinary)
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function AttachmentTile({ attachment }: { attachment: Attachment }) {
  const { driveFileId, driveViewUrl, fileName, mimeType } = attachment
  const isImage = mimeType.startsWith("image/")
  const thumb = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w400`
  return (
    <a
      href={driveViewUrl}
      target="_blank"
      rel="noreferrer"
      className="block w-44 rounded-lg border border-brand-200 bg-white p-2 hover:bg-brand-50"
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={fileName}
          className="h-28 w-full rounded object-cover bg-brand-50"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-28 w-full flex-col items-center justify-center rounded bg-brand-50 text-brand-600">
          <FileTypeIcon mime={mimeType} />
          <span className="mt-1 text-[10px] uppercase tracking-wide">
            {fileTypeLabel(mimeType, fileName)}
          </span>
        </div>
      )}
      <p
        className="mt-2 truncate text-xs font-medium text-brand-900"
        title={fileName}
      >
        {fileName}
      </p>
      <p className="text-[10px] text-brand-500">Mở trên Drive ↗</p>
    </a>
  )
}

function FileTypeIcon({ mime }: { mime: string }) {
  if (mime === "application/pdf") return <FileText className="h-8 w-8" />
  if (
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "text/csv"
  )
    return <FileSpreadsheet className="h-8 w-8" />
  return <FileIcon className="h-8 w-8" />
}

function fileTypeLabel(mime: string, fileName: string): string {
  if (mime === "application/pdf") return "PDF"
  if (
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return "Excel"
  if (mime === "text/csv") return "CSV"
  if (mime.includes("word")) return "Word"
  const ext = fileName.split(".").pop()?.toLowerCase()
  return ext ? ext.toUpperCase() : "File"
}
