// Thông báo kết quả nâng lương, phụ cấp thâm niên của UBND phường (Phòng VH-XH tham mưu) - 2 kỳ/năm:
// tháng 6 cho 6 tháng đầu năm, tháng 12 cho 6 tháng cuối năm (Công văn hướng dẫn của Phòng VH-XH).
// Ba loại theo mẫu: (1) nâng bậc lương thường xuyên kèm phụ cấp thâm niên vượt khung,
// (2) phụ cấp thâm niên nhà giáo lần đầu, (3) nâng phụ cấp thâm niên nhà giáo.

export type LoaiThongBaoKQ = 'NANG_LUONG_TX' | 'PCTN_LAN_DAU' | 'PCTN_NANG'
export type KyXet = 'H1' | 'H2'
export type CapHocTB = 'MAM_NON' | 'TIEU_HOC' | 'THCS'

export const LOAI_THONG_BAO_KQ: Record<LoaiThongBaoKQ, { ten: string; tenNgan: string; tieuDeTb: string; tieuDeDs: string }> = {
  NANG_LUONG_TX: {
    ten: 'Nâng bậc lương thường xuyên (kèm PC thâm niên vượt khung)',
    tenNgan: 'Nâng lương thường xuyên',
    tieuDeTb: 'Viên chức đủ điều kiện nâng bậc lương thường xuyên',
    tieuDeDs: 'Nâng bậc lương thường xuyên',
  },
  PCTN_LAN_DAU: {
    ten: 'Hưởng phụ cấp thâm niên nhà giáo lần đầu',
    tenNgan: 'PC thâm niên lần đầu',
    tieuDeTb: 'Về việc thực hiện chế độ phụ cấp thâm niên nhà giáo lần đầu',
    tieuDeDs: 'Hưởng phụ cấp thâm niên nhà giáo lần đầu',
  },
  PCTN_NANG: {
    ten: 'Nâng phụ cấp thâm niên nhà giáo',
    tenNgan: 'Nâng PC thâm niên',
    tieuDeTb: 'Viên chức đủ điều kiện nâng phụ cấp thâm niên nhà giáo',
    tieuDeDs: 'Viên chức đủ điều kiện nâng phụ cấp thâm niên nhà giáo',
  },
}

export const TEN_CAP_TB: Record<CapHocTB, { danhSach: string; cot: string; thuTu: number }> = {
  MAM_NON: { danhSach: 'Các trường mầm non', cot: 'Trường mầm non', thuTu: 1 },
  TIEU_HOC: { danhSach: 'Các trường tiểu học', cot: 'Trường tiểu học', thuTu: 2 },
  THCS: { danhSach: 'Các trường THCS', cot: 'Trường THCS', thuTu: 3 },
}

export const tenKy = (ky: KyXet, nam: number) => `6 tháng ${ky === 'H1' ? 'đầu' : 'cuối'} năm ${nam}`
export const khoangKy = (ky: KyXet, nam: number) => (ky === 'H1'
  ? { tu: `${nam}-01-01`, den: `${nam}-06-30` }
  : { tu: `${nam}-07-01`, den: `${nam}-12-31` })

/** Một dòng trong danh sách kèm thông báo - chụp lại số liệu lúc tổng hợp để thông báo đã ban hành không đổi theo hồ sơ */
export interface DongThongBao {
  /** `${deXuatId}__${vienChucId}` - một người một dòng trong một phiếu */
  key: string
  deXuatId: string
  deXuatMa: string
  /** Trạng thái phiếu lúc tổng hợp: đã phê duyệt hay mới qua thẩm định */
  daPheDuyet: boolean
  vienChucId: string
  donViId: string
  donViTen: string
  /** Tên trường bỏ "Mầm non / Tiểu học / THCS" - VD "Sao Sáng 4" */
  donViNgan: string
  cap: CapHocTB
  hoTen: string
  ngaySinh?: string
  /** Chức vụ hoặc vị trí: Hiệu trưởng, Phó hiệu trưởng, Giáo viên, Kế toán... */
  chucVu: string
  laCBQL: boolean
  nhom: 'CBQL' | 'GIAO_VIEN' | 'NHAN_VIEN'
  chucDanhTen: string
  maChucDanh: string
  ghiChu?: string

  // (1) Nâng lương thường xuyên
  bacCu?: number
  heSoCu?: number
  tnvkCuPct?: number
  mocCu?: string
  baoLuu?: number
  bacMoi?: number
  heSoMoi?: number
  tnvkMoiPct?: number
  mocMoi?: string
  laVuotKhung?: boolean

  // (2), (3) Phụ cấp thâm niên nhà giáo
  pctnCu?: number
  pctnMoi?: number
  ngayTuyenDung?: string
  trinhDo?: string
  ngayTotNghiep?: string
  thangBatDauBhxh?: string
}

export interface ThongBaoKetQua {
  /** `${loai}__${nam}-${ky}` - mỗi loại, mỗi kỳ một thông báo */
  id: string
  loai: LoaiThongBaoKQ
  nam: number
  ky: KyXet
  soThongBao: string
  ngayThongBao: string
  nguoiKy: string
  trangThai: 'NHAP' | 'DA_BAN_HANH'
  dong: DongThongBao[]
  nguoiLapId?: string
  nguoiLap?: string
  banHanhLuc?: string
  nguoiBanHanh?: string
  createdAt: string
  updatedAt: string
}

export const idThongBao = (loai: LoaiThongBaoKQ, nam: number, ky: KyXet) => `${loai}__${nam}-${ky}`
