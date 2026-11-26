import { useMemo } from 'react'
import { useLuongStore } from '@/store/luongStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { duocTinhSoLieu, nhanLuongTheoTien } from '@/types/vienChuc'
import { getDaysUntilReview } from '@/utils/calculations'
import { ngayDenHanNangLuong } from '@/utils/nangLuong'
import { chonBanDangHuong } from '@/utils/phuCapDangHuong'

export interface SalaryAlert {
  vienChucId: string
  hoTen: string
  donViId: string
  donViTen: string
  chucDanhId: string
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
  const bacLuongs = useDanhMucStore((s) => s.bacLuongs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const phuCaps = useLuongStore((s) => s.phuCapVienChucs)

  return useMemo(() => {
    // Người đã hưởng vượt khung: đến hạn mỗi năm (mốc TNVK + 1 năm), không theo chu kỳ bậc
    const loaiTnvk = loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN_VK')
    const denHan = (h: (typeof heSoLuongs)[number]) => ngayDenHanNangLuong(
      h,
      loaiTnvk ? chonBanDangHuong(phuCaps.filter((p) => p.vienChucId === h.vienChucId && p.isActive && p.loaiPhuCapId === loaiTnvk.id)) : undefined,
      bacLuongs,
    )
    const active = heSoLuongs.filter((h) => {
      const vc = vienChucs.find((v) => v.id === h.vienChucId)
      return h.isActive && duocTinhSoLieu(vc) && !nhanLuongTheoTien(vc)
    })
    return active
      .filter((h) => {
        const days = getDaysUntilReview(denHan(h))
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
          chucDanhId: h.chucDanhId,
          chucDanhTen: cd?.ten ?? '',
          ngayNangLuongTiepTheo: denHan(h),
          daysLeft: getDaysUntilReview(denHan(h)),
          heSoHienTai: h.heSo,
          bac: h.bac,
        }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [heSoLuongs, vienChucs, donVis, chucDanhs, donViId, thresholdDays, bacLuongs, loaiPhuCaps, phuCaps])
}
