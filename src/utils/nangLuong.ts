import type { BacLuong, ChucDanhNgheNghiep } from '@/types/danhMuc'

// Ngày nâng bậc lương thường xuyên kế tiếp = mốc hưởng bậc hiện tại + thời gian giữ bậc của ngạch:
// 3 năm với chức danh yêu cầu cao đẳng trở lên (A0, A1, A2…), 2 năm với trung cấp trở xuống (B, C)
// - Thông tư 08/2013/TT-BNV.

/** Ngày dạng yyyy-mm-dd, năm trong khoảng hợp lý (loại các giá trị nhập lỗi như năm 0205) */
export function ngayHopLe(d?: string): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const nam = Number(d.slice(0, 4))
  return nam >= 1960 && nam <= 2100 && !Number.isNaN(Date.parse(d))
}

/** Cộng số năm, giữ nguyên ngày tháng (không lệch múi giờ) */
export function congNam(ngay: string, soNam: number): string {
  const [y, m, d] = ngay.split('-').map(Number)
  return new Date(Date.UTC(y + soNam, m - 1, d)).toISOString().slice(0, 10)
}

export function thoiGianNangBac(
  chucDanhId: string | undefined, bac: number | undefined,
  bacLuongs: BacLuong[], chucDanhs: ChucDanhNgheNghiep[],
): 2 | 3 {
  const bang = bacLuongs.filter((b) => b.chucDanhId === chucDanhId)
  const theoBac = bang.find((b) => b.bac === bac) ?? bang[0]
  if (theoBac) return theoBac.thoiGianNangLuong
  return /^[BC]/.test(chucDanhs.find((c) => c.id === chucDanhId)?.bangLuong ?? '') ? 2 : 3
}

/** Ngày nâng lương tiếp theo; undefined khi mốc hưởng trống hoặc sai */
export function tinhNgayNangTiep(
  ngayHieuLuc: string | undefined, chucDanhId: string | undefined, bac: number | undefined,
  bacLuongs: BacLuong[], chucDanhs: ChucDanhNgheNghiep[],
): string | undefined {
  if (!ngayHopLe(ngayHieuLuc)) return undefined
  return congNam(ngayHieuLuc, thoiGianNangBac(chucDanhId, bac, bacLuongs, chucDanhs))
}

/** Bậc đang giữ là bậc cuối của ngạch (sau đó xét phụ cấp thâm niên vượt khung, không nâng bậc) */
export function laBacCuoi(chucDanhId: string | undefined, bac: number | undefined, bacLuongs: BacLuong[]): boolean {
  const bang = bacLuongs.filter((b) => b.chucDanhId === chucDanhId)
  return !!bang.length && bac === Math.max(...bang.map((b) => b.bac))
}
