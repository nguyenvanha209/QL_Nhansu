// Xuất Excel in được ngay trên khổ A4: kẻ khung bảng, lề trái 1,5 cm, ba lề còn lại 1 cm,
// co vừa chiều ngang một trang, lặp dòng tiêu đề bảng khi sang trang, đánh số trang.
// Mọi nút "Xuất Excel" của hệ thống dùng chung hàm này.
import type { Borders, Cell, Workbook, Worksheet } from 'exceljs'

/**
 * Ô công thức Excel: `f` là công thức (không có dấu =, địa chỉ theo ô Excel như B5), `kq` là kết quả phần mềm đã
 * tính - Excel hiển thị ngay khi mở, và tự tính lại khi người dùng sửa số liệu.
 */
export interface CongThuc { f: string; kq: number; dinhDang?: string }
export type O = string | number | null | undefined | CongThuc

export const laCongThuc = (v: unknown): v is CongThuc => !!v && typeof v === 'object' && 'f' in (v as object)
const giaTriSo = (v: O): number | null => (typeof v === 'number' ? v : laCongThuc(v) ? v.kq : null)

/** Tên cột Excel từ chỉ số 0: 0 → A, 26 → AA */
export function tenCot(c: number): string {
  let s = ''
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
/** Địa chỉ ô Excel từ dòng, cột trong `TrangA4.dong` (đếm từ 0) */
export const oExcel = (r: number, c: number) => `${tenCot(c)}${r + 1}`

/** Gộp các dòng liền nhau thành vùng: [5,6,7,9] cột B → "B6:B8,B10" */
function vungO(cacDong: number[], c: number): string {
  const ds = [...new Set(cacDong)].sort((a, b) => a - b)
  const ra: string[] = []
  for (let i = 0; i < ds.length; i++) {
    let j = i
    while (j + 1 < ds.length && ds[j + 1] === ds[j] + 1) j++
    ra.push(i === j ? oExcel(ds[i], c) : `${oExcel(ds[i], c)}:${oExcel(ds[j], c)}`)
    i = j
  }
  return ra.join(',')
}

/**
 * Làm tròn như hàm ROUND của Excel: Excel làm việc trên 15 chữ số có nghĩa, nên 3,65 × 17% = 0,6205 → 0,621;
 * phép nhân số thực của JavaScript lại ra 0,62049999… → 0,620. Dùng hàm này khi đối chiếu công thức có ROUND.
 */
export function lamTronExcel(x: number, n: number): number {
  if (!Number.isFinite(x)) return x
  const s = Math.sign(x)
  const tron = Math.round(Number(`${Number(Math.abs(x).toPrecision(15))}e${n}`))
  return s * Number(`${tron}e-${n}`)
}

// Sai số cho phép khi đối chiếu (số liệu làm tròn 3 chữ số thập phân)
const SAI_SO = 0.0006

/**
 * Dòng tổng: các ô số của dòng `r` thành công thức SUM các ô cùng cột ở `cacDong`.
 * LƯỚI AN TOÀN: chỉ ghi công thức khi tổng các ô thành phần khớp con số phần mềm đã tính; lệch thì giữ giá trị
 * (không bao giờ xuất ra con số khác với màn hình). `cot` để giới hạn các cột (mặc định mọi cột có số).
 */
export function ganDongTong(dong: O[][], r: number, cacDong: number[], cot?: number[]): void {
  const hang = dong[r]
  if (!hang) return
  for (const c of cot ?? hang.map((_, i) => i)) {
    const goc = giaTriSo(hang[c])
    if (goc == null) continue
    const nguon = cacDong.filter((rr) => rr !== r && giaTriSo(dong[rr]?.[c]) != null)
    if (!nguon.length) continue
    const tong = nguon.reduce((s, rr) => s + (giaTriSo(dong[rr][c]) ?? 0), 0)
    if (Math.abs(tong - goc) > SAI_SO) {
      console.warn(`[Excel] Dòng ${r + 1} cột ${tenCot(c)}: tổng thành phần ${tong} khác ${goc} - giữ giá trị`)
      continue
    }
    hang[c] = { f: `SUM(${vungO(nguon, c)})`, kq: goc, dinhDang: laCongThuc(hang[c]) ? (hang[c] as CongThuc).dinhDang : undefined }
  }
}

/**
 * Công thức cho một ô bất kỳ (VD bình quân = ô học sinh / ô số lớp ở dòng khác). Chỉ ghi khi `kq` khớp giá trị
 * đang có trong ô (lưới an toàn).
 */
export function ganCongThucO(dong: O[][], r: number, c: number, f: string, kq: number | null, dinhDang?: string): void {
  const hang = dong[r]
  if (!hang || kq == null || !Number.isFinite(kq)) return
  const dangCo = giaTriSo(hang[c])
  if (dangCo == null) return
  if (Math.abs(dangCo - kq) > SAI_SO) {
    console.warn(`[Excel] Ô ${oExcel(r, c)}: công thức cho ${kq} khác ${dangCo} - giữ giá trị`)
    return
  }
  hang[c] = { f, kq: dangCo, dinhDang }
}

/**
 * Tổng theo hàng ngang: ô (r, cDich) = SUM các ô cùng dòng ở `cacCot` (VD cột "Toàn cấp" = cộng các trường).
 * Cùng lưới an toàn như ganDongTong.
 */
export function ganTongNgang(dong: O[][], cacDong: number[], cDich: number, cacCot: number[]): void {
  for (const r of cacDong) {
    const hang = dong[r]
    if (!hang) continue
    const goc = giaTriSo(hang[cDich])
    if (goc == null) continue
    const nguon = cacCot.filter((c) => c !== cDich && giaTriSo(hang[c]) != null)
    if (!nguon.length) continue
    const tong = nguon.reduce((s2, c) => s2 + (giaTriSo(hang[c]) ?? 0), 0)
    if (Math.abs(tong - goc) > SAI_SO) {
      console.warn(`[Excel] Dòng ${r + 1} cột ${tenCot(cDich)}: tổng ngang ${tong} khác ${goc} - giữ giá trị`)
      continue
    }
    hang[cDich] = { f: `SUM(${nguon.map((c) => oExcel(r, c)).join(',')})`, kq: goc }
  }
}

/**
 * Cột tính trong từng dòng (VD tổng hệ số = hệ số + phụ cấp; thừa/thiếu = có mặt - định mức; tỷ lệ % = n / tổng).
 * `tao(o)` trả về công thức theo địa chỉ ô của dòng (`o(c)`); `tinh(so)` tính lại kết quả từ giá trị các ô.
 * LƯỚI AN TOÀN: ô đang có số thì chỉ thay khi `tinh` khớp số đó; `ghiDe` cho phép thay cả ô chữ (VD "44,3%")
 * bằng công thức với kết quả `tinh`. Trả về null ở `tao`/`tinh` để bỏ qua dòng đó.
 */
export function ganCotTinh(
  dong: O[][], c: number, cacDong: number[],
  tao: (o: (cot: number) => string) => string | null,
  tinh: (so: (cot: number) => number) => number | null,
  tuyChon: { dinhDang?: string; ghiDe?: boolean } = {},
): void {
  for (const r of cacDong) {
    const hang = dong[r]
    if (!hang) continue
    const dangCo = giaTriSo(hang[c])
    if (dangCo == null && !(tuyChon.ghiDe && hang[c] != null && hang[c] !== '')) continue
    const f = tao((cot) => oExcel(r, cot))
    const kq = tinh((cot) => giaTriSo(hang[cot]) ?? 0)
    if (f == null || kq == null || !Number.isFinite(kq)) continue
    if (dangCo != null && Math.abs(kq - dangCo) > SAI_SO) {
      console.warn(`[Excel] Dòng ${r + 1} cột ${tenCot(c)}: công thức cho ${kq} khác ${dangCo} - giữ giá trị`)
      continue
    }
    hang[c] = { f, kq: dangCo ?? kq, dinhDang: tuyChon.dinhDang }
  }
}

export interface VungGop { r1: number; c1: number; r2: number; c2: number }

/** Một vùng bảng trong trang: các dòng [tu, den] (đếm từ 0) được kẻ khung; `soDongTieuDe` dòng đầu là tiêu đề cột */
export interface VungBang { tu: number; den: number; soDongTieuDe?: number; soCot?: number }

export interface TrangA4 {
  /** Tên trang tính (tối đa 31 ký tự) */
  ten: string
  dong: O[][]
  gop?: VungGop[]
  /** Độ rộng cột theo số ký tự */
  rongCot?: number[]
  bang?: VungBang[]
  /** Dòng in đậm (tiêu đề nhóm, dòng tổng) */
  dam?: number[]
  /** Dòng tiêu đề văn bản: in đậm, căn giữa, gộp hết chiều ngang nếu chưa có ô gộp */
  tieuDe?: number[]
  /** Dòng chữ nghiêng (căn cứ, ghi chú) */
  nghieng?: number[]
  /** Dòng ngoài bảng căn giữa (không in đậm) */
  giua?: number[]
  /** Cột căn giữa trong bảng (STT, bậc, mã...) */
  cotGiua?: number[]
  /** Nền màu cho dòng (ARGB, VD 'FFDBEAFE') */
  nen?: Record<number, string>
  /** Nền màu theo cột cho thân bảng (ARGB) - dòng có nền riêng thì ưu tiên nền dòng */
  nenCot?: Record<number, string>
  /** Cột bắt đầu một nhóm cột: kẻ vạch trái đậm */
  cotDauNhom?: number[]
  /** Chữ màu cho từng ô 'dòng:cột' (ARGB) */
  mauChu?: Record<string, string>
  /**
   * Số chữ số lẻ khi hiển thị số không nguyên. Ghi số CHÍNH XÁC vào ô và chỉ hiển thị làm tròn (như màn hình),
   * để dòng tổng = SUM khớp đúng con số phần mềm (cộng số chưa làm tròn).
   */
  soLe?: number
  /** Định dạng số riêng cho từng ô 'dòng:cột' (VD '0%' cho tỷ lệ lưu dạng 0,05) */
  dinhDangO?: Record<string, string>
  huong?: 'doc' | 'ngang'
  /** Co cả chiều cao để vừa đúng một trang (báo cáo tổng hợp) */
  motTrang?: boolean
  coChu?: number
}

const CM = 1 / 2.54
const LE = { left: 1.5 * CM, right: 1 * CM, top: 1 * CM, bottom: 1 * CM, header: 0.5 * CM, footer: 0.5 * CM }
const FONT = 'Times New Roman'
const VIEN: Partial<Borders> = {
  top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
}
// Khổ A4 trừ lề, quy ra số ký tự cột (≈ 0,19 cm/ký tự): dọc ~97, ngang ~143
const RONG_DOC = 100

// Số đo theo cách Excel hiển thị (làm tròn 3 chữ số, có dấu phân cách nghìn)
const hienThi = (v: O): string => (laCongThuc(v) ? (v.dinhDang?.includes('%') ? `${(v.kq * 100).toFixed(1)}%` : hienThi(v.kq)) : typeof v === 'number' ? Number(v.toFixed(3)).toLocaleString('en-US') : String(v ?? ''))
const doDai = (v: O) => (v == null ? 0 : hienThi(v).split('\n').reduce((m, s) => Math.max(m, s.length), 0))

/**
 * Độ rộng cột tự tính theo nội dung bảng, giới hạn để chữ dài tự xuống dòng.
 * Chữ Times New Roman (nhất là chữ in hoa có dấu) rộng hơn đơn vị cột của Excel nên nhân thêm 1,15.
 */
export function tinhRongCot(dong: O[][], toiThieu = 5, toiDa = 42): number[] {
  const soCot = Math.max(0, ...dong.map((r) => r.length))
  return Array.from({ length: soCot }, (_, c) =>
    Math.min(toiDa, Math.max(toiThieu, ...dong.map((r) => Math.ceil(doDai(r[c]) * 1.15) + 2))))
}

function dinhDangSo(cell: Cell, v: number, soLe?: number) {
  if (Number.isInteger(v)) { if (Math.abs(v) >= 1000) cell.numFmt = '#,##0' }
  else if (soLe != null) cell.numFmt = `#,##0.${'0'.repeat(soLe)}`
  else cell.numFmt = Math.abs(v) >= 1000 ? '#,##0.##' : '0.0##'
}

function dungTrang(wb: Workbook, t: TrangA4): Worksheet {
  const coChu = t.coChu ?? 11
  const soCot = Math.max(1, ...t.dong.map((r) => r.length), ...(t.bang ?? []).map((b) => b.soCot ?? 0))
  const rong = t.rongCot ?? tinhRongCot(t.dong)
  const tongRong = rong.reduce((s, w) => s + w, 0)
  const ngang = t.huong ? t.huong === 'ngang' : tongRong > RONG_DOC
  const bang0 = t.bang?.[0]

  const ws = wb.addWorksheet(t.ten.replace(/[\\/?*[\]:]/g, '-').slice(0, 31), {
    pageSetup: {
      paperSize: 9, // A4
      orientation: ngang ? 'landscape' : 'portrait',
      fitToPage: true, fitToWidth: 1, fitToHeight: t.motTrang ? 1 : 0,
      margins: LE,
      horizontalCentered: true,
      printTitlesRow: bang0?.soDongTieuDe ? `${bang0.tu + 1}:${bang0.tu + bang0.soDongTieuDe}` : undefined,
    },
    headerFooter: { oddFooter: `&C&"${FONT}"&9Trang &P/&N` },
    views: [{ showGridLines: false }],
  })
  ws.columns = Array.from({ length: soCot }, (_, c) => ({ width: rong[c] ?? 10 }))

  const trongBang = (r: number) => t.bang?.find((b) => r >= b.tu && r <= b.den)
  const dam = new Set(t.dam)
  const tieuDe = new Set(t.tieuDe)
  const nghieng = new Set(t.nghieng)
  const cotGiua = new Set(t.cotGiua)
  const giua = new Set(t.giua)

  t.dong.forEach((dong, r) => {
    const row = ws.getRow(r + 1)
    const b = trongBang(r)
    const laTieuDeBang = !!b && r < b.tu + (b.soDongTieuDe ?? 0)
    const soCotDong = b ? (b.soCot ?? soCot) : dong.length
    for (let c = 0; c < soCotDong; c++) {
      const v = dong[c]
      const cell = row.getCell(c + 1)
      if (laCongThuc(v)) cell.value = { formula: v.f, result: v.kq }
      else if (v != null && v !== '') cell.value = v
      cell.font = {
        name: FONT, size: tieuDe.has(r) ? coChu + 2 : coChu,
        bold: laTieuDeBang || dam.has(r) || tieuDe.has(r), italic: nghieng.has(r),
        color: t.mauChu?.[`${r}:${c}`] ? { argb: t.mauChu[`${r}:${c}`] } : undefined,
      }
      if (b) {
        cell.border = VIEN
        cell.alignment = {
          wrapText: true, vertical: 'middle',
          horizontal: laTieuDeBang || cotGiua.has(c) ? 'center' : typeof v === 'number' || laCongThuc(v) ? 'right' : 'left',
        }
        if (laTieuDeBang) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      } else {
        cell.alignment = { wrapText: !tieuDe.has(r), vertical: 'middle', horizontal: tieuDe.has(r) || giua.has(r) ? 'center' : 'left' }
      }
      if (t.nen?.[r]) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: t.nen[r] } }
      else if (b && !laTieuDeBang && t.nenCot?.[c]) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: t.nenCot[c] } }
      if (b && t.cotDauNhom?.includes(c)) cell.border = { ...VIEN, left: { style: 'medium', color: { argb: 'FF475569' } } }
      if (typeof v === 'number') {
        if (t.dinhDangO?.[`${r}:${c}`]) cell.numFmt = t.dinhDangO[`${r}:${c}`]
        else dinhDangSo(cell, v, t.soLe)
      }
      else if (laCongThuc(v)) {
        if (v.dinhDang) cell.numFmt = v.dinhDang
        else dinhDangSo(cell, v.kq, t.soLe)
      }
    }
    // Dòng trong bảng: đặt chiều cao theo số dòng chữ thực tế (Excel tự tính hay cao gấp đôi với chữ xuống dòng)
    if (b) {
      let soDongChu = 1
      for (let c = 0; c < soCotDong; c++) {
        const v = dong[c]
        if (v == null || v === '') continue
        // Ô gộp: tính theo tổng độ rộng các cột được gộp; ô gộp nhiều dòng thì bỏ qua
        const g = t.gop?.find((x) => r >= x.r1 && r <= x.r2 && c >= x.c1 && c <= x.c2)
        if (g && (g.r2 > g.r1 || c !== g.c1)) continue
        const vua = Math.max(1, (g ? rong.slice(g.c1, g.c2 + 1).reduce((s, w) => s + w, 0) : (rong[c] ?? 10)) - 1)
        soDongChu = Math.max(soDongChu, ...hienThi(v).split('\n').map((s) => Math.ceil((s.length * 1.05) / vua)))
      }
      row.height = soDongChu * (coChu + 4) + 3
    }
  })

  const daGop = new Set<number>()
  for (const g of t.gop ?? []) {
    ws.mergeCells(g.r1 + 1, g.c1 + 1, g.r2 + 1, g.c2 + 1)
    if (g.c2 > g.c1) daGop.add(g.r1)
  }
  // Dòng tiêu đề văn bản chưa gộp: gộp hết chiều ngang để căn giữa đúng trang
  for (const r of [...(t.tieuDe ?? []), ...(t.giua ?? [])]) {
    if (!daGop.has(r) && soCot > 1) ws.mergeCells(r + 1, 1, r + 1, soCot)
  }
  // Đoạn văn dài ngoài bảng (căn cứ, ghi chú, diễn giải): gộp hết chiều ngang và tăng chiều cao dòng
  t.dong.forEach((dong, r) => {
    if (trongBang(r) || tieuDe.has(r) || giua.has(r) || daGop.has(r)) return
    const coNoiDung = dong.filter((v) => v != null && v !== '')
    if (coNoiDung.length === 1 && dong[0] != null && doDai(dong[0]) > (rong[0] ?? 10) && soCot > 1) {
      ws.mergeCells(r + 1, 1, r + 1, soCot)
      ws.getRow(r + 1).height = Math.ceil(doDai(dong[0]) / (tongRong * 1.05)) * (coChu + 4) + 2
    }
  })
  return ws
}

/** Dựng file .xlsx (chưa tải về) */
export async function taoFileExcelA4(trangs: TrangA4[]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'QLVC&LĐ phường Gia Viên'
  wb.created = new Date()
  for (const t of trangs) dungTrang(wb, t)
  return wb.xlsx.writeBuffer()
}

/** Xuất một hoặc nhiều trang A4 thành file .xlsx và tải về */
export async function xuatExcelA4(tenFile: string, trangs: TrangA4[]) {
  const buf = await taoFileExcelA4(trangs)
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = tenFile.endsWith('.xlsx') ? tenFile : `${tenFile}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Bảng đơn giản từ danh sách đối tượng (khoá = tiêu đề cột). Có `tieuDe` thì in thêm dòng tiêu đề phía trên;
 * không có thì dòng tiêu đề cột nằm ở dòng 1 (giữ được để nhập lại vào hệ thống).
 */
export function trangTuDanhSach(
  data: Record<string, unknown>[],
  ten: string,
  tuyChon: { tieuDe?: string[]; rongCot?: number[]; cotGiua?: number[]; ghiChuCuoi?: string[] } = {},
): TrangA4 {
  const cot = data.length ? Object.keys(data[0]) : ['(Không có dữ liệu)']
  const than = data.map((d) => cot.map((k) => d[k] as O))
  const dau: O[][] = tuyChon.tieuDe?.length ? [...tuyChon.tieuDe.map((s) => [s]), []] : []
  const dong: O[][] = [...dau, cot, ...than]
  const cuoi = tuyChon.ghiChuCuoi?.length ? [[], ...tuyChon.ghiChuCuoi.map((s) => [s])] : []
  const rongCot = tuyChon.rongCot ?? tinhRongCot([cot.map((k) => k.length > 14 ? k.slice(0, 14) : k), ...than])
  return {
    ten,
    dong: [...dong, ...cuoi],
    rongCot,
    bang: [{ tu: dau.length, den: dau.length + than.length, soDongTieuDe: 1, soCot: cot.length }],
    tieuDe: tuyChon.tieuDe?.map((_, i) => i),
    cotGiua: tuyChon.cotGiua ?? cot.flatMap((k, i) => (/^(STT|TT|Bậc|Giới tính|Mã)/.test(k) ? [i] : [])),
  }
}
