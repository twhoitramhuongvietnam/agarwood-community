# 25. (Phụ lục kỹ thuật) Hệ thống email

## Mục đích
Tổng hợp các loại email tự động hệ thống gửi: đăng ký, đặt mật khẩu, gia hạn, chứng nhận, liên hệ. Phục vụ kiểm tra cấu hình + debug khi email không tới.

## Đối tượng tài liệu
- Vận hành / nhà phát triển. *(Không cần cho end-user.)*

## Provider
- **Resend** (`resend.com`) — gửi email transactional.
- API key đặt ở env `RESEND_API_KEY`. Nếu thiếu, code dùng `re_dummy_key` → email không gửi nhưng KHÔNG crash request (đã wrap try/catch).

## Sender
- Mặc định: `Hội Trầm Hương Việt Nam <noreply@hoitramhuong.vn>`.
- Domain `hoitramhuong.vn` cần config DNS (SPF, DKIM, DMARC) trên Resend dashboard.

## Danh sách email tự động

### 1. Email tiếp nhận đơn đăng ký (cho user)
- **Trigger**: user submit form `/dang-ky` thành công.
- **To**: email user vừa đăng ký.
- **Subject**: `Đã nhận đơn đăng ký — Hội Trầm Hương Việt Nam`.
- **Nội dung**: cảm ơn, hẹn 1–2 ngày làm việc, sẽ nhận tiếp email đặt mật khẩu khi admin approve.
- **API**: `POST /api/auth/register`.

### 2. Email báo admin có đơn đăng ký mới
- **Trigger**: cùng flow đăng ký (#1).
- **To**: `association_email` từ SiteConfig (fallback `admin@hoitramhuong.vn`).
- **Subject**: `[Đăng ký mới] <Họ tên> — <Doanh nghiệp>`.
- **Nội dung**: thông tin đầy đủ + nút **"Xem đơn đăng ký"** → `/admin/hoi-vien?status=pending`.

### 3. Email link đặt mật khẩu (admin approve / tạo mới)
- **Trigger**: admin approve đơn / tạo tài khoản chế độ "Gửi email mời".
- **To**: user.
- **Subject**: `Chào mừng tới Hội Trầm Hương Việt Nam — Đặt mật khẩu`.
- **Body**: link `/dat-mat-khau?token=<...>&email=<...>` (token 48h).

### 4. Email đặt lại mật khẩu (self-service)
- **Trigger**: user submit form `/quen-mat-khau`.
- **To**: user (nếu email tồn tại; nếu không tồn tại hoặc là admin → API silent return success).
- **Subject**: `Đặt lại mật khẩu - Hội Trầm Hương Việt Nam`.
- **Body**: link `/dat-mat-khau?token=...` (token 48h).
- **API**: `POST /api/auth/forgot-password`.

### 5. Email cảm ơn gia hạn membership
- **Trigger**: admin xác nhận thanh toán MEMBERSHIP_FEE = SUCCESS tại `/admin/thanh-toan`.
- **To**: user.
- **Subject**: `Cảm ơn bạn đã gia hạn hội viên`.
- **Body**: số tiền đã đóng + ngày hiệu lực mới + chip hạng (★★★/★★/★).

### 6. Email gia hạn sắp hết hạn
- **Trigger**: cron job hàng ngày (cron Vercel hoặc external scheduler).
- **To**: user có `membershipExpires` trong khoảng `now + 30d` đến `now + 7d`.
- **Subject**: `Membership của bạn sắp hết hạn`.
- **Body**: số ngày còn lại + nút **"Gia hạn ngay"** → `/gia-han`.

### 7. Email chứng nhận sản phẩm — APPROVED
- **Trigger**: cert chuyển `APPROVED` (đủ 5/5 phiếu approve).
- **To**: applicant (chủ DN nộp đơn).
- **Subject**: `[VAWA] Sản phẩm <tên SP> đã được chứng nhận`.
- **Body**: kèm certCode `HTHVN-YYYY-NNNN` + link tải PDF + QR xác thực.

### 8. Email chứng nhận sản phẩm — REJECTED
- **Trigger**: cert chuyển `REJECTED` (≥ 1 phiếu reject khi đủ 5/5).
- **To**: applicant.
- **Subject**: `[VAWA] Sản phẩm <tên SP> chưa được chứng nhận`.
- **Body**: tổng hợp 5 comment reviewer + thông tin **hoàn phí** (số tiền + ngân hàng đã khai trong tab "Ngân hàng" của hồ sơ).

### 9. Email liên hệ website (cho admin)
- **Trigger**: user submit form `/lien-he`.
- **To**: `CONTACT_INBOX_EMAIL` (env, fallback `hoitramhuongvietnam2010@gmail.com`).
- **Subject**: `[Liên hệ website] <Họ tên>`.
- **Reply-To**: email người gửi → admin chỉ cần Reply trên Gmail là phản hồi đúng người.
- **API**: `POST /api/contact`.

## Pattern xử lý lỗi gửi email

Toàn bộ chỗ gửi email đều **wrap try/catch + log error**:

```ts
try {
  await resend.emails.send({ ... })
} catch (err) {
  console.error("Failed to send <X> email:", err)
}
```

→ **Email lỗi KHÔNG fail request**:
- Đã đăng ký → user vẫn được tạo tài khoản, dù email tiếp nhận không gửi được.
- Đã thanh toán → DB vẫn lưu, dù email cảm ơn thất bại.

## Email enumeration prevention
- `/quen-mat-khau` luôn trả `success: true` dù email không tồn tại HOẶC là admin.
- `/dang-ky` trả `409` nếu email trùng — nhưng đây là lựa chọn UX (user cần biết), KHÔNG silently accept.

## Cấu hình Reply-To
- Email liên hệ → Reply-To = email user gửi → admin Reply là tới đúng user.
- Các email khác → no Reply-To (Reply tới `noreply@`).

## Domain & DNS
- `hoitramhuong.vn` cần SPF/DKIM/DMARC config:
  - SPF: `v=spf1 include:_spf.resend.com ~all`
  - DKIM: TXT record do Resend cung cấp.
  - DMARC: `v=DMARC1; p=none; rua=mailto:...` để monitor.
- DNS chưa setup đúng → email vào spam hoặc bị reject (kiểm tra với mail-tester.com).

## Test email trong dev
- Dev không có RESEND_API_KEY thật → fallback `re_dummy_key`, gọi API thất bại (silent log).
- Thay vào đó, set `RESEND_API_KEY` thật + `MAIL_TO_OVERRIDE=dev@example.com` (nếu cài) để gửi tới hộp thư test.

> Tài liệu này phục vụ vận hành / phát triển.
