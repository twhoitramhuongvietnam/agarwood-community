import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserPermissions, hasPermission } from "@/lib/permissions"
import { uploadToDrive } from "@/lib/google-drive"

/**
 * Upload chứng từ Sổ quỹ Thu Chi lên Google Drive.
 *
 * Khác `/api/upload` (Cloudinary cho ảnh trang public) ở chỗ:
 *  - Lưu Drive folder `Chứng từ Thu Chi / {year}` để tài chính có lưu trữ
 *    chính thức, audit qua UI Drive được.
 *  - Chấp nhận image + PDF + Excel + Word.
 *  - Không transform — giữ nguyên file gốc (chữ ký, dấu, định dạng kế toán).
 *
 * Client tự nén ảnh trước upload (xem ReceiptUpload) để không gửi file
 * điện thoại 8MB lên Drive.
 *
 * Trả về metadata để TransactionForm lưu cả 4 column (receiptUrl,
 * receiptDriveFileId, receiptFileName, receiptMimeType).
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }
  const perms = await getUserPermissions(session.user.id)
  if (!hasPermission(perms, "ledger:write")) {
    return NextResponse.json({ error: "Không có quyền ghi sổ quỹ" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const yearRaw = formData.get("year")
  const year =
    typeof yearRaw === "string" && /^\d{4}$/.test(yearRaw)
      ? Number(yearRaw)
      : new Date().getFullYear()

  if (!file) {
    return NextResponse.json({ error: "Thiếu file" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = await uploadToDrive(
      buffer,
      file.name,
      file.type,
      "RECEIPT_THUCHI",
      year,
    )
    return NextResponse.json({
      receiptUrl: result.driveViewUrl,
      receiptDriveFileId: result.driveFileId,
      receiptFileName: result.fileName,
      receiptMimeType: result.mimeType,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload thất bại"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
