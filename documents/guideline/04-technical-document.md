# Tai lieu Ky thuat — Hoi Tram Huong Viet Nam

> Danh cho developer moi join hoac doi maintain he thong.
> Cap nhat: 05/2026 — Phase 1-6 + Dieu le + VBPQ + TipTap v3 + i18n 4 locale + Admin notification + Contact messages + Feed sidebar banner + Refined typography + **Static-page CMS + i18n per-locale lookup + News royalty auto-credit + PoC quota mode**

---

## 1. Tong quan Cong nghe

| Thanh phan | Cong nghe | Phien ban |
|-----------|----------|----------|
| Framework | Next.js (App Router) | 16.2.2 |
| Runtime | React | 19.2.4 |
| Language | TypeScript | 5.x |
| Database | PostgreSQL (Supabase) | — |
| ORM | Prisma (adapter-pg) | 7.6.0 |
| Auth | NextAuth v5 (JWT strategy) | 5.0.0-beta.30 |
| Styling | Tailwind CSS v4 | 4.x |
| Charts | Recharts | 3.8.1 |
| Rich Text | TipTap | 3.22.1 |
| Email | Resend | 6.10.0 |
| Image | Cloudinary | 2.9.0 |
| Validation | Zod | 4.3.6 |
| XSS Protection | isomorphic-dompurify | 3.7.1 |
| Unit Test | Vitest + Testing Library | 4.1.2 |
| E2E Test | Playwright | 1.59.1 |

---

## 2. Cau truc Codebase

```
agarwood-community/
├── app/                        # Next.js App Router
│   ├── (admin)/                # Layout admin (sidebar + mobile nav)
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── page.tsx        # Dashboard tong quan
│   │       ├── hoi-vien/       # Quan ly hoi vien
│   │       ├── thanh-toan/     # Xac nhan CK
│   │       ├── chung-nhan/     # Xet duyet chung nhan
│   │       ├── tieu-bieu/      # [Phase 4] Pin top 20 SP + top 10 DN
│   │       ├── truyen-thong/   # CRM don truyen thong
│   │       ├── tin-tuc/        # Quan ly tin tuc (gom Privacy/Terms qua category=LEGAL)
│   │       ├── banner/         # Duyet banner quang cao (TOP/MID/SIDEBAR)
│   │       ├── doi-tac/        # CRUD doi tac (PartnersCarousel)
│   │       ├── bao-cao/        # Bao cao vi pham
│   │       ├── lien-he/        # Tin nhan lien he tu /lien-he public form
│   │       └── cai-dat/        # Cai dat he thong
│   ├── (member)/               # Layout Hoi vien (navbar)
│   │   ├── layout.tsx
│   │   ├── tong-quan/          # Dashboard Hoi vien
│   │   ├── feed/               # Feed cong dong + tao bai
│   │   ├── ho-so/              # Ho so ca nhan (4 tab)
│   │   ├── gia-han/            # Gia han membership
│   │   ├── chung-nhan/         # Nop don + lich su chung nhan
│   │   ├── thanh-toan/         # Lich su thanh toan
│   │   ├── doanh-nghiep/       # Chinh sua DN
│   │   └── san-pham/           # Tao/sua san pham
│   ├── (auth)/                 # Auth pages (login, register, dat mat khau)
│   ├── (public)/               # Public pages
│   │   ├── page.tsx            # [Phase 3] Trang chu bao chi 6 section
│   │   ├── landing/            # [Phase 5] Landing page quyen loi Hoi vien
│   │   ├── san-pham-tieu-bieu/ # [Phase 4] Top 20 SP tieu bieu (admin pin)
│   │   ├── tin-tuc/            # Tin tuc Hoi
│   │   ├── san-pham-chung-nhan/# SP da chung nhan
│   │   ├── doanh-nghiep/[slug] # Trang DN
│   │   ├── privacy/            # Chinh sach bao mat (fetch News slug=chinh-sach-bao-mat)
│   │   ├── terms/              # Dieu khoan (fetch News slug=dieu-khoan-su-dung)
│   │   └── ... (gioi thieu, hoi vien, dich vu, dieu le, lien he)
│   └── api/                    # API Routes
│       ├── auth/               # NextAuth + verify-token + set-password + register
│       ├── posts/              # Feed CRUD + react + report + lock
│       │   └── quota/          # [Phase 2] GET quota thang user hien tai
│       ├── admin/              # Admin-only endpoints
│       │   ├── users/          # CRUD user + toggle + resend invite + reset password
│       │   ├── payments/       # Confirm + reject CK
│       │   ├── certifications/ # Approve + reject + refund
│       │   ├── products/[id]/featured/   # [Phase 4] PATCH pin SP tieu bieu
│       │   ├── companies/[id]/featured/  # [Phase 4] PATCH pin DN tieu bieu
│       │   ├── media-orders/   # Update status
│       │   ├── news/           # CRUD tin tuc + LEGAL pages (privacy/terms)
│       │   ├── partners/        # CRUD doi tac — POST + PATCH/DELETE [id]
│       │   ├── banner/          # Duyet/tu choi banner quang cao
│       │   ├── reports/        # Xu ly bao cao
│       │   └── settings/       # Luu SiteConfig
│       ├── membership/         # Gia han
│       ├── certification/      # Nop don
│       ├── media-orders/       # Dat dich vu
│       ├── upload/             # Cloudinary upload
│       └── my-products/        # SP cua Hoi vien
├── components/
│   ├── features/
│   │   ├── layout/             # Navbar, Footer, AdminSidebar, UserMenu, SocialLinks, OfficialChannelsBlock
│   │   └── homepage/           # PostCard, MemberNewsRail, CertifiedProductsCarousel, HomepageBannerSlot, PartnersCarousel
│   └── ui/                     # Shared UI (Avatar, Button, Sheet, etc.)
├── lib/
│   ├── auth.ts                 # NextAuth full config (Prisma adapter)
│   ├── auth.config.ts          # Edge-safe config (cho proxy/middleware)
│   ├── prisma.ts               # Prisma singleton + connection pool
│   ├── tier.ts                 # Tier helpers (Bac/Vang thresholds)
│   ├── quota.ts                # [Phase 2] Monthly post quota helper (5/15/30/-1) — count moi status tru DELETED
│   ├── homepage.ts             # [Phase 3] Cached data fetchers + rotation logic
│   ├── legal-pages.ts          # Helper fetch News(LEGAL) cho /privacy, /terms
│   ├── product-quota.ts        # Monthly product quota helper
│   ├── bannerQuota.ts          # Monthly banner quota helper
│   ├── poc-mode.ts             # [3.4] PoC unlimited toggle — env POC_UNLIMITED_POSTS, default ON
│   ├── news-royalty.ts         # [3.4] creditNewsRoyaltyOnPublish — auto-credit nhuan but tac gia
│   ├── static-texts.ts         # [3.4] Per-locale column lookup cho StaticPageConfig + messages fallback
│   ├── static-page-meta.ts     # [3.4] STATIC_PAGES schema (about/companies/certProducts/contact/home/dieuLe)
│   ├── utils.ts                # cn() utility
│   └── constants/
│       ├── banks.ts            # 21 ngan hang VN
│       └── agarwood.ts         # Danh muc SP, vung nguyen lieu, hang
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── seed.ts                 # Seed data chinh (users, leaders, configs)
│   ├── seed-content.ts         # Seed Post + News content
│   ├── seed-banners.ts         # Seed banner TOP/MID demo
│   ├── seed-warning-news.ts    # Bai canh bao trang gia mao (pinned)
│   ├── seed-legal-pages.ts     # Privacy + Terms (News category=LEGAL)
│   ├── seed-partners.ts        # 8 doi tac (MARD + 7 co quan bao chi)
│   └── backfill-product-posts.ts  # Tao Post cho moi Product cu (MXH merge)
├── proxy.ts                    # Middleware (route protection)
├── e2e/                        # Playwright E2E tests
├── __tests__/                  # Vitest unit tests
└── documents/                  # Tai lieu du an
```

---

## 3. ERD — Entity Relationship Diagram

```
User (1) ──── (0..1) Company ──── (*) Product ──── (*) Certification
  │              ↑ chi BUSINESS         │ (0..1) ──── Post (sidecar)
  │                                     │            (Product.postId, MXH merge)
  ├──── (*) Membership                  │
  ├──── (*) Payment ────────────── (0..1)─┘
  ├──── (*) Post ──── (*) PostReaction
  │            ├──── (*) Report
  │            ├──── (*) PostTag ──── Tag
  │            └──── (0..1) Product (khi category=PRODUCT)
  ├──── (*) Banner (position: TOP/MID)
  ├──── (*) MediaOrder
  └──── (*) Account (NextAuth)

Partner (doc lap — PartnersCarousel trang chu)
SiteConfig (key-value store)
VerificationToken (NextAuth)
Document (Google Drive)
```

### User.accountType
| Gia tri | Mo ta | Company | SP/CN |
|---------|-------|---------|-------|
| BUSINESS | Doanh nghiep | Bat buoc | Co |
| INDIVIDUAL | Ca nhan / Chuyen gia | Khong co | Khong |

### Models chinh:
| Model | Records du kien | Ghi chu |
|-------|----------------|---------|
| User | ~100 Hoi vien + 1 Admin | accountType + **memberCategory** (OFFICIAL/AFFILIATE/HONORARY) |
| Company | ~70-80 (chi BUSINESS Hoi vien) | 0..1 voi User, **representativeName/Position** (Dieu 7.2c) |
| Product | ~500 | ~5 SP/DN |
| Post | ~5000/nam | ~50 bai/thang |
| Payment | ~200/nam | Membership + cert fee |
| Certification | ~100/nam | |
| MediaOrder | ~50/nam | |
| News | ~100-200 (admin nhap + crawled) | **category** (8 enum), **secondaryCategories[]** (cross-list, max 3), **pinnedInCategories[]** (per-section pin homepage), **sourceUrl**, **originalAuthor** |
| **MembershipApplication** | ~50-100 | Don ket nap (Dieu 11) — status + reviewer + reject reason |
| Document | ~20 legal + N tai lieu | **DIEU_LE/QUY_CHE/GIAY_PHEP** + issuer + sortOrder |
| **Banner** | ~50 ACTIVE | `position` (TOP/MID) — 2 slot tach biet tren trang chu |
| **Partner** | ~10-30 | Doi tac / co quan lien ket — PartnersCarousel marquee |
| SiteConfig | ~30 keys | Config he thong (them `join_fee_*`, `zalo_url`) |

### Enums moi (Dieu le integration):
```prisma
enum MemberCategory {
  OFFICIAL     // Hoi vien chinh thuc (day du quyen)
  AFFILIATE    // Lien ket (DN khong du tieu chuan hoac FDI)
  HONORARY     // Danh du (uy tin, dong gop)
}

enum ApplicationStatus {
  PENDING      // da nop, cho Ban Thuong vu xet
  APPROVED     // Chu tich ky quyet dinh cong nhan
  REJECTED     // bi tu choi
}

enum NewsCategory {
  GENERAL              // tin tuc — /tin-tuc
  RESEARCH             // nghien cuu khoa hoc — /nghien-cuu
  LEGAL                // van ban phap ly — render o /privacy, /terms theo slug co dinh
                       // ("chinh-sach-bao-mat", "dieu-khoan-su-dung")
  SPONSORED_PRODUCT    // legacy — bai san pham tra phi (Phase 2)
  BUSINESS             // tin doanh nghiep — yeu cau News.relatedCompanyId   (Phase 3.3)
  PRODUCT              // tin san pham — yeu cau News.relatedCompanyId + relatedProductId (Phase 3.3)
  EXTERNAL_NEWS        // tin bao chi ngoai — /tin-bao-chi (Phase 3.5, yeu cau sourceName + sourceUrl)
  AGRICULTURE          // tin khuyen nong — /khuyen-nong (Phase 3.5)
}

// Phase 3.7 round 4 (2026-04): cross-list + pin per-section
// News.secondaryCategories: NewsCategory[] @default([])  // max 3, exclude primary
// News.pinnedInCategories:  NewsCategory[] @default([])  // admin-only, no max

enum NewsTemplate {    // Phase 3.3 (2026-04)
  NORMAL               // RichTextEditor: text + anh + video chen lan
  PHOTO                // Gallery anh — auto xuat hien o /multimedia tab Hinh anh
  VIDEO                // Gallery URL YouTube — auto xuat hien o /multimedia tab Video
}

enum BannerPosition {
  TOP          // dau trang chu, sau thanh menu
  MID          // giua trang, sau khu San pham chung nhan
  SIDEBAR      // rail doc ben phai /feed (sticky khi scroll)
}

enum ContactStatus {
  NEW          // vua gui, cho admin doc
  HANDLED      // admin da lien he lai / xu ly xong
  ARCHIVED    // luu tru (spam, trung...)
}

enum PartnerCategory {
  GOVERNMENT   // co quan nha nuoc
  ASSOCIATION  // hiep hoi
  RESEARCH     // vien / truong
  ENTERPRISE   // doanh nghiep
  INTERNATIONAL // to chuc quoc te
  MEDIA        // co quan bao chi, dai phat thanh - truyen hinh
  OTHER
}

// DocumentCategory: them 3 gia tri
enum DocumentCategory {
  CONG_VAN_DEN, CONG_VAN_DI, BIEN_BAN_HOP, QUYET_DINH, HOP_DONG,
  DIEU_LE      // Dieu le Hoi (public o /phap-ly tab 1)
  QUY_CHE      // Quy che noi bo (public o /phap-ly tab 2)
  GIAY_PHEP    // Giay phep dai hoi (public o /phap-ly tab 3)
}
```

### Migrations gan day (Phase Dieu le):
- `add_member_category_and_representative` — `MemberCategory` + `Company.representativeName/Position`
- `add_membership_application` — model mới cho don ket nap
- `add_news_category` — `News.category` (`NewsCategory` enum)
- `add_news_source_url` — `News.sourceUrl` (crawl reference)
- `add_news_original_author` — `News.originalAuthor`
- `add_legal_doc_categories` — `DocumentCategory` them 3 enum values + `Document.issuer` + `Document.sortOrder`

### Migrations Phase 3.7 round 4 (2026-04):
- `20260428000000_post_cover_image` — `Post.coverImageUrl` (admin promote post can cover 16:9 dedicated)
- `20260428100000_news_secondary_categories` — `News.secondaryCategories: NewsCategory[]` + GIN index (cross-list bai len nhieu list page)
- `20260428200000_post_news_categories` — `Post.newsCategories: NewsCategory[]` + GIN index (admin tag bai feed thanh nguon news, hien o /tin-tuc, /nghien-cuu, ...)
- `20260428300000_news_pinned_in_categories` — `News.pinnedInCategories: NewsCategory[]` + GIN index (admin pin per-section trang chu, mo rong visibility cross-list)
- `add_banner_position` — `BannerPosition` enum (TOP/MID) + `Banner.position` + index `(status, position, endDate)`
- `add_post_product_relation` — `Product.postId String? @unique` (1-1 voi Post, Cascade tu Post)
- `add_news_category_legal` — them gia tri `LEGAL` vao `NewsCategory`
- `add_partner_model` — model `Partner` + enum `PartnerCategory` (gom MEDIA cho bao chi)
- `20260415000000_add_infinite_role` — them gia tri `INFINITE` vao enum `Role`
- `20260415100000_add_menu_items` — model `MenuItem` (navbar CMS) + self-relation parent/children
- `20260415110000_add_menu_key` — them cot `menuKey` (unique, nullable) cho `MenuItem`
- `20260418000000_add_profile_i18n_columns` — them `User.bio_en/_zh` + `Company.representativePosition_en/_zh`
- `20260419000000_add_contact_messages` — model `ContactMessage` + enum `ContactStatus` (persist /lien-he submissions)
- `20260419100000_add_sidebar_banner_position` — them gia tri `SIDEBAR` vao enum `BannerPosition`
- `20260420000000_add_arabic_locale_columns` — them 24 cot `*_ar` cho 8 bang multilang (User, Company, Product, News, MenuItem, Document, Leader, Survey)
- `20260421030000_cert_review_mode_and_fee` — `Certification.reviewMode` (ONLINE/OFFLINE) + `feeCents`
- `20260421040000_cert_council_voting` — `CertificationReview` model (5 thanh vien hoi dong)
- `20260423000000_add_post_promotion_request` — `PostPromotionRequest` (owner xin promote bai feed)
- `20260424000000_add_committee_memberships` — `CommitteeMembership` model + dual-write `User.isCouncilMember`
- `20260424100000_add_product_revisions` — `ProductRevision` (audit trail snapshot khi admin/owner sua Product)
- `20260426000000_news_categories_template_links` (Phase 3.3 — 2026-04):
  - `NewsCategory` them gia tri `BUSINESS` + `PRODUCT`
  - `NewsTemplate` enum moi: `NORMAL` / `PHOTO` / `VIDEO`
  - `News.template` (default NORMAL), `News.relatedCompanyId`, `News.relatedProductId`, `News.gallery JSONB`
  - Index `(template, isPublished, publishedAt)` cho /multimedia union query

> Cac migration nay duoc apply qua `prisma db push` (khong tao migration file rieng) — schema drift duoc dong bo truc tiep tu schema.prisma.

---

## 4. Authentication & Authorization

### JWT Strategy
- `lib/auth.config.ts`: Edge-safe config dung trong proxy.ts
- `lib/auth.ts`: Full config voi Prisma adapter + 2 providers
- JWT chua: userId, role, membershipExpires
- maxAge: 30 ngay

### Auth Providers
| Provider | Muc dich | Ghi chu |
|----------|---------|---------|
| Google OAuth | Dang nhap / Dang ky nhanh | Khong can nho mat khau, auto-link neu email trung |
| Credentials | Dang nhap bang email + mat khau | Flow truyen thong, dung cho invite email + reset password |

**Google OAuth flow (Phase 2 — bo flow cho duyet):**
1. User click "Dang nhap bang Google" → Google consent screen
2. Email da ton tai → auto-link Google account → login OK
3. Email moi → tao user GUEST voi `isActive: true` → email admin notification → redirect `/feed`
4. Legacy user (`isActive: false` + role GUEST tu pre-Phase 2) → auto-activate khi sign in → cho login

**Role semantics (Phase 2):**
- `GUEST` = Tai khoan co ban — dang ky xong dung duoc ngay, post duoc voi quota thap (5 bai/thang)
- `VIP` = Hoi vien dong phi — quota cao + uu tien hien thi trang chu
- `ADMIN` = ban quan tri — toan quyen + quota khong gioi han
- `INFINITE` = **admin chi-doc** — xem moi trang admin nhu ADMIN, nhung moi API mutation
  tra 403. UI disable cac nut sua/xoa. Bo qua check `membershipExpires`. Card hang nen den
  vien vang. Xem ADR-024.

**Role helpers (`lib/roles.ts`)**:
```ts
isAdmin(role)          // true cho ADMIN + INFINITE (view)
canAdminWrite(role)    // true chi cho ADMIN (mutation guard)
hasGoldPrivileges(...) // Vang tier + INFINITE
```
- Moi admin API route: dung `canAdminWrite()` thay cho check `role === "ADMIN"` trong
  guard mutation. Route chi doc (GET) dung `isAdmin()`.
- `app/(admin)/layout.tsx` render banner canh bao read-only khi role=INFINITE.
- Admin list/detail pages chuyen `export const revalidate = 0` de tranh cache cross-user
  gay hydration mismatch giua ADMIN va INFINITE.

**Migration**: `20260415000000_add_infinite_role` — them gia tri `INFINITE` vao enum `Role`.

**Env vars can thiet:**
```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
```
> Tao tai Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs.
> Redirect URI: `https://[domain]/api/auth/callback/google`

### Route Protection (proxy.ts) — updated Phase 2 + Phase 5
```
MEMBER_PREFIXES (Hoi vien + ADMIN, han membership):
  /tong-quan, /company, /certification, /gia-han, /ho-so,
  /chung-nhan, /thanh-toan/lich-su, /doanh-nghiep/chinh-sua,
  /san-pham/tao-moi, /tai-lieu

LOGGED_IN_PREFIXES (bat ky user dang nhap, ke ca GUEST):
  /feed/tao-bai     # Phase 2: open posting cho moi user

ADMIN_PREFIXES (chi ADMIN):
  /dashboard, /members, /certifications, /media-orders, /admin

AUTH_PATHS (redirect neu da login):
  /login, /register, /dat-mat-khau, /dang-ky, /cho-duyet
```

### Logic:
- Khach (chua login) truy cap MEMBER route -> redirect /login?callbackUrl=...
- GUEST truy cap MEMBER route -> redirect **/landing** (Phase 5: gioi thieu nang cap Hoi vien)
- Guest/GUEST truy cap LOGGED_IN route -> can login truoc, sau do co the dung
- Hoi vien truy cap ADMIN route -> redirect /
- Hoi vien membership het han truy cap MEMBER route -> redirect /membership-expired
- Hoi vien/ADMIN da login truy cap /login -> redirect /admin hoac /tong-quan
- GUEST da login truy cap /login -> redirect /feed (khong con bi force /cho-duyet)

---

## 5. Database

### Connection
- PostgreSQL qua Supabase (production) hoac localhost (dev)
- Prisma adapter-pg voi connection pooling (max: 20)
- SSL chi bat khi production + non-localhost
- Singleton pattern trong lib/prisma.ts

### Migrations
```bash
npx prisma migrate dev          # Dev migration
npx prisma db seed              # Seed data
MIGRATE_TARGET=supabase npx prisma migrate deploy  # Production
```

### Indexes
- User: role, contributionTotal, displayPriority
- Post: authorPriority+createdAt, createdAt, status, isPremium, **category+createdAt**, **category+isPremium+authorPriority** (Phase 2)
- Payment: userId, type, status, payosOrderCode, createdAt
- Product: companyId, certStatus, slug, **isFeatured+featuredOrder** (Phase 2)
- Company: slug, isPublished, **isFeatured+featuredOrder** (Phase 2)
- Certification: productId, applicantId, status

### Schema changes Phase 2 (migration `phase2_post_category_featured_flags`)
```prisma
enum PostCategory {
  GENERAL   // bai feed thuong (default)
  NEWS      // tin tuc doanh nghiep — section 5 trang chu
  PRODUCT   // tin san pham — section 6 trang chu
}

model Post {
  category PostCategory @default(GENERAL)
  // ... existing fields
}

model Company {
  isFeatured    Boolean @default(false)  // admin pin top 10 DN
  featuredOrder Int?                     // null = chua pin
  // ...
}

model Product {
  isFeatured    Boolean @default(false)  // admin pin top 20 SP
  featuredOrder Int?
  // ...
}
```

### Quota system (lib/quota.ts) — Phase 2
| Role | Default quota/thang | SiteConfig key |
|------|---------------------|----------------|
| Tai khoan co ban | 5 | `quota_guest_monthly` |
| Hoi vien ★ | 15 | `quota_vip_1_monthly` |
| Hoi vien ★★ Bac | 30 | `quota_vip_2_monthly` |
| Hoi vien ★★★ Vang | -1 (unlimited) | `quota_vip_3_monthly` |
| ADMIN | -1 (hardcoded) | — |

- Cache 60s, fallback defaults neu config keys khong ton tai
- Check khi POST /api/posts; bo dem bai DELETED de tranh gian lan

---

## 6. Caching Strategy

| Nhom trang | revalidate | Ly do |
|-----------|-----------|-------|
| Admin tat ca | 0 (realtime) | Can data moi nhat |
| Admin dashboard | 60s | Alert refresh 1 phut |
| Hoi vien realtime | 0 | Feed, profile, thanh toan |
| **Trang chu (Phase 3)** | **300s** | Newspaper layout, rotating slots refresh 5 min |
| **/landing (Phase 5)** | **600s** | Marketing page, doi data 10 phut |
| **/san-pham-tieu-bieu (Phase 4)** | **600s** | Pin list it thay doi |
| Public listing | 3600s (1h) | Tin tuc, SP, DN |
| Public detail | 1800-3600s | Chi tiet tin, SP, DN |

### Phase 3 — Trang chu Newspaper Layout
Section, query chia trong `lib/homepage.ts` voi `unstable_cache`:

| Section | Data fetcher | Cache | Filter chinh |
|---------|-------------|-------|-------------|
| 0. Banner TOP (sau menu) | `HomepageBannerSlot position="TOP"` | 60s | Banner ACTIVE + position=TOP |
| 1. Tin tuc Hoi | `getAssociationNews` | 300s | News.isPublished — sort: pinnedInCategories has GENERAL → isPinned global → publishedAt DESC (overfetch 21, slice 7) |
| 2. Ban tin hoi vien (right rail) | `getTopVipMemberPosts` (4 top) + `getRotatingMemberPosts` (9 rotating) | 300s | Top: isPremium OR isPromoted, sort `isPromoted → day VN → contributionTotal → date`. Rotate pool 30 (KHONG filter VIP), score `(log10(contributionTotal+1)+1) * (0.5 + rng())` — Phase 3.7 round 4 (ADR-035) |
| 3. SP tieu bieu (carousel) | `getFeaturedProductsForHomepage` | 600s | isFeatured=true + owner.role=VIP (Hoi vien) |
| 4. Banner MID (giua trang) | `HomepageBannerSlot position="MID"` | 60s | Banner ACTIVE + position=MID |
| 5. Nghien cuu khoa hoc | `getLatestResearchNews(5)` | 300s | category=RESEARCH OR pinnedInCategories has RESEARCH — sort pin first → publishedAt DESC. Layout: 1 hero + 4 sub-hero + SIDEBAR banner |
| 6. Tin khuyen nong | `getLatestAgricultureNews(7)` | 300s | category=AGRICULTURE OR pinnedInCategories has AGRICULTURE — sort pin first → publishedAt DESC. Layout: 1 hero + 2 mid + 4 small. **Hide khi count < 7** |
| 7. Tin DN | `getMergedFeed("NEWS","BUSINESS",6)` | 300s | Post.NEWS (isPremium/isPromoted/admin) ∪ News.BUSINESS (category OR pin has BUSINESS), template=NORMAL — sort: **pin trump tat ca** → day VN → priority → date (Q0=C, ADR-036) |
| 8. Tin SP | `getMergedFeed("PRODUCT","PRODUCT",5)` | 300s | Post.PRODUCT ∪ News.PRODUCT (category OR pin has PRODUCT) — sort: pin → day → cert APPROVED → priority → date |
| 9. Doi tac & Co quan lien ket | `getActivePartners` (PartnersCarousel) | 300s | Partner.isActive=true, sort sortOrder ASC |

**Per-section pin** (Phase 3.7 round 4, 2026-04 — ADR-038):
- `News.pinnedInCategories: NewsCategory[]` — admin tick checkbox `Ghim len section trang chu`
- Mo rong visibility cross-list: bai primary RESEARCH co the duoc pin len section AGRICULTURE → bai xuat hien o homepage Khuyen nong (du khong phai primary)
- Sort moi section: `pin-for-this-section first → publishedAt DESC` (overfetch 3x + JS sort vi Prisma orderBy khong support array `has`)
- Khac voi `News.isPinned` (boolean global, dung cho NewsSection Tin Hoi + sidebar `Noi bat` o list pages)
- API: chi `admin:full` write duoc; PATCH/POST validate enum + dedupe, server strip neu non-admin
- Admin UI: cot `Ghim trang chu` o `/admin/tin-tuc` voi 5 chip toggle inline (TH/NC/DN/SP/KN); filter `pin` query param

**Top VIP member posts** order (Phase 3.7 round 4):
- Tier 1: `isPromoted` (admin curate flag)
- Tier 2: ngay VN (startOfDay UTC+7) — bai cung 1 ngay group voi nhau
- Tier 3: `author.contributionTotal` DESC (do cong hien thuc te, thay `authorPriority` cu)
- Tier 4: `createdAt` DESC tie-break
- Overfetch 20 + JS sort (Prisma khong day-bucket native)

**Rotating slots algorithm** (right rail) (Phase 3.7 round 4):
- Pool 30 bai (truoc 50), exclude top member da hien thi
- Score `(log10(contributionTotal + 1) + 1) * (0.5 + rng())` — log scale vi range 0-20M+ VND, linear lam contrib cao luon thang deterministic
- Seed = `Math.floor(Date.now() / 300_000)` (5-min bucket) → deterministic trong 5 phut
- Mulberry32 PRNG inline (~8 dong code)
- Default count 9 (truoc 6)

**Cache invalidation tags**: `homepage`, `news`, `posts`, `products`, `companies`, `banners`, `partners`, `legal-pages`, `footer`, `site-config`
- Admin pin/unpin → `revalidateTag("homepage", "max")` + tag tuong ung
- Admin luu `/admin/cai-dat` → `revalidateTag("footer", "max")` + `revalidateTag("site-config", "max")` (cho Footer va cac block doc SiteConfig)
- Next 16 yeu cau profile arg thu 2 — dung `"max"` cho stale-while-revalidate dai nhat

### Progressive streaming trang chu (Phase 7+)
`app/(public)/page.tsx` khong con goi `Promise.all` top-level. Moi section fetch rieng,
phan lon wrap `<Suspense fallback={<Skeleton/>}>` (xem `components/features/homepage/skeletons.tsx`):
- **KHONG wrap Suspense (co chu y)**: `NewsSection` (Tin Hoi) + `MemberNewsRail` —
  block initial flush de main content luon co mat khi HTML flush lan dau
- **Wrap Suspense (stream sau)**: banner TOP/MID, CertifiedProductsCarousel,
  `LatestPostsSection` (Tin DN + Tin SP), `PartnersCarousel`
- List pages co `loading.tsx` rieng: `app/(public)/tin-tuc/loading.tsx`,
  `app/(public)/san-pham-doanh-nghiep/loading.tsx`

### Cloudinary blur placeholder
File `lib/imageBlur.ts`:
- `BRAND_BLUR_DATA_URL` — PNG base64 8×5 warm-beige (~120B) dung chung
- `cloudinaryBlurUrl(publicId)` — optional, gen blur URL tu chinh anh (Cloudinary transform `w_8,q_10,e_blur:1000`)
Ap dung `placeholder="blur" blurDataURL={BRAND_BLUR_DATA_URL}` cho `next/image` o:
PostCard (3 variants), NewsSection, CertifiedProductsCarousel, marketplace product grid.

### Footer editable qua SiteConfig
`components/features/layout/Footer.tsx` doc cac key sau tu SiteConfig (co fallback mac dinh):
- `footer_brand_desc`, `footer_working_hours`, `footer_legal_basis`, `footer_copyright_notice`
- `footer_quick_links` — moi dong format `Nhan|duong-dan`, Footer tu parse
Admin chinh tai `/admin/cai-dat` nhom **"Footer website"** (SettingsForm co
`type: "textarea"`). Nhom "Thong tin Hoi" bo sung `association_phone_2`,
`association_website`, `zalo_url`. Seed defaults: `scripts/seed-footer-settings.ts`
(idempotent, chi tao khi key chua ton tai).

---

## 6.5 Internationalization (i18n)

### Supported locales
`i18n/config.ts` — 4 locale: `vi` (default, source-of-truth), `en`, `zh`, `ar`.
`rtlLocales = ["ar"]` → `<html dir="rtl">` dat tu `app/layout.tsx`.

### URL routing
- `[locale]` dynamic segment bao quat public pages: `/vi/...`, `/en/...`, `/zh/...`, `/ar/...`
- Internal routes (`/admin/*`, `/feed/*`, `/api/*`) KHONG co locale prefix — `proxy.ts` dua locale qua header `x-locale` + cookie `NEXT_LOCALE`
- `/proxy.ts` tu redirect bare public path `/tin-tuc/*` sang `/vi/tin-tuc/*` dua tren cookie

### Dictionary loading
- `messages/{vi,en,zh,ar}.json` — ICU message format
- `i18n/get-dictionary.ts` lazy-import per locale (server-only)
- Client: `useTranslations("namespace")` tu `next-intl`
- Arabic: `messages/ar.json` seed tu en.json + ~77 key critical dich chuan (nav, common, footer, auth, homepage, feed, memberDetail). Cac key con lai fallback sang English

### DB multi-lang fields
Moi bang multilang co **4 cot** cho moi field: `field`, `field_en`, `field_zh`, `field_ar`. VI khong co suffix (default locale). Cac bang:
- `users.bio` (1 field)
- `companies.{name, description, address, representativePosition}` (4)
- `products.{name, description, category}` (3)
- `news.{title, excerpt, content}` (3)
- `menu_items.label` (1)
- `documents.{title, description, issuer, summary}` (4)
- `leaders.{name, honorific, title, workTitle, bio}` (5)
- `surveys.{title, description, questions JSON}` (3)

Tong: **24 field × 3 foreign locales = 72 cot foreign** + 24 cot VI = 96 cot multilang across 8 bang.

### Fallback chain (`i18n/localize.ts`)
`localize(record, field, locale)`:
- `vi`: `field`
- `en`: `field_en → field_zh → field_ar → field` (VI cuoi cung)
- `zh`: `field_zh → field_en → field_ar → field`
- `ar`: `field_ar → field_en → field_zh → field`

Cac sibling foreign locale duoc uu tien truoc khi fallback ve VI — user EN/ZH/AR khong bi "day nguoc" ve VI khi co ban dich sibling.

### Font stack
- **Body**: Be Vietnam Pro (subsets: vietnamese + latin, weights 300-700)
- **Heading serif**: Playfair Display (load nhung chua apply — bien `--font-heading` khong duoc css dung)
- **Chinese**: Noto Sans SC
- **Arabic**: Noto Sans Arabic — swap body font qua rule `html[lang="ar"] { font-family: var(--font-ar), ... }` trong globals.css

### Typography refinement (Option A)
Class `.refined-typography` dat tren `<body>` ap dung site-wide cho moi trang:
- Heading `font-weight: 500` (h1=600) — thay cho Tailwind `font-bold` default
- `letter-spacing: -0.02em`, `text-wrap: balance`, `line-height` tighter cho h1-h3
- Body `<p> line-height: 1.7` (deep meta text giu 1.45)

### Multi-lang editor UI
- `MultiLangInput` / `MultiLangTextarea` (components/ui/multi-lang-input.tsx) — 4 tabs (🇻🇳 VI / 🇬🇧 EN / 🇨🇳 中文 / 🇦🇪 AR), green dot indicator cho non-empty, **khong** co AI button
- `LangTabsBar` (components/ui/lang-tabs-bar.tsx) — 4 tabs + nut "🤖 Dich toan bo tu VI sang X" (gradient theo target: EN=blue-purple, ZH=red-orange, AR=emerald-teal). Dung trong News/Survey/Leader editor
- Cac input AR tu dong set `dir="rtl"` khi active

### AI translate (`/api/admin/ai/translate`)
- Target locale nhan: `en`, `zh`, `ar`
- Dung Gemini cascade (lib/gemini-models.ts) — 3 tang fallback (latest aliases → ListModels discovery → ban state) voi 24h lazy cache
- Prompt preserve HTML tags + image URLs, chi dich visible text
- Max 20 fields / request, max 120_000 chars / request

---

## 7. Email (Resend)

### Cac email tu dong:
| Trigger | Nguoi nhan | Subject |
|---------|-----------|---------|
| Admin tao Hoi vien (invite) | Hoi vien | Chao mung gia nhap |
| Admin resend invite | Hoi vien | Kich hoat tai khoan |
| Admin reset password | Hoi vien | Dat lai mat khau |
| User dang ky qua Google | Admin | [Dang ky moi qua Google] Ten |
| Hoi vien xac nhan CK membership | Admin | [Hoi TH] Ten vua CK Xd |
| Admin confirm payment | Hoi vien | Membership da kich hoat |
| Admin reject payment | Hoi vien | CK bi tu choi + ly do |
| Hoi vien nop don chung nhan | Admin | Ten nop don CN SP |
| Admin duyet chung nhan | Hoi vien | Chuc mung + ma CN |
| Admin tu choi chung nhan | Hoi vien | Ly do tu choi |
| Khach dat dich vu TT | Khach + Admin | Xac nhan don + thong bao |
| Admin doi status media order | Khach | Theo tung status |

### Config:
```
RESEND_API_KEY=re_xxx (trong .env.local)
From: "Hoi Tram Huong Viet Nam <noreply@hoitramhuong.vn>"
```

---

## 8. File Upload (Cloudinary)

- Endpoint: POST /api/upload
- Auth: required (khong cho GUEST)
- MIME: chi image/*
- Max size: 5MB
- Body: FormData voi `file` + `folder` (menu name) + optional `maxWidth` — server tu them sub-folder `MM-YYYY`
- Response: { secure_url }

### Folder convention + cap width theo ngu canh
Cloudinary transform `crop: "limit"` — chi downscale, khong upscale. Ket qua van la
WebP + `quality: "auto"` (khong doi). Cap width chon theo folder de anh dau ra nho
hon dang ke so voi cap chung 1600px truoc day.

| Menu (folder param) | Cloudinary path | Max width | Su dung tai |
|---------------------|----------------|-----------|-------------|
| `bai-viet` | `bai-viet/MM-YYYY/` | 1200px | Anh trong post (content max-width ~800px) |
| `san-pham` | `san-pham/MM-YYYY/` | 1600px | Anh san pham — modal zoom can net |
| `tin-tuc` | `tin-tuc/MM-YYYY/` | 1600px | Anh bia + body tin tuc (NewsEditor) |
| `doanh-nghiep` | `doanh-nghiep/MM-YYYY/` | 1600px (default) | Logo + cover DN; client co the override |
| `banner` | `banner/MM-YYYY/` | 2560px | Banner quang cao full-width desktop |
| `doi-tac` | `doi-tac/MM-YYYY/` | 600px | Logo doi tac (render max ~200px) |
| (default) | — | 1600px | Folder khong khai bao |
| `members` | `agarwood/members/` | — | Avatar + anh ho so hoi vien (legacy crawl) |
| `research` | `agarwood/research/{slug}/` | — | Anh nghien cuu (legacy crawl) |

Client co the ghi de qua FormData `maxWidth` (so px, server kep trong khoang
200..4000). Vi du: `CompanyEditForm.tsx` gui `maxWidth=600` cho logo va `maxWidth=1920`
cho cover. Du lieu cu khong anh huong — chi ap dung tu luc upload moi.

### Config:
```
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

---

## 9. Testing

### Unit Tests (Vitest)
```bash
npm test              # Chay 1 lan
npm run test:watch    # Watch mode
```
- 16 test cases (login page)
- Config: vitest.config.ts (jsdom, react plugin)

### E2E Tests (Playwright)
```bash
npm run test:e2e      # Chay tat ca tests
```
- 8 file test: auth, Hoi vien pages, admin pages, public pages, performance, mobile responsive
- Config: playwright.config.ts (chromium, auto start dev server)
- Video recording: bat (`video: "on"`), output: `e2e/test-results/`
- Viewport: 1280x720

### Demo Flow Tests (Playwright — Video Recording)

2 test suite chay tuan tu (serial), seed data moi tu dau, ghi video tung buoc.
Dung de **demo san pham** va **luu tru huong dan su dung**.

```bash
# Hoi vien flow (16 test cases)
npx playwright test e2e/vip-demo-flow.spec.ts --headed

# Admin flow (12 test cases)
npx playwright test e2e/admin-demo-flow.spec.ts --headed

# Ca 2
npx playwright test e2e/vip-demo-flow.spec.ts e2e/admin-demo-flow.spec.ts --headed
```

**Hoi vien Demo Flow** (`e2e/vip-demo-flow.spec.ts` — 16 steps):
| Step | Noi dung |
|------|---------|
| 00 | Seed du lieu demo moi |
| 01 | Hoi vien dang nhap |
| 02 | Xem Dashboard tong quan |
| 03 | Cap nhat ho so ca nhan (4 tab) |
| 04 | Quan ly profile doanh nghiep |
| 05 | Tao san pham moi |
| 06 | Doc Feed cong dong |
| 07 | Dang bai viet len Feed |
| 08 | Nop don chung nhan SP (3 buoc) |
| 09 | Gia han membership (chon phi, CK, ghi chu) |
| 10 | Xem lich su thanh toan |
| 11 | Xem lich su chung nhan |
| 12 | Admin xac nhan chuyen khoan |
| 13 | Admin xet duyet chung nhan |
| 14 | Admin quan ly hoi vien |
| 15 | Admin Dashboard tong quan |

**Admin Demo Flow** (`e2e/admin-demo-flow.spec.ts` — 12 steps):
| Step | Noi dung |
|------|---------|
| 00 | Seed du lieu demo moi |
| 01 | Admin dang nhap |
| 02 | Dashboard — KPI, alerts, bieu do |
| 03 | Xac nhan chuyen khoan (confirm/reject) |
| 04 | Xet duyet chung nhan SP (review 2 cot) |
| 05 | Quan ly hoi vien (tabs, search, chi tiet) |
| 06 | Tao hoi vien moi |
| 07 | Quan ly tin tuc |
| 08 | Xu ly bao cao vi pham (khoa bai, bo qua) |
| 09 | Quan ly don truyen thong (CRM) |
| 10 | Cai dat he thong (phi, ngan hang, hang) |
| 11 | Tong ket — Dashboard sau khi xu ly |

**Luu y:**
- Can start dev server truoc (`npm run dev`)
- Video output: `e2e/test-results/` (file `.webm`)
- Tai khoan demo: `admin@hoitramhuong.vn` / `binhnv@hoitramhuong.vn` / `Demo@123`

---

## 10. Deploy

### Environment Variables can thiet:
```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://... (cho migrations)
AUTH_SECRET=xxx (>32 chars)
NEXTAUTH_URL=https://[domain]
RESEND_API_KEY=re_xxx
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
CRON_SECRET=xxx (>32 chars, for Phase 6 banner-expire cron)

# Google Drive OAuth — for /admin/cai-dat PDF upload
# Reuse GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET của NextAuth,
# hoặc tạo riêng GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET
GOOGLE_DRIVE_REFRESH_TOKEN=1//xxx  (lấy 1 lần qua OAuth Playground, xem guide)
GOOGLE_DRIVE_ROOT_FOLDER_ID=xxx    (folder ID trên My Drive của user OAuth)
```

### Google Drive Setup (OAuth delegation)

**Vì sao OAuth thay vì Service Account?** Google disabled service account storage
quota từ 04/2024. Service account không thể upload vào "My Drive" nữa, bắt buộc
phải dùng Shared Drive (Workspace paid) hoặc OAuth delegation (Gmail cá nhân được).

**Setup 1 lần — lấy refresh token qua OAuth Playground:**

1. Đảm bảo OAuth client trong Google Cloud Console đã add redirect URI:
   `https://developers.google.com/oauthplayground`
   (Cloud Console → APIs & Services → Credentials → Edit OAuth 2.0 Client ID → Add URI)

2. Mở https://developers.google.com/oauthplayground

3. Click icon ⚙ (góc trên phải) → check **"Use your own OAuth credentials"**
   - Paste `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` từ .env.local
   - Close gear menu

4. Panel trái "Select & authorize APIs":
   - Scroll tìm **"Drive API v3"**
   - Check scope: `https://www.googleapis.com/auth/drive`
   - Click **Authorize APIs** (nút xanh)

5. Google consent screen hiện ra:
   - Chọn account sẽ upload file (vd: hoitramhuongvietnam2010@gmail.com)
   - Click "Advanced" nếu cảnh báo → "Go to [app] (unsafe)" → Allow

6. Quay lại Playground, bước 2 "Exchange authorization code for tokens":
   - Click **Exchange authorization code for tokens**
   - Response hiện bên phải có `refresh_token` — **copy giá trị này**

7. Paste vào `.env.local`:
   ```
   GOOGLE_DRIVE_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxxxxx
   ```

8. Lấy `GOOGLE_DRIVE_ROOT_FOLDER_ID`:
   - Vào drive.google.com với account vừa OAuth
   - Tạo folder mới (vd "Hội Trầm Hương — Tài liệu")
   - Mở folder → URL có dạng `https://drive.google.com/drive/folders/1AbC...`
   - Copy phần ID sau `/folders/`
   - Paste vào `.env.local`: `GOOGLE_DRIVE_ROOT_FOLDER_ID=1AbC...`

9. Restart dev server (`Ctrl+C` → `npm run dev`) để load env mới.

10. Test upload: `/admin/cai-dat` → section "Điều lệ Hội" → upload PDF.

**Nếu refresh token expire sau 7 ngày** (OAuth app đang ở trạng thái Testing):
- Cloud Console → APIs & Services → OAuth consent screen → **Publishing status**
- Click **PUBLISH APP** (status "In production" — refresh token không expire nữa)
- Hoặc add account đang dùng làm **Test user** để giữ 7 ngày

### Cron Jobs (Phase 6)
Dinh nghia trong `vercel.json`:
- `/api/cron/banner-expire` — chay 0h hang ngay (UTC)
  - Expire banner ACTIVE co `endDate < now` → set `EXPIRED`
  - Gui email warning cho banner sap het han (< 7 ngay)

**Auth**: Vercel Cron tu dong gui header `Authorization: Bearer ${CRON_SECRET}`.
Endpoint check header va tra 401 neu sai.

**Test manual**:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/banner-expire
```

**Alternative scheduler** (ngoai Vercel): cai `cronjob.org`, `crontab-guru` external,
hoac Windows Task Scheduler goi curl theo lich.

### Build & Start:
```bash
npm run build         # Production build
npm start             # Start production server
```

### Deploy Vercel:
1. Connect GitHub repo
2. Set environment variables
3. Build command: `npm run build`
4. Output: `.next`
5. Prisma: Add build script `prisma generate` truoc `next build`

### Deploy self-hosted:
1. Clone repo + npm install
2. Set .env.local
3. npx prisma migrate deploy
4. npm run build && npm start
5. Reverse proxy (nginx) tro ve port 3000

---

## 10.5 Navbar mode detection (pathname-based)

**Van de**: Truoc day Navbar chon menu theo `session.user.role` — Hoi vien on public
pages van thay menu member. User muon public menu cho *moi user* tru khi vao
area quan tri.

**Giai phap**: Navbar chon menu theo **pathname**, khong theo role.

**Luong**:
1. `proxy.ts` set header `x-pathname` vao moi response qua helper `passThrough()`
2. `Navbar` (server component) doc qua `headers()` API
3. `detectMode(pathname)`:
   - `/admin/*` → `admin` mode (nhung admin layout dung sidebar, khong render Navbar)
   - `/tong-quan`, `/gia-han`, `/ho-so`, `/chung-nhan`, `/doanh-nghiep-cua-toi`, `/thanh-toan`, `/ket-nap`, `/tai-lieu` → `member` mode
   - Moi pathname khac → `public` mode (bao gom `/feed`, `/tin-tuc`, `/nghien-cuu`, `/san-pham-doanh-nghiep`...)
4. `Navbar` render `PUBLIC_LINKS` / `BUSINESS_LINKS` / `INDIVIDUAL_LINKS` theo mode + accountType
5. `UserMenu` dropdown them item mode-based:
   - Public mode + Hoi vien → "Vao khu vuc quan tri" → `/tong-quan`
   - Public mode + ADMIN → "Vao trang quan tri" → `/admin`
   - Member/admin mode → "Ve trang cong khai" → `/`

**Admin sidebar** van co link "Ve trang cong khai" o cuoi nav (sau Dang xuat)
voi styling accent nen de phat hien.

---

## 10.55 Navbar CMS (dynamic menu + hybrid active highlight)

Navbar cong khai khong con hard-code 5 muc (Trang chu / Gioi thieu / Nghien cuu / MXH /
Hoi vien) — chuyen sang **DB-driven** qua model `MenuItem`. Xem ADR-025.

### Model `MenuItem`
```prisma
model MenuItem {
  id             String     @id @default(cuid())
  label          String
  href           String
  parentId       String?
  parent         MenuItem?  @relation("MenuItemChildren", fields: [parentId], references: [id])
  children       MenuItem[] @relation("MenuItemChildren")
  sortOrder      Int        @default(0)
  isVisible      Boolean    @default(true)
  isNew          Boolean    @default(false)
  comingSoon     Boolean    @default(false)
  openInNewTab   Boolean    @default(false)
  matchPrefixes  String[]   @default([])
  menuKey        String?    @unique
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
}
```
- **1 cap submenu**: API chan tao submenu cua submenu (depth > 2).
- API chan vong: `parentId` khong the la chinh node (truc tiep hoac gian tiep).

### Libraries
- **`lib/menu.ts` — `getMenuTree()`**
  - `unstable_cache` 60s, tag `menu-tree`
  - Tra ve top-level + `children` da sort theo `sortOrder`
  - Clear cache tu dong moi khi API admin write (`revalidateTag("menu-tree")`)

- **`lib/menu-active.ts` — `getActiveNodeIds(tree, pathname)`**
  - Algorithm admin-first, mutually exclusive:
    1. Neu registry (`lib/route-menu-map.ts`) khai `menuKey: null` cho pathname → khong
       highlight gi (dung cho auth/legal/404)
    2. Else: thu match qua `href` hoac `matchPrefixes` cua tung node / child.
       Neu co >= 1 match → chi cac node do active (registry bi bo qua)
    3. Else: fallback registry — node co `menuKey` trung registry key duoc active
  - Tinh 1 lan per tree, tra ve `Set<string>` id

- **`lib/route-menu-map.ts`**
  - Type `MenuKey = "home" | "about" | "research" | "social" | "members" | null`
  - List `{prefix, menuKey}` cho 34 public route
  - `null` cho auth/legal de **khong** highlight gi

### Client components
- `NavDesktopMenu` (moi) + `NavMobile` dung `usePathname()` + `getActiveNodeIds()` →
  active highlight re-render moi khi route thay doi trong layout group (truoc day navbar
  server component trong layout group khong re-render giua cac route, highlight bi ket).

### Admin UI
- `/admin/menu` — CRUD (list trai, form phai), nut "+ Them submenu" per node cha
- API:
  - `GET /api/admin/menu` — tra ve tree
  - `POST /api/admin/menu` — tao item
  - `PATCH /api/admin/menu/[id]` — sua (label/href/parentId/sortOrder/isVisible/isNew/
    comingSoon/openInNewTab/matchPrefixes/menuKey)
  - `DELETE /api/admin/menu/[id]` — xoa (cascade xoa children)

### Coverage guard
- `scripts/check-route-menu-coverage.ts` scan `app/(public)/**/page.tsx`, exit code ≠ 0
  neu route moi chua khai registry — chay o pre-commit / CI

### Seeding
- `scripts/seed-menu.ts` — 5 menu cha default (idempotent)
- `scripts/backfill-menu-keys.ts` — gan `menuKey` cho 5 menu cha
- `scripts/seed-menu-children.ts` — 14 submenu duoi 3 nhom

---

## 10.6 TipTap v3 editor (/admin/tin-tuc/[id])

### Editor config
```tsx
useEditor({
  extensions: [
    StarterKit,
    ResizableImage.configure({ inline: false, HTMLAttributes: { class: "editor-image" } }),
    TextAlign.configure({ types: ["heading", "paragraph", "image"], alignments: ["left","center","right","justify"] }),
  ],
  immediatelyRender: true,           // Client-only component — tranh SSR hydration race voi NodeView
  shouldRerenderOnTransaction: false, // Tranh flushSync-in-lifecycle voi React 19
})
```

### ResizableImage extension — Custom NodeView

File: `app/(admin)/admin/tin-tuc/[id]/ResizableImageView.tsx`

Wrapper 2-layer:
- **Outer**: `block w-full` + `style.textAlign` tu `node.attrs.textAlign` → quyet dinh vi tri ngang
- **Inner**: `relative inline-block` → container cho img + drag handles

3 drag handles (absolute positioned):
- **E** (phai-giua): drag ngang → resize width
- **S** (duoi-giua): drag doc → resize height
- **SE** (goc duoi-phai): drag → resize ca 2, giu aspect ratio

Pattern: mousemove update `lastSizeRef` + inline style; mouseup commit qua `updateAttributes` wrapped trong `queueMicrotask` (tranh flushSync).

### React 19 + TipTap 3 — flushSync fix

**Van de**: TipTap's `ReactNodeViewRenderer` dung `flushSync` noi bo khi NodeView update. React 19 strict hon, throw khi flushSync call trong lifecycle/render.

**3 fix layer**:
1. `shouldRerenderOnTransaction: false` + `useEditorState` hook cho toolbar state (useSyncExternalStore — safe pattern)
2. `immediatelyRender: true` tranh race voi NodeView mount
3. `queueMicrotask` wrap moi `editor.chain().updateAttributes()` call trong event handlers

### Sticky toolbar
- Container `.rounded-xl border bg-white shadow-sm` (khong overflow-hidden)
- Toolbar div: `sticky top-0 z-20 rounded-t-xl bg-brand-50/95 backdrop-blur`
- Phai fix admin layout `h-screen overflow-hidden` de `<main overflow-auto>` thuc su co scroll → sticky track main thay vi window

### CSS override
```ts
// Ghi de prose plugin's img max-width
className="... max-w-none!"
// Tailwind v4 important modifier: "class!" (khong phai "!class")
```

---

## 10.7 Admin notification system

### Mot endpoint, hai UI
- `GET /api/admin/pending-counts` (1 endpoint) — chay 8 `findMany` song song tren index `status`, tra ve `{ total, workflows: Record<PendingWorkflowKey, { count, recent[] }> }` voi top 3 item cu nhat moi workflow
- Hai UI dung chung: badge tren sidebar item + bell dropdown tren navbar header

### Workflows theo doi
8 workflow blocking / informational:
| Key | Bang | Signal |
|---|---|---|
| `membershipApplication` | `MembershipApplication` | `status = PENDING` |
| `payment` | `Payment` | `status = PENDING` |
| `certification` | `Certification` | `status IN (PENDING, UNDER_REVIEW)` |
| `banner` | `Banner` | `status = PENDING_APPROVAL` |
| `report` | `Report` | `status = PENDING` |
| `mediaOrder` | `MediaOrder` | `status = NEW` |
| `consultation` | `ConsultationRequest` | `status = PENDING` |
| `contact` | `ContactMessage` | `status = NEW` |

### Polling
`components/features/admin/PendingCountsContext.tsx` — single provider wrap admin layout. Poll 30s/lan + refetch khi tab gain focus. 1 fetch duoc sidebar + bell cung dung (tranh N duplicate queries).

### Components
- `PendingCountsProvider` — React Context boc quanh `(admin)/layout.tsx`
- `NotificationBell` — icon chuong + badge do tong count, click → dropdown panel 420px
  - Prop `align: "start" | "end"` — dropdown anchor direction. Sidebar desktop dung `"start"` (panel extend sang phai), mobile nav dung `"end"` (default, extend sang trai)
- Sidebar item co `pendingKey?: PendingWorkflowKey` → tu hien badge do
- Group header collapsed hien dot do neu co item pending ben trong

### Read-only admin
`INFINITE` role (read-only admin) co the doc pending counts nhung khong mutate → endpoint dung `isAdmin()` (cho doc), PATCH endpoints dung `canAdminWrite()` (chi `ADMIN`).

---

## 10.8 Contact messages (persist thay vi email-only)

Truoc day `/api/contact` chi gui email qua Resend → admin co the bo sot tin nhan khi spam filter.
Hien tai:
- **DB-first**: `prisma.contactMessage.create({...})` truoc, sau moi gui email (best-effort, that bai cung khong throw)
- **Admin UI**: `/admin/lien-he` — list + detail, select status (NEW/HANDLED/ARCHIVED), mailto/tel links, 3-line clamp + "Xem them"
- **Notification**: tu dong hien badge tren sidebar menu item "Lien he" + trong NotificationBell dropdown khi co tin nhan status=NEW
- **Polling**: qua `/api/admin/pending-counts` workflow `contact`

---

## 10.9 Feed improvements (2026-04)

### Vertical sidebar banner (`BannerPosition.SIDEBAR`)
- Fetch o `app/[locale]/(member)/feed/page.tsx` → pass vao `FeedClient.sidebarBanners` (top 5 sort by owner contribution)
- Render o aside voi `sticky top-20` (64px navbar + 16px gap) — stay pinned khi user scroll
- Aspect ratio 2:3 portrait
- Neu khong co banner active: card placeholder dashed-border dan toi `/banner/dang-ky`

### Image-first preview + Lightbox
- PostCard thumbnail grid: `flex-wrap gap-2` voi thumb `w-28 h-28 sm:w-32 sm:h-32` (XL icon)
- `extractImageUrlsFromHtml()` pull img URLs tu content HTML khi `post.imageUrls` trong (posts tu quick composer chi luu img trong content)
- `stripImgTagsFromHtml()` xoa `<img>` khoi prose block → khong render truot 2 lan
- Click thumb → `Lightbox` component: overlay `z-100 bg-black/90`, arrows left/right, counter `1/4`, keyboard `←/→/Esc`

### Post card actions
- Copy link: `navigator.clipboard.writeText(${origin}/bai-viet/${id})` voi fallback `execCommand`
- Quick composer: ap image trước `<p>text</p>` trong HTML content → hop voi image-first preview

### Cache invalidation
`POST /api/posts` goi `revalidatePath("/feed")` + `revalidatePath("/[locale]/feed", "page")` sau create → bai moi hien ngay thay vi cho 60s revalidate tick.

### Sitemap & tin-tuc redirects
- `app/sitemap.ts` filter `category IN (GENERAL, RESEARCH)`, emit URL theo category (`/tin-tuc/{slug}` vs `/nghien-cuu/{slug}`); LEGAL khong emit dynamic (them static `/privacy`, `/terms`)
- `app/[locale]/(public)/tin-tuc/[slug]/page.tsx`: neu khong tim thay GENERAL nhung slug ton tai o category khac → redirect toi URL dung (LEGAL `chinh-sach-bao-mat` → `/privacy`, RESEARCH → `/nghien-cuu/{slug}`)

---

## 10.10 Post moderation (2026-04)

Pre-moderation workflow cho moi bai do hoi vien dang qua `/feed` hoac
`/feed/tao-bai`. Admin phai duyet truoc khi bai cong khai.

### Schema changes (prisma/schema.prisma)
```prisma
enum PostStatus {
  PENDING     // moi — cho admin duyet, chi owner thay
  PUBLISHED   // admin da duyet, cong khai
  LOCKED      // admin reject HOAC auto-lock do 5+ reports
  DELETED
}

model Post {
  // ...
  status           PostStatus @default(PENDING)  // doi tu PUBLISHED sang PENDING
  moderationNote   String?    @db.Text           // moi — ly do reject cua admin
  moderatedAt      DateTime?                      // moi
  moderatedBy      String?                        // moi — adminId

  @@index([status, authorId])  // moi — cho feed filter OR
}
```

### Create flow — `POST /api/posts`
```ts
const initialStatus = session.user.role === "ADMIN" ? "PUBLISHED" : "PENDING"
// INFINITE/VIP KHONG bypass — cong bang moi tier
```

### Edit flow — `PATCH /api/posts/[id]`
- **Author edit** → `status: "PENDING"`, clear `moderationNote/moderatedAt/moderatedBy`
- **Admin edit** → preserve status hien tai

### Feed filter — `/feed/page.tsx` + `GET /api/posts`
Visibility rules (moderation-aware):
- `PUBLISHED` → public
- `LOCKED + moderationNote=null` → public (auto-lock tu 5+ reports, hien banner)
- `LOCKED + moderationNote!=null` → owner-only (admin REJECTED, noi dung co the xau)
- `PENDING` → owner-only (cho admin duyet)

```ts
where: userId ? {
  OR: [
    { status: "PUBLISHED" },
    { status: "LOCKED", moderationNote: null },
    { status: "PENDING", authorId: userId },
    { status: "LOCKED", moderationNote: { not: null }, authorId: userId },
  ],
} : {
  OR: [
    { status: "PUBLISHED" },
    { status: "LOCKED", moderationNote: null },
  ],
}
```

### Detail page guard — `/bai-viet/[id]/page.tsx`
```ts
const isModerationHidden =
  post.status === "PENDING" ||
  (post.status === "LOCKED" && !!post.moderationNote)
if (isModerationHidden && !isOwnerOrAdmin) {
  notFound()  // 404 cho nguoi khong phai owner/admin
}
```

### Admin approve/reject — `PATCH /api/admin/posts/[id]`
```ts
body = { action: "approve" }              // → PUBLISHED, clear moderation fields
body = { action: "reject", note: string } // → LOCKED + moderationNote (5-500 chars)
```
Require `canAdminWrite()`; 409 neu bai khong PENDING.

### Admin UI
- **Page**: `/admin/bai-viet/cho-duyet` (server) list pending posts sort by `createdAt ASC`
- **Sidebar**: menu "Duyet bai viet" (group "Tuong tac") voi `pendingKey: "post"`
- **pending-counts API**: them key `post` → count `prisma.post.count({ where: { status: "PENDING" }})`
- **NotificationBell**: them meta + order cho `post`

### UI Banner phan biet
- **PENDING** (chi owner thay): banner vang "Cho duyet — Chi ban thay duoc bai nay cho den khi duoc duyet"
- **LOCKED + moderationNote** (admin reject): banner do "Bi tu choi — Ly do: {note}. Ban co the chinh sua va gui lai de admin duyet"
- **LOCKED + lockReason** (auto-lock tu report): banner vang "Bai viet da bi tam khoa — {lockReason}"

---

## 11. Conventions & Patterns

### File naming
- Pages: `app/(group)/route/page.tsx` (server component)
- Client components: PascalCase (vd: `FeedClient.tsx`, `CompanyTabs.tsx`)
- Server actions: `_actions.ts` trong cung thu muc voi page
- API routes: `app/api/[domain]/route.ts`

### Data flow
- Server Component fetch data voi Prisma
- Serialize dates thanh ISO string truoc khi truyen cho client
- Client component nhan props, quan ly state voi useState
- Mutations: Server Actions (Zod validation) hoac API routes

### Security
- HTML content: DOMPurify.sanitize() truoc khi luu va truoc khi render
- Auth: Kiem tra session + role o moi API route va Server Action
- Input: Zod validation cho Server Actions, manual validation cho API routes
- Slug: Regex /^[a-z0-9-]+$/
- Password: bcryptjs cost 12

---

## 12. Import/Migration scripts

Thu muc `scripts/` chua cac one-shot scripts cho migration data tu website cu
`hoitramhuongvietnam.org`. Tat ca dung chung pattern load `.env.local` → use
Prisma client → TLS workaround cho legacy site.

### Partners (9 DN)
- `scripts/seed-partners.ts` — tao 9 Hoi vien doi tac thuc te voi Hoi vien Bac
- Logo upload Cloudinary folder `agarwood-community/members/`
- Idempotent: check Cloudinary resource trước upload
- `scripts/fix-cloudinary-double-prefix.ts` — migration fix URL co double prefix

### Van ban phap quy (8 PDF legal docs)
- `scripts/import-legal-documents.ts` — download 8 PDF tu trang cu + upload Google Drive
- Tao records Document voi category DIEU_LE/QUY_CHE
- `CATEGORY_FOLDERS` map category → Drive folder (VBPQ - *)

### News content (Research + General)
- `scripts/import-research-articles.ts` — metadata 7 bai nghien cuu (step 1)
- `scripts/import-news-articles.ts` — metadata 48 bai tin tuc tu JSON
- `scripts/crawl-research-content.ts` — step 2: crawl full HTML + image migration
  - Cho phep `--category=GENERAL|RESEARCH` flag
  - `--force` re-crawl all, `--slug=xxx` crawl 1 bai
  - DOM parse voi `jsdom` + `.single-post` selector (template chung cua trang cu)
  - Image pipeline: download → upload Cloudinary folder `agarwood-community/research/{slug}/` → rewrite src
  - Semantic clean via DOMPurify voi `ALLOWED_TAGS` whitelist
  - Empty detection: text < 100 ky tu va khong co ảnh → giữ placeholder

### Common patterns
- Load env manually (tsx khong auto-load .env.local):
  ```ts
  function loadEnvLocal() { /* parse .env.local + set process.env */ }
  loadEnvLocal()
  // Sau do dynamic-require prisma + cloudinary
  ```
- TLS workaround: `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` (legacy site cert)
- Idempotency: check DB slug/public_id truoc khi tao/upload

---

## 13. AgarwoodPlaceholder component

File: `components/ui/AgarwoodPlaceholder.tsx`

Component chung cho **tat ca fallback** (thieu avatar, thieu logo, thieu ảnh san pham, thieu cover tin tuc...). Icon mac dinh: **🌿** (la tram).

**Props**:
- `size`: xs | sm | md | lg | xl
- `shape`: square | rounded | full
- `tone`: brand | light | dark
- `className`: custom (thuong `w-X h-Y`)

**Vi du**:
```tsx
// Logo fallback trong /hoi-vien card
<AgarwoodPlaceholder className="w-16 h-16" shape="full" size="sm" />

// Thumbnail san pham khi khong co anh
<AgarwoodPlaceholder className="w-full h-full" size="lg" shape="square" />

// Cover tin tuc hero
<AgarwoodPlaceholder className="h-full w-full" size="xl" shape="square" tone="dark" />
```

Da thay cho 11 location fallback (hoi-vien, page home, san-pham-doanh-nghiep, tin-tuc, nghien-cuu, san-pham-chung-nhan, san-pham/[slug], doanh-nghiep/[slug], CertifiedProductsCarousel, PostCard, v.v.).

---

## 14. Gallery Hero — anh nen trang cong khai

Feature round-6: admin quan ly 1 bo anh phong canh lam background cho **toan bo layout public**; moi ngay he thong pick deterministic 1 anh.

### Migration
- `prisma/migrations/20260416000000_add_hero_images/` — them model `HeroImage`.

```prisma
model HeroImage {
  id         String   @id @default(cuid())
  imageUrl   String
  label      String?
  sortOrder  Int      @default(0)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

### `lib/hero.ts`
- `getDailyHeroImage(): Promise<HeroImage | null>` — dung Next.js `unstable_cache` voi tag `"hero-images"`, `revalidate: 300`.
- Thuat toan pick:
  1. `key = formatInTimeZone(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd")`
  2. `hash = fnv1a(key)`
  3. `index = hash % activeImages.length`
- `clearHeroCache()` → `revalidateTag("hero-images")`.
- **Khong** dung cache module-level (vd `let cached: HeroImage | null`) — trong Next dev, API handler va layout renderer chay trong **module graph khac nhau**, bien module-level set tu API handler **khong visible** tu layout → invalidate khong cross-process. `unstable_cache` di qua persistent layer cua Next → invalidate dung.

### `components/features/layout/HeroBackdrop.tsx`
Server component, dat trong `app/(public)/layout.tsx` — hien tren **moi trang public**.

```tsx
export default async function HeroBackdrop() {
  const hero = await getDailyHeroImage()
  if (!hero) return null
  return (
    <>
      <link rel="preload" as="image" href={hero.imageUrl} />
      <div
        data-testid="hero-backdrop"
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${hero.imageUrl})` }}
      />
    </>
  )
}
```

### Kien truc layered (translucent sections)
- HeroBackdrop o `-z-10` (base layer, fixed full viewport).
- Cac section homepage (`HomepageBannerSlot`, `CertifiedProductsCarousel`, `LatestPostsSection`, `PartnersCarousel`) doi sang **`bg-<color>/85 backdrop-blur-[2px]`** — ban trong suot → anh gallery show through toan trang ma section van giu identity mau.
- `app/(public)/page.tsx` + `app/(public)/layout.tsx` cap nhat wrapper tuong ung.

### Admin CRUD
- `/admin/gallery` (page + form inline).
- API: `GET|POST /api/admin/gallery`, `PATCH|DELETE /api/admin/gallery/[id]`.
- Upload: dung `/api/upload` voi folder `gallery`. Them key `gallery: 2560` vao `FOLDER_MAX_WIDTH` (`app/api/upload/route.ts`).

### Invalidation quan trong
Moi mutation **phai** goi ca 2:

```ts
clearHeroCache()                // revalidateTag("hero-images")
revalidatePath("/", "layout")   // bat buoc chu "layout"
```

> **Vi sao `"layout"`**: HeroBackdrop render trong `(public)/layout.tsx`. `revalidatePath("/")` mac dinh chi invalidate **page** cache, khong invalidate **layout** cache. User se van thay anh cu sau khi admin toggle. Fix: pass arg thu 2 `"layout"` → Next invalidate ca layout tree. Bug da fix va cover bang `e2e/gallery-toggle.spec.ts`.

### Sidebar
`components/features/layout/AdminSidebar.tsx` → nhom **He thong** them muc **"Gallery trang chu"** (icon `Images` tu lucide).
