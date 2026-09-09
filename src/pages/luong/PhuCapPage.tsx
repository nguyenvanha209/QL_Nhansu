import { useMemo, useState } from 'react'
import { Table, Card, Typography, Tag, Input, Select, Space } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useLuongStore } from '@/store/luongStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { matchSearch, formatDate, soSanhVienChuc } from '@/utils/helpers'

const { Title } = Typography

export default function PhuCapPage() {
  const { scopeDonViId } = useAuth()
  const [search, setSearch] = useState('')
  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)

  const phuCapVienChucs = useLuongStore((s) => s.phuCapVienChucs)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)

  const data = useMemo(() => {
    return phuCapVienChucs
      .filter((p) => p.isActive)
      .map((p) => {
        const vc = vienChucs.find((v) => v.id === p.vienChucId)
        const dv = donVis.find((d) => d.id === vc?.donViId)
        const lpc = loaiPhuCaps.find((l) => l.id === p.loaiPhuCapId)
        const giaTri = p.giaTri > 0 ? p.giaTri : (lpc?.giaTri ?? 0)
        return {
          ...p, giaTri, hoTen: vc ? `${vc.ho} ${vc.ten}` : '', donViId: vc?.donViId ?? '',
          donViTen: dv?.ten ?? '', loaiPhuCapTen: lpc?.ten ?? '', loaiCongThuc: lpc?.loaiCongThuc,
          ho: vc?.ho ?? '', ten: vc?.ten ?? '', vtvl: vc?.vtvl, chucVu: vc?.chucVu,
        }
      })
      .filter((r) => {
        if (scopeDonViId && r.donViId !== scopeDonViId) return false
        if (filterDonVi && r.donViId !== filterDonVi) return false
        if (search) return matchSearch(r.hoTen, search)
        return true
      })
      .sort(soSanhVienChuc())
  }, [phuCapVienChucs, vienChucs, donVis, loaiPhuCaps, filterDonVi, search, scopeDonViId])

  const columns = [
    { title: 'Viên chức', dataIndex: 'hoTen', key: 'ht', minWidth: 160, sorter: (a: any, b: any) => a.hoTen.localeCompare(b.hoTen, 'vi') },
    { title: 'Đơn vị', dataIndex: 'donViTen', key: 'dv', minWidth: 130, responsive: ['lg' as const], sorter: (a: any, b: any) => a.donViTen.localeCompare(b.donViTen, 'vi') },
    { title: 'Loại phụ cấp', dataIndex: 'loaiPhuCapTen', key: 'lpc', sorter: (a: any, b: any) => a.loaiPhuCapTen.localeCompare(b.loaiPhuCapTen, 'vi') },
    {
      title: 'Tỷ lệ/Hệ số', key: 'tl', width: 100,
      render: (_: any, r: any) => r.loaiCongThuc === 'TIEN_MAT' ? `${r.giaTri.toLocaleString()}đ` : r.loaiCongThuc === 'HE_SO' ? `+${r.giaTri}` : `${r.giaTri}%`,
      sorter: (a: any, b: any) => a.giaTri - b.giaTri,
    },
    { title: 'Ngày hiệu lực', dataIndex: 'ngayHieuLuc', key: 'nhl', width: 110, render: (v: string) => formatDate(v), sorter: (a: any, b: any) => (a.ngayHieuLuc ?? '').localeCompare(b.ngayHieuLuc ?? '') },
    { title: 'Trạng thái', key: 'ts', render: (_: any, r: any) => <Tag color={r.isActive ? 'green' : 'default'}>{r.isActive ? 'Đang hưởng' : 'Hết hạn'}</Tag> },
  ]

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 16 }}>Quản lý phụ cấp viên chức</Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input prefix={<SearchOutlined />} placeholder="Tìm viên chức..." style={{ width: 220 }} value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
        {!scopeDonViId && (
          <Select placeholder="Lọc theo đơn vị" style={{ width: 200 }} value={filterDonVi} onChange={setFilterDonVi} allowClear options={donVis.map((d) => ({ value: d.id, label: d.ten }))} />
        )}
      </Space>
      <Table dataSource={data} columns={columns} rowKey="id" size="small" scroll={{ x: 800, y: 'calc(100vh - 260px)' }}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100], showTotal: (t) => `Tổng ${t} bản ghi` }}
      />
    </Card>
  )
}
