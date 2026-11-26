import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert, App, Button, Card, DatePicker, Descriptions, Empty, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, FileExcelOutlined, RollbackOutlined, SendOutlined, SyncOutlined, DeleteOutlined, SaveOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/hooks/useAuth'
import { usePhamVi } from '@/hooks/usePhamVi'
import { useTruyLinhStore } from '@/store/truyLinhStore'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import type { BangTruyLinh, DongTruyLinhLuong, DongTruyLinhPctn, KyTruyLinh, ThanhPhanLuong } from '@/types/truyLinh'
import { idBangTruyLinh, khoangKy, TEN_KY_TRUY_LINH, TRANG_THAI_TRUY_LINH } from '@/types/truyLinh'
import { isDangCongTac } from '@/types/vienChuc'
import {
  lapDongTruyLinh, tinhHeSo, chenhLechLuong, truyLinhLuong, chenhLechPctn, truyLinhPctn, tongBang, soThangTruyLinh, xuatExcelTruyLinh, docHeSo,
} from '@/utils/truyLinh'
import { soSanhTruong } from '@/utils/dinhMuc'
import { formatDate, vietHoaDauTu } from '@/utils/helpers'

const { Text, Title } = Typography

const d3 = (n?: number) => (n ? Number(n.toFixed(3)).toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : '')
const pct = (n?: number) => (n ? `${n}%` : '')
const thangNam = (d?: string) => (d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : '')
const CHUC_VU_THU_TRUONG = ['HT', 'GD', 'TRP', 'CVP']

/**
 * Truy lĩnh nâng lương thường xuyên, nâng phụ cấp thâm niên nhà giáo theo kỳ 6 tháng.
 * Trường lập từ các phiếu đã phê duyệt (số tháng truy lĩnh tính đến ngày cuối kỳ, sửa được), trình Trưởng phòng
 * VHXH duyệt (xác nhận của UBND phường); xuất Excel đúng mẫu danh sách truy lĩnh.
 */
export default function TruyLinhPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { currentUser, scopeDonViId, hasPermission, isVHXH, laQuanTri, isHieuTruong } = useAuth()
  const { trongPhamVi, donVisPhamVi } = usePhamVi()
  const bangs = useTruyLinhStore((s) => s.bangs)
  const luuBang = useTruyLinhStore((s) => s.luuBang)
  const xoaBang = useTruyLinhStore((s) => s.xoaBang)
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const donVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const bacLuongs = useDanhMucStore((s) => s.bacLuongs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const truongPhongVhxh = useDanhMucStore((s) => s.truongPhongVhxh)
  const setTruongPhongVhxh = useDanhMucStore((s) => s.setTruongPhongVhxh)
  const phuCaps = useLuongStore((s) => s.phuCapVienChucs)
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)

  const coLap = hasPermission('deXuat', 'write')
  const coTrinh = coLap || isHieuTruong
  const coDuyet = isVHXH || laQuanTri

  const homNay = dayjs()
  const [nam, setNam] = useState(homNay.year())
  const [ky, setKy] = useState<KyTruyLinh>(homNay.month() < 6 ? 'H1' : 'H2')
  const [donViChon, setDonViChon] = useState<string | undefined>(scopeDonViId ?? undefined)
  const idMo = params.get('id')
  const bangMo = bangs.find((b) => b.id === idMo)

  const tenDonVi = (id: string) => donVis.find((d) => d.id === id)?.ten ?? id
  const danhSach = useMemo(
    () => bangs.filter((b) => trongPhamVi(b.donViId))
      .sort((a, b) => b.nam - a.nam || b.ky.localeCompare(a.ky) || soSanhTruong(donVis.find((d) => d.id === a.donViId) ?? { loai: '', ten: '' }, donVis.find((d) => d.id === b.donViId) ?? { loai: '', ten: '' })),
    [bangs, trongPhamVi, donVis],
  )

  // Dòng đã nằm trong bảng truy lĩnh kỳ khác của đơn vị: không tính lại (phiếu duyệt muộn chỉ vào một kỳ)
  const daCoKyKhac = (donViId: string, idBang: string) => new Set(bangs
    .filter((b) => b.donViId === donViId && b.id !== idBang)
    .flatMap((b) => [...b.luong, ...b.pctn].map((x) => `${x.deXuatId}:${x.vienChucId}`)))
  const lapDong = (donViId: string, n: number, k: KyTruyLinh, tinhDen: string) => lapDongTruyLinh({
    donViId, nam: n, ky: k, tinhDen, deXuats, vienChucs, chucDanhs, bacLuongs, loaiPhuCaps, phuCaps, heSoLuongs,
    daCo: daCoKyKhac(donViId, idBangTruyLinh(donViId, n, k)),
  })

  const lapHoacMo = () => {
    const dv = scopeDonViId ?? donViChon
    if (!dv) { message.warning('Chọn đơn vị'); return }
    const id = idBangTruyLinh(dv, nam, ky)
    if (!bangs.some((b) => b.id === id)) {
      const tinhDen = khoangKy(nam, ky).den
      const dong = lapDong(dv, nam, ky, tinhDen)
      luuBang({
        id, donViId: dv, nam, ky, tinhDen, trangThai: 'NHAP', ...dong,
        nguoiLapId: currentUser?.id, nguoiLap: currentUser?.fullName, lichSu: [],
      }, 'LAP')
      message.success(`Đã lập bảng từ phiếu đã phê duyệt: ${dong.luong.length} người nâng lương, ${dong.pctn.length} người nâng PCTN`)
    }
    setParams({ id })
  }

  if (bangMo) {
    return (
      <ChiTietBang
        bang={bangMo}
        tenDonVi={tenDonVi(bangMo.donViId)}
        thuTruong={thuTruongDonVi(bangMo.donViId)}
        truongPhong={truongPhongVhxh}
        datTruongPhong={coDuyet ? setTruongPhongVhxh : undefined}
        coLap={coLap && (!scopeDonViId || scopeDonViId === bangMo.donViId)}
        coTrinh={coTrinh && (!scopeDonViId || scopeDonViId === bangMo.donViId)}
        coDuyet={coDuyet}
        lapLai={(tinhDen) => lapDong(bangMo.donViId, bangMo.nam, bangMo.ky, tinhDen)}
        luu={(b, hd, gc) => luuBang(b, hd, gc)}
        xoa={() => { xoaBang(bangMo.id); setParams({}) }}
        quayLai={() => setParams({})}
        moPhieu={(id) => navigate(`/de-xuat/${id}`)}
      />
    )
  }

  function thuTruongDonVi(donViId: string): string | undefined {
    const ht = vienChucs.find((v) => v.active && isDangCongTac(v) && v.donViId === donViId && v.chucVu && CHUC_VU_THU_TRUONG.includes(v.chucVu))
    return ht ? vietHoaDauTu(`${ht.ho} ${ht.ten}`) : donVis.find((d) => d.id === donViId)?.hieuTruong
  }

  return (
    <Card>
      <Title level={4} style={{ marginTop: 0 }}>Truy lĩnh nâng lương, phụ cấp thâm niên</Title>
      <Text type="secondary">
        Mỗi kỳ 6 tháng, đơn vị lập danh sách truy lĩnh từ các phiếu nâng lương thường xuyên (kể cả vượt khung, trước hạn) và
        nâng phụ cấp thâm niên nhà giáo đã được phê duyệt, rồi trình Trưởng phòng Văn hóa - Xã hội duyệt. Phiếu hưởng từ kỳ trước mà phê duyệt
        trong kỳ (VD nâng trước thời hạn xét cuối năm) được tính vào kỳ phê duyệt, truy lĩnh đủ từ tháng hưởng.
      </Text>
      <Space wrap style={{ margin: '16px 0' }}>
        <InputNumber value={nam} onChange={(v) => setNam(v ?? homNay.year())} min={2020} max={2100} style={{ width: 100 }} />
        <Select value={ky} onChange={setKy} style={{ width: 180 }} options={(['H1', 'H2'] as KyTruyLinh[]).map((k) => ({ value: k, label: TEN_KY_TRUY_LINH[k] }))} />
        {!scopeDonViId && (
          <Select placeholder="Chọn đơn vị" style={{ width: 260 }} value={donViChon} onChange={setDonViChon} allowClear showSearch optionFilterProp="label"
            options={[...donVisPhamVi].sort(soSanhTruong).map((d) => ({ value: d.id, label: d.ten }))} />
        )}
        {(coLap || coDuyet) && (
          <Button type="primary" icon={<PlusOutlined />} onClick={lapHoacMo}>
            {bangs.some((b) => b.id === idBangTruyLinh(scopeDonViId ?? donViChon ?? '', nam, ky)) ? 'Mở bảng truy lĩnh' : 'Lập bảng truy lĩnh'}
          </Button>
        )}
      </Space>
      <Table<BangTruyLinh>
        dataSource={danhSach}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="Chưa có bảng truy lĩnh nào" /> }}
        onRow={(b) => ({ onClick: () => setParams({ id: b.id }), style: { cursor: 'pointer' } })}
        columns={[
          ...(scopeDonViId ? [] : [{ title: 'Đơn vị', key: 'dv', render: (_: unknown, b: BangTruyLinh) => tenDonVi(b.donViId) }]),
          { title: 'Kỳ', key: 'ky', width: 190, render: (_, b) => `${TEN_KY_TRUY_LINH[b.ky]} ${b.nam}` },
          { title: 'Nâng lương', key: 'nl', width: 110, align: 'center', render: (_, b) => b.luong.length || '-' },
          { title: 'Nâng PCTN', key: 'tn', width: 110, align: 'center', render: (_, b) => b.pctn.length || '-' },
          { title: 'Tổng hệ số truy lĩnh', key: 'tong', width: 160, align: 'right', render: (_, b) => <b>{d3(tongBang(b).tong) || '0'}</b> },
          { title: 'Trạng thái', key: 'tt', width: 200, render: (_, b) => <Tag color={TRANG_THAI_TRUY_LINH[b.trangThai].mau}>{TRANG_THAI_TRUY_LINH[b.trangThai].ten}</Tag> },
          { title: 'Cập nhật', key: 'cn', width: 120, render: (_, b) => formatDate(b.updatedAt) },
        ]}
      />
    </Card>
  )
}

// ───────────────────────────── Chi tiết một bảng ─────────────────────────────

function ChiTietBang(p: {
  bang: BangTruyLinh
  tenDonVi: string
  thuTruong?: string
  truongPhong: string
  datTruongPhong?: (v: string) => void
  coLap: boolean
  coTrinh: boolean
  coDuyet: boolean
  lapLai: (tinhDen: string) => { luong: DongTruyLinhLuong[]; pctn: DongTruyLinhPctn[] }
  luu: (b: BangTruyLinh, hanhDong?: 'LAP' | 'TRINH' | 'DUYET' | 'TRA_LAI' | 'MO_LAI', ghiChu?: string) => BangTruyLinh
  xoa: () => void
  quayLai: () => void
  moPhieu: (id: string) => void
}) {
  const { message, modal } = App.useApp()
  const { bang } = p
  const [ban, setBan] = useState<BangTruyLinh>(bang)
  const [daDoi, setDaDoi] = useState(false)
  useEffect(() => { setBan(bang); setDaDoi(false) }, [bang.updatedAt, bang.id])

  const suaDuoc = p.coLap && (ban.trangThai === 'NHAP' || ban.trangThai === 'TRA_LAI')
  const doi = (b: BangTruyLinh) => { setBan(b); setDaDoi(true) }
  const tong = tongBang(ban)

  const datTinhDen = (d: string) => doi({
    ...ban, tinhDen: d,
    luong: ban.luong.map((x) => ({ ...x, soThang: soThangTruyLinh(x.thoiGianHuong, d) })),
    pctn: ban.pctn.map((x) => ({ ...x, soThang: soThangTruyLinh(x.thoiGianHuong, d) })),
  })

  const capNhatTuPhieu = () => {
    const moi = p.lapLai(ban.tinhDen)
    // Giữ ghi chú, thâm niên, số tháng đã sửa tay của người vẫn còn trong danh sách
    const giuLuong = new Map(ban.luong.map((x) => [`${x.deXuatId}:${x.vienChucId}`, x]))
    const giuPctn = new Map(ban.pctn.map((x) => [`${x.deXuatId}:${x.vienChucId}`, x]))
    doi({
      ...ban,
      luong: moi.luong.map((x) => { const c = giuLuong.get(`${x.deXuatId}:${x.vienChucId}`); return c ? { ...x, ghiChu: c.ghiChu } : x }),
      pctn: moi.pctn.map((x) => { const c = giuPctn.get(`${x.deXuatId}:${x.vienChucId}`); return c ? { ...x, ghiChu: c.ghiChu, thamNien: c.thamNien ?? x.thamNien } : x }),
    })
    message.success(`Đã cập nhật từ phiếu đã phê duyệt: ${moi.luong.length} người nâng lương, ${moi.pctn.length} người nâng PCTN - bấm Lưu để giữ`)
  }

  const luu = (hanhDong?: 'LAP' | 'TRINH' | 'DUYET' | 'TRA_LAI' | 'MO_LAI', patch: Partial<BangTruyLinh> = {}, ghiChu?: string) => {
    p.luu({ ...ban, ...patch }, hanhDong, ghiChu)
    setDaDoi(false)
  }

  const nhapYKien = (tieuDe: string, batBuoc: boolean, xong: (y: string) => void) => {
    let y = ''
    modal.confirm({
      title: tieuDe,
      content: <Input.TextArea rows={3} autoFocus placeholder={batBuoc ? 'Ghi rõ nội dung cần sửa' : 'Ý kiến (không bắt buộc)'} onChange={(e) => { y = e.target.value }} />,
      okText: 'Xác nhận',
      cancelText: 'Huỷ',
      onOk: () => {
        if (batBuoc && !y.trim()) { message.warning('Nhập lý do trả lại'); return Promise.reject() }
        xong(y.trim())
      },
    })
  }

  const xuat = () => xuatExcelTruyLinh(ban, { tenDonVi: p.tenDonVi, thuTruong: p.thuTruong, truongPhong: p.truongPhong })

  // ── Cột bảng ──
  const cotLuong = (ten: string, k: 'cu' | 'moi') => ({
    title: ten,
    children: [
      { title: 'Mã ngạch', key: `${k}ma`, width: 92, align: 'center' as const, render: (_: unknown, d: DongTruyLinhLuong) => d[k].maNgach },
      { title: 'Bậc', key: `${k}bac`, width: 46, align: 'center' as const, render: (_: unknown, d: DongTruyLinhLuong) => d[k].bac ?? '' },
      { title: 'Hệ số', key: `${k}hs`, width: 58, align: 'right' as const, render: (_: unknown, d: DongTruyLinhLuong) => d[k].heSo.toFixed(2) },
      { title: 'PCCV', key: `${k}cv`, width: 54, align: 'right' as const, render: (_: unknown, d: DongTruyLinhLuong) => d3(d[k].pcChucVu) },
      { title: 'PC TN', key: `${k}tn`, width: 54, align: 'right' as const, render: (_: unknown, d: DongTruyLinhLuong) => d3(d[k].pcTrachNhiem) },
      { title: 'TNVK', key: `${k}vk`, width: 82, align: 'right' as const, render: (_: unknown, d: DongTruyLinhLuong) => (d[k].vkPct ? <span>{pct(d[k].vkPct)} <Text type="secondary">({d3(tinhHeSo(d[k]).vkHs)})</Text></span> : '') },
      { title: 'TN nghề', key: `${k}tnn`, width: 92, align: 'right' as const, render: (_: unknown, d: DongTruyLinhLuong) => (d[k].tnnPct ? <span>{pct(d[k].tnnPct)} <Text type="secondary">({d3(tinhHeSo(d[k]).tnnHs)})</Text></span> : '') },
      { title: 'Ưu đãi', key: `${k}ud`, width: 60, align: 'right' as const, render: (_: unknown, d: DongTruyLinhLuong) => d3(tinhHeSo(d[k]).udHs) },
      { title: 'Bảo lưu', key: `${k}bl`, width: 58, align: 'right' as const, render: (_: unknown, d: DongTruyLinhLuong) => d3(d[k].baoLuu) },
      { title: 'Tổng', key: `${k}tong`, width: 66, align: 'right' as const, render: (_: unknown, d: DongTruyLinhLuong) => <b>{d3(tinhHeSo(d[k]).tong)}</b> },
    ],
  })
  const suaDong = <T extends DongTruyLinhLuong | DongTruyLinhPctn>(loai: 'luong' | 'pctn', i: number, patch: Partial<T>) =>
    doi({ ...ban, [loai]: (ban[loai] as T[]).map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const cotSoThang = (loai: 'luong' | 'pctn') => ({
    title: 'Số tháng', key: 'st', width: 78, align: 'center' as const,
    render: (_: unknown, d: DongTruyLinhLuong | DongTruyLinhPctn, i: number) => (suaDuoc
      ? <InputNumber size="small" min={0} max={60} value={d.soThang} style={{ width: 60 }} onChange={(v) => suaDong(loai, i, { soThang: v ?? 0 })} />
      : d.soThang),
  })
  const cotTen = (loai: 'luong' | 'pctn') => ({
    title: 'Họ và tên', key: 'ht', width: 190, fixed: 'left' as const,
    render: (_: unknown, d: DongTruyLinhLuong | DongTruyLinhPctn) => (
      <Space size={4} wrap>
        <span>{d.hoTen}</span>
        {loai === 'luong' && (d as DongTruyLinhLuong).loai === 'VUOT_KHUNG' && <Tag color="purple" style={{ marginInlineEnd: 0 }}>Vượt khung</Tag>}
        {loai === 'luong' && (d as DongTruyLinhLuong).loai === 'TRUOC_HAN' && <Tag color="gold" style={{ marginInlineEnd: 0 }}>Trước hạn</Tag>}
        <Tooltip title="Mở phiếu đã phê duyệt"><a onClick={() => p.moPhieu(d.deXuatId)} style={{ fontSize: 12 }}>{d.deXuatMa}</a></Tooltip>
      </Space>
    ),
  })
  const cotGhiChu = (loai: 'luong' | 'pctn') => ({
    title: 'Ghi chú', key: 'gc', width: 170,
    render: (_: unknown, d: DongTruyLinhLuong | DongTruyLinhPctn, i: number) => (suaDuoc
      ? <Input size="small" value={d.ghiChu} onChange={(e) => suaDong(loai, i, { ghiChu: e.target.value })} />
      : d.ghiChu),
  })

  const colsLuong = [
    { title: 'TT', key: 'tt', width: 42, align: 'center' as const, fixed: 'left' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
    cotTen('luong'),
    cotLuong('Lương đang hưởng', 'cu'),
    cotLuong('Lương mới', 'moi'),
    { title: 'Thời gian hưởng', key: 'tgh', width: 80, align: 'center' as const, render: (_: unknown, d: DongTruyLinhLuong) => thangNam(d.thoiGianHuong) },
    { title: 'Mốc xét lần sau', key: 'moc', width: 80, align: 'center' as const, render: (_: unknown, d: DongTruyLinhLuong) => thangNam(d.mocLanSau) },
    { title: 'HS chênh lệch', key: 'cl', width: 76, align: 'right' as const, render: (_: unknown, d: DongTruyLinhLuong) => d3(chenhLechLuong(d)) },
    cotSoThang('luong'),
    { title: 'Tổng HS truy lĩnh', key: 'tl', width: 90, align: 'right' as const, onCell: () => ({ style: { background: '#eef4fd' } }), render: (_: unknown, d: DongTruyLinhLuong) => <b>{d3(truyLinhLuong(d))}</b> },
    cotGhiChu('luong'),
  ]

  type Tn = Pick<ThanhPhanLuong, 'bac' | 'heSo' | 'vkPct' | 'pcChucVu' | 'tnnPct'>
  const cotTn = (ten: string, k: 'cu' | 'moi', moc: (d: DongTruyLinhPctn) => string | undefined, tenMoc: string) => ({
    title: ten,
    children: [
      { title: 'Bậc', key: `${k}bac`, width: 46, align: 'center' as const, render: (_: unknown, d: DongTruyLinhPctn) => d[k].bac ?? '' },
      { title: 'Hệ số', key: `${k}hs`, width: 58, align: 'right' as const, render: (_: unknown, d: DongTruyLinhPctn) => d[k].heSo.toFixed(2) },
      { title: 'TNVK', key: `${k}vk`, width: 82, align: 'right' as const, render: (_: unknown, d: DongTruyLinhPctn) => (d[k].vkPct ? <span>{pct(d[k].vkPct)} <Text type="secondary">({d3(tinhHeSo(d[k] as Tn).vkHs)})</Text></span> : '') },
      { title: 'PCCV', key: `${k}cv`, width: 54, align: 'right' as const, render: (_: unknown, d: DongTruyLinhPctn) => d3(d[k].pcChucVu) },
      { title: 'PC thâm niên', key: `${k}tn`, width: 96, align: 'right' as const, render: (_: unknown, d: DongTruyLinhPctn) => (d[k].tnnPct ? <span>{pct(d[k].tnnPct)} <Text type="secondary">({d3(tinhHeSo(d[k] as Tn).tnnHs)})</Text></span> : '') },
      { title: 'Tổng', key: `${k}tong`, width: 66, align: 'right' as const, render: (_: unknown, d: DongTruyLinhPctn) => <b>{d3(tinhHeSo(d[k] as Tn).tongTn)}</b> },
      { title: tenMoc, key: `${k}moc`, width: 80, align: 'center' as const, render: (_: unknown, d: DongTruyLinhPctn) => thangNam(moc(d)) },
    ],
  })
  const colsPctn = [
    { title: 'TT', key: 'tt', width: 42, align: 'center' as const, fixed: 'left' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
    cotTen('pctn'),
    { title: 'Ngày sinh', key: 'ns', width: 92, align: 'center' as const, render: (_: unknown, d: DongTruyLinhPctn) => <span>{formatDate(d.ngaySinh)} <Text type="secondary" style={{ fontSize: 12 }}>{d.gioiTinh === 'NAM' ? 'Nam' : 'Nữ'}</Text></span> },
    {
      title: <Tooltip title={`Tổng số năm thực tế giảng dạy có tham gia BHXH đến ${formatDate(ban.tinhDen)} - tính từ tháng bắt đầu đóng BHXH trong ngành ở hồ sơ, sửa được`}>Thâm niên GD</Tooltip>,
      key: 'tng', width: 92, align: 'center' as const,
      render: (_: unknown, d: DongTruyLinhPctn, i: number) => (suaDuoc
        ? <Input size="small" value={d.thamNien} placeholder="VD 24n1th" onChange={(e) => suaDong<DongTruyLinhPctn>('pctn', i, { thamNien: e.target.value })} />
        : d.thamNien),
    },
    { title: 'Mã CDNN', key: 'ma', width: 92, align: 'center' as const, render: (_: unknown, d: DongTruyLinhPctn) => d.maNgach },
    cotTn('Lương đã hưởng', 'cu', (d) => d.mocCu, 'Mốc hưởng'),
    cotTn('Lương được nâng', 'moi', (d) => d.mocLanSau, 'Mốc lần sau'),
    { title: 'Thời gian hưởng', key: 'tgh', width: 80, align: 'center' as const, render: (_: unknown, d: DongTruyLinhPctn) => thangNam(d.thoiGianHuong) },
    { title: 'HS chênh lệch', key: 'cl', width: 76, align: 'right' as const, render: (_: unknown, d: DongTruyLinhPctn) => d3(chenhLechPctn(d)) },
    cotSoThang('pctn'),
    { title: 'Tổng HS truy lĩnh', key: 'tl', width: 90, align: 'right' as const, onCell: () => ({ style: { background: '#eef4fd' } }), render: (_: unknown, d: DongTruyLinhPctn) => <b>{d3(truyLinhPctn(d))}</b> },
    cotGhiChu('pctn'),
  ]

  const dongTong = (soCotTruoc: number, giaTri: number, soNguoi: number): ReactNode => (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ background: '#eef4fd', fontWeight: 700 }}>
        <Table.Summary.Cell index={0} colSpan={soCotTruoc} align="right">Cộng ({soNguoi} người) - tổng hệ số truy lĩnh</Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right">{d3(giaTri) || '0'}</Table.Summary.Cell>
        <Table.Summary.Cell index={2} />
      </Table.Summary.Row>
    </Table.Summary>
  )

  const tt = TRANG_THAI_TRUY_LINH[ban.trangThai]
  return (
    <Card>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => {
          if (!daDoi) { p.quayLai(); return }
          modal.confirm({ title: 'Chưa lưu thay đổi', content: 'Thoát mà không lưu?', okText: 'Thoát', cancelText: 'Ở lại', onOk: p.quayLai })
        }}>Danh sách</Button>
        <Title level={4} style={{ margin: 0 }}>Truy lĩnh {TEN_KY_TRUY_LINH[ban.ky]} {ban.nam} - {p.tenDonVi}</Title>
        <Tag color={tt.mau}>{tt.ten}</Tag>
      </Space>

      {ban.trangThai === 'TRA_LAI' && ban.yKienDuyet && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} title="Trưởng phòng trả lại để sửa" description={ban.yKienDuyet} />
      )}

      <Descriptions size="small" bordered column={{ xs: 1, md: 3 }} style={{ marginBottom: 12 }}>
        <Descriptions.Item label="Tính đến ngày">
          {suaDuoc
            ? <DatePicker size="small" value={dayjs(ban.tinhDen)} format="DD/MM/YYYY" allowClear={false} onChange={(d) => d && datTinhDen(d.format('YYYY-MM-DD'))} />
            : formatDate(ban.tinhDen)}
        </Descriptions.Item>
        <Descriptions.Item label="Người lập">{ban.nguoiLap ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Tổng hệ số truy lĩnh"><b>{d3(tong.tong) || '0'}</b> <Text type="secondary">(nâng lương {d3(tong.luong) || '0'} · PCTN {d3(tong.pctn) || '0'})</Text></Descriptions.Item>
        <Descriptions.Item label="Thủ trưởng đơn vị ký">{p.thuTruong ?? <Text type="warning">Chưa xác định - khai chức vụ Hiệu trưởng / Giám đốc / Trưởng phòng ở hồ sơ</Text>}</Descriptions.Item>
        <Descriptions.Item label="Trưởng phòng VHXH ký">
          {p.datTruongPhong
            ? <Input size="small" style={{ width: 220 }} defaultValue={p.truongPhong} onBlur={(e) => { const v = vietHoaDauTu(e.target.value); if (v && v !== p.truongPhong) { p.datTruongPhong!(v); message.success('Đã lưu tên Trưởng phòng ký') } }} />
            : p.truongPhong || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Duyệt">{ban.ngayDuyet ? `${ban.nguoiDuyet ?? ''} - ${formatDate(ban.ngayDuyet)}` : ban.ngayTrinh ? `Trình ngày ${formatDate(ban.ngayTrinh)}` : '-'}</Descriptions.Item>
      </Descriptions>

      <Space wrap style={{ marginBottom: 12 }}>
        {suaDuoc && <Button icon={<SyncOutlined />} onClick={capNhatTuPhieu}>Cập nhật từ phiếu đã phê duyệt</Button>}
        {suaDuoc && <Button icon={<SaveOutlined />} disabled={!daDoi} onClick={() => { luu('LAP'); message.success('Đã lưu') }}>Lưu</Button>}
        {p.coTrinh && (ban.trangThai === 'NHAP' || ban.trangThai === 'TRA_LAI') && (
          <Popconfirm title="Trình Trưởng phòng VHXH duyệt?" description={`${ban.luong.length} người nâng lương, ${ban.pctn.length} người nâng PCTN - tổng hệ số ${d3(tong.tong) || 0}`} okText="Trình" cancelText="Huỷ"
            onConfirm={() => { luu('TRINH', { trangThai: 'CHO_DUYET', ngayTrinh: new Date().toISOString(), yKienDuyet: undefined }); message.success('Đã trình Trưởng phòng duyệt') }}>
            <Button type="primary" icon={<SendOutlined />} disabled={!ban.luong.length && !ban.pctn.length}>Trình Trưởng phòng duyệt</Button>
          </Popconfirm>
        )}
        {p.coDuyet && ban.trangThai === 'CHO_DUYET' && <>
          <Button type="primary" icon={<CheckOutlined />} onClick={() => nhapYKien('Duyệt danh sách truy lĩnh', false, (y) => {
            luu('DUYET', { trangThai: 'DA_DUYET', ngayDuyet: new Date().toISOString(), nguoiDuyet: p.truongPhong || undefined, yKienDuyet: y || undefined }, y)
            message.success('Đã duyệt')
          })}>Duyệt</Button>
          <Button danger icon={<RollbackOutlined />} onClick={() => nhapYKien('Trả lại cho đơn vị sửa', true, (y) => {
            luu('TRA_LAI', { trangThai: 'TRA_LAI', yKienDuyet: y }, y)
            message.success('Đã trả lại')
          })}>Trả lại</Button>
        </>}
        {p.coDuyet && ban.trangThai === 'DA_DUYET' && (
          <Popconfirm title="Mở lại để đơn vị sửa?" okText="Mở lại" cancelText="Huỷ" onConfirm={() => luu('MO_LAI', { trangThai: 'TRA_LAI', ngayDuyet: undefined, yKienDuyet: 'Mở lại để sửa' })}>
            <Button icon={<RollbackOutlined />}>Mở lại để sửa</Button>
          </Popconfirm>
        )}
        <Button icon={<FileExcelOutlined />} onClick={xuat}>Xuất Excel theo mẫu</Button>
        {p.coLap && ban.trangThai === 'NHAP' && (
          <Popconfirm title="Xoá bản nháp này?" okText="Xoá" okButtonProps={{ danger: true }} cancelText="Huỷ" onConfirm={p.xoa}>
            <Button danger icon={<DeleteOutlined />}>Xoá bản nháp</Button>
          </Popconfirm>
        )}
      </Space>

      <Tabs
        items={[
          {
            key: 'luong',
            label: `Truy lĩnh nâng lương (${ban.luong.length})`,
            children: (
              <Table<DongTruyLinhLuong>
                dataSource={ban.luong} rowKey={(d) => `${d.deXuatId}:${d.vienChucId}`} size="small" bordered pagination={false}
                scroll={{ x: 2050 }} columns={colsLuong as never}
                locale={{ emptyText: `Không có phiếu nâng lương đã phê duyệt có thời gian hưởng trong ${TEN_KY_TRUY_LINH[ban.ky]} ${ban.nam}` }}
                summary={() => (ban.luong.length ? dongTong(2 + 20 + 4, tong.luong, ban.luong.length) : null)}
              />
            ),
          },
          {
            key: 'pctn',
            label: `Truy lĩnh phụ cấp thâm niên (${ban.pctn.length})`,
            children: (
              <Table<DongTruyLinhPctn>
                dataSource={ban.pctn} rowKey={(d) => `${d.deXuatId}:${d.vienChucId}`} size="small" bordered pagination={false}
                scroll={{ x: 1900 }} columns={colsPctn as never}
                locale={{ emptyText: `Không có phiếu nâng phụ cấp thâm niên đã phê duyệt có thời gian hưởng trong ${TEN_KY_TRUY_LINH[ban.ky]} ${ban.nam}` }}
                summary={() => (ban.pctn.length ? dongTong(5 + 14 + 3, tong.pctn, ban.pctn.length) : null)}
              />
            ),
          },
        ]}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
        Tổng hệ số truy lĩnh: <b>{d3(tong.tong) || '0'}</b> ({docHeSo(tong.tong)}). Số tháng truy lĩnh tính từ tháng hưởng đến tháng của ngày "Tính đến", sửa được từng người.
        Người vừa nâng lương vừa nâng thâm niên trong kỳ: danh sách PCTN tính trên lương đã nâng, không tính trùng phần tăng.
        Phiếu hưởng từ kỳ trước nhưng phê duyệt trong kỳ này (thường gặp ở nâng lương trước thời hạn) được đưa vào kỳ này, truy lĩnh từ tháng hưởng;
        người đã có trong bảng kỳ khác không bị tính lại.
      </Text>
    </Card>
  )
}
