// Đối chiếu danh sách đơn vị lập (phiếu nâng bậc thường xuyên, nâng phụ cấp thâm niên, xếp PCTN lần đầu) với danh sách
// phần mềm gợi ý theo hồ sơ - giúp chuyên viên Phòng VHXH thẩm định: thiếu người đến hạn, thừa người chưa đến hạn.
// Cách xét giống phần gợi ý ở trang lập phiếu (TaoDeXuatPage).
import dayjs from 'dayjs'
import type { DeXuatLuong, LoaiDeXuat } from '@/types/deXuat'
import type { VienChuc } from '@/types/vienChuc'
import { isDangCongTac, nhanLuongTheoTien } from '@/types/vienChuc'
import type { BacLuong, ChucDanhNgheNghiep, LoaiPhuCap } from '@/types/danhMuc'
import type { HeSoLuong, PhuCapVienChuc } from '@/types/luong'
import { ngayDenHanNangLuong } from '@/utils/nangLuong'
import { chonBanDangHuong } from '@/utils/phuCapDangHuong'
import { laDienPhuCapThamNien } from '@/utils/nhomViTri'
import { ngayDu5Nam } from '@/utils/pctnLanDau'
import { formatDate, vietHoaDauTu } from '@/utils/helpers'

export const LOAI_DOI_CHIEU: LoaiDeXuat[] = ['NANG_BAC', 'PHU_CAP_THAM_NIEN', 'PCTN_LAN_DAU']

export type KyPhieu = { nam: number; ky: 'H1' | 'H2' }
const khoang = (k: KyPhieu) => (k.ky === 'H1' ? { tu: `${k.nam}-01-01`, den: `${k.nam}-06-30` } : { tu: `${k.nam}-07-01`, den: `${k.nam}-12-31` })
export const tenKyPhieu = (k: KyPhieu) => `${k.ky === 'H1' ? '6 tháng đầu năm' : '6 tháng cuối năm'} ${k.nam}`

/** Kỳ của phiếu: theo tiêu đề ("... 6 tháng cuối năm 2026"), không có thì theo mốc hưởng đa số trong phiếu */
export function kyCuaPhieu(dx: Pick<DeXuatLuong, 'tieuDe' | 'namXet' | 'chiTiet' | 'ngayDeXuat' | 'createdAt'>): KyPhieu {
  const m = /6 tháng (đầu|cuối) năm (\d{4})/i.exec(dx.tieuDe ?? '')
  if (m) return { nam: Number(m[2]), ky: m[1].toLowerCase() === 'đầu' ? 'H1' : 'H2' }
  const dem = new Map<string, number>()
  for (const c of dx.chiTiet) {
    if (!c.ngayHieuLuc) continue
    const k = `${c.ngayHieuLuc.slice(0, 4)}-${Number(c.ngayHieuLuc.slice(5, 7)) <= 6 ? 'H1' : 'H2'}`
    dem.set(k, (dem.get(k) ?? 0) + 1)
  }
  const nhieu = [...dem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (nhieu) return { nam: Number(nhieu.slice(0, 4)), ky: nhieu.slice(5) as 'H1' | 'H2' }
  const d = dayjs(dx.ngayDeXuat || dx.createdAt)
  return { nam: dx.namXet ?? d.year(), ky: d.month() < 6 ? 'H1' : 'H2' }
}

export interface DuLieuGoiY {
  vienChucs: VienChuc[]
  heSoLuongs: HeSoLuong[]
  phuCaps: PhuCapVienChuc[]
  loaiPhuCaps: LoaiPhuCap[]
  bacLuongs: BacLuong[]
  chucDanhs: ChucDanhNgheNghiep[]
}

export interface NguoiGoiY {
  vienChucId: string
  hoTen: string
  /** Mốc đến hạn / đủ 5 năm (yyyy-mm-dd) */
  moc?: string
  ghiChu?: string
}

/** Tình trạng một người theo hồ sơ: trong kỳ (có trong gợi ý) hay không, kèm mốc để giải thích */
function xetNguoi(loai: LoaiDeXuat, v: VienChuc, k: KyPhieu, d: DuLieuGoiY): { trongKy: boolean; moc?: string; lyDo: string } {
  const { tu, den } = khoang(k)
  const loai_ = (ma: string) => d.loaiPhuCaps.find((l) => l.ma === ma)
  const ban = (ma: string) => {
    const l = loai_(ma)
    return l ? chonBanDangHuong(d.phuCaps.filter((p) => p.vienChucId === v.id && p.isActive && p.loaiPhuCapId === l.id)) : undefined
  }
  const dienPctn = laDienPhuCapThamNien(v as { vtvl?: string; chucVu?: string }, d.chucDanhs.find((c) => c.id === v.chucDanhId)?.nhom)
  if (loai === 'NANG_BAC') {
    const hsl = d.heSoLuongs.find((h) => h.vienChucId === v.id && h.isActive)
    if (!hsl) return { trongKy: false, lyDo: 'Hồ sơ chưa có bậc, hệ số lương' }
    const denHan = ngayDenHanNangLuong(hsl, ban('PC_THAM_NIEN_VK'), d.bacLuongs)
    const trongKy = denHan >= tu && denHan <= den
    return { trongKy, moc: denHan, lyDo: trongKy ? `Đến hạn ${formatDate(denHan)}` : `Đến hạn ${formatDate(denHan)} - ngoài kỳ` }
  }
  if (loai === 'PHU_CAP_THAM_NIEN') {
    if (!dienPctn) return { trongKy: false, lyDo: 'Nhân viên - không hưởng phụ cấp thâm niên' }
    const pctn = ban('PC_THAM_NIEN')?.giaTri ?? 0
    if (!pctn) return { trongKy: false, lyDo: 'Chưa hưởng PCTN - xét xếp lần đầu' }
    if (!v.mocHuongPctn) return { trongKy: false, lyDo: 'Hồ sơ chưa có mốc hưởng PCTN' }
    const moc = `${k.nam}-${dayjs(v.mocHuongPctn).format('MM-DD')}`
    const trongKy = moc >= tu && moc <= den
    return { trongKy, moc, lyDo: trongKy ? `Đến mốc ${formatDate(moc)} (đang ${pctn}%)` : `Mốc hưởng ${formatDate(v.mocHuongPctn)} - nâng ngoài kỳ` }
  }
  // Xếp PCTN lần đầu: CBQL, giáo viên chưa hưởng, đã khai BHXH, đủ 5 năm đến hết kỳ
  if (!dienPctn) return { trongKy: false, lyDo: 'Nhân viên - không hưởng phụ cấp thâm niên' }
  if ((ban('PC_THAM_NIEN')?.giaTri ?? 0) > 0) return { trongKy: false, lyDo: 'Đang hưởng PCTN' }
  if (!v.batDauBhxhGd) return { trongKy: false, lyDo: 'Chưa khai tháng đóng BHXH - chưa xác định được' }
  const du = ngayDu5Nam({ batDauBhxh: v.batDauBhxhGd, thangTapSu: 12, thangKhongTinhKhac: 0 })
  const trongKy = !!du && du <= den
  return { trongKy, moc: du, lyDo: trongKy ? `Đủ 5 năm ${formatDate(du)} (tạm tính)` : `Đủ 5 năm ${du ? formatDate(du) : '?'} (tạm tính) - sau kỳ` }
}

export interface KetQuaDoiChieu {
  ky: KyPhieu
  /** Phần mềm gợi ý nhưng phiếu chưa có (và không nằm trong phiếu khác cùng kỳ) */
  thieu: NguoiGoiY[]
  /** Có trong phiếu nhưng theo hồ sơ chưa đến hạn / chưa đủ điều kiện trong kỳ */
  thua: NguoiGoiY[]
  /** Người gợi ý đã nằm trong phiếu khác cùng kỳ của đơn vị */
  oPhieuKhac: (NguoiGoiY & { ma: string })[]
  soGoiY: number
}

export function doiChieuPhieu(dx: DeXuatLuong, tatCaPhieu: DeXuatLuong[], d: DuLieuGoiY): KetQuaDoiChieu {
  const ky = kyCuaPhieu(dx)
  const ten = (v: VienChuc) => vietHoaDauTu(`${v.ho} ${v.ten}`)
  const nguoiDonVi = d.vienChucs.filter((v) => v.active && isDangCongTac(v) && !nhanLuongTheoTien(v) && v.donViId === dx.donViId)
  const goiY = nguoiDonVi.map((v) => ({ v, x: xetNguoi(dx.loai, v, ky, d) })).filter(({ x }) => x.trongKy)

  const trongPhieu = new Set(dx.chiTiet.map((c) => c.vienChucId))
  // Phiếu khác cùng loại, cùng kỳ, cùng đơn vị (không tính phiếu bị từ chối)
  const phieuKhac = new Map<string, string>()
  for (const p of tatCaPhieu) {
    if (p.id === dx.id || p.donViId !== dx.donViId || p.loai !== dx.loai || p.trangThai === 'TU_CHOI') continue
    const k = kyCuaPhieu(p)
    if (k.nam !== ky.nam || k.ky !== ky.ky) continue
    for (const c of p.chiTiet) phieuKhac.set(c.vienChucId, p.ma)
  }

  const thieu: NguoiGoiY[] = []
  const oPhieuKhac: (NguoiGoiY & { ma: string })[] = []
  for (const { v, x } of goiY) {
    if (trongPhieu.has(v.id)) continue
    const n = { vienChucId: v.id, hoTen: ten(v), moc: x.moc, ghiChu: x.lyDo }
    const ma = phieuKhac.get(v.id)
    if (ma) oPhieuKhac.push({ ...n, ma })
    else thieu.push(n)
  }
  const idGoiY = new Set(goiY.map(({ v }) => v.id))
  const vcTheoId = new Map(d.vienChucs.map((v) => [v.id, v]))
  const thua: NguoiGoiY[] = dx.chiTiet
    .filter((c) => !idGoiY.has(c.vienChucId))
    .map((c) => {
      const v = vcTheoId.get(c.vienChucId)
      if (!v) return { vienChucId: c.vienChucId, hoTen: c.vienChucId, ghiChu: 'Không tìm thấy hồ sơ' }
      if (v.donViId !== dx.donViId || !isDangCongTac(v)) return { vienChucId: v.id, hoTen: ten(v), ghiChu: 'Không còn công tác tại đơn vị' }
      const x = xetNguoi(dx.loai, v, ky, d)
      return { vienChucId: v.id, hoTen: ten(v), moc: x.moc, ghiChu: x.lyDo }
    })
  const sx = (a: NguoiGoiY, b: NguoiGoiY) => (a.moc ?? '9').localeCompare(b.moc ?? '9') || a.hoTen.localeCompare(b.hoTen, 'vi')
  return { ky, thieu: thieu.sort(sx), thua: thua.sort(sx), oPhieuKhac: oPhieuKhac.sort(sx), soGoiY: goiY.length }
}
