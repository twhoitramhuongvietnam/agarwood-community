/** Industry-specific constants for agarwood/tram huong */

/** Phase 4 follow-up (2026-04-29): default policy text khi tạo SP mới mà
 *  user không nhập. Lưu vào DB tại thời điểm create để tránh fallback runtime. */
export const PRODUCT_DEFAULT_SHIPPING = "Giao hàng toàn quốc"
export const PRODUCT_DEFAULT_RETURN =
  "100% chính hãng · Không áp dụng chính sách bảo hành"

export const PRODUCT_CATEGORIES = [
  "Trầm tự nhiên",
  "Tinh dầu",
  "Nhang trầm",
  "Vòng đeo",
  "Thủ công mỹ nghệ",
  "Trầm nuôi cấy",
  "Khác",
] as const

export const AGARWOOD_REGIONS = [
  "Khánh Hòa",
  "Quảng Nam",
  "Quảng Ngãi",
  "Bình Phước",
  "Hà Tĩnh",
  "Nghệ An",
  "Đắk Lắk",
  "Phú Yên",
  "Bình Định",
  "Gia Lai",
  "Khác",
] as const

export const AGARWOOD_TYPES = [
  "Tự nhiên",
  "Nuôi cấy",
  "Kết hợp",
] as const

/** Canonical keys cho lĩnh vực doanh nghiệp. Lưu vào DB dưới dạng key này;
 *  label hiển thị lookup từ i18n (`companyFields.<key>`) ở client, và từ
 *  COMPANY_FIELD_LABELS_VI ở server (email admin, description). */
export const COMPANY_FIELDS = [
  "natural_agarwood",
  "essential_oil",
  "incense",
  "handicraft",
  "export",
  "processing",
  "cultivation",
  "other",
] as const

export type CompanyFieldKey = (typeof COMPANY_FIELDS)[number]

export const COMPANY_FIELD_LABELS_VI: Record<CompanyFieldKey, string> = {
  natural_agarwood: "Trầm tự nhiên",
  essential_oil: "Tinh dầu",
  incense: "Nhang trầm",
  handicraft: "Thủ công mỹ nghệ",
  export: "Xuất khẩu",
  processing: "Chế biến",
  cultivation: "Trồng & khai thác",
  other: "Khác",
}

export const EMPLOYEE_COUNTS = [
  "1-10",
  "10-50",
  "50-200",
  "200+",
] as const

export const PROVINCES = [
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu",
  "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước",
  "Bình Thuận", "Cà Mau", "Cần Thơ", "Cao Bằng", "Đà Nẵng",
  "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp",
  "Gia Lai", "Hà Giang", "Hà Nam", "Hà Nội", "Hà Tĩnh",
  "Hải Dương", "Hải Phòng", "Hậu Giang", "Hòa Bình", "Hưng Yên",
  "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu", "Lâm Đồng",
  "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An",
  "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình",
  "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng",
  "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa",
  "Thừa Thiên Huế", "Tiền Giang", "TP. Hồ Chí Minh", "Trà Vinh",
  "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái",
] as const
