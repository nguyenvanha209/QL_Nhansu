export type LoaiDonVi = 'MAM_NON' | 'TIEU_HOC' | 'THCS' | 'OTHER'

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
  OTHER: 'Khác',
}
