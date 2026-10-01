import type { PhuCapVienChuc } from '@/types/luong'
import type { LoaiPhuCap } from '@/types/danhMuc'

export const PC_UD_PREFIX = 'PCUD'

type LoaiTra = Pick<LoaiPhuCap, 'id' | 'ma'>

/**
 * Nhóm "cùng một loại" của phụ cấp: các mức ưu đãi nghề (PCUD_20/30/35/40/45) là một loại,
 * vì mỗi người chỉ hưởng một mức tại một thời điểm. Loại khác giữ nguyên.
 */
export function hoPhuCap(loaiPhuCapId: string, loaiPhuCaps: LoaiTra[]): string {
  const ma = loaiPhuCaps.find((l) => l.id === loaiPhuCapId)?.ma
  return ma?.startsWith(PC_UD_PREFIX) ? 'UU_DAI' : loaiPhuCapId
}

/**
 * Bản ghi đang hưởng khi một loại có nhiều bản còn hiệu lực (dữ liệu trùng):
 * lấy ngày hiệu lực mới nhất; trùng ngày thì giữ bản đứng trước như cách tính trước đây,
 * để số liệu bảng lương không tự đổi khi chưa có người xác nhận.
 */
export function chonBanDangHuong<T extends Pick<PhuCapVienChuc, 'ngayHieuLuc'>>(ds: T[]): T | undefined {
  let tot: T | undefined
  for (const p of ds) if (!tot || (p.ngayHieuLuc ?? '') > (tot.ngayHieuLuc ?? '')) tot = p
  return tot
}

/** Gom các bản còn hiệu lực theo loại (đã gộp các mức ưu đãi) */
export function nhomTheoLoai(ds: PhuCapVienChuc[], loaiPhuCaps: LoaiTra[]): Map<string, PhuCapVienChuc[]> {
  const m = new Map<string, PhuCapVienChuc[]>()
  for (const p of ds) {
    const k = hoPhuCap(p.loaiPhuCapId, loaiPhuCaps)
    const a = m.get(k) ?? []
    a.push(p)
    m.set(k, a)
  }
  return m
}

/** Ngày kết thúc của bản cũ khi có bản mới thay thế: ngay trước ngày hiệu lực mới, hoặc hôm nay */
export function ngayKetThucKhiThay(ngayHieuLucCu: string | undefined, ngayHieuLucMoi: string | undefined): string {
  const homNay = new Date().toISOString().slice(0, 10)
  if (!ngayHieuLucMoi || !(ngayHieuLucMoi > (ngayHieuLucCu ?? ''))) return homNay
  const d = new Date(`${ngayHieuLucMoi}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
