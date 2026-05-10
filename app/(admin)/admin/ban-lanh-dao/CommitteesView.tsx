import Link from "next/link"
import Image from "next/image"
import type { Committee } from "@prisma/client"
import { COMMITTEE_LABELS, COMMITTEE_DESCRIPTIONS } from "@/lib/permissions"
import type { CommitteeWithMembers } from "@/lib/committee-leader-bridge"
import { COMMITTEE_TO_LEADER_CATEGORY } from "@/lib/committee-leader-bridge"
import { CollapsibleCommitteeSection } from "./CollapsibleCommitteeSection"

/**
 * Admin view: list hội viên theo từng Ban. Dùng CommitteeMembership làm
 * source of truth. Hiển thị kèm flag "Có Leader profile" để admin biết
 * member nào đã có public display, member nào chưa.
 *
 * Flow khuyến nghị:
 *  1. Admin gán ban ở `/admin/hoi-vien/[id]` → membership được tạo
 *  2. Admin vào trang này → thấy member trong ban → click "Tạo Leader profile"
 *     → chuyển sang tab "Profile công khai" để điền ảnh/bio/term
 *  3. Member xuất hiện trên public `/ban-lanh-dao` (sau khi Leader isActive=true)
 *
 * Ban THU_KY + TRUYEN_THONG không có LeaderCategory mapping → hiển thị
 * "ban internal, không public" thay vì nút tạo profile.
 */
export function CommitteesView({
  data,
}: {
  data: CommitteeWithMembers[]
}) {
  // Đếm trên các committee public (có mapping LeaderCategory) — các ban
  // internal (THU_KY/TRUYEN_THONG) không vào thống kê profile.
  const publicMembers = data
    .filter((g) => COMMITTEE_TO_LEADER_CATEGORY[g.committee])
    .flatMap((g) => g.members)
  const totalPublic = publicMembers.length
  const withExact = publicMembers.filter(
    (m) => m.leaderProfile && !m.leaderProfile.crossCategory,
  ).length
  const withShared = publicMembers.filter(
    (m) => m.leaderProfile?.crossCategory,
  ).length
  const missing = totalPublic - withExact - withShared

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-brand-200 bg-brand-50/40 px-4 py-3 text-sm text-brand-800">
        <p>
          <strong>{totalPublic}</strong> lượt tham gia các ban công khai ·{" "}
          <strong className="text-emerald-700">{withExact}</strong> có profile
          riêng ·{" "}
          <strong className="text-sky-700">{withShared}</strong> dùng chung
          profile{" "}
          {missing > 0 && (
            <>
              ·{" "}
              <strong className="text-amber-700">{missing}</strong> chưa có
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-brand-500 leading-relaxed">
          Member được gán ban ở{" "}
          <Link href="/admin/hoi-vien" className="underline hover:text-brand-700">
            trang Hội viên
          </Link>
          . Profile công khai (Hướng C): 1 person = 1 Leader row là đủ —
          system tự áp dụng profile đó vào mọi ban người đó thuộc (badge{" "}
          <span className="inline-flex items-center rounded bg-sky-50 px-1.5 text-sky-700 text-[10px] font-semibold">↺ Dùng chung</span>
          ). Tạo/sửa profile ở tab &quot;Profile công khai&quot;.
        </p>
      </div>

      {data.map((group) => {
        const leaderCat = COMMITTEE_TO_LEADER_CATEGORY[group.committee]
        const isInternal = !leaderCat
        const missing = group.members.filter((m) => !m.leaderProfile).length
        return (
          <CommitteeSection
            key={group.committee}
            committee={group.committee}
            members={group.members}
            isInternal={isInternal}
            missing={missing}
          />
        )
      })}
    </div>
  )
}

function CommitteeSection({
  committee,
  members,
  isInternal,
  missing,
}: {
  committee: Committee
  members: CommitteeWithMembers["members"]
  isInternal: boolean
  missing: number
}) {
  const statusRight = (
    <div className="text-right text-xs text-brand-600">
      <p>
        <strong>{members.length}</strong> thành viên
      </p>
      {isInternal ? (
        <p className="mt-0.5 text-brand-400">Ban nội bộ, không public</p>
      ) : missing > 0 ? (
        <p className="mt-0.5 text-amber-700">{missing} chưa có profile</p>
      ) : members.length === 0 ? (
        <p className="mt-0.5 text-brand-400">Chưa có thành viên</p>
      ) : (
        <p className="mt-0.5 text-emerald-600">✓ Đầy đủ</p>
      )}
    </div>
  )

  return (
    <CollapsibleCommitteeSection
      title={COMMITTEE_LABELS[committee]}
      // Chỉ ban nội bộ (THU_KY/TRUYEN_THONG) hiện diễn giải quyền — ban lãnh
      // đạo công khai bỏ subtitle để header gọn (yêu cầu khách 2026-04).
      subtitle={isInternal ? COMMITTEE_DESCRIPTIONS[committee] : undefined}
      statusRight={statusRight}
    >
      {members.length === 0 ? (
        <div className="p-8 text-center text-sm text-brand-400 italic">
          Chưa có thành viên. Gán hội viên ở{" "}
          <Link
            href="/admin/hoi-vien"
            className="underline hover:text-brand-700 not-italic"
          >
            trang Hội viên
          </Link>
          .
        </div>
      ) : (
        <ul className="divide-y divide-brand-100">
          {members.map((m) => (
            <MemberRow key={m.membershipId} member={m} isInternal={isInternal} />
          ))}
        </ul>
      )}
    </CollapsibleCommitteeSection>
  )
}

function MemberRow({
  member,
  isInternal,
}: {
  member: CommitteeWithMembers["members"][number]
  isInternal: boolean
}) {
  const hasProfile = !!member.leaderProfile
  return (
    // Mobile: stack cột (avatar+info hàng 1, badge profile dưới) — tránh
    // tình huống cột phải `shrink-0` ngốn ~140px khiến name wrap mỗi từ.
    // sm trở lên: layout 3 cột như trước.
    <li className="flex flex-col gap-2 px-3 py-3 hover:bg-brand-50/40 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex items-start gap-3 min-w-0 flex-1 sm:items-center sm:gap-4">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand-100">
          {member.user.avatarUrl ? (
            <Image
              src={member.user.avatarUrl}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-bold text-brand-500">
              {member.user.name.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Name + INFINITE badge cùng dòng — đảm bảo name không bị
              email/role chen chân làm wrap mỗi từ. */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/hoi-vien/${member.user.id}`}
              className="font-semibold text-brand-900 hover:underline"
            >
              {member.user.name}
            </Link>
            {member.user.role === "INFINITE" && (
              <span className="inline-flex items-center rounded-full bg-gray-900 text-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                ∞
              </span>
            )}
          </div>
          {/* Email tách dòng — `truncate` chống email dài đẩy width parent.
              Mobile thấy đầy đủ nhờ width 100% của parent cột. */}
          <p className="mt-0.5 text-xs text-brand-500 truncate">
            {member.user.email}
          </p>
          <p className="mt-0.5 text-xs text-brand-600">
            {member.position ? (
              <span className="font-medium">{member.position}</span>
            ) : (
              <span className="italic text-brand-400">(chưa đặt vai trò)</span>
            )}
            {member.user.company?.name && (
              <span className="ml-2 text-brand-400">· {member.user.company.name}</span>
            )}
          </p>
        </div>
      </div>

      {/* Badge profile — mobile: indent ngang avatar (52px = 40 avatar + 12 gap)
          để align với phần info, không flush sát mép. sm+: shrink-0 text-right
          giữ layout cũ. */}
      <div className="ml-[52px] sm:ml-0 sm:shrink-0 sm:text-right">
        {isInternal ? (
          <span className="text-[11px] text-brand-400 italic">
            (không public)
          </span>
        ) : hasProfile ? (
          <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end sm:gap-0.5">
            {member.leaderProfile?.crossCategory ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-medium text-sky-700"
                title="Profile này gốc ở ban khác, được share cho ban hiện tại (Hướng C)"
              >
                ↺ Dùng chung profile
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                {member.leaderProfile?.hasPhoto ? "✓" : "◐"} Có profile
              </span>
            )}
            <span className="text-[10px] text-brand-400">
              {member.leaderProfile?.term}
              {!member.leaderProfile?.isActive && " · ẩn"}
            </span>
          </div>
        ) : (
          <Link
            href="/admin/ban-lanh-dao?tab=profiles"
            className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
          >
            + Tạo profile công khai
          </Link>
        )}
      </div>
    </li>
  )
}
