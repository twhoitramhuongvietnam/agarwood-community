# 09. (Phụ lục kỹ thuật) Proxy / Middleware phân quyền

## Mục đích
Hệ thống có 1 lớp middleware Next.js (file đặt tên là `proxy.ts`, không phải `middleware.ts` — user đã đổi tên) chặn các route theo 4 tầng quyền và xử lý đa ngôn ngữ.

## Đối tượng tài liệu
- Người vận hành / nhà phát triển. *(Không cần cho tài liệu hướng dẫn end-user.)*

## File chính
- `proxy.ts` (root) — middleware logic.
- `lib/auth.config.ts` — cấu hình NextAuth Edge-safe (không có Prisma).
- `lib/auth.ts` — full auth (Node runtime, có Prisma) — dùng ở server components.

## Phân quyền 4 tầng → mapping với route

| Tầng | Role/State | Routes truy cập |
|---|---|---|
| **Khách** | chưa đăng nhập | `(public)`: `/`, `/tin-tuc`, `/lien-he`, `/dang-ky`, `/login`, `/quen-mat-khau`... |
| **Tài khoản cơ bản** | `role = GUEST` | Như khách + `/feed/tao-bai` (đăng bài có quota) + `/banner/dang-ky` + `/hoi-dong` (nếu được admin assign) |
| **Hội viên** | `role = VIP` + `membershipExpires > now` | Như Tài khoản cơ bản + `MEMBER_PREFIXES`: `/tong-quan`, `/ho-so`, `/gia-han`, `/chung-nhan/*`, `/doanh-nghiep/chinh-sua`, `/ket-nap`... |
| **Admin** | `role = ADMIN/INFINITE`, hoặc VIP có `committees.length > 0` | `ADMIN_PREFIXES`: `/admin/*`, `/dashboard`, `/members`, `/certifications`, `/media-orders` |

## Các quy tắc đặc biệt

### Hội viên hết hạn membership
- VIP với `membershipExpires < now` truy cập `MEMBER_PREFIXES` → **redirect về `/gia-han`** (ép gia hạn trước).
- Ngoại lệ: `/gia-han` và `/thanh-toan/*` vẫn truy cập được (để user thấy hóa đơn + đóng tiếp).

### GUEST truy cập member route
- GUEST vào `/tong-quan`, `/ho-so` → redirect về `/landing` (trang giải thích quyền lợi Hội viên + CTA gia nhập).

### Đã đăng nhập + truy cập trang auth
- User đã đăng nhập mở `/login`, `/register`, `/dang-ky` → **redirect về trang chủ `/`**.
- Logic này áp dụng cho **mọi role** (admin / VIP / GUEST). Khách hàng yêu cầu: login xong luôn landing ở public homepage trước, KHÔNG jump thẳng `/admin` hoặc `/tong-quan`. User tự navigate sau.

## i18n routing trong proxy

### Internal routes (KHÔNG có locale prefix)
Routes nội bộ (admin / member / vip / api / `/feed`) **không thêm `/vi`, `/en`** vào URL. Chỉ pass locale qua header `x-locale` để static text vẫn dịch theo ngôn ngữ user đã chọn.

### Public/auth routes (CÓ locale prefix)
- URL bắt buộc dạng `/vi/...`, `/en/...`, `/zh/...`, `/ar/...`.
- Truy cập không có prefix → redirect tới prefix theo cookie `NEXT_LOCALE` (nếu có) hoặc `defaultLocale` (= `vi`).

### Bypass redirect
Nếu URL có locale prefix nhưng strip locale ra thì match internal pattern (vd `/vi/san-pham/foo/lich-su` → `/san-pham/foo/lich-su`) → proxy redirect strip locale, tránh 404.

## Đặc thù `/dat-mat-khau`
- Trang `/dat-mat-khau` xác thực qua **token trong URL**, không phụ thuộc session.
- Vì vậy KHÔNG nằm trong `AUTH_PATHS` — admin đang login mà click link đặt mật khẩu của tài khoản mới tạo, proxy KHÔNG redirect đi.

## Matcher
```ts
matcher: [
  "/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:webp|jpg|jpeg|png|gif|svg|ico|css|js|woff2?|ttf|eot)).*)",
]
```
Proxy chạy trên **mọi request** trừ:
- `/api/*` (route handlers tự call `auth()` khi cần).
- `_next/static`, `_next/image` (Next.js assets).
- File tĩnh trong `/public/*`: ảnh, font, css, js…

## Auth check ở 2 nơi
1. **Proxy (Edge runtime)** — block sớm dựa trên cookie session, không hit DB.
2. **Page / Route handler (Node runtime)** — `auth()` từ `lib/auth.ts`, có Prisma → check chi tiết hơn (vd kiểm tra committees, isActive…).

Đặt 2 lớp vì:
- Edge proxy cần Edge-safe (không Prisma) — nhanh, low latency.
- Server-side check là source-of-truth — xác minh role + active state trực tiếp với DB.

## Kiểm tra coverage
Có script `scripts/check-route-menu-coverage.ts` rà soát:
- Mọi route ở `app/` đều có entry tương ứng trong `MEMBER_PREFIXES` / `ADMIN_PREFIXES` / `LOGGED_IN_PREFIXES` (hoặc là public, là `[locale]/*`).
- Tránh route bị mặc định public trong khi nhà phát triển nghĩ là "đã được proxy chặn".

> Tài liệu này phục vụ vận hành / phát triển, KHÔNG cần xuất hiện trong sách hướng dẫn end-user.
