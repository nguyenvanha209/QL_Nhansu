import type { DeXuatLuong, ChiTietDeXuat } from '@/types/deXuat'
import { laDongVuotKhung } from '@/types/deXuat'
import type { VienChuc } from '@/types/vienChuc'
import type { BacLuong, ChucDanhNgheNghiep, LoaiPhuCap } from '@/types/danhMuc'
import type { HeSoLuong, PhuCapVienChuc } from '@/types/luong'
import type { BangTruyLinh, DongTruyLinhLuong, DongTruyLinhPctn, KyTruyLinh, ThanhPhanLuong } from '@/types/truyLinh'
import { khoangKy, TEN_KY_TRUY_LINH } from '@/types/truyLinh'
import { chonBanDangHuong } from '@/utils/phuCapDangHuong'
import { pccvThucHuong } from '@/utils/baoLuuPccv'
import { congNam, thoiGianNangBac, ngayHopLe } from '@/utils/nangLuong'
import { vietHoaDauTu } from '@/utils/helpers'
import { lamTronExcel, ganCotTinh, ganDongTong, xuatExcelA4 } from '@/utils/excelA4'
import type { O, TrangA4 } from '@/utils/excelA4'

// ───────────────────────────── Tính hệ số ─────────────────────────────
// Đúng cách bảng lương của trường (và Bảng tổng hợp lương): PC TNVK = hệ số × %; nền = hệ số + TNVK + PC chức vụ;
// PC thâm niên nhà giáo, ưu đãi = nền × %; làm tròn 3 chữ số như Excel.

const r3 = (n: number) => lamTronExcel(n, 3)

export function tinhHeSo(tp: Pick<ThanhPhanLuong, 'heSo' | 'pcChucVu' | 'vkPct' | 'tnnPct'> & Partial<ThanhPhanLuong>) {
  const vkHs = r3(tp.heSo * tp.vkPct / 100)
  const nen = tp.heSo + vkHs + tp.pcChucVu
  const tnnHs = r3(nen * tp.tnnPct / 100)
  const udHs = r3(nen * (tp.udPct ?? 0) / 100)
  /** Tổng hệ số lương (mẫu nâng lương, cột 10 = 3+4+5+6+7+8+9) */
  const tong = r3(tp.heSo + tp.pcChucVu + (tp.pcTrachNhiem ?? 0) + vkHs + tnnHs + udHs + (tp.baoLuu ?? 0))
  /** Tổng hệ số lương và phụ cấp (mẫu thâm niên: hệ số + TNVK + PCCV + PCTN) */
  const tongTn = r3(tp.heSo + vkHs + tp.pcChucVu + tnnHs)
  return { vkHs, tnnHs, udHs, tong, tongTn }
}

/** Số tháng truy lĩnh: từ tháng hưởng đến tháng "tính đến", tính cả hai đầu */
export function soThangTruyLinh(thoiGianHuong: string, tinhDen: string): number {
  if (!ngayHopLe(thoiGianHuong) || !ngayHopLe(tinhDen)) return 0
  const [y1, m1] = thoiGianHuong.split('-').map(Number)
  const [y2, m2] = tinhDen.split('-').map(Number)
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) + 1)
}

export const chenhLechLuong = (d: DongTruyLinhLuong) => r3(tinhHeSo(d.moi).tong - tinhHeSo(d.cu).tong)
export const truyLinhLuong = (d: DongTruyLinhLuong) => r3(chenhLechLuong(d) * d.soThang)
export const chenhLechPctn = (d: DongTruyLinhPctn) => r3(tinhHeSo(d.moi).tongTn - tinhHeSo(d.cu).tongTn)
export const truyLinhPctn = (d: DongTruyLinhPctn) => r3(chenhLechPctn(d) * d.soThang)

export function tongBang(b: Pick<BangTruyLinh, 'luong' | 'pctn'>) {
  const luong = r3(b.luong.reduce((s, d) => s + truyLinhLuong(d), 0))
  const pctn = r3(b.pctn.reduce((s, d) => s + truyLinhPctn(d), 0))
  return { luong, pctn, tong: r3(luong + pctn) }
}

/** "24n1th": thời gian từ tháng bắt đầu đóng BHXH trong ngành đến ngày tính (tính cả hai đầu) */
export function thamNienTu(batDauBhxh: string | undefined, tinhDen: string): string | undefined {
  if (!batDauBhxh || !/^\d{4}-\d{2}/.test(batDauBhxh)) return undefined
  const [y1, m1] = batDauBhxh.split('-').map(Number)
  const [y2, m2] = tinhDen.split('-').map(Number)
  const thang = (y2 - y1) * 12 + (m2 - m1) + 1
  if (thang <= 0) return undefined
  const n = Math.floor(thang / 12)
  const t = thang % 12
  return t ? `${n}n${t}th` : `${n}n`
}

// ───────────────────────────── Lập bảng từ phiếu đã phê duyệt ─────────────────────────────

export interface DuLieuLapBang {
  donViId: string
  nam: number
  ky: KyTruyLinh
  tinhDen: string
  deXuats: DeXuatLuong[]
  vienChucs: VienChuc[]
  chucDanhs: ChucDanhNgheNghiep[]
  bacLuongs: BacLuong[]
  loaiPhuCaps: LoaiPhuCap[]
  phuCaps: PhuCapVienChuc[]
  heSoLuongs: HeSoLuong[]
}

const LOAI_LUONG = ['NANG_BAC', 'NANG_TRUOC_HAN'] as const
const LOAI_PCTN = ['PHU_CAP_THAM_NIEN', 'PCTN_LAN_DAU'] as const

/**
 * Danh sách truy lĩnh của một đơn vị trong kỳ: các dòng phiếu ĐÃ PHÊ DUYỆT có thời gian hưởng trong kỳ
 * (người Phòng VHXH không đồng ý thì bỏ). Phụ cấp không đổi (chức vụ, trách nhiệm, ưu đãi, bảo lưu) lấy theo hồ sơ.
 * Người vừa nâng lương vừa nâng thâm niên trong kỳ: danh sách PCTN tính trên lương đã nâng nếu nâng lương hưởng
 * trước hoặc cùng tháng; danh sách nâng lương chỉ dùng mức PCTN mới nếu PCTN hưởng trước - tổng hai danh sách
 * đúng bằng phần tăng thực tế, không tính trùng.
 */
export function lapDongTruyLinh(d: DuLieuLapBang): { luong: DongTruyLinhLuong[]; pctn: DongTruyLinhPctn[] } {
  const { tu, den } = khoangKy(d.nam, d.ky)
  const trongKy = (ngay?: string) => !!ngay && ngay >= tu && ngay <= den
  const vcTheoId = new Map(d.vienChucs.map((v) => [v.id, v]))
  const maNgach = (id: string) => d.chucDanhs.find((c) => c.id === id)?.ma ?? ''
  const loai = (ma: string) => d.loaiPhuCaps.find((l) => l.ma === ma)
  const pcDangHuong = (vcId: string, du: (l: LoaiPhuCap) => boolean) => {
    const ids = new Set(d.loaiPhuCaps.filter(du).map((l) => l.id))
    const rec = chonBanDangHuong(d.phuCaps.filter((p) => p.vienChucId === vcId && p.isActive && ids.has(p.loaiPhuCapId)))
    if (!rec) return 0
    return rec.giaTri > 0 ? rec.giaTri : d.loaiPhuCaps.find((l) => l.id === rec.loaiPhuCapId)?.giaTri ?? 0
  }
  const khoanCoDinh = (vc: VienChuc) => {
    const hsl = d.heSoLuongs.find((h) => h.vienChucId === vc.id && h.isActive)
    return {
      pcChucVu: pccvThucHuong(vc, pcDangHuong(vc.id, (l) => l.ma === 'PC_CHUC_VU')),
      pcTrachNhiem: pcDangHuong(vc.id, (l) => l.ma === 'PC_TRACH_NHIEM'),
      udPct: pcDangHuong(vc.id, (l) => l.ma.startsWith('PCUD')),
      baoLuu: pcDangHuong(vc.id, (l) => l.ma === 'PC_BAO_LUU') || (hsl?.heSoBaoLuu ?? 0),
      vkPct: loai('PC_THAM_NIEN_VK') ? pcDangHuong(vc.id, (l) => l.ma === 'PC_THAM_NIEN_VK') : 0,
      tnnPct: pcDangHuong(vc.id, (l) => l.ma === 'PC_THAM_NIEN'),
      hsl,
    }
  }

  type Dong = { dx: DeXuatLuong; ct: ChiTietDeXuat }
  const daDuyet = d.deXuats.filter((x) => x.donViId === d.donViId && x.trangThai === 'DA_PHE_DUYET')
  const lay = (cacLoai: readonly string[]): Dong[] => daDuyet
    .filter((x) => cacLoai.includes(x.loai))
    .flatMap((dx) => dx.chiTiet.filter((ct) => ct.thamDinh !== 'KHONG_DONG_Y' && trongKy(ct.ngayHieuLuc)).map((ct) => ({ dx, ct })))
  const dongLuong = lay(LOAI_LUONG)
  const dongPctn = lay(LOAI_PCTN)

  const luong: DongTruyLinhLuong[] = []
  for (const { dx, ct } of dongLuong) {
    const vc = vcTheoId.get(ct.vienChucId)
    if (!vc) continue
    const k = khoanCoDinh(vc)
    // PCTN trong kỳ: hưởng TRƯỚC tháng nâng lương thì dùng mức mới; cùng tháng hoặc sau thì dùng mức cũ (phần tăng
    // thâm niên nằm ở danh sách PCTN, tính trên lương đã nâng) - hai danh sách cộng lại đúng phần tăng thực tế
    const p = dongPctn.find((x) => x.ct.vienChucId === vc.id)?.ct
    const tnn = p ? (p.ngayHieuLuc < ct.ngayHieuLuc ? p.pctnMoi ?? 0 : p.pctnCu ?? 0) : (ct.pctnCu ?? k.tnnPct)
    const vk = laDongVuotKhung(ct)
    const chung = { pcChucVu: k.pcChucVu, pcTrachNhiem: k.pcTrachNhiem, tnnPct: tnn, udPct: k.udPct, baoLuu: k.baoLuu }
    const tg = vk ? 1 : thoiGianNangBac(ct.chucDanhMoiId, ct.bacMoi, d.bacLuongs, d.chucDanhs)
    luong.push({
      vienChucId: vc.id,
      hoTen: vietHoaDauTu(`${vc.ho} ${vc.ten}`),
      deXuatId: dx.id,
      deXuatMa: dx.ma,
      loai: vk ? 'VUOT_KHUNG' : dx.loai === 'NANG_TRUOC_HAN' ? 'TRUOC_HAN' : 'NANG_BAC',
      cu: { maNgach: maNgach(ct.chucDanhCuId), bac: ct.bacCu, heSo: Number(ct.heSoCu), vkPct: vk ? ct.tnvkCu ?? 0 : 0, ...chung },
      moi: { maNgach: maNgach(ct.chucDanhMoiId), bac: ct.bacMoi, heSo: Number(ct.heSoMoi), vkPct: vk ? ct.tnvkMoi ?? 0 : 0, ...chung },
      thoiGianHuong: ct.ngayHieuLuc,
      mocLanSau: congNam(ct.ngayHieuLuc, tg),
      soThang: soThangTruyLinh(ct.ngayHieuLuc, d.tinhDen),
    })
  }

  const pctn: DongTruyLinhPctn[] = []
  for (const { dx, ct } of dongPctn) {
    const vc = vcTheoId.get(ct.vienChucId)
    if (!vc) continue
    const k = khoanCoDinh(vc)
    // Nâng lương (kể cả vượt khung) trong kỳ hưởng trước hoặc cùng tháng: lương được nâng tính trên mức mới
    const n = dongLuong.find((x) => x.ct.vienChucId === vc.id)?.ct
    const truoc = n && n.ngayHieuLuc <= ct.ngayHieuLuc
    const bac = n ? (truoc ? n.bacMoi : n.bacCu) : (ct.bacCu ?? k.hsl?.bac ?? null)
    const heSo = Number(n ? (truoc ? n.heSoMoi : n.heSoCu) : (ct.heSoCu ?? k.hsl?.heSo ?? 0))
    const vkPct = n && laDongVuotKhung(n) ? (truoc ? n.tnvkMoi ?? 0 : n.tnvkCu ?? 0) : k.vkPct
    const lanDau = dx.loai === 'PCTN_LAN_DAU'
    pctn.push({
      vienChucId: vc.id,
      hoTen: vietHoaDauTu(`${vc.ho} ${vc.ten}`),
      ngaySinh: vc.ngaySinh,
      gioiTinh: vc.gioiTinh,
      thamNien: thamNienTu(vc.batDauBhxhGd, d.tinhDen),
      deXuatId: dx.id,
      deXuatMa: dx.ma,
      maNgach: maNgach(ct.chucDanhMoiId || ct.chucDanhCuId),
      cu: { bac, heSo, vkPct, pcChucVu: k.pcChucVu, tnnPct: lanDau ? 0 : ct.pctnCu ?? 0 },
      moi: { bac, heSo, vkPct, pcChucVu: k.pcChucVu, tnnPct: ct.pctnMoi ?? 0 },
      mocCu: lanDau ? undefined : congNam(ct.ngayHieuLuc, -1),
      thoiGianHuong: ct.ngayHieuLuc,
      mocLanSau: congNam(ct.ngayHieuLuc, 1),
      soThang: soThangTruyLinh(ct.ngayHieuLuc, d.tinhDen),
      ...(lanDau ? { ghiChu: 'Xếp PCTN lần đầu' } : {}),
    })
  }

  const sx = <T extends { thoiGianHuong: string; hoTen: string }>(a: T, b: T) =>
    a.thoiGianHuong.localeCompare(b.thoiGianHuong) || a.hoTen.localeCompare(b.hoTen, 'vi')
  return { luong: luong.sort(sx), pctn: pctn.sort(sx) }
}

// ───────────────────────────── Đọc số thành chữ ─────────────────────────────

const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

function docBaChuSo(n: number, dayDu: boolean): string {
  const tr = Math.floor(n / 100)
  const ch = Math.floor((n % 100) / 10)
  const dv = n % 10
  const ra: string[] = []
  if (tr || dayDu) ra.push(`${CHU_SO[tr]} trăm`)
  if (ch > 1) ra.push(`${CHU_SO[ch]} mươi`)
  else if (ch === 1) ra.push('mười')
  else if (dv && (tr || dayDu)) ra.push('linh')
  if (dv) ra.push(dv === 1 && ch > 1 ? 'mốt' : dv === 5 && ch >= 1 ? 'lăm' : dv === 4 && ch > 1 ? 'tư' : CHU_SO[dv])
  return ra.join(' ')
}

/** Đọc số nguyên thành chữ (đến hàng tỷ) */
export function docSoNguyen(n: number): string {
  if (n === 0) return 'không'
  const nhom = ['', ' nghìn', ' triệu', ' tỷ']
  const phan: string[] = []
  let i = 0
  let x = Math.floor(Math.abs(n))
  const cacNhom: number[] = []
  while (x > 0) { cacNhom.push(x % 1000); x = Math.floor(x / 1000) }
  for (i = cacNhom.length - 1; i >= 0; i--) {
    if (!cacNhom[i]) continue
    phan.push(docBaChuSo(cacNhom[i], i < cacNhom.length - 1) + nhom[i])
  }
  return phan.join(' ')
}

/** "19,894" → "Mười chín, tám chín tư" (phần lẻ đọc từng chữ số như mẫu truy lĩnh) */
export function docHeSo(n: number): string {
  const [nguyen, le = ''] = r3(n).toFixed(3).replace(/0+$/, '').replace(/\.$/, '').split('.')
  const docLe = le.split('').map((c, i, a) => (c === '4' && i === a.length - 1 && a.length > 1 ? 'tư' : CHU_SO[Number(c)])).join(' ')
  const chu = docSoNguyen(Number(nguyen)) + (le ? `, ${docLe}` : '')
  return chu.charAt(0).toLocaleUpperCase('vi') + chu.slice(1)
}

// ───────────────────────────── Xuất Excel theo mẫu ─────────────────────────────

export interface ThongTinKy {
  tenDonVi: string
  /** Thủ trưởng đơn vị (Hiệu trưởng…) */
  thuTruong?: string
  /** Trưởng phòng Văn hóa - Xã hội (xác nhận của UBND phường) */
  truongPhong?: string
}

const thangNam = (d?: string) => (d && ngayHopLe(d) ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : '')
const ngayVn = (d?: string) => (d && ngayHopLe(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '')
const so = (n: number) => (n ? n : '')

function khoiKy(soCot: number, cotPhai: number, ky: ThongTinKy, nam: number): O[][] {
  const hang = (trai: O, phai: O) => { const r: O[] = Array(soCot).fill(null); r[0] = trai; r[cotPhai] = phai; return r }
  return [
    hang(null, `Gia Viên, ngày     tháng     năm ${nam}`),
    hang('XÁC NHẬN UBND PHƯỜNG', 'THỦ TRƯỞNG ĐƠN VỊ'),
    hang('TUQ. CHỦ TỊCH', null),
    hang('TRƯỞNG PHÒNG VĂN HÓA - XÃ HỘI', null),
    [], [], [],
    hang(vietHoaDauTu(ky.truongPhong) || null, vietHoaDauTu(ky.thuTruong) || null),
  ]
}

/** Hai trang tính như mẫu: "Nâng lương" và "Nâng thâm niên" */
export function xuatExcelTruyLinh(b: BangTruyLinh, ky: ThongTinKy) {
  const tenKy = `${TEN_KY_TRUY_LINH[b.ky].toUpperCase()} ${b.nam}`
  const tinhDen = `(Tính đến ngày ${ngayVn(b.tinhDen)})`
  const dauTrang = (soCot: number, cotPhai: number, tieuDe: string): O[][] => {
    const hang = (trai: O, phai: O) => { const r: O[] = Array(soCot).fill(null); r[0] = trai; r[cotPhai] = phai; return r }
    return [
      hang('UBND PHƯỜNG GIA VIÊN', 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM'),
      hang(ky.tenDonVi.toUpperCase(), 'Độc lập - Tự do - Hạnh phúc'),
      [],
      [tieuDe],
      [tinhDen],
      [],
    ]
  }
  const g = (r1: number, c1: number, r2: number, c2: number) => ({ r1, c1, r2, c2 })
  const trangs: TrangA4[] = []

  // ── Trang 1: truy lĩnh nâng lương ──
  {
    const N = 27
    const dau = dauTrang(N, 14, `DANH SÁCH TRUY LĨNH NÂNG LƯƠNG ${tenKy}`)
    const td: O[][] = [
      ['TT', 'HỌ VÀ TÊN', 'Lương đang hưởng', ...Array(11).fill(null), 'Lương mới', ...Array(11).fill(null),
        'Thời gian hưởng', 'Mốc xét nâng lương lần sau', 'Hệ số lương chênh lệch', 'Số tháng truy lĩnh', 'Tổng hệ số truy lĩnh'],
      [null, null, 'Mã số ngạch', 'Bậc', 'Hệ số lương', 'PC chức vụ', 'Phụ cấp trách nhiệm', 'Phụ cấp thâm niên nghề VK', null, 'Phụ cấp thâm niên nghề', null, 'Phụ cấp ưu đãi', 'Bảo lưu', 'Tổng hệ số lương',
        'Mã số ngạch', 'Bậc', 'Hệ số lương', 'PC chức vụ', 'Phụ cấp trách nhiệm', 'Phụ cấp thâm niên nghề VK', null, 'Phụ cấp thâm niên nghề', null, 'Phụ cấp ưu đãi', 'Bảo lưu', 'Tổng hệ số lương',
        null, null, null, null, null],
      [null, null, null, null, null, null, null, '%', 'Hệ số', '%', 'Hệ số', null, null, null,
        null, null, null, null, null, '%', 'Hệ số', '%', 'Hệ số', null, null, null, null, null, null, null, null],
      ['A', 'B', 1, 2, 3, 4, 5, 6, null, 7, null, 8, 9, '10=3+4+5+6+7+8+9',
        11, 12, 13, 14, 15, 16, null, 17, null, 18, 19, '20=13+14+15+16+17+18+19', 21, 22, '23=20-10', 24, '25=23x24'],
    ]
    const soCot = td[0].length // 31
    const than: O[][] = b.luong.map((d, i) => {
      const c = tinhHeSo(d.cu)
      const m = tinhHeSo(d.moi)
      return [i + 1, d.hoTen,
        d.cu.maNgach, d.cu.bac ?? '', d.cu.heSo, so(d.cu.pcChucVu), so(d.cu.pcTrachNhiem), d.cu.vkPct ? d.cu.vkPct / 100 : '', so(c.vkHs), d.cu.tnnPct ? d.cu.tnnPct / 100 : '', so(c.tnnHs), so(c.udHs), so(d.cu.baoLuu), c.tong,
        d.moi.maNgach, d.moi.bac ?? '', d.moi.heSo, so(d.moi.pcChucVu), so(d.moi.pcTrachNhiem), d.moi.vkPct ? d.moi.vkPct / 100 : '', so(m.vkHs), d.moi.tnnPct ? d.moi.tnnPct / 100 : '', so(m.tnnHs), so(m.udHs), so(d.moi.baoLuu), m.tong,
        thangNam(d.thoiGianHuong), thangNam(d.mocLanSau), chenhLechLuong(d), d.soThang, truyLinhLuong(d)]
    })
    const tong = tongBang(b).luong
    const dongCong: O[] = [null, 'Cộng', ...Array(soCot - 2).fill(null)]
    const cuoi: O[][] = [
      [],
      [`- Số người được truy lĩnh: ${b.luong.length} người`],
      [`- Tổng hệ số truy lĩnh: ${tong.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} (${docHeSo(tong)})`],
      ...khoiKy(soCot, 16, ky, b.nam),
    ]
    const dong: O[][] = [...dau, ...td, ...than, dongCong, ...cuoi]
    const bdTd = dau.length
    const bdThan = bdTd + td.length
    const rThan = than.map((_, i) => bdThan + i)
    const rCong = bdThan + than.length
    // Công thức như mẫu: hệ số TNVK, TNN, ưu đãi, tổng, chênh lệch, truy lĩnh
    for (const [cHs, cCv, cTn, cVkP, cVkH, cTnP, cTnH, cUd, cBl, cTong] of [[4, 5, 6, 7, 8, 9, 10, 11, 12, 13], [16, 17, 18, 19, 20, 21, 22, 23, 24, 25]]) {
      ganCotTinh(dong, cVkH, rThan, (o) => `ROUND(${o(cHs)}*${o(cVkP)},3)`, (s) => r3(s(cHs) * s(cVkP)))
      ganCotTinh(dong, cTnH, rThan, (o) => `ROUND((${o(cHs)}+${o(cVkH)}+${o(cCv)})*${o(cTnP)},3)`, (s) => r3((s(cHs) + s(cVkH) + s(cCv)) * s(cTnP)))
      ganCotTinh(dong, cTong, rThan, (o) => `ROUND(${[cHs, cCv, cTn, cVkH, cTnH, cUd, cBl].map(o).join('+')},3)`,
        (s) => r3([cHs, cCv, cTn, cVkH, cTnH, cUd, cBl].reduce((t, x) => t + s(x), 0)))
    }
    ganCotTinh(dong, 28, rThan, (o) => `ROUND(${o(25)}-${o(13)},3)`, (s) => r3(s(25) - s(13)))
    ganCotTinh(dong, 30, rThan, (o) => `ROUND(${o(28)}*${o(29)},3)`, (s) => r3(s(28) * s(29)))
    ganDongTong(dong, rCong, rThan, [4, 5, 6, 8, 10, 11, 12, 13, 16, 17, 18, 20, 22, 23, 24, 25, 28, 29, 30])
    const dinhDangO: Record<string, string> = {}
    for (const r of rThan) for (const c of [7, 9, 19, 21]) if (typeof dong[r][c] === 'number') dinhDangO[`${r}:${c}`] = '0%'
    trangs.push({
      ten: 'Nâng lương',
      dong,
      dinhDangO,
      gop: [
        g(0, 0, 0, 5), g(1, 0, 1, 5), g(0, 14, 0, soCot - 1), g(1, 14, 1, soCot - 1),
        g(bdTd, 0, bdTd + 2, 0), g(bdTd, 1, bdTd + 2, 1), g(bdTd, 2, bdTd, 13), g(bdTd, 14, bdTd, 25),
        ...[26, 27, 28, 29].map((c) => g(bdTd, c, bdTd + 2, c)),
        ...[2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16, 17, 18, 23, 24, 25].map((c) => g(bdTd + 1, c, bdTd + 2, c)),
        g(bdTd + 1, 7, bdTd + 1, 8), g(bdTd + 1, 9, bdTd + 1, 10), g(bdTd + 1, 19, bdTd + 1, 20), g(bdTd + 1, 21, bdTd + 1, 22),
        g(bdTd + 3, 7, bdTd + 3, 8), g(bdTd + 3, 9, bdTd + 3, 10), g(bdTd + 3, 19, bdTd + 3, 20), g(bdTd + 3, 21, bdTd + 3, 22),
        ...[5, 6, 7, 11].map((k) => g(rCong + k, 0, rCong + k, 9)),
        ...[4, 5, 6, 7, 11].map((k) => g(rCong + k, 16, rCong + k, soCot - 1)),
      ],
      rongCot: [4, 20, 9, 4, 6, 5, 5, 4, 5, 4, 5, 5, 5, 6, 9, 4, 6, 5, 5, 4, 5, 4, 5, 5, 5, 6, 7, 7, 7, 6, 7],
      bang: [{ tu: bdTd, den: rCong, soDongTieuDe: td.length, soCot }],
      tieuDe: [3, 4],
      dam: [1, rCong, rCong + 5, rCong + 6, rCong + 7, rCong + 11],
      nghieng: [rCong + 4],
      giua: [0, 1, rCong + 4, rCong + 5, rCong + 6, rCong + 7, rCong + 11],
      cotGiua: [0, 2, 3, 14, 15, 26, 27, 29],
      soLe: 3,
      huong: 'ngang',
      coChu: 10,
    })
  }

  // ── Trang 2: truy lĩnh nâng phụ cấp thâm niên nhà giáo (Mẫu 1b-PCTNNG) ──
  {
    const dau: O[][] = [
      ['UBND PHƯỜNG GIA VIÊN', ...Array(8).fill(null), 'Mẫu 1b-PCTNNG'],
      [ky.tenDonVi.toUpperCase()],
      [],
      [`DANH SÁCH TRUY LĨNH NÂNG PHỤ CẤP THÂM NIÊN NHÀ GIÁO ${tenKy}`],
      [tinhDen],
      [],
    ]
    const td: O[][] = [
      ['STT', 'Họ và tên', 'Ngày tháng năm sinh', null, `Tổng số năm thực tế giảng dạy, có tham gia BHXH (đến ${ngayVn(b.tinhDen)})`, 'Lương đã hưởng', ...Array(9).fill(null), 'Lương được nâng', ...Array(9).fill(null), 'Tổng hệ số chênh lệch', 'Tổng số tháng được truy lĩnh phụ cấp thâm niên nhà giáo', 'Tổng hệ số phụ cấp thâm niên nhà giáo được truy lĩnh'],
      [null, null, 'Nam', 'Nữ', null, 'Mã chức danh nghề nghiệp', 'Bậc', 'Hệ số', 'Tỷ lệ phụ cấp thâm niên VK', 'Phụ cấp thâm niên vượt khung', 'Hệ số phụ cấp chức vụ lãnh đạo', 'Tỷ lệ phụ cấp thâm niên', 'Phụ cấp thâm niên nhà giáo', 'Tổng hệ số lương và phụ cấp', 'Mốc tính hưởng phụ cấp thâm niên nhà giáo',
        'Bậc', 'Hệ số', 'Tỷ lệ phụ cấp thâm niên VK', 'Phụ cấp thâm niên vượt khung', 'Hệ số phụ cấp chức vụ lãnh đạo', 'Tỷ lệ phụ cấp thâm niên', 'Phụ cấp thâm niên nhà giáo', 'Tổng hệ số lương và phụ cấp', 'Mốc xét thâm niên lần sau', 'Thời gian hưởng', null, null, null],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, '26=23-14', 27, '28=26x27'],
    ]
    const soCot = td[0].length // 28
    const than: O[][] = b.pctn.map((d, i) => {
      const c = tinhHeSo(d.cu)
      const m = tinhHeSo(d.moi)
      return [i + 1, d.hoTen, d.gioiTinh === 'NAM' ? ngayVn(d.ngaySinh) : '', d.gioiTinh === 'NAM' ? '' : ngayVn(d.ngaySinh), d.thamNien ?? '',
        d.maNgach, d.cu.bac ?? '', d.cu.heSo, d.cu.vkPct ? d.cu.vkPct / 100 : '', so(c.vkHs), so(d.cu.pcChucVu), d.cu.tnnPct ? d.cu.tnnPct / 100 : '', so(c.tnnHs), c.tongTn, thangNam(d.mocCu),
        d.moi.bac ?? '', d.moi.heSo, d.moi.vkPct ? d.moi.vkPct / 100 : '', so(m.vkHs), so(d.moi.pcChucVu), d.moi.tnnPct ? d.moi.tnnPct / 100 : '', so(m.tnnHs), m.tongTn, thangNam(d.mocLanSau), thangNam(d.thoiGianHuong),
        chenhLechPctn(d), d.soThang, truyLinhPctn(d)]
    })
    const tong = tongBang(b).pctn
    const dongCong: O[] = [null, 'Tổng', ...Array(soCot - 2).fill(null)]
    const cuoi: O[][] = [
      [],
      [`* Tổng số người nâng phụ cấp thâm niên: ${b.pctn.length} người`],
      [`* Tổng hệ số phụ cấp thâm niên nhà giáo truy lĩnh (tính đến ${ngayVn(b.tinhDen)}): ${tong.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} (${docHeSo(tong)})`],
      ...khoiKy(soCot, 15, ky, b.nam),
    ]
    const dong: O[][] = [...dau, ...td, ...than, dongCong, ...cuoi]
    const bdTd = dau.length
    const bdThan = bdTd + td.length
    const rThan = than.map((_, i) => bdThan + i)
    const rCong = bdThan + than.length
    for (const [cHs, cVkP, cVkH, cCv, cTnP, cTnH, cTong] of [[7, 8, 9, 10, 11, 12, 13], [16, 17, 18, 19, 20, 21, 22]]) {
      ganCotTinh(dong, cVkH, rThan, (o) => `ROUND(${o(cHs)}*${o(cVkP)},3)`, (s) => r3(s(cHs) * s(cVkP)))
      ganCotTinh(dong, cTnH, rThan, (o) => `ROUND((${o(cHs)}+${o(cVkH)}+${o(cCv)})*${o(cTnP)},3)`, (s) => r3((s(cHs) + s(cVkH) + s(cCv)) * s(cTnP)))
      ganCotTinh(dong, cTong, rThan, (o) => `ROUND(${[cHs, cVkH, cCv, cTnH].map(o).join('+')},3)`, (s) => r3(s(cHs) + s(cVkH) + s(cCv) + s(cTnH)))
    }
    ganCotTinh(dong, 25, rThan, (o) => `ROUND(${o(22)}-${o(13)},3)`, (s) => r3(s(22) - s(13)))
    ganCotTinh(dong, 27, rThan, (o) => `ROUND(${o(25)}*${o(26)},3)`, (s) => r3(s(25) * s(26)))
    ganDongTong(dong, rCong, rThan, [7, 9, 10, 12, 13, 16, 18, 19, 21, 22, 25, 27])
    const dinhDangO: Record<string, string> = {}
    for (const r of rThan) for (const c of [8, 11, 17, 20]) if (typeof dong[r][c] === 'number') dinhDangO[`${r}:${c}`] = '0%'
    trangs.push({
      ten: 'Nâng thâm niên',
      dong,
      dinhDangO,
      gop: [
        g(0, 0, 0, 5), g(1, 0, 1, 5), g(0, 9, 0, soCot - 1),
        g(bdTd, 0, bdTd + 1, 0), g(bdTd, 1, bdTd + 1, 1), g(bdTd, 2, bdTd, 3), g(bdTd, 4, bdTd + 1, 4),
        g(bdTd, 5, bdTd, 14), g(bdTd, 15, bdTd, 24), ...[25, 26, 27].map((c) => g(bdTd, c, bdTd + 1, c)),
        ...[5, 6, 7, 11].map((k) => g(rCong + k, 0, rCong + k, 9)),
        ...[4, 5, 6, 7, 11].map((k) => g(rCong + k, 15, rCong + k, soCot - 1)),
      ],
      rongCot: [4, 20, 9, 9, 9, 9, 4, 6, 6, 6, 6, 6, 6, 7, 7, 4, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 8],
      bang: [{ tu: bdTd, den: rCong, soDongTieuDe: td.length, soCot }],
      tieuDe: [3, 4],
      dam: [1, rCong, rCong + 5, rCong + 6, rCong + 7, rCong + 11],
      nghieng: [rCong + 4],
      giua: [0, 1, rCong + 4, rCong + 5, rCong + 6, rCong + 7, rCong + 11],
      cotGiua: [0, 2, 3, 4, 5, 6, 14, 15, 23, 24, 26],
      soLe: 3,
      huong: 'ngang',
      coChu: 10,
    })
  }

  const tenFile = `TruyLinh_${ky.tenDonVi.replace(/[\\/:*?"<>|\s]+/g, '-')}_${b.ky}-${b.nam}`
  return xuatExcelA4(tenFile, trangs)
}
