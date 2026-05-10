/**
 * Đồng bộ bảng `menu_items` về đúng cấu trúc menu đang hiển thị trên homepage
 * (CategoryBar — Phase 3.7). Tham chiếu source-of-truth:
 *   components/features/homepage/CategoryBar.tsx (CATEGORIES const)
 *   messages/{vi,en,zh,ar}.json → "navbar"
 *
 * DESTRUCTIVE: xoá toàn bộ menu_items hiện có rồi tạo lại 9 mục cha + 4 mục
 * con (under "about"). Chạy sau khi nâng cấp CategoryBar/SiteHeader đọc DB.
 *
 * Run: npx tsx scripts/seed-menu-homepage-sync.ts
 */
import { readFileSync, existsSync } from "fs"

function loadEnvLocal(): void {
  if (!existsSync(".env.local")) return
  for (const line of readFileSync(".env.local", "utf-8").split(/\r?\n/)) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("="); if (eq === -1) continue
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}
loadEnvLocal()
/* eslint-disable @typescript-eslint/no-require-imports */
const { prisma } = require("../lib/prisma") as typeof import("../lib/prisma")
/* eslint-enable @typescript-eslint/no-require-imports */

type Labels = { vi: string; en: string; zh: string; ar: string }
type TopItem = {
  menuKey: string
  labels: Labels
  href: string
  sortOrder: number
  matchPrefixes: string[]
  isNew?: boolean
  children?: ChildItem[]
}
type ChildItem = {
  menuKey: string
  labels: Labels
  href: string
  sortOrder: number
}

const TREE: TopItem[] = [
  {
    menuKey: "home",
    labels: { vi: "Trang chủ", en: "Home", zh: "首页", ar: "الرئيسية" },
    href: "/",
    sortOrder: 1,
    matchPrefixes: [],
  },
  {
    menuKey: "news",
    labels: { vi: "Tin tức", en: "News", zh: "新闻", ar: "الأخبار" },
    href: "/tin-tuc",
    sortOrder: 2,
    matchPrefixes: ["/tin-tuc", "/news"],
  },
  {
    menuKey: "research",
    labels: { vi: "Nghiên cứu", en: "Research", zh: "研究", ar: "الأبحاث" },
    href: "/nghien-cuu",
    sortOrder: 3,
    matchPrefixes: ["/nghien-cuu"],
  },
  {
    menuKey: "agriculture",
    labels: { vi: "Khuyến nông", en: "Agriculture", zh: "农业推广", ar: "الإرشاد الزراعي" },
    href: "/khuyen-nong",
    sortOrder: 4,
    matchPrefixes: ["/khuyen-nong"],
  },
  {
    menuKey: "feed",
    labels: { vi: "MXH Trầm Hương", en: "Agarwood Feed", zh: "沉香社区", ar: "مجتمع العود" },
    href: "/feed",
    sortOrder: 5,
    matchPrefixes: ["/feed", "/bai-viet"],
  },
  {
    menuKey: "businesses",
    labels: { vi: "Doanh nghiệp", en: "Businesses", zh: "企业", ar: "الشركات" },
    href: "/doanh-nghiep",
    sortOrder: 6,
    matchPrefixes: ["/doanh-nghiep"],
  },
  {
    menuKey: "products",
    labels: { vi: "Sản phẩm chứng nhận", en: "Certified Products", zh: "认证产品", ar: "المنتجات المعتمدة" },
    href: "/san-pham-chung-nhan",
    sortOrder: 7,
    matchPrefixes: ["/san-pham-chung-nhan"],
  },
  {
    menuKey: "about",
    labels: { vi: "Giới thiệu", en: "About", zh: "关于我们", ar: "من نحن" },
    href: "/gioi-thieu-v2",
    sortOrder: 8,
    matchPrefixes: ["/gioi-thieu-v2", "/gioi-thieu", "/about"],
    children: [
      {
        menuKey: "leadership",
        labels: { vi: "Ban lãnh đạo", en: "Leadership", zh: "领导层", ar: "القيادة" },
        href: "/ban-lanh-dao",
        sortOrder: 1,
      },
      {
        menuKey: "members",
        labels: { vi: "Hội viên", en: "Members", zh: "会员", ar: "الأعضاء" },
        href: "/hoi-vien",
        sortOrder: 2,
      },
      {
        menuKey: "legal_docs",
        labels: { vi: "Văn bản pháp lý", en: "Legal Documents", zh: "法律文件", ar: "الوثائق القانونية" },
        href: "/phap-ly",
        sortOrder: 3,
      },
      {
        menuKey: "charter",
        labels: { vi: "Điều lệ", en: "Charter", zh: "协会章程", ar: "النظام الأساسي" },
        href: "/dieu-le",
        sortOrder: 4,
      },
    ],
  },
  {
    menuKey: "contact",
    labels: { vi: "Liên hệ", en: "Contact", zh: "联系我们", ar: "اتصل بنا" },
    href: "/lien-he",
    sortOrder: 9,
    matchPrefixes: ["/lien-he"],
  },
]

/** Các trang public hiện có nhưng KHÔNG hiển thị trên menu trang chủ.
 *  Seed với isVisible=false để admin biết tồn tại + có thể bật khi cần.
 *  Tất cả ở root (parentId=null) — admin có thể kéo vào submenu sau. */
const UNUSED_TOP_LEVEL: TopItem[] = [
  {
    menuKey: "about_legacy",
    labels: { vi: "Về chúng tôi (cũ)", en: "About (legacy)", zh: "关于我们（旧版）", ar: "من نحن (قديم)" },
    href: "/about",
    sortOrder: 100,
    matchPrefixes: [],
  },
  {
    menuKey: "service",
    labels: { vi: "Dịch vụ", en: "Services", zh: "服务", ar: "الخدمات" },
    href: "/dich-vu",
    sortOrder: 101,
    matchPrefixes: ["/dich-vu"],
  },
  {
    menuKey: "landing",
    labels: { vi: "Trang giới thiệu hội viên", en: "Member Landing", zh: "会员介绍页", ar: "صفحة الأعضاء" },
    href: "/landing",
    sortOrder: 102,
    matchPrefixes: ["/landing"],
  },
  {
    menuKey: "products_business",
    labels: { vi: "Sản phẩm doanh nghiệp", en: "Business Products", zh: "企业产品", ar: "منتجات الشركات" },
    href: "/san-pham-doanh-nghiep",
    sortOrder: 103,
    matchPrefixes: ["/san-pham-doanh-nghiep"],
  },
  {
    menuKey: "products_featured",
    labels: { vi: "Sản phẩm tiêu biểu", en: "Featured Products", zh: "代表性产品", ar: "المنتجات المميزة" },
    href: "/san-pham-tieu-bieu",
    sortOrder: 104,
    matchPrefixes: ["/san-pham-tieu-bieu"],
  },
  {
    menuKey: "press",
    labels: { vi: "Tin báo chí", en: "Press", zh: "媒体动态", ar: "أخبار الصحافة" },
    href: "/tin-bao-chi",
    sortOrder: 105,
    matchPrefixes: ["/tin-bao-chi"],
  },
  {
    menuKey: "multimedia",
    labels: { vi: "Thư viện đa phương tiện", en: "Multimedia", zh: "多媒体库", ar: "مكتبة الوسائط" },
    href: "/multimedia",
    sortOrder: 106,
    matchPrefixes: ["/multimedia"],
  },
  {
    menuKey: "surveys",
    labels: { vi: "Khảo sát", en: "Surveys", zh: "调查", ar: "الاستبيانات" },
    href: "/khao-sat",
    sortOrder: 107,
    matchPrefixes: ["/khao-sat"],
  },
  {
    menuKey: "banner_register",
    labels: { vi: "Đăng ký quảng cáo", en: "Register Banner", zh: "广告登记", ar: "تسجيل الإعلان" },
    href: "/banner/dang-ky",
    sortOrder: 108,
    matchPrefixes: ["/banner/dang-ky"],
  },
  {
    menuKey: "banner_history",
    labels: { vi: "Lịch sử quảng cáo", en: "Banner History", zh: "广告历史", ar: "سجل الإعلانات" },
    href: "/banner/lich-su",
    sortOrder: 109,
    matchPrefixes: ["/banner/lich-su"],
  },
  {
    menuKey: "pending_posts",
    labels: { vi: "Bài viết chờ duyệt", en: "Pending Posts", zh: "待审核文章", ar: "المقالات قيد المراجعة" },
    href: "/cho-duyet",
    sortOrder: 110,
    matchPrefixes: ["/cho-duyet"],
  },
  {
    menuKey: "news_en",
    labels: { vi: "News (bản tiếng Anh)", en: "News (English)", zh: "News（英文）", ar: "الأخبار (الإنجليزية)" },
    href: "/news",
    sortOrder: 111,
    matchPrefixes: ["/news"],
  },
  {
    menuKey: "privacy",
    labels: { vi: "Chính sách riêng tư", en: "Privacy Policy", zh: "隐私政策", ar: "سياسة الخصوصية" },
    href: "/privacy",
    sortOrder: 112,
    matchPrefixes: ["/privacy"],
  },
  {
    menuKey: "terms",
    labels: { vi: "Điều khoản dịch vụ", en: "Terms of Service", zh: "服务条款", ar: "شروط الخدمة" },
    href: "/terms",
    sortOrder: 113,
    matchPrefixes: ["/terms"],
  },
]

async function main() {
  // FK self-relation có onDelete:Cascade, nhưng deleteMany xoá cùng lúc cha+con
  // có thể tạo race condition trên Postgres. Xoá children trước cho an toàn.
  const childCount = await prisma.menuItem.count({ where: { parentId: { not: null } } })
  if (childCount > 0) await prisma.menuItem.deleteMany({ where: { parentId: { not: null } } })
  const topCount = await prisma.menuItem.count()
  if (topCount > 0) await prisma.menuItem.deleteMany({})
  console.log(`✓ Đã xoá ${childCount + topCount} menu items cũ.`)

  let createdActive = 0
  for (const top of TREE) {
    const parent = await prisma.menuItem.create({
      data: {
        menuKey: top.menuKey,
        label: top.labels.vi,
        label_en: top.labels.en,
        label_zh: top.labels.zh,
        label_ar: top.labels.ar,
        href: top.href,
        sortOrder: top.sortOrder,
        isVisible: true,
        isNew: top.isNew ?? false,
        matchPrefixes: top.matchPrefixes,
      },
    })
    createdActive++
    for (const child of top.children ?? []) {
      await prisma.menuItem.create({
        data: {
          menuKey: child.menuKey,
          label: child.labels.vi,
          label_en: child.labels.en,
          label_zh: child.labels.zh,
          label_ar: child.labels.ar,
          href: child.href,
          parentId: parent.id,
          sortOrder: child.sortOrder,
          isVisible: true,
        },
      })
      createdActive++
    }
  }

  let createdInactive = 0
  for (const top of UNUSED_TOP_LEVEL) {
    await prisma.menuItem.create({
      data: {
        menuKey: top.menuKey,
        label: top.labels.vi,
        label_en: top.labels.en,
        label_zh: top.labels.zh,
        label_ar: top.labels.ar,
        href: top.href,
        sortOrder: top.sortOrder,
        isVisible: false,
        matchPrefixes: top.matchPrefixes,
      },
    })
    createdInactive++
  }

  console.log(`✓ Đã tạo ${createdActive} menu items "Đang dùng" (khớp homepage).`)
  console.log(`✓ Đã tạo ${createdInactive} menu items "Chưa dùng" (root, ẩn khỏi menu).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
