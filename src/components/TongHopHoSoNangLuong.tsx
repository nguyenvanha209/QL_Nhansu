import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Segmented, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileExcelOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import type { ChiTietDeXuat, DeXuatLuong, LoaiDeXuat, TrangThaiDeXuat } from '@/types/deXuat'
import { LOAI_DE_XUAT_LABELS, TRANG_THAI_COLORS, TRANG_THAI_LABELS, laDongVuotKhung } from '@/types/deXuat'
import { BANG_CHUAN, cotGiua, cotNgay, cotSTT, phanTrang } from '@/utils/cotBang'
import { formatDate } from '@/utils/helpers'
import { ngayDu5Nam } from '@/utils/pctnLanDau'
import { xuatExcelA4, trangTuDanhSach } from '@/utils/excelA4'
import { soSanhTruong } from '@/utils/dinhMuc'

const { Text } = Typography

/** Nhóm bước xử lý để tổng hợp */
type Buoc = 'NHAP' | 'CHO_HT' | 'CHO_VHXH' | 'CHO_LD' | 'DA_DUYET' | 'TRA_LAI'
const BUOC: { key: Buoc; ten: string; trangThai: TrangThaiDeXuat[] }[] = [
  { key: 'NHAP', ten: 'Trường đang lập', trangThai: ['NHAP'] },
  { key: 'CHO_HT', ten: 'Chờ Hiệu trưởng', trangThai: ['CHO_HIEU_TRUONG_DUYET'] },
  { key: 'CHO_VHXH', ten: 'Chờ VHXH thẩm định', trangThai: ['CHO_XET_DUYET'] },
  { key: 'CHO_LD', ten: 'Chờ Lãnh đạo phê duyệt', trangThai: ['CHO_PHE_DUYET'] },
  { key: 'DA_DUYET', ten: 'Đã phê duyệt', trangThai: ['DA_PHE_DUYET'] },
  { key: 'TRA_LAI', ten: 'Bổ sung / từ chối', trangThai: ['YEU_CAU_BO_SUNG', 'TU_CHOI'] },
]
const buocCua = (t: TrangThaiDeXuat): Buoc => BUOC.find((b) => b.trangThai.includes(t))?.key ?? 'NHAP'

/** Năm của phiếu: năm xét (trước thời hạn) hoặc năm lập / trình */
export const namCuaPhieu = (d: DeXuatLuong) => d.namXet ?? Number((d.ngayDeXuat || d.createdAt || '').slice(0, 4))

/** Nội dung đề nghị ngắn gọn của một người theo loại phiếu */
function noiDung(loai: LoaiDeXuat, c: ChiTietDeXuat): string {
  const hs = (n: number) => Number(n).toFixed(2).replace('.', ',')
  if (loai === 'PHU_CAP_THAM_NIEN') return `PCTN ${c.pctnCu ?? 0}% → ${c.pctnMoi ?? 0}%`
  if (loai === 'PCTN_LAN_DAU') {
    const du = c.lanDau ? ngayDu5Nam(c.lanDau) : undefined
    return `Xếp PCTN ${c.pctnMoi ?? 0}%${du ? ` (đủ 5 năm ${formatDate(du)})` : ''}`
  }
  if (laDongVuotKhung(c)) return `Bậc cuối ${c.bacCu} - PC TNVK ${c.tnvkCu ?? 0}% → ${c.tnvkMoi ?? 0}%`
  const goc = `Bậc ${c.bacCu} (${hs(c.heSoCu)}) → Bậc ${c.bacMoi} (${hs(c.heSoMoi)})`
  if (loai === 'NANG_TRUOC_HAN') return `${goc}, trước ${c.soThangTruocHan ?? '?'} tháng${c.thanhTich?.hinhThuc ? ` - ${c.thanhTich.hinhThuc}` : ''}`
  return goc
}

interface DongNguoi { key: string; dx: DeXuatLuong; ct: ChiTietDeXuat; ten: string; truong: string }

/**
 * Tổng hợp cho Phòng VHXH, Lãnh đạo, quản trị: số phiếu, số người của từng trường theo bước xử lý và danh sách
 * người gộp mọi trường (xuất Excel) - dùng chung 4 loại hồ sơ nâng lương - phụ cấp thâm niên.
 * `nam` truyền vào khi trang đã có ô chọn năm (nâng lương trước thời hạn).
 */
export default function TongHopHoSoNangLuong({ loai, nam: namNgoai, anBangTruong }: { loai: LoaiDeXuat; nam?: number; anBangTruong?: boolean }) {
  const navigate = useNavigate()
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const donVis = useDanhMucStore((s) => s.donVis)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const [namTrong, setNamTrong] = useState(dayjs().year())
  const nam = namNgoai ?? namTrong
  const [buoc, setBuoc] = useState<Buoc | 'DA_TRINH'>('CHO_VHXH')
  const [truong, setTruong] = useState<string | undefined>()

  const truongs = useMemo(() => donVis.filter((d) => d.active && d.loai !== 'OTHER').sort(soSanhTruong), [donVis])
  const thuTuTruong = useMemo(() => new Map(truongs.map((t, i) => [t.id, i])), [truongs])
  const tenTruong = (id: string) => donVis.find((d) => d.id === id)?.ten ?? id
  const phieu = useMemo(() => deXuats.filter((d) => d.loai === loai && namCuaPhieu(d) === nam), [deXuats, loai, nam])
  const duPhieu = (bs: Buoc[]) => phieu.filter((d) => bs.includes(buocCua(d.trangThai)))

  // Bảng theo trường: mỗi ô "số phiếu / số người"
  const dongTruong = useMemo(() => truongs.map((t) => {
    const ds = phieu.filter((d) => d.donViId === t.id)
    const o = Object.fromEntries(BUOC.map((b) => {
      const p = ds.filter((d) => buocCua(d.trangThai) === b.key)
      return [b.key, { phieu: p.length, nguoi: p.reduce((s, d) => s + d.chiTiet.length, 0) }]
    })) as Record<Buoc, { phieu: number; nguoi: number }>
    return { id: t.id, ten: t.ten, o, co: ds.length > 0 }
  }), [truongs, phieu])

  const vcTheoId = useMemo(() => new Map(vienChucs.map((v) => [v.id, v])), [vienChucs])
  const nguoi = useMemo<DongNguoi[]>(() => {
    const bs: Buoc[] = buoc === 'DA_TRINH' ? ['CHO_HT', 'CHO_VHXH', 'CHO_LD', 'DA_DUYET'] : [buoc]
    return duPhieu(bs)
      .filter((d) => !truong || d.donViId === truong)
      .sort((a, b) => (thuTuTruong.get(a.donViId) ?? 999) - (thuTuTruong.get(b.donViId) ?? 999))
      .flatMap((dx) => dx.chiTiet.map((ct) => {
        const vc = vcTheoId.get(ct.vienChucId)
        return { key: `${dx.id}_${ct.vienChucId}`, dx, ct, ten: vc ? `${vc.ho} ${vc.ten}` : ct.vienChucId, truong: tenTruong(dx.donViId) }
      }))
  }, [phieu, buoc, truong, vcTheoId, thuTuTruong])

  const tenThamDinh = (r: DongNguoi) => (r.ct.thamDinh === 'KHONG_DONG_Y' ? 'Không đồng ý' : r.ct.thamDinh === 'DONG_Y' ? 'Đồng ý'
    : loai === 'NANG_TRUOC_HAN' || ['NHAP', 'CHO_HIEU_TRUONG_DUYET', 'CHO_XET_DUYET'].includes(r.dx.trangThai) ? 'Chưa thẩm định' : 'Đồng ý')
  const tenBuoc = buoc === 'DA_TRINH' ? 'Tất cả đã trình' : BUOC.find((b) => b.key === buoc)?.ten ?? ''
  const duongDan = (d: DeXuatLuong) => (d.loai === 'NANG_TRUOC_HAN' ? `/nang-truoc-han/${d.id}` : `/de-xuat/${d.id}`)

  const xuat = () => xuatExcelA4(`Tong-hop-${LOAI_DE_XUAT_LABELS[loai].replace(/\s+/g, '-')}-${nam}`, [trangTuDanhSach(
    nguoi.map((r, i) => ({
      STT: i + 1, 'Trường': r.truong, 'Họ và tên': r.ten, 'Nội dung đề nghị': noiDung(loai, r.ct),
      'Mốc hưởng': formatDate(r.ct.ngayHieuLuc), 'Phiếu': r.dx.ma, 'Trạng thái phiếu': TRANG_THAI_LABELS[r.dx.trangThai],
      'VHXH thẩm định': tenThamDinh(r), 'Ý kiến': r.ct.yKienThamDinh ?? '',
    })),
    'Tổng hợp',
    { tieuDe: [`TỔNG HỢP ${LOAI_DE_XUAT_LABELS[loai].toUpperCase()} NĂM ${nam}`, `(${tenBuoc}${truong ? ` - ${tenTruong(truong)}` : ' - các trường'}; ${nguoi.length} người)`] },
  )])

  const o = (b: Buoc, r: (typeof dongTruong)[number]) => {
    const v = r.o[b]
    if (!v.phieu) return <Text type="secondary">-</Text>
    const noiBat = b === 'CHO_VHXH' || b === 'CHO_LD'
    return (
      <a onClick={() => { setBuoc(b === 'NHAP' || b === 'TRA_LAI' ? 'DA_TRINH' : b); setTruong(r.id) }}>
        <Text strong={noiBat} type={b === 'CHO_VHXH' ? 'danger' : undefined}>{v.nguoi}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}> ({v.phieu} phiếu)</Text>
      </a>
    )
  }
  const colsTruong: ColumnsType<(typeof dongTruong)[number]> = [
    cotSTT(),
    { title: 'Trường', key: 'ten', width: 200, render: (_, r) => r.ten },
    ...BUOC.map((b) => cotGiua<(typeof dongTruong)[number]>(b.ten, b.key, 120, (r) => o(b.key, r))),
  ]
  const tong = (b: Buoc) => dongTruong.reduce((s, r) => s + r.o[b].nguoi, 0)

  const colsNguoi: ColumnsType<DongNguoi> = [
    cotSTT<DongNguoi>(),
    { title: 'Họ và tên', key: 'ten', width: 190, fixed: 'left', render: (_, r) => r.ten },
    { title: 'Trường', key: 'tr', width: 180, render: (_, r) => r.truong },
    { title: 'Nội dung đề nghị', key: 'nd', width: 320, render: (_, r) => noiDung(loai, r.ct) },
    cotNgay<DongNguoi>('Mốc hưởng', (r) => r.ct.ngayHieuLuc),
    {
      title: 'Phiếu', key: 'ph', width: 220,
      render: (_, r) => <Space size={4} wrap><a onClick={() => navigate(duongDan(r.dx))}>{r.dx.ma}</a><Tag color={TRANG_THAI_COLORS[r.dx.trangThai]} style={{ marginInlineEnd: 0 }}>{TRANG_THAI_LABELS[r.dx.trangThai]}</Tag></Space>,
    },
    cotGiua<DongNguoi>('VHXH thẩm định', 'td', 130, (r) => {
      const t = tenThamDinh(r)
      return <Tag color={t === 'Không đồng ý' ? 'error' : t === 'Đồng ý' ? 'success' : 'default'} style={{ marginInlineEnd: 0 }}>{t}</Tag>
    }),
  ]

  return (
    <Card size="small" style={{ marginBottom: 16, background: '#f8fafc' }}
      title={<Space wrap><span>Tổng hợp các trường - {LOAI_DE_XUAT_LABELS[loai].toLowerCase()}</span>
        {namNgoai === undefined && <Select size="small" value={nam} onChange={setNamTrong} style={{ width: 90 }} options={[-2, -1, 0, 1].map((x) => dayjs().year() + x).map((n) => ({ value: n, label: n }))} />}
        <Tag color="red" style={{ marginInlineEnd: 0 }}>Chờ VHXH thẩm định: {tong('CHO_VHXH')} người</Tag>
        <Tag color="purple" style={{ marginInlineEnd: 0 }}>Chờ Lãnh đạo: {tong('CHO_LD')} người</Tag>
        <Tag color="green" style={{ marginInlineEnd: 0 }}>Đã phê duyệt: {tong('DA_DUYET')} người</Tag>
      </Space>}
    >
      {!anBangTruong && (
        <Table {...BANG_CHUAN} rowKey="id" dataSource={dongTruong} columns={colsTruong} pagination={false} style={{ marginBottom: 12 }} />
      )}
      <Space wrap style={{ marginBottom: 8 }}>
        <Text strong>Danh sách người:</Text>
        <Segmented<Buoc | 'DA_TRINH'>
          value={buoc} onChange={setBuoc}
          options={[
            { value: 'CHO_VHXH', label: 'Chờ VHXH thẩm định' },
            { value: 'CHO_LD', label: 'Chờ Lãnh đạo' },
            { value: 'DA_DUYET', label: 'Đã phê duyệt' },
            { value: 'DA_TRINH', label: 'Tất cả đã trình' },
          ]}
        />
        <Select size="small" allowClear placeholder="Tất cả các trường" style={{ width: 220 }} value={truong} onChange={setTruong}
          showSearch optionFilterProp="label" options={truongs.map((t) => ({ value: t.id, label: t.ten }))} />
        <Button size="small" icon={<FileExcelOutlined />} disabled={!nguoi.length} onClick={xuat}>Xuất Excel</Button>
      </Space>
      <Table<DongNguoi> {...BANG_CHUAN} rowKey="key" dataSource={nguoi} columns={colsNguoi} pagination={phanTrang('người')}
        locale={{ emptyText: `Không có người ở bước "${tenBuoc}" năm ${nam}` }} />
      <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12.5 }}>
        Bấm mã phiếu để mở và thẩm định / phê duyệt. Quy trình chung: Kế toán lập → Hiệu trưởng duyệt → Phòng VHXH thẩm định từng người → Lãnh đạo phê duyệt (ghi hồ sơ) →
        Phòng VHXH lập thông báo ở trang Thông báo kết quả nâng lương, phụ cấp thâm niên. Người VHXH không đồng ý không ghi hồ sơ, không vào thông báo.
      </Text>
    </Card>
  )
}
