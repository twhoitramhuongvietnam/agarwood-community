# 12. Danh bạ doanh nghiệp công khai + tìm kiếm

## Mục đích
Trang công khai liệt kê các doanh nghiệp thành viên Hội. Khách / hội viên có thể tìm kiếm, lọc và xem chi tiết từng doanh nghiệp.

## Đối tượng
- Public — không cần đăng nhập.

## Đường dẫn
- Danh sách: `/doanh-nghiep`
- Chi tiết: `/doanh-nghiep/<slug>`
- Liên kết từ menu chính → **"Doanh nghiệp"**.

## Trang danh sách (`/doanh-nghiep`)

### Bố cục
1. **Hero** — tagline + 3 thẻ thống kê hoạt hình (số DN, số tỉnh thành, số năm…).
2. **Các đơn vị tiên phong** — slot featured (admin set qua `featuredOrder` hoặc tag).
3. **Thanh tìm kiếm** — search theo tên, mô tả, lĩnh vực. Tìm kiếm **realtime** (debounced 300ms).
4. **Danh bạ doanh nghiệp** — grid card 3-4 cột:
   - Logo công ty (placeholder nếu chưa upload)
   - Tên công ty
   - Lĩnh vực
   - Tỉnh/thành
   - Click → `/doanh-nghiep/<slug>`.
5. **CTA cuối trang** — "Vị trí tiếp theo trong nền giáng — có thể là bạn" + nút **"Đăng ký hội viên"** (chỉ hiện cho khách chưa đăng nhập).

### Hành vi tìm kiếm
- Search bypass cache (server query không qua `unstable_cache`).
- Featured companies vẫn ở vị trí ưu tiên trên cùng kết quả.

## Trang chi tiết (`/doanh-nghiep/<slug>`)

### Bố cục
1. **Hero cover** — ảnh bìa 16:9 + logo overlay.
2. **Tên + chức danh đại diện + huy hiệu hạng** (★/★★/★★★).
3. **Tab nội dung**:
   - **Giới thiệu** — mô tả công ty (TipTap rich content).
   - **Sản phẩm** — sản phẩm DN đang đăng (cả Certified và regular).
   - **Bài viết** — bài user đăng ở `Post.AUTHOR = company owner`.
   - **Tin tức về SP** — tin admin gắn cho công ty này.
   - **Thông tin công ty** — website, phone, address, năm thành lập, quy mô, ĐKKD.
4. **Sidebar** — thông tin liên hệ, chia sẻ, xem website.

## Lưu ý
- Chỉ hiển thị các DN có `isPublished = true` (admin có thể tạm ẩn DN trong khi cập nhật).
- Tìm kiếm ở danh sách hiện đang dùng full-text trên `name + description` (PostgreSQL text search).

## Hình ảnh minh họa

**Danh sách doanh nghiệp (full page)**

![Doanh nghiệp — list](../_images/03-hoi-vien/doanh-nghiep/01-list.png)

**Danh sách — mobile**

![Doanh nghiệp — mobile](../_images/03-hoi-vien/doanh-nghiep/02-mobile.png)

**Trang chi tiết một doanh nghiệp**

![Doanh nghiệp — detail](../_images/03-hoi-vien/doanh-nghiep/03-detail.png)
