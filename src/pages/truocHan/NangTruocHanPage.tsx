import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, App, Button, Card, Input, InputNumber, Select, Space, Switch, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import { useAuth } from '@/hooks/useAuth'
import { useDeXuatCanXuLy } from '@/hooks/useDeXuatCanXuLy'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { TRANG_THAI_COLORS, TRANG_THAI_LABELS } from '@/types/deXuat'
import type { DeXuatLuong, LoaiDeXuat, MucNangTruocHan } from '@/types/deXuat'
import { formatDate } from '@/utils/helpers'
import { BANG_CHUAN, cotSTT, cotChu, cotGiua } from '@/utils/cotBang'
import { danhSachTraLuong, soSuatToiDa } from '@/utils/nangTruocHan'
import { logAction } from '@/utils/auditLogger'
import NutXoaPhieuNhap from '@/components/NutXoaPhieuNhap'

const { Title, Text } = Typography

export const TEN_CHUC_NANG_TRUOC_HAN = 'Nâng lương trước thời hạn'
const LOAI_TRUOC_HAN: LoaiDeXuat[] = ['NANG_TRUOC_HAN']

/** Danh sách hồ sơ nâng bậc lương trước thời hạn theo năm (mỗi trường một hồ sơ / năm) */
export default function NangTruocHanPage({ nhung }: { nhung?: boolean } = {}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { scopeDonViId, hasPermission, laQuanTri, isVHXH } = useAuth()
  const soCho = useDeXuatCanXuLy(LOAI_TRUOC_HAN)
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const donVis = useDanhMucStore((s) => s.donVis)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const [nam, setNam] = useState(dayjs().year())
  const [the, setThe] = useState(params.get('tab') === 'muc' ? 'muc' : 'ho-so')

  const truongs = useMemo(() => donVis.filter((d) => d.active && d.loai !== 'OTHER' && (!scopeDonViId || d.id === scopeDonViId)), [donVis, scopeDonViId])
  const hoSoNam = useMemo(() => deXuats.filter((d) => d.loai === 'NANG_TRUOC_HAN' && (d.namXet ?? Number(d.ngayDeXuat?.slice(0, 4))) === nam && (!scopeDonViId || d.donViId === scopeDonViId)), [deXuats, nam, scopeDonViId])

  // Mỗi trường một dòng: hồ sơ (nếu có), số người đề nghị, tỷ lệ
  type Dong = { key: string; ten: string; dx?: DeXuatLuong; soTraLuong: number; toiDa: number }
  const dongs = useMemo<Dong[]>(() => truongs.map((t) => {
    const n = danhSachTraLuong(vienChucs, heSoLuongs, t.id).length
    const dx = hoSoNam.filter((d) => d.donViId === t.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    return { key: t.id, ten: t.ten, dx, soTraLuong: n, toiDa: soSuatToiDa(n) }
  }), [truongs, hoSoNam, vienChucs, heSoLuongs])

  const coLap = hasPermission('deXuat', 'write') && !!scopeDonViId
  const columns: ColumnsType<Dong> = [
    cotSTT<Dong>(),
    cotChu<Dong>('Trường', (r) => r.ten, 200),
    cotGiua<Dong>('Danh sách trả lương', 'tl', 110, (r) => r.soTraLuong),
    cotGiua<Dong>('Tối đa (10%)', 'td', 95, (r) => r.toiDa),
    cotGiua<Dong>('Đề nghị', 'dn', 80, (r) => (r.dx ? <Text strong type={r.dx.chiTiet.length > r.toiDa ? 'danger' : undefined}>{r.dx.chiTiet.length}</Text> : '-')),
    cotGiua<Dong>('VHXH đồng ý', 'dy', 95, (r) => (r.dx ? r.dx.chiTiet.filter((c) => c.thamDinh === 'DONG_Y').length || '-' : '-')),
    cotGiua<Dong>('Trạng thái', 'tt', 170, (r) => (r.dx ? <Tag color={TRANG_THAI_COLORS[r.dx.trangThai]} style={{ marginInlineEnd: 0 }}>{TRANG_THAI_LABELS[r.dx.trangThai]}</Tag> : <Tag style={{ marginInlineEnd: 0 }}>Chưa lập</Tag>)),
    cotGiua<Dong>('Ngày trình', 'nt', 100, (r) => (r.dx && r.dx.trangThai !== 'NHAP' ? formatDate(r.dx.ngayDeXuat) : '')),
    {
      title: '', key: 'mo', width: 150, align: 'center',
      render: (_, r) => (r.dx
        ? <Space size={4}><Button size="small" onClick={() => navigate(`/nang-truoc-han/${r.dx!.id}`)}>Xem hồ sơ</Button><NutXoaPhieuNhap dx={r.dx} nho /></Space>
        : coLap ? <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/nang-truoc-han/new?nam=${nam}`)}>Lập hồ sơ</Button> : null),
    },
  ]

  const hoSo = (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Text>Năm xét:</Text>
        <Select value={nam} onChange={setNam} style={{ width: 110 }} options={[-2, -1, 0, 1].map((x) => dayjs().year() + x).map((n) => ({ value: n, label: n }))} />
        {soCho > 0 && <Tag color="red">{soCho} hồ sơ chờ bạn xử lý</Tag>}
      </Space>
      <Table<Dong> {...BANG_CHUAN} rowKey="key" dataSource={dongs} columns={columns} pagination={false} />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
        Quy trình: Kế toán lập hồ sơ (tờ trình, biên bản Hội đồng trường, minh chứng từng người) → Hiệu trưởng trình → Phòng VHXH thẩm định từng người
        → Lãnh đạo phường phê duyệt (hồ sơ lương tự cập nhật) → Phòng VHXH lập thông báo ở trang Thông báo kết quả nâng lương.
      </Text>
    </>
  )

  const noiDung = (
    <>
      {!nhung && <Title level={4} style={{ marginBottom: 0 }}>{TEN_CHUC_NANG_TRUOC_HAN}</Title>}
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Nâng bậc lương trước thời hạn do lập thành tích xuất sắc trong thực hiện nhiệm vụ - Thông tư 08/2013/TT-BNV, sửa đổi bởi Thông tư 03/2021/TT-BNV.
      </Text>
      <Tabs
        activeKey={the}
        onChange={setThe}
        size={nhung ? 'small' : undefined}
        items={[
          { key: 'ho-so', label: 'Hồ sơ các trường', children: hoSo },
          { key: 'muc', label: 'Mức nâng theo thành tích', children: <BangMuc suaDuoc={laQuanTri || isVHXH} /> },
        ]}
      />
    </>
  )
  return nhung ? noiDung : <Card>{noiDung}</Card>
}

/** Bảng gợi ý hình thức khen → số tháng nâng trước (Phòng VHXH khai; trường sửa theo Quy chế khi lập hồ sơ) */
function BangMuc({ suaDuoc }: { suaDuoc: boolean }) {
  const { message } = App.useApp()
  const { currentUser } = useAuth()
  const mucs = useDanhMucStore((s) => s.mucNangTruocHans)
  const setMucs = useDanhMucStore((s) => s.setMucNangTruocHans)
  const [nhap, setNhap] = useState<MucNangTruocHan[] | null>(null)
  const ds = (nhap ?? mucs).slice().sort((a, b) => a.thuTu - b.thuTu)
  const doi = (id: string, patch: Partial<MucNangTruocHan>) => setNhap(ds.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  const luu = () => {
    if (!nhap || !currentUser) return
    if (nhap.some((m) => !m.ten.trim() || m.soThang < 1 || m.soThang > 12)) { message.error('Mỗi dòng cần tên hình thức và số tháng từ 1 đến 12'); return }
    setMucs(nhap.map((m, i) => ({ ...m, ten: m.ten.trim(), thuTu: i + 1 })))
    logAction(currentUser.id, currentUser.fullName, 'UPDATE', 'DanhMuc', { moTa: 'Cập nhật bảng mức nâng lương trước thời hạn theo thành tích' })
    setNhap(null)
    message.success('Đã lưu bảng mức')
  }
  return (
    <>
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        title="Thông tư 08/2013 không quy định số tháng theo từng hình thức khen thưởng"
        description="Điểm e khoản 1 Điều 3 giao Quy chế của từng đơn vị quy định cấp độ thành tích và thời gian nâng trước tương ứng (tối đa 12 tháng). Bảng này là mức gợi ý chung của phường: khi lập hồ sơ, kế toán chọn hình thức khen để điền sẵn số tháng, sửa được theo Quy chế của trường."
      />
      <Table<MucNangTruocHan>
        {...BANG_CHUAN}
        rowKey="id"
        dataSource={ds}
        pagination={false}
        columns={[
          cotSTT<MucNangTruocHan>(),
          { title: 'Hình thức khen thưởng / danh hiệu', key: 'ten', width: 520, render: (_, m) => (suaDuoc ? <Input value={m.ten} onChange={(e) => doi(m.id, { ten: e.target.value })} /> : m.ten) },
          cotGiua<MucNangTruocHan>('Số tháng nâng trước', 'st', 130, (m) => (suaDuoc ? <InputNumber min={1} max={12} precision={0} value={m.soThang} onChange={(v) => doi(m.id, { soThang: v ?? 1 })} /> : m.soThang)),
          cotGiua<MucNangTruocHan>('Đang dùng', 'ac', 90, (m) => (suaDuoc ? <Switch checked={m.active} onChange={(v) => doi(m.id, { active: v })} /> : m.active ? 'Có' : 'Không')),
          ...(suaDuoc ? [cotGiua<MucNangTruocHan>('', 'xoa', 60, (m) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setNhap(ds.filter((x) => x.id !== m.id))} />)] : []),
        ]}
      />
      {suaDuoc && (
        <Space style={{ marginTop: 12 }}>
          <Button icon={<PlusOutlined />} onClick={() => setNhap([...ds, { id: `mth_${nanoid(6)}`, ten: '', soThang: 6, thuTu: ds.length + 1, active: true }])}>Thêm dòng</Button>
          <Button type="primary" icon={<SaveOutlined />} disabled={!nhap} onClick={luu}>Lưu bảng mức</Button>
          {nhap && <Button onClick={() => setNhap(null)}>Hủy thay đổi</Button>}
        </Space>
      )}
    </>
  )
}
