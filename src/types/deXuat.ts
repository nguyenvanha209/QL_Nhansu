export type TrangThaiDeXuat =
  | 'NHAP'
  | 'CHO_HIEU_TRUONG_DUYET'
  | 'CHO_XET_DUYET'
  | 'CHO_PHE_DUYET'
  | 'DA_PHE_DUYET'
  | 'TU_CHOI'
  | 'YEU_CAU_BO_SUNG'

export type LoaiDeXuat = 'NANG_BAC' | 'NANG_TRUOC_HAN' | 'DIEU_CHINH' | 'CHUYEN_NGACH' | 'PHU_CAP_THAM_NIEN'

// Phiếu đề xuất phụ cấp thâm niên dùng các trường pctn*, phiếu nâng lương dùng bac*/heSo*
export interface ChiTietDeXuat {
  vienChucId: string
  chucDanhCuId: string
  bacCu: number
  heSoCu: number
  chucDanhMoiId: string
  bacMoi: number
  heSoMoi: number
  ngayHieuLuc: string
  lyDo: string
  ghiChu?: string
  // Phụ cấp thâm niên (%): mốc hưởng dùng chung trường ngayHieuLuc
  pctnCu?: number
  pctnMoi?: number
}

export function laDeXuatPhuCapThamNien(loai: LoaiDeXuat): boolean {
  return loai === 'PHU_CAP_THAM_NIEN'
}

export interface DeXuatLuong {
  id: string
  ma: string
  tieuDe: string
  donViId: string
  loai: LoaiDeXuat
  chiTiet: ChiTietDeXuat[]
  trangThai: TrangThaiDeXuat
  buocHienTai: 1 | 2 | 3 | 4

  nguoiDeXuatId: string
  ngayDeXuat: string
  ghiChuDeXuat?: string

  nguoiDuyetHTId?: string
  ngayDuyetHT?: string
  ketQuaDuyetHT?: 'DONG_Y' | 'TU_CHOI' | 'YEU_CAU_BO_SUNG'
  ghiChuDuyetHT?: string

  nguoiXetDuyetId?: string
  ngayXetDuyet?: string
  ketQuaXetDuyet?: 'DONG_Y' | 'TU_CHOI' | 'YEU_CAU_BO_SUNG'
  ghiChuXetDuyet?: string

  nguoiPheDuyetId?: string
  ngayPheDuyet?: string
  ketQuaPheDuyet?: 'PHE_DUYET' | 'TU_CHOI'
  ghiChuPheDuyet?: string

  createdAt: string
  updatedAt: string
}

export const TRANG_THAI_LABELS: Record<TrangThaiDeXuat, string> = {
  NHAP: 'Bản nháp',
  CHO_HIEU_TRUONG_DUYET: 'Chờ Hiệu trưởng duyệt',
  CHO_XET_DUYET: 'Chờ VH-XH thẩm định',
  CHO_PHE_DUYET: 'Chờ lãnh đạo phê duyệt',
  DA_PHE_DUYET: 'Đã phê duyệt',
  TU_CHOI: 'Bị từ chối',
  YEU_CAU_BO_SUNG: 'Yêu cầu bổ sung',
}

export const TRANG_THAI_COLORS: Record<TrangThaiDeXuat, string> = {
  NHAP: 'default',
  CHO_HIEU_TRUONG_DUYET: 'cyan',
  CHO_XET_DUYET: 'processing',
  CHO_PHE_DUYET: 'warning',
  DA_PHE_DUYET: 'success',
  TU_CHOI: 'error',
  YEU_CAU_BO_SUNG: 'orange',
}

export const LOAI_DE_XUAT_LABELS: Record<LoaiDeXuat, string> = {
  NANG_BAC: 'Nâng bậc thường xuyên',
  NANG_TRUOC_HAN: 'Nâng bậc trước hạn',
  DIEU_CHINH: 'Điều chỉnh lương',
  CHUYEN_NGACH: 'Chuyển ngạch/chức danh',
  PHU_CAP_THAM_NIEN: 'Phụ cấp thâm niên',
}
