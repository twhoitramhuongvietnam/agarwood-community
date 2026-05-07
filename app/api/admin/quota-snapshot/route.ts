import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canAdminWrite } from "@/lib/roles"
import { fetchAllServiceUsage, saveSnapshots } from "@/lib/quota-monitor"

/**
 * POST /api/admin/quota-snapshot
 *
 * Trigger fetcher tất cả service ngay → ghi snapshot. Dùng cho nút "Làm mới"
 * trên /admin/giam-sat.
 *
 * Manual entry đã bỏ — Vercel free tier không có Usage API → admin click
 * link tới Vercel Dashboard xem trực tiếp (không lưu vào DB).
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || !canAdminWrite(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Cho phép body rỗng — endpoint chỉ có 1 chế độ refresh.
  void req

  const snapshots = await fetchAllServiceUsage()
  const saved = await saveSnapshots(snapshots)
  return NextResponse.json({ saved, snapshots: snapshots.length })
}
