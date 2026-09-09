export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export function matchSearch(text: string, query: string): boolean {
  if (!query) return true
  return normalize(text).includes(normalize(query))
}

export function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function splitHoTen(fullName: string): { ho: string; ten: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return { ho: '', ten: parts[0] ?? '' }
  return { ho: parts.slice(0, -1).join(' '), ten: parts[parts.length - 1] }
}

export function formatDatetime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('vi-VN')
}

export function toProperName(s: string): string {
  if (!s) return s
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/** Họ tên viên chức luôn lưu và hiển thị IN HOA; gộp luôn khoảng trắng thừa. */
export function toUpperName(s?: string): string {
  if (!s) return ''
  return s.trim().replace(/\s+/g, ' ').toLocaleUpperCase('vi')
}

// ── Thứ tự hiển thị danh sách viên chức: CBQL → Giáo viên → Nhân viên ──
const VTVL_ORDER: Record<string, number> = { CBQL: 1, GIAO_VIEN: 2, NHAN_VIEN: 3 }
const NHOM_ORDER: Record<string, number> = { QUAN_LY: 1, GIAO_VIEN: 2, NHAN_VIEN: 3 }
const CHUC_VU_ORDER: Record<string, number> = { HT: 1, 'P.HT': 2, TTCM: 3, TPCM: 4 }

/** Hồ sơ cũ chưa gán VTVL thì suy từ nhóm ngạch/hạng đang xếp. */
export function thuTuVtvl(vtvl?: string, nhomChucDanh?: string): number {
  return VTVL_ORDER[vtvl ?? ''] ?? NHOM_ORDER[nhomChucDanh ?? ''] ?? 4
}

export interface XepThuTuVienChuc {
  ho: string
  ten: string
  vtvl?: string
  chucVu?: string
}

/**
 * Bộ so sánh chuẩn cho mọi danh sách viên chức: CBQL trước, rồi Giáo viên,
 * cuối cùng Nhân viên; trong nhóm CBQL xếp theo chức vụ (HT, P.HT, TTCM, TPCM);
 * cùng bậc thì theo tên A→Z.
 * `getNhom` dùng cho hồ sơ chưa gán VTVL — trả về nhóm của ngạch đang xếp.
 */
export function soSanhVienChuc<T extends XepThuTuVienChuc>(
  getNhom?: (vc: T) => string | undefined,
) {
  return (a: T, b: T): number => {
    const va = thuTuVtvl(a.vtvl, getNhom?.(a))
    const vb = thuTuVtvl(b.vtvl, getNhom?.(b))
    if (va !== vb) return va - vb

    const ca = CHUC_VU_ORDER[a.chucVu ?? ''] ?? 9
    const cb = CHUC_VU_ORDER[b.chucVu ?? ''] ?? 9
    if (ca !== cb) return ca - cb

    return `${a.ho} ${a.ten}`.localeCompare(`${b.ho} ${b.ten}`, 'vi')
  }
}

export function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Hôm nay'
  if (days === 1) return 'Hôm qua'
  if (days < 30) return `${days} ngày trước`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} tháng trước`
  return `${Math.floor(months / 12)} năm trước`
}
