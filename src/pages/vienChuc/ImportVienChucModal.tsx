import { useState, useCallback } from 'react'
import {
  Modal, Steps, Upload, Button, Table, Checkbox, Tag, Space, Typography,
  Alert, Badge, Empty, App,
} from 'antd'
import {
  InboxOutlined, CheckCircleOutlined, WarningOutlined,
  DownloadOutlined, UploadOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import { logAction } from '@/utils/auditLogger'
import { formatDate, splitHoTen } from '@/utils/helpers'
import {
  LOAI_LAO_DONG_LABELS,
  TRANG_THAI_CONG_TAC_LABELS,
  NGUON_KINH_PHI_LABELS,
  CHUC_VU_LABELS,
  VTVL_LABELS,
} from '@/types/vienChuc'
import type { VienChuc } from '@/types/vienChuc'
import type { HeSoLuong, PhuCapVienChuc } from '@/types/luong'
import type { ChucDanhNgheNghiep, LoaiPhuCap } from '@/types/danhMuc'
import type { DonVi } from '@/types/donVi'

const { Text, Title } = Typography
const { Dragger } = Upload

// ── Tiêu đề cột Excel (khớp cả xuất lẫn nhập) ──────────────────────────────

const COL = {
  ID:              'ID (không sửa)',
  MA:              'Mã VC',
  DON_VI:          'Đơn vị (không sửa)',
  HO_TEN:          'Họ và tên',
  NGAY_SINH:       'Ngày sinh',
  GIOI_TINH:       'Giới tính',
  CCCD:            'CCCD',
  DIEN_THOAI:      'Điện thoại',
  EMAIL:           'Email',
  DIA_CHI:         'Địa chỉ',
  CHUC_DANH:       'Chức danh nghề nghiệp',
  CHUC_VU:         'Chức vụ',
  VTVL:            'VTVL',
  LOAI_LAO_DONG:   'Loại lao động',
  TRANG_THAI:      'Trạng thái',
  NGUON_KINH_PHI:  'Nguồn kinh phí',
  TRINH_DO:        'Trình độ chuyên môn',
  DANG_VIEN:       'Đảng viên',
  NGAY_VAO_NGANH:  'Ngày vào ngành',
  NGAY_VAO_DON_VI: 'Ngày vào đơn vị',
  NGAY_BIEN_CHE:   'Ngày vào biên chế',
  THOI_HAN_HD:     'Thời hạn HĐ',
  // Lương
  BAC:             'Bậc',
  HE_SO:           'Hệ số lương',
  MOC_LUONG:       'Mốc hưởng lương',
  NANG_TIEP:       'Ngày nâng lương tiếp theo',
  // Phụ cấp
  PC_VK:           'PC Vượt khung (%)',
  PC_CV:           'PC Chức vụ (hệ số)',
  PC_TN:           'PC Trách nhiệm (hệ số)',
  PC_TNN:          'PC Thâm niên nghề (%)',
  MOC_TNN:         'Mốc thâm niên',
  PC_UD:           'PC Ưu đãi nghề (%)',
  HE_SO_BAO_LUU:   'Hệ số bảo lưu',
  GHI_CHU:         'Ghi chú',
} as const

// Mã loại phụ cấp trong danh mục ↔ cột Excel
const PC_VUOT_KHUNG  = 'PC_THAM_NIEN_VK'
const PC_CHUC_VU     = 'PC_CHUC_VU'
const PC_TRACH_NHIEM = 'PC_TRACH_NHIEM'
const PC_THAM_NIEN   = 'PC_THAM_NIEN'
const PC_UU_DAI_PREFIX = 'PCUD'

// ── Helpers ─────────────────────────────────────────────────────────────────

function invertLabels<T extends string>(labels: Record<string, string>): Record<string, T> {
  return Object.fromEntries(Object.entries(labels).map(([k, v]) => [v, k])) as Record<string, T>
}

function parseDate(val: unknown): string | undefined {
  if (!val) return undefined
  if (val instanceof Date) return dayjs(val).format('YYYY-MM-DD')
  const s = String(val).trim()
  if (!s) return undefined
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4,5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000)
    return dayjs(d).format('YYYY-MM-DD')
  }
  const parsed = dayjs(s)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

/**
 * Phân biệt ô để trống (chủ đích xóa) với ô gõ sai định dạng (lỗi nhập liệu).
 * Nếu không tách hai trường hợp này, một ngày gõ sai sẽ âm thầm xóa dữ liệu đang có.
 */
function readDate(raw: unknown): { ok: true; value?: string } | { ok: false } {
  if (!str(raw) && !(raw instanceof Date)) return { ok: true, value: undefined }
  const parsed = parseDate(raw)
  return parsed ? { ok: true, value: parsed } : { ok: false }
}

/** Đọc số từ ô Excel — chấp nhận cả dấu phẩy thập phân kiểu VN */
function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.')
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** Giá trị phụ cấp thực dùng: bản ghi cá nhân ưu tiên, không có thì lấy mặc định của loại */
function pcValue(pc: PhuCapVienChuc | undefined, loai: LoaiPhuCap | undefined): number {
  if (!pc) return 0
  return pc.giaTri > 0 ? pc.giaTri : (loai?.giaTri ?? 0)
}

interface LuongSnapshot {
  bac?: number
  heSo?: number
  baoLuu?: number
  mocLuong?: string
  nangTiep?: string
  vk: number
  cv: number
  tn: number
  tnn: number
  mocTnn?: string
  ud: number
}

/** Gom toàn bộ thông số lương + phụ cấp đang áp dụng của 1 viên chức */
function readLuong(
  vcId: string,
  heSos: HeSoLuong[],
  phuCaps: PhuCapVienChuc[],
  loaiPhuCaps: LoaiPhuCap[],
): { snapshot: LuongSnapshot; heSoRec?: HeSoLuong; pcRecs: Record<string, PhuCapVienChuc | undefined> } {
  const heSoRec = heSos.find((h) => h.vienChucId === vcId && h.isActive)
  const mine = phuCaps.filter((p) => p.vienChucId === vcId && p.isActive)

  const byMa = (ma: string) => {
    const loai = loaiPhuCaps.find((l) => l.ma === ma)
    const rec = loai ? mine.find((p) => p.loaiPhuCapId === loai.id) : undefined
    return { loai, rec }
  }
  const uuDaiLoaiIds = new Set(loaiPhuCaps.filter((l) => l.ma.startsWith(PC_UU_DAI_PREFIX)).map((l) => l.id))
  const udRec = mine.find((p) => uuDaiLoaiIds.has(p.loaiPhuCapId))
  const udLoai = udRec ? loaiPhuCaps.find((l) => l.id === udRec.loaiPhuCapId) : undefined

  const vk  = byMa(PC_VUOT_KHUNG)
  const cv  = byMa(PC_CHUC_VU)
  const tn  = byMa(PC_TRACH_NHIEM)
  const tnn = byMa(PC_THAM_NIEN)

  return {
    snapshot: {
      bac:       heSoRec?.bac,
      heSo:      heSoRec?.heSo,
      baoLuu:    heSoRec?.heSoBaoLuu,
      mocLuong:  heSoRec?.ngayHieuLuc,
      nangTiep:  heSoRec?.ngayNangLuongTiepTheo,
      vk:        pcValue(vk.rec, vk.loai),
      cv:        pcValue(cv.rec, cv.loai),
      tn:        pcValue(tn.rec, tn.loai),
      tnn:       pcValue(tnn.rec, tnn.loai),
      mocTnn:    tnn.rec?.ngayHieuLuc,
      ud:        pcValue(udRec, udLoai),
    },
    heSoRec,
    pcRecs: { vk: vk.rec, cv: cv.rec, tn: tn.rec, tnn: tnn.rec, ud: udRec },
  }
}

/**
 * Tính lương theo quy định hiện hành:
 *   Lương chính = hệ số × mức lương cơ sở
 *   PC vượt khung = lương chính × %
 *   PC chức vụ / trách nhiệm = hệ số PC × mức lương cơ sở
 *   Nền tính ưu đãi & thâm niên = lương chính + PC vượt khung + PC chức vụ
 */
function tinhLuong(s: LuongSnapshot, lcs: number) {
  const luongChinh = (s.heSo ?? 0) * lcs
  const pcVK = luongChinh * (s.vk / 100)
  const pcCV = s.cv * lcs
  const nen = luongChinh + pcVK + pcCV
  const pcUD = nen * (s.ud / 100)
  const pcTNN = nen * (s.tnn / 100)
  const pcTN = s.tn * lcs
  const tongPC = pcVK + pcCV + pcUD + pcTNN + pcTN
  return { luongChinh, tongPC, tongTN: luongChinh + tongPC }
}

// ── Nhãn hiển thị ────────────────────────────────────────────────────────────

const FIELD_LABELS: Partial<Record<keyof VienChuc, string>> = {
  ngaySinh: 'Ngày sinh', gioiTinh: 'Giới tính',
  cccd: 'CCCD', diaChi: 'Địa chỉ', dienThoai: 'Điện thoại', email: 'Email',
  chucDanhId: 'Chức danh', chucVu: 'Chức vụ', vtvl: 'VTVL',
  loaiLaoDong: 'Loại lao động', trangThai: 'Trạng thái',
  ngayVaoNganh: 'Ngày vào ngành', ngayVaoDonVi: 'Ngày vào đơn vị',
  ngayVaoBienChe: 'Ngày vào biên chế', thoiHanHopDong: 'Thời hạn HĐ',
  nguonKinhPhi: 'Nguồn kinh phí', laDangVien: 'Đảng viên',
  trinhDoChuyenMon: 'Trình độ CM', ghiChu: 'Ghi chú',
}

function displayValue(field: keyof VienChuc, val: unknown, chucDanhs: ChucDanhNgheNghiep[]): string {
  if (val === null || val === undefined || val === '') return '(trống)'
  switch (field) {
    case 'chucDanhId':   return chucDanhs.find((c) => c.id === val)?.ten ?? String(val)
    case 'chucVu':       return CHUC_VU_LABELS[val as keyof typeof CHUC_VU_LABELS] ?? String(val)
    case 'vtvl':         return VTVL_LABELS[val as keyof typeof VTVL_LABELS] ?? String(val)
    case 'loaiLaoDong':  return LOAI_LAO_DONG_LABELS[val as keyof typeof LOAI_LAO_DONG_LABELS] ?? String(val)
    case 'trangThai':    return TRANG_THAI_CONG_TAC_LABELS[val as keyof typeof TRANG_THAI_CONG_TAC_LABELS] ?? String(val)
    case 'nguonKinhPhi': return NGUON_KINH_PHI_LABELS[val as keyof typeof NGUON_KINH_PHI_LABELS] ?? String(val)
    case 'laDangVien':   return val ? 'Có' : 'Không'
    case 'ngaySinh': case 'ngayVaoNganh': case 'ngayVaoDonVi':
    case 'ngayVaoBienChe': case 'thoiHanHopDong': return formatDate(String(val))
    default: return String(val)
  }
}

// ── Export ───────────────────────────────────────────────────────────────────

export function exportVienChucTemplate(
  vienChucs: VienChuc[],
  donVis: DonVi[],
  chucDanhs: ChucDanhNgheNghiep[],
  heSos: HeSoLuong[],
  phuCaps: PhuCapVienChuc[],
  loaiPhuCaps: LoaiPhuCap[],
) {
  const rows = vienChucs.map((vc) => {
    const { snapshot: s, heSoRec } = readLuong(vc.id, heSos, phuCaps, loaiPhuCaps)
    return {
      [COL.ID]:              vc.id,
      [COL.MA]:              vc.ma,
      [COL.DON_VI]:          donVis.find((d) => d.id === vc.donViId)?.ten ?? '',
      [COL.HO_TEN]:          `${vc.ho} ${vc.ten}`.trim().toUpperCase(),
      [COL.NGAY_SINH]:       formatDate(vc.ngaySinh),
      [COL.GIOI_TINH]:       vc.gioiTinh === 'NAM' ? 'Nam' : 'Nữ',
      [COL.CCCD]:            vc.cccd ?? '',
      [COL.DIEN_THOAI]:      vc.dienThoai ?? '',
      [COL.EMAIL]:           vc.email ?? '',
      [COL.DIA_CHI]:         vc.diaChi ?? '',
      [COL.CHUC_DANH]:       chucDanhs.find((c) => c.id === vc.chucDanhId)?.ten ?? '',
      [COL.CHUC_VU]:         vc.chucVu ? (CHUC_VU_LABELS[vc.chucVu as keyof typeof CHUC_VU_LABELS] ?? vc.chucVu) : '',
      [COL.VTVL]:            vc.vtvl ? (VTVL_LABELS[vc.vtvl as keyof typeof VTVL_LABELS] ?? vc.vtvl) : '',
      [COL.LOAI_LAO_DONG]:   LOAI_LAO_DONG_LABELS[vc.loaiLaoDong] ?? vc.loaiLaoDong,
      [COL.TRANG_THAI]:      vc.trangThai ? (TRANG_THAI_CONG_TAC_LABELS[vc.trangThai] ?? vc.trangThai) : 'Đang làm việc',
      [COL.NGUON_KINH_PHI]:  vc.nguonKinhPhi ? (NGUON_KINH_PHI_LABELS[vc.nguonKinhPhi] ?? '') : '',
      [COL.TRINH_DO]:        vc.trinhDoChuyenMon ?? '',
      [COL.DANG_VIEN]:       vc.laDangVien ? 'Có' : 'Không',
      [COL.NGAY_VAO_NGANH]:  formatDate(vc.ngayVaoNganh),
      [COL.NGAY_VAO_DON_VI]: formatDate(vc.ngayVaoDonVi),
      [COL.NGAY_BIEN_CHE]:   formatDate(vc.ngayVaoBienChe ?? ''),
      [COL.THOI_HAN_HD]:     formatDate(vc.thoiHanHopDong ?? ''),
      // Lương
      [COL.BAC]:             s.bac ?? '',
      [COL.HE_SO]:           s.heSo ?? '',
      [COL.MOC_LUONG]:       formatDate(s.mocLuong ?? ''),
      [COL.NANG_TIEP]:       formatDate(s.nangTiep ?? ''),
      // Phụ cấp
      [COL.PC_VK]:           s.vk || '',
      [COL.PC_CV]:           s.cv || '',
      [COL.PC_TN]:           s.tn || '',
      [COL.PC_TNN]:          s.tnn || '',
      [COL.MOC_TNN]:         formatDate(s.mocTnn ?? ''),
      [COL.PC_UD]:           s.ud || '',
      [COL.HE_SO_BAO_LUU]:   heSoRec?.heSoBaoLuu || '',
      [COL.GHI_CHU]:         vc.ghiChu ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 24 }, { wch: 11 }, { wch: 24 }, { wch: 26 }, { wch: 12 },
    { wch: 9  }, { wch: 14 }, { wch: 13 }, { wch: 22 }, { wch: 28 },
    { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 25 }, { wch: 16 },
    { wch: 24 }, { wch: 20 }, { wch: 9  }, { wch: 13 }, { wch: 13 },
    { wch: 14 }, { wch: 12 },
    { wch: 6  }, { wch: 11 }, { wch: 15 }, { wch: 22 },
    { wch: 15 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
    { wch: 14 },
    { wch: 34 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách viên chức')
  XLSX.writeFile(wb, `HoSo_VienChuc_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`)
}

// ── Types nội bộ ─────────────────────────────────────────────────────────────

type Nhom = 'Hồ sơ' | 'Lương' | 'Phụ cấp'

interface FieldChange {
  key: string
  nhom: Nhom
  label: string
  oldDisplay: string
  newDisplay: string
}

interface PhuCapOp {
  action: 'update' | 'add' | 'remove'
  pcId?: string
  loaiPhuCapId?: string
  giaTri?: number
  ngayHieuLuc?: string
}

interface ChangeRecord {
  vcId: string
  hoTen: string
  donViTen: string
  changes: FieldChange[]
  patchVC: Partial<VienChuc>
  heSoId?: string
  patchHeSo?: Partial<HeSoLuong>
  phuCapOps: PhuCapOp[]
  selected: boolean
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export default function ImportVienChucModal({ open, onClose }: Props) {
  const { message } = App.useApp()
  const { currentUser } = useAuth()
  const vienChucs      = useVienChucStore((s) => s.vienChucs)
  const updateVienChuc = useVienChucStore((s) => s.updateVienChuc)
  const donVis         = useDanhMucStore((s) => s.donVis)
  const chucDanhs      = useDanhMucStore((s) => s.chucDanhs)
  const loaiPhuCaps    = useDanhMucStore((s) => s.loaiPhuCaps)
  const heSos          = useLuongStore((s) => s.heSoLuongs)
  const phuCaps        = useLuongStore((s) => s.phuCapVienChucs)
  const updateHeSoLuong = useLuongStore((s) => s.updateHeSoLuong)
  const updatePhuCap    = useLuongStore((s) => s.updatePhuCap)
  const addPhuCap       = useLuongStore((s) => s.addPhuCap)
  const deactivatePhuCap = useLuongStore((s) => s.deactivatePhuCap)

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [changes, setChanges] = useState<ChangeRecord[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [appliedCount, setAppliedCount] = useState(0)

  const inverseChucVu    = invertLabels(CHUC_VU_LABELS)
  const inverseVtvl      = invertLabels(VTVL_LABELS)
  const inverseLoaiLD    = invertLabels(LOAI_LAO_DONG_LABELS)
  const inverseTrangThai = invertLabels(TRANG_THAI_CONG_TAC_LABELS)
  const inverseNguon     = invertLabels(NGUON_KINH_PHI_LABELS)

  // ── Phân tích file ─────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    setLoading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buf = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(buf, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]

        const warns: string[] = []
        const result: ChangeRecord[] = []

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const vcId = str(row[COL.ID])
          if (!vcId) continue

          const vc = vienChucs.find((v) => v.id === vcId)
          if (!vc) {
            warns.push(`Dòng ${i + 2}: ID không tìm thấy (${vcId.slice(0, 12)}…)`)
            continue
          }

          const patchVC: Partial<VienChuc> = {}
          const fieldChanges: FieldChange[] = []
          const phuCapOps: PhuCapOp[] = []

          // ── Trường hồ sơ ──
          const check = (field: keyof VienChuc, newRaw: unknown) => {
            const oldRaw = vc[field]
            const a = oldRaw === null || oldRaw === undefined ? '' : String(oldRaw)
            const b = newRaw === null || newRaw === undefined ? '' : String(newRaw)
            if (a === b) return
            ;(patchVC as Record<string, unknown>)[field] = newRaw
            fieldChanges.push({
              key: field,
              nhom: 'Hồ sơ',
              label: FIELD_LABELS[field] ?? field,
              oldDisplay: displayValue(field, oldRaw, chucDanhs),
              newDisplay: displayValue(field, newRaw, chucDanhs),
            })
          }

          // Họ và tên — gộp 1 cột, tách khi nhập
          // So sánh case-insensitive để tránh false positive khi file export UPPERCASE
          const hoTenMoi = str(row[COL.HO_TEN])
          if (hoTenMoi) {
            const hoTenCu = `${vc.ho} ${vc.ten}`.trim()
            if (hoTenMoi.toLowerCase() !== hoTenCu.toLowerCase()) {
              const { ho, ten } = splitHoTen(hoTenMoi)
              patchVC.ho = ho
              patchVC.ten = ten
              fieldChanges.push({
                key: 'hoTen', nhom: 'Hồ sơ', label: 'Họ và tên',
                oldDisplay: hoTenCu || '(trống)', newDisplay: hoTenMoi,
              })
            }
          }

          check('cccd',             str(row[COL.CCCD]) || undefined)
          check('diaChi',           str(row[COL.DIA_CHI]) || undefined)
          check('dienThoai',        str(row[COL.DIEN_THOAI]) || undefined)
          check('email',            str(row[COL.EMAIL]) || undefined)
          check('trinhDoChuyenMon', str(row[COL.TRINH_DO]) || undefined)
          check('ghiChu',           str(row[COL.GHI_CHU]) || undefined)

          const gt = str(row[COL.GIOI_TINH]).toLowerCase()
          if (gt === 'nam') check('gioiTinh', 'NAM')
          else if (gt === 'nữ' || gt === 'nu') check('gioiTinh', 'NU')

          const checkDate = (field: keyof VienChuc, raw: unknown, colLabel: string, batBuoc = false) => {
            const r = readDate(raw)
            if (!r.ok) {
              warns.push(`Dòng ${i + 2} (${vc.ho} ${vc.ten}): "${colLabel}" sai định dạng ngày — giữ nguyên giá trị cũ`)
              return
            }
            // Trường bắt buộc không được xóa trắng
            if (batBuoc && r.value === undefined) return
            check(field, r.value)
          }

          checkDate('ngaySinh',       row[COL.NGAY_SINH],       COL.NGAY_SINH, true)
          checkDate('ngayVaoNganh',   row[COL.NGAY_VAO_NGANH],  COL.NGAY_VAO_NGANH, true)
          checkDate('ngayVaoDonVi',   row[COL.NGAY_VAO_DON_VI], COL.NGAY_VAO_DON_VI, true)
          checkDate('ngayVaoBienChe', row[COL.NGAY_BIEN_CHE],   COL.NGAY_BIEN_CHE)
          checkDate('thoiHanHopDong', row[COL.THOI_HAN_HD],     COL.THOI_HAN_HD)

          const cdTen = str(row[COL.CHUC_DANH])
          if (cdTen) {
            const cd = chucDanhs.find((c) => c.ten.toLowerCase() === cdTen.toLowerCase())
            if (cd) check('chucDanhId', cd.id)
            else warns.push(`Dòng ${i + 2} (${vc.ho} ${vc.ten}): chức danh "${cdTen}" không tìm thấy`)
          }

          const cvTen = str(row[COL.CHUC_VU]);  if (cvTen) check('chucVu', inverseChucVu[cvTen] ?? cvTen)
          const vtTen = str(row[COL.VTVL]);     if (vtTen) check('vtvl', inverseVtvl[vtTen] ?? vtTen)

          const llTen = str(row[COL.LOAI_LAO_DONG])
          if (llTen) {
            const ll = inverseLoaiLD[llTen]
            if (ll) check('loaiLaoDong', ll)
            else warns.push(`Dòng ${i + 2}: loại lao động "${llTen}" không nhận dạng được`)
          }

          const ttTen = str(row[COL.TRANG_THAI])
          if (ttTen && inverseTrangThai[ttTen]) check('trangThai', inverseTrangThai[ttTen])

          const ngTen = str(row[COL.NGUON_KINH_PHI])
          if (ngTen && inverseNguon[ngTen]) check('nguonKinhPhi', inverseNguon[ngTen])

          const dvien = str(row[COL.DANG_VIEN]).toLowerCase()
          if (dvien === 'có' || dvien === 'co' || dvien === 'x') check('laDangVien', true)
          else if (dvien === 'không' || dvien === 'khong') check('laDangVien', false)

          // ── Lương ──
          const { snapshot: cur, heSoRec, pcRecs } = readLuong(vc.id, heSos, phuCaps, loaiPhuCaps)
          const patchHeSo: Partial<HeSoLuong> = {}

          const checkLuong = (
            label: string, key: string,
            oldVal: string | number | undefined, newVal: string | number | undefined,
            apply: () => void, fmt?: (v: unknown) => string,
          ) => {
            if (newVal === undefined) return
            if (String(oldVal ?? '') === String(newVal)) return
            const show = fmt ?? ((v: unknown) => (v === undefined || v === '' ? '(trống)' : String(v)))
            apply()
            fieldChanges.push({
              key, nhom: 'Lương', label,
              oldDisplay: show(oldVal), newDisplay: show(newVal),
            })
          }

          if (heSoRec) {
            const bacMoi = num(row[COL.BAC])
            checkLuong('Bậc', 'bac', cur.bac, bacMoi, () => { patchHeSo.bac = bacMoi })

            const heSoMoi = num(row[COL.HE_SO])
            checkLuong('Hệ số lương', 'heSo', cur.heSo, heSoMoi, () => { patchHeSo.heSo = heSoMoi })

            const asDate = (v: string | undefined) => formatDate(String(v ?? '')) || '(trống)'

            const rMoc = readDate(row[COL.MOC_LUONG])
            if (!rMoc.ok) warns.push(`Dòng ${i + 2} (${vc.ho} ${vc.ten}): "${COL.MOC_LUONG}" sai định dạng ngày`)
            else if (rMoc.value)
              checkLuong('Mốc hưởng lương', 'mocLuong', cur.mocLuong, rMoc.value,
                () => { patchHeSo.ngayHieuLuc = rMoc.value }, asDate)

            const rNang = readDate(row[COL.NANG_TIEP])
            if (!rNang.ok) warns.push(`Dòng ${i + 2} (${vc.ho} ${vc.ten}): "${COL.NANG_TIEP}" sai định dạng ngày`)
            else if (rNang.value)
              checkLuong('Ngày nâng lương tiếp', 'nangTiep', cur.nangTiep, rNang.value,
                () => { patchHeSo.ngayNangLuongTiepTheo = rNang.value }, asDate)
          } else if (num(row[COL.HE_SO]) !== undefined) {
            warns.push(`Dòng ${i + 2} (${vc.ho} ${vc.ten}): chưa có bản ghi lương đang áp dụng — bỏ qua cột lương`)
          }

          // Hệ số bảo lưu
          if (heSoRec) {
            const baoLuuMoi = num(row[COL.HE_SO_BAO_LUU])
            if (baoLuuMoi !== undefined) {
              const baoLuuCu = cur.baoLuu ?? 0
              if (baoLuuCu !== baoLuuMoi) {
                patchHeSo.heSoBaoLuu = baoLuuMoi > 0 ? baoLuuMoi : undefined
                fieldChanges.push({
                  key: 'baoLuu', nhom: 'Lương', label: 'Hệ số bảo lưu',
                  oldDisplay: baoLuuCu ? String(baoLuuCu) : '(không có)',
                  newDisplay: baoLuuMoi > 0 ? String(baoLuuMoi) : '(gỡ bỏ)',
                })
              }
            }
          }

          // ── Phụ cấp ──
          const checkPC = (
            label: string, key: string, maLoai: string,
            oldVal: number, newVal: number | undefined,
            rec: PhuCapVienChuc | undefined,
            suffix: string,
          ) => {
            if (newVal === undefined) return
            if (oldVal === newVal) return

            const loai = maLoai === PC_UU_DAI_PREFIX
              ? loaiPhuCaps.find((l) => l.ma.startsWith(PC_UU_DAI_PREFIX) && l.giaTri === newVal)
                ?? loaiPhuCaps.find((l) => l.ma.startsWith(PC_UU_DAI_PREFIX))
              : loaiPhuCaps.find((l) => l.ma === maLoai)

            if (newVal === 0 && rec) {
              phuCapOps.push({ action: 'remove', pcId: rec.id })
            } else if (rec) {
              phuCapOps.push({ action: 'update', pcId: rec.id, giaTri: newVal })
            } else if (loai) {
              phuCapOps.push({
                action: 'add', loaiPhuCapId: loai.id, giaTri: newVal,
                ngayHieuLuc: dayjs().format('YYYY-MM-DD'),
              })
            } else {
              warns.push(`Dòng ${i + 2} (${vc.ho} ${vc.ten}): chưa có loại phụ cấp "${label}" trong danh mục`)
              return
            }
            fieldChanges.push({
              key, nhom: 'Phụ cấp', label,
              oldDisplay: oldVal ? `${oldVal}${suffix}` : '(không có)',
              newDisplay: newVal ? `${newVal}${suffix}` : '(gỡ bỏ)',
            })
          }

          checkPC('PC Vượt khung',   'pcVk', PC_VUOT_KHUNG,    cur.vk,  num(row[COL.PC_VK]),  pcRecs.vk,  '%')
          checkPC('PC Chức vụ',      'pcCv', PC_CHUC_VU,       cur.cv,  num(row[COL.PC_CV]),  pcRecs.cv,  '')
          checkPC('PC Trách nhiệm',  'pcTn', PC_TRACH_NHIEM,   cur.tn,  num(row[COL.PC_TN]),  pcRecs.tn,  '')
          checkPC('PC Thâm niên',    'pcTnn', PC_THAM_NIEN,    cur.tnn, num(row[COL.PC_TNN]), pcRecs.tnn, '%')
          checkPC('PC Ưu đãi',       'pcUd', PC_UU_DAI_PREFIX, cur.ud,  num(row[COL.PC_UD]),  pcRecs.ud,  '%')

          // Mốc thâm niên — chỉ sửa được khi đã có bản ghi PC thâm niên
          const rMocTnn = readDate(row[COL.MOC_TNN])
          if (!rMocTnn.ok) warns.push(`Dòng ${i + 2} (${vc.ho} ${vc.ten}): "${COL.MOC_TNN}" sai định dạng ngày`)
          const mocTnnMoi = rMocTnn.ok ? rMocTnn.value : undefined
          if (mocTnnMoi && pcRecs.tnn && mocTnnMoi !== cur.mocTnn) {
            phuCapOps.push({ action: 'update', pcId: pcRecs.tnn.id, ngayHieuLuc: mocTnnMoi })
            fieldChanges.push({
              key: 'mocTnn', nhom: 'Phụ cấp', label: 'Mốc thâm niên',
              oldDisplay: formatDate(cur.mocTnn ?? '') || '(trống)',
              newDisplay: formatDate(mocTnnMoi),
            })
          }

          if (fieldChanges.length > 0) {
            result.push({
              vcId,
              hoTen: `${vc.ho} ${vc.ten}`,
              donViTen: donVis.find((d) => d.id === vc.donViId)?.ten ?? '',
              changes: fieldChanges,
              patchVC,
              heSoId: heSoRec?.id,
              patchHeSo: Object.keys(patchHeSo).length ? patchHeSo : undefined,
              phuCapOps,
              selected: true,
            })
          }
        }

        setChanges(result)
        setWarnings(warns)
        setStep(1)
      } catch (err: unknown) {
        message.error(`Lỗi đọc file: ${(err as Error).message}`)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
    return false
  }, [vienChucs, chucDanhs, donVis, heSos, phuCaps, loaiPhuCaps, message,
      inverseChucVu, inverseVtvl, inverseLoaiLD, inverseTrangThai, inverseNguon])

  // ── Chọn / bỏ chọn ────────────────────────────────────────────────────────

  const toggle = (vcId: string) =>
    setChanges((prev) => prev.map((r) => r.vcId === vcId ? { ...r, selected: !r.selected } : r))
  const toggleAll = (v: boolean) =>
    setChanges((prev) => prev.map((r) => ({ ...r, selected: v })))

  const selectedCount = changes.filter((r) => r.selected).length
  const allSelected = changes.length > 0 && selectedCount === changes.length

  // ── Áp dụng ───────────────────────────────────────────────────────────────

  const handleApply = () => {
    const actorId   = currentUser?.id ?? 'system'
    const actorName = currentUser?.fullName ?? 'Hệ thống'
    const selected  = changes.filter((r) => r.selected)

    for (const rec of selected) {
      if (Object.keys(rec.patchVC).length > 0) {
        updateVienChuc(rec.vcId, rec.patchVC, actorId, actorName)
      }
      if (rec.heSoId && rec.patchHeSo) {
        updateHeSoLuong(rec.heSoId, rec.patchHeSo)
      }
      for (const op of rec.phuCapOps) {
        if (op.action === 'remove' && op.pcId) {
          deactivatePhuCap(op.pcId)
        } else if (op.action === 'update' && op.pcId) {
          const patch: Partial<PhuCapVienChuc> = {}
          if (op.giaTri !== undefined) patch.giaTri = op.giaTri
          if (op.ngayHieuLuc) patch.ngayHieuLuc = op.ngayHieuLuc
          updatePhuCap(op.pcId, patch)
        } else if (op.action === 'add' && op.loaiPhuCapId) {
          addPhuCap({
            vienChucId: rec.vcId,
            loaiPhuCapId: op.loaiPhuCapId,
            giaTri: op.giaTri ?? 0,
            ngayHieuLuc: op.ngayHieuLuc ?? dayjs().format('YYYY-MM-DD'),
            isActive: true,
            createdBy: actorId,
          })
        }
      }

      const detail = rec.changes
        .map((c) => `[${c.nhom}] ${c.label}: "${c.oldDisplay}" → "${c.newDisplay}"`)
        .join('; ')
      logAction(actorId, actorName, 'UPDATE', 'VienChuc', rec.vcId,
        `Import Excel — ${rec.hoTen}: ${detail}`)
    }

    setAppliedCount(selected.length)
    setStep(2)
  }

  const handleClose = () => {
    setStep(0)
    setChanges([])
    setWarnings([])
    setAppliedCount(0)
    setLoading(false)
    onClose()
  }

  // ── Bảng xem xét ──────────────────────────────────────────────────────────

  const NHOM_COLOR: Record<Nhom, string> = {
    'Hồ sơ': 'blue', 'Lương': 'purple', 'Phụ cấp': 'orange',
  }

  const reviewColumns = [
    {
      key: 'sel', width: 44,
      title: () => (
        <Checkbox
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          onChange={(e) => toggleAll(e.target.checked)}
        />
      ),
      render: (_: unknown, r: ChangeRecord) => (
        <Checkbox checked={r.selected} onChange={() => toggle(r.vcId)} />
      ),
    },
    {
      title: 'Họ tên', key: 'ht',
      render: (_: unknown, r: ChangeRecord) => <Text strong>{r.hoTen}</Text>,
    },
    {
      title: 'Đơn vị', dataIndex: 'donViTen', key: 'dv', ellipsis: true,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: 'Nhóm thay đổi', key: 'nhom', width: 200,
      render: (_: unknown, r: ChangeRecord) => {
        const nhoms = [...new Set(r.changes.map((c) => c.nhom))]
        return (
          <Space size={4} wrap>
            {nhoms.map((n) => (
              <Tag key={n} color={NHOM_COLOR[n]} style={{ margin: 0, fontSize: 11 }}>
                {n} ({r.changes.filter((c) => c.nhom === n).length})
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: 'Tổng', key: 'cnt', width: 70, align: 'center' as const,
      render: (_: unknown, r: ChangeRecord) => (
        <Badge count={r.changes.length} color="#fa8c16" style={{ fontWeight: 600 }} />
      ),
    },
  ]

  const expandedRow = (r: ChangeRecord) => (
    <div style={{ padding: '6px 16px' }}>
      {r.changes.map((c) => (
        <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Tag color={NHOM_COLOR[c.nhom]} style={{ margin: 0, fontSize: 10, minWidth: 62, textAlign: 'center' }}>
            {c.nhom}
          </Tag>
          <Text type="secondary" style={{ minWidth: 150, fontSize: 12, flexShrink: 0 }}>
            {c.label}
          </Text>
          <Tag color="error" style={{ fontSize: 12, textDecoration: 'line-through', opacity: 0.85 }}>
            {c.oldDisplay}
          </Tag>
          <Text style={{ color: '#aaa', fontSize: 12 }}>→</Text>
          <Tag color="success" style={{ fontSize: 12 }}>{c.newDisplay}</Tag>
        </div>
      ))}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  const footer =
    step === 0 ? null :
    step === 1 ? (
      <Space>
        <Button onClick={() => setStep(0)}>← Quay lại</Button>
        {changes.length > 0
          ? <Button type="primary" disabled={selectedCount === 0} onClick={handleApply}>
              Xác nhận nhập ({selectedCount}/{changes.length} hồ sơ)
            </Button>
          : <Button onClick={handleClose}>Đóng</Button>
        }
      </Space>
    ) :
    <Button type="primary" onClick={handleClose}>Đóng</Button>

  return (
    <Modal
      open={open}
      title={<Space><UploadOutlined />Nhập dữ liệu viên chức từ Excel</Space>}
      onCancel={handleClose}
      width={950}
      footer={footer}
      destroyOnHidden
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 20 }}
        items={[{ title: 'Chọn file' }, { title: 'Xem xét thay đổi' }, { title: 'Hoàn tất' }]}
      />

      {step === 0 && (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 14 }}
            title="Hướng dẫn sử dụng"
            description={
              <>
                <ol style={{ margin: '4px 0 8px', paddingLeft: 18, lineHeight: 1.8 }}>
                  <li>Nhấn <b>Xuất Excel</b> ở danh sách để tải file chứa dữ liệu hiện tại</li>
                  <li>Chỉnh sửa thông tin trong file, giữ nguyên các cột đánh dấu <b>(không sửa)</b></li>
                  <li>Kéo thả hoặc chọn file đã sửa để hệ thống đối chiếu</li>
                </ol>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  File gồm 3 nhóm: <b>hồ sơ</b>, <b>lương</b> (bậc, hệ số, hệ số bảo lưu, mốc hưởng) và{' '}
                  <b>phụ cấp</b> (vượt khung, chức vụ, trách nhiệm, thâm niên, ưu đãi).
                  Họ và tên xuất ra VIẾT HOA — khi nhập lại, hệ thống so sánh nội dung (không phân biệt hoa/thường).
                  Muốn <b>gỡ một phụ cấp</b>, nhập số <b>0</b> vào ô đó (để trống nghĩa là giữ nguyên).
                </Text>
              </>
            }
          />
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 14 }}
            title="Lưu ý về lương"
            description={
              <Text style={{ fontSize: 13 }}>
                Công cụ này <b>sửa trực tiếp</b> bản ghi lương đang áp dụng — dùng để đính chính
                dữ liệu nhập sai. Việc <b>nâng bậc lương</b> phải thực hiện qua chức năng
                “Đề xuất điều chỉnh Hệ số lương – PCTN” để giữ đúng lịch sử.
              </Text>
            }
          />
          <Dragger
            accept=".xlsx,.xls"
            maxCount={1}
            beforeUpload={parseFile}
            showUploadList={false}
            disabled={loading}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined style={{ fontSize: 36 }} /></p>
            <p className="ant-upload-text" style={{ fontSize: 15 }}>
              {loading ? 'Đang phân tích...' : 'Kéo thả hoặc click để chọn file Excel'}
            </p>
            <p className="ant-upload-hint">Chỉ chấp nhận .xlsx / .xls xuất từ hệ thống này</p>
          </Dragger>
        </>
      )}

      {step === 1 && (
        <>
          {warnings.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              title={`${warnings.length} cảnh báo khi đọc file`}
              description={
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, maxHeight: 100, overflowY: 'auto' }}>
                  {warnings.map((w, i) => <li key={i} style={{ fontSize: 12 }}>{w}</li>)}
                </ul>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {changes.length === 0 ? (
            <Empty description="Không phát hiện thay đổi nào so với dữ liệu hiện tại" style={{ padding: '24px 0' }} />
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <Text>
                  Phát hiện <b>{changes.length}</b> hồ sơ có thay đổi.
                  Mở rộng từng dòng để xem chi tiết, bỏ chọn hồ sơ <i>không</i> muốn cập nhật.
                </Text>
              </div>
              <Table<ChangeRecord>
                dataSource={changes}
                columns={reviewColumns}
                rowKey="vcId"
                size="small"
                bordered
                expandable={{
                  expandedRowRender: expandedRow,
                  defaultExpandAllRows: changes.length <= 8,
                }}
                pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (t) => `${t} hồ sơ có thay đổi` }}
                scroll={{ y: 380 }}
              />
            </>
          )}
        </>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 52, color: '#52c41a', marginBottom: 14, display: 'block' }} />
          <Title level={4} style={{ marginBottom: 6 }}>Nhập thành công!</Title>
          <Text style={{ fontSize: 15 }}>Đã cập nhật <b>{appliedCount}</b> hồ sơ viên chức.</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 13 }}>
            Chi tiết thay đổi đã được ghi vào nhật ký thao tác hệ thống.
          </Text>
        </div>
      )}
    </Modal>
  )
}

// ── Nút xuất ─────────────────────────────────────────────────────────────────

export function ExportExcelButton({ vienChucs }: { vienChucs: VienChuc[] }) {
  const { message } = App.useApp()
  const donVis      = useDanhMucStore((s) => s.donVis)
  const chucDanhs   = useDanhMucStore((s) => s.chucDanhs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const heSos       = useLuongStore((s) => s.heSoLuongs)
  const phuCaps     = useLuongStore((s) => s.phuCapVienChucs)

  return (
    <Button
      icon={<DownloadOutlined />}
      onClick={() => {
        exportVienChucTemplate(vienChucs, donVis, chucDanhs, heSos, phuCaps, loaiPhuCaps)
        message.success(`Đã xuất ${vienChucs.length} hồ sơ`)
      }}
    >
      Xuất Excel
    </Button>
  )
}
