import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, App, Button, Card, DatePicker, Modal, Segmented, Select, Space, Statistic, Table, Tabs, Tag, Typography, Upload } from 'antd'
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
import { laDienPhuCapThamNien, nhomCoBan } from '@/utils/nhomViTri'
import { TINH_TRANG_LAN_DAU, tinhTrangLanDau } from '@/utils/pctnLanDau'
import type { TinhTrangLanDau } from '@/utils/pctnLanDau'
import { BANG_CHUAN, cotGiua, cotHoTen, cotNgay, cotSTT, phanTrang } from '@/utils/cotBang'
import { xuatExcelA4, trangTuDanhSach } from '@/utils/excelA4'
import { formatDate, soSanhVienChuc } from '@/utils/helpers'

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
  daSua: boolean
  /** CBQL, giáo viên - đối tượng phụ cấp thâm niên nhà giáo; nhân viên chỉ khai BHXH */
  dienPctn: boolean
  /** CBQL, giáo viên chưa hưởng PCTN mà chưa khai - cần khai trước để rà soát xếp lần đầu */
  uuTien: boolean
  tt: TrangThaiDong
  du5Nam?: string
}

/** Chưa khai (mọi người) → nhân viên đã khai → tình trạng xếp PCTN lần đầu (CBQL, giáo viên) */
type TrangThaiDong = TinhTrangLanDau | 'KHONG_DIEN'
const NHAN_TRANG_THAI: Record<TrangThaiDong, { nhan: string; mau: string }> = {
  ...TINH_TRANG_LAN_DAU,
  KHONG_DIEN: { nhan: 'Đã khai (không hưởng PCTN)', mau: 'default' },
}

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
  const [xemTruong, setXemTruong] = useState<string | null>(null)

  const truongs = useMemo(() => donVis.filter((d) => d.active && d.loai !== 'OTHER' && (!scopeDonViId || d.id === scopeDonViId)), [donVis, scopeDonViId])
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
    .sort(soSanhVienChuc((v) => cdTheoId.get(v.chucDanhId)?.nhom))
    .map((v) => {
      const daSua = Object.prototype.hasOwnProperty.call(nhap, v.id)
      const thang = daSua ? nhap[v.id] : v.batDauBhxhGd
      const pctn = pctnTheoNguoi.get(v.id) ?? 0
      const cd = cdTheoId.get(v.chucDanhId)
      const dienPctn = laDienPhuCapThamNien(v, cd?.nhom)
      const xet = dienPctn ? tinhTrangLanDau(pctn, thang, homNay) : undefined
      const tt: TrangThaiDong = !thang ? 'CHUA_KHAI' : xet ? xet.tt : 'KHONG_DIEN'
      const nhom = nhomCoBan(v, cd?.nhom)
      return {
        vc: v, id: v.id, ho: v.ho, ten: v.ten, donViId: v.donViId,
        chucDanh: (v.chucVu && CHUC_VU_LABELS[v.chucVu]) || (nhom === 'CBQL' ? 'Cán bộ quản lý' : nhom === 'GIAO_VIEN' ? 'Giáo viên' : 'Nhân viên'),
        pctn, thang, daSua, dienPctn, uuTien: dienPctn && !pctn && !thang, tt, du5Nam: xet?.du5Nam,
      }
    }), [vienChucs, cdTheoId, scopeDonViId, nhap, pctnTheoNguoi, homNay])

  const soDaSua = tatCa.filter((d) => d.daSua && (d.thang ?? '') !== (d.vc.batDauBhxhGd ?? '')).length

  // ── Tổng hợp theo trường (VHXH, quản trị) ──
  type DongTruong = { id: string; ten: string; tong: number; daKhai: number; chuaKhai: number; uuTien: number; du5Nam: number; sapDu: number }
  const tongHop = useMemo<DongTruong[]>(() => truongs.map((t) => {
    const ds = tatCa.filter((d) => d.donViId === t.id)
    return {
      id: t.id, ten: t.ten, tong: ds.length,
      daKhai: ds.filter((d) => d.vc.batDauBhxhGd).length,
      chuaKhai: ds.filter((d) => !d.vc.batDauBhxhGd).length,
      uuTien: ds.filter((d) => d.dienPctn && !d.pctn && !d.vc.batDauBhxhGd).length,
      du5Nam: ds.filter((d) => d.tt === 'DU_5_NAM').length,
      sapDu: ds.filter((d) => d.tt === 'SAP_DU').length,
    }
  }).sort((a, b) => b.uuTien - a.uuTien || b.chuaKhai - a.chuaKhai || a.ten.localeCompare(b.ten, 'vi')), [truongs, tatCa])
  const tong = tongHop.reduce((s, r) => ({ tong: s.tong + r.tong, daKhai: s.daKhai + r.daKhai, chuaKhai: s.chuaKhai + r.chuaKhai, uuTien: s.uuTien + r.uuTien, du5Nam: s.du5Nam + r.du5Nam, sapDu: s.sapDu + r.sapDu }), { tong: 0, daKhai: 0, chuaKhai: 0, uuTien: 0, du5Nam: 0, sapDu: 0 })
  const tenTruong = (id: string) => donVis.find((d) => d.id === id)?.ten ?? ''

  const xuatChuaKhai = () => {
    const ds = tatCa.filter((d) => !d.vc.batDauBhxhGd)
    if (!ds.length) { message.info('Không còn người chưa khai'); return }
    const theoTruong = [...new Set(ds.map((d) => d.donViId))].sort((a, b) => tenTruong(a).localeCompare(tenTruong(b), 'vi'))
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

  // ── Cập nhật theo trường ──
  const dsTruong = tatCa.filter((d) => !truongChon || d.donViId === truongChon)
  const dsHien = dsTruong.filter((d) => loc === 'TAT_CA' || d.tt === loc)
  const dem = (t: TrangThaiDong) => dsTruong.filter((d) => d.tt === t).length

  const luu = () => {
    if (!currentUser) return
    const thay = tatCa.filter((d) => d.daSua && (d.thang ?? '') !== (d.vc.batDauBhxhGd ?? ''))
    if (!thay.length) { message.info('Chưa có thay đổi'); return }
    useVienChucStore.getState().capNhatNhieu(
      thay.map((d) => ({ id: d.id, patch: { batDauBhxhGd: d.thang } })),
      currentUser.id, currentUser.fullName,
      `Bổ sung tháng bắt đầu đóng BHXH trong ngành giáo dục cho ${thay.length} người`,
      truongChon,
    )
    setNhap({})
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
        'Tháng bắt đầu đóng BHXH (MM/YYYY)': hienThang(d.thang),
        'Dự kiến đủ 5 năm': formatDate(d.du5Nam ?? ''),
        'Tình trạng': d.uuTien ? 'Chưa khai - cần rà soát PCTN' : NHAN_TRANG_THAI[d.tt].nhan,
      })),
      'BHXH',
      { rongCot: [5, 12, 26, 12, 16, 22, 12, 11, 16, 12, 28], cotGiua: [0, 1, 3, 6, 7, 8, 9] },
    )])
  }

  const nhapExcel = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
      const cotThang = Object.keys(rows[0] ?? {}).find((k) => /bhxh/i.test(k))
      if (!cotThang) { message.error('Không thấy cột "Tháng bắt đầu đóng BHXH" - dùng file mẫu tải từ trang này'); return false }
      const theoMa = new Map(dsTruong.map((d) => [d.vc.ma, d]))
      const theoTen = new Map(dsTruong.map((d) => [`${d.ho} ${d.ten}`.toLowerCase().trim() + '|' + formatDate(d.vc.ngaySinh), d]))
      const moi: Record<string, string | undefined> = {}
      const loi: string[] = []
      for (const r of rows) {
        const giaTri = r[cotThang]
        if (giaTri === '' || giaTri == null) continue
        const d = theoMa.get(String(r['Mã hồ sơ'] ?? '').trim())
          ?? theoTen.get(`${String(r['Họ và tên'] ?? '').toLowerCase().trim()}|${String(r['Ngày sinh'] ?? '').trim()}`)
        if (!d) { loi.push(`Không khớp hồ sơ: ${r['Họ và tên'] ?? ''}`); continue }
        const thang = docThang(giaTri)
        if (!thang) { loi.push(`${d.ho} ${d.ten}: "${String(giaTri)}" không phải tháng/năm`); continue }
        moi[d.id] = thang
      }
      setNhap((cu) => ({ ...cu, ...moi }))
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
    { title: 'Chức vụ, chức danh', key: 'cd', width: 130, render: (_, r) => r.chucDanh },
    { title: 'Loại hình', key: 'lh', width: 160, render: (_, r) => LOAI_LAO_DONG_LABELS[r.vc.loaiLaoDong] ?? '' },
    cotNgay<Dong>('Ngày vào ngành', (r) => r.vc.ngayVaoNganh),
    cotGiua<Dong>('PCTN đang hưởng', 'pctn', 90, (r) => (!r.dienPctn ? <Text type="secondary">Không hưởng</Text> : r.pctn ? `${r.pctn}%` : '-')),
    {
      title: 'Tháng bắt đầu đóng BHXH trong ngành GD', key: 'bhxh', width: 170, align: 'center',
      render: (_, r) => (suaDuoc
        ? <DatePicker picker="month" format="MM/YYYY" size="small" placeholder="Tháng/năm" status={r.daSua && (r.thang ?? '') !== (r.vc.batDauBhxhGd ?? '') ? 'warning' : undefined}
            value={r.thang ? dayjs(`${r.thang}-01`) : null} onChange={(v) => setNhap((cu) => ({ ...cu, [r.id]: v ? v.format('YYYY-MM') : undefined }))} style={{ width: 120 }} />
        : hienThang(r.thang) || <Text type="warning">Chưa khai</Text>),
    },
    cotNgay<Dong>('Dự kiến đủ 5 năm', (r) => r.du5Nam),
    cotGiua<Dong>('Tình trạng', 'tt', 220, (r) => <Tag color={r.uuTien ? 'error' : NHAN_TRANG_THAI[r.tt].mau} style={{ marginInlineEnd: 0 }}>{r.uuTien ? 'Chưa khai - cần rà soát PCTN' : NHAN_TRANG_THAI[r.tt].nhan}</Tag>),
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
        Nhập từ Excel: tải danh sách mẫu, điền cột tháng (MM/YYYY), nhập lại - bảng tô viền vàng các ô thay đổi, kiểm tra rồi bấm Lưu.
      </Text>
    </>
  )

  const colsTongHop: ColumnsType<DongTruong> = [
    cotSTT<DongTruong>(),
    { title: 'Trường', key: 'ten', width: 220, render: (_, r) => <a onClick={() => { setTruongChon(r.id); setLoc('TAT_CA'); setThe('cap-nhat') }}>{r.ten}</a> },
    cotGiua<DongTruong>('Tổng số người', 'tong', 90, (r) => r.tong),
    cotGiua<DongTruong>('Đã khai', 'dk', 80, (r) => r.daKhai),
    cotGiua<DongTruong>('Chưa khai', 'ck', 90, (r) => (r.chuaKhai ? <a onClick={() => setXemTruong(r.id)}><Text type="warning" strong>{r.chuaKhai}</Text></a> : <Text type="success">0</Text>)),
    cotGiua<DongTruong>('Trong đó CBQL, GV chưa hưởng PCTN', 'ut', 140, (r) => (r.uuTien ? <Text type="danger" strong>{r.uuTien}</Text> : '-')),
    cotGiua<DongTruong>('Đủ 5 năm chưa xếp', 'du', 110, (r) => (r.du5Nam ? <Text type="danger" strong>{r.du5Nam}</Text> : '-')),
    cotGiua<DongTruong>('Sắp đủ (6 tháng)', 'sd', 100, (r) => r.sapDu || '-'),
  ]
  const nguoiXem = xemTruong ? tatCa.filter((d) => d.donViId === xemTruong && !d.vc.batDauBhxhGd).sort((a, b) => Number(b.uuTien) - Number(a.uuTien)) : []

  const tongHopNode = (
    <>
      <Space size={32} wrap style={{ marginBottom: 12 }}>
        <Statistic title="Tổng số người" value={tong.tong} />
        <Statistic title="Đã khai BHXH" value={tong.daKhai} />
        <Statistic title="Chưa khai" value={tong.chuaKhai} styles={{ content: { color: tong.chuaKhai ? '#d97706' : undefined } }} />
        <Statistic title="CBQL, GV chưa hưởng PCTN chưa khai" value={tong.uuTien} styles={{ content: { color: tong.uuTien ? '#cf1322' : undefined } }} />
        <Statistic title="Đủ 5 năm chưa xếp PCTN" value={tong.du5Nam} styles={{ content: { color: tong.du5Nam ? '#cf1322' : undefined } }} />
      </Space>
      {tong.chuaKhai > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          title={`${tong.chuaKhai} người chưa khai tháng bắt đầu đóng BHXH (trong đó ${tong.uuTien} CBQL, giáo viên chưa hưởng PCTN - ưu tiên khai để rà soát xếp lần đầu)`}
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
