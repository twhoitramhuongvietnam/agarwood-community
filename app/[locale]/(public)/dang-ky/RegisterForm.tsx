"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useTranslations, useLocale } from "next-intl"
import { COMPANY_FIELDS } from "@/lib/constants/agarwood"

type FormState = {
  name: string
  email: string
  phone: string
  companyName: string
  companyField: string
  address: string
  reason: string
  honeypot: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^(0|\+84)[0-9]{8,9}$/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeValidator(t: any) {
  return function validateField(name: keyof FormState, value: string, accountType?: string): string {
    switch (name) {
      case "name": return !value ? t("nameRequired") : value.length < 2 ? t("nameMin") : ""
      case "email": return !value ? t("emailRequired") : !EMAIL_RE.test(value) ? t("emailInvalid") : ""
      case "phone": return !value ? t("phoneRequired") : !PHONE_RE.test(value) ? t("phoneInvalid") : ""
      case "companyName": return accountType === "INDIVIDUAL" ? "" : !value ? t("companyRequired") : ""
      case "companyField": return accountType === "INDIVIDUAL" ? "" : !value ? t("industryRequired") : ""
      case "reason": return !value ? t("reasonRequired") : value.length < 10 ? t("reasonMin") : ""
      default: return ""
    }
  }
}

interface RegisterFormProps {
  accountType: "BUSINESS" | "INDIVIDUAL"
}

export function RegisterForm({ accountType }: RegisterFormProps) {
  const t = useTranslations("registerForm")
  const tFields = useTranslations("companyFields")
  const locale = useLocale()
  const validateField = makeValidator(t)

  const [form, setForm] = useState<FormState>({
    name: "", email: "", phone: "", companyName: "",
    companyField: "", address: "", reason: "", honeypot: "",
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState("")

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: validateField(name as keyof FormState, value, accountType) }))
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setErrors(prev => ({ ...prev, [name]: validateField(name as keyof FormState, value, accountType) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError("")

    const required: (keyof FormState)[] = accountType === "BUSINESS"
      ? ["name", "email", "phone", "companyName", "companyField", "reason"]
      : ["name", "email", "phone", "reason"]
    const newErrors: FormErrors = {}
    let hasError = false
    for (const field of required) {
      const err = validateField(field, form[field], accountType)
      if (err) { newErrors[field] = err; hasError = true }
    }
    if (hasError) { setErrors(newErrors); return }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, accountType }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        const data = await res.json()
        setServerError(data.error ?? t("genericError"))
      }
    } catch {
      setServerError(t("connectionError"))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-brand-200 p-8 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-bold text-brand-900">{t("successTitle")}</h2>
        <p className="text-sm text-brand-600">{t("successDesc")}</p>
        <p className="text-sm text-brand-500">
          {t("emailSentTo")} <strong>{form.email}</strong>.
        </p>
        <p className="text-xs text-brand-400">{t("checkSpam")}</p>
      </div>
    )
  }

  const inputClass = "w-full rounded-lg border border-brand-200 bg-white px-3 py-2.5 text-sm text-brand-900 placeholder:text-brand-300 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 transition-colors"
  const labelClass = "block text-sm font-medium text-brand-800 mb-1"
  const errorClass = "text-xs text-red-600 mt-1"

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {serverError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{serverError}</div>
      )}

      {/* Honeypot */}
      <input type="text" name="honeypot" value={form.honeypot} onChange={handleChange} className="hidden" tabIndex={-1} autoComplete="off" />

      {/* Personal info */}
      <p className="text-sm font-semibold text-brand-500 uppercase tracking-wide">{t("personalInfo")}</p>

      <div>
        <label htmlFor="reg-name" className={labelClass}>{t("nameLabel")} <span className="text-red-500">*</span></label>
        <input id="reg-name" name="name" value={form.name} onChange={handleChange} onBlur={handleBlur} className={inputClass} placeholder={t("namePlaceholder")} />
        {errors.name && <p className={errorClass}>{errors.name}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="reg-email" className={labelClass}>{t("emailLabel")} <span className="text-red-500">*</span></label>
          <input id="reg-email" name="email" type="email" value={form.email} onChange={handleChange} onBlur={handleBlur} className={inputClass} placeholder="email@example.com" />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="reg-phone" className={labelClass}>{t("phoneLabel")} <span className="text-red-500">*</span></label>
          <input id="reg-phone" name="phone" type="tel" value={form.phone} onChange={handleChange} onBlur={handleBlur} className={inputClass} placeholder="0901234567" />
          {errors.phone && <p className={errorClass}>{errors.phone}</p>}
        </div>
      </div>

      {/* Company info — only for BUSINESS */}
      {accountType === "BUSINESS" && (
        <>
          <p className="text-sm font-semibold text-brand-500 uppercase tracking-wide pt-2">{t("businessInfo")}</p>

          <div>
            <label htmlFor="reg-companyName" className={labelClass}>{t("companyLabel")} <span className="text-red-500">*</span></label>
            <input id="reg-companyName" name="companyName" value={form.companyName} onChange={handleChange} onBlur={handleBlur} className={inputClass} placeholder={t("companyPlaceholder")} />
            {errors.companyName && <p className={errorClass}>{errors.companyName}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-companyField" className={labelClass}>{t("industryLabel")} <span className="text-red-500">*</span></label>
              <select id="reg-companyField" name="companyField" value={form.companyField} onChange={handleChange} onBlur={handleBlur} className={inputClass}>
                <option value="">{t("industryDefault")}</option>
                {COMPANY_FIELDS.map(f => <option key={f} value={f}>{tFields(f)}</option>)}
              </select>
              {errors.companyField && <p className={errorClass}>{errors.companyField}</p>}
            </div>
            <div>
              <label htmlFor="reg-address" className={labelClass}>{t("addressLabel")}</label>
              <input id="reg-address" name="address" value={form.address} onChange={handleChange} className={inputClass} placeholder={t("addressPlaceholder")} />
            </div>
          </div>
        </>
      )}

      {/* Expertise — only for INDIVIDUAL */}
      {accountType === "INDIVIDUAL" && (
        <div>
          <label htmlFor="reg-address" className={labelClass}>{t("expertiseLabel")}</label>
          <input id="reg-address" name="address" value={form.address} onChange={handleChange} className={inputClass} placeholder={t("expertisePlaceholder")} />
        </div>
      )}

      <div>
        <label htmlFor="reg-reason" className={labelClass}>{t("reasonLabel")} <span className="text-red-500">*</span></label>
        <textarea
          id="reg-reason" name="reason" value={form.reason} onChange={handleChange} onBlur={handleBlur}
          rows={3} className={cn(inputClass, "resize-none")}
          placeholder={t("reasonPlaceholder")}
        />
        {errors.reason && <p className={errorClass}>{errors.reason}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-700 text-white font-semibold py-3 text-sm hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? t("submitting") : t("submitBtn")}
      </button>

      <p className="text-center text-sm text-brand-500">
        {t("hasAccount")}{" "}
        <Link href={`/${locale}/login`} className="text-brand-700 font-medium hover:underline">{t("loginLink")}</Link>
      </p>
    </form>
  )
}
