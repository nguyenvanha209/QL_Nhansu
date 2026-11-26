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

// ───────────────────────────── Thâm niên vượt khung ─────────────────────────────
// Người đã xếp bậc cuối: đủ 36 tháng (A0 trở lên) hoặc 24 tháng (B, C) ở bậc cuối thì hưởng PC TNVK 5%,
// từ năm sau MỖI NĂM xét thêm 1% (TT 04/2005/TT-BNV). Trước đây ngày đến hạn của người đã hưởng vượt khung
// vẫn tính theo chu kỳ bậc (+3 / +2 năm) nên họ chỉ lọt danh sách nâng lương thường xuyên 3 năm một lần.

type BanPhuCap = { giaTri: number; ngayHieuLuc?: string; createdAt?: string }

/**
 * Mốc hưởng PC TNVK gần nhất. Bản phụ cấp ghi khi nhập Excel / thêm tay thường lấy ngày nhập làm ngày hiệu lực
 * (trùng ngày tạo) - không phải mốc thật, khi đó dùng mốc hưởng của bản lương ("Thời điểm tính nâng bậc / TNVK").
 */
export function mocHuongTnvk(
  hsl: { ngayHieuLuc?: string },
  tnvk?: BanPhuCap,
): string | undefined {
  const moc: string[] = []
  if (tnvk && ngayHopLe(tnvk.ngayHieuLuc) && tnvk.ngayHieuLuc !== tnvk.createdAt?.slice(0, 10)) moc.push(tnvk.ngayHieuLuc)
  if (ngayHopLe(hsl.ngayHieuLuc)) moc.push(hsl.ngayHieuLuc)
  return moc.sort().pop()
}

/**
 * Ngày đến hạn xét nâng lương thường xuyên thực tế:
 * - bậc cuối đã hưởng TNVK (> 0%): mốc hưởng TNVK gần nhất + 1 năm;
 * - còn lại: ngày nâng lương tiếp theo đang ghi (mốc bậc + 3 / 2 năm; bậc cuối chưa hưởng TNVK = ngày đủ điều kiện 5%).
 */
export function ngayDenHanNangLuong(
  hsl: { chucDanhId: string; bac: number; ngayHieuLuc?: string; ngayNangLuongTiepTheo: string },
  tnvk: BanPhuCap | undefined,
  bacLuongs: BacLuong[],
): string {
  if (tnvk && tnvk.giaTri > 0 && laBacCuoi(hsl.chucDanhId, hsl.bac, bacLuongs)) {
    const moc = mocHuongTnvk(hsl, tnvk)
    if (moc) return congNam(moc, 1)
  }
  return hsl.ngayNangLuongTiepTheo
}
