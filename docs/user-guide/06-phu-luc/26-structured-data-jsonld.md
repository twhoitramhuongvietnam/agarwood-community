# 26. (Phụ lục kỹ thuật) Structured data (JSON-LD)

## Mục đích
Đảm bảo các trang chính chèn JSON-LD đúng schema.org để Google Rich Results Test pass, hỗ trợ SEO + thẻ rich snippet trong kết quả tìm kiếm.

## Đối tượng tài liệu
- Vận hành SEO + nhà phát triển. *(Không cho end-user.)*

## Schema đang dùng

### `Organization` — trang chủ + Giới thiệu
Chèn trong `app/[locale]/(public)/page.tsx` và `app/[locale]/(public)/gioi-thieu-v2/page.tsx`.

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Hội Trầm Hương Việt Nam",
  "alternateName": "VAWA — Vietnam Agarwood Association",
  "url": "https://hoitramhuong.vn",
  "logo": "https://hoitramhuong.vn/logo.png",
  "foundingDate": "2010-01-11",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Số 150, Đường Lý Chính Thắng, Phường Xuân Hòa",
    "addressLocality": "Thành phố Hồ Chí Minh",
    "postalCode": "700000",
    "addressCountry": "VN"
  },
  "contactPoint": [
    { "@type": "ContactPoint", "telephone": "+84-913-810-060", "contactType": "Chairman" },
    { "@type": "ContactPoint", "telephone": "+84-938-334-647", "contactType": "Vice Chairman" }
  ],
  "sameAs": ["https://www.facebook.com/hoitramhuongvietnam.org"]
}
```

Email lấy từ SiteConfig key `association_email` — chèn vào `contactPoint[0].email` nếu có.

### `NewsArticle` — bài tin tức chi tiết
Chèn trong `app/[locale]/(public)/tin-tuc/[slug]/page.tsx`.

```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "<title>",
  "description": "<excerpt>",
  "image": ["<coverImageUrl>"],
  "datePublished": "<publishedAt ISO>",
  "dateModified": "<updatedAt ISO>",
  "author": { "@type": "Organization", "name": "Hội Trầm Hương Việt Nam" },
  "publisher": {
    "@type": "Organization",
    "name": "Hội Trầm Hương Việt Nam",
    "logo": { "@type": "ImageObject", "url": "https://hoitramhuong.vn/logo.png" }
  },
  "mainEntityOfPage": "https://hoitramhuong.vn/tin-tuc/<slug>"
}
```

→ Pass Rich Results Test cho schema "Article".

### `Product` — sản phẩm chi tiết
Chèn trong `app/[locale]/(public)/san-pham/[slug]/page.tsx`.

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "<product name>",
  "image": ["<gallery[0]>"],
  "description": "<short description>",
  "brand": { "@type": "Brand", "name": "<company name>" },
  "offers": { "@type": "Offer", "price": <salePrice>, "priceCurrency": "VND", "availability": "..." }
}
```

Cộng thêm extra cho sản phẩm đã chứng nhận (Certified):
```json
{
  "additionalProperty": {
    "@type": "PropertyValue",
    "name": "VAWA Certification",
    "value": "<certCode>"
  }
}
```

### `BreadcrumbList` — mọi trang detail
Chèn ở các page có nesting (tin tức, sản phẩm, doanh nghiệp).

## Cách kiểm tra
1. Mở `https://search.google.com/test/rich-results`.
2. Paste URL (vd `https://hoitramhuong.vn/tin-tuc/<slug>`) → Test URL.
3. Xác nhận:
   - Mục **"Items detected"**: NewsArticle, BreadcrumbList…
   - Mục **"Issues detected"**: 0 lỗi nghiêm trọng (warnings có thể chấp nhận).

## Cách chèn trong Next.js
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
/>
```
- Chèn trong server component (RSC).
- KHÔNG dùng `<Head>` của next/head — Next 15+ App Router không có Head.

## Sitemap & Robots
- `app/sitemap.ts` — sinh sitemap.xml động (kèm các slug DB).
- `app/robots.ts` — robots.txt cho phép Googlebot crawl, chặn `/admin/*`, `/api/*`.

## RSS Feed
- `app/feed.xml/route.ts` — RSS 2.0 cho các bài tin tức mới.
- Subscribe URL: `https://hoitramhuong.vn/feed.xml`.

> Tài liệu phục vụ vận hành SEO.
