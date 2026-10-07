import type { LoaiDonVi, HangTruong } from '@/types/donVi'
import type { ChucVu } from '@/types/vienChuc'

// Xếp hạng trường theo số lớp (TT 19/2023, TT 20/2023)
export function getHangTruong(loai: LoaiDonVi, soLop: number): HangTruong {
  if (loai === 'MAM_NON') {
    if (soLop >= 9) return 1
    if (soLop >= 6) return 2
    return 3
  }
  if (soLop >= 28) return 1
  if (soLop >= 18) return 2
  return 3
}

export const HANG_TRUONG_LABELS: Record<HangTruong, string> = {
  1: 'Hạng I',
  2: 'Hạng II',
  3: 'Hạng III',
}

// Hệ số phụ cấp chức vụ theo TT 33/2005/TT-BGDĐT
// Đơn vị: hệ số × mức lương cơ sở
const PCCV: Record<string, Record<HangTruong, Record<string, number>>> = {
  MAM_NON: {
    1: { HT: 0.50, 'P.HT': 0.35, TTCM: 0.20, TPCM: 0.15 },
    2: { HT: 0.35, 'P.HT': 0.25, TTCM: 0.20, TPCM: 0.15 },
    3: { HT: 0.25, 'P.HT': 0.15, TTCM: 0.20, TPCM: 0.15 },
  },
  // 07/10/2026: sửa P.HT tiểu học (trước ghi 0,35/0,25/0,20), P.HT THCS hạng I, II (0,40/0,30) và tổ trưởng,
  // tổ phó THCS hạng I (0,25/0,20) - đối chiếu TT 33/2005 và mức các trường đang hưởng thực tế
  TIEU_HOC: {
    1: { HT: 0.50, 'P.HT': 0.40, TTCM: 0.20, TPCM: 0.15 },
    2: { HT: 0.40, 'P.HT': 0.30, TTCM: 0.20, TPCM: 0.15 },
    3: { HT: 0.30, 'P.HT': 0.25, TTCM: 0.20, TPCM: 0.15 },
  },
  THCS: {
    1: { HT: 0.55, 'P.HT': 0.45, TTCM: 0.20, TPCM: 0.15 },
    2: { HT: 0.45, 'P.HT': 0.35, TTCM: 0.20, TPCM: 0.15 },
    3: { HT: 0.35, 'P.HT': 0.25, TTCM: 0.20, TPCM: 0.15 },
  },
}

export function getPhuCapChucVuHeSo(loai: LoaiDonVi, hang: HangTruong, chucVu: ChucVu): number {
  return PCCV[loai]?.[hang]?.[chucVu] ?? 0
}

// ───────────────────────────── Hạng trường theo năm học ─────────────────────────────
// Số lớp lấy từ quy mô trường khai báo từng năm học (trang Thông tin trường), không còn
// dùng một con số chung ở Danh mục. Năm học cần xét chưa khai báo thì dùng năm học gần
// nhất trước đó đã khai; không có năm trước thì dùng năm sau gần nhất - luôn ghi rõ đang
// theo năm học nào để người xem biết.

export interface HangTheoNamHoc {
  hang: HangTruong
  tongLop: number
  /** Năm học có quy mô được dùng */
  namHoc: string
  /** Năm học cần xét (khác `namHoc` khi năm đó chưa khai báo) */
  namHocCanXet: string
}

type QuyMoRutGon = { donViId: string; namHoc: string; khoi: Record<string, { soLop?: number }> }

const tongLopQuyMo = (q: QuyMoRutGon) => Object.values(q.khoi ?? {}).reduce((s, o) => s + (o?.soLop ?? 0), 0)

export function hangTruongTheoNamHoc(
  donVi: { id: string; loai: LoaiDonVi } | undefined,
  quyMos: QuyMoRutGon[],
  namHoc: string,
): HangTheoNamHoc | null {
  if (!donVi || donVi.loai === 'OTHER') return null
  const cuaTruong = quyMos
    .filter((q) => q.donViId === donVi.id && tongLopQuyMo(q) > 0)
    .sort((a, b) => a.namHoc.localeCompare(b.namHoc))
  if (!cuaTruong.length) return null
  const q = cuaTruong.find((x) => x.namHoc === namHoc)
    ?? [...cuaTruong].reverse().find((x) => x.namHoc < namHoc)
    ?? cuaTruong[0]
  const tongLop = tongLopQuyMo(q)
  return { hang: getHangTruong(donVi.loai, tongLop), tongLop, namHoc: q.namHoc, namHocCanXet: namHoc }
}

/** VD "Hạng I - 32 lớp, năm học 2026-2027" (kèm "chưa khai năm học X" khi phải dùng năm khác) */
export function moTaHang(h: HangTheoNamHoc): string {
  return `${HANG_TRUONG_LABELS[h.hang]} - ${h.tongLop} lớp, năm học ${h.namHoc}`
    + (h.namHoc !== h.namHocCanXet ? ` (năm học ${h.namHocCanXet} chưa khai báo quy mô)` : '')
}
