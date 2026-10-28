import dayjs from 'dayjs'
import type { VienChuc } from '@/types/vienChuc'
import { isDangCongTac } from '@/types/vienChuc'
import { calcRetirementDate } from './retirement'

// Định kỳ chuyển đổi vị trí công tác đối với kế toán các trường (phòng ngừa tham nhũng).
// Căn cứ do người dùng cung cấp: Điều 24 Luật Phòng, chống tham nhũng; Chương V Nghị định 59/2019/NĐ-CP;
// Điều 9 Nghị định 184/2026/NĐ-CP (sửa đổi NĐ 59/2019). Thời hạn từng văn bản có thể khác nhau (VD từ đủ 02 đến 05 năm,
// lĩnh vực giáo dục 03 - 05 năm) nên số tháng dưới đây là THAM SỐ quản trị / Phòng VHXH chỉnh được theo văn bản áp dụng.

/** Tham số thời hạn - lưu ở danh mục, sửa được */
export interface QuyDinhChuyenDoiKeToan {
  /** Thời hạn tối thiểu (tháng) tại một vị trí: đủ thời hạn này thì đưa vào kế hoạch chuyển đổi */
  thangToiThieu: number
  /** Thời hạn tối đa (tháng): quá hạn này là phải chuyển ngay */
  thangToiDa: number
  /** Nhắc trước khi đủ thời hạn tối thiểu (tháng) */
  thangNhacTruoc: number
}

export const QUY_DINH_KE_TOAN_MAC_DINH: QuyDinhChuyenDoiKeToan = { thangToiThieu: 36, thangToiDa: 60, thangNhacTruoc: 6 }

export type MucChuyenDoiKeToan = 'QUA_TOI_DA' | 'DU_THOI_HAN' | 'SAP_DU' | 'CON_HAN' | 'NGHI_HUU_TRUOC' | 'CHUA_NHAP'

export const MUC_CHUYEN_DOI_KE_TOAN: Record<MucChuyenDoiKeToan, { ten: string; mau: string; moTa: string }> = {
  QUA_TOI_DA: { ten: 'Quá thời hạn tối đa', mau: '#a8071a', moTa: 'Đã quá thời hạn tối đa ở vị trí kế toán - phải chuyển đổi' },
  DU_THOI_HAN: { ten: 'Đủ thời hạn chuyển đổi', mau: '#cf1322', moTa: 'Đã đủ thời hạn tối thiểu - đưa vào kế hoạch chuyển đổi' },
  SAP_DU: { ten: 'Sắp đủ thời hạn', mau: '#d48806', moTa: 'Sắp đủ thời hạn tối thiểu - chuẩn bị phương án chuyển đổi' },
  CON_HAN: { ten: 'Còn thời hạn', mau: 'green', moTa: 'Chưa đến mốc nhắc' },
  NGHI_HUU_TRUOC: { ten: 'Nghỉ hưu trước hạn chuyển đổi', mau: 'purple', moTa: 'Đến tuổi nghỉ hưu trước khi đủ thời hạn chuyển đổi' },
  CHUA_NHAP: { ten: 'Chưa nhập mốc bổ nhiệm', mau: 'default', moTa: 'Trường cần nhập mốc bổ nhiệm, phân công kế toán gần nhất' },
}

/** Các mức cần nhắc việc (đếm ở menu, chuông) */
export const MUC_CAN_NHAC_KE_TOAN: MucChuyenDoiKeToan[] = ['QUA_TOI_DA', 'DU_THOI_HAN', 'SAP_DU']

/** Người làm kế toán trường: nhân viên có công việc cụ thể là Kế toán */
export const laKeToan = (vc: Pick<VienChuc, 'congViec'>) => vc.congViec === 'KE_TOAN'

export interface TinhTrangKeToan {
  vc: VienChuc
  /** Mốc bổ nhiệm, phân công kế toán gần nhất */
  moc?: string
  soQuyetDinh?: string
  ngayToiThieu?: string
  ngayToiDa?: string
  /** Số tháng đã làm kế toán tính đến hôm nay */
  soThangDaLam?: number
  /** Số ngày còn đến hạn tối thiểu (âm = đã quá) */
  soNgayConToiThieu?: number
  muc: MucChuyenDoiKeToan
  ngayNghiHuu?: string
}

export function tinhTrangKeToan(vc: VienChuc, qd: QuyDinhChuyenDoiKeToan, homNay = dayjs().startOf('day')): TinhTrangKeToan {
  const moc = vc.boNhiemKeToan?.ngay
  const nghiHuu = vc.ngaySinh ? dayjs(calcRetirementDate(vc.ngaySinh, vc.gioiTinh)).format('YYYY-MM-DD') : undefined
  if (!moc) return { vc, muc: 'CHUA_NHAP', ngayNghiHuu: nghiHuu }
  const ngayToiThieu = dayjs(moc).add(qd.thangToiThieu, 'month')
  const ngayToiDa = dayjs(moc).add(qd.thangToiDa, 'month')
  const base = {
    vc, moc, soQuyetDinh: vc.boNhiemKeToan?.soQuyetDinh,
    ngayToiThieu: ngayToiThieu.format('YYYY-MM-DD'), ngayToiDa: ngayToiDa.format('YYYY-MM-DD'),
    soThangDaLam: homNay.diff(dayjs(moc), 'month'), soNgayConToiThieu: ngayToiThieu.diff(homNay, 'day'), ngayNghiHuu: nghiHuu,
  }
  if (nghiHuu && nghiHuu <= base.ngayToiThieu) return { ...base, muc: 'NGHI_HUU_TRUOC' }
  const muc: MucChuyenDoiKeToan = !homNay.isBefore(ngayToiDa) ? 'QUA_TOI_DA'
    : !homNay.isBefore(ngayToiThieu) ? 'DU_THOI_HAN'
    : !ngayToiThieu.subtract(qd.thangNhacTruoc, 'month').isAfter(homNay) ? 'SAP_DU'
    : 'CON_HAN'
  return { ...base, muc }
}

/** Kế toán đang công tác trong phạm vi, kèm tình trạng; mức cần nhắc nhất lên đầu */
export function danhSachKeToan(vienChucs: VienChuc[], qd: QuyDinhChuyenDoiKeToan, scopeDonViId?: string | null): TinhTrangKeToan[] {
  const thuTu: Record<MucChuyenDoiKeToan, number> = { QUA_TOI_DA: 0, DU_THOI_HAN: 1, SAP_DU: 2, CHUA_NHAP: 3, CON_HAN: 4, NGHI_HUU_TRUOC: 5 }
  return vienChucs
    .filter((v) => v.active && isDangCongTac(v) && laKeToan(v) && (!scopeDonViId || v.donViId === scopeDonViId))
    .map((v) => tinhTrangKeToan(v, qd))
    .sort((a, b) => thuTu[a.muc] - thuTu[b.muc] || (a.ngayToiThieu ?? '9999').localeCompare(b.ngayToiThieu ?? '9999'))
}

/** "đã 2 năm 3 tháng" */
export const moTaThoiGianLam = (soThang?: number) => {
  if (soThang == null) return ''
  const nam = Math.floor(soThang / 12)
  const thang = soThang % 12
  return [nam ? `${nam} năm` : '', thang || !nam ? `${thang} tháng` : ''].filter(Boolean).join(' ')
}
