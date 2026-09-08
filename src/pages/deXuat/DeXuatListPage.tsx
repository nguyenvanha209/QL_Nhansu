import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Button, Select, Tag, Space, Typography, Badge } from 'antd'
import { PlusOutlined, EyeOutlined } from '@ant-design/icons'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/helpers'
import { TRANG_THAI_LABELS, TRANG_THAI_COLORS, LOAI_DE_XUAT_LABELS } from '@/types/deXuat'
import type { TrangThaiDeXuat } from '@/types/deXuat'

const { Title } = Typography

const ALL_STATUSES: TrangThaiDeXuat[] = ['NHAP', 'CHO_HIEU_TRUONG_DUYET', 'CHO_XET_DUYET', 'CHO_PHE_DUYET', 'DA_PHE_DUYET', 'TU_CHOI', 'YEU_CAU_BO_SUNG']

export default function DeXuatListPage() {
  const navigate = useNavigate()
  const { scopeDonViId, hasPermission, isCBTruong, isLanhDao } = useAuth()
  const allDeXuats = useDeXuatStore((s) => s.deXuats)
  const deXuats = useMemo(() => allDeXuats.filter((d) => !scopeDonViId || d.donViId === scopeDonViId), [allDeXuats, scopeDonViId])
  const donVis = useDanhMucStore((s) => s.donVis)
  const [filterStatus, setFilterStatus] = useState<TrangThaiDeXuat | undefined>()
  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)

  const filtered = useMemo(() => {
    let list = deXuats
    if (filterStatus) list = list.filter((d) => d.trangThai === filterStatus)
    if (!scopeDonViId && filterDonVi) list = list.filter((d) => d.donViId === filterDonVi)
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [deXuats, filterStatus, filterDonVi, scopeDonViId])

  const canCreate = hasPermission('deXuat', 'write') && !isLanhDao

  const counts = useMemo(() => Object.fromEntries(ALL_STATUSES.map((s) => [s, deXuats.filter((d) => d.trangThai === s).length])), [deXuats])

  const columns = [
    { title: 'Mã', dataIndex: 'ma', key: 'ma', width: 130 },
    { title: 'Tiêu đề', dataIndex: 'tieuDe', key: 'td', ellipsis: true },
    {
      title: 'Đơn vị', dataIndex: 'donViId', key: 'dv', ellipsis: true,
      render: (id: string) => donVis.find((d) => d.id === id)?.ten ?? id,
    },
    { title: 'Loại', dataIndex: 'loai', key: 'loai', render: (v: string) => LOAI_DE_XUAT_LABELS[v as keyof typeof LOAI_DE_XUAT_LABELS] ?? v },
    { title: 'Số VC', key: 'sl', width: 70, render: (_: any, r: any) => r.chiTiet.length },
    {
      title: 'Trạng thái', dataIndex: 'trangThai', key: 'tt',
      render: (v: TrangThaiDeXuat) => <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v]}</Tag>,
    },
    { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'ct', width: 110, render: (v: string) => formatDate(v) },
    { title: 'Cập nhật', dataIndex: 'updatedAt', key: 'upd', width: 110, render: (v: string) => formatDate(v) },
    {
      title: 'Thao tác', key: 'action', width: 80,
      render: (_: any, r: any) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/de-xuat/${r.id}`)}>Xem</Button>
      ),
    },
  ]

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Đề xuất lương & Phụ cấp</Title>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/de-xuat/new')}>Tạo đề xuất</Button>
        )}
      </div>

      {/* Status badges */}
      <Space wrap style={{ marginBottom: 16 }}>
        {ALL_STATUSES.filter((s) => counts[s] > 0).map((s) => (
          <Tag
            key={s} color={TRANG_THAI_COLORS[s]} style={{ cursor: 'pointer', padding: '2px 8px' }}
            onClick={() => setFilterStatus(filterStatus === s ? undefined : s)}
          >
            {TRANG_THAI_LABELS[s]} <Badge count={counts[s]} color={filterStatus === s ? 'white' : undefined} style={{ marginLeft: 4, boxShadow: 'none' }} />
          </Tag>
        ))}
      </Space>

      <Space wrap style={{ marginBottom: 12 }}>
        <Select placeholder="Lọc trạng thái" style={{ width: 220 }} value={filterStatus} onChange={setFilterStatus} allowClear options={ALL_STATUSES.map((s) => ({ value: s, label: TRANG_THAI_LABELS[s] }))} />
        {!scopeDonViId && (
          <Select placeholder="Lọc đơn vị" style={{ width: 200 }} value={filterDonVi} onChange={setFilterDonVi} allowClear options={donVis.filter((d) => d.active).map((d) => ({ value: d.id, label: d.ten }))} />
        )}
      </Space>

      <Table dataSource={filtered} columns={columns} rowKey="id" size="small" scroll={{ x: 900 }}
        pagination={{ pageSize: 15, showTotal: (t) => `Tổng ${t} đề xuất` }}
      />
    </Card>
  )
}
