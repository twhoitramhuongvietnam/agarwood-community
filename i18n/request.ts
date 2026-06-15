import { getRequestConfig } from "next-intl/server"
import { headers } from "next/headers"
import { defaultLocale, isValidLocale, type Locale } from "./config"

// Lazy per-locale loaders. Mỗi import() là 1 chunk riêng → cold start CHỈ parse
// đúng 1 ngôn ngữ request cần (~70KB) thay vì cả 4 file (~270KB) như khi import
// tĩnh. Cắt chi phí CPU cố định của cold start trên MỌI route. Module namespace
// được runtime cache sau lần đầu nên warm request không chịu thêm cost.
type MessagesShape = typeof import("@/messages/vi.json")
// Turbopack runtime trả module namespace `{ default: <json> }`; TS lại type
// JSON import là object trần. Union + narrowing bên dưới an toàn cả hai dạng.
const loaders: Record<Locale, () => Promise<{ default: MessagesShape } | MessagesShape>> = {
  vi: () => import("@/messages/vi.json"),
  en: () => import("@/messages/en.json"),
  zh: () => import("@/messages/zh.json"),
  ar: () => import("@/messages/ar.json"),
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Ưu tiên explicit locale do caller truyền vào (vd
  // `getTranslations({ locale: "en" })` ở admin CMS load 4 ngôn ngữ trong 1
  // request). Nếu không có → fallback về header x-locale do proxy.ts set theo
  // URL/ cookie. Trước đây handler này luôn dùng header → admin gọi
  // `getTranslations({ locale: "en" })` ở route /admin/* nhận về vi messages
  // (vì admin route bypass URL locale, header luôn "vi").
  const explicit = await requestLocale
  let locale: Locale
  if (explicit && isValidLocale(explicit)) {
    locale = explicit
  } else {
    const h = await headers()
    const headerLocale = h.get("x-locale")
    locale = headerLocale && isValidLocale(headerLocale) ? headerLocale : defaultLocale
  }

  const loaded = await loaders[locale]()
  const messages = "default" in loaded ? loaded.default : loaded
  return {
    locale,
    messages,
  }
})
