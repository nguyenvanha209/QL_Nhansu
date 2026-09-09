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
  TIEU_HOC: {
    1: { HT: 0.50, 'P.HT': 0.35, TTCM: 0.20, TPCM: 0.15 },
    2: { HT: 0.40, 'P.HT': 0.25, TTCM: 0.20, TPCM: 0.15 },
    3: { HT: 0.30, 'P.HT': 0.20, TTCM: 0.20, TPCM: 0.15 },
  },
  THCS: {
    1: { HT: 0.55, 'P.HT': 0.40, TTCM: 0.25, TPCM: 0.20 },
    2: { HT: 0.45, 'P.HT': 0.30, TTCM: 0.20, TPCM: 0.15 },
    3: { HT: 0.35, 'P.HT': 0.25, TTCM: 0.20, TPCM: 0.15 },
  },
}

export function getPhuCapChucVuHeSo(loai: LoaiDonVi, hang: HangTruong, chucVu: ChucVu): number {
  return PCCV[loai]?.[hang]?.[chucVu] ?? 0
}
