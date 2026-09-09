import type { VTVL, ChucVu } from './vienChuc'

export type TrangThaiChuyenCongTac =
  | 'NHAP'        // Trường đi đang soạn, chưa trình
  | 'CHO_DUYET'   // Đã trình, chờ Admin duyệt
  | 'DA_DUYET'    // Admin đã duyệt — hồ sơ đã sang trường đến, chờ tiếp nhận phân công
  | 'HOAN_TAT'    // Trường đến đã phân công vị trí và ghi nhận ngày về đơn vị
  | 'TU_CHOI'     // Admin từ chối

export interface DeXuatChuyenCongTac {
  id: string
  ma: string

  vienChucId: string
  /** Lưu lại tên tại thời điểm đề nghị để hiển thị ổn định trong lịch sử */
  hoTenSnapshot: string
  donViDiId: string
  donViDenId: string
  ngayChuyen: string
  lyDo: string
  ghiChu?: string

  trangThai: TrangThaiChuyenCongTac
  nguoiDeXuatId: string
  ngayDeXuat: string

  nguoiDuyetId?: string
  ngayDuyet?: string
  ghiChuDuyet?: string

  // Trường đến điền khi tiếp nhận
  nguoiTiepNhanId?: string
  ngayTiepNhan?: string
  vtvlMoi?: VTVL
  chucVuMoi?: ChucVu
  viTriViecLamMoiId?: string
  ngayVaoDonViMoi?: string

  createdAt: string
  updatedAt: string
}

export const TRANG_THAI_CCT_LABELS: Record<TrangThaiChuyenCongTac, string> = {
  NHAP: 'Bản nháp',
  CHO_DUYET: 'Chờ Quản trị duyệt',
  DA_DUYET: 'Chờ trường đến tiếp nhận',
  HOAN_TAT: 'Đã hoàn tất',
  TU_CHOI: 'Bị từ chối',
}

export const TRANG_THAI_CCT_COLORS: Record<TrangThaiChuyenCongTac, string> = {
  NHAP: 'default',
  CHO_DUYET: 'processing',
  DA_DUYET: 'warning',
  HOAN_TAT: 'success',
  TU_CHOI: 'error',
}
