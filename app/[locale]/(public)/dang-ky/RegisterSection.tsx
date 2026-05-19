"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useTranslations, useLocale } from "next-intl"
import { GoogleSignUpButton } from "./GoogleSignUpButton"
import { RegisterForm } from "./RegisterForm"

export type AccountType = "BUSINESS" | "INDIVIDUAL"

/** Phiên bản điều khoản đăng ký hiện hành — đồng bộ với CURRENT_VERSION.REGISTRATION
 *  trong lib/terms.ts. Cookie + body submit đều mang version này. */
const TERMS_VERSION = "v1"

export function RegisterSection() {
  const t = useTranslations("registerSection")
  const locale = useLocale()
  const [accountType, setAccountType] = useState<AccountType>("BUSINESS")
  const [termsAccepted, setTermsAccepted] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <p className="block text-sm font-medium text-brand-800 mb-1">
          {t("selectRole")} <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-2 gap-3 mt-1">
          <button
            type="button"
            onClick={() => setAccountType("INDIVIDUAL")}
            className={cn(
              "rounded-lg border-2 p-3 text-left transition-colors",
              accountType === "INDIVIDUAL"
                ? "border-brand-600 bg-brand-50"
                : "border-brand-200 hover:border-brand-400",
            )}
          >
            <p className="font-semibold text-brand-900 text-sm">{t("individualLabel")}</p>
            <p className="text-xs text-brand-500 mt-0.5">{t("individualDesc")}</p>
          </button>
          <button
            type="button"
            onClick={() => setAccountType("BUSINESS")}
            className={cn(
              "rounded-lg border-2 p-3 text-left transition-colors",
              accountType === "BUSINESS"
                ? "border-brand-600 bg-brand-50"
                : "border-brand-200 hover:border-brand-400",
            )}
          >
            <p className="font-semibold text-brand-900 text-sm">{t("businessLabel")}</p>
            <p className="text-xs text-brand-500 mt-0.5">{t("businessDesc")}</p>
          </button>
        </div>
      </div>

      {/* Terms checkbox — must be checked BEFORE both Google + manual signup.
          Phiên bản đồng ý được lưu vào TermsAcceptance khi đăng ký thành công. */}
      <label
        htmlFor="reg-terms"
        className={cn(
          "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
          termsAccepted
            ? "border-brand-300 bg-brand-50/60"
            : "border-brand-200 bg-white hover:border-brand-300",
        )}
      >
        <input
          id="reg-terms"
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded accent-brand-700 shrink-0"
        />
        <span className="text-sm text-brand-800 leading-relaxed">
          Tôi đã đọc và đồng ý với{" "}
          <Link
            href={`/${locale}/dieu-khoan/REGISTRATION/${TERMS_VERSION}`}
            target="_blank"
            rel="noopener"
            className="font-semibold text-brand-700 underline hover:text-brand-900"
          >
            Cam kết hội viên Hội Trầm Hương Việt Nam ({TERMS_VERSION})
          </Link>
          .{" "}
          <span className="text-xs text-brand-500">
            Bắt buộc — đơn đăng ký sẽ không gửi được nếu chưa đồng ý.
          </span>
        </span>
      </label>

      <GoogleSignUpButton
        accountType={accountType}
        termsAccepted={termsAccepted}
        termsVersion={TERMS_VERSION}
      />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-brand-200" />
        <span className="text-xs text-brand-400">{t("orFillForm")}</span>
        <div className="flex-1 h-px bg-brand-200" />
      </div>

      <RegisterForm
        accountType={accountType}
        termsAccepted={termsAccepted}
        termsVersion={TERMS_VERSION}
      />
    </div>
  )
}
