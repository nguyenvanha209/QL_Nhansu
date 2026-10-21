// Danh sách đề nghị nâng bậc lương trước thời hạn để in ra họp duyệt tại trường (trước khi trình chính thức)
// theo mẫu của trường: danh sách trong tỷ lệ + danh sách đủ điều kiện nhưng vượt tỷ lệ, xếp theo thứ tự ưu tiên.
import dayjs from 'dayjs'
import type { ChiTietDeXuat } from '@/types/deXuat'
import type { VienChuc } from '@/types/vienChuc'
import { CHUC_VU_LABELS } from '@/types/vienChuc'
import type { ChucDanhNgheNghiep } from '@/types/danhMuc'
import { formatDate } from '@/utils/helpers'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
const ngayDayDu = (d?: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '')
const heSo = (n: number) => String(Number(n.toFixed(2)))

/** Ghi chú tự động cho người vượt tỷ lệ: thứ tự ưu tiên trong số người vượt (1 = được xét trước nếu có suất) */
export const ghiChuVuotTyLe = (viTri: number, toiDa: number) => `Vượt tỷ lệ (tối đa ${toiDa} suất) - thứ tự dự phòng ${viTri - toiDa}`

interface DauVao {
  tenTruong: string
  nam: number
  chiTiet: ChiTietDeXuat[]
  toiDa: number
  vienChucs: Map<string, VienChuc>
  chucDanhs: Map<string, ChucDanhNgheNghiep>
  hieuTruong?: string
}

function bang(ds: ChiTietDeXuat[], batDau: number, toiDa: number, d: DauVao, laVuot: boolean) {
  if (!ds.length) return '<p style="text-align:center;margin:6pt 0"><i>(Không có)</i></p>'
  const hang = ds.map((c, i) => {
    const vc = d.vienChucs.get(c.vienChucId)
    const cd = d.chucDanhs.get(c.chucDanhCuId)
    const chucDanh = (vc?.chucVu && CHUC_VU_LABELS[vc.chucVu]) || (cd?.nhom === 'GIAO_VIEN' ? 'Giáo viên' : cd?.nhom === 'QUAN_LY' ? 'Cán bộ quản lý' : 'Nhân viên')
    const tt = c.thanhTich
    const thanhTich = [tt?.hinhThuc, tt?.noiDung, tt?.soQd ? `QĐ số ${tt.soQd}${tt.ngayQd ? ` ngày ${formatDate(tt.ngayQd)}` : ''}` : ''].filter(Boolean).join('\n')
    const ghiChu = [laVuot ? ghiChuVuotTyLe(batDau + i, toiDa) : '', c.ghiChu].filter(Boolean).join('\n')
    return `<tr>
<td align="center">${i + 1}</td><td><b>${esc(vc ? `${vc.ho} ${vc.ten}` : c.vienChucId)}</b></td>
<td align="center">${vc?.gioiTinh === 'NAM' ? formatDate(vc.ngaySinh) : ''}</td><td align="center">${vc?.gioiTinh === 'NU' ? formatDate(vc.ngaySinh) : ''}</td>
<td>${esc(chucDanh)}</td><td align="center">${esc(cd?.ma ?? '')}</td><td align="center">${c.bacCu}</td><td align="center">${heSo(c.heSoCu)}</td><td align="center">${ngayDayDu(c.ngayHieuLucCu)}</td>
<td align="center">${c.bacMoi}</td><td align="center">${heSo(c.heSoMoi)}</td><td align="center">${ngayDayDu(c.ngayHieuLuc)}</td>
<td>${esc(thanhTich)}</td><td align="center">${c.soThangTruocHan ?? ''}</td><td>${esc(ghiChu)}</td></tr>`
  }).join('')
  return `<table border="1" cellspacing="0" cellpadding="3" width="100%" style="border-collapse:collapse;margin-top:6pt">
<tr style="font-weight:bold;text-align:center"><td>TT</td><td>Họ và tên</td><td colspan="2">Ngày sinh</td><td>Chức vụ, chức danh</td><td colspan="4">Lương đang hưởng</td><td colspan="3">Nâng bậc lương TTH năm ${d.nam}</td><td>Cấp độ thành tích</td><td>Số tháng đề nghị</td><td>Ghi chú</td></tr>
<tr style="font-weight:bold;text-align:center"><td>Nam</td><td>Nữ</td><td>Mã CDNN</td><td>Bậc</td><td>Hệ số lương</td><td>Mốc tính nâng bậc lương</td><td>Bậc</td><td>Hệ số lương</td><td>Thời gian hưởng và mốc xét tính nâng bậc lương lần sau</td></tr>
<tr style="font-style:italic;text-align:center"><td>A</td><td>B</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td><td>9</td><td>10</td><td>11</td><td>12</td><td>13</td></tr>
${hang}</table>`
}

/** Tải bản Word (.doc, khổ A4 ngang) gồm 2 danh sách: trong tỷ lệ và vượt tỷ lệ */
export function taiWordDanhSachTruong(d: DauVao) {
  const trong = d.chiTiet.slice(0, d.toiDa)
  const vuot = d.chiTiet.slice(d.toiDa)
  const ngay = dayjs()
  const dau = (tieuDe: string) => `<table width="100%" style="border-collapse:collapse"><tr>
<td width="40%" style="text-align:center">UBND PHƯỜNG GIA VIÊN<br><b>${esc(d.tenTruong.toUpperCase())}</b><br>_____</td>
<td width="60%" style="text-align:center"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>Độc lập - Tự do - Hạnh phúc</b><br>_______________</td></tr></table>
<p style="text-align:center;margin:10pt 0 0 0"><b>DANH SÁCH</b></p><p style="text-align:center;margin:0"><b>${esc(tieuDe)}</b></p>`
  const chuKy = `<table width="100%" style="border-collapse:collapse;margin-top:10pt"><tr><td width="60%"></td>
<td width="40%" style="text-align:center"><i>Gia Viên, ngày ${ngay.format('DD')} tháng ${ngay.month() + 1} năm ${ngay.year()}</i><br><b>HIỆU TRƯỞNG</b><br><br><br><br><b>${esc(d.hieuTruong ?? '')}</b></td></tr></table>`
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">
<style>@page{size:29.7cm 21cm;margin:1.5cm 1.2cm 1.5cm 2cm} body{font-family:'Times New Roman';font-size:13pt} td{font-family:'Times New Roman';font-size:11pt;vertical-align:middle} .pb{page-break-before:always}</style></head><body>
${dau(`Đề nghị nâng bậc lương trước thời hạn do lập thành tích xuất sắc năm ${d.nam}`)}
${bang(trong, 1, d.toiDa, d, false)}${chuKy}
<div class="pb"></div>
${dau(`Những người đủ điều kiện nâng bậc lương trước thời hạn do lập thành tích xuất sắc năm ${d.nam}\nnhưng vượt quá tỉ lệ quy định`)}
${bang(vuot, d.toiDa + 1, d.toiDa, d, true)}${chuKy}
</body></html>`
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `DS-nang-luong-truoc-han-${d.nam}-${d.tenTruong.replace(/[\/:*?"<>|]/g, '').replace(/\s+/g, '-')}.doc`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
