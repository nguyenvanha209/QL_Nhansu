import type { LoaiPhuCap } from '@/types/danhMuc'

// Thứ tự hiển thị danh mục phụ cấp — theo đúng thứ tự cột của Bảng tổng hợp lương:
// vượt khung → chức vụ → trách nhiệm → thâm niên nghề → chênh lệch bảo lưu → ưu đãi nhà giáo
// (theo cấp học: MN/TH 45 → THCS 40 → nhân viên 20; mức cũ QĐ 244/2005 xếp cuối). Loại tự thêm xếp sau cùng theo tên.
const THU_TU_MA = [
  'PC_THAM_NIEN_VK',
  'PC_CHUC_VU',
  'PC_TRACH_NHIEM',
  'PC_THAM_NIEN',
  'PC_BAO_LUU',
  'PCUD_45',
  'PCUD_40',
  'PCUD_20',
  'PCUD_35',
  'PCUD_30',
]

/** Mức ưu đãi cũ theo QĐ 244/2005, đã được NĐ 182/2026 thay thế từ 01/01/2026 */
export const PCUD_MUC_CU = new Set(['PCUD_35', 'PCUD_30'])

export function sapXepLoaiPhuCap<T extends Pick<LoaiPhuCap, 'ma' | 'ten'>>(list: T[]): T[] {
  const viTri = (ma: string) => {
    const i = THU_TU_MA.indexOf(ma)
    return i < 0 ? THU_TU_MA.length : i
  }
  return [...list].sort((a, b) => viTri(a.ma) - viTri(b.ma) || a.ten.localeCompare(b.ten, 'vi'))
}
