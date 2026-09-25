import dayjs from 'dayjs'
import type { VienChuc } from '@/types/vienChuc'

// Bảo lưu phụ cấp chức vụ khi sắp xếp tổ chức bộ máy — Điều 11 NĐ 178/2024/NĐ-CP (sửa đổi bởi NĐ 67/2025/NĐ-CP):
// thôi giữ chức vụ hoặc được bổ nhiệm chức vụ có PCCV thấp hơn thì hưởng NGUYÊN mức PCCV cũ đến hết
// thời hạn bổ nhiệm chức vụ cũ; thời hạn còn lại dưới 6 tháng thì được bảo lưu 6 tháng.
// Dòng phụ cấp PC_CHUC_VU trong hồ sơ luôn là mức theo chức vụ hiện tại; phần bảo lưu nằm riêng
// trong hồ sơ và được áp khi tính lương, hết hạn thì tự trở về mức theo chức vụ hiện tại.

/** Ngày cuối được hưởng bảo lưu: hết hạn bổ nhiệm cũ, nhưng tối thiểu 6 tháng kể từ quyết định sắp xếp */
export function tinhNgayHetBaoLuu(ngayQuyetDinh: string, ngayHetHanBoNhiem: string): string {
  const toiThieu = dayjs(ngayQuyetDinh).add(6, 'month').subtract(1, 'day')
  const hetHan = dayjs(ngayHetHanBoNhiem)
  return (hetHan.isAfter(toiThieu) ? hetHan : toiThieu).format('YYYY-MM-DD')
}

/** Đang trong thời gian bảo lưu PCCV (tính đến ngày xét, mặc định hôm nay) */
export function dangBaoLuuPccv(vc: Pick<VienChuc, 'baoLuuPccv'>, ngay = dayjs().format('YYYY-MM-DD')): boolean {
  const bl = vc.baoLuuPccv
  return !!bl && bl.ngayQuyetDinh <= ngay && ngay <= bl.denNgay
}

/** Hệ số PCCV thực hưởng: mức bảo lưu nếu còn hạn và cao hơn, ngược lại là mức theo chức vụ hiện tại */
export function pccvThucHuong(vc: Pick<VienChuc, 'baoLuuPccv'>, pccvTheoChucVu: number, ngay?: string): number {
  return dangBaoLuuPccv(vc, ngay) ? Math.max(vc.baoLuuPccv!.heSo, pccvTheoChucVu) : pccvTheoChucVu
}

/** Số ngày còn lại của thời gian bảo lưu (âm nếu đã hết) */
export function soNgayConBaoLuu(vc: Pick<VienChuc, 'baoLuuPccv'>): number | undefined {
  if (!vc.baoLuuPccv) return undefined
  return dayjs(vc.baoLuuPccv.denNgay).diff(dayjs().startOf('day'), 'day')
}
