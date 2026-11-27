import type { DangKyLdtl } from '@/types/dangKyLdtl'

export interface QuyenDangKy {
  scopeDonViId: string | null | undefined
  coLap: boolean
  coThuTruong: boolean
  coThamDinh: boolean
  coPheDuyet: boolean
  trongPhamVi: (donViId: string) => boolean
}

/** Bước 1: cán bộ đơn vị lập, sửa, trình */
export const laNguoiLap = (b: Pick<DangKyLdtl, 'donViId'>, q: QuyenDangKy) => q.coLap && (!q.scopeDonViId || q.scopeDonViId === b.donViId)
/** Bước 2: Thủ trưởng đơn vị duyệt bản của đơn vị mình */
export const laThuTruong = (b: Pick<DangKyLdtl, 'donViId'>, q: QuyenDangKy) => q.coThuTruong && !!q.scopeDonViId && q.scopeDonViId === b.donViId
/** Bước 3: Phòng VHXH thẩm định (khối phụ trách) */
export const laThamDinh = (b: Pick<DangKyLdtl, 'donViId'>, q: QuyenDangKy) => q.coThamDinh && !q.scopeDonViId && q.trongPhamVi(b.donViId)
/** Bước 4: Lãnh đạo Phòng phê duyệt (khối phụ trách) */
export const laPheDuyet = (b: Pick<DangKyLdtl, 'donViId'>, q: QuyenDangKy) => q.coPheDuyet && !q.scopeDonViId && q.trongPhamVi(b.donViId)

/** Bản đang chờ người này xử lý (số trên menu) */
export function choToiXuLy(b: DangKyLdtl, q: QuyenDangKy): boolean {
  switch (b.trangThai) {
    case 'TRA_LAI': return !!q.scopeDonViId && laNguoiLap(b, q)
    case 'CHO_THU_TRUONG': return laThuTruong(b, q)
    case 'CHO_THAM_DINH': return laThamDinh(b, q)
    case 'CHO_PHE_DUYET': return laPheDuyet(b, q)
    default: return false
  }
}
