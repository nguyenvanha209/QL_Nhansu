// Bảng truy lĩnh theo kỳ 6 tháng: trường lập từ các phiếu nâng lương thường xuyên (kể cả vượt khung, trước hạn)
// và nâng phụ cấp thâm niên nhà giáo đã được phê duyệt, trình Trưởng phòng VHXH duyệt (xác nhận của UBND phường).
// Mẫu: "Danh sách truy lĩnh nâng lương 6 tháng ..." và "Danh sách truy lĩnh nâng phụ cấp thâm niên nhà giáo" (Mẫu 1b-PCTNNG).

export type KyTruyLinh = 'H1' | 'H2'
export type TrangThaiTruyLinh = 'NHAP' | 'CHO_DUYET' | 'DA_DUYET' | 'TRA_LAI'

export const TEN_KY_TRUY_LINH: Record<KyTruyLinh, string> = { H1: '6 tháng đầu năm', H2: '6 tháng cuối năm' }

export const TRANG_THAI_TRUY_LINH: Record<TrangThaiTruyLinh, { ten: string; mau: string }> = {
  NHAP: { ten: 'Bản nháp', mau: 'default' },
  CHO_DUYET: { ten: 'Chờ Trưởng phòng duyệt', mau: 'processing' },
  DA_DUYET: { ten: 'Đã duyệt', mau: 'success' },
  TRA_LAI: { ten: 'Trả lại để sửa', mau: 'error' },
}

/** Các khoản lương một thời điểm - phần hệ số (PC TNVK, PC TNN, ưu đãi, tổng) tính từ các khoản này */
export interface ThanhPhanLuong {
  maNgach: string
  bac: number | null
  heSo: number
  pcChucVu: number
  pcTrachNhiem: number
  /** % PC thâm niên vượt khung */
  vkPct: number
  /** % PC thâm niên nhà giáo */
  tnnPct: number
  /** % PC ưu đãi nhà giáo */
  udPct: number
  baoLuu: number
}

/** Một người trong danh sách truy lĩnh nâng lương (nâng bậc thường xuyên, vượt khung, trước hạn) */
export interface DongTruyLinhLuong {
  vienChucId: string
  hoTen: string
  deXuatId: string
  deXuatMa: string
  loai: 'NANG_BAC' | 'VUOT_KHUNG' | 'TRUOC_HAN'
  cu: ThanhPhanLuong
  moi: ThanhPhanLuong
  /** Thời gian hưởng mức mới (yyyy-mm-dd) */
  thoiGianHuong: string
  /** Mốc xét nâng lương lần sau */
  mocLanSau?: string
  soThang: number
  ghiChu?: string
}

/** Một người trong danh sách truy lĩnh nâng phụ cấp thâm niên nhà giáo */
export interface DongTruyLinhPctn {
  vienChucId: string
  hoTen: string
  ngaySinh?: string
  gioiTinh?: 'NAM' | 'NU'
  /** Tổng thời gian thực tế giảng dạy có BHXH đến ngày tính, dạng "24n1th" (sửa tay được) */
  thamNien?: string
  deXuatId: string
  deXuatMa: string
  maNgach: string
  cu: Pick<ThanhPhanLuong, 'bac' | 'heSo' | 'vkPct' | 'pcChucVu' | 'tnnPct'>
  moi: Pick<ThanhPhanLuong, 'bac' | 'heSo' | 'vkPct' | 'pcChucVu' | 'tnnPct'>
  /** Mốc tính hưởng PCTN đang hưởng (trước khi nâng) */
  mocCu?: string
  thoiGianHuong: string
  mocLanSau?: string
  soThang: number
  ghiChu?: string
}

export interface LichSuTruyLinh {
  luc: string
  nguoi: string
  hanhDong: 'LAP' | 'TRINH' | 'DUYET' | 'TRA_LAI' | 'MO_LAI'
  ghiChu?: string
}

export interface BangTruyLinh {
  /** `${donViId}__${nam}-${ky}` - mỗi đơn vị, mỗi kỳ một bảng */
  id: string
  donViId: string
  nam: number
  ky: KyTruyLinh
  /** Truy lĩnh tính đến ngày (mặc định ngày cuối kỳ) */
  tinhDen: string
  trangThai: TrangThaiTruyLinh
  luong: DongTruyLinhLuong[]
  pctn: DongTruyLinhPctn[]
  nguoiLapId?: string
  nguoiLap?: string
  ngayTrinh?: string
  nguoiDuyetId?: string
  nguoiDuyet?: string
  ngayDuyet?: string
  yKienDuyet?: string
  lichSu: LichSuTruyLinh[]
  createdAt: string
  updatedAt: string
}

export const idBangTruyLinh = (donViId: string, nam: number, ky: KyTruyLinh) => `${donViId}__${nam}-${ky}`
export const khoangKy = (nam: number, ky: KyTruyLinh) =>
  (ky === 'H1' ? { tu: `${nam}-01-01`, den: `${nam}-06-30` } : { tu: `${nam}-07-01`, den: `${nam}-12-31` })
