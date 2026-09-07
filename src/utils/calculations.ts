import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'

export function getLuongChinh(heSo: number, date?: string): number {
  const mlcs = useDanhMucStore.getState().getActiveMucLuongCoso(date)
  if (!mlcs) return 0
  return Math.round(mlcs.mucLuong * heSo)
}

export function calcPhuCapThamNien(ngayVaoNganh: string, luongChinh: number): number {
  const years = getYearsOfService(ngayVaoNganh)
  if (years < 5) return 0
  const rate = Math.min(0.05 + (years - 5) * 0.01, 0.25)
  return Math.round(luongChinh * rate)
}

export function getYearsOfService(ngayVaoNganh: string): number {
  const start = new Date(ngayVaoNganh)
  const now = new Date()
  return (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
}

export function calcThuNhapThamChieu(
  vienChucId: string,
  ngayVaoNganh: string,
  date?: string
): {
  mucLuongCoso: number
  heSoLuong: number
  luongChinh: number
  phuCapCN: number
  phuCapThamNien: number
  tongPhuCap: number
  tongThuNhap: number
} {
  const hsl = useLuongStore.getState().getActiveHeSo(vienChucId)
  const phuCaps = useLuongStore.getState().getActivePhuCaps(vienChucId)
  const loaiPhuCaps = useDanhMucStore.getState().loaiPhuCaps
  const mlcs = useDanhMucStore.getState().getActiveMucLuongCoso(date)

  const heSo = hsl?.heSo ?? 0
  const mucLuongCoso = mlcs?.mucLuong ?? 2340000
  const luongChinh = Math.round(mucLuongCoso * heSo)

  let phuCapCN = 0
  let tongPhuCap = 0
  let explicitThamNien = 0

  phuCaps.forEach((pc) => {
    const loai = loaiPhuCaps.find((l) => l.id === pc.loaiPhuCapId)
    if (!loai) return
    const rate = pc.giaTri > 0 ? pc.giaTri : loai.giaTri
    let amount = 0
    if (loai.loaiCongThuc === 'PHAN_TRAM_LUONG_CHINH') {
      amount = Math.round(luongChinh * rate / 100)
      phuCapCN += amount
    } else if (loai.loaiCongThuc === 'PHAN_TRAM_LUONG_CO_SO') {
      amount = Math.round(mucLuongCoso * rate / 100)
    } else {
      amount = rate
    }
    tongPhuCap += amount
    if (loai.ma === 'PC_THAM_NIEN') explicitThamNien = amount
  })

  const phuCapThamNien = explicitThamNien > 0
    ? explicitThamNien
    : calcPhuCapThamNien(ngayVaoNganh, luongChinh)

  if (explicitThamNien === 0) tongPhuCap += phuCapThamNien

  return {
    mucLuongCoso,
    heSoLuong: heSo,
    luongChinh,
    phuCapCN,
    phuCapThamNien,
    tongPhuCap,
    tongThuNhap: luongChinh + tongPhuCap,
  }
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

export function getDaysUntilReview(ngayNangLuongTiepTheo: string): number {
  const d = new Date(ngayNangLuongTiepTheo)
  const now = new Date()
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getReviewUrgencyColor(days: number): string {
  if (days < 0) return 'red'
  if (days <= 30) return 'red'
  if (days <= 90) return 'orange'
  if (days <= 180) return 'gold'
  return 'green'
}
