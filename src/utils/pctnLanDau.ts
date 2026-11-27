import dayjs from 'dayjs'
import type { KhaiPctnLanDau, DongQuaTrinhPctn, GiaiDoanBhxh } from '@/types/deXuat'

// Xếp phụ cấp thâm niên nhà giáo lần đầu (NĐ 77/2021/NĐ-CP; Công văn hướng dẫn của Phòng VH-XH):
// đủ 5 năm (60 tháng) giảng dạy, giáo dục có đóng BHXH bắt buộc thì hưởng 5%, từ năm thứ sáu mỗi năm (đủ 12 tháng) +1%.
// Không tính: thời gian tập sự (MN tối đa 9 tháng, TH/THCS tối đa 12 tháng), nghỉ việc riêng không lương liên tục từ 01 tháng, ốm đau thai sản vượt quy định,
// đi học / công tác quá hạn, bị tạm đình chỉ, tạm giữ, tạm giam.
// Đối chiếu 17 trường hợp trong danh sách TB423/2026: mốc đủ 5 năm = ngày 01 của
// (tháng bắt đầu đóng BHXH giảng dạy + 60 tháng + số tháng không tính).

type KhaiDu5Nam = Pick<KhaiPctnLanDau, 'batDauBhxh' | 'giaiDoanBhxh' | 'thangTapSu' | 'thangKhongTinhKhac'>
const laThang = (s?: string) => !!s && /^\d{4}-\d{2}$/.test(s)

/** Các giai đoạn đóng BHXH tính hưởng (đã sắp theo thời gian); chưa khai giai đoạn thì là 1 giai đoạn từ `batDauBhxh` đến nay */
export function cacGiaiDoan(k: Pick<KhaiPctnLanDau, 'batDauBhxh' | 'giaiDoanBhxh'>): GiaiDoanBhxh[] {
  const gd = (k.giaiDoanBhxh ?? []).filter((g) => laThang(g.tu)).map((g) => ({ ...g, den: laThang(g.den) ? g.den : undefined }))
  if (gd.length) return gd.sort((a, b) => a.tu.localeCompare(b.tu))
  return laThang(k.batDauBhxh) ? [{ tu: k.batDauBhxh! }] : []
}

/** Số tháng của một giai đoạn tính đến tháng `denThang` ('YYYY-MM'; giai đoạn chưa kết thúc tính đến đó) */
export function soThangGiaiDoan(g: GiaiDoanBhxh, denThang: string): number {
  const cuoi = g.den && g.den < denThang ? g.den : denThang
  const n = dayjs(`${cuoi}-01`).diff(dayjs(`${g.tu}-01`), 'month') + 1
  return Math.max(0, n)
}

/** Khoảng gián đoạn giữa các giai đoạn (không tính) và giai đoạn chồng lấn (khai sai) */
export function kiemTraGiaiDoan(gd: GiaiDoanBhxh[]): { gianDoan: { tu: string; den: string; soThang: number }[]; chongLan: boolean; moGiua: boolean } {
  const gianDoan: { tu: string; den: string; soThang: number }[] = []
  let chongLan = false
  let moGiua = false
  for (let i = 1; i < gd.length; i++) {
    const truoc = gd[i - 1]
    if (!truoc.den) { moGiua = true; continue }
    const batDauKhoang = dayjs(`${truoc.den}-01`).add(1, 'month')
    const n = dayjs(`${gd[i].tu}-01`).diff(batDauKhoang, 'month')
    if (n < 0) chongLan = true
    else if (n > 0) gianDoan.push({ tu: batDauKhoang.format('YYYY-MM'), den: dayjs(`${gd[i].tu}-01`).subtract(1, 'month').format('YYYY-MM'), soThang: n })
  }
  return { gianDoan, chongLan, moGiua }
}

/**
 * Ngày đủ 5 năm (60 tháng) thời gian tính hưởng: cộng dồn số tháng các giai đoạn đóng BHXH đến khi đủ
 * 60 tháng + thời gian tập sự + thời gian không tính khác; ngày đủ là ngày 01 của tháng kế tiếp.
 * undefined khi chưa khai tháng bắt đầu hoặc các giai đoạn đã kết thúc mà chưa đủ.
 */
export function ngayDu5Nam(k: KhaiDu5Nam): string | undefined {
  const gd = cacGiaiDoan(k)
  if (!gd.length) return undefined
  let conThieu = 60 + Math.max(0, (k.thangTapSu || 0) + (k.thangKhongTinhKhac || 0))
  for (const g of gd) {
    const soThang = g.den ? dayjs(`${g.den}-01`).diff(dayjs(`${g.tu}-01`), 'month') + 1 : Infinity
    if (soThang <= 0) continue
    if (soThang >= conThieu) return dayjs(`${g.tu}-01`).add(conThieu, 'month').format('YYYY-MM-DD')
    conThieu -= soThang
  }
  return undefined
}

/** Diễn giải các giai đoạn ngắn gọn: "03/2015-08/2018; 01/2019-nay" */
export function dienGiaiGiaiDoan(k: Pick<KhaiPctnLanDau, 'batDauBhxh' | 'giaiDoanBhxh'>): string {
  const t = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`
  return cacGiaiDoan(k).map((g) => `${t(g.tu)}-${g.den ? t(g.den) : 'nay'}${g.noiDung ? ` (${g.noiDung})` : ''}`).join('; ')
}

/** Thời gian tập sự tối đa theo cấp học: mầm non 9 tháng; tiểu học, THCS (và đơn vị khác) 12 tháng */
export const tapSuToiDa = (loaiDonVi?: string) => (loaiDonVi === 'MAM_NON' ? 9 : 12)

/** Số tháng tập sự của một người: theo hồ sơ (khai riêng, kể cả 0); chưa khai thì lấy tối đa theo cấp học */
export const thangTapSuCua = (vc: { thangTapSu?: number } | undefined, loaiDonVi?: string) =>
  vc?.thangTapSu ?? tapSuToiDa(loaiDonVi)

export const GHI_CHU_DU_5_NAM = 'Đủ 5 năm = tháng bắt đầu đóng BHXH + thời gian tập sự + 60 tháng (tập sự không tính vào thời gian hưởng; mầm non tối đa 9 tháng, tiểu học, THCS tối đa 12 tháng; khai riêng từng người, người không tập sự ghi 0)'

/** Ngày dự kiến đủ 5 năm từ tháng bắt đầu đóng BHXH trong ngành ghi ở hồ sơ + thời gian tập sự */
export const du5NamTuHoSo = (batDauBhxhGd: string | undefined, thangTapSu: number) =>
  ngayDu5Nam({ batDauBhxh: batDauBhxhGd, thangTapSu, thangKhongTinhKhac: 0 })

export type TinhTrangLanDau = 'DANG_HUONG' | 'CHUA_KHAI' | 'DU_5_NAM' | 'SAP_DU' | 'CHUA_DU'

/**
 * Tình trạng xếp PCTN lần đầu của CBQL, giáo viên: đang hưởng / chưa khai BHXH / đã đủ 5 năm (thuộc diện rà soát,
 * lập phiếu) / sắp đủ (trong `soThangSapDu` tháng tới) / chưa đủ.
 */
export function tinhTrangLanDau(pctnDangHuong: number, batDauBhxhGd: string | undefined, homNay: string, thangTapSu: number, soThangSapDu = 6): { tt: TinhTrangLanDau; du5Nam?: string } {
  if (pctnDangHuong > 0) return { tt: 'DANG_HUONG' }
  const du5Nam = du5NamTuHoSo(batDauBhxhGd, thangTapSu)
  if (!du5Nam) return { tt: 'CHUA_KHAI' }
  if (du5Nam <= homNay) return { tt: 'DU_5_NAM', du5Nam }
  if (du5Nam <= dayjs(homNay).add(soThangSapDu, 'month').format('YYYY-MM-DD')) return { tt: 'SAP_DU', du5Nam }
  return { tt: 'CHUA_DU', du5Nam }
}

export const TINH_TRANG_LAN_DAU: Record<TinhTrangLanDau, { nhan: string; mau: string }> = {
  DANG_HUONG: { nhan: 'Đang hưởng PCTN', mau: 'default' },
  CHUA_KHAI: { nhan: 'Chưa khai BHXH', mau: 'warning' },
  DU_5_NAM: { nhan: 'Đủ 5 năm - rà soát xếp lần đầu', mau: 'error' },
  SAP_DU: { nhan: 'Sắp đủ 5 năm', mau: 'processing' },
  CHUA_DU: { nhan: 'Chưa đủ 5 năm', mau: 'default' },
}

/** Ngày bắt đầu được hưởng mặc định: ngày tuyển dụng, làm tròn lên ngày 01 của tháng (VD 13/02 → 01/03) */
export function huongTuMacDinh(ngayTuyenDung?: string): string | undefined {
  if (!ngayTuyenDung) return undefined
  const d = dayjs(ngayTuyenDung)
  return d.date() === 1 ? d.format('YYYY-MM-DD') : d.add(1, 'month').startOf('month').format('YYYY-MM-DD')
}

/**
 * Gợi ý quá trình hưởng tính đến hết kỳ xét (`denNgay`): mỗi mốc kỷ niệm từ ngày đủ 5 năm là một dòng (5%, 6%…).
 * Mốc trước ngày được hưởng (`huongTu`) không trả tiền; nếu mốc kế tiếp còn ở sau kỳ thì giữ dòng của
 * mức đang có tại ngày được hưởng, hưởng từ ngày đó (VD TB423: 10% mốc 01/12/2025, hưởng từ 01/03/2026).
 * Kế toán sửa được từng dòng khi hồ sơ có trường hợp riêng.
 */
export function goiYQuaTrinh(k: KhaiPctnLanDau, denNgay: string): DongQuaTrinhPctn[] {
  const du = ngayDu5Nam(k)
  if (!du || du > denNgay) return []
  const huongTu = k.huongTu && k.huongTu > du ? k.huongTu : du
  const moc: DongQuaTrinhPctn[] = []
  for (let n = 0; ; n++) {
    const m = dayjs(du).add(n, 'year').format('YYYY-MM-DD')
    if (m > denNgay) break
    moc.push({ tyLe: 5 + n, mocXet: m, thoiGianHuong: m })
  }
  const sauHuong = moc.filter((d) => d.mocXet >= huongTu)
  const truocHuong = moc.filter((d) => d.mocXet < huongTu)
  if (truocHuong.length && (!sauHuong.length || sauHuong[0].mocXet > huongTu)) {
    const dangCo = truocHuong[truocHuong.length - 1]
    return [{ ...dangCo, thoiGianHuong: huongTu }, ...sauHuong]
  }
  return sauHuong
}

/** Dòng cuối của quá trình là mức đang hưởng: căn cứ ghi phụ cấp và mốc xét nâng lần sau */
export const dongCuoi = (q?: DongQuaTrinhPctn[]) => (q?.length ? q[q.length - 1] : undefined)

export const ghiChuMacDinh = (k: Pick<KhaiPctnLanDau, 'thangTapSu' | 'thangKhongTinhKhac' | 'lyDoKhongTinh'>) =>
  [k.thangTapSu ? `Thời gian tập sự ${k.thangTapSu} tháng` : '', k.thangKhongTinhKhac ? `${k.lyDoKhongTinh || 'Thời gian không tính'} ${k.thangKhongTinhKhac} tháng` : '']
    .filter(Boolean).join('; ')
