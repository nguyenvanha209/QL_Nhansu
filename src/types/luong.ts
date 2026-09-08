export type LyDoNangLuong = 'TUYEN_DUNG' | 'NANG_BAC' | 'NANG_TRUOC_HAN' | 'DIEU_CHINH' | 'CHUYEN_NGACH'

export interface HeSoLuong {
  id: string
  vienChucId: string
  chucDanhId: string
  bac: number
  heSo: number
  ngayHieuLuc: string
  ngayNangLuongTiepTheo: string
  lyDo: LyDoNangLuong
  quyetDinhSo?: string
  deXuatId?: string
  isActive: boolean
  createdAt: string
  createdBy: string
}

export interface PhuCapVienChuc {
  id: string
  vienChucId: string
  loaiPhuCapId: string
  giaTri: number
  tyLe?: number
  ngayHieuLuc: string
  ngayHetHan?: string
  ghiChu?: string
  isActive: boolean
  createdAt: string
  createdBy: string
}

export interface LichSuBienDong {
  id: string
  vienChucId: string
  loai: 'LUONG' | 'CHUC_DANH' | 'DON_VI' | 'TRANG_THAI' | 'PHU_CAP'
  truongThayDoi: string
  giaTriCu: string
  giaTriMoi: string
  ngayThayDoi: string
  nguoiThayDoiId: string
  deXuatId?: string
}

export interface NhatKyThaoTac {
  id: string
  userId: string
  userFullName: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'LOGIN' | 'APPROVE' | 'REJECT'
  entity: string
  entityId?: string
  moTa: string
  thoiGian: string
}

export const LY_DO_LABELS: Record<LyDoNangLuong, string> = {
  TUYEN_DUNG: 'Khai báo lần đầu / Tuyển dụng',
  NANG_BAC: 'Nâng bậc thường xuyên',
  NANG_TRUOC_HAN: 'Nâng bậc trước hạn',
  DIEU_CHINH: 'Điều chỉnh',
  CHUYEN_NGACH: 'Chuyển ngạch/chức danh',
}
