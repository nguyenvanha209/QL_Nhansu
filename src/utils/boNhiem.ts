import dayjs from 'dayjs'
import type { BoNhiem, VienChuc } from '@/types/vienChuc'
import { isDangCongTac } from '@/types/vienChuc'
import { calcRetirementDate } from './retirement'

/** Chức vụ do UBND phường bổ nhiệm theo nhiệm kỳ - phạm vi theo dõi */
export const CHUC_VU_BO_NHIEM = ['HT', 'P.HT']
export const NHIEM_KY_NAM = 5
/** Mốc nhắc: bắt đầu chuẩn bị hồ sơ */
export const MOC_CHUAN_BI_THANG = 6
/** Mốc nhắc: hạn hoàn thành quy trình bổ nhiệm lại (chậm nhất 90 ngày trước khi hết thời hạn) */
export const MOC_DEN_HAN_NGAY = 90
/** Còn dưới 2 năm đến tuổi nghỉ hưu tại ngày hết nhiệm kỳ → xem xét kéo dài thay vì bổ nhiệm lại */
export const NAM_XET_KEO_DAI = 2

export const laChucVuBoNhiem = (chucVu?: string) => !!chucVu && CHUC_VU_BO_NHIEM.includes(chucVu)

/** Nhiệm kỳ 5 năm: từ 01/09/2021 đến hết 31/08/2026 */
export function ngayHetNhiemKyMacDinh(ngayBatDau: string): string {
  return dayjs(ngayBatDau).add(NHIEM_KY_NAM, 'year').subtract(1, 'day').format('YYYY-MM-DD')
}

export function ngayNghiHuu(vc: Pick<VienChuc, 'ngaySinh' | 'gioiTinh'>): string | undefined {
  if (!vc.ngaySinh) return undefined
  return dayjs(calcRetirementDate(vc.ngaySinh, vc.gioiTinh)).format('YYYY-MM-DD')
}

/** Lần bổ nhiệm đang có hiệu lực: bản bắt đầu muộn nhất */
export function nhiemKyHienTai(vc: Pick<VienChuc, 'boNhiems'>): BoNhiem | undefined {
  return [...(vc.boNhiems ?? [])].sort((a, b) => b.ngayBatDau.localeCompare(a.ngayBatDau))[0]
}

export type MucNhacBoNhiem = 'QUA_HAN' | 'DEN_HAN' | 'CHUAN_BI' | 'CON_HAN' | 'NGHI_HUU_TRUOC' | 'CHUA_NHAP'

export const MUC_NHAC_BO_NHIEM: Record<MucNhacBoNhiem, { ten: string; mau: string; nen?: boolean; moTa: string }> = {
  QUA_HAN: { ten: 'Quá hạn', mau: '#a8071a', nen: true, moTa: 'Đã hết nhiệm kỳ, chưa nhập quyết định mới' },
  DEN_HAN: { ten: `Còn dưới ${MOC_DEN_HAN_NGAY} ngày`, mau: '#cf1322', nen: true, moTa: 'Đến hạn phải hoàn thành quy trình bổ nhiệm lại' },
  CHUAN_BI: { ten: `Còn dưới ${MOC_CHUAN_BI_THANG} tháng`, mau: '#d48806', nen: true, moTa: 'Bắt đầu chuẩn bị hồ sơ bổ nhiệm lại' },
  CON_HAN: { ten: 'Còn hạn', mau: 'green', moTa: 'Nhiệm kỳ còn trên 6 tháng' },
  NGHI_HUU_TRUOC: { ten: 'Nghỉ hưu trước khi hết nhiệm kỳ', mau: 'purple', moTa: 'Đến tuổi nghỉ hưu trước ngày hết nhiệm kỳ - không phải bổ nhiệm lại' },
  CHUA_NHAP: { ten: 'Chưa nhập QĐ', mau: 'default', moTa: 'Chưa có dữ liệu bổ nhiệm - trường cần bổ sung' },
}

/** Các mức cần nhắc việc (đếm ở chuông, Tổng quan) */
export const MUC_CAN_NHAC: MucNhacBoNhiem[] = ['QUA_HAN', 'DEN_HAN', 'CHUAN_BI']

export interface TinhTrangBoNhiem {
  vc: VienChuc
  bn?: BoNhiem
  muc: MucNhacBoNhiem
  /** Số ngày còn lại đến hết nhiệm kỳ (âm = đã quá) */
  soNgayCon?: number
  ngayNghiHuu?: string
  /** Còn dưới 2 năm đến tuổi nghỉ hưu tại ngày hết nhiệm kỳ */
  xemXetKeoDai: boolean
}

export function tinhTrangBoNhiem(vc: VienChuc, homNay = dayjs().startOf('day')): TinhTrangBoNhiem {
  const bn = nhiemKyHienTai(vc)
  const nghiHuu = ngayNghiHuu(vc)
  if (!bn?.ngayHetNhiemKy) return { vc, bn, muc: 'CHUA_NHAP', ngayNghiHuu: nghiHuu, xemXetKeoDai: false }
  const het = dayjs(bn.ngayHetNhiemKy)
  const soNgayCon = het.diff(homNay, 'day')
  if (nghiHuu && nghiHuu <= bn.ngayHetNhiemKy) {
    return { vc, bn, muc: 'NGHI_HUU_TRUOC', soNgayCon, ngayNghiHuu: nghiHuu, xemXetKeoDai: false }
  }
  const xemXetKeoDai = !!nghiHuu && het.add(NAM_XET_KEO_DAI, 'year').format('YYYY-MM-DD') > nghiHuu
  const muc: MucNhacBoNhiem = soNgayCon < 0 ? 'QUA_HAN'
    : soNgayCon <= MOC_DEN_HAN_NGAY ? 'DEN_HAN'
    : !het.subtract(MOC_CHUAN_BI_THANG, 'month').isAfter(homNay) ? 'CHUAN_BI'
    : 'CON_HAN'
  return { vc, bn, muc, soNgayCon, ngayNghiHuu: nghiHuu, xemXetKeoDai }
}

/** HT/P.HT đang công tác trong phạm vi, kèm tình trạng nhiệm kỳ, sắp theo ngày hết nhiệm kỳ */
export function danhSachBoNhiem(vienChucs: VienChuc[], scopeDonViId?: string | null): TinhTrangBoNhiem[] {
  return vienChucs
    .filter((v) => v.active && isDangCongTac(v) && laChucVuBoNhiem(v.chucVu) && (!scopeDonViId || v.donViId === scopeDonViId))
    .map((v) => tinhTrangBoNhiem(v))
    .sort((a, b) => (a.bn?.ngayHetNhiemKy ?? '9999').localeCompare(b.bn?.ngayHetNhiemKy ?? '9999'))
}

/** "còn 85 ngày" / "quá 12 ngày" */
export function moTaConLai(soNgayCon?: number): string {
  if (soNgayCon == null) return ''
  if (soNgayCon < 0) return `quá ${-soNgayCon} ngày`
  if (soNgayCon <= 120) return `còn ${soNgayCon} ngày`
  return `còn ${Math.floor(soNgayCon / 30.44)} tháng`
}
