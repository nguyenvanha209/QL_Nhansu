// Báo cáo tổng hợp định mức viên chức và cơ cấu vị trí việc làm của một cấp học:
// mỗi vị trí một dòng, mỗi trường một nhóm cột (định mức / có mặt / thừa-thiếu) để so sánh trực tiếp.
import type { DonVi } from '@/types/donVi'
import type { VienChuc } from '@/types/vienChuc'
import type { QuyMoTruong } from '@/types/quyMo'
import { HANG_TRUONG_LABELS } from './hangTruong'
import {
  type CapHoc, type ChucDanhTra, type KetQuaDinhMuc, KHOI, NHOM_DINH_MUC, PHAN_CONG_MAM_NON, TEN_CAP,
  idQuyMo, lamTron1, thongKePhanCongMN, tinhDinhMuc,
} from './dinhMuc'
import type { O, TrangA4, VungGop } from './excelA4'

export type ChiSo = 'DM' | 'CM' | 'CL'
export const TEN_CHI_SO: Record<ChiSo, { ngan: string; day: string }> = {
  DM: { ngan: 'Định mức', day: 'Định mức' },
  CM: { ngan: 'Có mặt', day: 'Có mặt' },
  CL: { ngan: 'Thừa/ thiếu', day: 'Thừa (+) / thiếu (-)' },
}

export const MA_TOAN_CAP = '__TONG'

export interface CotTruong {
  id: string
  ten: string
  /** Tên ngắn cho tiêu đề cột: bỏ chữ "Trường", cấp học */
  tenNgan: string
  daKhai: boolean
  kq: KetQuaDinhMuc
}

export interface O3 { dm?: number | null; cm?: number | null; cl?: number | null; chu?: string }

export interface DongBaoCao {
  key: string
  loai: 'muc' | 'quyMo' | 'nhom' | 'viTri' | 'tong'
  stt?: string | number
  ten: string
  /** Theo id trường và MA_TOAN_CAP */
  gt: Record<string, O3>
}

const tenNgan = (ten: string) => ten.replace(/^Trường\s+/i, '').replace(/^(Mầm non|MN|Tiểu học|TH|THCS)\s+/i, '').trim()

const cong = (a: number | null | undefined, b: number | null | undefined) =>
  a == null && b == null ? null : (a ?? 0) + (b ?? 0)

/** Tính bảng báo cáo cho một cấp học, năm học */
export function dungBaoCaoCapHoc(
  cap: CapHoc, namHoc: string, truongs: DonVi[], quyMos: QuyMoTruong[], vienChucs: VienChuc[],
  layChucDanh: (id?: string) => ChucDanhTra | undefined,
): { cot: CotTruong[]; dong: DongBaoCao[] } {
  const cot: (CotTruong & { qm: QuyMoTruong; nhanSu: VienChuc[] })[] = truongs.map((dv) => {
    const qmLuu = quyMos.find((q) => q.id === idQuyMo(dv.id, namHoc))
    const qm = qmLuu ?? { id: idQuyMo(dv.id, namHoc), donViId: dv.id, namHoc, khoi: {}, createdAt: '', updatedAt: '' }
    const nhanSu = vienChucs.filter((v) => v.donViId === dv.id)
    return { id: dv.id, ten: dv.ten, tenNgan: tenNgan(dv.ten), daKhai: !!qmLuu, kq: tinhDinhMuc(cap, qm, nhanSu, layChucDanh), qm, nhanSu }
  })
  const dong: DongBaoCao[] = []
  // Ghi một dòng: giá trị từng trường + cột toàn cấp = cộng các trường
  const them = (d: Omit<DongBaoCao, 'gt'>, lay: (c: (typeof cot)[number]) => O3, tongRieng?: O3) => {
    const gt: Record<string, O3> = {}
    let tong: O3 = { dm: null, cm: null, cl: null }
    for (const c of cot) {
      const v = lay(c)
      gt[c.id] = v
      tong = { dm: cong(tong.dm, v.dm), cm: cong(tong.cm, v.cm), cl: cong(tong.cl, v.cl) }
    }
    gt[MA_TOAN_CAP] = tongRieng ?? tong
    dong.push({ ...d, gt })
  }

  // A. Quy mô
  const laMN = cap === 'MAM_NON'
  dong.push({ key: 'muc-qm', loai: 'muc', stt: 'A', ten: 'QUY MÔ TRƯỜNG LỚP', gt: {} })
  them({ key: 'qm-lop', loai: 'quyMo', ten: laMN ? 'Số nhóm, lớp' : 'Số lớp' }, (c) => ({ cm: c.daKhai ? c.kq.tongLop : null }))
  them({ key: 'qm-hs', loai: 'quyMo', ten: laMN ? 'Số trẻ' : 'Số học sinh' }, (c) => ({ cm: c.daKhai ? c.kq.tongHS : null }))
  if (laMN) {
    for (const k of KHOI.MAM_NON) {
      them({ key: `qm-${k.ma}`, loai: 'quyMo', ten: `- ${k.ten}: số nhóm, lớp` }, (c) => ({ cm: c.daKhai ? (c.qm.khoi[k.ma]?.soLop ?? 0) : null }))
    }
  } else {
    them({ key: 'qm-2b', loai: 'quyMo', ten: 'Số lớp học 2 buổi/ngày' }, (c) => ({ cm: c.daKhai ? c.kq.tongLop2Buoi : null }))
  }
  const tongLop = cot.reduce((s, c) => s + (c.daKhai ? c.kq.tongLop : 0), 0)
  const tongHS = cot.reduce((s, c) => s + (c.daKhai ? c.kq.tongHS : 0), 0)
  them({ key: 'qm-bq', loai: 'quyMo', ten: laMN ? 'Bình quân trẻ/nhóm, lớp' : 'Bình quân học sinh/lớp' },
    (c) => ({ cm: c.daKhai ? lamTron1(c.kq.binhQuan) : null }), { cm: tongLop ? lamTron1(tongHS / tongLop) : null })
  them({ key: 'qm-hang', loai: 'quyMo', ten: 'Hạng trường' }, (c) => ({ chu: c.daKhai ? HANG_TRUONG_LABELS[c.kq.hang] : 'Chưa khai báo' }), { chu: '' })

  // B. Định mức và cơ cấu theo vị trí
  dong.push({ key: 'muc-dm', loai: 'muc', stt: 'B', ten: 'ĐỊNH MỨC VÀ CƠ CẤU THEO VỊ TRÍ VIỆC LÀM', gt: {} })
  for (const n of NHOM_DINH_MUC) {
    const viTri: { ma: string; ten: string }[] = []
    for (const c of cot) for (const d of c.kq.dong) {
      if (d.nhom === n.key && !viTri.some((x) => x.ma === d.ma)) viTri.push({ ma: d.ma, ten: d.ten })
    }
    if (!viTri.length) continue
    them({ key: `nhom-${n.key}`, loai: 'nhom', ten: n.ten }, (c) => {
      const t = c.kq.tongNhom.find((x) => x.nhom === n.key)
      if (!t) return { cm: 0 }
      const dm = c.daKhai && t.apDungDinhMuc ? t.dinhMuc : null
      return { dm, cm: t.coMat, cl: dm == null ? null : t.chenhLech }
    })
    viTri.forEach((v) => them({ key: `vt-${v.ma}`, loai: 'viTri', ten: v.ten }, (c) => {
      const d = c.kq.dong.find((x) => x.ma === v.ma)
      if (!d) return { cm: 0 }
      const dm = c.daKhai && d.nhom !== 'PHUC_VU' ? d.dinhMuc : null
      return { dm, cm: d.coMat, cl: dm == null ? null : d.chenhLech }
    }))
  }
  them({ key: 'tong-dm', loai: 'tong', ten: 'Tổng nhóm I-III (so với định mức)' }, (c) => {
    const dm = c.daKhai ? c.kq.tongDinhMuc : null
    return { dm, cm: c.kq.coMatCoDinhMuc, cl: dm == null ? null : c.kq.coMatCoDinhMuc - dm }
  })
  them({ key: 'tong-ld', loai: 'tong', ten: 'Tổng lao động toàn trường (I-IV)' }, (c) => ({ cm: c.kq.toanTruong.coMat }))

  // C. Mầm non: phân công giáo viên theo nhóm, lớp độ tuổi
  if (laMN) {
    dong.push({ key: 'muc-pc', loai: 'muc', stt: 'C', ten: 'PHÂN CÔNG GIÁO VIÊN THEO NHÓM, LỚP', gt: {} })
    const tk = new Map(cot.map((c) => [c.id, thongKePhanCongMN(c.nhanSu, layChucDanh, c.daKhai ? c.qm : undefined)]))
    PHAN_CONG_MAM_NON.forEach((m) => them({ key: `pc-${m.ma}`, loai: 'viTri', ten: m.ten }, (c) => {
      const d = tk.get(c.id)!.dong.find((x) => x.ma === m.ma)!
      const dm = d.dinhMuc == null || !c.daKhai ? null : d.dinhMuc
      return { dm, cm: d.soGv, cl: dm == null ? null : d.soGv - dm }
    }))
    them({ key: 'pc-chua', loai: 'viTri', ten: 'Chưa phân công' }, (c) => ({ cm: tk.get(c.id)!.chuaPhan }))
  }
  return { cot, dong }
}

export const laSoKhac0 = (v?: number | null) => v != null && lamTron1(v) !== 0

/** Dòng không có số liệu ở mọi trường (định mức 0/trống và không ai có mặt) */
export function dongTrong(d: DongBaoCao): boolean {
  if (d.loai !== 'viTri') return false
  return Object.values(d.gt).every((v) => !laSoKhac0(v.dm) && !laSoKhac0(v.cm))
}

/** Bỏ dòng trống (nếu chọn) rồi đánh số thứ tự vị trí trong từng nhóm */
export function locVaDanhSo(dong: DongBaoCao[], anTrong: boolean): DongBaoCao[] {
  let stt = 0
  return dong.filter((d) => !anTrong || !dongTrong(d)).map((d) => {
    if (d.loai !== 'viTri') { stt = 0; return d }
    stt += 1
    return { ...d, stt }
  })
}

/** Trang Excel A4 của báo cáo (định dạng sẵn để in) */
export function trangExcelBaoCao(
  cap: CapHoc, namHoc: string, bc: { cot: CotTruong[]; dong: DongBaoCao[] }, chiSo: ChiSo[], tenTrang?: string,
): TrangA4 {
  const k = chiSo.length
  const nhom = [{ id: MA_TOAN_CAP, ten: `Toàn cấp ${TEN_CAP[cap]}` }, ...bc.cot.map((c) => ({ id: c.id, ten: c.tenNgan }))]
  const soCot = 2 + nhom.length * k
  const dau: O[][] = [
    ['ỦY BAN NHÂN DÂN PHƯỜNG GIA VIÊN'],
    [],
    [`TỔNG HỢP ĐỊNH MỨC VIÊN CHỨC VÀ CƠ CẤU VỊ TRÍ VIỆC LÀM - CẤP ${TEN_CAP[cap].toUpperCase()}`],
    [`Năm học ${namHoc} - căn cứ ${cap === 'MAM_NON' ? 'Thông tư 19/2023/TT-BGDĐT' : 'Thông tư 20/2023/TT-BGDĐT'}`],
    [],
  ]
  const r0 = dau.length
  const tieuDe1: O[] = ['STT', 'Vị trí việc làm', ...nhom.flatMap((n) => [n.ten, ...Array(k - 1).fill(null)])]
  const tieuDe2: O[] = [null, null, ...nhom.flatMap(() => chiSo.map((c) => TEN_CHI_SO[c].ngan))]
  const gop: VungGop[] = [
    { r1: r0, c1: 0, r2: r0 + 1, c2: 0 }, { r1: r0, c1: 1, r2: r0 + 1, c2: 1 },
    ...nhom.map((_, i) => ({ r1: r0, c1: 2 + i * k, r2: r0, c2: 1 + (i + 1) * k })),
  ]
  const dong: O[][] = [...dau, tieuDe1, tieuDe2]
  const dam: number[] = [0]
  const nen: Record<number, string> = {}
  const mauChu: Record<string, string> = {}
  for (const d of bc.dong) {
    const r = dong.length
    if (d.loai === 'muc') {
      dong.push([d.stt, d.ten])
      gop.push({ r1: r, c1: 1, r2: r, c2: soCot - 1 })
      dam.push(r); nen[r] = 'FFDBEAFE'
      continue
    }
    const hang: O[] = [d.stt ?? '', d.ten]
    nhom.forEach((n, i) => {
      const v = d.gt[n.id] ?? {}
      if (d.loai === 'quyMo') {
        hang.push(v.chu ?? v.cm ?? '', ...Array(k - 1).fill(null))
        if (k > 1) gop.push({ r1: r, c1: 2 + i * k, r2: r, c2: 1 + (i + 1) * k })
        return
      }
      chiSo.forEach((c, j) => {
        const x = c === 'DM' ? v.dm : c === 'CM' ? v.cm : v.cl
        hang.push(x == null ? '' : lamTron1(x))
        if (c === 'CL' && laSoKhac0(x)) mauChu[`${r}:${2 + i * k + j}`] = x! > 0 ? 'FFCF1322' : 'FF1D4ED8'
      })
    })
    dong.push(hang)
    if (d.loai === 'nhom' || d.loai === 'tong') { dam.push(r); nen[r] = d.loai === 'tong' ? 'FFE0E7FF' : 'FFF1F5F9' }
  }
  const cuoi = dong.length
  dong.push([], ['Ghi chú: Thừa (+) ghi màu đỏ, thiếu (-) ghi màu xanh. Thừa/thiếu của nhóm chỉ so các vị trí có định mức. Nhóm IV và giáo viên dạy chuyên không tính định mức.'])
  return {
    ten: tenTrang ?? TEN_CAP[cap],
    dong,
    gop,
    rongCot: [5, 34, ...nhom.flatMap(() => chiSo.map(() => 9))],
    bang: [{ tu: r0, den: cuoi - 1, soDongTieuDe: 2, soCot }],
    tieuDe: [2],
    giua: [3],
    nghieng: [3, cuoi + 1],
    dam,
    nen,
    mauChu,
    cotGiua: [0, ...Array.from({ length: soCot - 2 }, (_, i) => i + 2)],
    huong: 'ngang',
    motTrang: true,
    coChu: 10,
  }
}
