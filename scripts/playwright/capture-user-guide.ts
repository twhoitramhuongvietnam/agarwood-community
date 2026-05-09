/**
 * Capture screenshots cho tài liệu hướng dẫn sử dụng (docs/user-guide/).
 *
 * Run: npx tsx scripts/playwright/capture-user-guide.ts <section>
 *   section ∈ { trang-chu, dang-nhap, all }
 *
 * Yêu cầu: dev server chạy ở http://localhost:3000
 */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test"
import path from "path"
import fs from "fs"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const ROOT = path.resolve(__dirname, "..", "..")
const IMG_ROOT = path.join(ROOT, "docs", "user-guide", "_images")

const ADMIN = { email: "admin@hoitramhuong.vn", password: "Demo@123" }
const HOI_VIEN = { email: "binhnv@hoitramhuong.vn", password: "Demo@123" }

const VIEWPORT_DESKTOP = { width: 1280, height: 720 }
const VIEWPORT_MOBILE = { width: 390, height: 844 } // iPhone 14 size

type Shot = {
  name: string
  goto: string
  fullPage?: boolean
  mobile?: boolean
  before?: (page: Page) => Promise<void>
  waitFor?: string
  delayMs?: number
}

async function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" })
  await page.fill("#email", who.email)
  await page.fill("#password", who.password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ])
}

async function shoot(
  context: BrowserContext,
  outDir: string,
  shot: Shot,
) {
  const page = await context.newPage()
  await page.setViewportSize(shot.mobile ? VIEWPORT_MOBILE : VIEWPORT_DESKTOP)
  try {
    await page.goto(`${BASE_URL}${shot.goto}`, { waitUntil: "networkidle", timeout: 30000 })
  } catch {
    // network never quiesces (websockets/feed) — fallback to domcontentloaded
    await page.goto(`${BASE_URL}${shot.goto}`, { waitUntil: "domcontentloaded", timeout: 30000 })
  }
  if (shot.waitFor) {
    await page.waitForSelector(shot.waitFor, { timeout: 10000 }).catch(() => {})
  }
  if (shot.before) await shot.before(page)
  if (shot.delayMs) await page.waitForTimeout(shot.delayMs)
  await ensureDir(outDir)
  const file = path.join(outDir, `${shot.name}.png`)
  await page.screenshot({ path: file, fullPage: shot.fullPage ?? false })
  console.log(`  ✓ ${path.relative(ROOT, file)}`)
  await page.close()
}

// ============ SECTION CAPTURES ============

async function captureTrangChu(browser: Browser) {
  const ctx = await browser.newContext()
  const out = path.join(IMG_ROOT, "01-public", "trang-chu")
  console.log("[trang-chu]")
  await shoot(ctx, out, { name: "01-tong-quan", goto: "/", waitFor: "header", delayMs: 1500 })
  await shoot(ctx, out, { name: "02-full-page", goto: "/", fullPage: true, delayMs: 2000 })
  await shoot(ctx, out, { name: "03-mobile", goto: "/", mobile: true, fullPage: true, delayMs: 2000 })
  await ctx.close()
}

async function captureGioiThieu(browser: Browser) {
  const ctx = await browser.newContext()
  const out = path.join(IMG_ROOT, "01-public", "gioi-thieu")
  console.log("[gioi-thieu]")
  await shoot(ctx, out, { name: "01-hero", goto: "/gioi-thieu-v2", delayMs: 1500 })
  await shoot(ctx, out, { name: "02-full-page", goto: "/gioi-thieu-v2", fullPage: true, delayMs: 2500 })
  await shoot(ctx, out, { name: "03-mobile", goto: "/gioi-thieu-v2", mobile: true, fullPage: true, delayMs: 2000 })
  await ctx.close()
}

async function captureBanLanhDao(browser: Browser) {
  const ctx = await browser.newContext()
  const out = path.join(IMG_ROOT, "01-public", "ban-lanh-dao")
  console.log("[ban-lanh-dao]")
  await shoot(ctx, out, { name: "01-tong-quan", goto: "/ban-lanh-dao", fullPage: true, delayMs: 1500 })
  await shoot(ctx, out, { name: "02-mobile", goto: "/ban-lanh-dao", mobile: true, fullPage: true, delayMs: 1500 })
  await ctx.close()
}

async function captureDieuLe(browser: Browser) {
  const ctx = await browser.newContext()
  const out = path.join(IMG_ROOT, "01-public", "dieu-le")
  console.log("[dieu-le]")
  await shoot(ctx, out, { name: "01-tong-quan", goto: "/dieu-le", fullPage: true, delayMs: 1500 })
  await shoot(ctx, out, { name: "02-mobile", goto: "/dieu-le", mobile: true, fullPage: true, delayMs: 1500 })
  await ctx.close()
}

async function captureTinTuc(browser: Browser) {
  const ctx = await browser.newContext()
  const out = path.join(IMG_ROOT, "01-public", "tin-tuc")
  console.log("[tin-tuc]")
  await shoot(ctx, out, { name: "01-list-top", goto: "/tin-tuc", delayMs: 2000 })
  await shoot(ctx, out, { name: "02-list-full", goto: "/tin-tuc", fullPage: true, delayMs: 2500 })
  await shoot(ctx, out, { name: "03-mobile", goto: "/tin-tuc", mobile: true, fullPage: true, delayMs: 2000 })
  // Detail — pick first article from list
  const page = await ctx.newPage()
  await page.setViewportSize(VIEWPORT_DESKTOP)
  await page.goto(`${BASE_URL}/tin-tuc`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  const firstHref = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/tin-tuc/"]:not([href$="/tin-tuc"])') as HTMLAnchorElement | null
    return a ? a.getAttribute("href") : null
  })
  await page.close()
  if (firstHref) {
    await shoot(ctx, out, { name: "04-detail-top", goto: firstHref, delayMs: 1500 })
    await shoot(ctx, out, { name: "05-detail-full", goto: firstHref, fullPage: true, delayMs: 2000 })
  }
  await ctx.close()
}

async function captureLienHe(browser: Browser) {
  const ctx = await browser.newContext()
  const out = path.join(IMG_ROOT, "01-public", "lien-he")
  console.log("[lien-he]")
  await shoot(ctx, out, { name: "01-form-trong", goto: "/lien-he", fullPage: true, delayMs: 1000 })
  await shoot(ctx, out, {
    name: "02-form-dien",
    goto: "/lien-he",
    fullPage: true,
    before: async (p) => {
      await p.fill('input[name="name"]', "Nguyễn Văn A")
      await p.fill('input[name="email"]', "test@example.com")
      await p.fill('input[name="phone"]', "0901234567")
      await p.fill('textarea[name="message"]', "Tôi muốn tìm hiểu về điều kiện gia nhập Hội Trầm Hương Việt Nam.")
    },
  })
  await shoot(ctx, out, { name: "03-mobile", goto: "/lien-he", mobile: true, fullPage: true, delayMs: 1000 })
  await ctx.close()
}

async function captureDangKy(browser: Browser) {
  const ctx = await browser.newContext()
  const out = path.join(IMG_ROOT, "02-tai-khoan", "dang-ky")
  console.log("[dang-ky]")
  await shoot(ctx, out, { name: "01-form-trong", goto: "/dang-ky", fullPage: true, delayMs: 1000 })
  await shoot(ctx, out, { name: "02-mobile", goto: "/dang-ky", mobile: true, fullPage: true, delayMs: 1000 })
  await ctx.close()
}

async function captureQuenMatKhau(browser: Browser) {
  const ctx = await browser.newContext()
  const out = path.join(IMG_ROOT, "02-tai-khoan", "quen-mat-khau")
  console.log("[quen-mat-khau]")
  await shoot(ctx, out, { name: "01-form-trong", goto: "/quen-mat-khau", waitFor: "input[type=email]" })
  await shoot(ctx, out, {
    name: "02-form-dien",
    goto: "/quen-mat-khau",
    waitFor: "input[type=email]",
    before: async (p) => {
      await p.fill('input[type="email"]', "binhnv@hoitramhuong.vn")
    },
  })
  await shoot(ctx, out, { name: "03-mobile", goto: "/quen-mat-khau", mobile: true })
  await ctx.close()
}

async function captureDangNhap(browser: Browser) {
  const ctx = await browser.newContext()
  const out = path.join(IMG_ROOT, "02-tai-khoan", "dang-nhap")
  console.log("[dang-nhap]")
  await shoot(ctx, out, { name: "01-form-trong", goto: "/login", waitFor: "#email" })
  await shoot(ctx, out, {
    name: "02-form-dien",
    goto: "/login",
    waitFor: "#email",
    before: async (p) => {
      await p.fill("#email", HOI_VIEN.email)
      await p.fill("#password", HOI_VIEN.password)
    },
  })
  await shoot(ctx, out, {
    name: "03-loi-sai-mat-khau",
    goto: "/login",
    waitFor: "#email",
    before: async (p) => {
      await p.fill("#email", HOI_VIEN.email)
      await p.fill("#password", "wrong-password")
      await p.click('button[type="submit"]')
      await p.waitForTimeout(1500)
    },
  })
  await shoot(ctx, out, { name: "04-mobile", goto: "/login", mobile: true })
  await ctx.close()
}

// ============ HOI VIEN AREA (logged in) ============

async function withLogin(
  browser: Browser,
  who: { email: string; password: string },
  fn: (ctx: BrowserContext) => Promise<void>,
) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.setViewportSize(VIEWPORT_DESKTOP)
  await login(page, who)
  await page.close()
  try {
    await fn(ctx)
  } finally {
    await ctx.close()
  }
}

async function captureTongQuanHoiVien(browser: Browser) {
  console.log("[tong-quan-hoi-vien]")
  const out = path.join(IMG_ROOT, "03-hoi-vien", "tong-quan")
  await withLogin(browser, HOI_VIEN, async (ctx) => {
    await shoot(ctx, out, { name: "01-dashboard", goto: "/tong-quan", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-mobile", goto: "/tong-quan", mobile: true, fullPage: true, delayMs: 1500 })
  })
}

async function captureHoSo(browser: Browser) {
  console.log("[ho-so]")
  const out = path.join(IMG_ROOT, "03-hoi-vien", "ho-so")
  await withLogin(browser, HOI_VIEN, async (ctx) => {
    await shoot(ctx, out, { name: "01-tab-ca-nhan", goto: "/ho-so", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-mobile", goto: "/ho-so", mobile: true, fullPage: true, delayMs: 1500 })
  })
}

async function captureDoanhNghiepCuaToi(browser: Browser) {
  console.log("[doanh-nghiep-cua-toi]")
  const out = path.join(IMG_ROOT, "03-hoi-vien", "doanh-nghiep-cua-toi")
  await withLogin(browser, HOI_VIEN, async (ctx) => {
    await shoot(ctx, out, { name: "01-overview", goto: "/doanh-nghiep-cua-toi", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-mobile", goto: "/doanh-nghiep-cua-toi", mobile: true, fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "03-edit-form", goto: "/doanh-nghiep/chinh-sua", fullPage: true, delayMs: 1500 })
  })
}

async function captureHoSoTabs(browser: Browser) {
  console.log("[ho-so tabs]")
  const out = path.join(IMG_ROOT, "03-hoi-vien", "ho-so")
  await withLogin(browser, HOI_VIEN, async (ctx) => {
    // Tab "Thông tin cá nhân" (mặc định) — already captured. Add other tabs.
    const page = await ctx.newPage()
    await page.setViewportSize(VIEWPORT_DESKTOP)
    await page.goto(`${BASE_URL}/ho-so`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1500)
    // Click "Thông tin cá nhân" tab to ensure default capture
    const persInfoBtn = page.locator('button:has-text("Thông tin cá nhân")').first()
    if (await persInfoBtn.count()) {
      await persInfoBtn.click()
      await page.waitForTimeout(500)
    }
    await page.screenshot({ path: path.join(out, "03-tab-thong-tin.png"), fullPage: true })
    console.log("  ✓ ho-so/03-tab-thong-tin.png")
    // Click "Bảo mật" tab
    const securityBtn = page.locator('button:has-text("Bảo mật")').first()
    if (await securityBtn.count()) {
      await securityBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(out, "04-tab-bao-mat.png"), fullPage: true })
      console.log("  ✓ ho-so/04-tab-bao-mat.png")
    }
    await page.close()
  })
}

async function captureDanhBaDoanhNghiep(browser: Browser) {
  console.log("[doanh-nghiep-public]")
  const out = path.join(IMG_ROOT, "03-hoi-vien", "doanh-nghiep")
  const ctx = await browser.newContext()
  await shoot(ctx, out, { name: "01-list", goto: "/doanh-nghiep", fullPage: true, delayMs: 2000 })
  await shoot(ctx, out, { name: "02-mobile", goto: "/doanh-nghiep", mobile: true, fullPage: true, delayMs: 2000 })
  // Detail page — first slug
  const page = await ctx.newPage()
  await page.setViewportSize(VIEWPORT_DESKTOP)
  await page.goto(`${BASE_URL}/doanh-nghiep`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  const firstHref = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/doanh-nghiep/"]:not([href$="/doanh-nghiep"])') as HTMLAnchorElement | null
    return a ? a.getAttribute("href") : null
  })
  await page.close()
  if (firstHref) {
    await shoot(ctx, out, { name: "03-detail", goto: firstHref, fullPage: true, delayMs: 1500 })
  }
  await ctx.close()
}

async function captureThanhToanLichSu(browser: Browser) {
  console.log("[thanh-toan-lich-su]")
  const out = path.join(IMG_ROOT, "03-hoi-vien", "thanh-toan")
  await withLogin(browser, HOI_VIEN, async (ctx) => {
    await shoot(ctx, out, { name: "01-list", goto: "/thanh-toan/lich-su", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-mobile", goto: "/thanh-toan/lich-su", mobile: true, fullPage: true, delayMs: 1500 })
  })
}

async function captureGiaHan(browser: Browser) {
  console.log("[gia-han]")
  const out = path.join(IMG_ROOT, "03-hoi-vien", "gia-han")
  await withLogin(browser, HOI_VIEN, async (ctx) => {
    await shoot(ctx, out, { name: "01-overview", goto: "/gia-han", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-mobile", goto: "/gia-han", mobile: true, fullPage: true, delayMs: 1500 })
  })
}

// ============ ADMIN AREA ============

async function captureAdminDashboard(browser: Browser) {
  console.log("[admin-dashboard]")
  const out = path.join(IMG_ROOT, "04-admin", "dashboard")
  await withLogin(browser, ADMIN, async (ctx) => {
    await shoot(ctx, out, { name: "01-overview", goto: "/admin", fullPage: true, delayMs: 2000 })
    await shoot(ctx, out, { name: "02-mobile", goto: "/admin", mobile: true, fullPage: true, delayMs: 2000 })
  })
}

async function captureAdminHoiVien(browser: Browser) {
  console.log("[admin-hoi-vien]")
  const out = path.join(IMG_ROOT, "04-admin", "hoi-vien")
  await withLogin(browser, ADMIN, async (ctx) => {
    await shoot(ctx, out, { name: "01-list", goto: "/admin/hoi-vien", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-pending", goto: "/admin/hoi-vien?status=pending", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "03-tao-moi", goto: "/admin/hoi-vien/tao-moi", fullPage: true, delayMs: 1000 })
    await shoot(ctx, out, { name: "04-mobile", goto: "/admin/hoi-vien", mobile: true, fullPage: true, delayMs: 1500 })
  })
}

async function captureAdminThanhToan(browser: Browser) {
  console.log("[admin-thanh-toan]")
  const out = path.join(IMG_ROOT, "04-admin", "thanh-toan")
  await withLogin(browser, ADMIN, async (ctx) => {
    await shoot(ctx, out, { name: "01-pending", goto: "/admin/thanh-toan", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-mobile", goto: "/admin/thanh-toan", mobile: true, fullPage: true, delayMs: 1500 })
  })
}

async function captureAdminTinTuc(browser: Browser) {
  console.log("[admin-tin-tuc]")
  const out = path.join(IMG_ROOT, "04-admin", "tin-tuc")
  await withLogin(browser, ADMIN, async (ctx) => {
    await shoot(ctx, out, { name: "01-list", goto: "/admin/tin-tuc", fullPage: true, delayMs: 1500 })
    // Try /admin/tin-tuc/moi or /admin/tin-tuc/[id]/edit
    await shoot(ctx, out, { name: "02-mobile", goto: "/admin/tin-tuc", mobile: true, fullPage: true, delayMs: 1500 })
  })
}

async function captureAdminBaiViet(browser: Browser) {
  console.log("[admin-bai-viet]")
  const out = path.join(IMG_ROOT, "04-admin", "bai-viet")
  await withLogin(browser, ADMIN, async (ctx) => {
    await shoot(ctx, out, { name: "01-list", goto: "/admin/bai-viet", fullPage: true, delayMs: 1500 })
  })
}

// ============ ADVANCED FEATURES ============

async function captureFeed(browser: Browser) {
  console.log("[feed]")
  const out = path.join(IMG_ROOT, "05-advanced", "feed")
  await withLogin(browser, HOI_VIEN, async (ctx) => {
    await shoot(ctx, out, { name: "01-list", goto: "/vi/feed", fullPage: true, delayMs: 2000 })
    await shoot(ctx, out, { name: "02-tao-bai", goto: "/vi/feed/tao-bai", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "03-mobile", goto: "/vi/feed", mobile: true, fullPage: true, delayMs: 2000 })
  })
}

async function captureChungNhan(browser: Browser) {
  console.log("[chung-nhan]")
  const out = path.join(IMG_ROOT, "05-advanced", "chung-nhan")
  // Public pages first
  const ctx = await browser.newContext()
  await shoot(ctx, out, { name: "01-public-list", goto: "/san-pham-chung-nhan", fullPage: true, delayMs: 2000 })
  await ctx.close()
  // Hoi vien pages
  await withLogin(browser, HOI_VIEN, async (ctx2) => {
    await shoot(ctx2, out, { name: "02-nop-don", goto: "/chung-nhan/nop-don", fullPage: true, delayMs: 1500 })
    await shoot(ctx2, out, { name: "03-lich-su", goto: "/chung-nhan/lich-su", fullPage: true, delayMs: 1500 })
  })
  // Admin
  await withLogin(browser, ADMIN, async (ctx3) => {
    await shoot(ctx3, out, { name: "04-admin-list", goto: "/admin/chung-nhan", fullPage: true, delayMs: 1500 })
  })
}

async function captureKetNap(browser: Browser) {
  console.log("[ket-nap]")
  const out = path.join(IMG_ROOT, "05-advanced", "ket-nap")
  await withLogin(browser, HOI_VIEN, async (ctx) => {
    await shoot(ctx, out, { name: "01-form", goto: "/ket-nap", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-mobile", goto: "/ket-nap", mobile: true, fullPage: true, delayMs: 1500 })
  })
}

async function capturePhapLy(browser: Browser) {
  console.log("[phap-ly]")
  const out = path.join(IMG_ROOT, "05-advanced", "phap-ly")
  const ctx = await browser.newContext()
  await shoot(ctx, out, { name: "01-public", goto: "/phap-ly", fullPage: true, delayMs: 1500 })
  await shoot(ctx, out, { name: "02-mobile", goto: "/phap-ly", mobile: true, fullPage: true, delayMs: 1500 })
  await ctx.close()
  await withLogin(browser, ADMIN, async (ctx2) => {
    await shoot(ctx2, out, { name: "03-admin", goto: "/admin/phap-ly", fullPage: true, delayMs: 1500 })
  })
}

async function captureI18n(browser: Browser) {
  console.log("[i18n]")
  const out = path.join(IMG_ROOT, "06-phu-luc", "i18n")
  const ctx = await browser.newContext()
  await shoot(ctx, out, { name: "01-vi", goto: "/vi", delayMs: 1500 })
  await shoot(ctx, out, { name: "02-en", goto: "/en", delayMs: 1500 })
  await shoot(ctx, out, { name: "03-zh", goto: "/zh", delayMs: 1500 })
  await shoot(ctx, out, { name: "04-ar", goto: "/ar", delayMs: 1500 })
  await ctx.close()
}

// ============ PHASE 2: ADDITIONAL FEATURES ============

async function captureMarketplace(browser: Browser) {
  console.log("[marketplace]")
  const out = path.join(IMG_ROOT, "01-public", "san-pham")
  const ctx = await browser.newContext()
  await shoot(ctx, out, { name: "01-marketplace", goto: "/san-pham-doanh-nghiep", fullPage: true, delayMs: 2000 })
  await shoot(ctx, out, { name: "02-certified", goto: "/san-pham-chung-nhan", fullPage: true, delayMs: 2000 })
  await shoot(ctx, out, { name: "03-mobile", goto: "/san-pham-doanh-nghiep", mobile: true, fullPage: true, delayMs: 2000 })
  // Detail
  const page = await ctx.newPage()
  await page.setViewportSize(VIEWPORT_DESKTOP)
  await page.goto(`${BASE_URL}/san-pham-doanh-nghiep`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  const slug = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/san-pham/"]:not([href*="san-pham-"])') as HTMLAnchorElement | null
    return a ? a.getAttribute("href") : null
  })
  await page.close()
  if (slug) {
    await shoot(ctx, out, { name: "04-detail", goto: slug, fullPage: true, delayMs: 1500 })
  }
  await ctx.close()
}

async function captureNghienCuu(browser: Browser) {
  console.log("[nghien-cuu]")
  const out = path.join(IMG_ROOT, "01-public", "nghien-cuu")
  const ctx = await browser.newContext()
  await shoot(ctx, out, { name: "01-list", goto: "/nghien-cuu", fullPage: true, delayMs: 2000 })
  await shoot(ctx, out, { name: "02-mobile", goto: "/nghien-cuu", mobile: true, fullPage: true, delayMs: 2000 })
  // Detail
  const page = await ctx.newPage()
  await page.setViewportSize(VIEWPORT_DESKTOP)
  await page.goto(`${BASE_URL}/nghien-cuu`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  const slug = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/nghien-cuu/"]:not([href$="/nghien-cuu"])') as HTMLAnchorElement | null
    return a ? a.getAttribute("href") : null
  })
  await page.close()
  if (slug) {
    await shoot(ctx, out, { name: "03-detail", goto: slug, fullPage: true, delayMs: 1500 })
  }
  await ctx.close()
}

async function captureKhuyenNong(browser: Browser) {
  console.log("[khuyen-nong]")
  const out = path.join(IMG_ROOT, "01-public", "khuyen-nong")
  const ctx = await browser.newContext()
  await shoot(ctx, out, { name: "01-list", goto: "/khuyen-nong", fullPage: true, delayMs: 2000 })
  await shoot(ctx, out, { name: "02-mobile", goto: "/khuyen-nong", mobile: true, fullPage: true, delayMs: 2000 })
  await ctx.close()
}

async function captureXacThucChungNhan(browser: Browser) {
  console.log("[xac-thuc-chung-nhan]")
  const out = path.join(IMG_ROOT, "05-advanced", "xac-thuc")
  const ctx = await browser.newContext()
  // Sample certCode — depends on seed data; if not found, page shows "không tìm thấy"
  await shoot(ctx, out, { name: "01-page", goto: "/verify/HTHVN-2026-0001", fullPage: true, delayMs: 1500 })
  await shoot(ctx, out, { name: "02-mobile", goto: "/verify/HTHVN-2026-0001", mobile: true, fullPage: true, delayMs: 1500 })
  await ctx.close()
}

async function captureTaiLieu(browser: Browser) {
  console.log("[tai-lieu]")
  const out = path.join(IMG_ROOT, "03-hoi-vien", "tai-lieu")
  await withLogin(browser, HOI_VIEN, async (ctx) => {
    await shoot(ctx, out, { name: "01-list", goto: "/tai-lieu", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-mobile", goto: "/tai-lieu", mobile: true, fullPage: true, delayMs: 1500 })
  })
}

async function captureBannerDangKy(browser: Browser) {
  console.log("[banner-dang-ky]")
  const out = path.join(IMG_ROOT, "03-hoi-vien", "banner")
  await withLogin(browser, HOI_VIEN, async (ctx) => {
    await shoot(ctx, out, { name: "01-dang-ky", goto: "/banner/dang-ky", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-lich-su", goto: "/banner/lich-su", fullPage: true, delayMs: 1500 })
  })
}

async function captureAdminThuChi(browser: Browser) {
  console.log("[admin-thu-chi]")
  const out = path.join(IMG_ROOT, "04-admin", "thu-chi")
  await withLogin(browser, ADMIN, async (ctx) => {
    await shoot(ctx, out, { name: "01-overview", goto: "/admin/thu-chi", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-so-quy", goto: "/admin/thu-chi/so-quy", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "03-bao-cao", goto: "/admin/thu-chi/bao-cao", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "04-them", goto: "/admin/thu-chi/them", fullPage: true, delayMs: 1500 })
  })
}

async function captureAdminTruyenThong(browser: Browser) {
  console.log("[admin-truyen-thong]")
  const out = path.join(IMG_ROOT, "04-admin", "truyen-thong")
  await withLogin(browser, ADMIN, async (ctx) => {
    await shoot(ctx, out, { name: "01-list", goto: "/admin/truyen-thong", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-banner", goto: "/admin/banner", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "03-tu-van", goto: "/admin/tu-van", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "04-lien-he", goto: "/admin/lien-he", fullPage: true, delayMs: 1500 })
  })
}

async function captureAdminCaiDat(browser: Browser) {
  console.log("[admin-cai-dat]")
  const out = path.join(IMG_ROOT, "04-admin", "cai-dat")
  await withLogin(browser, ADMIN, async (ctx) => {
    await shoot(ctx, out, { name: "01-cai-dat", goto: "/admin/cai-dat", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "02-trang-tinh", goto: "/admin/trang-tinh", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "03-menu", goto: "/admin/menu", fullPage: true, delayMs: 1500 })
  })
}

async function captureAdminThongKe(browser: Browser) {
  console.log("[admin-thong-ke]")
  const out = path.join(IMG_ROOT, "04-admin", "thong-ke")
  await withLogin(browser, ADMIN, async (ctx) => {
    await shoot(ctx, out, { name: "01-thong-ke", goto: "/admin/thong-ke", fullPage: true, delayMs: 2000 })
    await shoot(ctx, out, { name: "02-bao-cao-vi-pham", goto: "/admin/bao-cao", fullPage: true, delayMs: 1500 })
    await shoot(ctx, out, { name: "03-giam-sat", goto: "/admin/giam-sat", fullPage: true, delayMs: 1500 })
  })
}

// ============ MAIN ============

async function main() {
  const section = process.argv[2] ?? "all"
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Section: ${section}\n`)

  const browser = await chromium.launch({ headless: true })
  try {
    if (section === "trang-chu" || section === "all") await captureTrangChu(browser)
    if (section === "gioi-thieu" || section === "all") await captureGioiThieu(browser)
    if (section === "ban-lanh-dao" || section === "all") await captureBanLanhDao(browser)
    if (section === "dieu-le" || section === "all") await captureDieuLe(browser)
    if (section === "tin-tuc" || section === "all") await captureTinTuc(browser)
    if (section === "lien-he" || section === "all") await captureLienHe(browser)
    if (section === "dang-ky" || section === "all") await captureDangKy(browser)
    if (section === "dang-nhap" || section === "all") await captureDangNhap(browser)
    if (section === "quen-mat-khau" || section === "all") await captureQuenMatKhau(browser)
    if (section === "tong-quan-hv" || section === "all") await captureTongQuanHoiVien(browser)
    if (section === "ho-so" || section === "all") await captureHoSo(browser)
    if (section === "ho-so-tabs" || section === "all") await captureHoSoTabs(browser)
    if (section === "doanh-nghiep-cua-toi" || section === "all") await captureDoanhNghiepCuaToi(browser)
    if (section === "doanh-nghiep" || section === "all") await captureDanhBaDoanhNghiep(browser)
    if (section === "thanh-toan" || section === "all") await captureThanhToanLichSu(browser)
    if (section === "gia-han" || section === "all") await captureGiaHan(browser)
    if (section === "admin-dashboard" || section === "all") await captureAdminDashboard(browser)
    if (section === "admin-hoi-vien" || section === "all") await captureAdminHoiVien(browser)
    if (section === "admin-thanh-toan" || section === "all") await captureAdminThanhToan(browser)
    if (section === "admin-tin-tuc" || section === "all") await captureAdminTinTuc(browser)
    if (section === "admin-bai-viet" || section === "all") await captureAdminBaiViet(browser)
    if (section === "feed" || section === "all") await captureFeed(browser)
    if (section === "chung-nhan" || section === "all") await captureChungNhan(browser)
    if (section === "ket-nap" || section === "all") await captureKetNap(browser)
    if (section === "phap-ly" || section === "all") await capturePhapLy(browser)
    if (section === "i18n" || section === "all") await captureI18n(browser)
    if (section === "marketplace" || section === "all") await captureMarketplace(browser)
    if (section === "nghien-cuu" || section === "all") await captureNghienCuu(browser)
    if (section === "khuyen-nong" || section === "all") await captureKhuyenNong(browser)
    if (section === "xac-thuc" || section === "all") await captureXacThucChungNhan(browser)
    if (section === "tai-lieu" || section === "all") await captureTaiLieu(browser)
    if (section === "banner-dang-ky" || section === "all") await captureBannerDangKy(browser)
    if (section === "admin-thu-chi" || section === "all") await captureAdminThuChi(browser)
    if (section === "admin-truyen-thong" || section === "all") await captureAdminTruyenThong(browser)
    if (section === "admin-cai-dat" || section === "all") await captureAdminCaiDat(browser)
    if (section === "admin-thong-ke" || section === "all") await captureAdminThongKe(browser)
  } finally {
    await browser.close()
  }
  console.log("\nDone.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
