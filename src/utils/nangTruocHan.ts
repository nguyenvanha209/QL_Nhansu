// Nâng bậc lương trước thời hạn do lập thành tích xuất sắc trong thực hiện nhiệm vụ
// Căn cứ: khoản 1 Điều 3 Thông tư 08/2013/TT-BNV, sửa đổi bởi Thông tư 03/2021/TT-BNV.
//  - Chưa xếp bậc cuối; tính đến 31/12 năm xét còn thiếu từ 12 tháng trở xuống để nâng bậc thường xuyên
//  - Nâng một bậc trước thời hạn tối đa 12 tháng (số tháng theo cấp độ thành tích do Quy chế đơn vị quy định)
//  - Tỷ lệ không quá 10% tổng số người trong danh sách trả lương; cứ 10 người 1 suất, dư dưới 10 không tính
//  - Thành tích theo quyết định công nhận trong 6 năm gần nhất (chức danh yêu cầu cao đẳng trở lên) hoặc
//    4 năm gần nhất (trung cấp trở xuống), tính đến 31/12 năm xét
//  - Không thực hiện hai lần liên tiếp nâng bậc lương trước thời hạn do thành tích xuất sắc
import dayjs from 'dayjs'
import type { VienChuc } from '@/types/vienChuc'
import { duocTinhSoLieu, nhanLuongTheoTien } from '@/types/vienChuc'
import type { HeSoLuong } from '@/types/luong'
import type { BacLuong, ChucDanhNgheNghiep } from '@/types/danhMuc'
import type { ChiTietDeXuat } from '@/types/deXuat'

export const SO_THANG_TOI_DA = 12

/** Danh sách trả lương của trường (căn cứ tỷ lệ 10%): người đang công tác xếp lương theo hệ số */
export function danhSachTraLuong(vienChucs: VienChuc[], heSoLuongs: HeSoLuong[], donViId: string): VienChuc[] {
  const coHeSo = new Set(heSoLuongs.filter((h) => h.isActive && h.heSo > 0).map((h) => h.vienChucId))
  return vienChucs.filter((v) => v.donViId === donViId && duocTinhSoLieu(v) && !nhanLuongTheoTien(v) && coHeSo.has(v.id))
}

/** Số suất tối đa: cứ 10 người 1 suất, phần dư dưới 10 người không tính */
export const soSuatToiDa = (soNguoi: number) => Math.floor(soNguoi / 10)

/** Bản lương đang hưởng (ưu tiên bản hồ sơ đang trỏ tới) */
export function heSoDangHuong(vc: VienChuc, heSoLuongs: HeSoLuong[]): HeSoLuong | undefined {
  return heSoLuongs.find((h) => h.id === vc.heSoLuongHienTaiId && h.isActive && h.vienChucId === vc.id)
    ?? heSoLuongs.find((h) => h.vienChucId === vc.id && h.isActive)
}

/** Khoảng ngày đến hạn nâng bậc thường xuyên của người có thể xét trong năm: sau 31/12 năm xét đến hết 31/12 năm sau */
export const khoangDenHan = (nam: number) => ({ tu: `${nam}-12-31`, den: `${nam + 1}-12-31` })

/** Còn thiếu ≤ 12 tháng (tính đến 31/12 năm xét) để đủ điều kiện nâng bậc thường xuyên */
export function trongDienXet(ngayDenHan: string | undefined, nam: number): boolean {
  if (!ngayDenHan) return false
  const { tu, den } = khoangDenHan(nam)
  return ngayDenHan > tu && ngayDenHan <= den
}

/** Mốc hưởng bậc mới = ngày đến hạn - số tháng nâng trước */
export const mocMoiTruocHan = (ngayDenHan: string, soThang: number) =>
  dayjs(ngayDenHan).subtract(soThang, 'month').format('YYYY-MM-DD')

/** Thời gian thành tích được xét: 6 năm (chức danh cao đẳng trở lên - loại A) hoặc 4 năm (trung cấp trở xuống - loại B, C) */
export const soNamThanhTich = (bangLuong?: string) => (/^A/i.test((bangLuong ?? '').trim()) ? 6 : 4)

/** Bậc kế tiếp trong bảng lương của chức danh; null khi đã ở bậc cuối */
export function bacKeTiep(bangCua: BacLuong[], bacHienTai: number): BacLuong | null {
  const bang = [...bangCua].sort((a, b) => a.bac - b.bac)
  if (!bang.length || bacHienTai >= bang[bang.length - 1].bac) return null
  return bang.find((b) => b.bac === bacHienTai + 1) ?? null
}

export interface KiemTraDong {
  /** Chặn khi trình */
  loi: string[]
  /** Chỉ cảnh báo (người thẩm định lưu ý) */
  canhBao: string[]
}

/** Kiểm tra một người trong hồ sơ trước khi trình */
export function kiemTraDong(
  ct: ChiTietDeXuat, nam: number,
  ctx: { cd?: ChucDanhNgheNghiep; hs?: HeSoLuong; bacCuoi?: number; tenNguoi: string },
): KiemTraDong {
  const loi: string[] = []
  const canhBao: string[] = []
  const { cd, hs, bacCuoi } = ctx
  if (bacCuoi !== undefined && ct.bacCu >= bacCuoi) loi.push('đã ở bậc cuối - không nâng bậc trước thời hạn')
  const soThang = ct.soThangTruocHan ?? 0
  if (soThang < 1 || soThang > SO_THANG_TOI_DA) loi.push(`số tháng nâng trước phải từ 1 đến ${SO_THANG_TOI_DA}`)
  const tt = ct.thanhTich
  if (!tt?.hinhThuc?.trim()) loi.push('chưa ghi hình thức khen thưởng / danh hiệu')
  if (!tt?.soQd?.trim() || !tt?.ngayQd) loi.push('chưa ghi số, ngày quyết định công nhận thành tích')
  if (!ct.minhChung?.length) loi.push('chưa đính kèm minh chứng thành tích (quyết định, giấy khen…)')
  if (tt?.ngayQd) {
    const cuoiNam = `${nam}-12-31`
    const soNam = soNamThanhTich(cd?.bangLuong)
    const somNhat = dayjs(cuoiNam).subtract(soNam, 'year').add(1, 'day').format('YYYY-MM-DD')
    if (tt.ngayQd > cuoiNam) loi.push(`quyết định công nhận thành tích sau 31/12/${nam}`)
    else if (tt.ngayQd < somNhat) canhBao.push(`thành tích ngoài ${soNam} năm gần nhất (quyết định trước ${dayjs(somNhat).format('DD/MM/YYYY')})`)
  }
  const denHan = ct.ngayDenHanCu
  if (!trongDienXet(denHan, nam)) {
    canhBao.push(denHan
      ? `đến hạn nâng bậc thường xuyên ${dayjs(denHan).format('DD/MM/YYYY')} - ngoài diện còn thiếu ≤ 12 tháng tính đến 31/12/${nam}`
      : 'chưa có ngày đến hạn nâng bậc trong hồ sơ')
  }
  if (denHan && ct.ngayHieuLuc && ct.ngayHieuLuc < mocMoiTruocHan(denHan, SO_THANG_TOI_DA)) loi.push('mốc hưởng mới sớm hơn ngày đến hạn quá 12 tháng')
  if (hs?.lyDo === 'NANG_TRUOC_HAN') canhBao.push('lần nâng bậc gần nhất là nâng trước thời hạn - không nâng hai lần liên tiếp (TT 03/2021)')
  return { loi, canhBao }
}
