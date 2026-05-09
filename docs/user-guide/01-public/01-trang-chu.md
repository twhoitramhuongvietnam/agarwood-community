# 01. Trang chủ

## Mục đích
Trang chủ là cổng thông tin chính của Hội Trầm Hương Việt Nam (VAWA). Khách truy cập (chưa đăng nhập) lẫn hội viên đều thấy cùng giao diện, chỉ khác phần CTA cuối trang: khách thấy banner "Đăng ký hội viên", hội viên không thấy.

## Đối tượng
- Khách (chưa đăng nhập)
- Hội viên / Admin (đã đăng nhập)

## Đường dẫn
- URL: `/` (mặc định chuyển hướng về `/vi`)
- Public, không cần đăng nhập

## Bố cục các khối nội dung
Theo thứ tự từ trên xuống:

1. **Thanh tiện ích** — ngày tháng, chuyển ngôn ngữ (VI / EN / 中文 / العربية), nút Đăng nhập (cho khách) hoặc menu người dùng (cho hội viên).
2. **Logo & tên hội** (masthead).
3. **Thanh menu danh mục** (sticky khi cuộn) — Trang chủ • Tin tức • Nghiên cứu • Khuyến nông • MXH Trầm Hương (badge "Demo") • Doanh nghiệp • Sản phẩm • Giới thiệu (dropdown: Ban lãnh đạo / Hội viên / Văn bản pháp lý / Điều lệ) • Liên hệ.
4. **2 banner trên đầu** (970×90, trái + phải).
5. **Breaking ticker** — thanh chạy chữ tin nóng.
6. **Tin tức (3/4) + Cột hội viên (1/4)** — bài tin tức mới nhất bên trái, danh sách hội viên tiêu biểu bên phải.
7. **Đa phương tiện (Multimedia)** — video / hình ảnh.
8. **Sản phẩm đã chứng nhận** — sản phẩm có chứng nhận VAWA.
9. **Banner giữa trang** (slot `HOMEPAGE_MID`).
10. **Nghiên cứu** — bài nghiên cứu khoa học mới nhất.
11. **Khuyến nông** — thông tin khuyến nông.
12. **Tin doanh nghiệp (7/12) + Tin sản phẩm (5/12)** — 2 cột song song, không đối xứng tạo nhịp điệu thị giác.
13. **Doanh nghiệp tiêu biểu** — companies featured.
14. **Đối tác**.
15. **CTA "Đăng ký hội viên"** — chỉ hiển thị cho khách chưa đăng nhập.
16. **Footer** — liên hệ, mạng xã hội, chính sách.

## Các bước thao tác chính
- **Đọc tin nhanh**: kéo lên xem khối "Tin tức" hoặc nhấn vào breaking ticker.
- **Tìm sản phẩm chứng nhận**: cuộn đến mục "Sản phẩm đã chứng nhận" hoặc nhấn menu "Sản phẩm".
- **Đăng ký hội viên**: nhấn nút CTA cuối trang hoặc menu "Đăng nhập" → liên kết "Đăng ký".
- **Đổi ngôn ngữ**: dùng dropdown ở góc phải utility strip phía trên.

## Lưu ý kỹ thuật
- Trang được cache 5 phút (`revalidate = 300`) — nội dung mới có thể chậm 5 phút mới hiển thị.
- Có chèn structured data `Organization` JSON-LD phục vụ SEO (Rich Results Test sẽ pass cho schema này).
- Banner chỉ hiển thị nếu admin đã upload tại `/admin/banner` — nếu chưa có, vùng banner thu gọn (không reserve khoảng trống).
- Multimedia, Featured Companies, Partners đều ẩn khi không có dữ liệu.

## Hình ảnh minh họa

**Trang chủ — phần đầu (desktop 1280px)**

![Trang chủ — phần đầu](../_images/01-public/trang-chu/01-tong-quan.png)

**Trang chủ — toàn trang (full page, để xem mạch nội dung)**

![Trang chủ — toàn trang](../_images/01-public/trang-chu/02-full-page.png)

**Trang chủ trên mobile (390×844)**

![Trang chủ — mobile](../_images/01-public/trang-chu/03-mobile.png)
