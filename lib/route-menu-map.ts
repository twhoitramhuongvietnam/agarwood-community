/**
 * Route → MenuKey registry.
 *
 * Source-of-truth: route nào trên public site thuộc menu nào trên navbar.
 * - menuKey: string  → highlight menu có cùng menuKey
 * - menuKey: null    → cố tình KHÔNG highlight menu nào (vd auth flow, legal)
 * - undefined        → route chưa được khai báo (script CI sẽ cảnh báo)
 *
 * Match thứ tự từ trên xuống, prefix cụ thể đặt trước generic.
 * `pathname === prefix` hoặc `pathname.startsWith(prefix + "/")` đều khớp,
 * trừ entry "/" chỉ match exact.
 */

export type MenuKey =
  | "trang-chu"
  | "gioi-thieu"
  | "nghien-cuu"
  | "mxh"
  | "hoi-vien"

type Entry = { prefix: string; exact?: boolean; menuKey: MenuKey | null }

export const ROUTE_MENU_MAP: Entry[] = [
  // Trang chủ — chỉ exact "/"
  { prefix: "/", exact: true, menuKey: "trang-chu" },

  // Giới thiệu cụm
  { prefix: "/gioi-thieu-v2", menuKey: "gioi-thieu" },
  { prefix: "/about", menuKey: "gioi-thieu" },
  { prefix: "/ban-lanh-dao", menuKey: "gioi-thieu" },
  { prefix: "/dieu-le", menuKey: "gioi-thieu" },
  { prefix: "/lien-he", menuKey: "gioi-thieu" },

  // Nghiên cứu
  { prefix: "/nghien-cuu", menuKey: "nghien-cuu" },

  // MXH Trầm Hương — chỉ feed + bài post của hội viên
  { prefix: "/feed", menuKey: "mxh" },
  { prefix: "/bai-viet", menuKey: "mxh" },

  // Tin tức ngành (CMS) — gắn về Trang chủ vì đây là nội dung chung của Hội,
  // không thuộc luồng MXH (user-generated posts).
  { prefix: "/tin-tuc", menuKey: "trang-chu" },
  { prefix: "/news", menuKey: "trang-chu" },

  // Hội viên cụm
  { prefix: "/landing", menuKey: "hoi-vien" },
  { prefix: "/hoi-vien", menuKey: "hoi-vien" },
  { prefix: "/doanh-nghiep", menuKey: "hoi-vien" },
  { prefix: "/san-pham", menuKey: "hoi-vien" },
  { prefix: "/san-pham-chung-nhan", menuKey: "hoi-vien" },
  { prefix: "/san-pham-doanh-nghiep", menuKey: "hoi-vien" },
  { prefix: "/san-pham-tieu-bieu", menuKey: "hoi-vien" },
  { prefix: "/dich-vu", menuKey: "hoi-vien" },

  // Cố tình không highlight (auth, legal, utility)
  { prefix: "/dang-ky", menuKey: null },
  { prefix: "/cho-duyet", menuKey: null },
  { prefix: "/membership-expired", menuKey: null },
  { prefix: "/phap-ly", menuKey: null },
  { prefix: "/privacy", menuKey: null },
  { prefix: "/terms", menuKey: null },
  { prefix: "/dieu-khoan", menuKey: null },
  { prefix: "/khao-sat", menuKey: null },
  { prefix: "/banner", menuKey: null },
  { prefix: "/verify", menuKey: null },
]

/**
 * Tìm menuKey cho 1 pathname. Trả về:
 *  - string: menuKey cần highlight
 *  - null: route đã khai báo nhưng cố tình không highlight
 *  - undefined: route chưa khai báo (caller có thể fallback sang matchPrefixes)
 */
export function lookupMenuKey(pathname: string): MenuKey | null | undefined {
  for (const e of ROUTE_MENU_MAP) {
    if (e.exact) {
      if (pathname === e.prefix) return e.menuKey
    } else {
      if (pathname === e.prefix || pathname.startsWith(e.prefix + "/")) return e.menuKey
    }
  }
  return undefined
}
