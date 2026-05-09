# 29. (Phụ lục kỹ thuật) Tốc độ load < 3 giây

## Mục đích
Đảm bảo **TTFB + LCP** của các trang chính đáp ứng tiêu chuẩn Core Web Vitals (LCP < 2.5s tốt, < 4s chấp nhận được). Tài liệu này tổng hợp các kỹ thuật đang áp dụng + cách đo.

## Đối tượng
- Vận hành + nhà phát triển.

## Mục tiêu cụ thể
| Metric | Tốt | Cần cải thiện | Trang |
|---|---|---|---|
| TTFB | ≤ 600ms | ≤ 1.5s | mọi trang |
| LCP | ≤ 2.5s | ≤ 4s | trang chủ, tin tức, doanh nghiệp |
| CLS | ≤ 0.1 | ≤ 0.25 | trang chủ |
| INP | ≤ 200ms | ≤ 500ms | feed, admin |

## Kỹ thuật áp dụng

### 1. ISR + unstable_cache
- Trang chủ: `revalidate = 300` (5 phút).
- Tin tức list: `revalidate = 300` (mỗi query có cache key riêng).
- Tin tức chi tiết: `revalidate = 600` (10 phút).
- Sidebar "Tin nổi bật" / "Mới đăng": cache 10 phút.
- Điều lệ: `revalidate = 86400` (24h).
- Giới thiệu: `revalidate = 600`.

→ **Hit cache**: serve từ memory, TTFB ~50-100ms.
→ **Miss cache**: hit DB + render, TTFB ~500-800ms (sau đó cache 5p tiếp theo).

### 2. Selective revalidation
Khi admin đăng bài / sửa cài đặt → `revalidateTag("news")` clear cache đúng tag, không clear toàn bộ.

Tags đang dùng:
- `news`, `tin-tuc`
- `gioi-thieu`, `leaders`, `members`
- `dieu-le`, `phap-ly`
- `companies`, `featured-companies`
- `products`, `certified-products`
- `homepage-banner`, `breaking-ticker`

### 3. Suspense streaming
- Trang chủ wrap nhiều section trong `<Suspense>` riêng.
- Critical content (hero + news section) render trước.
- Banner, sidebar, footer streaming sau → user thấy nội dung chính ngay.

### 4. Server Components mặc định
- Component nào không cần interactive → giữ là RSC, KHÔNG ship JS client.
- `"use client"` chỉ cho input, dropdown, form, lightbox.

### 5. Image optimization
- `next/image` với `sizes` đúng → mobile load ảnh nhỏ.
- Cloudinary `f_auto,q_auto` → AVIF/WebP tự động, quality auto.
- Blur placeholder (`blurDataURL`) → tránh CLS khi ảnh chưa load.

### 6. Database query select
- Không bao giờ `findMany()` không kèm `select`.
- Constants chia sẻ: `COMPANY_CARD_SELECT`, `NEWS_LIST_SELECT`, `RESEARCH_LIST_SELECT`, `PRODUCT_CARD_SELECT`.
- `Promise.all([...])` cho các query song song.

### 7. CDN / hosting
- Triển khai Vercel với edge caching.
- Static assets (logo, icon, PDF nhỏ) qua CDN.

### 8. Font loading
- `next/font` với `display: 'swap'` cho Inter + Merriweather.
- KHÔNG fetch external font CSS.

### 9. CLS prevention
- `<HomepageJoinBanner>` render đồng bộ (không Suspense) — auth() resolve ở parent — tránh CLS 0.2-0.3 khi banner ~500px push footer.
- `aspect-ratio` set sẵn cho banner slots → reserve space khi banner null.
- Image luôn có `width/height` explicit.

## Cách đo

### Tự động (script tích hợp)
Script `scripts/perf-audit.py` chạy Playwright + Performance API:
```bash
python scripts/perf-audit.py
# hoặc
python scripts/perf-audit-multi.py  # multi page
python scripts/perf-audit-admin.py  # admin pages
```
Kết quả ghi ra `scripts/perf-results/<page>.json`.

### Thủ công
1. Chrome DevTools → tab **Lighthouse** → Mobile throttled 4G → Run audit.
2. WebPageTest.org với location VN.
3. PageSpeed Insights → URL → Analyze.

### Real user metrics
- Vercel Analytics built-in → Web Vitals (LCP, CLS, INP) realtime.
- Hoặc tích hợp Sentry / Datadog RUM nếu cần chi tiết hơn.

## Kết quả hiện tại (tham khảo)
*(Cần đo lại sau mỗi major release. Ghi lại số liệu trong `documents/perf/`.)*

| Trang | TTFB | LCP | CLS | INP |
|---|---|---|---|---|
| `/` | ~200ms | ~1.8s | ~0.05 | ~150ms |
| `/tin-tuc` | ~150ms | ~1.5s | ~0.03 | ~100ms |
| `/tin-tuc/[slug]` | ~180ms | ~1.6s | ~0.02 | ~80ms |
| `/doanh-nghiep` | ~200ms | ~2.0s | ~0.08 | ~150ms |
| `/admin` | ~250ms | ~2.5s | ~0.1 | ~250ms |

> Số trên là ước lượng dev local. Production thực tế phải đo lại với mạng người dùng thật.

## Issues đã xử lý
- **unstable_cache + Date gotcha**: cache serialize JSON → Date thành string → consumer xài Date API sẽ crash. Fix bằng `normalizeDate()` helper sau mỗi cache read trước khi `.toLocaleDateString()` / `.getFullYear()`.

## Watch list
- Bundle size sau mỗi feature mới (`npm run build:analyze`).
- TTFB nếu thêm DB query mới ở trang chủ — luôn wrap trong `unstable_cache`.

> Tài liệu phục vụ vận hành + phát triển. KHÔNG cần cho end-user.
