# 03. Điều lệ

## Mục đích
Hiển thị nội dung Điều lệ Hội cho mọi người tra cứu, đồng thời cung cấp file PDF chính thức để tải về / xem trực tuyến trên Google Drive.

## Đối tượng
- Tất cả người dùng (public).

## Đường dẫn
- URL: `/dieu-le`
- Liên kết từ menu **"Giới thiệu"** → **"Điều lệ"**.

## Nội dung
1. **Header** — tiêu đề "Điều lệ Hội Trầm Hương Việt Nam" + ngày ban hành.
2. **Card tải file PDF** — hiển thị tên file, dung lượng, và 2 nút:
   - **Xem trực tuyến** → mở Google Drive viewer (`https://drive.google.com/file/d/.../view`).
   - **Tải về** → tải PDF trực tiếp.
3. **Tóm tắt nội dung** — các chương/điều khoản chính của Điều lệ (text dài).

## Quản lý file PDF
- File PDF lưu trên **Google Drive** (không phải Cloudinary), vì PDF lớn và cần share link công khai.
- Admin upload PDF qua `/admin/cai-dat` → mục "Văn bản pháp quy" → key `dieu_le_drive_file_id`.
- Hỗ trợ **đa ngôn ngữ**: nếu admin upload thêm bản dịch (EN/中文/AR), hệ thống tự chọn theo locale hiện tại; thiếu thì fallback về bản tiếng Việt.

## Lưu ý
- Trang cache **24 giờ** (`revalidate = 86400`) vì Điều lệ ít thay đổi.
- Khi admin upload PDF mới, cache sẽ revalidate qua tag `dieu-le`.
- Nếu chưa upload PDF, card "Tải file" sẽ ẩn — chỉ hiện text.

## Hình ảnh minh họa

**Trang Điều lệ (desktop)**

![Điều lệ](../_images/01-public/dieu-le/01-tong-quan.png)

**Điều lệ — mobile**

![Điều lệ mobile](../_images/01-public/dieu-le/02-mobile.png)
