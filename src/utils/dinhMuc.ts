import type { LoaiDonVi, HangTruong } from '@/types/donVi'
import type { VienChuc } from '@/types/vienChuc'
import type { QuyMoTruong } from '@/types/quyMo'
import type { NhomChucDanh } from '@/types/danhMuc'
import { duocTinhSoLieu } from '@/types/vienChuc'
import { getHangTruong } from './hangTruong'
import { doanCongViec, nhomCoBan } from './nhomViTri'

// Định mức số lượng người làm việc:
// - Mầm non: Thông tư 19/2023/TT-BGDĐT
// - Tiểu học, THCS: Thông tư 20/2023/TT-BGDĐT
// Hệ số, sĩ số chuẩn và số tiết lấy đúng theo mẫu "Cơ cấu nhu cầu lao động 3 cấp" của phường.
// Nhân viên phục vụ (bảo vệ, nấu ăn, phục vụ, lao công) không tính định mức.

export type CapHoc = 'MAM_NON' | 'TIEU_HOC' | 'THCS'
export const laCapHoc = (loai?: LoaiDonVi): loai is CapHoc =>
  loai === 'MAM_NON' || loai === 'TIEU_HOC' || loai === 'THCS'

export const TEN_CAP: Record<CapHoc, string> = { MAM_NON: 'Mầm non', TIEU_HOC: 'Tiểu học', THCS: 'THCS' }
export const THU_TU_CAP: Record<CapHoc, number> = { MAM_NON: 1, TIEU_HOC: 2, THCS: 3 }

/** Năm học bắt đầu từ tháng 9 */
export function namHocHienHanh(d = new Date()): string {
  const y = d.getFullYear()
  return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

/** Năm học đầu tiên khai báo quy mô trên phần mềm */
export const NAM_HOC_DAU = '2026-2027'

/** Các năm học chọn được: từ năm học đầu tiên đến năm học sau năm hiện hành */
export function dsNamHoc(): string[] {
  const dau = Number(NAM_HOC_DAU.slice(0, 4))
  const cuoi = Number(namHocHienHanh().slice(0, 4)) + 1
  const ra: string[] = []
  for (let y = dau; y <= cuoi; y++) ra.push(`${y}-${y + 1}`)
  return ra
}

export const idQuyMo = (donViId: string, namHoc: string) => `${donViId}__${namHoc}`

export const KHOI: Record<CapHoc, { ma: string; ten: string }[]> = {
  MAM_NON: [
    { ma: 'NHA_TRE', ten: 'Nhà trẻ (nhóm trẻ)' },
    { ma: 'MG3', ten: 'Mẫu giáo 3 tuổi' },
    { ma: 'MG4', ten: 'Mẫu giáo 4 tuổi' },
    { ma: 'MG5', ten: 'Mẫu giáo 5 tuổi' },
  ],
  TIEU_HOC: [1, 2, 3, 4, 5].map((k) => ({ ma: `L${k}`, ten: `Khối ${k}` })),
  THCS: [6, 7, 8, 9].map((k) => ({ ma: `L${k}`, ten: `Khối ${k}` })),
}

/** Cấp học khai báo thêm số lớp, số học sinh học 2 buổi/ngày */
export const CO_HAI_BUOI: Record<CapHoc, boolean> = { MAM_NON: false, TIEU_HOC: true, THCS: true }

/** Tiểu học: khối 1, 2 tính Tin học khi trường có dạy */
export const KHOI_TIN_TU_CHON = ['L1', 'L2']

export const THAM_SO = {
  MAM_NON: { gvNhaTre: 2.5, gvMauGiao: 2.2 },
  TIEU_HOC: { gvLop1Buoi: 1.2, gvLop2Buoi: 1.5, siSoChuan: 35, hsDuMoiGv: 17, tietChuan: 23 },
  THCS: { gvMoiLop: 1.9, siSoChuan: 45, hsDuMoiGv: 22, tietChuan: 19, tietChuNhiem: 4 },
} as const

interface MonHoc { ma: string; ten: string; tenNgan: string; tiet: number[] }

// Số tiết/tuần theo từng khối (Chương trình GDPT 2018).
// Tin học bắt buộc từ khối 3; khối 1, 2 tính 1 tiết/tuần nếu trường có dạy (khoiDayTinThem).
const MON_TIEU_HOC: MonHoc[] = [
  { ma: 'NGOAI_NGU', ten: 'Giáo viên Ngoại ngữ', tenNgan: 'Ngoại ngữ', tiet: [2, 2, 4, 4, 4] },
  { ma: 'NGHE_THUAT', ten: 'Giáo viên Nghệ thuật (Âm nhạc, Mĩ thuật)', tenNgan: 'Nghệ thuật', tiet: [2, 2, 2, 2, 2] },
  { ma: 'TIN_HOC', ten: 'Giáo viên Tin học', tenNgan: 'Tin học', tiet: [0, 0, 1, 1, 1] },
  { ma: 'GDTC', ten: 'Giáo viên GDTC', tenNgan: 'GDTC', tiet: [2, 2, 2, 2, 2] },
]

const MON_THCS: MonHoc[] = [
  { ma: 'TOAN', ten: 'Giáo viên Toán', tenNgan: 'Toán', tiet: [4, 4, 4, 4] },
  { ma: 'KHTN', ten: 'Giáo viên Khoa học tự nhiên (Lý, Hóa, Sinh)', tenNgan: 'KHTN', tiet: [4, 4, 4, 4] },
  { ma: 'NGU_VAN', ten: 'Giáo viên Ngữ văn', tenNgan: 'Ngữ văn', tiet: [4, 4, 4, 4] },
  { ma: 'LS_DL', ten: 'Giáo viên Lịch sử và Địa lí', tenNgan: 'LS-ĐL', tiet: [3, 3, 3, 3] },
  { ma: 'GDCD', ten: 'Giáo viên Giáo dục công dân', tenNgan: 'GDCD', tiet: [1, 1, 1, 1] },
  { ma: 'NGHE_THUAT', ten: 'Giáo viên Nghệ thuật (Âm nhạc, Mĩ thuật)', tenNgan: 'Nghệ thuật', tiet: [2, 2, 2, 2] },
  { ma: 'GDTC', ten: 'Giáo viên GDTC', tenNgan: 'GDTC', tiet: [2, 2, 2, 2] },
  { ma: 'CONG_NGHE', ten: 'Giáo viên Công nghệ', tenNgan: 'Công nghệ', tiet: [1, 1, 1.5, 1.5] },
  { ma: 'NGOAI_NGU', ten: 'Giáo viên Ngoại ngữ', tenNgan: 'Ngoại ngữ', tiet: [3, 3, 3, 3] },
  { ma: 'TIN_HOC', ten: 'Giáo viên Tin học', tenNgan: 'Tin học', tiet: [1, 1, 1, 1] },
]

// Không có vị trí việc làm riêng - giáo viên các môn dạy kiêm
const MON_KIEM_THCS: MonHoc[] = [
  { ma: 'GDDP', ten: 'Giáo dục địa phương', tenNgan: 'GDĐP', tiet: [1, 1, 1, 1] },
  { ma: 'HDTN', ten: 'Hoạt động trải nghiệm, hướng nghiệp', tenNgan: 'HĐTN-HN', tiet: [3, 3, 3, 3] },
]

const TPT = { ma: 'TONG_PHU_TRACH', ten: 'Giáo viên Tổng phụ trách Đội', tenNgan: 'Tổng phụ trách' }
const VAN_HOA = { ma: 'VAN_HOA', ten: 'Giáo viên Văn hóa', tenNgan: 'Văn hóa' }

/**
 * Mầm non không phân môn: phân công giáo viên theo nhóm, lớp độ tuổi (đúng các khối khai quy mô) hoặc dạy chuyên.
 * Chỉ để theo dõi, lập danh sách - định mức giáo viên mầm non vẫn tính chung theo số nhóm, lớp (TT 19/2023).
 */
export const PHAN_CONG_MAM_NON = [
  { ma: 'MN_NHA_TRE', ten: 'Nhà trẻ (nhóm trẻ)', khoi: 'NHA_TRE' },
  { ma: 'MN_MG3', ten: 'Mẫu giáo 3 tuổi', khoi: 'MG3' },
  { ma: 'MN_MG4', ten: 'Mẫu giáo 4 tuổi', khoi: 'MG4' },
  { ma: 'MN_MG5', ten: 'Mẫu giáo 5 tuổi', khoi: 'MG5' },
  { ma: 'MN_DAY_CHUYEN', ten: 'Dạy chuyên (năng khiếu, ngoại ngữ...)', khoi: undefined },
] as const

/** Lựa chọn "Môn giảng dạy" cho giáo viên theo cấp học (mầm non: nhóm, lớp phụ trách) */
export const MON_GIANG_DAY: Record<CapHoc, { ma: string; ten: string }[]> = {
  MAM_NON: PHAN_CONG_MAM_NON.map((m) => ({ ma: m.ma, ten: m.ten })),
  TIEU_HOC: [VAN_HOA, ...MON_TIEU_HOC, TPT].map((m) => ({ ma: m.ma, ten: m.tenNgan })),
  THCS: [...MON_THCS, TPT].map((m) => ({ ma: m.ma, ten: m.tenNgan })),
}

export function tenMonDay(ma?: string): string | undefined {
  if (!ma) return undefined
  for (const ds of Object.values(MON_GIANG_DAY)) {
    const m = ds.find((x) => x.ma === ma)
    if (m) return m.ten
  }
  return ma
}

export type NhomDinhMuc = 'QUAN_LY' | 'CHUYEN_MON' | 'HO_TRO' | 'NGOAI_DM'

/** Khung VTVL đơn vị sự nghiệp giáo dục cấp xã - Sở Nội vụ Hải Phòng (Phụ lục 1A mầm non, 1B tiểu học, 1C THCS) */
export const NHOM_DINH_MUC: { key: NhomDinhMuc; ten: string }[] = [
  { key: 'QUAN_LY', ten: 'I. Vị trí việc làm lãnh đạo, quản lý' },
  { key: 'CHUYEN_MON', ten: 'II. Vị trí việc làm chuyên môn nghiệp vụ' },
  { key: 'HO_TRO', ten: 'III. Vị trí việc làm hỗ trợ' },
  { key: 'NGOAI_DM', ten: 'Ngoài danh mục VTVL (bảo vệ, phục vụ, lao công - không tính định mức)' },
]

interface ViTri {
  ma: string
  ten: string
  nhom: NhomDinhMuc
  laGiaoVien?: boolean
  /** Định mức cố định; null = mẫu không có công thức, trường nhập tay nếu có căn cứ */
  coDinh?: number | null
  canCu?: string
  /** Số người tối đa trường được điều chỉnh (VD kế toán 01 người/trường) */
  toiDa?: number
  /** Không tính định mức biên chế (lao động hợp đồng, ngoài danh mục) */
  khongDinhMuc?: boolean
  /** Tổ trưởng, tổ phó: đếm người giữ chức vụ để theo dõi, số đã nằm trong định mức giáo viên */
  trongGv?: boolean
}

const CBQL: ViTri[] = [
  { ma: 'HT', ten: 'Hiệu trưởng', nhom: 'QUAN_LY', coDinh: 1, canCu: '01 người/trường' },
  { ma: 'PHT', ten: 'Phó Hiệu trưởng', nhom: 'QUAN_LY' },
  { ma: 'TO_TRUONG', ten: 'Tổ trưởng tổ chuyên môn và tương đương', nhom: 'QUAN_LY', trongGv: true, canCu: 'Thuộc định mức giáo viên - chỉ theo dõi số người giữ chức vụ' },
  { ma: 'TO_PHO', ten: 'Tổ phó tổ chuyên môn và tương đương', nhom: 'QUAN_LY', trongGv: true, canCu: 'Thuộc định mức giáo viên - chỉ theo dõi số người giữ chức vụ' },
]

const NGOAI_DM: ViTri[] = [
  { ma: 'BAO_VE', ten: 'Nhân viên bảo vệ', nhom: 'NGOAI_DM', khongDinhMuc: true },
  { ma: 'LAO_CONG', ten: 'Nhân viên phục vụ, lao công', nhom: 'NGOAI_DM', khongDinhMuc: true },
]
const NAU_AN_NGOAI: ViTri = { ma: 'NAU_AN', ten: 'Nhân viên nấu ăn', nhom: 'NGOAI_DM', khongDinhMuc: true }

const HO_TRO_KT: ViTri = {
  ma: 'HO_TRO_KT', ten: 'Hỗ trợ giáo dục người khuyết tật', nhom: 'HO_TRO',
  coDinh: null, canCu: 'Tối đa 02 người, theo số học sinh khuyết tật học hòa nhập',
}
const nv = (ma: string, ten: string, coDinh: number | null, canCu?: string, toiDa?: number): ViTri =>
  ({ ma, ten, nhom: 'HO_TRO', coDinh, canCu, toiDa })
const KIEM = 'Kiêm nhiệm - nhập tay nếu được duyệt bố trí riêng'
const KE_TOAN = nv('KE_TOAN', 'Kế toán', 1, '01 người/trường', 1)
const Y_TE = nv('Y_TE', 'Y tế trường học', null, 'Khung bố trí cho các trường khu vực phía Tây Hải Phòng; trường khác kiêm nhiệm hoặc hợp đồng')
const THU_QUY = nv('THU_QUY', 'Thủ quỹ', 0, KIEM)
const LUU_TRU = nv('LUU_TRU', 'Lưu trữ', 0, KIEM)
const QUAN_TRI_CS = nv('QUAN_TRI_CS', 'Quản trị công sở', 0, KIEM)
const TCCB_TDKT = nv('TCCB_TDKT', 'Tổ chức cán bộ, thi đua khen thưởng', 0, KIEM)
const CNTT_CDS = nv('CNTT_CDS', 'Ứng dụng công nghệ thông tin và chuyển đổi số', 0, KIEM)

/** Mầm non: thư viện 01 người/phân hiệu (điểm trường), tối đa 03 */
export const THU_VIEN_MN_TOI_DA = 3

const VI_TRI: Record<CapHoc, ViTri[]> = {
  // Phụ lục 1A
  MAM_NON: [
    ...CBQL,
    { ma: 'GV_MN', ten: 'Giáo viên mầm non', nhom: 'CHUYEN_MON', laGiaoVien: true },
    KE_TOAN,
    nv('VAN_THU', 'Văn thư', null, 'Bố trí kiêm nhiệm hoặc hợp đồng'),
    HO_TRO_KT,
    Y_TE,
    { ma: 'NAU_AN', ten: 'Cấp dưỡng trong cơ sở giáo dục', nhom: 'HO_TRO', khongDinhMuc: true, canCu: 'Lao động hợp đồng - không tính định mức biên chế' },
    THU_QUY,
    LUU_TRU,
    nv('THU_VIEN', 'Thư viện', null, undefined, THU_VIEN_MN_TOI_DA),
    TCCB_TDKT,
    CNTT_CDS,
    ...NGOAI_DM,
  ],
  // Phụ lục 1B
  TIEU_HOC: [
    ...CBQL,
    { ...VAN_HOA, nhom: 'CHUYEN_MON', laGiaoVien: true },
    ...MON_TIEU_HOC.map((m): ViTri => ({ ma: m.ma, ten: m.ten, nhom: 'CHUYEN_MON', laGiaoVien: true })),
    { ma: TPT.ma, ten: TPT.ten, nhom: 'CHUYEN_MON', laGiaoVien: true },
    KE_TOAN,
    nv('VAN_THU', 'Văn thư', 1),
    HO_TRO_KT,
    Y_TE,
    nv('GIAO_VU', 'Giáo vụ', 1),
    nv('TU_VAN', 'Tư vấn học sinh', 1),
    THU_QUY,
    LUU_TRU,
    nv('THU_VIEN', 'Thư viện', 1, '01-02 người'),
    QUAN_TRI_CS,
    TCCB_TDKT,
    CNTT_CDS,
    nv('THIET_BI', 'Thiết bị', null, 'Không có trong khung tiểu học - bố trí kiêm nhiệm'),
    NAU_AN_NGOAI,
    ...NGOAI_DM,
  ],
  // Phụ lục 1C
  THCS: [
    ...CBQL,
    ...MON_THCS.map((m): ViTri => ({ ma: m.ma, ten: m.ten, nhom: 'CHUYEN_MON', laGiaoVien: true })),
    { ma: TPT.ma, ten: TPT.ten, nhom: 'CHUYEN_MON', laGiaoVien: true },
    KE_TOAN,
    nv('VAN_THU', 'Văn thư', 1),
    HO_TRO_KT,
    Y_TE,
    nv('GIAO_VU', 'Giáo vụ', 1),
    nv('TU_VAN', 'Tư vấn học sinh', 1),
    nv('THIET_BI', 'Thiết bị - thí nghiệm', 1),
    THU_QUY,
    LUU_TRU,
    nv('THU_VIEN', 'Thư viện', 1, '01-02 người'),
    QUAN_TRI_CS,
    TCCB_TDKT,
    CNTT_CDS,
    NAU_AN_NGOAI,
    ...NGOAI_DM,
  ],
}

const CHUA_PHAN_MON = 'CHUA_PHAN_MON'
const NV_KHAC = 'NV_KHAC'

export interface DongDinhMuc {
  ma: string
  ten: string
  nhom: NhomDinhMuc
  laGiaoVien: boolean
  /** Theo công thức; null khi không có công thức */
  dinhMucTinh: number | null
  dinhMucNhapTay?: number
  /** Định mức áp dụng = nhập tay nếu có, không thì theo công thức */
  dinhMuc: number | null
  canCu: string
  coMatVC: number
  coMatHD: number
  coMat: number
  /** Có mặt − định mức: dương là thừa, âm là thiếu */
  chenhLech: number | null
  /** Dòng chỉ hiện khi có người (giáo viên chưa phân môn, nhân viên chưa rõ công việc) */
  dongPhu?: boolean
  /** Số người tối đa được điều chỉnh */
  toiDa?: number
  /** THCS: định mức môn = đứng lớp + kiêm nhiệm phân bổ (trường điều chỉnh ở bảng phân bổ) */
  phanBoKiem?: boolean
  /** Không tính định mức biên chế (lao động hợp đồng, ngoài danh mục) */
  khongDinhMuc?: boolean
  /** Tổ trưởng, tổ phó: chỉ theo dõi, đã nằm trong định mức giáo viên - không cộng vào tổng */
  trongGv?: boolean
}

/** THCS: một môn trong bảng phân bổ giáo viên kiêm nhiệm */
export interface DongPhanBoKiem {
  ma: string
  ten: string
  tietTuan: number
  /** Số giáo viên đứng lớp = tiết/tuần ÷ định mức tiết */
  dungLop: number
  /** Hệ thống gợi ý: chia toàn bộ phần kiêm nhiệm theo tỷ lệ giờ đứng lớp */
  goiY: number
  /** Trường tự điều chỉnh */
  nhapTay?: number
  /** Áp dụng = nhập tay, không thì chia phần còn lại cho các môn chưa điều chỉnh */
  apDung: number
  dinhMuc: number
}

export interface PhanBoKiemNhiem {
  /** Tổng số giáo viên kiêm nhiệm cần phân bổ = định mức GV − đứng lớp các môn − Tổng phụ trách */
  tong: number
  kiemDay: number
  chuNhiem: number
  khac: number
  daPhanBo: number
  /** Tổng − đã phân bổ: dương là còn thiếu, âm là phân bổ vượt */
  conLai: number
  /** Đã phân bổ khớp tổng (sai số dưới 0,05) */
  khop: boolean
  soMonDieuChinh: number
  dong: DongPhanBoKiem[]
}

/** Cộng theo nhóm vị trí việc làm (I-III và ngoài danh mục) */
export interface TongNhom {
  nhom: NhomDinhMuc
  ten: string
  /** Nhóm ngoài danh mục không áp dụng định mức */
  apDungDinhMuc: boolean
  dinhMucTinh: number
  dinhMuc: number
  coMatVC: number
  coMatHD: number
  coMat: number
  /** Có mặt dùng để so với định mức: vị trí có định mức (kể cả giáo viên chưa phân môn) */
  coMatSoSanh: number
  /** Có mặt ở vị trí không có định mức - không đưa vào so sánh */
  coMatNgoai: number
  chenhLech: number | null
}

export interface KetQuaDinhMuc {
  cap: CapHoc
  tongLop: number
  tongHS: number
  tongLop2Buoi: number
  tongHS2Buoi: number
  binhQuan: number
  hang: HangTruong
  dienGiai: string[]
  dong: DongDinhMuc[]
  gvDinhMuc: number
  gvCoMat: number
  tongDinhMuc: number
  tongCoMat: number
  /** Có mặt ở các vị trí I-III có định mức, kể cả giáo viên chưa phân môn (tổ trưởng, tổ phó không đếm lại) */
  coMatCoDinhMuc: number
  chuaPhanMon: number
  /** Chỉ THCS */
  phanBoKiem?: PhanBoKiemNhiem
  tongNhom: TongNhom[]
  /** Toàn trường, cả ngoài danh mục */
  toanTruong: { coMatVC: number; coMatHD: number; coMat: number }
  /** Có mặt theo nhóm và nguồn - đối chiếu chỉ tiêu biên chế, hợp đồng được giao */
  coMatNguon: Record<NhomDinhMuc, CoMatNguon>
}

/** Biên chế (viên chức, tập sự) chia theo nguồn kinh phí; hợp đồng chia NĐ 235 và loại khác */
export interface CoMatNguon { nganSach: number; suNghiep: number; bcChuaRoNguon: number; hd235: number; hdKhac: number }

export const lamTron1 = (n: number) => Math.round(n * 10) / 10
export const fmt = (n: number | null | undefined) =>
  n == null ? '-' : lamTron1(n).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

/**
 * Chia `tong` theo tỷ lệ `trongSo`, làm tròn 0,1 mà tổng vẫn khớp (phương pháp phần dư lớn nhất)
 */
export function chiaTheoTyLe(tong: number, trongSo: number[]): number[] {
  const tongTs = trongSo.reduce((a, b) => a + b, 0)
  if (tong <= 0 || !tongTs) return trongSo.map(() => 0)
  const dv = Math.round(tong * 10)
  const tho = trongSo.map((w) => (dv * w) / tongTs)
  const nguyen = tho.map(Math.floor)
  let du = dv - nguyen.reduce((a, b) => a + b, 0)
  const thuTu = tho.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of thuTu) {
    if (du <= 0) break
    nguyen[i]++
    du--
  }
  return nguyen.map((n) => n / 10)
}

const laBienChe = (vc: VienChuc) => vc.loaiLaoDong === 'VIEN_CHUC' || vc.loaiLaoDong === 'TAP_SU'

const VTVL_CHUAN = ['CBQL', 'GIAO_VIEN', 'NHAN_VIEN']
const laVtvlChuan = (vtvl?: string) => !!vtvl && VTVL_CHUAN.includes(vtvl)

export interface ChucDanhTra { ten: string; nhom: NhomChucDanh }

/**
 * Nhóm CBQL / giáo viên / nhân viên của một người. Một số hồ sơ ghi ô VTVL bằng chữ
 * ("Giáo viên âm nhạc", "Cán bộ quản lý - Giáo viên văn hóa") thay vì mã chuẩn,
 * nên xét lần lượt: chức vụ, mã chuẩn, chữ trong ô, rồi nhóm ngạch.
 */
export function nhomNguoi(vc: Pick<VienChuc, 'chucVu' | 'vtvl'>, nhomChucDanh?: NhomChucDanh): 'CBQL' | 'GIAO_VIEN' | 'NHAN_VIEN' {
  return nhomCoBan(vc, nhomChucDanh)
}

/** Vị trí để đếm "có mặt" của một người theo cấp học */
export function viTriCuaNguoi(vc: VienChuc, cap: CapHoc, chucDanh?: ChucDanhTra): string {
  if (vc.chucVu === 'HT') return 'HT'
  const nhom = nhomNguoi(vc, chucDanh?.nhom)
  if (nhom === 'CBQL') return 'PHT'
  if (nhom === 'GIAO_VIEN') {
    if (cap === 'MAM_NON') return 'GV_MN'
    return vc.monDay && MON_GIANG_DAY[cap].some((m) => m.ma === vc.monDay) ? vc.monDay : CHUA_PHAN_MON
  }
  const cv = vc.congViec ?? doanCongViec(vc.nhiemVuChinh, chucDanh?.ten)
  return cv && cv !== 'KHAC' ? cv : NV_KHAC
}

/** Số tiết/tuần của môn theo khối; Tin học tiểu học cộng khối 1, 2 nếu trường có dạy */
function tietTheoKhoi(quyMo: QuyMoTruong, cap: CapHoc, mon: MonHoc): number[] {
  if (cap !== 'TIEU_HOC' || mon.ma !== 'TIN_HOC') return mon.tiet
  return mon.tiet.map((t, i) => (quyMo.khoiDayTinThem?.includes(KHOI[cap][i].ma) ? 1 : t))
}

const soTiet = (quyMo: QuyMoTruong, cap: CapHoc, mon: MonHoc) => {
  const tiet = tietTheoKhoi(quyMo, cap, mon)
  return KHOI[cap].reduce((s, k, i) => s + (quyMo.khoi[k.ma]?.soLop ?? 0) * (tiet[i] ?? 0), 0)
}

export function tongQuyMo(quyMo: QuyMoTruong | undefined, cap: CapHoc) {
  let tongLop = 0, tongHS = 0, tongLop2Buoi = 0, tongHS2Buoi = 0
  for (const k of KHOI[cap]) {
    const o = quyMo?.khoi[k.ma]
    const lop = o?.soLop ?? 0
    const hs = o?.soHocSinh ?? 0
    tongLop += lop
    tongHS += hs
    if (CO_HAI_BUOI[cap]) {
      tongLop2Buoi += Math.min(o?.soLop2Buoi ?? 0, lop)
      tongHS2Buoi += Math.min(o?.soHocSinh2Buoi ?? 0, hs)
    }
  }
  return {
    tongLop, tongHS, tongLop2Buoi, tongHS2Buoi,
    binhQuan: tongLop ? tongHS / tongLop : 0,
    hang: getHangTruong(cap, tongLop),
  }
}

export function tinhDinhMuc(
  cap: CapHoc,
  quyMo: QuyMoTruong,
  nhanSuTruong: VienChuc[],
  layChucDanh: (id?: string) => ChucDanhTra | undefined,
): KetQuaDinhMuc {
  const { tongLop, tongHS, tongLop2Buoi, tongHS2Buoi, binhQuan, hang } = tongQuyMo(quyMo, cap)
  const lop = (ma: string) => quyMo.khoi[ma]?.soLop ?? 0
  const tinh: Record<string, number> = {}
  const canCu: Record<string, string> = {}
  const dienGiai: string[] = []

  tinh.PHT = hang === 3 ? 1 : 2
  canCu.PHT = `Hạng ${hang === 1 ? 'I' : hang === 2 ? 'II' : 'III'} (${tongLop} lớp): hạng I, II bố trí 02, hạng III bố trí 01`

  if (cap === 'MAM_NON') {
    const t = THAM_SO.MAM_NON
    const nhaTre = lop('NHA_TRE')
    const mauGiao = lop('MG3') + lop('MG4') + lop('MG5')
    tinh.GV_MN = nhaTre * t.gvNhaTre + mauGiao * t.gvMauGiao
    const diemTruong = Math.max(1, quyMo.soDiemTruong ?? 1)
    tinh.THU_VIEN = Math.min(diemTruong, THU_VIEN_MN_TOI_DA)
    canCu.THU_VIEN = `01 người/phân hiệu: ${diemTruong} phân hiệu${quyMo.soDiemTruong ? '' : ' (chưa khai, tính 01)'} - tối đa 0${THU_VIEN_MN_TOI_DA}`
    canCu.GV_MN = `${nhaTre} nhóm trẻ × 2,5 + ${mauGiao} lớp mẫu giáo × 2,2`
    dienGiai.push(
      `Nhà trẻ: ${nhaTre} nhóm × ${fmt(t.gvNhaTre)} = ${fmt(nhaTre * t.gvNhaTre)} giáo viên`,
      `Mẫu giáo: ${mauGiao} lớp × ${fmt(t.gvMauGiao)} = ${fmt(mauGiao * t.gvMauGiao)} giáo viên`,
      `Tổng định mức giáo viên: ${fmt(tinh.GV_MN)} (TT 19/2023/TT-BGDĐT)`,
    )
  }

  if (cap === 'TIEU_HOC') {
    const t = THAM_SO.TIEU_HOC
    const lop2B = tongLop2Buoi
    const lop1B = tongLop - lop2B
    const gvLop = lop1B * t.gvLop1Buoi + lop2B * t.gvLop2Buoi
    const hsDu = Math.max(0, tongHS - tongLop * t.siSoChuan)
    const gvDu = hsDu / t.hsDuMoiGv
    const tongGV = gvLop + gvDu
    let mon = 0
    for (const m of MON_TIEU_HOC) {
      const tiet = soTiet(quyMo, cap, m)
      tinh[m.ma] = tiet / t.tietChuan
      canCu[m.ma] = `${fmt(tiet)} tiết/tuần ÷ ${t.tietChuan}`
      mon += tinh[m.ma]
    }
    const tinThem = (quyMo.khoiDayTinThem ?? []).filter((k) => KHOI_TIN_TU_CHON.includes(k)).map((k) => k.slice(1))
    canCu.TIN_HOC += tinThem.length ? ` (khối ${tinThem.join(', ')}, 3-5)` : ' (khối 3-5)'
    tinh.TONG_PHU_TRACH = 1
    canCu.TONG_PHU_TRACH = '01 người/trường, tính trong định mức giáo viên'
    tinh.VAN_HOA = Math.max(0, tongGV - mon - 1)
    canCu.VAN_HOA = 'Tổng định mức giáo viên trừ Ngoại ngữ, Nghệ thuật, Tin học, GDTC và Tổng phụ trách'
    dienGiai.push(
      `Theo lớp: ${lop1B} lớp 1 buổi × ${fmt(t.gvLop1Buoi)} + ${lop2B} lớp 2 buổi × ${fmt(t.gvLop2Buoi)} = ${fmt(gvLop)} giáo viên`,
      hsDu > 0
        ? `Học sinh vượt sĩ số ${t.siSoChuan}/lớp: ${hsDu} em ÷ ${t.hsDuMoiGv} = ${fmt(gvDu)} giáo viên tăng thêm`
        : `Sĩ số bình quân ${fmt(binhQuan)} em/lớp, không vượt ${t.siSoChuan} - không tính giáo viên tăng thêm`,
      `Tổng định mức giáo viên: ${fmt(tongGV)} (TT 20/2023/TT-BGDĐT), gồm cả Tổng phụ trách Đội`,
    )
  }

  let phanBoKiem: PhanBoKiemNhiem | undefined
  if (cap === 'THCS') {
    const t = THAM_SO.THCS
    const gvLop = tongLop * t.gvMoiLop
    const hsDu = Math.max(0, tongHS - tongLop * t.siSoChuan)
    const gvDu = hsDu / t.hsDuMoiGv
    const tongGV = gvLop + gvDu
    const tietMon = MON_THCS.map((m) => soTiet(quyMo, cap, m))
    const dungLop = tietMon.map((x) => x / t.tietChuan)
    const tongDungLop = dungLop.reduce((a, b) => a + b, 0)
    const kiemDay = MON_KIEM_THCS.reduce((s, m) => s + soTiet(quyMo, cap, m), 0) / t.tietChuan
    const chuNhiem = (tongLop * t.tietChuNhiem) / t.tietChuan
    // Phần ngoài giờ đứng lớp của các môn có vị trí riêng: dạy kiêm GDĐP, HĐTN-HN, chủ nhiệm, kiêm nhiệm khác.
    // Hệ thống gợi ý chia theo tỷ lệ giờ đứng lớp; trường điều chỉnh được từng môn, môn chưa điều chỉnh
    // nhận phần còn lại theo cùng tỷ lệ để tổng các môn vẫn khớp tổng định mức.
    const phanBo = lamTron1(Math.max(0, tongGV - tongDungLop - 1))
    const goiY = chiaTheoTyLe(phanBo, dungLop)
    // Bản cũ điều chỉnh thẳng định mức môn → quy về số kiêm nhiệm
    const tay = (ma: string, i: number): number | undefined => {
      const k = quyMo.kiemNhiemNhapTay?.[ma]
      if (k != null) return k
      const cu = quyMo.dinhMucNhapTay?.[ma]
      return cu != null ? lamTron1(Math.max(0, cu - dungLop[i])) : undefined
    }
    const nhapTay = MON_THCS.map((m, i) => tay(m.ma, i))
    const daChinh = nhapTay.reduce<number>((s, v) => s + (v ?? 0), 0)
    const conChia = chiaTheoTyLe(
      Math.max(0, lamTron1(phanBo - daChinh)),
      dungLop.map((d, i) => (nhapTay[i] == null ? d : 0)),
    )
    const dongPb: DongPhanBoKiem[] = MON_THCS.map((m, i) => {
      const apDung = nhapTay[i] ?? conChia[i]
      return {
        ma: m.ma, ten: m.tenNgan, tietTuan: tietMon[i], dungLop: dungLop[i],
        goiY: goiY[i], nhapTay: nhapTay[i], apDung, dinhMuc: dungLop[i] + apDung,
      }
    })
    const daPhanBo = lamTron1(dongPb.reduce((s, d) => s + d.apDung, 0))
    phanBoKiem = {
      tong: phanBo, kiemDay, chuNhiem, khac: Math.max(0, phanBo - kiemDay - chuNhiem),
      daPhanBo, conLai: lamTron1(phanBo - daPhanBo), khop: Math.abs(phanBo - daPhanBo) < 0.05,
      soMonDieuChinh: nhapTay.filter((v) => v != null).length, dong: dongPb,
    }
    for (const d of dongPb) {
      tinh[d.ma] = d.dungLop + d.goiY
      canCu[d.ma] = `Đứng lớp ${fmt(d.dungLop)} + kiêm nhiệm phân bổ ${fmt(d.apDung)}${d.nhapTay != null ? ' (trường điều chỉnh)' : ''}`
    }
    tinh.TONG_PHU_TRACH = 1
    canCu.TONG_PHU_TRACH = '01 người/trường, tính trong định mức giáo viên'
    dienGiai.push(
      `Theo lớp: ${tongLop} lớp × ${fmt(t.gvMoiLop)} = ${fmt(gvLop)} giáo viên`,
      hsDu > 0
        ? `Học sinh vượt sĩ số ${t.siSoChuan}/lớp: ${hsDu} em ÷ ${t.hsDuMoiGv} = ${fmt(gvDu)} giáo viên tăng thêm`
        : `Sĩ số bình quân ${fmt(binhQuan)} em/lớp, không vượt ${t.siSoChuan} - không tính giáo viên tăng thêm`,
      `Tổng định mức giáo viên: ${fmt(tongGV)} (TT 20/2023/TT-BGDĐT), gồm cả Tổng phụ trách Đội`,
      `Trong đó đứng lớp các môn: ${fmt(tongDungLop)}; kiêm nhiệm cần phân bổ: ${fmt(phanBo)} (dạy kiêm GDĐP, HĐTN-HN ${fmt(kiemDay)}; chủ nhiệm ${t.tietChuNhiem} tiết/lớp ${fmt(chuNhiem)}; kiêm nhiệm khác ${fmt(phanBoKiem.khac)})`,
      `Phần kiêm nhiệm hệ thống gợi ý chia theo tỷ lệ giờ đứng lớp (định mức tiết ${t.tietChuan}/tuần); trường điều chỉnh ở bảng "Phân bổ giáo viên kiêm nhiệm"`,
    )
  }

  // Đếm có mặt theo vị trí
  const dem = new Map<string, { vc: number; hd: number }>()
  const nhomCuaMa = new Map(VI_TRI[cap].map((v) => [v.ma, v.nhom]))
  const coMatNguon = Object.fromEntries(NHOM_DINH_MUC.map((n) => [n.key, { nganSach: 0, suNghiep: 0, bcChuaRoNguon: 0, hd235: 0, hdKhac: 0 }])) as Record<NhomDinhMuc, CoMatNguon>
  for (const vc of nhanSuTruong) {
    if (!duocTinhSoLieu(vc)) continue
    const ma = viTriCuaNguoi(vc, cap, layChucDanh(vc.chucDanhId))
    const nhomNg: NhomDinhMuc = nhomCuaMa.get(ma) ?? (ma === CHUA_PHAN_MON ? 'CHUYEN_MON' : 'HO_TRO')
    const o3 = coMatNguon[nhomNg]
    if (laBienChe(vc)) {
      if (vc.nguonKinhPhi === 'NGAN_SACH') o3.nganSach++
      else if (vc.nguonKinhPhi === 'SU_NGHIEP') o3.suNghiep++
      else o3.bcChuaRoNguon++
    } else if (vc.loaiLaoDong === 'HOP_DONG_235') o3.hd235++
    else o3.hdKhac++
    const o = dem.get(ma) ?? { vc: 0, hd: 0 }
    if (laBienChe(vc)) o.vc++
    else o.hd++
    dem.set(ma, o)
    // Tổ trưởng, tổ phó: đếm thêm ở dòng chức vụ (người này vẫn tính ở vị trí giáo viên / nhân viên của mình)
    const maTo = vc.chucVu === 'TTCM' ? 'TO_TRUONG' : vc.chucVu === 'TPCM' ? 'TO_PHO' : undefined
    if (maTo) {
      const t = dem.get(maTo) ?? { vc: 0, hd: 0 }
      if (laBienChe(vc)) t.vc++
      else t.hd++
      dem.set(maTo, t)
    }
  }

  const nhapTay = quyMo.dinhMucNhapTay ?? {}
  const taoDong = (vt: ViTri): DongDinhMuc => {
    const coMat = dem.get(vt.ma) ?? { vc: 0, hd: 0 }
    const laPhucVu = !!vt.khongDinhMuc || !!vt.trongGv
    const dinhMucTinh = laPhucVu ? null : (tinh[vt.ma] ?? vt.coDinh ?? null)
    // Môn THCS: điều chỉnh qua bảng phân bổ kiêm nhiệm, không nhập thẳng định mức
    const pb = phanBoKiem?.dong.find((d) => d.ma === vt.ma)
    const tayGoc = laPhucVu || pb ? undefined : nhapTay[vt.ma]
    const tay = tayGoc != null && vt.toiDa != null ? Math.min(tayGoc, vt.toiDa) : tayGoc
    const dinhMuc = pb ? pb.dinhMuc : (tay ?? dinhMucTinh)
    const tong = coMat.vc + coMat.hd
    return {
      ma: vt.ma,
      ten: vt.ten,
      nhom: vt.nhom,
      laGiaoVien: !!vt.laGiaoVien,
      dinhMucTinh,
      dinhMucNhapTay: tay,
      dinhMuc,
      canCu: vt.canCu && laPhucVu ? vt.canCu : laPhucVu ? 'Không áp dụng định mức' : (canCu[vt.ma] ?? vt.canCu ?? (dinhMucTinh == null ? 'Không có công thức - nhập tay nếu có căn cứ' : '')),
      coMatVC: coMat.vc,
      coMatHD: coMat.hd,
      coMat: tong,
      chenhLech: dinhMuc == null ? null : tong - dinhMuc,
      toiDa: vt.toiDa,
      phanBoKiem: !!pb,
      khongDinhMuc: vt.khongDinhMuc,
      trongGv: vt.trongGv,
    }
  }

  const dong: DongDinhMuc[] = []
  for (const nhom of NHOM_DINH_MUC) {
    for (const vt of VI_TRI[cap].filter((v) => v.nhom === nhom.key)) dong.push(taoDong(vt))
    if (nhom.key === 'CHUYEN_MON' && cap !== 'MAM_NON' && dem.has(CHUA_PHAN_MON)) {
      dong.push({ ...taoDong({ ma: CHUA_PHAN_MON, ten: 'Giáo viên chưa phân công môn', nhom: 'CHUYEN_MON', laGiaoVien: true }), canCu: 'Phân công môn ở thẻ "Phân công môn giảng dạy"', dongPhu: true })
    }
    if (nhom.key === 'HO_TRO') {
      // Nhân viên có công việc không thuộc danh sách vị trí của cấp học này
      const maCoDinh = new Set(VI_TRI[cap].map((v) => v.ma))
      let khac = { vc: 0, hd: 0 }
      for (const [ma, o] of dem) {
        if (ma === 'TO_TRUONG' || ma === 'TO_PHO') continue
        if (ma === NV_KHAC || (!maCoDinh.has(ma) && ma !== CHUA_PHAN_MON)) khac = { vc: khac.vc + o.vc, hd: khac.hd + o.hd }
      }
      if (khac.vc + khac.hd > 0) {
        dong.push({
          ma: NV_KHAC, ten: 'Nhân viên khác / chưa rõ công việc', nhom: 'HO_TRO', laGiaoVien: false,
          dinhMucTinh: null, dinhMuc: null, canCu: 'Khai "Công việc cụ thể" trong hồ sơ nhân viên',
          coMatVC: khac.vc, coMatHD: khac.hd, coMat: khac.vc + khac.hd, chenhLech: null, dongPhu: true,
        })
      }
    }
  }

  // Tổ trưởng, tổ phó đã đếm ở vị trí giáo viên của mình - bỏ khỏi mọi phép cộng để không đếm trùng
  const dongTinh = dong.filter((d) => !d.trongGv)
  const trongDinhMuc = dongTinh.filter((d) => d.nhom !== 'NGOAI_DM')
  const coDinhMuc = trongDinhMuc.filter((d) => d.dinhMuc != null)
  const gv = dong.filter((d) => d.laGiaoVien)
  const chuaPhanMon = (dem.get(CHUA_PHAN_MON)?.vc ?? 0) + (dem.get(CHUA_PHAN_MON)?.hd ?? 0)
  const cong = (ds: DongDinhMuc[], f: (d: DongDinhMuc) => number) => ds.reduce((s, d) => s + f(d), 0)
  const tongNhom: TongNhom[] = NHOM_DINH_MUC
    .map((n) => ({ n, ds: dongTinh.filter((d) => d.nhom === n.key) }))
    .filter(({ ds }) => ds.length)
    .map(({ n, ds }) => {
      const apDung = n.key !== 'NGOAI_DM'
      // Giáo viên chưa phân môn nằm trong định mức giáo viên chung nên vẫn đem so sánh
      const soSanh = ds.filter((d) => d.dinhMuc != null || d.ma === CHUA_PHAN_MON)
      const coMat = cong(ds, (d) => d.coMat)
      const coMatSoSanh = apDung ? cong(soSanh, (d) => d.coMat) : 0
      const dinhMuc = cong(ds, (d) => d.dinhMuc ?? 0)
      return {
        nhom: n.key, ten: n.ten, apDungDinhMuc: apDung,
        dinhMucTinh: cong(ds, (d) => d.dinhMucTinh ?? 0), dinhMuc,
        coMatVC: cong(ds, (d) => d.coMatVC), coMatHD: cong(ds, (d) => d.coMatHD), coMat,
        coMatSoSanh, coMatNgoai: apDung ? coMat - coMatSoSanh : 0,
        chenhLech: apDung ? coMatSoSanh - dinhMuc : null,
      }
    })
  return {
    cap, tongLop, tongHS, tongLop2Buoi, tongHS2Buoi, binhQuan, hang, dienGiai, dong,
    gvDinhMuc: gv.reduce((s, d) => s + (d.dinhMuc ?? 0), 0),
    gvCoMat: gv.reduce((s, d) => s + d.coMat, 0),
    tongDinhMuc: coDinhMuc.reduce((s, d) => s + (d.dinhMuc ?? 0), 0),
    tongCoMat: trongDinhMuc.reduce((s, d) => s + d.coMat, 0),
    // Giáo viên chưa phân môn vẫn nằm trong định mức giáo viên chung của trường
    coMatCoDinhMuc: coDinhMuc.reduce((s, d) => s + d.coMat, 0) + chuaPhanMon,
    chuaPhanMon,
    phanBoKiem,
    tongNhom,
    toanTruong: { coMatVC: cong(dongTinh, (d) => d.coMatVC), coMatHD: cong(dongTinh, (d) => d.coMatHD), coMat: cong(dongTinh, (d) => d.coMat) },
    coMatNguon,
  }
}

// ── Gợi ý môn giảng dạy từ "Nhiệm vụ chính", rồi "Trình độ chuyên môn" ──

const tu = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${s})(?![\\p{L}\\p{N}])`, 'u')

const TU_KHOA_MON: Record<'TIEU_HOC' | 'THCS', [RegExp, string][]> = {
  TIEU_HOC: [
    [tu('tổng phụ trách|tpt'), 'TONG_PHU_TRACH'],
    [tu('tiếng anh|ngoại ngữ|anh văn|ngôn ngữ anh|ta'), 'NGOAI_NGU'],
    [tu('tin học|công nghệ thông tin|cntt'), 'TIN_HOC'],
    [tu('âm nhạc|mỹ thuật|mĩ thuật|nghệ thuật|nhạc|họa|spmt|span'), 'NGHE_THUAT'],
    [tu('thể dục|thể chất|gdtc|td|sptd'), 'GDTC'],
    [tu('văn hóa|văn hoá|tiểu học|gdth|gvvh|đhspth|spth'), 'VAN_HOA'],
  ],
  THCS: [
    [tu('tổng phụ trách|tpt'), 'TONG_PHU_TRACH'],
    [tu('tiếng anh|ngoại ngữ|anh văn|ngôn ngữ anh|anh|ta'), 'NGOAI_NGU'],
    [tu('tin học|công nghệ thông tin|cntt'), 'TIN_HOC'],
    // "GV CN" trong mẫu của phường là giáo viên Công nghệ
    [tu('công nghệ|kỹ thuật|kĩ thuật|ktcn|cn'), 'CONG_NGHE'],
    [tu('thể dục|thể chất|gdtc|td|sptd'), 'GDTC'],
    [tu('âm nhạc|mỹ thuật|mĩ thuật|nghệ thuật|nhạc|họa|hội họa'), 'NGHE_THUAT'],
    [tu('giáo dục công dân|công dân|gdcd'), 'GDCD'],
    [tu('lịch sử|sử|địa lý|địa lí|địa'), 'LS_DL'],
    [tu('khtn|khoa học tự nhiên|vật lý|vật lí|lý|lí|hóa học|hoá học|hóa|hoá|sinh học|sinh'), 'KHTN'],
    [tu('toán học|toán'), 'TOAN'],
    [tu('ngữ văn|văn'), 'NGU_VAN'],
  ],
}

function timMon(text: string | undefined, cap: 'TIEU_HOC' | 'THCS'): string | undefined {
  const t = (text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/quản l[ýí]/g, ' ')
  if (!t.trim()) return undefined
  let tot: { i: number; len: number; ma: string } | undefined
  for (const [re, ma] of TU_KHOA_MON[cap]) {
    const m = re.exec(t)
    if (!m) continue
    if (!tot || m.index < tot.i || (m.index === tot.i && m[0].length > tot.len)) tot = { i: m.index, len: m[0].length, ma }
  }
  return tot?.ma
}

/** Môn xuất hiện sớm nhất trong "Nhiệm vụ chính"; không thấy thì xét ô VTVL ghi bằng chữ, rồi "Trình độ chuyên môn" */
export function goiYMonDay(vc: Pick<VienChuc, 'nhiemVuChinh' | 'trinhDoChuyenMon' | 'vtvl'>, cap: CapHoc): string | undefined {
  if (cap === 'MAM_NON') return timNhomLopMamNon(vc.nhiemVuChinh) ?? timNhomLopMamNon(vc.trinhDoChuyenMon)
  return timMon(vc.nhiemVuChinh, cap)
    ?? (laVtvlChuan(vc.vtvl) ? undefined : timMon(vc.vtvl, cap))
    ?? timMon(vc.trinhDoChuyenMon, cap)
}

/** Đoán nhóm, lớp phụ trách của giáo viên mầm non từ "Nhiệm vụ chính" (VD "Dạy lớp 4-5 tuổi", "Nhóm trẻ 24-36 tháng") */
function timNhomLopMamNon(text?: string): string | undefined {
  const t = (text ?? '').toLowerCase()
  if (!t) return undefined
  if (/nhà trẻ|nhóm trẻ|tháng/.test(t)) return 'MN_NHA_TRE'
  if (/3\s*-\s*4\s*tuổi|mẫu giáo bé|lớp bé/.test(t)) return 'MN_MG3'
  if (/4\s*-\s*5\s*tuổi|mẫu giáo nhỡ|lớp nhỡ/.test(t)) return 'MN_MG4'
  if (/5\s*-\s*6\s*tuổi|mẫu giáo lớn|lớp lớn/.test(t)) return 'MN_MG5'
  if (/(^|\D)3\s*tuổi/.test(t)) return 'MN_MG3'
  if (/(^|\D)4\s*tuổi/.test(t)) return 'MN_MG4'
  if (/(^|\D)5\s*tuổi/.test(t)) return 'MN_MG5'
  if (/năng khiếu|tiếng anh|ngoại ngữ|âm nhạc|thể dục|chuyên/.test(t)) return 'MN_DAY_CHUYEN'
  return undefined
}

/** Giáo viên đang tính số liệu của một trường */
export function giaoVienCuaTruong(nhanSu: VienChuc[], layChucDanh: (id?: string) => ChucDanhTra | undefined): VienChuc[] {
  return nhanSu.filter((v) => duocTinhSoLieu(v) && nhomNguoi(v, layChucDanh(v.chucDanhId)?.nhom) === 'GIAO_VIEN')
}

export const laPhanCongMamNon = (ma?: string) => !!ma && PHAN_CONG_MAM_NON.some((m) => m.ma === ma)

export function demChuaPhanCongMN(nhanSu: VienChuc[], layChucDanh: (id?: string) => ChucDanhTra | undefined): number {
  return giaoVienCuaTruong(nhanSu, layChucDanh).filter((v) => !laPhanCongMamNon(v.monDay)).length
}

export interface DongPhanCongMN {
  ma: string
  ten: string
  soGv: number
  /** Số nhóm, lớp của độ tuổi (theo quy mô đã khai) */
  soLop?: number
  /** Số giáo viên theo định mức của độ tuổi = số nhóm, lớp × 2,5 (nhà trẻ) hoặc × 2,2 (mẫu giáo) */
  dinhMuc?: number
}

/** Mầm non: số giáo viên phân công từng nhóm, lớp độ tuổi so với định mức của độ tuổi đó (để theo dõi, không thay định mức chung) */
export function thongKePhanCongMN(
  nhanSu: VienChuc[], layChucDanh: (id?: string) => ChucDanhTra | undefined, quyMo?: QuyMoTruong,
): { dong: DongPhanCongMN[]; chuaPhan: number; tongGv: number } {
  const gvs = giaoVienCuaTruong(nhanSu, layChucDanh)
  const t = THAM_SO.MAM_NON
  const dong = PHAN_CONG_MAM_NON.map((m) => {
    const soGv = gvs.filter((v) => v.monDay === m.ma).length
    if (!m.khoi) return { ma: m.ma, ten: m.ten, soGv }
    const soLop = quyMo?.khoi[m.khoi]?.soLop ?? 0
    return { ma: m.ma, ten: m.ten, soGv, soLop, dinhMuc: soLop * (m.khoi === 'NHA_TRE' ? t.gvNhaTre : t.gvMauGiao) }
  })
  return { dong, chuaPhan: gvs.filter((v) => !laPhanCongMamNon(v.monDay)).length, tongGv: gvs.length }
}
