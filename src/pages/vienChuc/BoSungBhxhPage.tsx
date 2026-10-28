import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, App, Button, Card, Checkbox, DatePicker, Modal, Segmented, Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, FileExcelOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { useAuth } from '@/hooks/useAuth'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import type { VienChuc } from '@/types/vienChuc'
import { CHUC_VU_LABELS, LOAI_LAO_DONG_LABELS, duocTinhSoLieu } from '@/types/vienChuc'
import { tuoiNghiHuuThang } from '@/utils/retirement'
import { CONG_VIEC_LABELS, laDienPhuCapThamNien, nhomCoBan, nhomViTri } from '@/utils/nhomViTri'
import { TINH_TRANG_LAN_DAU, tinhTrangLanDau } from '@/utils/pctnLanDau'
import type { TinhTrangLanDau } from '@/utils/pctnLanDau'
import { BANG_CHUAN, cotGiua, cotHoTen, cotNgay, cotSTT, phanTrang } from '@/utils/cotBang'
import { xuatExcelA4, trangTuDanhSach } from '@/utils/excelA4'
import { formatDate, soSanhVienChuc } from '@/utils/helpers'
import { soSanhTruong, thuTuTruong } from '@/utils/dinhMuc'

const { Title, Text } = Typography

export const TEN_CHUC_NANG_BHXH = 'Bổ sung thông tin đóng BHXH'

/** 'YYYY-MM' → 'MM/YYYY' */
const hienThang = (ym?: string) => (ym ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : '')
/** Ô Excel (chữ MM/YYYY, DD/MM/YYYY, ngày Excel) → 'YYYY-MM'; không đọc được → undefined */
function docThang(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return dayjs(v).format('YYYY-MM')
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`
  m = s.match(/^\d{1,2}[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`
  m = s.match(/^(\d{4})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}`
  return undefined
}

interface Dong {
  vc: VienChuc
  id: string
  ho: string
  ten: string
  donViId: string
  chucDanh: string
  pctn: number
  /** Giá trị đang hiện (đã sửa trên màn hình nếu có) */
  thang?: string
  /** Không tham gia BHXH do quá tuổi (đã sửa trên màn hình nếu có) */
  khong: boolean
  /** Nhân viên: được tick "không tham gia BHXH do quá tuổi" (CBQL, giáo viên khai tháng như thường) */
  coTheTick: boolean
  /** Tuổi (năm) và đã tới tuổi nghỉ hưu theo NĐ 135 - gợi ý tick */
  tuoi: number
  quaTuoi: boolean
  /** Công việc cụ thể của nhân viên (bảo vệ, lao công...) để thống kê */
  congViec: string
  daSua: boolean
  /** CBQL, giáo viên - đối tượng phụ cấp thâm niên nhà giáo; nhân viên chỉ khai BHXH */
  dienPctn: boolean
  /** CBQL, giáo viên chưa hưởng PCTN mà chưa khai - cần khai trước để rà soát xếp lần đầu */
  uuTien: boolean
  tt: TrangThaiDong
  du5Nam?: string
}

/** Chưa khai (mọi người) → nhân viên đã khai → tình trạng xếp PCTN lần đầu (CBQL, giáo viên) */
type TrangThaiDong = TinhTrangLanDau | 'KHONG_DIEN' | 'KHONG_BHXH'
const NHAN_TRANG_THAI: Record<TrangThaiDong, { nhan: string; mau: string }> = {
  ...TINH_TRANG_LAN_DAU,
  KHONG_DIEN: { nhan: 'Đã khai (không hưởng PCTN)', mau: 'default' },
  KHONG_BHXH: { nhan: 'Không tham gia BHXH (quá tuổi)', mau: 'purple' },
}

/** Người được tick không tham gia BHXH và chưa khai tháng = đã xử lý, không bị nhắc */
const daXuLy = (d: { thang?: string; khong: boolean }) => !!d.thang || d.khong

/**
 * Bổ sung tháng bắt đầu đóng BHXH trong ngành giáo dục của CBQL, giáo viên (căn cứ xếp PCTN nhà giáo lần đầu).
 * Trường: sửa hàng loạt trên bảng hoặc nhập từ Excel rồi Lưu. Phòng VHXH, quản trị: tổng hợp số người chưa khai
 * từng trường để nhắc, xuất danh sách; chọn trường để xem / cập nhật.
 */
export default function BoSungBhxhPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const { currentUser, scopeDonViId, hasPermission } = useAuth()
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const donVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const phuCapVienChucs = useLuongStore((s) => s.phuCapVienChucs)
  const suaDuoc = hasPermission('vienChuc', 'write')
  const homNay = dayjs().format('YYYY-MM-DD')

  const [the, setThe] = useState<'tong-hop' | 'cap-nhat'>(scopeDonViId ? 'cap-nhat' : 'tong-hop')
  const [truongChon, setTruongChon] = useState<string | undefined>(scopeDonViId ?? undefined)
  const [loc, setLoc] = useState<'TAT_CA' | TrangThaiDong>('TAT_CA')
  const [nhap, setNhap] = useState<Record<string, string | undefined>>({})
  const [nhapKhong, setNhapKhong] = useState<Record<string, boolean>>({})
  const [xemTruong, setXemTruong] = useState<string | null>(null)

  const truongs = useMemo(() => donVis.filter((d) => d.active && d.loai !== 'OTHER' && (!scopeDonViId || d.id === scopeDonViId)).sort(soSanhTruong), [donVis, scopeDonViId])
  const thuTu = useMemo(() => thuTuTruong(donVis), [donVis])
  const cdTheoId = useMemo(() => new Map(chucDanhs.map((c) => [c.id, c])), [chucDanhs])
  const idPctn = loaiPhuCaps.find((l) => l.ma === 'PC_THAM_NIEN')?.id
  const pctnTheoNguoi = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of phuCapVienChucs) if (p.isActive && p.loaiPhuCapId === idPctn && p.giaTri > 0) m.set(p.vienChucId, Math.max(m.get(p.vienChucId) ?? 0, p.giaTri))
    return m
  }, [phuCapVienChucs, idPctn])

  // Mọi người đang công tác (biên chế, hợp đồng) khai BHXH; tình trạng xếp PCTN lần đầu chỉ tính cho CBQL, giáo viên
  const tatCa = useMemo<Dong[]>(() => vienChucs
    .filter((v) => duocTinhSoLieu(v) && (!scopeDonViId || v.donViId === scopeDonViId))
    .sort((a, b) => (thuTu.get(a.donViId) ?? 999) - (thuTu.get(b.donViId) ?? 999) || soSanhVienChuc((v: VienChuc) => cdTheoId.get(v.chucDanhId)?.nhom)(a, b))
    .map((v) => {
      const suaThang = Object.prototype.hasOwnProperty.call(nhap, v.id)
      const suaKhong = Object.prototype.hasOwnProperty.call(nhapKhong, v.id)
      const daSua = suaThang || suaKhong
      const thang = suaThang ? nhap[v.id] : v.batDauBhxhGd
      const khong = suaKhong ? nhapKhong[v.id] : !!v.khongThamGiaBhxh
      const pctn = pctnTheoNguoi.get(v.id) ?? 0
      const cd = cdTheoId.get(v.chucDanhId)
      const dienPctn = laDienPhuCapThamNien(v, cd?.nhom)
      const xet = dienPctn ? tinhTrangLanDau(pctn, thang, homNay) : undefined
      const nhom = nhomCoBan(v, cd?.nhom)
      const coTheTick = nhom === 'NHAN_VIEN'
      const tt: TrangThaiDong = coTheTick && khong ? 'KHONG_BHXH' : !thang ? 'CHUA_KHAI' : xet ? xet.tt : 'KHONG_DIEN'
      const tuoiThang = dayjs(homNay).diff(dayjs(v.ngaySinh), 'month')
      const nv = nhomViTri(v, cd?.nhom)
      return {
        vc: v, id: v.id, ho: v.ho, ten: v.ten, donViId: v.donViId,
        chucDanh: (v.chucVu && CHUC_VU_LABELS[v.chucVu]) || (nhom === 'CBQL' ? 'Cán bộ quản lý' : nhom === 'GIAO_VIEN' ? 'Giáo viên' : 'Nhân viên'),
        pctn, thang, khong: coTheTick && khong, coTheTick, daSua, dienPctn, uuTien: dienPctn && !pctn && !thang,
        tuoi: Math.floor(tuoiThang / 12), quaTuoi: tuoiThang >= tuoiNghiHuuThang(v.ngaySinh, v.gioiTinh),
        congViec: v.congViec ? (CONG_VIEC_LABELS[v.congViec] ?? v.congViec) : nv === 'NV_PHUC_VU' ? 'Nhân viên phục vụ' : 'Nhân viên khác',
        tt, du5Nam: xet?.du5Nam,
      }
    }), [vienChucs, cdTheoId, scopeDonViId, nhap, nhapKhong, pctnTheoNguoi, homNay, thuTu])

  const doiCuaDong = (d: Dong) => (d.thang ?? '') !== (d.vc.batDauBhxhGd ?? '') || d.khong !== !!d.vc.khongThamGiaBhxh
  const soDaSua = tatCa.filter((d) => d.daSua && doiCuaDong(d)).length

  // ── Tổng hợp theo trường (VHXH, quản trị) ──
  type DongTruong = { id: string; ten: string; tong: number; daKhai: number; khongBhxh: number; chuaKhai: number; uuTien: number; du5Nam: number; sapDu: number }
  const tongHop = useMemo<DongTruong[]>(() => truongs.map((t) => {
    const ds = tatCa.filter((d) => d.donViId === t.id)
    return {
      id: t.id, ten: t.ten, tong: ds.length,
      daKhai: ds.filter((d) => d.thang && !d.khong).length,
      khongBhxh: ds.filter((d) => d.khong).length,
      chuaKhai: ds.filter((d) => !daXuLy(d)).length,
      uuTien: ds.filter((d) => d.dienPctn && !d.pctn && !d.thang).length,
      du5Nam: ds.filter((d) => d.tt === 'DU_5_NAM').length,
      sapDu: ds.filter((d) => d.tt === 'SAP_DU').length,
    }
  }), [truongs, tatCa])
  const tong = tongHop.reduce((s, r) => ({ tong: s.tong + r.tong, daKhai: s.daKhai + r.daKhai, khongBhxh: s.khongBhxh + r.khongBhxh, chuaKhai: s.chuaKhai + r.chuaKhai, uuTien: s.uuTien + r.uuTien, du5Nam: s.du5Nam + r.du5Nam, sapDu: s.sapDu + r.sapDu }), { tong: 0, daKhai: 0, khongBhxh: 0, chuaKhai: 0, uuTien: 0, du5Nam: 0, sapDu: 0 })
  // Người không tham gia BHXH do quá tuổi theo công việc (bảo vệ, lao công...) để thống kê loại đối tượng này
  const khongTheoViec = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of tatCa) if (d.khong) m.set(d.congViec, (m.get(d.congViec) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [tatCa])
  const tenTruong = (id: string) => donVis.find((d) => d.id === id)?.ten ?? ''

  const xuatChuaKhai = () => {
    const ds = tatCa.filter((d) => !daXuLy(d))
    if (!ds.length) { message.info('Không còn người chưa khai'); return }
    const theoTruong = [...new Set(ds.map((d) => d.donViId))].sort((a, b) => (thuTu.get(a) ?? 999) - (thuTu.get(b) ?? 999))
    xuatExcelA4(`Chua-khai-BHXH-${homNay}`, [trangTuDanhSach(
      theoTruong.flatMap((t) => ds.filter((d) => d.donViId === t)).map((d, i) => ({
        STT: i + 1, 'Trường': tenTruong(d.donViId), 'Họ và tên': `${d.ho} ${d.ten}`, 'Ngày sinh': formatDate(d.vc.ngaySinh),
        'Chức vụ, chức danh': d.chucDanh, 'Loại hình': LOAI_LAO_DONG_LABELS[d.vc.loaiLaoDong] ?? '', 'Ngày vào ngành': formatDate(d.vc.ngayVaoNganh),
        'Ghi chú': d.uuTien ? 'Ưu tiên - CBQL/GV chưa hưởng PCTN, cần rà soát xếp lần đầu' : '',
      })),
      'Chưa khai BHXH',
      { tieuDe: ['DANH SÁCH CHƯA KHAI THÁNG BẮT ĐẦU ĐÓNG BHXH TRONG NGÀNH GIÁO DỤC', `(tính đến ${formatDate(homNay)})`] },
    )])
  }

  const xuatKhongBhxh = () => {
    const ds = tatCa.filter((d) => d.khong)
    if (!ds.length) { message.info('Chưa có người nào được ghi không tham gia BHXH do quá tuổi'); return }
    const theoTruong = [...new Set(ds.map((d) => d.donViId))].sort((a, b) => (thuTu.get(a) ?? 999) - (thuTu.get(b) ?? 999))
    xuatExcelA4(`Khong-tham-gia-BHXH-qua-tuoi-${homNay}`, [trangTuDanhSach(
      theoTruong.flatMap((t) => ds.filter((d) => d.donViId === t)).map((d, i) => ({
        STT: i + 1, 'Trường': tenTruong(d.donViId), 'Họ và tên': `${d.ho} ${d.ten}`, 'Ngày sinh': formatDate(d.vc.ngaySinh),
        'Giới tính': d.vc.gioiTinh === 'NAM' ? 'Nam' : 'Nữ', 'Tuổi': d.tuoi, 'Công việc': d.congViec,
        'Loại hình': LOAI_LAO_DONG_LABELS[d.vc.loaiLaoDong] ?? '',
      })),
      'Không tham gia BHXH',
      { tieuDe: ['DANH SÁCH NHÂN VIÊN KHÔNG THAM GIA BHXH DO QUÁ TUỔI', `(tính đến ${formatDate(homNay)}; ${ds.length} người)`], cotGiua: [0, 3, 4, 5] },
    )])
  }

  // ── Cập nhật theo trường ──
  const dsTruong = tatCa.filter((d) => !truongChon || d.donViId === truongChon)
  const dsHien = dsTruong.filter((d) => loc === 'TAT_CA' || d.tt === loc)
  const dem = (t: TrangThaiDong) => dsTruong.filter((d) => d.tt === t).length

  const luu = () => {
    if (!currentUser) return
    const thay = tatCa.filter((d) => d.daSua && doiCuaDong(d))
    if (!thay.length) { message.info('Chưa có thay đổi'); return }
    useVienChucStore.getState().capNhatNhieu(
      // Tick không tham gia BHXH thì không giữ tháng đóng BHXH
      thay.map((d) => ({ id: d.id, patch: { batDauBhxhGd: d.khong ? undefined : d.thang, khongThamGiaBhxh: d.khong ? true : undefined } })),
      currentUser.id, currentUser.fullName,
      `Bổ sung thông tin đóng BHXH (tháng bắt đầu, không tham gia do quá tuổi) cho ${thay.length} người`,
      truongChon,
    )
    setNhap({})
    setNhapKhong({})
    message.success(`Đã lưu ${thay.length} người`)
  }

  const taiMau = () => {
    if (!dsTruong.length) { message.info('Chọn trường có nhân sự'); return }
    // Đủ các cột như bảng trên màn hình (giữ dòng tiêu đề ở dòng 1 để nhập lại được); chỉ cột tháng BHXH được đọc khi nhập
    xuatExcelA4(`Mau-BHXH-${tenTruong(truongChon ?? dsTruong[0].donViId).replace(/\s+/g, '-')}`, [trangTuDanhSach(
      dsTruong.map((d, i) => ({
        STT: i + 1, 'Mã hồ sơ': d.vc.ma, 'Họ và tên': `${d.ho} ${d.ten}`, 'Ngày sinh': formatDate(d.vc.ngaySinh),
        'Chức vụ, chức danh': d.chucDanh, 'Loại hình': LOAI_LAO_DONG_LABELS[d.vc.loaiLaoDong] ?? '',
        'Ngày vào ngành': formatDate(d.vc.ngayVaoNganh),
        'PCTN đang hưởng': !d.dienPctn ? 'Không hưởng' : d.pctn ? `${d.pctn}%` : '',
        'Tuổi': d.tuoi,
        'Tháng bắt đầu đóng BHXH (MM/YYYY)': hienThang(d.thang),
        'Không tham gia BHXH do quá tuổi (x)': !d.coTheTick ? '' : d.khong ? 'x' : '',
        'Dự kiến đủ 5 năm': formatDate(d.du5Nam ?? ''),
        'Tình trạng': d.uuTien ? 'Chưa khai - cần rà soát PCTN' : NHAN_TRANG_THAI[d.tt].nhan,
      })),
      'BHXH',
      { rongCot: [5, 12, 26, 12, 16, 22, 12, 11, 7, 16, 16, 12, 28], cotGiua: [0, 1, 3, 6, 7, 8, 9, 10, 11] },
    )])
  }

  const nhapExcel = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
      const cacCot = Object.keys(rows[0] ?? {})
      const cotThang = cacCot.find((k) => /bhxh/i.test(k) && !/không tham gia/i.test(k))
      const cotKhong = cacCot.find((k) => /không tham gia/i.test(k))
      if (!cotThang) { message.error('Không thấy cột "Tháng bắt đầu đóng BHXH" - dùng file mẫu tải từ trang này'); return false }
      const theoMa = new Map(dsTruong.map((d) => [d.vc.ma, d]))
      const theoTen = new Map(dsTruong.map((d) => [`${d.ho} ${d.ten}`.toLowerCase().trim() + '|' + formatDate(d.vc.ngaySinh), d]))
      const moi: Record<string, string | undefined> = {}
      const moiKhong: Record<string, boolean> = {}
      const loi: string[] = []
      for (const r of rows) {
        const giaTri = r[cotThang]
        const dongTick = cotKhong ? String(r[cotKhong] ?? '').trim().toLowerCase() : ''
        if ((giaTri === '' || giaTri == null) && !dongTick) continue
        const d = theoMa.get(String(r['Mã hồ sơ'] ?? '').trim())
          ?? theoTen.get(`${String(r['Họ và tên'] ?? '').toLowerCase().trim()}|${String(r['Ngày sinh'] ?? '').trim()}`)
        if (!d) { loi.push(`Không khớp hồ sơ: ${r['Họ và tên'] ?? ''}`); continue }
        if (['x', 'có', 'co', '1', 'true', 'đúng'].includes(dongTick)) {
          if (!d.coTheTick) loi.push(`${d.ho} ${d.ten}: chỉ nhân viên được ghi không tham gia BHXH do quá tuổi`)
          else { moiKhong[d.id] = true; moi[d.id] = undefined }
          continue
        }
        if (giaTri === '' || giaTri == null) continue
        const thang = docThang(giaTri)
        if (!thang) { loi.push(`${d.ho} ${d.ten}: "${String(giaTri)}" không phải tháng/năm`); continue }
        moi[d.id] = thang
        if (d.khong) moiKhong[d.id] = false
      }
      setNhap((cu) => ({ ...cu, ...moi }))
      setNhapKhong((cu) => ({ ...cu, ...moiKhong }))
      const n = Object.keys(moi).length
      if (loi.length) {
        modal.warning({ title: `Đã đọc ${n} người, ${loi.length} dòng không nhận`, content: <ul style={{ paddingLeft: 18, margin: 0 }}>{loi.slice(0, 12).map((l) => <li key={l}>{l}</li>)}{loi.length > 12 && <li>và {loi.length - 12} dòng khác</li>}</ul> })
      } else message.success(`Đã đọc ${n} người - kiểm tra trên bảng rồi bấm Lưu`)
    } catch {
      message.error('Không đọc được file Excel')
    }
    return false
  }

  const columns: ColumnsType<Dong> = [
    cotSTT<Dong>(),
    cotHoTen<Dong>((r) => navigate(`/vien-chuc/${r.id}`)),
    ...(!scopeDonViId && !truongChon ? [{ title: 'Trường', key: 'tr', width: 190, render: (_: unknown, r: Dong) => tenTruong(r.donViId) }] : []),
    cotNgay<Dong>('Ngày sinh', (r) => r.vc.ngaySinh),
    cotGiua<Dong>('Tuổi', 'tuoi', 80, (r) => (r.quaTuoi
      ? <Tooltip title="Đã tới tuổi nghỉ hưu (NĐ 135) - có thể không còn đóng BHXH bắt buộc"><Text type="danger" strong>{r.tuoi}</Text></Tooltip>
      : r.tuoi)),
    { title: 'Chức vụ, chức danh', key: 'cd', width: 130, render: (_, r) => r.chucDanh },
    { title: 'Công việc', key: 'cv', width: 150, render: (_, r) => (r.coTheTick ? r.congViec : '') },
    { title: 'Loại hình', key: 'lh', width: 160, render: (_, r) => LOAI_LAO_DONG_LABELS[r.vc.loaiLaoDong] ?? '' },
    cotNgay<Dong>('Ngày vào ngành', (r) => r.vc.ngayVaoNganh),
    cotGiua<Dong>('PCTN đang hưởng', 'pctn', 90, (r) => (!r.dienPctn ? <Text type="secondary">Không hưởng</Text> : r.pctn ? `${r.pctn}%` : '-')),
    {
      title: 'Tháng bắt đầu đóng BHXH trong ngành GD', key: 'bhxh', width: 170, align: 'center',
      render: (_, r) => (suaDuoc
        ? <DatePicker picker="month" format="MM/YYYY" size="small" placeholder="Tháng/năm" disabled={r.khong} status={r.daSua && doiCuaDong(r) ? 'warning' : undefined}
            value={r.thang ? dayjs(`${r.thang}-01`) : null} onChange={(v) => setNhap((cu) => ({ ...cu, [r.id]: v ? v.format('YYYY-MM') : undefined }))} style={{ width: 120 }} />
        : r.khong ? '-' : hienThang(r.thang) || <Text type="warning">Chưa khai</Text>),
    },
    {
      title: <Tooltip title="Nhân viên phục vụ (lao công, bảo vệ...) quá tuổi, không còn đóng BHXH bắt buộc">Không tham gia BHXH (quá tuổi)</Tooltip>, key: 'khong', width: 150, align: 'center',
      render: (_, r) => (!r.coTheTick ? <Text type="secondary">-</Text> : suaDuoc
        ? <Checkbox checked={r.khong} onChange={(e) => {
            setNhapKhong((cu) => ({ ...cu, [r.id]: e.target.checked }))
            if (e.target.checked) setNhap((cu) => ({ ...cu, [r.id]: undefined }))
          }} />
        : r.khong ? <Tag color="purple" style={{ marginInlineEnd: 0 }}>Có</Tag> : '-'),
    },
    cotNgay<Dong>('Dự kiến đủ 5 năm', (r) => r.du5Nam),
    cotGiua<Dong>('Tình trạng', 'tt', 240, (r) => <Tag color={r.uuTien ? 'error' : NHAN_TRANG_THAI[r.tt].mau} style={{ marginInlineEnd: 0 }}>{r.uuTien ? 'Chưa khai - cần rà soát PCTN' : NHAN_TRANG_THAI[r.tt].nhan}</Tag>),
  ]

  const capNhat = (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        {!scopeDonViId && (
          <Select placeholder="Chọn trường" allowClear showSearch optionFilterProp="label" style={{ width: 240 }} value={truongChon}
            onChange={(v) => setTruongChon(v)} options={truongs.map((t) => ({ value: t.id, label: t.ten }))} />
        )}
        <Segmented<'TAT_CA' | TrangThaiDong>
          value={loc} onChange={setLoc}
          options={[
            { value: 'TAT_CA', label: `Tất cả (${dsTruong.length})` },
            { value: 'CHUA_KHAI', label: `Chưa khai (${dem('CHUA_KHAI')})` },
            { value: 'KHONG_BHXH', label: `Không tham gia BHXH (${dem('KHONG_BHXH')})` },
            { value: 'DU_5_NAM', label: `Đủ 5 năm (${dem('DU_5_NAM')})` },
            { value: 'SAP_DU', label: `Sắp đủ (${dem('SAP_DU')})` },
          ]}
        />
      </Space>
      {suaDuoc && (
        <Space wrap style={{ marginBottom: 12 }}>
          <Button icon={<DownloadOutlined />} onClick={taiMau}>Tải danh sách mẫu (Excel)</Button>
          <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={nhapExcel}><Button icon={<UploadOutlined />}>Nhập từ Excel</Button></Upload>
          <Button type="primary" icon={<SaveOutlined />} disabled={!soDaSua} onClick={luu}>Lưu {soDaSua ? `${soDaSua} thay đổi` : ''}</Button>
          {soDaSua > 0 && <Button onClick={() => setNhap({})}>Bỏ thay đổi</Button>}
        </Space>
      )}
      <Table<Dong> {...BANG_CHUAN} rowKey="id" dataSource={dsHien} columns={columns} pagination={phanTrang('người', 50)} />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
        Mọi người đang công tác (CBQL, giáo viên, nhân viên; biên chế và hợp đồng) khai tháng bắt đầu đóng BHXH bắt buộc trong ngành theo sổ / quá trình đóng BHXH.
        Tình trạng xếp phụ cấp thâm niên lần đầu chỉ tính cho CBQL, giáo viên: dự kiến đủ 5 năm = tháng đó + 60 tháng + 12 tháng tập sự (tạm tính);
        thời gian không tính (tập sự thực tế, nghỉ không lương…) khai chi tiết ở phiếu Xếp phụ cấp thâm niên nhà giáo lần đầu.
        Nhân viên phục vụ (lao công, bảo vệ...) đã quá tuổi nghỉ hưu, không còn đóng BHXH bắt buộc: tick <b>Không tham gia BHXH (quá tuổi)</b> - không phải khai tháng, không bị nhắc,
        được thống kê riêng; số tuổi tô đỏ là người đã tới tuổi nghỉ hưu (gợi ý).
        Nhập từ Excel: tải danh sách mẫu, điền cột tháng (MM/YYYY) hoặc đánh dấu x ở cột Không tham gia BHXH, nhập lại - bảng tô viền vàng các ô thay đổi, kiểm tra rồi bấm Lưu.
      </Text>
    </>
  )

  const colsTongHop: ColumnsType<DongTruong> = [
    cotSTT<DongTruong>(),
    { title: 'Trường', key: 'ten', width: 220, render: (_, r) => <a onClick={() => { setTruongChon(r.id); setLoc('TAT_CA'); setThe('cap-nhat') }}>{r.ten}</a> },
    cotGiua<DongTruong>('Tổng số người', 'tong', 90, (r) => r.tong),
    cotGiua<DongTruong>('Đã khai', 'dk', 80, (r) => r.daKhai),
    cotGiua<DongTruong>('Không tham gia BHXH (quá tuổi)', 'kb', 130, (r) => (r.khongBhxh ? <Text style={{ color: '#7c3aed' }} strong>{r.khongBhxh}</Text> : '-')),
    cotGiua<DongTruong>('Chưa khai', 'ck', 90, (r) => (r.chuaKhai ? <a onClick={() => setXemTruong(r.id)}><Text type="warning" strong>{r.chuaKhai}</Text></a> : <Text type="success">0</Text>)),
    cotGiua<DongTruong>('Trong đó CBQL, GV chưa hưởng PCTN', 'ut', 140, (r) => (r.uuTien ? <Text type="danger" strong>{r.uuTien}</Text> : '-')),
    cotGiua<DongTruong>('Đủ 5 năm chưa xếp', 'du', 110, (r) => (r.du5Nam ? <Text type="danger" strong>{r.du5Nam}</Text> : '-')),
    cotGiua<DongTruong>('Sắp đủ (6 tháng)', 'sd', 100, (r) => r.sapDu || '-'),
  ]
  const nguoiXem = xemTruong ? tatCa.filter((d) => d.donViId === xemTruong && !daXuLy(d)).sort((a, b) => Number(b.uuTien) - Number(a.uuTien)) : []

  const tongHopNode = (
    <>
      <Space size={32} wrap style={{ marginBottom: 12 }}>
        <Statistic title="Tổng số người" value={tong.tong} />
        <Statistic title="Đã khai BHXH" value={tong.daKhai} />
        <Statistic title="Không tham gia BHXH (quá tuổi)" value={tong.khongBhxh} styles={{ content: { color: '#7c3aed' } }} />
        <Statistic title="Chưa khai" value={tong.chuaKhai} styles={{ content: { color: tong.chuaKhai ? '#d97706' : undefined } }} />
        <Statistic title="CBQL, GV chưa hưởng PCTN chưa khai" value={tong.uuTien} styles={{ content: { color: tong.uuTien ? '#cf1322' : undefined } }} />
        <Statistic title="Đủ 5 năm chưa xếp PCTN" value={tong.du5Nam} styles={{ content: { color: tong.du5Nam ? '#cf1322' : undefined } }} />
      </Space>
      {tong.khongBhxh > 0 && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          title={`${tong.khongBhxh} nhân viên không tham gia BHXH do quá tuổi`}
          description={<>Theo công việc: {khongTheoViec.map(([v, n]) => <Tag key={v} color="purple">{v}: {n}</Tag>)}</>}
          action={<Button icon={<FileExcelOutlined />} onClick={xuatKhongBhxh}>Xuất danh sách</Button>} />
      )}
      {tong.chuaKhai > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          title={`${tong.chuaKhai} người chưa khai tháng bắt đầu đóng BHXH (chưa tính người không tham gia do quá tuổi; trong đó ${tong.uuTien} CBQL, giáo viên chưa hưởng PCTN - ưu tiên khai để rà soát xếp lần đầu)`}
          description="Xuất danh sách gửi các trường để kế toán bổ sung (trang này hoặc từng hồ sơ). Bấm số ở cột Chưa khai để xem từng người, bấm tên trường để xem cả trường."
          action={<Button icon={<FileExcelOutlined />} onClick={xuatChuaKhai}>Xuất danh sách chưa khai</Button>} />
      )}
      <Table<DongTruong> {...BANG_CHUAN} rowKey="id" dataSource={tongHop} columns={colsTongHop} pagination={false} />
      <Modal open={!!xemTruong} onCancel={() => setXemTruong(null)} footer={null} width={720} title={`Chưa khai BHXH - ${xemTruong ? tenTruong(xemTruong) : ''}`}>
        <Table<Dong> {...BANG_CHUAN} rowKey="id" dataSource={nguoiXem} pagination={false}
          columns={[cotSTT<Dong>(), cotHoTen<Dong>((r) => navigate(`/vien-chuc/${r.id}`)), cotNgay<Dong>('Ngày sinh', (r) => r.vc.ngaySinh), { title: 'Chức vụ, chức danh', key: 'cd', width: 130, render: (_, r) => r.chucDanh }, { title: 'Loại hình', key: 'lh', width: 160, render: (_, r) => LOAI_LAO_DONG_LABELS[r.vc.loaiLaoDong] ?? '' }, cotGiua<Dong>('Ưu tiên', 'ut', 80, (r) => (r.uuTien ? <Tag color="error" style={{ marginInlineEnd: 0 }}>PCTN</Tag> : ''))]} />
      </Modal>
    </>
  )

  return (
    <Card>
      <Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>{TEN_CHUC_NANG_BHXH}</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Tháng bắt đầu đóng BHXH bắt buộc trong ngành giáo dục của mọi người đang công tác (biên chế, hợp đồng); với cán bộ quản lý, giáo viên là căn cứ xếp phụ cấp thâm niên nhà giáo lần đầu (NĐ 77/2021/NĐ-CP).
      </Text>
      {scopeDonViId ? capNhat : (
        <Tabs activeKey={the} onChange={(k) => setThe(k as typeof the)} items={[
          { key: 'tong-hop', label: 'Kiểm tra các trường', children: tongHopNode },
          { key: 'cap-nhat', label: 'Danh sách theo trường', children: capNhat },
        ]} />
      )}
    </Card>
  )
}
