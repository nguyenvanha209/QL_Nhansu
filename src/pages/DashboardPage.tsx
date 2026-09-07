import { useMemo, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Select, Typography, Progress, Space, Badge } from 'antd'
import { TeamOutlined, FileTextOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useSalaryAlerts } from '@/hooks/useSalaryAlerts'
import { useAuth } from '@/hooks/useAuth'
import { getDaysUntilRetirement, filterRetirementInYears } from '@/utils/retirement'
import { getReviewUrgencyColor, formatVND } from '@/utils/calculations'
import { formatDate } from '@/utils/helpers'
import { TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '@/types/deXuat'

const { Title, Text } = Typography
const PIE_COLORS = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16']

export default function DashboardPage() {
  const { scopeDonViId } = useAuth()
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && (!scopeDonViId || v.donViId === scopeDonViId)), [allVienChucs, scopeDonViId])
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const allDeXuats = useDeXuatStore((s) => s.deXuats)
  const deXuats = useMemo(() => allDeXuats.filter((d) => !scopeDonViId || d.donViId === scopeDonViId), [allDeXuats, scopeDonViId])
  const salaryAlerts = useSalaryAlerts(scopeDonViId, 90)
  const [retireYears, setRetireYears] = useState(3)

  // Nhân sự theo trường
  const bySchoolData = useMemo(() => {
    return donVis.map((dv) => ({
      name: dv.ten.replace('Trường ', '').replace('Trường THCS ', 'THCS '),
      total: vienChucs.filter((v) => v.donViId === dv.id).length,
    })).filter((d) => d.total > 0)
  }, [donVis, vienChucs])

  // Loại hình lao động
  const byTypeData = useMemo(() => {
    const counts: Record<string, number> = {}
    vienChucs.forEach((v) => {
      const label = v.loaiLaoDong
      counts[label] = (counts[label] || 0) + 1
    })
    const labels: Record<string, string> = {
      VIEN_CHUC: 'Viên chức', TAP_SU: 'Tập sự', HOP_DONG_XDT: 'HĐ xác định thời hạn',
      HOP_DONG_235: 'HĐ 235', HOP_DONG_TRUONG: 'HĐ trường', KHAC: 'Khác',
    }
    return Object.entries(counts).map(([k, v]) => ({ name: labels[k] ?? k, value: v }))
  }, [vienChucs])

  // Đề xuất theo trạng thái
  const statusCounts = useMemo(() => {
    const statuses = ['CHO_XET_DUYET', 'CHO_PHE_DUYET', 'DA_PHE_DUYET', 'TU_CHOI'] as const
    return statuses.map((s) => ({ status: s, count: deXuats.filter((d) => d.trangThai === s).length }))
  }, [deXuats])

  // Nghỉ hưu
  const retireIds = useMemo(() => filterRetirementInYears(vienChucs.map((v) => ({ id: v.id, ngaySinh: v.ngaySinh, gioiTinh: v.gioiTinh as 'NAM' | 'NU' })), retireYears), [vienChucs, retireYears])

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Tổng quan hệ thống</Title>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Tổng viên chức" value={vienChucs.length} prefix={<TeamOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Đề xuất đang xử lý" value={deXuats.filter((d) => d.trangThai === 'CHO_XET_DUYET' || d.trangThai === 'CHO_PHE_DUYET').length} prefix={<FileTextOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Sắp đến kỳ nâng lương" value={salaryAlerts.length} prefix={<WarningOutlined />} valueStyle={{ color: salaryAlerts.length > 0 ? '#f5222d' : '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={`Nghỉ hưu trong ${retireYears} năm`} value={retireIds.length} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#722ed1' }} suffix={
              <Select size="small" value={retireYears} onChange={setRetireYears} style={{ marginLeft: 8, width: 80 }}>
                <Select.Option value={1}>1 năm</Select.Option>
                <Select.Option value={3}>3 năm</Select.Option>
                <Select.Option value={5}>5 năm</Select.Option>
              </Select>
            } />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Biểu đồ theo trường */}
        <Col xs={24} lg={14}>
          <Card title="Nhân sự theo đơn vị trường" size="small">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bySchoolData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#1677ff" name="Nhân sự" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Pie loại hình */}
        <Col xs={24} lg={10}>
          <Card title="Loại hình lao động" size="small">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {byTypeData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Trạng thái đề xuất */}
        <Col xs={24} lg={10}>
          <Card title="Trạng thái đề xuất lương" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              {statusCounts.map(({ status, count }) => (
                <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tag color={TRANG_THAI_COLORS[status]}>{TRANG_THAI_LABELS[status]}</Tag>
                  <Badge count={count} showZero color={count > 0 ? '#1677ff' : '#d9d9d9'} />
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        {/* Cảnh báo nâng lương */}
        <Col xs={24} lg={14}>
          <Card title={<>Cảnh báo sắp đến kỳ nâng lương <Tag color="orange">{salaryAlerts.length}</Tag></>} size="small">
            <Table
              size="small"
              dataSource={salaryAlerts.slice(0, 5)}
              rowKey="vienChucId"
              pagination={false}
              columns={[
                { title: 'Viên chức', dataIndex: 'hoTen', key: 'hoTen', ellipsis: true },
                { title: 'Đơn vị', dataIndex: 'donViTen', key: 'donViTen', ellipsis: true, responsive: ['lg'] },
                {
                  title: 'Ngày nâng lương', dataIndex: 'ngayNangLuongTiepTheo', key: 'ngay',
                  render: (v, row) => (
                    <Text style={{ color: getReviewUrgencyColor(row.daysLeft) }}>
                      {formatDate(v)} ({row.daysLeft > 0 ? `còn ${row.daysLeft} ngày` : 'đã quá hạn'})
                    </Text>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
