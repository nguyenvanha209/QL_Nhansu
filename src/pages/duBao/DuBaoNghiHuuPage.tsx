import { useMemo, useState } from 'react'
import { Card, Table, Select, Space, Tag, Typography, Statistic, Row, Col } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { calcRetirementDate, getDaysUntilRetirement } from '@/utils/retirement'
import { formatDate } from '@/utils/helpers'

const { Title, Text } = Typography

export default function DuBaoNghiHuuPage() {
  const { scopeDonViId } = useAuth()
  const [years, setYears] = useState(3)
  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)

  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && (!scopeDonViId || v.donViId === scopeDonViId)), [allVienChucs, scopeDonViId])
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)

  const data = useMemo(() => {
    const limit = years * 365
    return vienChucs
      .map((vc) => {
        const gt = vc.gioiTinh as 'NAM' | 'NU'
        const days = getDaysUntilRetirement(vc.ngaySinh, gt)
        const retireDate = calcRetirementDate(vc.ngaySinh, gt)
        const dv = donVis.find((d) => d.id === vc.donViId)
        const cd = chucDanhs.find((c) => c.id === vc.chucDanhId)
        return { ...vc, days, retireDate: retireDate.toISOString().slice(0, 10), donViTen: dv?.ten ?? '', chucDanhTen: cd?.ten ?? '' }
      })
      .filter((r) => {
        if (r.days < 0 || r.days > limit) return false
        if (filterDonVi && r.donViId !== filterDonVi) return false
        return true
      })
      .sort((a, b) => a.days - b.days)
  }, [vienChucs, donVis, chucDanhs, years, filterDonVi, scopeDonViId])

  const urgentCount = data.filter((r) => r.days <= 180).length

  const columns = [
    { title: 'Họ và tên', key: 'hoTen', render: (_: any, r: any) => `${r.ho} ${r.ten}`, ellipsis: true },
    { title: 'Ngày sinh', dataIndex: 'ngaySinh', key: 'ns', width: 110, render: (v: string) => formatDate(v) },
    { title: 'Giới tính', dataIndex: 'gioiTinh', key: 'gt', width: 80, render: (v: string) => v === 'NAM' ? 'Nam' : 'Nữ' },
    { title: 'Đơn vị', dataIndex: 'donViTen', key: 'dv', ellipsis: true },
    { title: 'Chức danh', dataIndex: 'chucDanhTen', key: 'cd', ellipsis: true },
    {
      title: 'Dự kiến nghỉ hưu', dataIndex: 'retireDate', key: 'rd', width: 140,
      render: (v: string) => <Text strong>{formatDate(v)}</Text>,
    },
    {
      title: 'Còn lại', dataIndex: 'days', key: 'days', width: 110,
      render: (v: number) => (
        <Tag color={v <= 180 ? 'red' : v <= 365 ? 'orange' : 'blue'}>
          {Math.floor(v / 30)} tháng
        </Tag>
      ),
    },
    {
      title: 'Mức độ', key: 'level',
      render: (_: any, r: any) => r.days <= 90 ? <Tag color="red">Rất gấp</Tag> : r.days <= 180 ? <Tag color="orange">Gấp</Tag> : r.days <= 365 ? <Tag color="gold">Cần chuẩn bị</Tag> : <Tag>Theo dõi</Tag>,
    },
  ]

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 16 }}>Dự báo nghỉ hưu</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Statistic title={`Nghỉ hưu trong ${years} năm`} value={data.length} prefix={<ClockCircleOutlined />} valueStyle={{ color: data.length > 0 ? '#f5222d' : '#52c41a' }} /></Col>
        <Col xs={24} sm={8}><Statistic title="Cần chuẩn bị gấp (≤ 6 tháng)" value={urgentCount} valueStyle={{ color: urgentCount > 0 ? '#fa8c16' : '#52c41a' }} /></Col>
      </Row>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select value={years} onChange={setYears} style={{ width: 140 }} options={[{ value: 1, label: 'Trong 1 năm' }, { value: 3, label: 'Trong 3 năm' }, { value: 5, label: 'Trong 5 năm' }]} />
        {!scopeDonViId && (
          <Select placeholder="Lọc đơn vị" style={{ width: 200 }} value={filterDonVi} onChange={setFilterDonVi} allowClear options={donVis.map((d) => ({ value: d.id, label: d.ten }))} />
        )}
      </Space>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        scroll={{ x: 800 }}
        pagination={{ pageSize: 20, showTotal: (t) => `Tổng ${t} viên chức dự kiến nghỉ hưu` }}
      />
    </Card>
  )
}
