import type { KhoiDonVi, LoaiDonVi } from '@/types/donVi'
import { khoiCuaLoai } from '@/types/donVi'
import type { ChucDanhNgheNghiep, ChucVuDanhMuc, KhoiApDung, LoaiPhuCap, NhomChucDanh, VtvlDanhMuc } from '@/types/danhMuc'

// ───────────────────────────────────────────────────────────────────────────
// Danh mục theo khối đơn vị
//
// Danh mục của trường (ngạch giáo viên, chức vụ HT/PHT, PC ưu đãi và thâm niên nhà giáo, VTVL trường...)
// không hiện ở phòng chuyên môn và ngược lại. Mục nào quản trị đã chọn khối riêng (thuộc tính `khoi`) thì
// theo đó; còn lại tự suy theo mã. Mục không nhận ra (quản trị tự thêm) áp dụng cho mọi khối.
// Phòng VHXH, lãnh đạo, quản trị xem "Tất cả" thì không lọc gì.
// ───────────────────────────────────────────────────────────────────────────

const MOI_KHOI: KhoiApDung = ['TRUONG_HOC', 'CO_QUAN', 'DVSN']

export const KHOI_THEO_NHOM_CHUC_DANH: Record<NhomChucDanh, KhoiApDung> = {
  GIAO_VIEN: ['TRUONG_HOC'],
  QUAN_LY: ['TRUONG_HOC'],
  NHAN_VIEN: ['TRUONG_HOC', 'DVSN'],
  CONG_CHUC: ['CO_QUAN'],
}

const KHOI_CHUC_VU: Record<string, KhoiApDung> = {
  HT: ['TRUONG_HOC'], 'P.HT': ['TRUONG_HOC'], TTCM: ['TRUONG_HOC'], TPCM: ['TRUONG_HOC'],
  TRP: ['CO_QUAN'], 'P.TRP': ['CO_QUAN'], CVP: ['CO_QUAN'], 'P.CVP': ['CO_QUAN'],
  // Giám đốc: Trung tâm Phục vụ HCC (khối cơ quan) và Ban QLDA, Trạm Y tế, Trung tâm Dịch vụ (ĐVSN)
  GD: ['CO_QUAN', 'DVSN'], 'P.GD': ['CO_QUAN', 'DVSN'],
}

const KHOI_VTVL: Record<string, KhoiApDung> = {
  CBQL: ['TRUONG_HOC'], GIAO_VIEN: ['TRUONG_HOC'], NHAN_VIEN: ['TRUONG_HOC'],
  LANH_DAO_QL: ['CO_QUAN', 'DVSN'], CHUYEN_MON_NV: ['CO_QUAN', 'DVSN'], HO_TRO_PV: ['CO_QUAN', 'DVSN'],
}

/** Phụ cấp riêng nhà giáo (ưu đãi, thâm niên nghề) chỉ ở trường; PC công vụ chỉ ở cơ quan hành chính */
function khoiTheoMaPhuCap(ma: string): KhoiApDung {
  if (ma.startsWith('PCUD_') || ma === 'PC_THAM_NIEN') return ['TRUONG_HOC']
  if (ma === 'PC_CONG_VU') return ['CO_QUAN']
  return MOI_KHOI
}

const coKhoi = (k?: KhoiApDung) => (k && k.length ? k : undefined)

export const khoiChucDanh = (c: Pick<ChucDanhNgheNghiep, 'nhom' | 'khoi'>): KhoiApDung =>
  coKhoi(c.khoi) ?? KHOI_THEO_NHOM_CHUC_DANH[c.nhom] ?? MOI_KHOI
export const khoiChucVu = (c: Pick<ChucVuDanhMuc, 'ma' | 'khoi'>): KhoiApDung =>
  coKhoi(c.khoi) ?? KHOI_CHUC_VU[c.ma] ?? MOI_KHOI
export const khoiVtvl = (v: Pick<VtvlDanhMuc, 'ma' | 'khoi'>): KhoiApDung =>
  coKhoi(v.khoi) ?? KHOI_VTVL[v.ma] ?? MOI_KHOI
export const khoiPhuCap = (p: Pick<LoaiPhuCap, 'ma' | 'khoi'>): KhoiApDung =>
  coKhoi(p.khoi) ?? khoiTheoMaPhuCap(p.ma)

/** Mục có dùng ở khối này không; khối null (xem tất cả) thì luôn có */
export const apDungChoKhoi = (khoiCuaMuc: KhoiApDung, khoi: KhoiDonVi | null | undefined) =>
  !khoi || khoiCuaMuc.includes(khoi)

/** Khối của một đơn vị theo id (null khi không tìm thấy) */
export function khoiCuaDonVi(donVis: { id: string; loai: LoaiDonVi }[], donViId?: string | null): KhoiDonVi | null {
  if (!donViId) return null
  const dv = donVis.find((d) => d.id === donViId)
  return dv ? khoiCuaLoai(dv.loai) : null
}

export const TEN_KHOI_NGAN: Record<KhoiDonVi, string> = { TRUONG_HOC: 'Trường', CO_QUAN: 'Cơ quan', DVSN: 'ĐVSN' }
