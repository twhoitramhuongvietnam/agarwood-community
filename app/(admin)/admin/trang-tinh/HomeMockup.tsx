"use client"

import { cn } from "@/lib/utils"
import type { StaticPageConfig } from "@prisma/client"

interface Props {
  selectedKey: string | null
  onSelect: (key: string) => void
  configMap: Record<string, StaticPageConfig>
  defaultValues: Record<string, string>
}

export function HomeMockup({ selectedKey, onSelect, configMap, defaultValues }: Props) {
  return (
    <div className="bg-white border border-brand-200 rounded-lg shadow-sm overflow-hidden text-[10px]">
      {/* ── Browser Header ── */}
      <div className="bg-brand-50 border-b border-brand-100 px-3 py-1.5 flex items-center gap-1.5">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <div className="bg-white border border-brand-100 rounded px-2 py-0.5 flex-1 mx-4 text-center text-brand-400 truncate">
          hoitramhuong.vn/
        </div>
      </div>

      <div className="flex flex-col">
        {/* ── Decorative homepage skeleton (non-editable) ── */}
        <section className="relative bg-brand-50/30 px-6 py-6 border-b border-brand-100">
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-brand-100 text-brand-500 text-[7px] font-bold uppercase tracking-wider">
            Body trang chủ — không edit ở đây
          </div>
          {/* Hero skeleton */}
          <div className="space-y-2 mt-3">
            <div className="h-3 w-1/3 bg-brand-200/70 rounded" />
            <div className="h-5 w-3/4 bg-brand-300/70 rounded" />
            <div className="h-2 w-2/3 bg-brand-200/50 rounded" />
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-16/10 bg-brand-200/40 rounded" />
              ))}
            </div>
          </div>
          <p className="mt-3 text-[7px] text-brand-400 italic text-center">
            Trang chủ body (banners, news, products...) chưa cấu hình qua CMS
          </p>
        </section>

        {/* ── Footer (TOÀN BỘ EDITABLE) ── */}
        <footer className="relative bg-brand-900 text-neutral-200 px-6 py-6">
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[7px] font-bold uppercase tracking-wider z-10">
            Chân trang — chỉnh tại đây
          </div>

          <div className="grid grid-cols-6 gap-3 mt-4">
            {/* Brand block (col-span-2) */}
            <div className="col-span-2 space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 bg-brand-700 rounded-sm shrink-0" />
                <div className="text-[8px] font-bold text-white uppercase">
                  Hội Trầm Hương Việt Nam
                </div>
              </div>
              <EditableArea
                itemKey="brandDescDefault"
                label="Kết nối cộng đồng doanh nghiệp trầm hương..."
                value={configMap["brandDescDefault"]?.value}
                defaultValue={defaultValues["brandDescDefault"]}
                selectedKey={selectedKey}
                onSelect={onSelect}
                className="text-[8px] text-neutral-300 leading-relaxed"
              />
              <EditableArea
                itemKey="establishedNotice"
                label="Thành lập theo Quyết định 23/QĐ-BNV..."
                value={configMap["establishedNotice"]?.value}
                defaultValue={defaultValues["establishedNotice"]}
                selectedKey={selectedKey}
                onSelect={onSelect}
                className="text-[7px] text-neutral-400 leading-relaxed"
              />
              {/* Anti-copy sticky note */}
              <div className="border-l-2 border-amber-400 bg-amber-50/95 px-1.5 py-1">
                <EditableArea
                  itemKey="copyrightNoticeDefault"
                  label="⚠ Cấm sao chép dưới mọi hình thức..."
                  value={configMap["copyrightNoticeDefault"]?.value}
                  defaultValue={defaultValues["copyrightNoticeDefault"]}
                  selectedKey={selectedKey}
                  onSelect={onSelect}
                  className="text-[7px] text-amber-900 leading-relaxed"
                />
              </div>
            </div>

            {/* Leadership column */}
            <div className="space-y-1.5">
              <EditableArea
                itemKey="leadership"
                label="Lãnh đạo"
                value={configMap["leadership"]?.value}
                defaultValue={defaultValues["leadership"]}
                selectedKey={selectedKey}
                onSelect={onSelect}
                className="text-[8px] font-bold uppercase tracking-wide text-white"
              />
              <ul className="space-y-1 text-[8px] text-neutral-300">
                <li className="space-y-0">
                  <EditableArea
                    itemKey="chairman"
                    label="Chủ tịch"
                    value={configMap["chairman"]?.value}
                    defaultValue={defaultValues["chairman"]}
                    selectedKey={selectedKey}
                    onSelect={onSelect}
                    className="text-[7px] uppercase tracking-wide text-neutral-400"
                  />
                  <div className="font-semibold text-white text-[8px]">Phạm Văn Du</div>
                </li>
                <li className="space-y-0">
                  <EditableArea
                    itemKey="viceChairman"
                    label="Phó Chủ tịch"
                    value={configMap["viceChairman"]?.value}
                    defaultValue={defaultValues["viceChairman"]}
                    selectedKey={selectedKey}
                    onSelect={onSelect}
                    className="text-[7px] uppercase tracking-wide text-neutral-400"
                  />
                  <div className="text-[8px]">Nguyễn Văn Hùng</div>
                </li>
                <li className="space-y-0">
                  <EditableArea
                    itemKey="secretaryGeneral"
                    label="Tổng Thư ký"
                    value={configMap["secretaryGeneral"]?.value}
                    defaultValue={defaultValues["secretaryGeneral"]}
                    selectedKey={selectedKey}
                    onSelect={onSelect}
                    className="text-[7px] uppercase tracking-wide text-neutral-400"
                  />
                </li>
                <li className="space-y-0">
                  <EditableArea
                    itemKey="chiefOfOffice"
                    label="Chánh Văn Phòng"
                    value={configMap["chiefOfOffice"]?.value}
                    defaultValue={defaultValues["chiefOfOffice"]}
                    selectedKey={selectedKey}
                    onSelect={onSelect}
                    className="text-[7px] uppercase tracking-wide text-neutral-400"
                  />
                </li>
              </ul>
            </div>

            {/* Quick links column */}
            <div className="space-y-1.5">
              <EditableArea
                itemKey="quickLinks"
                label="Liên kết nhanh"
                value={configMap["quickLinks"]?.value}
                defaultValue={defaultValues["quickLinks"]}
                selectedKey={selectedKey}
                onSelect={onSelect}
                className="text-[8px] font-bold uppercase tracking-wide text-white"
              />
              <ul className="space-y-0.5 text-[8px] text-neutral-300">
                <li>Giới thiệu</li>
                <li>Điều lệ</li>
                <li>Lãnh đạo</li>
                <li>Tin tức</li>
                <li>Nghiên cứu</li>
              </ul>
              <p className="text-[6px] text-neutral-500 italic">
                Nhãn link trong navbar
              </p>
            </div>

            {/* Contact column */}
            <div className="space-y-1.5">
              <EditableArea
                itemKey="contact"
                label="Liên hệ"
                value={configMap["contact"]?.value}
                defaultValue={defaultValues["contact"]}
                selectedKey={selectedKey}
                onSelect={onSelect}
                className="text-[8px] font-bold uppercase tracking-wide text-white"
              />
              <div className="text-[7px] text-neutral-300 leading-relaxed">
                Số 150, Lý Chính Thắng,
                <br />
                P. Xuân Hòa, TP. HCM
                <br />
                <span className="text-neutral-400">hoitramhuongvietnam2010@gmail.com</span>
              </div>
            </div>

            {/* Working hours column */}
            <div className="space-y-1.5">
              <EditableArea
                itemKey="workingHours"
                label="Giờ làm việc"
                value={configMap["workingHours"]?.value}
                defaultValue={defaultValues["workingHours"]}
                selectedKey={selectedKey}
                onSelect={onSelect}
                className="text-[8px] font-bold uppercase tracking-wide text-white"
              />
              <EditableArea
                itemKey="workingHoursDefault"
                label="Thứ 2 - Thứ 6: 8:00 - 17:00"
                value={configMap["workingHoursDefault"]?.value}
                defaultValue={defaultValues["workingHoursDefault"]}
                selectedKey={selectedKey}
                onSelect={onSelect}
                className="text-[7px] text-neutral-300 leading-relaxed"
              />
              <div className="inline-flex h-4 w-4 items-center justify-center border border-neutral-500 text-[7px] font-bold text-neutral-300 mt-1">
                f
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-brand-800 mt-4 pt-2 flex justify-between items-center gap-2 flex-wrap">
            <EditableArea
              itemKey="copyright"
              label="© {year} Hội Trầm Hương Việt Nam. Mọi quyền được bảo lưu."
              value={configMap["copyright"]?.value}
              defaultValue={defaultValues["copyright"]}
              selectedKey={selectedKey}
              onSelect={onSelect}
              className="text-[7px] text-neutral-400"
            />
            <div className="flex gap-3">
              <EditableArea
                itemKey="privacyPolicy"
                label="Chính sách bảo mật"
                value={configMap["privacyPolicy"]?.value}
                defaultValue={defaultValues["privacyPolicy"]}
                selectedKey={selectedKey}
                onSelect={onSelect}
                className="text-[7px] text-neutral-400 hover:text-white"
              />
              <EditableArea
                itemKey="termsOfService"
                label="Điều khoản sử dụng"
                value={configMap["termsOfService"]?.value}
                defaultValue={defaultValues["termsOfService"]}
                selectedKey={selectedKey}
                onSelect={onSelect}
                className="text-[7px] text-neutral-400 hover:text-white"
              />
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

function EditableArea({
  itemKey,
  label,
  value,
  defaultValue,
  selectedKey,
  onSelect,
  className,
}: {
  itemKey: string
  label: string
  value?: string
  defaultValue?: string
  selectedKey: string | null
  onSelect: (key: string) => void
  className?: string
}) {
  const isSelected = selectedKey === itemKey
  const displayValue = value || defaultValue

  return (
    <button
      type="button"
      onClick={() => onSelect(itemKey)}
      className={cn(
        "group relative block w-full rounded-md transition-all duration-200 min-h-[1.5em] text-left",
        isSelected
          ? "bg-amber-100 ring-2 ring-amber-500 ring-offset-2 z-10"
          : "hover:bg-amber-50/50 hover:ring-2 hover:ring-amber-300 ring-offset-1",
        !displayValue && "bg-brand-100/30",
        className,
      )}
    >
      <span className={cn("block px-1.5 py-0.5", !displayValue && "text-brand-400 italic font-normal")}>
        {displayValue || label}
      </span>
      <span
        className={cn(
          "absolute -top-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider whitespace-nowrap transition-opacity pointer-events-none z-20",
          isSelected
            ? "bg-amber-500 text-white opacity-100"
            : "bg-amber-200 text-amber-800 opacity-0 group-hover:opacity-100",
        )}
      >
        {itemKey}
      </span>
    </button>
  )
}
