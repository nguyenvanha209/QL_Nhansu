// Danh sách Excel (A4 ngang) để kế toán in ra kiểm tra trước khi trình duyệt: phiếu nâng bậc lương thường xuyên,
// nâng phụ cấp thâm niên, xếp phụ cấp thâm niên nhà giáo lần đầu. Xuất theo dữ liệu đang có trên màn hình (kể cả chưa lưu).
import dayjs from 'dayjs'
import type { ChiTietDeXuat, LoaiDeXuat } from '@/types/deXuat'
import { LOAI_DE_XUAT_LABELS, laDongVuotKhung } from '@/types/deXuat'
import type { VienChuc } from '@/types/vienChuc'
import { CHUC_VU_LABELS } from '@/types/vienChuc'
import type { ChucDanhNgheNghiep } from '@/types/danhMuc'
import { formatDate } from '@/utils/helpers'
import { tenDonViDayDu } from '@/utils/danhSachTruocHan'
import { ngayDu5Nam } from '@/utils/pctnLanDau'
import { xuatExcelA4 } from '@/utils/excelA4'
import type { O, VungGop } from '@/utils/excelA4'

interface DauVao {
  loai: LoaiDeXuat
  tenTruong: string
  /** Tiêu đề phiếu (VD "Nâng bậc lương 6 tháng cuối năm 2026 - THCS An Đà") */
  tieuDe?: string
  chiTiet: ChiTietDeXuat[]
  vienChucs: Map<string, VienChuc>
  chucDanhs: Map<string, ChucDanhNgheNghiep>
  hieuTruong?: string
  nguoiLap?: string
}

/** Một cột: nhóm (gộp ngang các cột liền nhau cùng nhóm), tên cột, độ rộng, căn giữa, định dạng hệ số */
interface Cot {
  nhom?: string
  ten: string
  rong: number
  giua?: boolean
  heSo?: boolean
  lay: (c: ChiTietDeXuat, vc?: VienChuc, cd?: ChucDanhNgheNghiep) => O
}

const ngay = (d?: string) => (d ? formatDate(d) : '')
const thangNam = (ym?: string) => (ym ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : '')
const chucDanhCua = (vc?: VienChuc, cd?: ChucDanhNgheNghiep) =>
  (vc?.chucVu && CHUC_VU_LABELS[vc.chucVu]) || (cd?.nhom === 'GIAO_VIEN' ? 'Giáo viên' : cd?.nhom === 'QUAN_LY' ? 'Cán bộ quản lý' : 'Nhân viên')
const ghep = (...ds: (string | undefined)[]) => ds.filter(Boolean).join('\n')

function cacCot(loai: LoaiDeXuat): Cot[] {
  const dau: Cot[] = [
    { ten: 'Ngày sinh', rong: 11, giua: true, lay: (_, vc) => ngay(vc?.ngaySinh) },
    { ten: 'Chức vụ, chức danh', rong: 13, lay: (_, vc, cd) => chucDanhCua(vc, cd) },
  ]
  if (loai === 'PHU_CAP_THAM_NIEN') {
    const cu = 'Phụ cấp thâm niên đang hưởng'
    return [...dau,
      { nhom: cu, ten: 'Mức (%)', rong: 9, giua: true, lay: (c) => c.pctnCu ?? 0 },
      { nhom: cu, ten: 'Mốc hưởng', rong: 12, giua: true, lay: (_, vc) => ngay(vc?.mocHuongPctn) },
      { nhom: 'Đề nghị', ten: 'Mức (%)', rong: 9, giua: true, lay: (c) => c.pctnMoi ?? 0 },
      { nhom: 'Đề nghị', ten: 'Mốc hưởng mới', rong: 12, giua: true, lay: (c) => ngay(c.ngayHieuLuc) },
      { ten: 'Lý do / ghi chú', rong: 34, lay: (c) => ghep(c.lyDo, c.ghiChu) },
    ]
  }
  if (loai === 'PCTN_LAN_DAU') {
    return [...dau,
      { ten: 'Ngày tuyển dụng', rong: 12, giua: true, lay: (c) => ngay(c.lanDau?.ngayTuyenDung) },
      { ten: 'Bắt đầu giảng dạy có đóng BHXH', rong: 13, giua: true, lay: (c) => thangNam(c.lanDau?.batDauBhxh) },
      {
        ten: 'Thời gian không tính (tháng)', rong: 12, giua: true,
        lay: (c) => (c.lanDau ? ghep(String((c.lanDau.thangTapSu || 0) + (c.lanDau.thangKhongTinhKhac || 0)), c.lanDau.thangTapSu ? `(tập sự ${c.lanDau.thangTapSu})` : undefined) : ''),
      },
      { ten: 'Ngày đủ 5 năm', rong: 12, giua: true, lay: (c) => ngay(c.lanDau ? ngayDu5Nam(c.lanDau) : undefined) },
      { ten: 'Quá trình hưởng (mức - mốc xét - hưởng từ)', rong: 34, lay: (c) => (c.lanDau?.quaTrinh ?? []).map((q) => `${q.tyLe}% - ${ngay(q.mocXet)} - ${ngay(q.thoiGianHuong)}`).join('\n') },
      { ten: 'Mức đề nghị (%)', rong: 10, giua: true, lay: (c) => c.pctnMoi ?? '' },
      { ten: 'Ghi chú', rong: 22, lay: (c) => ghep(c.lanDau?.lyDoKhongTinh, c.ghiChu) },
    ]
  }
  // Nâng bậc lương thường xuyên (người ở bậc cuối giữ bậc, hưởng phụ cấp thâm niên vượt khung)
  const cu = 'Lương đang hưởng'
  const moi = 'Đề nghị nâng'
  return [...dau,
    { nhom: cu, ten: 'Mã CDNN', rong: 11, giua: true, lay: (_, __, cd) => cd?.ma ?? '' },
    { nhom: cu, ten: 'Bậc', rong: 6, giua: true, lay: (c) => c.bacCu },
    { nhom: cu, ten: 'Hệ số', rong: 8, giua: true, heSo: true, lay: (c) => c.heSoCu },
    { nhom: cu, ten: 'PC TNVK (%)', rong: 8, giua: true, lay: (c) => c.tnvkCu || '' },
    { nhom: cu, ten: 'Mốc hưởng', rong: 11, giua: true, lay: (c) => ngay(c.ngayHieuLucCu) },
    { nhom: moi, ten: 'Bậc', rong: 6, giua: true, lay: (c) => c.bacMoi },
    { nhom: moi, ten: 'Hệ số', rong: 8, giua: true, heSo: true, lay: (c) => c.heSoMoi },
    { nhom: moi, ten: 'PC TNVK (%)', rong: 8, giua: true, lay: (c) => (laDongVuotKhung(c) ? c.tnvkMoi ?? '' : '') },
    { nhom: moi, ten: 'Mốc hưởng mới', rong: 11, giua: true, lay: (c) => ngay(c.ngayHieuLuc) },
    { ten: 'Lý do / ghi chú', rong: 26, lay: (c) => ghep(c.lyDo, c.ghiChu) },
  ]
}

/** Xuất danh sách kiểm tra của phiếu đang lập */
export function xuatExcelKiemTraDeXuat(d: DauVao) {
  const cot: Cot[] = [
    { ten: 'TT', rong: 5, giua: true, lay: () => '' },
    { ten: 'Họ và tên', rong: 22, lay: (_, vc) => (vc ? `${vc.ho} ${vc.ten}` : '') },
    ...cacCot(d.loai),
  ]
  const n = cot.length
  const trong = (k: number): O[] => Array(Math.max(0, k)).fill(null)
  // Khối bên phải (quốc hiệu, chữ ký Hiệu trưởng) bắt đầu từ giữa bảng
  const p = Math.floor(n / 2)
  const homNay = dayjs()
  const tenLoai = LOAI_DE_XUAT_LABELS[d.loai]
  const dau: O[][] = [
    ['UBND PHƯỜNG GIA VIÊN', ...trong(p - 1), 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', ...trong(n - p - 1)],
    [tenDonViDayDu(d.tenTruong).toUpperCase(), ...trong(p - 1), 'Độc lập - Tự do - Hạnh phúc', ...trong(n - p - 1)],
    [],
    ['DANH SÁCH', ...trong(n - 1)],
    [`Đề nghị ${tenLoai.charAt(0).toLowerCase()}${tenLoai.slice(1)}`, ...trong(n - 1)],
    [d.tieuDe ? `(${d.tieuDe})` : '', ...trong(n - 1)],
    [],
  ]
  const r0 = dau.length
  // Tiêu đề bảng 2 dòng: cột có nhóm → dòng 1 tên nhóm (gộp ngang), dòng 2 tên cột; cột không nhóm gộp dọc; thêm dòng đánh số cột
  const tieuDe: O[][] = [
    cot.map((c) => c.nhom ?? c.ten),
    cot.map((c) => (c.nhom ? c.ten : null)),
    cot.map((_, i) => (i === 0 ? 'A' : i === 1 ? 'B' : String(i - 1))),
  ]
  const gop: VungGop[] = [
    { r1: 0, c1: 0, r2: 0, c2: p - 1 }, { r1: 1, c1: 0, r2: 1, c2: p - 1 },
    { r1: 0, c1: p, r2: 0, c2: n - 1 }, { r1: 1, c1: p, r2: 1, c2: n - 1 },
    ...[3, 4, 5].map((r) => ({ r1: r, c1: 0, r2: r, c2: n - 1 })),
  ]
  for (let i = 0; i < n; i++) {
    if (!cot[i].nhom) { gop.push({ r1: r0, c1: i, r2: r0 + 1, c2: i }); continue }
    if (i > 0 && cot[i - 1].nhom === cot[i].nhom) continue
    let j = i
    while (j + 1 < n && cot[j + 1].nhom === cot[i].nhom) j++
    if (j > i) gop.push({ r1: r0, c1: i, r2: r0, c2: j })
  }
  const r1 = r0 + tieuDe.length
  const than: O[][] = d.chiTiet.map((c, k) => {
    const vc = d.vienChucs.get(c.vienChucId)
    const cd = d.chucDanhs.get(c.chucDanhCuId)
    return cot.map((x, i) => (i === 0 ? k + 1 : x.lay(c, vc, cd)))
  })
  // Sau bảng: dòng trống, tổng số, ngày, chức danh ký, 3 dòng trống, tên người ký
  const rTong = r1 + than.length + 1
  const chuKy: O[][] = [
    [`Tổng số: ${String(d.chiTiet.length).padStart(2, '0')} người`, ...trong(n - 1)],
    [...trong(p), `Gia Viên, ngày ${homNay.format('DD')} tháng ${homNay.format('MM')} năm ${homNay.year()}`, ...trong(n - p - 1)],
    ['NGƯỜI LẬP', ...trong(p - 1), 'HIỆU TRƯỞNG', ...trong(n - p - 1)],
    [], [], [],
    [d.nguoiLap ?? '', ...trong(p - 1), d.hieuTruong ?? '', ...trong(n - p - 1)],
  ]
  for (const k of [1, 2, 6]) {
    gop.push({ r1: rTong + k, c1: p, r2: rTong + k, c2: n - 1 })
    if (k !== 1) gop.push({ r1: rTong + k, c1: 0, r2: rTong + k, c2: p - 1 })
  }
  const dinhDangO: Record<string, string> = {}
  than.forEach((_, k) => cot.forEach((x, i) => { if (x.heSo) dinhDangO[`${r1 + k}:${i}`] = '0.00' }))
  const tenTep = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-')
  return xuatExcelA4(`DS-kiem-tra-${tenTep(tenLoai)}-${tenTep(d.tenTruong)}`, [{
    ten: 'Danh sách',
    dong: [...dau, ...tieuDe, ...than, [], ...chuKy],
    gop,
    rongCot: cot.map((c) => c.rong),
    bang: [{ tu: r0, den: r1 + than.length - 1, soDongTieuDe: tieuDe.length, soCot: n }],
    tieuDe: [0, 1, 3, 4],
    nghieng: [5, rTong + 1],
    giua: [5, rTong + 1, rTong + 2, rTong + 6],
    dam: [rTong, rTong + 2, rTong + 6],
    cotGiua: cot.flatMap((c, i) => (c.giua ? [i] : [])),
    dinhDangO,
    soLe: 2,
    huong: 'ngang',
    coChu: 11,
  }])
}
