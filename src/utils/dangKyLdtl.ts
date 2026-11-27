import type { VienChuc } from '@/types/vienChuc'
import { IS_BIEN_CHE, duocTinhSoLieu, nhanLuongTheoTien } from '@/types/vienChuc'
import type { ChucDanhNgheNghiep, LoaiPhuCap } from '@/types/danhMuc'
import type { HeSoLuong, PhuCapVienChuc } from '@/types/luong'
import type { ChiTieuDangKy, DangKyLdtl, DongDangKy, KyDangKy } from '@/types/dangKyLdtl'
import { CHI_TIEU_RONG, TEN_KY_DANG_KY, khoangKyDangKy } from '@/types/dangKyLdtl'
import { buildRow } from '@/utils/dongLuongNguoi'
import { calcPensionStartDate } from '@/utils/retirement'
import { soSanhVienChuc, vietHoaDauTu } from '@/utils/helpers'
import { docHeSo } from '@/utils/truyLinh'
import { lamTronExcel, ganCotTinh, ganDongTong, xuatExcelA4 } from '@/utils/excelA4'
import type { O, TrangA4 } from '@/utils/excelA4'

const r3 = (n: number) => lamTronExcel(n, 3)

// ───────────────────────────── Lập danh sách từ hồ sơ ─────────────────────────────

export interface DuLieuLapDangKy {
  donViId: string
  nam: number
  ky: KyDangKy
  vienChucs: VienChuc[]
  heSos: HeSoLuong[]
  phuCaps: PhuCapVienChuc[]
  loaiPhuCaps: LoaiPhuCap[]
  chucDanhs: ChucDanhNgheNghiep[]
}

/**
 * Người đang hưởng lương của đơn vị với hệ số lương, phụ cấp hiện hưởng trong hồ sơ (cùng cách tính Bảng tổng hợp lương).
 * Biên chế xếp trước (CBQL → giáo viên → nhân viên), hợp đồng sau. Người đến tuổi nghỉ hưu trong kỳ được ghi chú.
 */
export function lapDongDangKy(d: DuLieuLapDangKy): DongDangKy[] {
  const { tu, den } = khoangKyDangKy(d.nam, d.ky)
  const nhom = (v: VienChuc) => d.chucDanhs.find((c) => c.id === v.chucDanhId)?.nhom
  const theoVtvl = soSanhVienChuc<VienChuc>(nhom)
  const ds = d.vienChucs
    .filter((v) => duocTinhSoLieu(v) && v.donViId === d.donViId)
    .sort((a, b) => Number(IS_BIEN_CHE[b.loaiLaoDong] ?? false) - Number(IS_BIEN_CHE[a.loaiLaoDong] ?? false) || theoVtvl(a, b))
  return ds.map((v, i) => {
    const r = buildRow(i + 1, v, d.heSos, d.phuCaps, d.loaiPhuCaps, d.chucDanhs)
    const ghiChu: string[] = []
    if (v.ngaySinh && v.gioiTinh) {
      const huu = calcPensionStartDate(v.ngaySinh, v.gioiTinh)
      const ngay = `${huu.getFullYear()}-${String(huu.getMonth() + 1).padStart(2, '0')}-${String(huu.getDate()).padStart(2, '0')}`
      if (ngay >= tu && ngay <= den) ghiChu.push(`Nghỉ hưu từ ${ngay.slice(5, 7)}/${ngay.slice(0, 4)}`)
    }
    if (nhanLuongTheoTien(v) && v.mucLuongTien) ghiChu.push(`Lương ${v.mucLuongTien.toLocaleString('vi-VN')} đ/tháng`)
    return {
      vienChucId: v.id,
      hoTen: vietHoaDauTu(r.hoTen),
      ngaySinh: v.ngaySinh,
      gioiTinh: v.gioiTinh,
      chucVu: r.chucVuHienThi,
      trinhDo: v.trinhDoChuyenMon,
      bienChe: !!IS_BIEN_CHE[v.loaiLaoDong],
      maCdnn: r.maCDNN,
      bac: r.bac === '' ? null : r.bac,
      heSo: Number(r.heSo) || 0,
      vkPct: r.vkPct,
      vkHs: r.vkHeSo,
      baoLuu: r.hsBaoLuu,
      thoiDiem: r.thoiDiem,
      pcChucVu: r.pcCV,
      pcTrachNhiem: r.pcTN,
      tnnPct: r.pcTNNG_Pct,
      tnnHs: r.pcTNNG_HeSo,
      mocTnn: r.mocTNNG,
      udHs: r.pcUD,
      pcCongVu: r.pcCongVu,
      mucLuongTien: r.mucLuongTien,
      ...(ghiChu.length ? { ghiChu: ghiChu.join('; ') } : {}),
    }
  })
}

// ───────────────────────────── Tính hệ số ─────────────────────────────

/** Tổng hệ số lương chính (mẫu: hệ số + PC TNVK + hệ số chênh lệch bảo lưu) */
export const tongLuongChinh = (x: DongDangKy) => r3(x.heSo + x.vkHs + x.baoLuu)
/** Tổng hệ số lương 1 tháng */
export const tongMotThang = (x: DongDangKy) => r3(tongLuongChinh(x) + x.pcChucVu + x.pcTrachNhiem + x.tnnHs + x.udHs + x.pcCongVu)

/** Số đăng ký kỳ này từ danh sách (hệ số, tiền cả 6 tháng) */
export function tinhDangKy(dong: DongDangKy[]): ChiTieuDangKy {
  const bc = dong.filter((x) => x.bienChe)
  const hd = dong.filter((x) => !x.bienChe)
  const tong6 = (ds: DongDangKy[], f: (x: DongDangKy) => number) => r3(ds.reduce((s, x) => s + f(x), 0) * 6)
  return {
    bienChe: bc.length,
    luongChinh: tong6(bc, (x) => x.heSo),
    pcChucVu: tong6(bc, (x) => x.pcChucVu),
    pcTrachNhiem: tong6(bc, (x) => x.pcTrachNhiem),
    pcUuDai: tong6(bc, (x) => x.udHs),
    pcThamNien: tong6(bc, (x) => x.tnnHs),
    pcTnvk: tong6(bc, (x) => x.vkHs),
    pcBaoLuu: tong6(bc, (x) => x.baoLuu),
    pcCongVu: tong6(bc, (x) => x.pcCongVu),
    hdSoNguoi: hd.length,
    hdHeSo: tong6(hd.filter((x) => !x.mucLuongTien), tongMotThang),
    hdTien: hd.reduce((s, x) => s + x.mucLuongTien, 0) * 6,
  }
}

/** Kế hoạch / thực hiện đầy đủ (ô trống = 0, hoặc = số đăng ký với thực hiện) */
export const dayDu = (p: Partial<ChiTieuDangKy>, macDinh: ChiTieuDangKy = CHI_TIEU_RONG): ChiTieuDangKy =>
  Object.fromEntries(Object.keys(CHI_TIEU_RONG).map((k) => [k, p[k as keyof ChiTieuDangKy] ?? macDinh[k as keyof ChiTieuDangKy]])) as unknown as ChiTieuDangKy

export type KhoaChiTieu = keyof ChiTieuDangKy
export const CAC_PHU_CAP: KhoaChiTieu[] = ['pcChucVu', 'pcTrachNhiem', 'pcUuDai', 'pcThamNien', 'pcTnvk', 'pcBaoLuu', 'pcCongVu']

/** Các dòng biểu tổng hợp (trang TH). `k` = ô nhập được; `tong` = dòng cộng */
export interface DongTongHop {
  ma: string
  ten: string
  k?: KhoaChiTieu
  tong?: KhoaChiTieu[]
  dam?: boolean
  /** Chỉ hiện khi có số (PC công vụ, hợp đồng hưởng hệ số) */
  anKhiRong?: boolean
  laTien?: boolean
  laNguoi?: boolean
}

export const DONG_TONG_HOP: DongTongHop[] = [
  { ma: 'I', ten: 'Biên chế', k: 'bienChe', dam: true, laNguoi: true },
  { ma: '1', ten: 'Lao động', k: 'bienChe', laNguoi: true },
  { ma: '2', ten: 'Tiền lương (Hệ số)', tong: ['luongChinh', ...CAC_PHU_CAP], dam: true },
  { ma: '2.1', ten: 'Lương chính', k: 'luongChinh' },
  { ma: '2.2', ten: 'Phụ cấp', tong: CAC_PHU_CAP },
  { ma: '', ten: ' - Chức vụ', k: 'pcChucVu' },
  { ma: '', ten: ' - Trách nhiệm', k: 'pcTrachNhiem' },
  { ma: '', ten: ' - Ưu đãi', k: 'pcUuDai' },
  { ma: '', ten: ' - Thâm niên nghề', k: 'pcThamNien' },
  { ma: '', ten: ' - Thâm niên vượt khung', k: 'pcTnvk' },
  { ma: '', ten: ' - Hệ số chênh lệch bảo lưu', k: 'pcBaoLuu' },
  { ma: '', ten: ' - Công vụ', k: 'pcCongVu', anKhiRong: true },
  { ma: 'II', ten: 'Hợp đồng', k: 'hdSoNguoi', dam: true, laNguoi: true },
  { ma: '1', ten: 'Hợp đồng khác', k: 'hdSoNguoi', laNguoi: true },
  { ma: '', ten: '- Số lao động', k: 'hdSoNguoi', laNguoi: true },
  { ma: '', ten: '- Tiền lương (hệ số)', k: 'hdHeSo', anKhiRong: true },
  { ma: '', ten: '- Tiền lương (tiền mặt)', k: 'hdTien', laTien: true },
]

export const giaTriDong = (ct: ChiTieuDangKy, d: DongTongHop) =>
  (d.tong ? r3(d.tong.reduce((s, k) => s + ct[k], 0)) : d.k ? ct[d.k] : 0)

/** Số liệu đủ 5 cột của biểu tổng hợp */
export function bieuTongHop(b: Pick<DangKyLdtl, 'dong' | 'keHoach' | 'thucHien'>) {
  const dk = tinhDangKy(b.dong)
  const kh = dayDu(b.keHoach)
  const th = dayDu(b.thucHien, dk)
  // Chưa nhập kế hoạch kỳ trước thì chưa tính tăng, giảm
  const coKeHoach = Object.values(b.keHoach ?? {}).some((v) => v != null)
  const dong = DONG_TONG_HOP
    .filter((d) => !d.anKhiRong || [dk, kh, th].some((c) => giaTriDong(c, d)))
    .map((d) => {
      const a = giaTriDong(kh, d)
      const t = giaTriDong(th, d)
      const lam = (n: number) => (d.laTien || d.laNguoi ? Math.round(n) : r3(n))
      return { ...d, keHoach: a, tang: coKeHoach ? lam(Math.max(t - a, 0)) : 0, giam: coKeHoach ? lam(Math.max(a - t, 0)) : 0, thucHien: t, dangKy: giaTriDong(dk, d) }
    })
  return { dk, kh, th, dong }
}

/** Tổng hệ số lương đăng ký (biên chế) */
export const tongHeSoDangKy = (ct: ChiTieuDangKy) => r3(ct.luongChinh + CAC_PHU_CAP.reduce((s, k) => s + ct[k], 0))

// ───────────────────────────── Xuất Excel theo mẫu ─────────────────────────────

export interface ThongTinKyDangKy {
  tenDonVi: string
  thuTruong?: string
  /** "HIỆU TRƯỞNG", "GIÁM ĐỐC"... */
  chucDanhThuTruong: string
  truongPhong?: string
}

const ngayVn = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '')
const so = (n: number) => (n ? n : '')

export function xuatExcelDangKy(b: DangKyLdtl, ky: ThongTinKyDangKy) {
  const tenKy = `${TEN_KY_DANG_KY[b.ky].toUpperCase()} ${b.nam}`
  const { tu, den } = khoangKyDangKy(b.nam, b.ky)
  const g = (r1: number, c1: number, r2: number, c2: number) => ({ r1, c1, r2, c2 })
  const trangs: TrangA4[] = []
  const bt = bieuTongHop(b)
  const tongHs = tongHeSoDangKy(bt.dk)
  const ngayKy = `Gia Viên, ngày     tháng     năm ${new Date().getFullYear()}`

  // ── Trang 1: biểu tổng hợp (TH) ──
  {
    const N = 8
    const hang = (vals: Record<number, O>): O[] => { const r: O[] = Array(N).fill(null); for (const [c, v] of Object.entries(vals)) r[Number(c)] = v; return r }
    const dau: O[][] = [
      hang({ 0: 'UBND PHƯỜNG GIA VIÊN', 4: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM' }),
      hang({ 0: ky.tenDonVi.toUpperCase(), 4: 'Độc lập - Tự do - Hạnh phúc' }),
      [],
      [`ĐĂNG KÝ LAO ĐỘNG TIỀN LƯƠNG ${tenKy}`],
      [],
    ]
    const td: O[][] = [
      ['STT', 'NỘI DUNG', 'ĐĂNG KÝ KỲ TRƯỚC', null, null, null, 'Đăng ký 6 tháng', 'Ghi chú'],
      [null, null, 'Kế hoạch được duyệt', 'Tăng trong kỳ', 'Giảm trong kỳ', 'Thực hiện', null, null],
    ]
    const than: O[][] = bt.dong.map((d) => [d.ma || null, d.ten, so(d.keHoach), so(d.tang), so(d.giam), so(d.thucHien), so(d.dangKy), null])
    const soBc = bt.dk.bienChe
    const soHd = bt.dk.hdSoNguoi
    const cuoi: O[][] = [
      [],
      [`Lao động: ${soBc + soHd} người (${soBc} biên chế${soHd ? `, ${soHd} hợp đồng` : ''})`],
      [`Tổng tiền lương: Hệ số: ${tongHs.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} (${docHeSo(tongHs)})${bt.dk.hdTien ? `; tiền mặt: ${bt.dk.hdTien.toLocaleString('vi-VN')} đồng` : ''}`],
      hang({ 1: 'XÁC NHẬN CỦA UBND PHƯỜNG', 5: ngayKy }),
      hang({ 1: 'TUQ. CHỦ TỊCH', 5: ky.chucDanhThuTruong }),
      hang({ 1: 'TRƯỞNG PHÒNG VĂN HÓA - XÃ HỘI' }),
      [], [], [],
      hang({ 1: vietHoaDauTu(ky.truongPhong) || null, 5: vietHoaDauTu(ky.thuTruong) || null }),
    ]
    const dong: O[][] = [...dau, ...td, ...than, ...cuoi]
    const bdTd = dau.length
    const rCuoi = bdTd + td.length + than.length
    const dinhDangO: Record<string, string> = {}
    bt.dong.forEach((d, i) => { if (d.laNguoi || d.laTien) for (let c = 2; c <= 6; c++) dinhDangO[`${bdTd + td.length + i}:${c}`] = '#,##0' })
    trangs.push({
      ten: 'TỔNG HỢP ĐK LĐTL',
      dong,
      dinhDangO,
      gop: [
        g(0, 0, 0, 3), g(1, 0, 1, 3), g(0, 4, 0, 7), g(1, 4, 1, 7), g(3, 0, 3, 7),
        g(bdTd, 0, bdTd + 1, 0), g(bdTd, 1, bdTd + 1, 1), g(bdTd, 2, bdTd, 5), g(bdTd, 6, bdTd + 1, 6), g(bdTd, 7, bdTd + 1, 7),
        g(rCuoi + 1, 0, rCuoi + 1, 7), g(rCuoi + 2, 0, rCuoi + 2, 7),
        ...[3, 4, 5, 9].map((k) => g(rCuoi + k, 1, rCuoi + k, 3)),
        ...[3, 4, 9].map((k) => g(rCuoi + k, 5, rCuoi + k, 7)),
      ],
      rongCot: [6, 30, 13, 11, 11, 13, 13, 10],
      bang: [{ tu: bdTd, den: rCuoi - 1, soDongTieuDe: td.length, soCot: N }],
      tieuDe: [3],
      dam: [0, 1, ...bt.dong.flatMap((d, i) => (d.dam ? [bdTd + td.length + i] : [])), rCuoi + 3, rCuoi + 4, rCuoi + 5, rCuoi + 9],
      nghieng: [],
      giua: [0, 1, rCuoi + 3, rCuoi + 4, rCuoi + 5, rCuoi + 9],
      cotGiua: [0],
      soLe: 3,
      huong: 'doc',
      coChu: 12,
    })
  }

  // ── Trang 2: danh sách hệ số lương (DS HSL) ──
  {
    const coCongVu = b.dong.some((x) => x.pcCongVu)
    const coGhiChu = b.dong.some((x) => x.ghiChu)
    // Chỉ số cột
    const C = { tt: 0, ten: 1, cv: 2, ma: 3, bac: 4, hs: 5, vkP: 6, vkH: 7, bl: 8, lc: 9, moc: 10, pccv: 11, pctn: 12, tnP: 13, tnH: 14, tnMoc: 15, ud: 16 }
    const cCvu = coCongVu ? 17 : -1
    const cT1 = coCongVu ? 18 : 17
    const cT6 = cT1 + 1
    const cGc = coGhiChu ? cT6 + 1 : -1
    const N = (coGhiChu ? cGc : cT6) + 1
    const hang = (vals: Record<number, O>): O[] => { const r: O[] = Array(N).fill(null); for (const [c, v] of Object.entries(vals)) if (Number(c) >= 0) r[Number(c)] = v; return r }
    const dau: O[][] = [
      hang({ 0: 'UBND PHƯỜNG GIA VIÊN', 7: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM' }),
      hang({ 0: ky.tenDonVi.toUpperCase(), 7: 'Độc lập - Tự do - Hạnh phúc' }),
      [],
      [`DANH SÁCH ĐĂNG KÝ LAO ĐỘNG TIỀN LƯƠNG ${tenKy}`],
      [`(Tính từ ngày ${ngayVn(tu)} đến hết ngày ${ngayVn(den)})`],
      [],
    ]
    const tieuDeTong6 = `Tổng hệ số lương ${TEN_KY_DANG_KY[b.ky]} ${b.nam}`
    const td: O[][] = [
      hang({ [C.tt]: 'Stt', [C.ten]: 'Họ và tên', [C.cv]: 'Chức vụ', [C.ma]: 'Lương đang hưởng', [cT6]: tieuDeTong6, [cGc]: 'Ghi chú' }),
      hang({
        [C.ma]: 'Mã số chức danh nghề nghiệp', [C.bac]: 'Bậc', [C.hs]: 'Hệ số', [C.vkP]: 'Phụ cấp TNVK', [C.bl]: 'Hệ số chênh lệch bảo lưu', [C.lc]: 'Tổng hệ số lương chính',
        [C.moc]: 'Thời điểm tính nâng bậc lương hoặc PCTNVK', [C.pccv]: 'Phụ cấp chức vụ', [C.pctn]: 'Phụ cấp trách nhiệm', [C.tnP]: 'Phụ cấp thâm niên nhà giáo',
        [C.ud]: 'Phụ cấp ưu đãi', [cCvu]: 'Phụ cấp công vụ', [cT1]: 'Tổng hệ số lương 1 tháng',
      }),
      hang({ [C.vkP]: '%', [C.vkH]: 'Hệ số', [C.tnP]: '%', [C.tnH]: 'Hệ số', [C.tnMoc]: 'Mốc xét nâng PC TNNG' }),
      Array.from({ length: N }, (_, i) => (i === 0 ? 'A' : i === 1 ? 'B' : i - 1)),
    ]
    const dongNguoi = (x: DongDangKy, i: number): O[] => hang({
      [C.tt]: i + 1, [C.ten]: x.hoTen,
      [C.cv]: x.chucVu, [C.ma]: x.maCdnn, [C.bac]: x.bac ?? '', [C.hs]: so(x.heSo),
      [C.vkP]: so(x.vkPct), [C.vkH]: so(x.vkHs), [C.bl]: so(x.baoLuu), [C.lc]: tongLuongChinh(x), [C.moc]: x.thoiDiem,
      [C.pccv]: so(x.pcChucVu), [C.pctn]: so(x.pcTrachNhiem), [C.tnP]: so(x.tnnPct), [C.tnH]: so(x.tnnHs), [C.tnMoc]: x.mocTnn,
      [C.ud]: so(x.udHs), [cCvu]: so(x.pcCongVu), [cT1]: tongMotThang(x), [cT6]: r3(tongMotThang(x) * 6), [cGc]: x.ghiChu ?? '',
    })
    const bc = b.dong.filter((x) => x.bienChe)
    const hd = b.dong.filter((x) => !x.bienChe)
    const than: O[][] = [...bc.map(dongNguoi)]
    const rNguoiBc = than.map((_, i) => i)
    let rHd: number[] = []
    let rTieuDeHd = -1
    if (hd.length) {
      rTieuDeHd = than.length
      than.push(hang({ [C.ten]: 'Hợp đồng' }))
      rHd = hd.map((_, i) => than.length + i)
      than.push(...hd.map(dongNguoi))
    }
    const dong: O[][] = [...dau, ...td, ...than]
    const bdThan = dau.length + td.length
    const rCongBc = dong.length
    dong.push(hang({ [C.ten]: hd.length ? `Cộng biên chế (${bc.length} người)` : `Tổng cộng (${bc.length} người)` }))
    const rCongHd = hd.length ? dong.length : -1
    if (hd.length) dong.push(hang({ [C.ten]: `Cộng hợp đồng (${hd.length} người)` }))
    const rCuoiBang = dong.length - 1
    const cuoi: O[][] = [
      [],
      hang({ [C.pctn]: ngayKy }),
      hang({ [C.ten]: 'NGƯỜI LẬP', [C.pctn]: ky.chucDanhThuTruong }),
      [], [], [], [],
      hang({ [C.ten]: '', [C.pctn]: vietHoaDauTu(ky.thuTruong) || null }),
    ]
    dong.push(...cuoi)
    const rTatCa = [...rNguoiBc, ...rHd].map((i) => bdThan + i)
    // Công thức như mẫu (ưu đãi lấy theo hồ sơ)
    ganCotTinh(dong, C.vkH, rTatCa, (o) => `ROUND(${o(C.hs)}*${o(C.vkP)}/100,3)`, (s) => r3(s(C.hs) * s(C.vkP) / 100))
    ganCotTinh(dong, C.lc, rTatCa, (o) => `ROUND(${o(C.hs)}+${o(C.vkH)}+${o(C.bl)},3)`, (s) => r3(s(C.hs) + s(C.vkH) + s(C.bl)))
    ganCotTinh(dong, C.tnH, rTatCa, (o) => `ROUND((${o(C.hs)}+${o(C.vkH)}+${o(C.pccv)})*${o(C.tnP)}/100,3)`, (s) => r3((s(C.hs) + s(C.vkH) + s(C.pccv)) * s(C.tnP) / 100))
    const cotT1 = [C.lc, C.pccv, C.pctn, C.tnH, C.ud, ...(coCongVu ? [cCvu] : [])]
    ganCotTinh(dong, cT1, rTatCa, (o) => `ROUND(${cotT1.map(o).join('+')},3)`, (s) => r3(cotT1.reduce((t, c) => t + s(c), 0)))
    ganCotTinh(dong, cT6, rTatCa, (o) => `ROUND(${o(cT1)}*6,3)`, (s) => r3(s(cT1) * 6))
    const cotTong = [C.hs, C.vkH, C.bl, C.lc, C.pccv, C.pctn, C.tnH, C.ud, ...(coCongVu ? [cCvu] : []), cT1, cT6]
    // Dòng cộng: có số thì mới gán công thức SUM (ganDongTong cần ô sẵn giá trị)
    const datTong = (r: number, cacDong: number[]) => {
      for (const c of cotTong) dong[r][c] = r3(cacDong.reduce((s, i) => s + (Number(typeof dong[i][c] === 'object' && dong[i][c] ? (dong[i][c] as { kq: number }).kq : dong[i][c]) || 0), 0)) || null
      ganDongTong(dong, r, cacDong, cotTong)
    }
    datTong(rCongBc, rNguoiBc.map((i) => bdThan + i))
    if (hd.length) datTong(rCongHd, rHd.map((i) => bdThan + i))
    const bdTd = dau.length
    const giuaTd = [C.tt, C.ten, C.cv, C.lc, C.moc, C.pccv, C.pctn, C.ud, cCvu, cT1].filter((c) => c >= 0)
    trangs.push({
      ten: 'Danh sách hệ số lương',
      dong,
      gop: [
        g(0, 0, 0, 5), g(1, 0, 1, 5), g(0, 7, 0, N - 1), g(1, 7, 1, N - 1), g(3, 0, 3, N - 1), g(4, 0, 4, N - 1),
        ...[C.tt, C.ten, C.cv, cT6, cGc].filter((c) => c >= 0).map((c) => g(bdTd, c, bdTd + 2, c)),
        g(bdTd, C.ma, bdTd, cT1),
        ...giuaTd.filter((c) => c >= C.ma).map((c) => g(bdTd + 1, c, bdTd + 2, c)),
        g(bdTd + 1, C.ma, bdTd + 2, C.ma), g(bdTd + 1, C.bac, bdTd + 2, C.bac), g(bdTd + 1, C.hs, bdTd + 2, C.hs), g(bdTd + 1, C.bl, bdTd + 2, C.bl),
        g(bdTd + 1, C.vkP, bdTd + 1, C.vkH), g(bdTd + 1, C.tnP, bdTd + 1, C.tnMoc),
        ...[2, 3, 8].map((k) => g(rCuoiBang + k, C.pctn, rCuoiBang + k, N - 1)),
      ].filter((v, i, a) => a.findIndex((x) => x.r1 === v.r1 && x.c1 === v.c1) === i),
      rongCot: [5, 24, 16, 11, 5, 7, 5, 7, 7, 8, 11, 7, 7, 5, 7, 11, 7, ...(coCongVu ? [7] : []), 9, 10, ...(coGhiChu ? [18] : [])],
      bang: [{ tu: bdTd, den: rCuoiBang, soDongTieuDe: td.length, soCot: N }],
      tieuDe: [3, 4],
      dam: [0, 1, rCongBc, ...(hd.length ? [rCongHd, bdThan + rTieuDeHd] : []), rCuoiBang + 3, rCuoiBang + 8],
      nghieng: [4],
      giua: [0, 1, rCuoiBang + 2, rCuoiBang + 3, rCuoiBang + 8],
      cotGiua: [C.tt, C.ma, C.bac, C.vkP, C.moc, C.tnP, C.tnMoc],
      soLe: 3,
      huong: 'ngang',
      coChu: 10,
    })
  }

  const tenFile = `DKLDTL_${ky.tenDonVi.replace(/[\\/:*?"<>|\s]+/g, '-')}_${b.ky}-${b.nam}`
  return xuatExcelA4(tenFile, trangs)
}
