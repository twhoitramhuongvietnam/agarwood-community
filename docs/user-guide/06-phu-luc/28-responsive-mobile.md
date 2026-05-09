# 28. (Phụ lục) Responsive mobile

## Mục đích
Toàn bộ giao diện được thiết kế **mobile-first** + responsive đến tablet + desktop. Tài liệu này tổng hợp breakpoint, các pattern chính và checklist QA.

## Đối tượng
- Vận hành QA + nhà phát triển.

## Breakpoints (Tailwind v4)
| Tên | Min width | Thiết bị target |
|---|---|---|
| (default) | 0 | Mobile (≤ 639px) |
| `sm` | 640px | Mobile xoay ngang / điện thoại lớn |
| `md` | 768px | Tablet dọc |
| `lg` | 1024px | Tablet ngang / desktop nhỏ |
| `xl` | 1280px | Desktop thường |
| `2xl` | 1536px | Desktop lớn |

## Patterns đang dùng

### CategoryBar (menu danh mục)
- Mobile: scroll ngang `[touch-action:pan-x]`, item active tự scroll vào giữa.
- Desktop ≥ lg: flex-row hết, dropdown "Giới thiệu" hover.
- Dropdown render qua `createPortal` vào body để không bị clip bởi `overflow-hidden` của ul.

### SiteHeader (utility strip + masthead)
- Mobile: utility strip stacked (date — locale dropdown — menu icon).
- Desktop: 1 dòng, masthead phía dưới.

### Trang chi tiết bài viết
- Mobile: 1 cột, sidebar tin nổi bật cuối trang.
- ≥ lg: 2 cột (col-9 body + col-3 sticky sidebar).
- ≥ xl: thêm `ArticleToolbar` dọc bên trái (share/comment/print/zoom).

### List page (tin tức, nghiên cứu)
- Mobile DOM order: Hero → Aside → Latest (stack vertical).
- Desktop: 2-col grid.
- Lazy-load 10 bài/lần qua IntersectionObserver, rootMargin 200px.

### Forms
- Input full-width trên mobile.
- Label trên top input (label-above pattern).
- Button "Submit" full-width mobile, auto-width desktop.

### Admin sidebar
- Mobile: drawer kéo từ trái (chưa có hamburger? — kiểm tra trên dev).
- Desktop ≥ lg: sticky sidebar 256px.

### Marketplace cards
- Mobile: 1 cột.
- `sm`: 2 cột.
- `lg`: 3 cột.
- `xl`: 4 cột.

## Tối ưu hiệu năng mobile

### Image
- Dùng `next/image` với responsive `sizes` attribute.
- Cloudinary auto-resize qua `cloudinaryResize()` → mobile load ảnh nhỏ hơn.
- Blur placeholder (`blurDataURL`) cho ảnh feed/news/SP.

### Bundle
- Server Components mặc định → client bundle nhỏ.
- TipTap editor chỉ load khi user nhấn "Soạn bài đầy đủ" (`/feed/tao-bai`).
- DOMPurify KHÔNG ship client (sanitize ở server).

### CSS
- Tailwind JIT + tree-shake → CSS final < 50KB.
- Font Inter + Merriweather load qua `next/font` → tránh FOIT/FOUT.

## Test mobile
- Playwright config viewport mặc định `1280x720`. Để test mobile, override `viewport: { width: 390, height: 844 }` (iPhone 14 size).
- E2E test riêng cho mobile: `e2e/mobile-responsive.spec.ts`.

## Checklist QA mobile
- [ ] Menu CategoryBar scroll ngang được, item active visible.
- [ ] Form input không bị overflow ngang viewport.
- [ ] Button đủ to để chạm (≥ 44×44px theo Apple HIG).
- [ ] Modal close button vào được vùng safe area.
- [ ] iOS Safari URL bar collapse/expand không gây jitter.
- [ ] RTL (Arabic) layout đảo đúng.

## Hình ảnh minh họa
Mỗi tài liệu chính (mục 1–24) đều có **1 screenshot mobile riêng** (390×844). Tham khảo các file:
- [01-trang-chu](../01-public/01-trang-chu.md)
- [04-tin-tuc](../01-public/04-tin-tuc.md)
- [10-tong-quan](../03-hoi-vien/10-tong-quan.md)
- ...

> Tài liệu phục vụ QA + phát triển.
