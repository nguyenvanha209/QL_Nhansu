// Danh sách đề nghị nâng bậc lương trước thời hạn để in ra họp duyệt tại trường (trước khi trình chính thức)
// theo mẫu của trường - một danh sách xếp theo thứ tự ưu tiên; người sau số suất tối đa ghi chú vượt tỷ lệ.
import dayjs from 'dayjs'
import type { ChiTietDeXuat } from '@/types/deXuat'
import type { VienChuc } from '@/types/vienChuc'
import { CHUC_VU_LABELS } from '@/types/vienChuc'
import type { ChucDanhNgheNghiep } from '@/types/danhMuc'
import { formatDate } from '@/utils/helpers'
import { xuatExcelA4 } from '@/utils/excelA4'
import type { O } from '@/utils/excelA4'

/** Ghi chú tự động cho người vượt tỷ lệ: thứ tự ưu tiên trong số người vượt (1 = được xét trước nếu có suất) */
export const ghiChuVuotTyLe = (viTri: number, toiDa: number) => `Vượt tỷ lệ (tối đa ${toiDa} suất) - dự phòng thứ ${viTri - toiDa}`

interface DauVao {
  tenTruong: string
  nam: number
  chiTiet: ChiTietDeXuat[]
  toiDa: number
  soNguoiTraLuong: number
  vienChucs: Map<string, VienChuc>
  chucDanhs: Map<string, ChucDanhNgheNghiep>
  hieuTruong?: string
}

const SO_COT = 15

/** Xuất Excel (A4 ngang) danh sách đề nghị để họp duyệt tại trường */
export function xuatExcelDanhSachTruong(d: DauVao) {
  const ngay = dayjs()
  const trong = (n: number): O[] => Array(n).fill(null)
  const dau: O[][] = [
    ['UBND PHƯỜNG GIA VIÊN', null, null, null, null, null, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', ...trong(8)],
    [d.tenTruong.toUpperCase(), null, null, null, null, null, 'Độc lập - Tự do - Hạnh phúc', ...trong(8)],
    [],
    ['DANH SÁCH', ...trong(14)],
    [`Đề nghị nâng bậc lương trước thời hạn do lập thành tích xuất sắc trong thực hiện nhiệm vụ năm ${d.nam}`, ...trong(14)],
    [`(Danh sách trả lương ${d.soNguoiTraLuong} người, tối đa ${d.toiDa} suất; đề nghị ${d.chiTiet.length} người${d.chiTiet.length > d.toiDa ? `, trong đó ${d.chiTiet.length - d.toiDa} người vượt tỷ lệ xếp theo thứ tự dự phòng` : ''})`, ...trong(14)],
    [],
  ]
  const tieuDe: O[][] = [
    ['TT', 'Họ và tên', 'Ngày sinh', null, 'Chức vụ, chức danh', 'Lương đang hưởng', null, null, null, `Nâng bậc lương trước thời hạn năm ${d.nam}`, null, null, 'Cấp độ thành tích', 'Số tháng đề nghị', 'Ghi chú'],
    [null, null, 'Nam', 'Nữ', null, 'Mã CDNN', 'Bậc', 'Hệ số lương', 'Mốc tính nâng bậc lương', 'Bậc', 'Hệ số lương', 'Thời gian hưởng và mốc xét nâng bậc lương lần sau', null, null, null],
    ['A', 'B', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
  ]
  const than: O[][] = d.chiTiet.map((c, i) => {
    const vc = d.vienChucs.get(c.vienChucId)
    const cd = d.chucDanhs.get(c.chucDanhCuId)
    const chucDanh = (vc?.chucVu && CHUC_VU_LABELS[vc.chucVu]) || (cd?.nhom === 'GIAO_VIEN' ? 'Giáo viên' : cd?.nhom === 'QUAN_LY' ? 'Cán bộ quản lý' : 'Nhân viên')
    const tt = c.thanhTich
    const thanhTich = [tt?.hinhThuc, tt?.noiDung, tt?.soQd ? `QĐ số ${tt.soQd}${tt.ngayQd ? ` ngày ${formatDate(tt.ngayQd)}` : ''}` : ''].filter(Boolean).join('\n')
    const ghiChu = [i >= d.toiDa ? ghiChuVuotTyLe(i + 1, d.toiDa) : '', c.ghiChu].filter(Boolean).join('\n')
    return [
      i + 1, vc ? `${vc.ho} ${vc.ten}` : c.vienChucId,
      vc?.gioiTinh === 'NAM' ? formatDate(vc.ngaySinh) : '', vc?.gioiTinh === 'NU' ? formatDate(vc.ngaySinh) : '',
      chucDanh, cd?.ma ?? '', c.bacCu, c.heSoCu, formatDate(c.ngayHieuLucCu ?? ''),
      c.bacMoi, c.heSoMoi, formatDate(c.ngayHieuLuc),
      thanhTich, c.soThangTruocHan ?? '', ghiChu,
    ]
  })
  const r0 = dau.length
  const cuoi = r0 + tieuDe.length + than.length
  const chuKy: O[][] = [
    [],
    [...trong(10), `Gia Viên, ngày ${ngay.format('DD')} tháng ${ngay.format('MM')} năm ${ngay.year()}`, ...trong(4)],
    [...trong(10), 'HIỆU TRƯỞNG', ...trong(4)],
    [], [], [], [],
    [...trong(10), d.hieuTruong ?? '', ...trong(4)],
  ]
  const dong = [...dau, ...tieuDe, ...than, ...chuKy]
  const g = (r1: number, c1: number, r2: number, c2: number) => ({ r1, c1, r2, c2 })
  const rKy = cuoi + 1
  // Người vượt tỷ lệ tô nền cam nhạt để dễ nhận ra khi họp
  const nen: Record<number, string> = {}
  than.forEach((_, i) => { if (i >= d.toiDa) nen[r0 + tieuDe.length + i] = 'FFFFF1E0' })
  // Hệ số lương luôn hiện 2 chữ số lẻ (3,00 không thành 3)
  const dinhDangO: Record<string, string> = {}
  than.forEach((_, i) => { for (const c of [7, 10]) dinhDangO[`${r0 + tieuDe.length + i}:${c}`] = '0.00' })
  return xuatExcelA4(`DS-nang-luong-truoc-han-${d.nam}-${d.tenTruong.replace(/[\/:*?"<>|]/g, '').replace(/\s+/g, '-')}`, [{
    ten: `Năm ${d.nam}`,
    dong,
    gop: [
      g(0, 0, 0, 5), g(1, 0, 1, 5), g(0, 6, 0, 14), g(1, 6, 1, 14),
      g(3, 0, 3, 14), g(4, 0, 4, 14), g(5, 0, 5, 14),
      // tiêu đề bảng
      g(r0, 0, r0 + 1, 0), g(r0, 1, r0 + 1, 1), g(r0, 2, r0, 3), g(r0, 4, r0 + 1, 4), g(r0, 5, r0, 8), g(r0, 9, r0, 11),
      g(r0, 12, r0 + 1, 12), g(r0, 13, r0 + 1, 13), g(r0, 14, r0 + 1, 14),
      ...[0, 1, 6].map((k) => g(rKy + k, 10, rKy + k, 14)),
    ],
    rongCot: [5, 22, 11, 11, 12, 11, 6, 8, 11, 6, 8, 13, 38, 8, 24],
    bang: [{ tu: r0, den: cuoi - 1, soDongTieuDe: tieuDe.length, soCot: SO_COT }],
    tieuDe: [0, 1, 3, 4],
    nghieng: [5, rKy],
    giua: [5, rKy, rKy + 1, rKy + 6],
    dam: [rKy + 1, rKy + 6],
    cotGiua: [0, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13],
    nen,
    dinhDangO,
    soLe: 2,
    huong: 'ngang',
    coChu: 11,
  }])
}
