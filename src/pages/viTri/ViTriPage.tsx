import { useMemo } from 'react'
import { Table, Card, Typography, Tag, Progress, Tooltip } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useAuth } from '@/hooks/useAuth'

const { Title } = Typography

export default function ViTriPage() {
  const { scopeDonViId } = useAuth()
  const allViTris = useDanhMucStore((s) => s.viTriViecLams)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const viTris = useMemo(() => allViTris.filter((v) => v.active), [allViTris])
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active), [allVienChucs])

  const data = useMemo(() => {
    const list = scopeDonViId ? viTris.filter((v) => v.donViId === scopeDonViId) : viTris
    return list.map((vt) => {
      const thucTe = vienChucs.filter((vc) => vc.donViId === vt.donViId && vt.chucDanhIds.includes(vc.chucDanhId)).length
      const tongChiTieu = vt.soLuongBienChe + vt.soLuongHopDong
      const overQuota = thucTe > tongChiTieu
      return { ...vt, thucTe, tongChiTieu, overQuota }
    })
  }, [viTris, vienChucs, scopeDonViId])

  const columns = [
    { title: 'Vị trí', dataIndex: 'ten', key: 'ten', ellipsis: true },
    {
      title: 'Đơn vị', dataIndex: 'donViId', key: 'dv', ellipsis: true,
      render: (id: string) => donVis.find((d) => d.id === id)?.ten ?? id,
    },
    { title: 'Loại', dataIndex: 'loai', key: 'loai', render: (v: string) => ({ QUAN_LY: 'Quản lý', CHUYEN_MON: 'Chuyên môn', HO_TRO: 'Hỗ trợ' }[v] ?? v) },
    {
      title: 'Chức danh phù hợp', dataIndex: 'chucDanhIds', key: 'cd',
      render: (ids: string[]) => ids.map((id) => <Tag key={id}>{chucDanhs.find((c) => c.id === id)?.ten ?? id}</Tag>),
    },
    { title: 'Biên chế', dataIndex: 'soLuongBienChe', key: 'bc', width: 80, align: 'center' as const },
    { title: 'HĐ', dataIndex: 'soLuongHopDong', key: 'hd', width: 70, align: 'center' as const },
    { title: 'Tổng CT', dataIndex: 'tongChiTieu', key: 'tct', width: 80, align: 'center' as const },
    {
      title: 'Thực tế', dataIndex: 'thucTe', key: 'tt', width: 80, align: 'center' as const,
      render: (v: number, r: any) => (
        <span style={{ color: r.overQuota ? '#f5222d' : 'inherit', fontWeight: r.overQuota ? 700 : 400 }}>
          {r.overQuota && <Tooltip title="Vượt chỉ tiêu!"><WarningOutlined style={{ color: '#f5222d', marginRight: 4 }} /></Tooltip>}
          {v}
        </span>
      ),
    },
    {
      title: 'Tỷ lệ', key: 'ratio', width: 120,
      render: (_: any, r: any) => (
        <Progress
          percent={r.tongChiTieu > 0 ? Math.round((r.thucTe / r.tongChiTieu) * 100) : 0}
          size="small"
          status={r.overQuota ? 'exception' : r.thucTe === r.tongChiTieu ? 'success' : 'active'}
        />
      ),
    },
  ]

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 16 }}>Vị trí việc làm & Chỉ tiêu biên chế</Title>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        scroll={{ x: 900 }}
        rowClassName={(r) => r.overQuota ? 'ant-table-row-selected' : ''}
        pagination={{ pageSize: 20, showTotal: (t) => `Tổng ${t} vị trí` }}
      />
    </Card>
  )
}
