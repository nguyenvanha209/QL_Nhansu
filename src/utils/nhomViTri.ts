import type { CongViecNhanVien, LoaiLaoDong, VienChuc } from '@/types/vienChuc'
import type { NhomChucDanh } from '@/types/danhMuc'

// Chia nhân sự theo 2 chiều tách bạch để theo dõi cơ cấu:
// - Nhóm vị trí: CBQL / Giáo viên / NV chuyên môn – hỗ trợ / NV phục vụ / NV nuôi dưỡng
// - Nhóm loại hình: Biên chế / HĐ NĐ 235 / HĐ trường tự ký / HĐ khác
// Nhân viên không có VTVL riêng cho phục vụ, nuôi dưỡng (để giữ nguyên quy tắc PC thâm niên),
// nên phân nhóm theo ô "Công việc cụ thể".

export type NhomViTri = 'CBQL' | 'GIAO_VIEN' | 'NV_HO_TRO' | 'NV_PHUC_VU' | 'NV_NUOI_DUONG'
export type NhomLoaiHinh = 'BIEN_CHE' | 'HD_235' | 'HD_TRUONG' | 'HD_KHAC'

export const NHOM_VI_TRI: { key: NhomViTri; ten: string; moTa: string; mau: string }[] = [
  { key: 'CBQL', ten: 'Cán bộ quản lý', moTa: 'Hiệu trưởng, Phó hiệu trưởng', mau: '#6366f1' },
  { key: 'GIAO_VIEN', ten: 'Giáo viên', moTa: 'Biên chế và hợp đồng', mau: '#2563eb' },
  { key: 'NV_HO_TRO', ten: 'NV chuyên môn – hỗ trợ', moTa: 'Kế toán, văn thư, thư viện, thiết bị, giáo vụ, y tế, tư vấn', mau: '#0891b2' },
  { key: 'NV_PHUC_VU', ten: 'Nhân viên phục vụ', moTa: 'Bảo vệ, lao công, tạp vụ', mau: '#d97706' },
  { key: 'NV_NUOI_DUONG', ten: 'Nhân viên nuôi dưỡng', moTa: 'Cấp dưỡng, nấu ăn', mau: '#16a34a' },
]

export const NHOM_LOAI_HINH: { key: NhomLoaiHinh; ten: string; tenNgan: string; loai: LoaiLaoDong[] }[] = [
  { key: 'BIEN_CHE', ten: 'Biên chế', tenNgan: 'Biên chế', loai: ['VIEN_CHUC', 'TAP_SU'] },
  { key: 'HD_235', ten: 'HĐ NĐ 235', tenNgan: 'HĐ 235', loai: ['HOP_DONG_235', 'HOP_DONG_111'] },
  { key: 'HD_TRUONG', ten: 'HĐ trường tự ký', tenNgan: 'HĐ trường', loai: ['HOP_DONG_TRUONG'] },
  { key: 'HD_KHAC', ten: 'HĐ khác (XĐT, thỉnh giảng)', tenNgan: 'HĐ khác', loai: ['HOP_DONG_XDT', 'THINH_GIANG', 'KHAC'] },
]

export const CONG_VIEC: { key: CongViecNhanVien; ten: string; nhom: NhomViTri }[] = [
  { key: 'KE_TOAN', ten: 'Kế toán', nhom: 'NV_HO_TRO' },
  { key: 'VAN_THU', ten: 'Văn thư', nhom: 'NV_HO_TRO' },
  { key: 'THU_QUY', ten: 'Thủ quỹ', nhom: 'NV_HO_TRO' },
  { key: 'THU_VIEN', ten: 'Thư viện', nhom: 'NV_HO_TRO' },
  { key: 'THIET_BI', ten: 'Thiết bị, thí nghiệm', nhom: 'NV_HO_TRO' },
  { key: 'GIAO_VU', ten: 'Giáo vụ', nhom: 'NV_HO_TRO' },
  { key: 'Y_TE', ten: 'Y tế trường học', nhom: 'NV_HO_TRO' },
  { key: 'TU_VAN', ten: 'Tư vấn học sinh (tâm lý học đường)', nhom: 'NV_HO_TRO' },
  { key: 'HO_TRO_KT', ten: 'Hỗ trợ giáo dục người khuyết tật', nhom: 'NV_HO_TRO' },
  { key: 'BAO_VE', ten: 'Bảo vệ', nhom: 'NV_PHUC_VU' },
  { key: 'LAO_CONG', ten: 'Lao công, tạp vụ', nhom: 'NV_PHUC_VU' },
  { key: 'NAU_AN', ten: 'Cấp dưỡng, nấu ăn', nhom: 'NV_NUOI_DUONG' },
  { key: 'KHAC', ten: 'Khác', nhom: 'NV_HO_TRO' },
]
export const CONG_VIEC_LABELS = Object.fromEntries(CONG_VIEC.map((c) => [c.key, c.ten])) as Record<CongViecNhanVien, string>
const NHOM_CUA_CONG_VIEC = Object.fromEntries(CONG_VIEC.map((c) => [c.key, c.nhom])) as Record<CongViecNhanVien, NhomViTri>

export function nhomViTri(vc: Pick<VienChuc, 'vtvl' | 'congViec'>, nhomChucDanh?: NhomChucDanh): NhomViTri {
  if (vc.vtvl === 'CBQL' || (!vc.vtvl && nhomChucDanh === 'QUAN_LY')) return 'CBQL'
  if (vc.vtvl === 'GIAO_VIEN' || (!vc.vtvl && nhomChucDanh === 'GIAO_VIEN')) return 'GIAO_VIEN'
  return vc.congViec ? NHOM_CUA_CONG_VIEC[vc.congViec] : 'NV_HO_TRO'
}

export function nhomLoaiHinh(loai: LoaiLaoDong): NhomLoaiHinh {
  return NHOM_LOAI_HINH.find((n) => n.loai.includes(loai))?.key ?? 'HD_KHAC'
}

// Từ khoá nhận diện công việc — xét "Nhiệm vụ chính" trước (việc thực tế), rồi mới đến tên chức danh.
// Thứ tự quan trọng: "Kế toán, tổ trưởng tổ HC" là kế toán; "Văn thư" phải xét trước "thư viện".
const TU_KHOA: [RegExp, CongViecNhanVien][] = [
  [/bảo vệ/, 'BAO_VE'],
  [/lao công|tạp vụ|vệ sinh|phục vụ/, 'LAO_CONG'],
  [/nấu|cấp dưỡng|nuôi dưỡng|bếp/, 'NAU_AN'],
  [/kế toán/, 'KE_TOAN'],
  [/thủ quỹ/, 'THU_QUY'],
  [/văn thư/, 'VAN_THU'],
  [/thư viện/, 'THU_VIEN'],
  [/thiết bị|thí nghiệm/, 'THIET_BI'],
  [/giáo vụ/, 'GIAO_VU'],
  [/y tế/, 'Y_TE'],
  [/tư vấn|tâm lý/, 'TU_VAN'],
  [/khuyết tật/, 'HO_TRO_KT'],
]

/** Đoán công việc cụ thể từ nhiệm vụ chính, rồi tên chức danh. Không chắc thì trả về undefined để trường tự chọn. */
export function doanCongViec(nhiemVuChinh?: string, tenChucDanh?: string): CongViecNhanVien | undefined {
  for (const nguon of [nhiemVuChinh, tenChucDanh]) {
    const t = (nguon ?? '').toLowerCase()
    if (!t) continue
    const trung = TU_KHOA.find(([re]) => re.test(t))
    if (trung) return trung[1]
  }
  return undefined
}
