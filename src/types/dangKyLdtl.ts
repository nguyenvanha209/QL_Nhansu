// Đăng ký lao động tiền lương theo kỳ 6 tháng: đơn vị lập danh sách hệ số lương, phụ cấp của người đang hưởng lương
// (biên chế, hợp đồng) và biểu tổng hợp so với kỳ trước. Bốn bước như phiếu nâng lương: cán bộ đơn vị lập, trình → Thủ trưởng
// đơn vị duyệt → Cán bộ Phòng VHXH thẩm định → Lãnh đạo Phòng VHXH phê duyệt (xác nhận của UBND phường, TUQ. Chủ tịch).
// Mẫu: "ĐĂNG KÝ LAO ĐỘNG TIỀN LƯƠNG 6 THÁNG ..." (trang TH) và "DANH SÁCH ĐĂNG KÝ LAO ĐỘNG TIỀN LƯƠNG ..." (trang DS HSL).

import type { KyTruyLinh } from './truyLinh'

export type KyDangKy = KyTruyLinh
export type TrangThaiDangKy = 'NHAP' | 'CHO_THU_TRUONG' | 'CHO_THAM_DINH' | 'CHO_PHE_DUYET' | 'DA_DUYET' | 'TRA_LAI'

export const TEN_KY_DANG_KY: Record<KyDangKy, string> = { H1: '6 tháng đầu năm', H2: '6 tháng cuối năm' }

export const TRANG_THAI_DANG_KY: Record<TrangThaiDangKy, { ten: string; mau: string }> = {
  NHAP: { ten: 'Bản nháp', mau: 'default' },
  CHO_THU_TRUONG: { ten: 'Chờ Thủ trưởng đơn vị duyệt', mau: 'processing' },
  CHO_THAM_DINH: { ten: 'Chờ Phòng VHXH thẩm định', mau: 'processing' },
  CHO_PHE_DUYET: { ten: 'Chờ Lãnh đạo Phòng phê duyệt', mau: 'purple' },
  DA_DUYET: { ten: 'Đã phê duyệt', mau: 'success' },
  TRA_LAI: { ten: 'Trả lại để sửa', mau: 'error' },
}

/** Một người trong danh sách đăng ký - ảnh chụp hồ sơ lương lúc lập (cập nhật lại được khi còn sửa) */
export interface DongDangKy {
  vienChucId: string
  hoTen: string
  ngaySinh?: string
  gioiTinh?: 'NAM' | 'NU'
  chucVu: string
  trinhDo?: string
  /** Biên chế (công chức, viên chức, kể cả HĐ xác định thời hạn) - còn lại là hợp đồng */
  bienChe: boolean
  maCdnn: string
  bac: number | null
  heSo: number
  /** % PC thâm niên vượt khung */
  vkPct: number
  vkHs: number
  /** Hệ số chênh lệch bảo lưu */
  baoLuu: number
  /** Thời điểm tính nâng bậc lương hoặc PC TNVK (dd/mm/yyyy) */
  thoiDiem: string
  pcChucVu: number
  pcTrachNhiem: number
  tnnPct: number
  tnnHs: number
  /** Mốc xét nâng PC thâm niên nhà giáo (dd/mm/yyyy) */
  mocTnn: string
  udHs: number
  pcCongVu: number
  /** Hợp đồng nhận lương theo mức tiền (đ/tháng) */
  mucLuongTien: number
  ghiChu?: string
}

/** Các chỉ tiêu ở biểu tổng hợp (hệ số tính cho cả 6 tháng; tiền mặt tính đồng cả 6 tháng) */
export interface ChiTieuDangKy {
  bienChe: number
  luongChinh: number
  pcChucVu: number
  pcTrachNhiem: number
  pcUuDai: number
  pcThamNien: number
  pcTnvk: number
  pcBaoLuu: number
  pcCongVu: number
  hdSoNguoi: number
  hdHeSo: number
  hdTien: number
}

export const CHI_TIEU_RONG: ChiTieuDangKy = {
  bienChe: 0, luongChinh: 0, pcChucVu: 0, pcTrachNhiem: 0, pcUuDai: 0, pcThamNien: 0, pcTnvk: 0, pcBaoLuu: 0, pcCongVu: 0,
  hdSoNguoi: 0, hdHeSo: 0, hdTien: 0,
}

export interface LichSuDangKy {
  luc: string
  nguoi: string
  hanhDong: 'LAP' | 'TRINH' | 'THU_TRUONG_DUYET' | 'THAM_DINH' | 'DUYET' | 'TRA_LAI' | 'MO_LAI'
  ghiChu?: string
}

export interface DangKyLdtl {
  /** `${donViId}__${nam}-${ky}` - mỗi đơn vị, mỗi kỳ một bản */
  id: string
  donViId: string
  nam: number
  ky: KyDangKy
  trangThai: TrangThaiDangKy
  dong: DongDangKy[]
  /** Kế hoạch được duyệt kỳ trước - lấy từ bản đăng ký kỳ trước đã duyệt, sửa tay được */
  keHoach: Partial<ChiTieuDangKy>
  /** Số thực hiện kỳ trước - bỏ trống thì bằng số đăng ký kỳ này (người, hệ số hiện hưởng) */
  thucHien: Partial<ChiTieuDangKy>
  nguoiLapId?: string
  nguoiLap?: string
  ngayTrinh?: string
  /** Thủ trưởng đơn vị duyệt (bước 2) */
  nguoiThuTruongDuyet?: string
  ngayThuTruongDuyet?: string
  /** Phòng VHXH thẩm định (bước 3) */
  nguoiThamDinh?: string
  ngayThamDinh?: string
  yKienThamDinh?: string
  /** Lãnh đạo Phòng phê duyệt (bước 4) - tên Trưởng phòng ký xác nhận */
  nguoiDuyet?: string
  ngayDuyet?: string
  /** Ý kiến khi trả lại / phê duyệt */
  yKienDuyet?: string
  lichSu: LichSuDangKy[]
  createdAt: string
  updatedAt: string
}

export const idDangKy = (donViId: string, nam: number, ky: KyDangKy) => `${donViId}__${nam}-${ky}`
export const kyTruoc = (nam: number, ky: KyDangKy): { nam: number; ky: KyDangKy } => (ky === 'H1' ? { nam: nam - 1, ky: 'H2' } : { nam, ky: 'H1' })
export const khoangKyDangKy = (nam: number, ky: KyDangKy) =>
  (ky === 'H1' ? { tu: `${nam}-01-01`, den: `${nam}-06-30` } : { tu: `${nam}-07-01`, den: `${nam}-12-31` })
