# Tai lieu Du an — Hoi Tram Huong Viet Nam

> Phien ban hien tai: **3.4** — 05/2026
> Phase 1-6 + Dieu le integration + Van ban phap quy + TipTap editor enhancements + Journalistic redesign (V2) + **Static-page CMS + i18n per-locale + News royalty + Quota sidebar**

## Danh sach tai lieu

| # | File | Doi tuong | Noi dung |
|---|------|----------|---------|
| 01 | [Huong dan Admin](01-huong-dan-admin.md) | Ban quan tri | Van hanh hang ngay + Van ban phap quy + Don ket nap + Che do xem |
| 02 | [Huong dan VIP](02-huong-dan-vip.md) | Hoi vien | Dang nhap, ho so, dang bai, chung nhan, gia han, don ket nap Hoi vien chinh thuc |
| 03 | [Business Document](03-business-document.md) | Ca 2 ben | Quy trinh, fees theo Dieu le, phan hang hoi vien, SLA, Van ban phap quy |
| 04 | [Technical Document](04-technical-document.md) | Developer | Codebase, ERD moi (MemberCategory, NewsCategory), Tiptap v3, Navbar mode, Import scripts, Static-page CMS, news royalty, PoC quota |
| 05 | [Architecture Decisions](05-architecture-decisions.md) | Developer | 45 ADR — them ADR-042 (Static-page CMS kind=dieu-le), ADR-043 (per-locale column lookup), ADR-044 (i18n requestLocale fix), ADR-045 (News royalty auto-credit) |
| 06 | [API Documentation](06-api-documentation.md) | Developer | 30+ endpoints — them MembershipApplication, phap-ly admin CRUD, news category, static-page-config CRUD |
| 07 | [Demo Flow Tests](../testing/demo-flow/README.md) | QA / Demo | 2 E2E test suite (VIP 16 buoc + Admin 12 buoc), ghi video tu dong |

## Ai doc gi

| Vai tro | Tai lieu can doc |
|---------|-----------------|
| Admin (ngay dau) | 01 (muc 1-10), 03 (muc 1, 2, 3, 5, 7, 12) |
| Admin nhan **Van ban phap quy / Don ket nap** (moi) | 01 (muc 11, 12, 13) |
| Hoi vien moi | 02 (muc 1-10) |
| Hoi vien muon **Hoi vien chinh thuc** (moi) | 02 (muc 11), 03 (muc 1.0, 1.3.1) |
| Developer moi | 04, 05, 06 |
| Developer implement **TipTap editor**/**Import scripts** | 04 (muc 10.6, 12), 05 (ADR-018, 019, 020) |
| Developer implement **Navbar mode** | 04 (muc 10.5), 05 (ADR-017) |
| Developer sua **chrome (SiteHeader/CategoryBar/SiteFooter)** | 05 (ADR-033) |
| Developer them route list voi **lazy-load pattern** | 05 (ADR-034) |
| Khi co tranh chap | 03 (muc 4, 9) |
| Khi tich hop mobile/3rd party | 06 |
| Khi can demo san pham / quay video | 07 |

## Changelog gan nhat (3.4 — Static-page CMS + i18n per-locale + News royalty, 2026-05)

- **Static-page CMS mo rong**: `/admin/trang-tinh` them 5 mockup tabs ngoai
  `about` cu — `companies` (Doanh nghiep, 22 keys), `certProducts` (San pham
  chung nhan, 26 keys), `contact` (Lien he, 9 keys), `home` (Trang chu, 16 keys
  → edit footer text via `fallbackNamespace="footer"`), `dieuLe` (Dieu le, full-
  width DieuLeMockup voi 4 PDF uploaders vi/en/zh/ar). `StaticPageMeta` schema
  gain `kind?: "text-cms" | "dieu-le"` + `fallbackNamespace?: string`.
- **Bo "Footer website" group khoi `/admin/cai-dat`** — text footer chuyen sang
  CMS o `/admin/trang-tinh?page=home`. Dieu le PDF uploader cung doi cho:
  truoc o `/admin/cai-dat`, nay o `/admin/trang-tinh?page=dieuLe`.
- **i18n per-locale lookup fix**: `lib/static-texts.ts` chuyen tu cross-language
  fallback chain (`localize()`) sang per-locale column lookup voi messages-file
  fallback — admin form khop dung voi public render. `i18n/request.ts` honor
  explicit `requestLocale` (truoc hardcode header → admin CMS load 4 lang nhan
  vi messages cho ca 4). Multilingual coverage (vi/en/zh/ar) cho
  `/gioi-thieu-v2`, `/doanh-nghiep`, `/san-pham-chung-nhan`, `/lien-he`,
  `/dieu-le`. Site footer doc qua `getStaticTexts("home", locale, "footer")`.
- **Legacy `/gioi-thieu` v1 da xoa** — `/about` redirect → `/gioi-thieu-v2`.
  Sitemap chi emit `/gioi-thieu-v2`. Hero RTL flip cho `/ar/gioi-thieu-v2`.
- **News royalty auto-credit**: khi bai tin tuc duoc publish (POST
  `isPublished=true` hoac PATCH draft → publish), he thong tu dong tao
  `HonoraryContribution` record cho tac gia voi amount = `news_royalty_amount`
  SiteConfig key (default 1tr VND, set 0 de tat). Idempotent qua marker
  `[news:{id}]` — re-publish/edit khong double-credit. Cap nhat
  `User.contributionTotal` + `displayPriority` + `Post.authorPriority`. Helper
  `lib/news-royalty.ts` `creditNewsRoyaltyOnPublish(tx, args)`. Khong gia han
  membershipExpires (extendMonths=0).
- **Quota display sidebar feed**: `/feed` sidebar them `<QuotaCard>` hien 3
  monthly quota — Bai dang (`lib/quota.ts`), San pham (`lib/product-quota.ts`),
  Banner QC (`lib/bannerQuota.ts`). Trong PoC mode (`POC_UNLIMITED_POSTS=1`,
  default ON, xem `lib/poc-mode.ts`), moi limit tra `-1` → UI hien
  `Da dang X · ∞`. Khi PoC tat va limit > 0: progress bar adaptive color
  (emerald/amber/red) + Nang hang CTA o ≥80%. Banner `/banner/dang-ky` quota
  chip cung hien `Da dang X · ∞` trong PoC mode.
- **`lib/quota.ts` count fix**: truoc dem chi `PUBLISHED` → user vua post bi
  thay quota=0/15. Fix: dem moi status tru DELETED (PENDING la default cho
  non-admin sau migration `post_status_pending_default`).
- **TikTok pill**: SiteConfig key moi `tiktok_url` ("Thong tin Hoi" group) →
  render TikTok icon trong `OfficialChannelsBlock` (privacy/terms/contact) +
  top `MemberRail` trang chu canh Facebook/Zalo/YouTube.
- **Cert badge clickable**: badge "✓ Hoi Tram Huong Viet Nam" tren
  `/san-pham/[slug]` linh toi `/verify/{certCode || slug}`.
- **Cai dat reorder**: "Thong tin Chuyen khoan" nay dat truoc "Phi & Gioi han".
  Them key `news_royalty_amount` trong "Phi & Gioi han".

## Changelog 3.3 — Journalistic redesign (2026-04)

- **Chrome redesign**: `Navbar` cu -> `SiteHeader` (utility strip + masthead +
  CategoryBar sticky) + `SiteFooter`. Apply ca cho `(public)` va `(member)`
  layouts → feed co cung look voi public pages.
- **CategoryBar moi**: 8 items chinh + dropdown "Gioi thieu" 4 sub-items
  (Ban lanh dao, Hoi vien, Van ban phap ly, Dieu le) + 2 auth CTAs (Dang nhap
  outlined + Dang ky amber) cho guest. Sticky top-0. Active highlight via
  `usePathname` + prefix match.
- **UserMenu session-aware**: `variant="light"` ở masthead cho logged-in user —
  avatar 56-64px bang logo Hoi + ten truoc avatar font-black match H1.
- **Article detail V2** (`/tin-tuc/[slug]`, `/nghien-cuu/[slug]`): Merriweather
  serif H1, sapo bold prefix "VAWA - ", byline single-line, 2-col + sticky
  sidebar, `ArticleToolbar` dọc ben trai (share/comment/print/zoom), shared
  `SidebarList` component (Tin noi bat + Moi dang).
- **Article list V2** (`/tin-tuc`, `/nghien-cuu`): hero ngang (image-left +
  text-right) + 3 sub-hero grid + lazy-load 10 items/batch qua server action +
  `IntersectionObserver`. Mobile DOM order: Hero → Aside → Latest. KHONG
  pagination URL.
- **Perf wins**: `unstable_cache` cho default list variants (5-10 min tuy page),
  Suspense stream sidebar, Merriweather tải chi 1 weight, remove DOMPurify khoi
  client bundle (sanitize-on-save đã đủ).
- **Feed updates**: Filter chips moved ABOVE editor, remove "Tat ca"/"Chung
  nhan" → chi NEWS + PRODUCT, default = NEWS. PRODUCT mode editor hien form
  (ten/danh muc select/gia/tieu de/noi dung). Like/comment/share icon-only.
  Fix optimistic post status để badge "Cho duyet" hien dung.
- **CTA "Nop don chung nhan"**: reloc tu cuoi trang len top banner giua filter
  + grid o `/san-pham-chung-nhan` (above-the-fold visibility).
- **5 trang Gioi thieu + submenu** cleanup chrome (bo brand-800 banner + beige
  wash + white card) + cache hot queries (leaders, members, documents,
  siteConfig) 10-30 phut.
- **unstable_cache Date pattern**: new `normalizeDate(d: Date | string | null)`
  pattern cho tat ca consumer sau cache read → tranh `TypeError:
  .toLocaleDateString is not a function`.

## Changelog 3.2 (Dieu le integration)

- **Dieu le Hoi**: 3 hang hoi vien (OFFICIAL / AFFILIATE / HONORARY) + fees dung voi Dieu le (1-2tr nien lien thay 5-10tr)
- **Don ket nap workflow**: `/ket-nap` (user) + `/admin/hoi-vien/don-ket-nap` (admin) + `MembershipApplication` model + email notifications
- **Van ban phap quy**: `/phap-ly` public (3 tabs) + `/admin/phap-ly` admin CRUD + 8 PDF da import
- **Menu restructure**: Public menu moi (Trang chu / Tin tuc / Nghien cuu / Doanh nghiep / San pham / Quyen loi)
- **Navbar mode detection**: theo pathname (khong theo role) — VIP/ADMIN tren trang cong khai thay menu public
- **TipTap v3 editor**: Drag-resize image voi React NodeView, text-align, sticky toolbar, queueMicrotask pattern fix flushSync
- **Content import**: 7 bai nghien cuu + 48 bai tin tuc tu trang cu, images tu dong migrate Cloudinary
- **AgarwoodPlaceholder** component: fallback 🌿 icon thong nhat cho moi ảnh/avatar thieu
