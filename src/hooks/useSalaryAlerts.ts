import { useMemo } from 'react'
import { useLuongStore } from '@/store/luongStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { getDaysUntilReview } from '@/utils/calculations'

export interface SalaryAlert {
  vienChucId: string
  hoTen: string
  donViId: string
  donViTen: string
  chucDanhTen: string
  ngayNangLuongTiepTheo: string
  daysLeft: number
  heSoHienTai: number
  bac: number
}

export function useSalaryAlerts(donViId?: string | null, thresholdDays = 90): SalaryAlert[] {
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const donVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)

  return useMemo(() => {
    const active = heSoLuongs.filter((h) => h.isActive)
    return active
      .filter((h) => {
        const days = getDaysUntilReview(h.ngayNangLuongTiepTheo)
        return days <= thresholdDays
      })
      .filter((h) => {
        if (!donViId) return true
        const vc = vienChucs.find((v) => v.id === h.vienChucId)
        return vc?.donViId === donViId
      })
      .map((h) => {
        const vc = vienChucs.find((v) => v.id === h.vienChucId)
        const donVi = donVis.find((d) => d.id === vc?.donViId)
        const cd = chucDanhs.find((c) => c.id === h.chucDanhId)
        return {
          vienChucId: h.vienChucId,
          hoTen: vc ? `${vc.ho} ${vc.ten}` : 'Không rõ',
          donViId: vc?.donViId ?? '',
          donViTen: donVi?.ten ?? '',
          chucDanhTen: cd?.ten ?? '',
          ngayNangLuongTiepTheo: h.ngayNangLuongTiepTheo,
          daysLeft: getDaysUntilReview(h.ngayNangLuongTiepTheo),
          heSoHienTai: h.heSo,
          bac: h.bac,
        }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [heSoLuongs, vienChucs, donVis, chucDanhs, donViId, thresholdDays])
}
