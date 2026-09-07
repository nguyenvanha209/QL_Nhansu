export type NhomChucDanh = 'GIAO_VIEN' | 'NHAN_VIEN' | 'QUAN_LY'
export type LoaiViTri = 'QUAN_LY' | 'CHUYEN_MON' | 'HO_TRO'
export type CongThucPhuCap = 'PHAN_TRAM_LUONG_CHINH' | 'PHAN_TRAM_LUONG_CO_SO' | 'TIEN_MAT'

export interface ChucDanhNgheNghiep {
  id: string
  ma: string
  ten: string
  maCu?: string
  tenCu?: string
  nhom: NhomChucDanh
  bangLuong: string
  active: boolean
}

export interface ViTriViecLam {
  id: string
  ma: string
  ten: string
  loai: LoaiViTri
  donViId: string
  soLuongBienChe: number
  soLuongHopDong: number
  chucDanhIds: string[]
  active: boolean
}

export interface BacLuong {
  id: string
  chucDanhId: string
  bac: number
  heSo: number
  thoiGianNangLuong: 2 | 3
}

export interface MucLuongCoso {
  id: string
  mucLuong: number
  hieuLucTu: string
  hieuLucDen?: string
  quyetDinhSo?: string
}

export interface LoaiPhuCap {
  id: string
  ma: string
  ten: string
  loaiCongThuc: CongThucPhuCap
  giaTri: number
  moTa?: string
  active: boolean
}

export const NHOM_CHUC_DANH_LABELS: Record<NhomChucDanh, string> = {
  GIAO_VIEN: 'Giáo viên',
  NHAN_VIEN: 'Nhân viên hỗ trợ',
  QUAN_LY: 'Quản lý',
}

export const LOAI_VI_TRI_LABELS: Record<LoaiViTri, string> = {
  QUAN_LY: 'Quản lý',
  CHUYEN_MON: 'Chuyên môn nghiệp vụ',
  HO_TRO: 'Hỗ trợ phục vụ',
}

export const CONG_THUC_LABELS: Record<CongThucPhuCap, string> = {
  PHAN_TRAM_LUONG_CHINH: '% Lương chính',
  PHAN_TRAM_LUONG_CO_SO: '% Lương cơ sở',
  TIEN_MAT: 'Tiền mặt (VNĐ)',
}
