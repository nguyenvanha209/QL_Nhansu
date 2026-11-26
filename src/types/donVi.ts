/**
 * Loại đơn vị. Ba loại đầu là trường học (khối Trường học); PHONG_CM là phòng chuyên môn, Trung tâm Phục vụ hành chính
 * công thuộc UBND phường (khối Cơ quan UBND phường - công chức); DVSN là đơn vị sự nghiệp thuộc UBND phường, không phải trường học.
 * OTHER: loại cũ "Khác", xếp chung khối Trường học như trước.
 */
export type LoaiDonVi = 'MAM_NON' | 'TIEU_HOC' | 'THCS' | 'PHONG_CM' | 'DVSN' | 'OTHER'

/** Khối đơn vị - ô chọn khối ở đầu trang (Phòng VHXH, lãnh đạo) và phân loại hồ sơ, lương */
export type KhoiDonVi = 'TRUONG_HOC' | 'CO_QUAN' | 'DVSN'

export const KHOI_DON_VI: { key: KhoiDonVi; ten: string; tenNgan: string }[] = [
  { key: 'TRUONG_HOC', ten: 'Trường học', tenNgan: 'Trường học' },
  { key: 'CO_QUAN', ten: 'Cơ quan UBND phường', tenNgan: 'Cơ quan UBND' },
  { key: 'DVSN', ten: 'Đơn vị sự nghiệp', tenNgan: 'Đơn vị sự nghiệp' },
]

export function khoiCuaLoai(loai?: LoaiDonVi | string): KhoiDonVi {
  if (loai === 'PHONG_CM') return 'CO_QUAN'
  if (loai === 'DVSN') return 'DVSN'
  return 'TRUONG_HOC'
}

/** Đơn vị là trường học (kể cả loại cũ "Khác") - các chức năng riêng của trường: quy mô, định mức, hạng trường, PC nhà giáo */
export const laTruongHoc = (loai?: LoaiDonVi | string) => khoiCuaLoai(loai) === 'TRUONG_HOC'

export type HangTruong = 1 | 2 | 3

export interface DonVi {
  id: string
  ma: string
  ten: string
  loai: LoaiDonVi
  /**
   * Không dùng nữa: số lớp, hạng trường nay lấy từ quy mô từng năm học (trang Thông tin trường).
   * Giữ lại để đọc dữ liệu cũ, không ghi mới.
   */
  soLop?: number
  /** Thông tin chung - trường tự cập nhật ở trang Thông tin trường */
  diaChi?: string
  soDienThoai?: string
  email?: string
  hieuTruong?: string
  chiTieuBienCheNganSach?: number
  chiTieuBienCheSuNghiep?: number
  chiTieuHopDong?: number
  chiTieuCoNuoi?: number
  active: boolean
  createdAt: string
}

export const LOAI_DON_VI_LABELS: Record<LoaiDonVi, string> = {
  MAM_NON: 'Mầm non',
  TIEU_HOC: 'Tiểu học',
  THCS: 'THCS',
  PHONG_CM: 'Phòng chuyên môn, TT Phục vụ HCC',
  DVSN: 'Đơn vị sự nghiệp',
  OTHER: 'Khác',
}
