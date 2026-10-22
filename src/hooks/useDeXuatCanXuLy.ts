import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useDeXuatStore } from '@/store/deXuatStore'
import { LOAI_DE_XUAT_DIEU_CHINH } from '@/types/deXuat'
import type { LoaiDeXuat } from '@/types/deXuat'

/**
 * Số phiếu đề xuất đang chờ CHÍNH người dùng này xử lý (số nhỏ trên menu) - cùng quy tắc với nút duyệt ở
 * trang chi tiết phiếu: hiệu trưởng duyệt phiếu của trường, Phòng VHXH thẩm định, lãnh đạo phê duyệt cuối;
 * người lập phiếu (trường) còn phải trình bản nháp của mình và sửa phiếu bị yêu cầu bổ sung.
 * `loais`: các loại phiếu được đếm; mặc định là hai loại của trang Đề xuất điều chỉnh (chuyển ngạch, điều chỉnh).
 */
export function useDeXuatCanXuLy(loais: LoaiDeXuat[] = LOAI_DE_XUAT_DIEU_CHINH): number {
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const { currentUser, scopeDonViId, hasPermission, laQuanTri, isVHXH, isLanhDao, isHieuTruong } = useAuth()

  return useMemo(() => {
    if (!currentUser || !hasPermission('deXuat', 'read')) return 0
    const coQuyenDuyet = hasPermission('deXuat', 'approve')
    const coQuyenLap = hasPermission('deXuat', 'write')
    return deXuats.filter((d) => {
      if (!loais.includes(d.loai)) return false
      switch (d.trangThai) {
        case 'CHO_HIEU_TRUONG_DUYET':
          return laQuanTri || (isHieuTruong && coQuyenDuyet && d.donViId === scopeDonViId)
        case 'CHO_XET_DUYET':
          return laQuanTri || (isVHXH && coQuyenDuyet)
        case 'CHO_PHE_DUYET':
          return laQuanTri || (isLanhDao && coQuyenDuyet)
        case 'NHAP':
          return d.nguoiDeXuatId === currentUser.id
        case 'YEU_CAU_BO_SUNG':
          // Trường lập phiếu sửa lại rồi trình lại (Admin không tính để số trên menu chỉ gồm việc chờ duyệt)
          return !!scopeDonViId && d.donViId === scopeDonViId && (coQuyenLap || isHieuTruong)
        default:
          return false
      }
    }).length
  }, [deXuats, currentUser, scopeDonViId, hasPermission, laQuanTri, isVHXH, isLanhDao, isHieuTruong, loais.join()])
}

/**
 * Tổng số phiếu các trường đang trong quy trình (kế toán đã lập, chưa phê duyệt xong / chưa bị từ chối) - số nhỏ màu xanh
 * trên menu cho Phòng VHXH, Lãnh đạo, quản trị nắm khối lượng, tránh quên. Tài khoản trường trả về 0.
 */
export function useDeXuatDangXuLy(loais: LoaiDeXuat[] = LOAI_DE_XUAT_DIEU_CHINH): number {
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const { currentUser, scopeDonViId, hasPermission } = useAuth()
  return useMemo(() => {
    if (!currentUser || scopeDonViId || !hasPermission('deXuat', 'read')) return 0
    return deXuats.filter((d) => loais.includes(d.loai) && d.trangThai !== 'DA_PHE_DUYET' && d.trangThai !== 'TU_CHOI').length
  }, [deXuats, currentUser, scopeDonViId, hasPermission, loais.join()])
}
