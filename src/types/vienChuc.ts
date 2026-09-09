export type LoaiLaoDong =
  | 'VIEN_CHUC'
  | 'TAP_SU'
  | 'HOP_DONG_XDT'
  | 'HOP_DONG_111'
  | 'HOP_DONG_235'
  | 'HOP_DONG_TRUONG'
  | 'THINH_GIANG'
  | 'KHAC'

// 4 mã chuẩn dùng để tính phụ cấp chức vụ (TT 33/2005); admin có thể thêm mã khác trong danh mục
export type ChucVu = 'HT' | 'P.HT' | 'TTCM' | 'TPCM' | (string & {})

// 3 nhóm chuẩn; admin có thể thêm nhóm khác trong danh mục
export type VTVL = 'CBQL' | 'GIAO_VIEN' | 'NHAN_VIEN' | (string & {})

export type TrangThaiCongTac = 'DANG_LAM_VIEC' | 'CHUYEN_DEN' | 'CHUYEN_DI' | 'NGHI_HUU' | 'THOI_VIEC'

export type NguonKinhPhi = 'NGAN_SACH' | 'SU_NGHIEP'

export interface VienChuc {
  id: string
  ma: string
  ho: string
  ten: string
  ngaySinh: string
  gioiTinh: 'NAM' | 'NU'
  cccd?: string
  diaChi?: string
  dienThoai?: string
  email?: string
  donViId: string
  loaiLaoDong: LoaiLaoDong
  chucDanhId: string
  chucVu?: ChucVu
  viTriViecLamId?: string
  vtvl?: VTVL
  trangThai?: TrangThaiCongTac
  nguonKinhPhi?: NguonKinhPhi
  trinhDoChuyenMon?: string
  nhiemVuChinh?: string
  trinhDoKhac?: string
  laDangVien?: boolean
  /** Mốc hưởng phụ cấp thâm niên — căn cứ đề xuất nâng 1%/năm ở kỳ sau (chỉ CBQL và giáo viên) */
  mocHuongPctn?: string
  ngayVaoNganh: string
  ngayVaoDonVi: string
  ngayHetTapSu?: string
  ngayVaoBienChe?: string
  thoiHanHopDong?: string
  heSoLuongHienTaiId: string
  active: boolean
  ghiChu?: string
  createdAt: string
  updatedAt: string
}

export const LOAI_LAO_DONG_LABELS: Record<LoaiLaoDong, string> = {
  VIEN_CHUC: 'Viên chức biên chế',
  TAP_SU: 'Viên chức tập sự',
  HOP_DONG_XDT: 'Hợp đồng xác định thời hạn',
  HOP_DONG_111: 'Hợp đồng NĐ 111 (lịch sử)',
  HOP_DONG_235: 'Hợp đồng NĐ 235/2026',
  HOP_DONG_TRUONG: 'Hợp đồng trường tự ký',
  THINH_GIANG: 'Hợp đồng thỉnh giảng',
  KHAC: 'Loại khác',
}

export const CHUC_VU_LABELS: Record<string, string> = {
  HT: 'Hiệu trưởng',
  'P.HT': 'Phó Hiệu trưởng',
  TTCM: 'Tổ trưởng',
  TPCM: 'Tổ phó',
}

export const IS_BIEN_CHE: Record<LoaiLaoDong, boolean> = {
  VIEN_CHUC: true,
  TAP_SU: true,
  HOP_DONG_XDT: true,
  HOP_DONG_111: false,
  HOP_DONG_235: false,
  HOP_DONG_TRUONG: false,
  THINH_GIANG: false,
  KHAC: false,
}

export const VTVL_LABELS: Record<VTVL, string> = {
  CBQL: 'Cán bộ quản lý',
  GIAO_VIEN: 'Giáo viên',
  NHAN_VIEN: 'Nhân viên',
}

export const TRANG_THAI_CONG_TAC_LABELS: Record<TrangThaiCongTac, string> = {
  DANG_LAM_VIEC: 'Đang làm việc',
  CHUYEN_DEN: 'Chuyển đến',
  CHUYEN_DI: 'Chuyển đi',
  NGHI_HUU: 'Nghỉ hưu',
  THOI_VIEC: 'Thôi việc',
}

/**
 * Chỉ cán bộ quản lý và giáo viên được hưởng phụ cấp thâm niên; nhân viên không có.
 * Hồ sơ cũ chưa gán VTVL thì suy từ nhóm ngạch/hạng đang xếp (nếu biết).
 */
export function coPhuCapThamNien(vtvl?: VTVL, nhomChucDanh?: 'GIAO_VIEN' | 'NHAN_VIEN' | 'QUAN_LY'): boolean {
  if (vtvl) return vtvl !== 'NHAN_VIEN'
  return !!nhomChucDanh && nhomChucDanh !== 'NHAN_VIEN'
}

export function isDangCongTac(vc: Pick<VienChuc, 'trangThai'>): boolean {
  return !vc.trangThai || vc.trangThai === 'DANG_LAM_VIEC' || vc.trangThai === 'CHUYEN_DEN'
}

export const NGUON_KINH_PHI_LABELS: Record<NguonKinhPhi, string> = {
  NGAN_SACH: 'Hưởng lương ngân sách',
  SU_NGHIEP: 'Nguồn thu sự nghiệp',
}
