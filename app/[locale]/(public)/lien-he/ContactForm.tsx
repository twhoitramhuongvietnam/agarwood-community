"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"

type FieldKey = "name" | "email" | "phone" | "message"
type Errors = Partial<Record<FieldKey, string>>

// Uncontrolled inputs — keystrokes không gây React re-render, chỉ
// setState khi submit / clear lỗi. Trước đây controlled với useState
// trên cả 4 trường khiến INP xấu trên mobile chậm (mỗi keystroke
// re-render cả form + tính cn() className mới).
const BASE_INPUT =
  "w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-brand-400 text-brand-900"
const NORMAL_INPUT = "border-brand-200 bg-white focus:border-brand-500"
const ERROR_INPUT = "border-red-400 bg-red-50 focus:border-red-500"

export function ContactForm() {
  const t = useTranslations("contactForm")
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function clearErrorIfAny(name: FieldKey) {
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError("")

    const data = new FormData(e.currentTarget)
    const fields = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      message: String(data.get("message") ?? "").trim(),
    }

    const errs: Errors = {}
    if (!fields.name) errs.name = t("nameRequired")
    if (!fields.email) errs.email = t("emailRequired")
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
      errs.email = t("emailInvalid")
    if (!fields.message) errs.message = t("contentRequired")

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setServerError(json.error ?? t("submitError"))
        return
      }
      setSubmitted(true)
    } catch {
      setServerError(t("submitError"))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-green-200 bg-green-50 p-10 text-center">
        <div className="mb-3 text-4xl">✅</div>
        <h3 className="text-lg font-bold text-green-800">{t("successTitle")}</h3>
        <p className="mt-2 text-sm text-green-700">{t("successDesc")}</p>
        <button
          onClick={() => {
            setSubmitted(false)
            formRef.current?.reset()
          }}
          className="mt-5 text-sm font-medium text-green-700 underline underline-offset-2 hover:text-green-900"
        >
          {t("sendAnother")}
        </button>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-brand-800 mb-1">
          {t("nameLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          onInput={() => clearErrorIfAny("name")}
          placeholder={t("namePlaceholder")}
          className={`${BASE_INPUT} ${errors.name ? ERROR_INPUT : NORMAL_INPUT}`}
        />
        {/* Reserved space để không gây CLS khi validate fail */}
        <p className="mt-1 min-h-4 text-xs text-red-500" aria-live="polite">
          {errors.name ?? ""}
        </p>
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-brand-800 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          onInput={() => clearErrorIfAny("email")}
          placeholder="email@example.com"
          className={`${BASE_INPUT} ${errors.email ? ERROR_INPUT : NORMAL_INPUT}`}
        />
        <p className="mt-1 min-h-4 text-xs text-red-500" aria-live="polite">
          {errors.email ?? ""}
        </p>
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-brand-800 mb-1">
          {t("phoneLabel")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder={t("phonePlaceholder")}
          className={`${BASE_INPUT} ${NORMAL_INPUT}`}
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-brand-800 mb-1">
          {t("contentLabel")} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          onInput={() => clearErrorIfAny("message")}
          placeholder={t("contentPlaceholder")}
          className={`${BASE_INPUT} resize-none ${errors.message ? ERROR_INPUT : NORMAL_INPUT}`}
        />
        <p className="mt-1 min-h-4 text-xs text-red-500" aria-live="polite">
          {errors.message ?? ""}
        </p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? t("submitting") : t("submitBtn")}
      </button>
    </form>
  )
}
