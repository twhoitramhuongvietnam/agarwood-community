# 32. Marketplace sản phẩm (mua bán sản phẩm Hội)

## Mục đích
Hệ thống marketplace nội bộ cho hội viên + tài khoản cơ bản đăng sản phẩm trầm hương. Khách hàng có thể browse, xem chi tiết, liên hệ trực tiếp với người bán. Sản phẩm đã được Hội thẩm định có **badge chứng nhận VAWA**.

## Đối tượng
- Public — browse + xem chi tiết.
- Hội viên / Tài khoản cơ bản đã đăng nhập — đăng / sửa sản phẩm của mình.
- Admin — duyệt / ẩn / featured / xóa.

## Đường dẫn
- **Marketplace tổng** (mọi sản phẩm): `/san-pham-doanh-nghiep`
- **Sản phẩm chứng nhận** (chỉ certified VAWA): `/san-pham-chung-nhan`
- **Sản phẩm tiêu biểu** (admin chọn featured): `/san-pham-tieu-bieu`
- **Chi tiết sản phẩm**: `/san-pham/<slug>`
- **Đăng / sửa sản phẩm** (member): `/san-pham/tao-moi`, `/san-pham/<slug>/sua`
- **Lịch sử chỉnh sửa**: `/san-pham/<slug>/lich-su`

## Marketplace tổng (`/san-pham-doanh-nghiep`)

### Bố cục
1. **Hero** — tiêu đề "Sản phẩm Doanh nghiệp" + 3 thẻ thống kê (tổng số, số chứng nhận, số DN bán hàng).
2. **Tab filter** ở đầu danh sách:
   - **Tất cả** (default)
   - **Chứng nhận** — chỉ certified APPROVED
   - **Doanh nghiệp** — sản phẩm có `companyId`
   - **Cá nhân** — sản phẩm individual (không thuộc DN nào)
3. **Grid 4 cột** cards sản phẩm:
   - Ảnh chính
   - Tên SP + badge "Chứng nhận" (nếu APPROVED)
   - Tên DN bán hàng (chip)
   - Giá bán (formatted VND)
   - Click → `/san-pham/<slug>`
4. **Pagination** cuối trang (≠ tin tức dùng infinite scroll).

### Thuật toán hiển thị
Sort theo thứ tự ưu tiên:
1. **Certified** (`certStatus = APPROVED`) — luôn lên đầu.
2. **Featured** (`isFeatured = true`) — admin pin.
3. **ownerPriority desc** — denormalized từ `User.displayPriority` lúc tạo SP.
4. **createdAt desc** — mới nhất trước.

→ Sản phẩm certified của DN VIP★★★ luôn xuất hiện trên top đầu.

### Tìm kiếm + filter
- Search theo tên + mô tả + lĩnh vực.
- Filter theo `category` (Trầm tự nhiên, Trầm nuôi cấy, Tinh dầu, Mỹ nghệ...).
- Filter theo công ty.

## Sản phẩm chứng nhận (`/san-pham-chung-nhan`)
Trang riêng chỉ hiển thị **certified APPROVED** — VAWA endorsed. Bố cục tương tự nhưng:
- Header nhấn mạnh "VAWA Certified — Đã được Hội thẩm định".
- Mỗi card có badge mộc đỏ rõ ràng.
- Click → `/san-pham/<slug>` (cùng URL detail) hoặc trực tiếp link xác thực `/verify/<certCode>`.

## Trang chi tiết sản phẩm (`/san-pham/<slug>`)

### Bố cục
1. **Gallery ảnh** (đầu trang) — slideshow + thumbnail navigation.
2. **Thông tin chính** (cột phải):
   - Tên SP + badge VAWA Certified (nếu có) + badge "Sản phẩm tiêu biểu".
   - Tên DN bán → click sang `/doanh-nghiep/<companySlug>`.
   - Giá bán + giá khuyến mại (nếu có).
   - Nút **"Liên hệ người bán"** — mở form gửi email tới owner / mở Zalo / điện thoại đã khai.
3. **Tab nội dung**:
   - **Mô tả** — TipTap rich content.
   - **Thông số kỹ thuật** (loại trầm, vùng nguyên liệu, năm sản xuất...).
   - **Chứng nhận** (nếu APPROVED) — link tới trang `/verify/<certCode>` + 5 comment hội đồng.
   - **Thảo luận** — comments của user khác (chat-like, không phải Q&A SO).
4. **Sản phẩm liên quan** — gợi ý 4 SP cùng category.

### Structured data
- Schema `Product` với `Offer` + `Brand` (= tên DN).
- Sản phẩm certified thêm `additionalProperty.VAWA Certification`.

## Quota đăng sản phẩm
| Vai trò | Quota |
|---|---|
| GUEST (tài khoản cơ bản) | 3 SP/tháng |
| Hội viên ★ (Đồng) | 10 SP/tháng |
| Hội viên ★★ (Bạc) | 25 SP/tháng |
| Hội viên ★★★ (Vàng) | Không giới hạn |

> Override qua SiteConfig (key `product_quota_*`).

Quota tính theo **tháng dương lịch hiện tại**, reset ngày 1.

## Cấu trúc dữ liệu
- `Product.ownerId` (required) — user chủ.
- `Product.companyId` (optional) — chỉ có khi user thuộc Hội viên có DN.
- `Product.ownerPriority` — copy từ `User.displayPriority` lúc tạo (denormalized để query nhanh).
- `Product.certStatus` (`PENDING/UNDER_REVIEW/APPROVED/REJECTED/EXPIRED/null`) — đồng bộ với `Certification`.

## Lưu ý
- Sản phẩm certified **bắt buộc thuộc DN** (rule certification workflow). User GUEST không có DN → không nộp đơn chứng nhận được, chỉ đăng SP regular.
- Sản phẩm có `Certification` đang active → KHÔNG cho phép xóa, KHÔNG cho nộp đơn chứng nhận tiếp (block theo `Certification`, không phải `certStatus`).
- Trang detail cache 5 phút; cập nhật bài → revalidate tag `products` + `product:<slug>`.

## Hình ảnh minh họa

**Marketplace tổng (mọi sản phẩm)**

![Marketplace](../_images/01-public/san-pham/01-marketplace.png)

**Marketplace — chỉ sản phẩm chứng nhận**

![Sản phẩm chứng nhận](../_images/01-public/san-pham/02-certified.png)

**Marketplace — mobile**

![Marketplace mobile](../_images/01-public/san-pham/03-mobile.png)

**Trang chi tiết sản phẩm**

![Chi tiết sản phẩm](../_images/01-public/san-pham/04-detail.png)
