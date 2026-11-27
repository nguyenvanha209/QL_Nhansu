import { useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useKhoiStore } from '@/store/khoiStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { khoiCuaLoai } from '@/types/donVi'
import type { DonVi, KhoiDonVi } from '@/types/donVi'

/**
 * Phạm vi dữ liệu đang xem:
 * - Tài khoản đơn vị (thủ trưởng, cán bộ đơn vị): chỉ đơn vị mình; khối = khối của đơn vị mình.
 * - Tài khoản toàn phường: theo ô chọn khối ở đầu trang (null = tất cả các khối được giao).
 * - Tài khoản được giao khối (khoiPhuTrach): chỉ các khối đó; giao một khối thì luôn là khối đó.
 * `khoi` dùng để lọc danh mục (chức danh, chức vụ, VTVL, phụ cấp) và danh sách đơn vị; `trongPhamVi` lọc hồ sơ, phiếu.
 */
export function usePhamVi() {
  const { scopeDonViId, khoiPhuTrach } = useAuth()
  const khoiChon = useKhoiStore((s) => s.khoi)
  const donVis = useDanhMucStore((s) => s.donVis)
  const khoiGiao = khoiPhuTrach.join(',')

  const khoiTheoId = useMemo(() => new Map(donVis.map((d) => [d.id, khoiCuaLoai(d.loai)])), [donVis])
  // Ô chọn khối chỉ có hiệu lực trong các khối được giao; giao đúng một khối thì cố định khối đó
  const khoiDuocChon = khoiPhuTrach.length === 1 ? khoiPhuTrach[0]
    : khoiChon && (!khoiPhuTrach.length || khoiPhuTrach.includes(khoiChon)) ? khoiChon : null
  const khoi: KhoiDonVi | null = scopeDonViId ? (khoiTheoId.get(scopeDonViId) ?? 'TRUONG_HOC') : khoiDuocChon

  const trongPhamVi = useCallback(
    (donViId?: string | null) => {
      if (scopeDonViId) return donViId === scopeDonViId
      const k = donViId ? khoiTheoId.get(donViId) : undefined
      if (khoi) return k === khoi
      if (khoiGiao) return !!k && khoiGiao.split(',').includes(k)
      return true
    },
    [scopeDonViId, khoi, khoiTheoId, khoiGiao],
  )

  /** Đơn vị trong phạm vi (còn hoạt động) */
  const donVisPhamVi = useMemo<DonVi[]>(
    () => donVis.filter((d) => d.active && trongPhamVi(d.id)),
    [donVis, trongPhamVi],
  )

  /** Các khối được chọn ở ô đầu trang (rỗng = không giới hạn) */
  const cacKhoiDuocXem: KhoiDonVi[] = khoiPhuTrach

  return {
    scopeDonViId, khoi, trongPhamVi, donVisPhamVi, cacKhoiDuocXem,
    laTruongHocKhoi: khoi ? khoi === 'TRUONG_HOC' : (!khoiPhuTrach.length || khoiPhuTrach.includes('TRUONG_HOC')),
  }
}
