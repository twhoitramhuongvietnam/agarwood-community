# Huong dan su dung danh cho Hoi vien
## Hoi Tram Huong Viet Nam — Phien ban 3.4

> Chao mung ban gia nhap cong dong Hoi Tram Huong Viet Nam!
> Tai lieu nay huong dan ban su dung day du cac tinh nang cua he thong.
> Cap nhat lan cuoi: 05/2026 (Phase 1-6 + Dieu le Hoi + QuotaCard sidebar + PoC mode)
>
> **Phase 2**: Tu phien ban moi, **bat ky ai** dang ky tai khoan cung su dung duoc ngay
> (Tai khoan co ban — 5 bai/thang). Nang cap len **Hoi vien** de tang quota va xuat hien tren trang chu.
>
> **Phase 3.2**: Theo Dieu le Hoi, de duoc cong nhan **Hoi vien chinh thuc** can nop
> don ket nap va duoc Ban Thuong vu xet duyet (xem [muc 11](#11-don-ket-nap-hoi-vien-chinh-thuc)).

---

## Muc luc

1. [Dang nhap lan dau](#1-dang-nhap-lan-dau)
2. [Tong quan Dashboard](#2-tong-quan-dashboard)
3. [Cap nhat ho so ca nhan](#3-cap-nhat-ho-so-ca-nhan)
4. [Quan ly doanh nghiep](#4-quan-ly-doanh-nghiep) *(chi Doanh nghiep)*
5. [Quan ly san pham](#5-quan-ly-san-pham) *(chi Doanh nghiep)*
6. [Dang bai tren Feed](#6-dang-bai-tren-feed)
7. [Nop don chung nhan san pham](#7-nop-don-chung-nhan-san-pham) *(chi Doanh nghiep)*
8. [Gia han membership](#8-gia-han-membership)
9. [Dat dich vu truyen thong](#9-dat-dich-vu-truyen-thong)
10. [Cau hoi thuong gap](#10-cau-hoi-thuong-gap)
11. [Don ket nap Hoi vien chinh thuc](#11-don-ket-nap-hoi-vien-chinh-thuc)
12. [Che do xem Cong khai / Quan tri](#12-che-do-xem-cong-khai-quan-tri)

---

## Hai loai tai khoan Hoi vien

He thong co 2 loai tai khoan hoi vien:

| Loai | Danh cho | Menu hien thi |
|------|---------|--------------|
| **Doanh nghiep** | Chu doanh nghiep tram huong | Tong quan, Bang tin, Doanh nghiep, Chung nhan SP, Gia han, Ho so |
| **Ca nhan / Chuyen gia** | Chuyen gia, nha nghien cuu, nghe nhan, nha suu tam | Tong quan, Bang tin, Tai lieu, Gia han, Ho so |

**Tinh nang chung** (ca 2 loai): Dang bai feed, ho so ca nhan, gia han membership, lich su thanh toan, tai lieu Hoi, dich vu truyen thong.

**Chi danh cho Doanh nghiep**: Quan ly doanh nghiep, tao san pham, nop don chung nhan SP.

> Muc 4, 5, 7 trong tai lieu nay chi ap dung cho tai khoan **Doanh nghiep**.

---

## 1. Dang nhap

He thong ho tro 2 cach dang nhap:

### Cach 1: Dang nhap bang Google (khuyen dung)
1. Truy cap: `https://[domain]/login`
2. Click "Dang nhap bang Google"
3. Chon tai khoan Google cua ban -> cap quyen
4. He thong tu dong dang nhap va dua ban den trang Tong quan

> **Uu diem**: Khong can nho mat khau, bao mat hon (dung bao mat Google 2FA).

### Cach 2: Dang nhap bang email + mat khau
1. Truy cap: `https://[domain]/login`
2. Nhap email va mat khau
3. Click "Dang nhap"

### Dang nhap lan dau (email moi tu admin):
1. Mo email tu "Hoi Tram Huong Viet Nam"
2. Click nut "Dat mat khau & Kich hoat tai khoan"
3. He thong xac minh link — neu hop le, hien form dat mat khau
4. Nhap mat khau moi (toi thieu 8 ky tu) + xac nhan
5. Thanh do luc mat khau hien thi muc do: Yeu / Trung binh / Manh
6. He thong tu dong dang nhap va dua ban den trang Tong quan

> **Luu y**: Link trong email chi co hieu luc 48 gio. Neu het han, lien he ban quan tri de gui lai.

### Dang nhap lan dau (mat khau tu admin):
1. Truy cap: `https://[domain]/login`
2. Nhap email va mat khau duoc cung cap
3. Sau khi dang nhap, nen doi mat khau tai trang Ho so

> **Meo**: Sau khi co tai khoan, ban co the lien ket Google de dang nhap nhanh hon. Chi can click "Dang nhap bang Google" voi email trung voi tai khoan Hoi vien.

---

## 2. Tong quan Dashboard

Sau khi dang nhap, ban se thay trang `/tong-quan` voi:

- **Loi chao** theo thoi gian (buoi sang/chieu/toi) + ten ban
- **Ten cong ty** va hang hoi vien (Co ban / Bac / Vang)
- **3 the thong ke**:
  - Membership: so ngay con lai
  - Bai viet: so bai da dang
  - SP Chung nhan: so san pham da duoc chung nhan

- **Thao tac nhanh**: Dang bai | Nop don chung nhan | Gia han | Lich su thanh toan
- **Thong bao gan day**: trang thai payment, chung nhan...

---

## 3. Cap nhat ho so ca nhan

Truy cap: `/ho-so` (hoac click "Ho so" tren thanh menu)

### 4 tab:

**Tab Thong tin ca nhan:**
- Doi ten, so dien thoai
- Email khong the thay doi (lien he admin neu can)
- Link den trang chinh sua doanh nghiep

**Tab Ngan hang** (quan trong):
- Dien thong tin TK ngan hang de nhan hoan tien khi can
- Chon ngan hang tu dropdown (khong tu go)
- Ten chu TK phai viet IN HOA, khong dau (vd: NGUYEN VAN A)
- So TK chi chua so, 6-20 ky tu

> **Tai sao can dien?** Khi ban nop don chung nhan va bi tu choi, admin can TK ngan hang de hoan lai 5 trieu phi xet duyet.

**Tab Bao mat:**
- Doi mat khau: nhap mat khau cu -> mat khau moi -> xac nhan
- Mat khau moi toi thieu 8 ky tu

**Tab Lich su:**
- Bang lich su dong phi membership
- Tong dong gop tich luy va muc uu tien hien tai
- Canh bao khi membership sap het han (con < 30 ngay)

---

## 4. Quan ly doanh nghiep (CHI DOANH NGHIEP)

### Xem trang doanh nghiep
- Trang cong khai: `/doanh-nghiep/[slug-cong-ty]`
- Bat ky ai cung co the xem (ke ca khach vang lai)
- Hien thi: anh bia, logo, ten, nam thanh lap, dia chi, mo ta, san pham

### Chinh sua thong tin
1. Truy cap trang doanh nghiep cua ban -> click "Chinh sua" (goc phai)
2. Hoac truy cap truc tiep: `/doanh-nghiep/chinh-sua`

**3 phan:**
- Thong tin co ban: ten, slug (URL), nam thanh lap, quy mo, so DKKD
- Mo ta & Lien he: gioi thieu, dia chi, SDT, email, website
- Hinh anh: upload logo (1:1) va anh bia (3:1)

> **Luu y ve slug**: Doi slug se doi URL cong khai. URL cu se khong con hoat dong.

---

## 5. Quan ly san pham (CHI DOANH NGHIEP)

### Them san pham moi
1. Vao trang doanh nghiep -> tab "San pham" -> click "+ Them san pham"
2. Hoac truy cap: `/san-pham/tao-moi`

**Dien thong tin:**
- Ten san pham, slug (tu dong tao)
- Danh muc: Tram tu nhien / Tinh dau / Nhang / Vong deo / Thu cong / ...
- Mo ta chi tiet (goi y: nguon goc, huong thom, cach bao quan)
- Muc gia (vd: "500k-2tr" hoac "Lien he")
- Upload anh: toi da 10 anh, anh dau tien la anh dai dien

> **Goi y chup anh**: Nen chup duoi anh sang tu nhien de the hien dung mau sac va van go.

### Chinh sua san pham
- Vao trang san pham -> click "Chinh sua san pham"
- Hoac: `/san-pham/[slug]/sua`

### Xoa san pham
- San pham da co don chung nhan: KHONG the xoa, chi co the an (tat "Cong khai")
- San pham chua co don: co the xoa binh thuong

---

## 6. Dang bai tren Feed

### Dang bai nhanh
1. Truy cap `/feed`
2. Click vao o "Chia se kien thuc, kinh nghiem..." o dau trang
3. He thong dua ban den trang soan bai `/feed/tao-bai`

### Soan bai voi trinh soan thao
- Nhap tieu de (tuy chon nhung nen co)
- Nhap noi dung (toi thieu 50 ky tu)
- Dinh dang: in dam, in nghieng, link, danh sach, tieu de phu
- Dinh kem anh: keo tha anh vao trinh soan thao
- He thong tu dong luu nhap moi 30 giay

### Xem truoc & Dang
- Click "Xem truoc" de xem bai nhu khi hien thi tren feed
- Click "Dang bai" de gui bai len he thong

### Kiem duyet bai viet (MOI)
- Sau khi dang, bai o trang thai **CHO DUYET** (`PENDING`):
  - Ban van THAY duoc bai cua minh tren `/feed` voi badge vang "Cho duyet"
  - Nguoi khac KHONG thay bai nay
  - Ai vao link truc tiep `/bai-viet/[id]` se bi tra 404
- Admin se kiem duyet va:
  - **Duyet**: bai chuyen sang PUBLISHED → cong khai voi moi nguoi
  - **Tu choi**: bai bi khoa + hien banner do voi ly do tu choi. Ban co the
    chinh sua (menu "..." → "Sua bai") → bai tu dong quay lai hang cho duyet
- Neu admin chua duyet sau 24 gio, lien he BTV.
- Neu ban sua bai da PUBLISHED (thay doi noi dung), bai tu dong quay lai
  trang thai CHO DUYET de admin duyet lai phan edit.

### Quy dinh dang bai (Phase 2 — quota theo thang)

**Hạn mức bài viết theo trang thai tai khoan:**

| Trạng thái | Hạn mức / tháng |
|------------|----------------|
| Tài khoản cơ bản | 5 bài |
| Hội viên ★ | 15 bài |
| Hội viên ★★ Bạc | 30 bài |
| Hội viên ★★★ Vàng | Không giới hạn |

- Hạn mức **reset vào 0h ngày 1 hằng tháng**
- Bài bị xóa **không** trả lại slot
- Khi tao bai, ban se thay chip "Da dung X/Y bai thang nay" o dau trang
- Het quota → nut "Dang bai" disable, can doi sang thang sau hoac nang cap

### Sidebar quota tren `/feed` (3.4)

Tu phien ban 3.4, sidebar trang `/feed` hien card **"Hạn mức tháng này"** liet ke
3 quota chinh:
- **Bài đăng** — bai feed thang nay (tu `lib/quota.ts`)
- **Sản phẩm** — sp dang trong thang (tu `lib/product-quota.ts`)
- **Banner QC** — banner quang cao dang ky thang nay (tu `lib/bannerQuota.ts`)

**PoC mode** (mac dinh BAT trong giai doan demo): tat ca quota hien dang `Đã đăng X · ∞`
— **không có hạn mức**, ban dang bao nhieu cung duoc. Chi la canh bao thong tin.

**Khi PoC tat** (toan he thong): quota hien thanh **progress bar** voi mau tu dong:
- Xanh la (emerald): < 60% quota
- Vang (amber): 60-79%
- Do (red): ≥ 80% → kem CTA **"Nâng hạng"** dan toi `/gia-han`

> Banner `/banner/dang-ky` cung hien chip `Đã đăng X · ∞` trong PoC mode.

### Phan loai bai viet (Phase 2)
Khi tao bai moi, chon **loai bai**:
- **Bai viet chung** (default): hien thi o /feed
- **Tin doanh nghiep**: tin tuc cua DN — neu ban la Hoi vien, bai co the len section "Tin DN moi nhat" tren trang chu
- **Tin san pham**: gioi thieu / chung nhan SP — neu Hoi vien, bai co the len section "Tin SP moi nhat"

> Bai cua user **chua la Hoi vien** chi hien o /feed, KHONG len trang chu.

### Noi dung khong duoc phep
- Noi dung khong lien quan den nganh tram huong
- Spam, quang cao qua muc
- Thong tin sai lech
- Hinh anh kem chat luong, sai chu de
- Bai vi pham se bi admin khoa o khau kiem duyet (ky hieu banner do + ly do)
  hoac bi khoa sau nay neu nhan 5+ bao cao tu nguoi dung khac

### Tuong tac
- **Huu ich**: Click de danh dau bai co gia tri (tuong tu "Thich")
- **Bao cao**: Neu thay bai vi pham -> menu "..." -> "Bao cao bai viet"

> **Luu y**: So "Huu ich" va luot xem anh huong den thu tu bai tren feed.

---

## 7. Nop don chung nhan san pham (CHI DOANH NGHIEP)

### Dieu kien
- Membership con hieu luc
- Co it nhat 1 san pham (chua co -> tao truoc)
- San pham do chua co don chung nhan dang xu ly

### Quy trinh 3 buoc

**Buoc 1 — Chon san pham:**
- Chon san pham muon chung nhan tu dropdown
- Xem thong tin SP truoc khi tiep tuc
- Chon hinh thuc: Online (gui ho so) hoac Offline (kiem tra thuc te)

**Buoc 2 — Ho so & Ngan hang:**
- Upload tai lieu: giay kiem nghiem, CO/CQ, anh thuc te (PDF, JPG, PNG)
- Ghi chu cho admin (tuy chon)
- Dien TK ngan hang hoan tien (**bat buoc**):
  - Ten ngan hang, so TK, ten chu TK
  - Pre-fill tu ho so neu da dien truoc

**Buoc 3 — Thanh toan:**
- Xem tom tat don: san pham, hinh thuc, TK hoan tien
- Phi xet duyet: 5.000.000 VND
- Thong tin chuyen khoan: ngan hang, so TK, chu TK, noi dung CK
- Noi dung CK format: `HOITRAMHUONG-CERT-[ten viet tat]-[ngay]`
- Click "Copy" de sao chep noi dung CK
- Chuyen khoan xong -> click "Toi da chuyen khoan"

### Theo doi trang thai
- Truy cap: `/chung-nhan/lich-su`
- 6 trang thai:
  - Cho xac nhan CK: Admin chua confirm chuyen khoan
  - Cho xet duyet: Ho so da duoc tiep nhan
  - Dang xet duyet: Admin dang xem xet
  - Da cap chung nhan: Badge da hien tren san pham
  - Tu choi: Kem ly do, admin dang hoan tien
  - Da hoan tien: Phi da duoc hoan lai

---

## 8. Gia han membership

### Khi nao can gia han
- Membership het han -> mat quyen dang bai, nop don chung nhan
- He thong canh bao khi con < 30 ngay

### Quy trinh
1. Truy cap: `/gia-han`
2. Xem trang thai hien tai: hang, ngay het han, tong dong gop
3. Chon muc phi:
   - Muc toi thieu (vd: 5.000.000d): duy tri quyen Hoi vien co ban
   - Muc cao (vd: 10.000.000d): uu tien feed cao hon, thang hang nhanh hon
4. Click "Xem huong dan chuyen khoan"
5. He thong hien: ngan hang, so TK, chu TK, so tien, noi dung CK
6. Copy noi dung CK (format: `HOITRAMHUONG-MEM-[ten]-[ngay]`)
7. Chuyen khoan qua app ngan hang
8. Quay lai -> click "Toi da chuyen khoan"
9. Ghi chu cho admin (tuy chon) -> "Gui xac nhan"
10. Theo doi trang thai tai `/thanh-toan/lich-su`

### Cach tinh hang
- Tong dong gop < 10 trieu: Hoi vien (1 sao)
- Tong dong gop 10-20 trieu: Hoi vien Bac (2 sao)
- Tong dong gop >= 20 trieu: Hoi vien Vang (3 sao)

> **Luu y**: Dong muc cao hon khong chi duy tri quyen Hoi vien ma con tang muc uu tien bai viet tren feed.

---

## 9. Dat dich vu truyen thong

### Cac dich vu
- Bai viet gioi thieu doanh nghiep
- Bai viet gioi thieu san pham
- Thong cao bao chi
- Noi dung mang xa hoi

### Cach dat
1. Truy cap: `/dich-vu`
2. Xem bang gia va quy trinh
3. Dien form dat hang:
   - Thong tin lien he: ten, email, SDT, ten cong ty
   - Yeu cau: loai dich vu, mo ta chi tiet, tu khoa SEO, deadline
4. Click "Gui don hang"
5. Nhan ma tham chieu (vd: MO-20260406-0042)
6. Admin lien he trong 24 gio de xac nhan va bao gia

---

## 10. Cau hoi thuong gap

**Q: Toi quen mat khau, lam sao?**
A: Lien he ban quan tri. Admin se gui email dat lai mat khau voi link co hieu luc 48 gio. Click link de dat mat khau moi va tu dong dang nhap.

**Q: Toi moi dang ky, tai sao van dang bai duoc khong can cho duyet?**
A: Tu Phase 2 (04/2026), he thong khong con flow "cho duyet 3 ngay". Tai khoan kich hoat ngay sau khi dang ky, ban co the post 5 bai/thang voi Tai khoan co ban. Nang cap len Hoi vien de tang quota va co bai len trang chu.

**Q: Lam sao de bai cua toi xuat hien tren trang chu?**
A: Phai dat 2 dieu kien:
1. Tai khoan dang la Hoi vien (da nang cap qua membership fee)
2. Bai dat loai "Tin doanh nghiep" (NEWS) hoac "Tin san pham" (PRODUCT) khi tao
Bai loai "chung" (GENERAL) chi hien o /feed.

**Q: Toi het quota thang nay, lam sao?**
A: Co 2 cach:
1. Doi sang thang sau (quota reset 0h ngay 1)
2. Nang cap Hoi vien de tang quota — Hoi vien★ 15 bai, Hoi vien★★ 30 bai, Hoi vien★★★ khong gioi han
Vao trang `/landing` (Quyen loi hoi vien) de xem chi tiet.

**Q: Toi muon doi email dang nhap?**
A: Email khong the tu doi. Lien he admin de ho tro.

**Q: Phi chung nhan 5 trieu co duoc hoan neu bi tu choi?**
A: Co, admin se hoan tien vao TK ngan hang ban da dien trong ho so. Thoi gian 5-7 ngay lam viec.

**Q: Bai viet cua toi bi khoa, lam sao?**
A: Bai vi pham quy dinh se bi admin khoa. Lien he admin de biet ly do cu the.

**Q: Membership het han nhung toi van dang nhap duoc?**
A: Dung, ban van dang nhap duoc nhung mat quyen dang bai va nop don chung nhan. Can gia han de khoi phuc day du quyen.

**Q: San pham da chung nhan co can gia han khong?**
A: Hien tai chung nhan khong co thoi han. Tuy nhien, hoi co the thay doi chinh sach trong tuong lai.

**Q: Toi muon them nhieu san pham, co gioi han khong?**
A: Khong gioi han so luong san pham. Tuy nhien, moi don chung nhan can dong phi rieng.

**Q: Toi la ca nhan / chuyen gia, toi co the lam gi tren he thong?**
A: Ban co the: dang bai tren feed, xem tai lieu Hoi, gia han membership, dat dich vu truyen thong. Cac tinh nang doanh nghiep (tao SP, chung nhan) chi danh cho tai khoan Doanh nghiep.

**Q: Toi muon chuyen tu tai khoan Ca nhan sang Doanh nghiep?**
A: Lien he ban quan tri. Admin se cap nhat loai tai khoan va tao thong tin doanh nghiep cho ban.

**Q: Tai sao toi khong thay menu "Doanh nghiep" va "Chung nhan SP"?**
A: Cac menu nay chi hien thi cho tai khoan loai Doanh nghiep (va chi khi ban o che do quan tri). Neu ban dang ky voi tu cach Ca nhan / Chuyen gia, ban se khong thay cac menu nay.

---

## 11. Don ket nap Hoi vien chinh thuc

### Tai sao can nop don nay?
Theo **Dieu le Hoi (Chuong II, Dieu 11)**, dang ky tai khoan o `/dang-ky` chi
la tao tai khoan ky thuat. De duoc cong nhan **Hoi vien chinh thuc** — voi quyen
bieu quyet va ung cu trong Hoi — ban can nop don ket nap rieng va duoc
**Ban Thuong vu Hoi** xet duyet.

### 3 hang hoi vien theo Dieu le
| Hang | Mo ta | Quyen |
|------|-------|-------|
| **Chinh thuc** (OFFICIAL) | Hoi vien day du | Bieu quyet, ung cu, bau cu |
| **Lien ket** (AFFILIATE) | DN khong du tieu chuan chinh thuc, DN FDI | Tham gia hoat dong, KHONG bieu quyet |
| **Danh du** (HONORARY) | Ca nhan/to chuc uy tin, co dong gop | Tuong tu Lien ket |

### Cach nop don
1. Dang nhap → click **avatar** (goc phai tren) → dropdown hien **"Don ket nap Hoi vien"**
2. Hoac truy cap truc tiep `/ket-nap`
3. Trang se hien:
   - Hang hien tai cua ban (neu co)
   - Don dang cho xet duyet (neu co)
   - Form nop don moi (neu khong co don pending)

4. Form nop don:
   - **Hang xin ket nap**: Chinh thuc / Lien ket / Danh du (default: Chinh thuc)
   - **Nguoi dai dien tổ chức** (chỉ Doanh nghiep): ho ten + chuc vu — bat buoc theo Dieu 7.2c
   - **Ly do xin gia nhap** (min 20 ky tu): gioi thieu ban than / to chuc, kinh nghiem nganh tram huong, mong muon dong gop

5. Click **"Nop don ket nap"**

### Quy trinh xet duyet
1. Don ban vua nop o trang thai `PENDING` (cho duyet)
2. **Ban Thuong vu Hoi** xet don tai cac cuoc hop hang quy
3. **Chu tich Hoi** quyet dinh cong nhan trong **30 ngay** ke tu ngay nop day du
4. Ban nhan email thong bao ket qua:
   - **Duoc cong nhan** — chuc mung, ban la Hoi vien chinh thuc
   - **Tu choi** — email co ly do cu the → ban co the bo sung ho so va nop lai

### Xem lich su don
Trang `/ket-nap` hien thi lich su 10 don gan nhat cua ban voi status va ly do (neu tu choi).

### Luu y
- Chi co the nop 1 don `PENDING` tai mot thoi diem
- Sau khi bi tu choi, co the bo sung ho so + nop lai (khong bi ban)
- Phi gia nhap (1tr ca nhan / 2tr to chuc) chuyen khoan sau khi duoc duyet

---

## 12. Che do xem Cong khai / Quan tri

### 2 che do xem
He thong co 2 che do hien thi menu khac nhau:

| Che do | Trang | Menu hien thi |
|--------|-------|--------------|
| **Public** (default) | `/`, `/tin-tuc`, `/nghien-cuu`, `/feed`, `/san-pham-doanh-nghiep`, `/landing`... | Trang chu / Tin tuc / Nghien cuu / Doanh nghiep / San pham / Quyen loi |
| **Quan tri** | `/tong-quan`, `/gia-han`, `/ho-so`, `/chung-nhan`, `/doanh-nghiep-cua-toi`, `/tai-lieu` | Tong quan / Bang tin / (Doanh nghiep nếu BUSINESS) / Chung nhan SP / Gia han / Ho so |

### Vao che do quan tri
1. Tu bat ky trang cong khai nao, click **avatar** (goc phai tren)
2. Dropdown hien **"Vao khu vuc quan tri"** → click → navigate `/tong-quan`
3. Navbar tu dong chuyen sang menu quan tri

### Ve trang cong khai
1. Tu bat ky trang quan tri nao, click **avatar** lai
2. Dropdown hien **"Ve trang cong khai"** → click → navigate `/`
3. Navbar tu dong chuyen ve menu cong khai

### Tai sao co 2 che do?
- **Khong gay nham lan** — khi xem trang cong khai, ban thay giong nhu khach vieng tham
- **Truy cap nhanh khu vuc quan tri** — khi can gia han, xem lich su thanh toan, ban chuyen sang che do quan tri ngay
- **Khong bi khoa** — 2 chieu chuyen qua avatar dropdown

---

> **Ho tro**: Lien he ban quan tri qua email hoac Zalo da duoc cung cap khi gia nhap hoi.
