export type LoaiLaoDong =
  | 'VIEN_CHUC'
  | 'TAP_SU'
  | 'HOP_DONG_XDT'
  | 'HOP_DONG_111'
  | 'HOP_DONG_235'
  | 'HOP_DONG_TRUONG'
  | 'THINH_GIANG'
  | 'KHAC'

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
  viTriViecLamId?: string
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
