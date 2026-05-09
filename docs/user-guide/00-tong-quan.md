# Tài liệu hướng dẫn sử dụng — Hội Trầm Hương Việt Nam (VAWA)

> Bộ tài liệu này dành cho khách hàng / hội viên / nhân viên vận hành hệ thống. Mỗi mục là một file Markdown độc lập, kèm hình minh họa Playwright (`_images/`).
> Sau khi hoàn chỉnh các file MD, dùng Claude chat để biên tập thành 1 file `.docx` đóng gói cho bàn giao.

## Cấu trúc tài liệu

```
docs/user-guide/
├── 00-tong-quan.md                  ← Tài liệu này (mục lục)
├── 01-public/                       ← Trang công khai
├── 02-tai-khoan/                    ← Đăng ký, đăng nhập, quên mật khẩu
├── 03-hoi-vien/                     ← Khu vực hội viên (sau đăng nhập)
├── 04-admin/                        ← Khu vực quản trị
├── 05-advanced/                     ← Tính năng nâng cao (feed, chứng nhận, kết nạp, pháp lý)
├── 06-phu-luc/                      ← Phụ lục kỹ thuật (vận hành / phát triển)
└── _images/                         ← Hình minh họa Playwright
```

## Quy ước

- Mỗi file MD theo khung: **Mục đích / Đối tượng / Đường dẫn / Bố cục hoặc Các bước / Lưu ý / Hình ảnh minh họa**.
- Hình minh họa: viewport mặc định **1280×720** (desktop); thêm shot **390×844** (mobile) khi cần.
- File ảnh tổ chức theo `_images/{section}/{slug}/{shot-name}.png`.
- Đường dẫn ảnh trong MD dùng tương đối (`../_images/...`) để render đúng cả trên VS Code lẫn khi convert ra `.docx`.

## Phân quyền 4 tầng (theo code thực tế)

| Tầng | Tên trong code | Truy cập |
|---|---|---|
| **Khách** | chưa đăng nhập | Trang `(public)`: trang chủ, tin tức, doanh nghiệp, liên hệ… |
| **Tài khoản cơ bản** | `role = GUEST` | Như khách + đăng feed có quota, đăng SP cá nhân ≤ 3/tháng, được vào hội đồng nếu admin assign |
| **Hội viên** | `role = VIP` (★/★★/★★★) | + hồ sơ DN, đăng SP theo hạng, gia hạn, nộp đơn chứng nhận, vào `/tong-quan`, `/ho-so`, `/gia-han` |
| **Admin** | `role = ADMIN/INFINITE`, hoặc VIP có committees | Toàn quyền `/admin/*` |

> Code không còn nhãn "VIP" hiển thị (đã rename → "Hội viên" + ★/★★/★★★). Một số path `(vip)/` chỉ là route group, không phản ánh role.

## Mục lục các bài viết

### 01 — Trang công khai
1. [Trang chủ](01-public/01-trang-chu.md)
2. [Giới thiệu — lịch sử, sứ mệnh, ban lãnh đạo](01-public/02-gioi-thieu.md)
3. [Điều lệ](01-public/03-dieu-le.md)
4. [Tin tức — danh sách + chi tiết](01-public/04-tin-tuc.md)
5. [Liên hệ](01-public/05-lien-he.md)
32. [Marketplace sản phẩm (mua bán)](01-public/32-marketplace-san-pham.md)
33. [Nghiên cứu khoa học + Khuyến nông](01-public/33-nghien-cuu-khuyen-nong.md)

### 02 — Tài khoản
6. [Đăng ký + email chào mừng](02-tai-khoan/06-dang-ky.md)
7. [Đăng nhập](02-tai-khoan/07-dang-nhap.md)
8. [Quên mật khẩu (self-service)](02-tai-khoan/08-quen-mat-khau.md)

### 03 — Khu vực Hội viên
10. [Tổng quan hội viên](03-hoi-vien/10-tong-quan.md)
11. [Hồ sơ doanh nghiệp + upload logo](03-hoi-vien/11-ho-so-doanh-nghiep.md)
12. [Danh bạ doanh nghiệp công khai + tìm kiếm](03-hoi-vien/12-danh-ba-doanh-nghiep.md)
14. [Lịch sử thanh toán](03-hoi-vien/14-lich-su-thanh-toan.md)
15. [Gia hạn + format chuyển khoản](03-hoi-vien/15-gia-han.md)
35. [Tài liệu Hội (thư viện văn bản nội bộ)](03-hoi-vien/35-tai-lieu-hoi.md)

### 04 — Khu vực Admin
16. [Quản lý hội viên](04-admin/16-quan-ly-hoi-vien.md)
17. [Tạo tài khoản hội viên (đã bỏ "VIP")](04-admin/17-tao-tai-khoan-hoi-vien.md)
18. [Xác nhận thanh toán thủ công](04-admin/18-xac-nhan-thanh-toan.md)
19. [Đăng / quản lý tin tức](04-admin/19-dang-tin-tuc.md)
20. [Kích hoạt / khóa tài khoản](04-admin/20-kich-hoat-khoa-tai-khoan.md)
30. [Dashboard quản trị tổng thể (charts + báo cáo)](04-admin/30-dashboard-quan-tri.md)
31. [Module Truyền thông + CRM nội bộ](04-admin/31-truyen-thong-crm.md)
36. [Sổ quỹ thu chi (Ledger)](04-admin/36-so-quy-thu-chi.md)
37. [Cài đặt hệ thống & Trang tĩnh](04-admin/37-cai-dat-he-thong.md)
38. [Các module quản trị khác (bài viết, ban lãnh đạo, đối tác, gallery, khảo sát, hội đồng thẩm định...)](04-admin/38-cac-module-quan-tri-khac.md)

### 05 — Tính năng nâng cao
21. [Feed cộng đồng](05-advanced/21-feed-cong-dong.md)
22. [Module chứng nhận sản phẩm (end-to-end)](05-advanced/22-chung-nhan-san-pham.md)
23. [Đơn kết nạp Hội viên chính thức (`/ket-nap`)](05-advanced/23-ket-nap-hoi-vien.md)
24. [Văn bản pháp quy (`/phap-ly`)](05-advanced/24-phap-ly.md)
34. [Xác thực chứng nhận sản phẩm (`/verify`)](05-advanced/34-xac-thuc-chung-nhan.md)

### 06 — Phụ lục kỹ thuật *(dành cho vận hành + phát triển, không cần đưa vào hướng dẫn end-user)*
9.  [Proxy / Middleware phân quyền](06-phu-luc/09-proxy-phan-quyen.md)
25. [Hệ thống email (Resend)](06-phu-luc/25-email-he-thong.md)
26. [Structured data (JSON-LD)](06-phu-luc/26-structured-data-jsonld.md)
27. [Đa ngôn ngữ + Editor 4 tab + AI dịch](06-phu-luc/27-da-ngon-ngu-ai-dich.md)
28. [Responsive mobile](06-phu-luc/28-responsive-mobile.md)
29. [Tốc độ load < 3 giây](06-phu-luc/29-toc-do-load.md)

## Cách chạy lại screenshots
Yêu cầu: dev server đang chạy ở `http://localhost:3000`.

```bash
npm run dev   # nếu chưa chạy

# Chạy toàn bộ
npx tsx scripts/playwright/capture-user-guide.ts all

# Hoặc từng section (xem main() trong script):
npx tsx scripts/playwright/capture-user-guide.ts trang-chu
npx tsx scripts/playwright/capture-user-guide.ts gioi-thieu
npx tsx scripts/playwright/capture-user-guide.ts ban-lanh-dao
npx tsx scripts/playwright/capture-user-guide.ts dieu-le
npx tsx scripts/playwright/capture-user-guide.ts tin-tuc
npx tsx scripts/playwright/capture-user-guide.ts lien-he
npx tsx scripts/playwright/capture-user-guide.ts dang-ky
npx tsx scripts/playwright/capture-user-guide.ts dang-nhap
npx tsx scripts/playwright/capture-user-guide.ts quen-mat-khau
npx tsx scripts/playwright/capture-user-guide.ts tong-quan-hv
npx tsx scripts/playwright/capture-user-guide.ts ho-so
npx tsx scripts/playwright/capture-user-guide.ts ho-so-tabs
npx tsx scripts/playwright/capture-user-guide.ts doanh-nghiep-cua-toi
npx tsx scripts/playwright/capture-user-guide.ts doanh-nghiep
npx tsx scripts/playwright/capture-user-guide.ts thanh-toan
npx tsx scripts/playwright/capture-user-guide.ts gia-han
npx tsx scripts/playwright/capture-user-guide.ts admin-dashboard
npx tsx scripts/playwright/capture-user-guide.ts admin-hoi-vien
npx tsx scripts/playwright/capture-user-guide.ts admin-thanh-toan
npx tsx scripts/playwright/capture-user-guide.ts admin-tin-tuc
npx tsx scripts/playwright/capture-user-guide.ts feed
npx tsx scripts/playwright/capture-user-guide.ts chung-nhan
npx tsx scripts/playwright/capture-user-guide.ts ket-nap
npx tsx scripts/playwright/capture-user-guide.ts phap-ly
npx tsx scripts/playwright/capture-user-guide.ts i18n
npx tsx scripts/playwright/capture-user-guide.ts marketplace
npx tsx scripts/playwright/capture-user-guide.ts nghien-cuu
npx tsx scripts/playwright/capture-user-guide.ts khuyen-nong
npx tsx scripts/playwright/capture-user-guide.ts xac-thuc
npx tsx scripts/playwright/capture-user-guide.ts tai-lieu
npx tsx scripts/playwright/capture-user-guide.ts banner-dang-ky
npx tsx scripts/playwright/capture-user-guide.ts admin-thu-chi
npx tsx scripts/playwright/capture-user-guide.ts admin-truyen-thong
npx tsx scripts/playwright/capture-user-guide.ts admin-cai-dat
npx tsx scripts/playwright/capture-user-guide.ts admin-thong-ke
```

Account dùng để chụp:
- Admin: `admin@hoitramhuong.vn` / `Demo@123`
- Hội viên: `binhnv@hoitramhuong.vn` / `Demo@123` (ThS. Nguyễn Văn Bình — Hội viên Vàng ★★★)

## Kế hoạch chuyển sang `.docx`
1. Mở file MD chính + ảnh đi kèm trong Claude chat.
2. Yêu cầu: "Chuyển bộ tài liệu trong `docs/user-guide/` thành 1 file `.docx` có mục lục, header/footer với logo VAWA, theo thứ tự đã ghi trong `00-tong-quan.md`. Ảnh giữ tỷ lệ gốc, kèm caption.".
3. Hoặc dùng `pandoc` công cụ command-line:
```bash
pandoc docs/user-guide/00-tong-quan.md \
  docs/user-guide/01-public/*.md \
  docs/user-guide/02-tai-khoan/*.md \
  docs/user-guide/03-hoi-vien/*.md \
  docs/user-guide/04-admin/*.md \
  docs/user-guide/05-advanced/*.md \
  docs/user-guide/06-phu-luc/*.md \
  -o docs/HDSD-VAWA.docx \
  --resource-path=docs/user-guide \
  --toc --toc-depth=2
```
