import { useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useKhoiStore } from '@/store/khoiStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { khoiCuaLoai } from '@/types/donVi'
import type { DonVi, KhoiDonVi } from '@/types/donVi'

/**
 * Phạm vi dữ liệu đang xem:
 * - Tài khoản đơn vị (thủ trưởng, cán bộ đơn vị): chỉ đơn vị mình; khối = khối của đơn vị mình.
 * - Tài khoản toàn phường: theo ô chọn khối ở đầu trang (null = tất cả).
 * `khoi` dùng để lọc danh mục (chức danh, chức vụ, VTVL, phụ cấp) và danh sách đơn vị; `trongPhamVi` lọc hồ sơ, phiếu.
 */
export function usePhamVi() {
  const { scopeDonViId } = useAuth()
  const khoiChon = useKhoiStore((s) => s.khoi)
  const donVis = useDanhMucStore((s) => s.donVis)

  const khoiTheoId = useMemo(() => new Map(donVis.map((d) => [d.id, khoiCuaLoai(d.loai)])), [donVis])
  const khoi: KhoiDonVi | null = scopeDonViId ? (khoiTheoId.get(scopeDonViId) ?? 'TRUONG_HOC') : khoiChon

  const trongPhamVi = useCallback(
    (donViId?: string | null) => {
      if (scopeDonViId) return donViId === scopeDonViId
      if (!khoi) return true
      return !!donViId && khoiTheoId.get(donViId) === khoi
    },
    [scopeDonViId, khoi, khoiTheoId],
  )

  /** Đơn vị trong phạm vi (còn hoạt động) */
  const donVisPhamVi = useMemo<DonVi[]>(
    () => donVis.filter((d) => d.active && trongPhamVi(d.id)),
    [donVis, trongPhamVi],
  )

  return { scopeDonViId, khoi, trongPhamVi, donVisPhamVi, laTruongHocKhoi: !khoi || khoi === 'TRUONG_HOC' }
}
