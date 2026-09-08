import type { NhomChucDanh } from '@/types/danhMuc'
import type { VTVL } from '@/types/vienChuc'

/**
 * Ràng buộc giữa Vị trí việc làm (VTVL) và Mã ngạch/Hạng (chức danh nghề nghiệp).
 *
 * - Nhân viên chỉ được xếp ngạch nhóm nhân viên (kế toán, văn thư, y tế, thư viện, thiết bị...)
 * - Giáo viên chỉ được xếp ngạch giáo viên (V.07.xx)
 * - Cán bộ quản lý (hiệu trưởng, phó hiệu trưởng) vẫn giữ ngạch giáo viên, ngoài ra
 *   chấp nhận cả ngạch nhóm quản lý nếu danh mục có bổ sung
 * - VTVL do admin tự thêm (mã ngoài 3 mã chuẩn): không ràng buộc, tránh chặn nhầm
 */
export function nhomChucDanhChoPhep(vtvl?: VTVL): NhomChucDanh[] | null {
  if (!vtvl) return null
  switch (vtvl) {
    case 'NHAN_VIEN':
      return ['NHAN_VIEN']
    case 'GIAO_VIEN':
      return ['GIAO_VIEN']
    case 'CBQL':
      return ['GIAO_VIEN', 'QUAN_LY']
    default:
      return null
  }
}

/** Ngạch/hạng thuộc nhóm này có hợp lệ với VTVL đang chọn không */
export function chucDanhHopLeVoiVtvl(nhom: NhomChucDanh | undefined, vtvl?: VTVL): boolean {
  const choPhep = nhomChucDanhChoPhep(vtvl)
  if (!choPhep) return true
  return !!nhom && choPhep.includes(nhom)
}
