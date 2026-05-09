# 38. Admin — Các module quản trị khác

## Mục đích
Tổng hợp các module admin chưa được mô tả riêng — gồm Bài viết feed, Ban lãnh đạo, Đối tác, Gallery, Khảo sát, Sản phẩm, Tiêu biểu, Hội đồng thẩm định. Mỗi module ngắn gọn nhưng có vai trò rõ ràng trong vận hành hệ thống.

## Đối tượng
- Admin / nhân viên ban liên quan.

## Các module

### 1. Bài viết feed (`/admin/bai-viet`)
- Quản lý các `Post` user-generated trên feed (`/feed`).
- Filter theo trạng thái (`PUBLISHED` / `DRAFT` / `HIDDEN`), category (GENERAL/NEWS/PRODUCT), tác giả.
- Hành động: Ẩn (set `status = HIDDEN`) / Xóa / Đẩy lên trang chủ (toggle pin).
- Bài bị `Report` ≥ ngưỡng → flag tự động → chờ admin review.

### 2. Ban lãnh đạo (`/admin/ban-lanh-dao`)
- CRUD `Leader` records — 3 ban: BTV (Ban Thường vụ — 7), BCH (Ban Chấp hành — 12), BKT (Ban Kiểm tra — 2).
- Mỗi leader: tên, ảnh chân dung, chức danh, tiểu sử (đa ngôn ngữ 4 tab), nhiệm kỳ (`term`), thứ tự (`sortOrder`), liên kết tới `User` (nếu có account).
- Filter theo category + nhiệm kỳ.
- Drag-and-drop sắp xếp.
- Phục vụ trang `/gioi-thieu-v2` (chỉ BTV) + `/ban-lanh-dao` (đầy đủ).

### 3. Hội đồng thẩm định (`/admin/hoi-dong-tham-dinh`)
- Quản lý 5 user là thành viên Hội đồng thẩm định sản phẩm.
- Add / Remove member.
- Thay đổi member chỉ áp dụng cho **đơn cert mới** — đơn đang `UNDER_REVIEW` giữ panel cũ.
- Xem stats: số đơn đã review, % approve/reject của từng reviewer.

### 4. Đối tác (`/admin/doi-tac`)
- Quản lý logos đối tác hiển thị ở trang chủ section "Đối tác".
- Upload logo (Cloudinary), tên, link website, sortOrder.
- Toggle `isActive` để bật/tắt mà không xóa.

### 5. Gallery (`/admin/gallery`)
- Quản lý ảnh / video gallery cho section Multimedia trên trang chủ.
- Loại: Image / YouTube / Vimeo.
- Caption đa ngôn ngữ.
- Tag để filter theo chủ đề.

### 6. Khảo sát (`/admin/khao-sat`)
- Tạo khảo sát ngắn (3-5 câu) gửi tới hội viên.
- Câu hỏi: single choice / multi choice / text / rating.
- Xem **kết quả tổng hợp** (% mỗi đáp án + biểu đồ pie).
- Auto trigger gửi qua email khi tạo + popup ở dashboard hội viên.
- Mục đích: lấy feedback nhanh + phát hiện nhu cầu nâng cấp gói (kết quả → flow `/admin/tu-van`).
- Danh sách câu hỏi tại `/khao-sat` (public) + result detail tại `/admin/khao-sat/[id]`.

### 7. Sản phẩm (`/admin/san-pham`)
- Quản lý mọi `Product` trên hệ thống.
- Filter: theo company, category, certStatus, isFeatured.
- Hành động: Featured (đẩy lên đầu marketplace) / Ẩn / Xóa.
- Bulk action: featured nhiều SP cùng lúc, xóa loạt SP của 1 owner đã bị khóa.

### 8. Tiêu biểu (`/admin/tieu-bieu`)
- Cấu hình section "Đơn vị tiên phong" + "Hội viên tiêu biểu" trên các trang public.
- Drag-and-drop chọn DN / hội viên hiển thị ở section featured.
- Override `displayPriority` của user (override dùng cho các trang featured chứ không sửa trực tiếp `User.displayPriority`).

### 9. Giám sát (`/admin/giam-sat`)
- Audit log — mọi thao tác admin (duyệt member, khóa TK, xác nhận TT, sửa setting...) được ghi.
- Filter theo: user, action type, date range.
- Mục đích: truy vết khi có sự cố ("ai đã xóa đơn cert HTHVN-2026-0042?", "lúc nào setting bank đổi?").
- Read-only, KHÔNG xóa được audit log từ UI (rule bảo mật).

## Phân quyền chi tiết
File `lib/permissions.ts` định nghĩa các permission key dùng cho từng module:
- `posts:moderate` — quản lý bài feed
- `leaders:write` — sửa ban lãnh đạo
- `council:manage` — quản hội đồng thẩm định
- `partners:write` — sửa đối tác
- `gallery:write` — sửa gallery
- `surveys:write` — tạo / sửa khảo sát
- `products:moderate` — sửa / ẩn sản phẩm bất kỳ
- `featured:manage` — chọn featured
- `audit:read` — xem audit log
- `settings:write` — sửa SiteConfig
- ...

Mỗi user có:
- **Role-based permissions** (theo `User.role`).
- **Committee-based permissions** (theo `User.committees[]` — vd "Ban Thư ký" có `news:write` + `leaders:read`).
- Helper `hasPermission(perms, "key")` kiểm tra union 2 nguồn trên.

## Read-only mode (xuyên suốt)
Một số admin chỉ có quyền đọc — UI ẩn hoặc disable nút action với tooltip giải thích lý do (`READ_ONLY_TOOLTIP`).
