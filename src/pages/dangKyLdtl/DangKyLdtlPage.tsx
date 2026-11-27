import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert, App, Button, Card, Descriptions, Empty, Input, InputNumber, Popconfirm, Select, Space, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import {
  ArrowLeftOutlined, CheckOutlined, DeleteOutlined, FileExcelOutlined, PlusOutlined, RollbackOutlined, SaveOutlined, SendOutlined, SyncOutlined, HistoryOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/hooks/useAuth'
import { usePhamVi } from '@/hooks/usePhamVi'
import { useDangKyLdtlStore } from '@/store/dangKyLdtlStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import type { ChiTieuDangKy, DangKyLdtl, DongDangKy, KyDangKy, LichSuDangKy } from '@/types/dangKyLdtl'
import { idDangKy, khoangKyDangKy, kyTruoc, TEN_KY_DANG_KY, TRANG_THAI_DANG_KY } from '@/types/dangKyLdtl'
import { isDangCongTac } from '@/types/vienChuc'
import {
  bieuTongHop, lapDongDangKy, tinhDangKy, tongHeSoDangKy, tongLuongChinh, tongMotThang, xuatExcelDangKy,
} from '@/utils/dangKyLdtl'
import type { DongTongHop, KhoaChiTieu } from '@/utils/dangKyLdtl'
import { docHeSo } from '@/utils/truyLinh'
import { soSanhTruong } from '@/utils/dinhMuc'
import { formatDate, formatDatetime, vietHoaDauTu } from '@/utils/helpers'
import { laNguoiLap, laPheDuyet, laThamDinh, laThuTruong } from '@/utils/dangKyLdtlQuyTrinh'
import type { QuyenDangKy } from '@/utils/dangKyLdtlQuyTrinh'

const { Text, Title } = Typography

const d3 = (n?: number) => (n ? Number(n.toFixed(3)).toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : '')
const soNguyen = (n?: number) => (n ? n.toLocaleString('vi-VN') : '')
const CHUC_VU_THU_TRUONG: Record<string, string> = { HT: 'HIỆU TRƯỞNG', GD: 'GIÁM ĐỐC', TRP: 'TRƯỞNG PHÒNG', CVP: 'CHÁNH VĂN PHÒNG' }

/** Kỳ đăng ký kế tiếp: quý IV và quý I đăng ký 6 tháng đầu năm, quý II - III đăng ký 6 tháng cuối năm */
function kyMacDinh(): { nam: number; ky: KyDangKy } {
  const t = dayjs()
  const m = t.month() + 1
  if (m >= 10) return { nam: t.year() + 1, ky: 'H1' }
  if (m <= 3) return { nam: t.year(), ky: 'H1' }
  return { nam: t.year(), ky: 'H2' }
}

/**
 * Đăng ký lao động tiền lương theo kỳ 6 tháng. Đơn vị lập từ hồ sơ lương hiện hưởng (biên chế, hợp đồng), nhập kế hoạch
 * được duyệt kỳ trước (tự lấy nếu kỳ trước đã duyệt trên phần mềm). Bốn bước như phiếu nâng lương: cán bộ đơn vị lập, trình →
 * Thủ trưởng đơn vị duyệt → Phòng VHXH thẩm định → Lãnh đạo Phòng phê duyệt; xuất Excel đúng mẫu.
 */
export default function DangKyLdtlPage() {
  const { message } = App.useApp()
  const [params, setParams] = useSearchParams()
  const { currentUser, scopeDonViId, hasPermission } = useAuth()
  const { trongPhamVi, donVisPhamVi } = usePhamVi()
  const dangKys = useDangKyLdtlStore((s) => s.dangKys)
  const luu = useDangKyLdtlStore((s) => s.luu)
  const xoa = useDangKyLdtlStore((s) => s.xoa)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const donVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const truongPhongVhxh = useDanhMucStore((s) => s.truongPhongVhxh)
  const setTruongPhongVhxh = useDanhMucStore((s) => s.setTruongPhongVhxh)
  const phuCaps = useLuongStore((s) => s.phuCapVienChucs)
  const heSos = useLuongStore((s) => s.heSoLuongs)

  const quyen: QuyenDangKy = {
    scopeDonViId,
    coLap: hasPermission('dangKyLdtl', 'write'),
    coThuTruong: hasPermission('dangKyLdtl', 'approve'),
    coThamDinh: hasPermission('dangKyLdtl', 'thamDinh'),
    coPheDuyet: hasPermission('dangKyLdtl', 'pheDuyet'),
    trongPhamVi,
  }
  const coLap = quyen.coLap

  const md = kyMacDinh()
  const [nam, setNam] = useState(md.nam)
  const [ky, setKy] = useState<KyDangKy>(md.ky)
  const [donViChon, setDonViChon] = useState<string | undefined>(scopeDonViId ?? undefined)
  const banMo = dangKys.find((b) => b.id === params.get('id'))

  const tenDonVi = (id: string) => donVis.find((d) => d.id === id)?.ten ?? id
  const danhSach = useMemo(
    () => dangKys.filter((b) => trongPhamVi(b.donViId))
      .sort((a, b) => b.nam - a.nam || b.ky.localeCompare(a.ky) || soSanhTruong(donVis.find((d) => d.id === a.donViId) ?? { loai: '', ten: '' }, donVis.find((d) => d.id === b.donViId) ?? { loai: '', ten: '' })),
    [dangKys, trongPhamVi, donVis],
  )

  const lapDong = (donViId: string, n: number, k: KyDangKy) => lapDongDangKy({ donViId, nam: n, ky: k, vienChucs, heSos, phuCaps, loaiPhuCaps, chucDanhs })
  /** Số đăng ký của kỳ trước đã duyệt trên phần mềm = kế hoạch được duyệt của kỳ này */
  const keHoachKyTruoc = (donViId: string, n: number, k: KyDangKy): ChiTieuDangKy | undefined => {
    const t = kyTruoc(n, k)
    const truoc = dangKys.find((b) => b.id === idDangKy(donViId, t.nam, t.ky) && b.trangThai === 'DA_DUYET')
    return truoc ? tinhDangKy(truoc.dong) : undefined
  }

  const thuTruongDonVi = (donViId: string) => {
    const ht = vienChucs.find((v) => v.active && isDangCongTac(v) && v.donViId === donViId && v.chucVu && CHUC_VU_THU_TRUONG[v.chucVu])
    return {
      ten: ht ? vietHoaDauTu(`${ht.ho} ${ht.ten}`) : donVis.find((d) => d.id === donViId)?.hieuTruong,
      chucDanh: (ht?.chucVu && CHUC_VU_THU_TRUONG[ht.chucVu]) || 'THỦ TRƯỞNG ĐƠN VỊ',
    }
  }

  const lapHoacMo = () => {
    const dv = scopeDonViId ?? donViChon
    if (!dv) { message.warning('Chọn đơn vị'); return }
    const id = idDangKy(dv, nam, ky)
    if (!dangKys.some((b) => b.id === id)) {
      const dong = lapDong(dv, nam, ky)
      luu({
        id, donViId: dv, nam, ky, trangThai: 'NHAP', dong, keHoach: keHoachKyTruoc(dv, nam, ky) ?? {}, thucHien: {},
        nguoiLapId: currentUser?.id, nguoiLap: currentUser?.fullName, lichSu: [],
      }, 'LAP')
      message.success(`Đã lập từ hồ sơ: ${dong.length} người`)
    }
    setParams({ id })
  }

  if (banMo) {
    const tt = thuTruongDonVi(banMo.donViId)
    return (
      <ChiTiet
        ban={banMo}
        tenDonVi={tenDonVi(banMo.donViId)}
        thuTruong={tt.ten}
        chucDanhThuTruong={tt.chucDanh}
        truongPhong={truongPhongVhxh}
        datTruongPhong={laPheDuyet(banMo, quyen) || laThamDinh(banMo, quyen) || hasPermission('quyDinh', 'write') ? setTruongPhongVhxh : undefined}
        coLap={laNguoiLap(banMo, quyen)}
        coThuTruong={laThuTruong(banMo, quyen)}
        coThamDinh={laThamDinh(banMo, quyen)}
        coPheDuyet={laPheDuyet(banMo, quyen)}
        lapLai={() => lapDong(banMo.donViId, banMo.nam, banMo.ky)}
        keHoachKyTruoc={() => keHoachKyTruoc(banMo.donViId, banMo.nam, banMo.ky)}
        luu={luu}
        xoa={() => { xoa(banMo.id); setParams({}) }}
        quayLai={() => setParams({})}
      />
    )
  }

  const dvDangChon = scopeDonViId ?? donViChon ?? ''
  return (
    <Card>
      <Title level={4} style={{ marginTop: 0 }}>Đăng ký lao động tiền lương</Title>
      <Text type="secondary">Lập từ hồ sơ lương hiện hưởng của đơn vị; Thủ trưởng duyệt, Phòng Văn hóa - Xã hội thẩm định, Lãnh đạo Phòng phê duyệt.</Text>
      <Space wrap style={{ margin: '16px 0' }}>
        <InputNumber value={nam} onChange={(v) => setNam(v ?? md.nam)} min={2020} max={2100} style={{ width: 100 }} aria-label="Năm" />
        <Select value={ky} onChange={setKy} style={{ width: 180 }} options={(['H1', 'H2'] as KyDangKy[]).map((k) => ({ value: k, label: TEN_KY_DANG_KY[k] }))} />
        {!scopeDonViId && (
          <Select placeholder="Chọn đơn vị" style={{ width: 260 }} value={donViChon} onChange={setDonViChon} allowClear showSearch optionFilterProp="label"
            options={[...donVisPhamVi].sort(soSanhTruong).map((d) => ({ value: d.id, label: d.ten }))} />
        )}
        {(coLap || quyen.coThuTruong || quyen.coThamDinh || quyen.coPheDuyet) && (
          <Button type="primary" icon={<PlusOutlined />} onClick={lapHoacMo}>
            {dangKys.some((b) => b.id === idDangKy(dvDangChon, nam, ky)) ? 'Mở bản đăng ký' : 'Lập đăng ký'}
          </Button>
        )}
      </Space>
      <Table<DangKyLdtl>
        dataSource={danhSach}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="Chưa có bản đăng ký nào" /> }}
        onRow={(b) => ({ onClick: () => setParams({ id: b.id }), style: { cursor: 'pointer' } })}
        columns={[
          ...(scopeDonViId ? [] : [{ title: 'Đơn vị', key: 'dv', width: 230, render: (_: unknown, b: DangKyLdtl) => tenDonVi(b.donViId) }]),
          { title: 'Kỳ', key: 'ky', width: 190, render: (_, b) => `${TEN_KY_DANG_KY[b.ky]} ${b.nam}` },
          { title: 'Biên chế', key: 'bc', width: 90, align: 'center', render: (_, b) => b.dong.filter((x) => x.bienChe).length || '-' },
          { title: 'Hợp đồng', key: 'hd', width: 90, align: 'center', render: (_, b) => b.dong.filter((x) => !x.bienChe).length || '-' },
          { title: 'Tổng hệ số 6 tháng', key: 'tong', width: 150, align: 'right', render: (_, b) => <b>{d3(tongHeSoDangKy(tinhDangKy(b.dong))) || '0'}</b> },
          { title: 'Trạng thái', key: 'tt', width: 200, render: (_, b) => <Tag color={TRANG_THAI_DANG_KY[b.trangThai].mau}>{TRANG_THAI_DANG_KY[b.trangThai].ten}</Tag> },
          { title: 'Cập nhật', key: 'cn', width: 110, render: (_, b) => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(b.updatedAt)}</span> },
        ]}
      />
    </Card>
  )
}

// ───────────────────────────── Chi tiết một bản đăng ký ─────────────────────────────

function ChiTiet(p: {
  ban: DangKyLdtl
  tenDonVi: string
  thuTruong?: string
  chucDanhThuTruong: string
  truongPhong: string
  datTruongPhong?: (v: string) => void
  coLap: boolean
  coThuTruong: boolean
  coThamDinh: boolean
  coPheDuyet: boolean
  lapLai: () => DongDangKy[]
  keHoachKyTruoc: () => ChiTieuDangKy | undefined
  luu: (b: DangKyLdtl, hanhDong?: LichSuDangKy['hanhDong'], ghiChu?: string) => DangKyLdtl
  xoa: () => void
  quayLai: () => void
}) {
  const { message, modal } = App.useApp()
  const tenNguoi = useAuth().currentUser?.fullName
  const [ban, setBan] = useState<DangKyLdtl>(p.ban)
  const [daDoi, setDaDoi] = useState(false)
  useEffect(() => { setBan(p.ban); setDaDoi(false) }, [p.ban.updatedAt, p.ban.id])

  const suaDuoc = p.coLap && (ban.trangThai === 'NHAP' || ban.trangThai === 'TRA_LAI')
  const doi = (b: DangKyLdtl) => { setBan(b); setDaDoi(true) }
  const bt = bieuTongHop(ban)
  const tongHs = tongHeSoDangKy(bt.dk)
  const { tu, den } = khoangKyDangKy(ban.nam, ban.ky)

  // Hồ sơ lương đã đổi so với danh sách (nâng lương, người mới, chuyển đi...)
  const khacHoSo = useMemo(() => {
    if (!suaDuoc) return null
    const moi = p.lapLai()
    const coMoi = new Map(moi.map((x) => [x.vienChucId, x]))
    const coCu = new Set(ban.dong.map((x) => x.vienChucId))
    const them = moi.filter((x) => !coCu.has(x.vienChucId)).map((x) => x.hoTen)
    const doiHs = ban.dong.filter((x) => { const m = coMoi.get(x.vienChucId); return m && Math.abs(tongMotThang(m) - tongMotThang(x)) > 0.0005 }).map((x) => x.hoTen)
    return them.length || doiHs.length ? { them, doiHs } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ban.dong, suaDuoc, p.lapLai])

  const capNhatTuHoSo = () => {
    const ghiChu = new Map(ban.dong.map((x) => [x.vienChucId, x.ghiChu]))
    const moi = p.lapLai().map((x) => (ghiChu.get(x.vienChucId) && !x.ghiChu ? { ...x, ghiChu: ghiChu.get(x.vienChucId) } : x))
    doi({ ...ban, dong: moi })
    message.success(`Đã cập nhật từ hồ sơ: ${moi.length} người - bấm Lưu để giữ`)
  }
  const layKeHoach = () => {
    const kh = p.keHoachKyTruoc()
    if (!kh) { message.info('Kỳ trước chưa có bản đăng ký đã duyệt trên phần mềm - nhập kế hoạch được duyệt theo văn bản'); return }
    doi({ ...ban, keHoach: kh })
    message.success('Đã lấy kế hoạch được duyệt kỳ trước - bấm Lưu để giữ')
  }
  const ghi = (hanhDong?: LichSuDangKy['hanhDong'], patch: Partial<DangKyLdtl> = {}, ghiChu?: string) => {
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
  const TEN_BUOC: Record<LichSuDangKy['hanhDong'], string> = {
    LAP: 'Lập', TRINH: 'Trình Thủ trưởng', THU_TRUONG_DUYET: 'Thủ trưởng duyệt', THAM_DINH: 'Phòng VHXH thẩm định',
    DUYET: 'Lãnh đạo Phòng phê duyệt', TRA_LAI: 'Trả lại', MO_LAI: 'Mở lại',
  }
  const quaTrinh = (ban.lichSu ?? []).filter((l) => l.hanhDong !== 'LAP')
  const nutTraLai = (
    <Button danger icon={<RollbackOutlined />} onClick={() => nhapYKien('Trả lại cho đơn vị sửa', true, (y) => {
      ghi('TRA_LAI', { trangThai: 'TRA_LAI', yKienDuyet: `${tenNguoi ?? ''}: ${y}` }, y)
      message.success('Đã trả lại')
    })}>Trả lại</Button>
  )
  const xuat = () => xuatExcelDangKy(ban, { tenDonVi: p.tenDonVi, thuTruong: p.thuTruong, chucDanhThuTruong: p.chucDanhThuTruong, truongPhong: p.truongPhong })

  // ── Biểu tổng hợp ──
  const datChiTieu = (truong: 'keHoach' | 'thucHien', k: KhoaChiTieu, v: number | null) => {
    const ct = { ...ban[truong] }
    if (v == null) delete ct[k]; else ct[k] = v
    doi({ ...ban, [truong]: ct })
  }
  const nhapDuoc = (d: DongTongHop) => !!d.k && !d.dam && d.ten !== 'Hợp đồng khác'
  const hienSo = (d: DongTongHop, n: number) => (d.laTien || d.laNguoi ? soNguyen(n) : d3(n))
  const oNhap = (d: DongTongHop & { keHoach: number; thucHien: number }, truong: 'keHoach' | 'thucHien') => {
    const v = ban[truong][d.k!]
    return (
      <InputNumber size="small" style={{ width: '100%' }} min={0} value={v ?? null} controls={false}
        placeholder={truong === 'thucHien' ? hienSo(d, d.thucHien) || '0' : undefined}
        step={d.laNguoi ? 1 : d.laTien ? 1000 : 0.001} precision={d.laNguoi || d.laTien ? 0 : 3}
        formatter={(x) => (x === undefined || String(x) === '' ? '' : Number(x).toLocaleString('vi-VN', { maximumFractionDigits: 3 }))}
        parser={(x) => Number((x ?? '').replace(/\./g, '').replace(',', '.')) as unknown as number}
        onChange={(x) => datChiTieu(truong, d.k!, x == null ? null : Number(x))} />
    )
  }
  type DongBt = (typeof bt.dong)[number]
  const cotTongHop = [
    { title: 'STT', dataIndex: 'ma', width: 56, align: 'center' as const },
    { title: 'Nội dung', key: 'ten', render: (_: unknown, d: DongBt) => (d.dam ? <b>{d.ten}</b> : d.ten) },
    {
      title: 'Đăng ký kỳ trước',
      children: [
        { title: <Tooltip title="Kế hoạch được duyệt kỳ trước (theo văn bản xác nhận)">Kế hoạch được duyệt</Tooltip>, key: 'kh', width: 140, align: 'right' as const, render: (_: unknown, d: DongBt) => (suaDuoc && nhapDuoc(d) ? oNhap(d, 'keHoach') : hienSo(d, d.keHoach)) },
        { title: 'Tăng trong kỳ', key: 'tang', width: 110, align: 'right' as const, render: (_: unknown, d: DongBt) => hienSo(d, d.tang) },
        { title: 'Giảm trong kỳ', key: 'giam', width: 110, align: 'right' as const, render: (_: unknown, d: DongBt) => hienSo(d, d.giam) },
        { title: <Tooltip title="Bỏ trống: bằng số đăng ký kỳ này">Thực hiện</Tooltip>, key: 'th', width: 140, align: 'right' as const, render: (_: unknown, d: DongBt) => (suaDuoc && nhapDuoc(d) ? oNhap(d, 'thucHien') : hienSo(d, d.thucHien)) },
      ],
    },
    { title: 'Đăng ký 6 tháng', key: 'dk', width: 130, align: 'right' as const, onCell: () => ({ style: { background: '#eef4fd' } }), render: (_: unknown, d: DongBt) => <b>{hienSo(d, d.dangKy)}</b> },
  ]

  // ── Danh sách ──
  const suaDong = (i: number, patch: Partial<DongDangKy>) => doi({ ...ban, dong: ban.dong.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const boDong = (i: number) => doi({ ...ban, dong: ban.dong.filter((_, j) => j !== i) })
  const coCongVu = ban.dong.some((x) => x.pcCongVu)
  const coNhaGiao = ban.dong.some((x) => x.tnnHs || x.udHs)
  const cotDanhSach = [
    { title: 'TT', key: 'tt', width: 42, align: 'center' as const, fixed: 'left' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
    {
      title: 'Họ và tên', key: 'ht', width: 190, fixed: 'left' as const,
      render: (_: unknown, x: DongDangKy) => <Space size={4} wrap><span>{x.hoTen}</span>{!x.bienChe && <Tag style={{ marginInlineEnd: 0 }}>HĐ</Tag>}</Space>,
    },
    { title: 'Chức vụ', dataIndex: 'chucVu', width: 130 },
    { title: 'Mã CDNN', dataIndex: 'maCdnn', width: 96, align: 'center' as const },
    { title: 'Bậc', key: 'bac', width: 46, align: 'center' as const, render: (_: unknown, x: DongDangKy) => x.bac ?? '' },
    { title: 'Hệ số', key: 'hs', width: 60, align: 'right' as const, render: (_: unknown, x: DongDangKy) => (x.heSo ? x.heSo.toFixed(2) : '') },
    { title: 'TNVK', key: 'vk', width: 86, align: 'right' as const, render: (_: unknown, x: DongDangKy) => (x.vkPct ? <span>{x.vkPct}% <Text type="secondary">({d3(x.vkHs)})</Text></span> : '') },
    { title: 'Bảo lưu', key: 'bl', width: 62, align: 'right' as const, render: (_: unknown, x: DongDangKy) => d3(x.baoLuu) },
    { title: 'Tổng HS lương chính', key: 'lc', width: 82, align: 'right' as const, render: (_: unknown, x: DongDangKy) => d3(tongLuongChinh(x)) },
    { title: 'Mốc nâng bậc / TNVK', dataIndex: 'thoiDiem', width: 96, align: 'center' as const },
    { title: 'PCCV', key: 'cv', width: 56, align: 'right' as const, render: (_: unknown, x: DongDangKy) => d3(x.pcChucVu) },
    { title: 'PC trách nhiệm', key: 'tn', width: 70, align: 'right' as const, render: (_: unknown, x: DongDangKy) => d3(x.pcTrachNhiem) },
    ...(coNhaGiao ? [
      { title: 'PC thâm niên', key: 'tnn', width: 92, align: 'right' as const, render: (_: unknown, x: DongDangKy) => (x.tnnPct ? <span>{x.tnnPct}% <Text type="secondary">({d3(x.tnnHs)})</Text></span> : '') },
      { title: 'Mốc PCTN', dataIndex: 'mocTnn', width: 96, align: 'center' as const },
      { title: 'PC ưu đãi', key: 'ud', width: 64, align: 'right' as const, render: (_: unknown, x: DongDangKy) => d3(x.udHs) },
    ] : []),
    ...(coCongVu ? [{ title: 'PC công vụ', key: 'cvu', width: 64, align: 'right' as const, render: (_: unknown, x: DongDangKy) => d3(x.pcCongVu) }] : []),
    { title: 'Tổng HS 1 tháng', key: 't1', width: 80, align: 'right' as const, render: (_: unknown, x: DongDangKy) => <b>{d3(tongMotThang(x))}</b> },
    { title: 'Tổng HS 6 tháng', key: 't6', width: 86, align: 'right' as const, onCell: () => ({ style: { background: '#eef4fd' } }), render: (_: unknown, x: DongDangKy) => <b>{d3(tongMotThang(x) * 6)}</b> },
    {
      title: 'Ghi chú', key: 'gc', width: 180,
      render: (_: unknown, x: DongDangKy, i: number) => (suaDuoc ? <Input size="small" value={x.ghiChu} onChange={(e) => suaDong(i, { ghiChu: e.target.value })} /> : x.ghiChu),
    },
    ...(suaDuoc ? [{
      title: '', key: 'xoa', width: 40, align: 'center' as const,
      render: (_: unknown, x: DongDangKy, i: number) => (
        <Popconfirm title={`Bỏ ${x.hoTen} khỏi danh sách?`} okText="Bỏ" cancelText="Huỷ" onConfirm={() => boDong(i)}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Bỏ khỏi danh sách" />
        </Popconfirm>
      ),
    }] : []),
  ]

  const tt = TRANG_THAI_DANG_KY[ban.trangThai]
  return (
    <Card>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => {
          if (!daDoi) { p.quayLai(); return }
          modal.confirm({ title: 'Chưa lưu thay đổi', content: 'Thoát mà không lưu?', okText: 'Thoát', cancelText: 'Ở lại', onOk: p.quayLai })
        }}>Danh sách</Button>
        <Title level={4} style={{ margin: 0 }}>Đăng ký LĐTL {TEN_KY_DANG_KY[ban.ky]} {ban.nam} - {p.tenDonVi}</Title>
        <Tag color={tt.mau}>{tt.ten}</Tag>
      </Space>

      {khacHoSo && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Hồ sơ lương đã thay đổi so với danh sách"
          description={<>
            {khacHoSo.them.length > 0 && <div>Chưa có trong danh sách: {khacHoSo.them.join(', ')}</div>}
            {khacHoSo.doiHs.length > 0 && <div>Hệ số đã đổi: {khacHoSo.doiHs.join(', ')}</div>}
            <div style={{ marginTop: 4 }}>Bấm <b>Cập nhật từ hồ sơ</b> để lấy lại.</div>
          </>} />
      )}
      {ban.trangThai === 'TRA_LAI' && ban.yKienDuyet && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} title="Bị trả lại để sửa" description={ban.yKienDuyet} />
      )}

      <Descriptions size="small" bordered column={{ xs: 1, lg: 2, xxl: 3 }} style={{ marginBottom: 12 }} labelStyle={{ whiteSpace: 'nowrap' }}>
        <Descriptions.Item label="Thời gian"><span style={{ whiteSpace: 'nowrap' }}>{formatDate(tu)} - {formatDate(den)}</span></Descriptions.Item>
        <Descriptions.Item label="Lao động">{bt.dk.bienChe} biên chế{bt.dk.hdSoNguoi ? `, ${bt.dk.hdSoNguoi} hợp đồng` : ''}</Descriptions.Item>
        <Descriptions.Item label="Tổng hệ số 6 tháng"><b>{d3(tongHs) || '0'}</b>{bt.dk.hdTien ? <Text type="secondary"> · tiền mặt {soNguyen(bt.dk.hdTien)} đ</Text> : null}</Descriptions.Item>
        <Descriptions.Item label="Người lập">{ban.nguoiLap ?? '-'}</Descriptions.Item>
        <Descriptions.Item label={`${p.chucDanhThuTruong.charAt(0)}${p.chucDanhThuTruong.slice(1).toLocaleLowerCase('vi')} ký`}>
          {p.thuTruong ?? <Text type="warning">Chưa xác định - khai chức vụ ở hồ sơ</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="Trưởng phòng VHXH ký">
          {p.datTruongPhong
            ? <Input size="small" style={{ width: 200 }} defaultValue={p.truongPhong} onBlur={(e) => { const v = vietHoaDauTu(e.target.value); if (v && v !== p.truongPhong) { p.datTruongPhong!(v); message.success('Đã lưu tên Trưởng phòng ký') } }} />
            : p.truongPhong || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Quá trình xử lý" span="filled">
          {quaTrinh.length
            ? <Space direction="vertical" size={0}>{quaTrinh.map((l, i) => (
              <span key={i}><Text type="secondary">{formatDatetime(l.luc)}</Text> · <b>{TEN_BUOC[l.hanhDong]}</b> · {l.nguoi}{l.ghiChu ? <Text type="secondary"> - {l.ghiChu}</Text> : null}</span>
            ))}</Space>
            : '-'}
        </Descriptions.Item>
      </Descriptions>

      <Space wrap style={{ marginBottom: 12 }}>
        {suaDuoc && <Button icon={<SyncOutlined />} onClick={capNhatTuHoSo}>Cập nhật từ hồ sơ</Button>}
        {suaDuoc && <Button icon={<HistoryOutlined />} onClick={layKeHoach}>Lấy kế hoạch kỳ trước</Button>}
        {suaDuoc && <Button icon={<SaveOutlined />} disabled={!daDoi} onClick={() => { ghi('LAP'); message.success('Đã lưu') }}>Lưu</Button>}
        {p.coLap && (ban.trangThai === 'NHAP' || ban.trangThai === 'TRA_LAI') && (
          <Popconfirm title="Trình Thủ trưởng đơn vị duyệt?" description={`${bt.dk.bienChe} biên chế, ${bt.dk.hdSoNguoi} hợp đồng - tổng hệ số ${d3(tongHs) || 0}`} okText="Trình" cancelText="Huỷ"
            onConfirm={() => { ghi('TRINH', { trangThai: 'CHO_THU_TRUONG', ngayTrinh: new Date().toISOString(), yKienDuyet: undefined }); message.success('Đã trình Thủ trưởng đơn vị') }}>
            <Button type="primary" icon={<SendOutlined />} disabled={!ban.dong.length}>Trình Thủ trưởng duyệt</Button>
          </Popconfirm>
        )}
        {p.coThuTruong && ban.trangThai === 'CHO_THU_TRUONG' && <>
          <Button type="primary" icon={<CheckOutlined />} onClick={() => nhapYKien('Duyệt, chuyển Phòng Văn hóa - Xã hội thẩm định', false, (y) => {
            ghi('THU_TRUONG_DUYET', { trangThai: 'CHO_THAM_DINH', ngayThuTruongDuyet: new Date().toISOString(), nguoiThuTruongDuyet: tenNguoi }, y)
            message.success('Đã duyệt, chuyển Phòng VHXH')
          })}>Duyệt - chuyển VH-XH</Button>
          {nutTraLai}
        </>}
        {p.coThamDinh && ban.trangThai === 'CHO_THAM_DINH' && <>
          <Button type="primary" icon={<CheckOutlined />} onClick={() => nhapYKien('Thẩm định: đồng ý, trình Lãnh đạo Phòng phê duyệt', false, (y) => {
            ghi('THAM_DINH', { trangThai: 'CHO_PHE_DUYET', ngayThamDinh: new Date().toISOString(), nguoiThamDinh: tenNguoi, yKienThamDinh: y || undefined }, y)
            message.success('Đã trình Lãnh đạo Phòng phê duyệt')
          })}>Đồng ý - trình Lãnh đạo Phòng</Button>
          {nutTraLai}
        </>}
        {p.coPheDuyet && ban.trangThai === 'CHO_PHE_DUYET' && <>
          <Button type="primary" icon={<CheckOutlined />} onClick={() => nhapYKien('Phê duyệt đăng ký lao động tiền lương', false, (y) => {
            ghi('DUYET', { trangThai: 'DA_DUYET', ngayDuyet: new Date().toISOString(), nguoiDuyet: p.truongPhong || tenNguoi, yKienDuyet: y || undefined }, y)
            message.success('Đã phê duyệt')
          })}>Phê duyệt</Button>
          {nutTraLai}
        </>}
        {p.coPheDuyet && ban.trangThai === 'DA_DUYET' && (
          <Popconfirm title="Mở lại để đơn vị sửa?" okText="Mở lại" cancelText="Huỷ" onConfirm={() => ghi('MO_LAI', { trangThai: 'TRA_LAI', ngayDuyet: undefined, yKienDuyet: 'Mở lại để sửa' })}>
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
        className="tabs-xuong-dong"
        items={[
          {
            key: 'th',
            label: 'Biểu tổng hợp',
            children: (
              <>
                <Table<DongBt> dataSource={bt.dong} rowKey={(d) => `${d.ma}-${d.ten}`} size="small" bordered pagination={false}
                  columns={cotTongHop as never} scroll={{ x: 'max-content' }} />
                <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
                  Hệ số tính cho cả 6 tháng. Tổng tiền lương: hệ số <b>{d3(tongHs) || '0'}</b> ({docHeSo(tongHs)}).
                  {suaDuoc && ' Nhập kế hoạch được duyệt kỳ trước theo văn bản đã xác nhận; ô Thực hiện bỏ trống thì lấy bằng số đăng ký.'}
                </Text>
              </>
            ),
          },
          {
            key: 'ds',
            label: `Danh sách hệ số lương (${ban.dong.length})`,
            children: (
              <Table<DongDangKy> dataSource={ban.dong} rowKey="vienChucId" size="small" bordered pagination={false}
                columns={cotDanhSach as never} scroll={{ x: 'max-content' }}
                summary={() => (ban.dong.length ? (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#eef4fd', fontWeight: 700 }}>
                      <Table.Summary.Cell index={0} colSpan={2}>Cộng ({ban.dong.length} người)</Table.Summary.Cell>
                      <Table.Summary.Cell index={2} colSpan={cotDanhSach.length - (suaDuoc ? 6 : 5)} />
                      <Table.Summary.Cell index={3} align="right">{d3(ban.dong.reduce((s, x) => s + tongMotThang(x), 0))}</Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right">{d3(ban.dong.reduce((s, x) => s + tongMotThang(x), 0) * 6)}</Table.Summary.Cell>
                      <Table.Summary.Cell index={5} colSpan={suaDuoc ? 2 : 1} />
                    </Table.Summary.Row>
                  </Table.Summary>
                ) : null)}
              />
            ),
          },
        ]}
      />
    </Card>
  )
}
