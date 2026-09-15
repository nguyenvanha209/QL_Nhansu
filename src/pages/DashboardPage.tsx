import { useMemo, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Select, Typography, Space, Badge } from 'antd'
import { TeamOutlined, FileTextOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList } from 'recharts'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useSalaryAlerts } from '@/hooks/useSalaryAlerts'
import { useAuth } from '@/hooks/useAuth'
import { filterRetirementInYears } from '@/utils/retirement'
import { getReviewUrgencyColor } from '@/utils/calculations'
import { formatDate } from '@/utils/helpers'
import { TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '@/types/deXuat'
import { isDangCongTac } from '@/types/vienChuc'
import type { LoaiDonVi } from '@/types/donVi'

const { Title, Text } = Typography
const LOAI_ORDER: Record<string, number> = { MAM_NON: 1, TIEU_HOC: 2, THCS: 3, OTHER: 4 }

const BAR_COLORS = ['#2563eb', '#3b82f6', '#60a5fa']

export default function DashboardPage() {
  const { currentUser, scopeDonViId } = useAuth()
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && isDangCongTac(v) && (!scopeDonViId || v.donViId === scopeDonViId)), [allVienChucs, scopeDonViId])
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const allDeXuats = useDeXuatStore((s) => s.deXuats)
  const deXuats = useMemo(() => allDeXuats.filter((d) => !scopeDonViId || d.donViId === scopeDonViId), [allDeXuats, scopeDonViId])
  const salaryAlerts = useSalaryAlerts(scopeDonViId, 90)
  const [retireYears, setRetireYears] = useState(3)

  const donViLoaiMap = useMemo(() => {
    const map: Record<string, LoaiDonVi | undefined> = {}
    allDonVis.forEach((d) => { map[d.id] = d.loai as LoaiDonVi | undefined })
    return map
  }, [allDonVis])

  const nhomLaoDong = useMemo(() => {
    let vienChucBienChe = 0
    let laoDongHopDong = 0
    let nhanVienPhucVu = 0
    let nhanVienNuoiDuong = 0
    vienChucs.forEach((v) => {
      if (v.loaiLaoDong === 'VIEN_CHUC' || v.loaiLaoDong === 'TAP_SU') {
        vienChucBienChe++
      } else if (v.loaiLaoDong === 'HOP_DONG_XDT' || v.loaiLaoDong === 'HOP_DONG_111' || v.loaiLaoDong === 'HOP_DONG_235') {
        laoDongHopDong++
      } else if (v.loaiLaoDong === 'HOP_DONG_TRUONG') {
        if (donViLoaiMap[v.donViId] === 'MAM_NON') {
          nhanVienNuoiDuong++
        } else {
          nhanVienPhucVu++
        }
      }
    })
    return { vienChucBienChe, laoDongHopDong, nhanVienPhucVu, nhanVienNuoiDuong }
  }, [vienChucs, donViLoaiMap])

  const bySchoolData = useMemo(() => {
    const sorted = [...donVis].sort((a, b) => {
      const oa = LOAI_ORDER[a.loai] ?? 99
      const ob = LOAI_ORDER[b.loai] ?? 99
      if (oa !== ob) return oa - ob
      return a.ten.localeCompare(b.ten, 'vi')
    })
    return sorted.map((dv) => ({
      name: dv.ten.replace('Trường ', '').replace('Trường THCS ', 'THCS '),
      total: vienChucs.filter((v) => v.donViId === dv.id).length,
    })).filter((d) => d.total > 0)
  }, [donVis, vienChucs])

  const viTriViecLamData = useMemo(() => {
    const cdMap = new Map(chucDanhs.map((c) => [c.id, c]))
    const counts: Record<string, number> = {
      cbql: 0, giaoVien: 0, keToan: 0, vanThu: 0, thuVien: 0,
      thietBi: 0, nuoiDuong: 0, phucVu: 0, yTe: 0, khac: 0,
    }
    vienChucs.forEach((v) => {
      const cd = cdMap.get(v.chucDanhId)
      const nhom = cd?.nhom
      const ten = (cd?.ten ?? '').toLowerCase()
      const isCBQL = v.vtvl === 'CBQL' || nhom === 'QUAN_LY'
      const isGV = !isCBQL && (v.vtvl === 'GIAO_VIEN' || nhom === 'GIAO_VIEN')
      if (isCBQL) counts.cbql++
      else if (isGV) counts.giaoVien++
      else if (ten.includes('kế toán')) counts.keToan++
      else if (ten.includes('văn thư')) counts.vanThu++
      else if (ten.includes('thư viện')) counts.thuVien++
      else if (ten.includes('thiết bị')) counts.thietBi++
      else if (ten.includes('nuôi dưỡng')) counts.nuoiDuong++
      else if (ten.includes('phục vụ') || ten.includes('lao động') || ten.includes('bảo vệ')) counts.phucVu++
      else if (ten.includes('y tế')) counts.yTe++
      else counts.khac++
    })
    return [
      { name: 'CBQL', value: counts.cbql, color: '#6366f1' },
      { name: 'Giáo viên', value: counts.giaoVien, color: '#2563eb' },
      { name: 'Kế toán', value: counts.keToan, color: '#0891b2' },
      { name: 'Văn thư', value: counts.vanThu, color: '#d97706' },
      { name: 'Thư viện', value: counts.thuVien, color: '#db2777' },
      { name: 'Thiết bị', value: counts.thietBi, color: '#ca8a04' },
      { name: 'Nuôi dưỡng', value: counts.nuoiDuong, color: '#16a34a' },
      { name: 'Phục vụ/LĐ', value: counts.phucVu, color: '#dc2626' },
      { name: 'Y tế', value: counts.yTe, color: '#65a30d' },
      { name: 'Nhân viên khác', value: counts.khac, color: '#94a3b8' },
    ].filter((d) => d.value > 0)
  }, [vienChucs, chucDanhs])

  const statusCounts = useMemo(() => {
    const statuses = ['CHO_HIEU_TRUONG_DUYET', 'CHO_XET_DUYET', 'CHO_PHE_DUYET', 'DA_PHE_DUYET', 'TU_CHOI'] as const
    return statuses.map((s) => ({ status: s, count: deXuats.filter((d) => d.trangThai === s).length }))
  }, [deXuats])

  const retireIds = useMemo(() => filterRetirementInYears(vienChucs.map((v) => ({ id: v.id, ngaySinh: v.ngaySinh, gioiTinh: v.gioiTinh as 'NAM' | 'NU' })), retireYears), [vienChucs, retireYears])

  const deXuatDangXL = deXuats.filter((d) => d.trangThai === 'CHO_HIEU_TRUONG_DUYET' || d.trangThai === 'CHO_XET_DUYET' || d.trangThai === 'CHO_PHE_DUYET').length

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Chào buổi sáng' : now.getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: '0 0 2px', fontWeight: 600 }}>
          {greeting}, {currentUser?.fullName ?? 'bạn'}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>{dateStr}</Text>
      </div>

      {/* KPI row — 4 thẻ ngang */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <Card className="kpi-card" style={{ borderTop: '3px solid #2563eb' }}>
            <Statistic
              title="Tổng lao động"
              value={vienChucs.length}
              prefix={<TeamOutlined style={{ color: '#2563eb' }} />}
              styles={{ content: { color: '#2563eb', fontWeight: 700 } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="kpi-card" style={{ borderTop: '3px solid #f59e0b' }}>
            <Statistic
              title="Đề xuất đang xử lý"
              value={deXuatDangXL}
              prefix={<FileTextOutlined style={{ color: '#f59e0b' }} />}
              styles={{ content: { color: '#f59e0b', fontWeight: 700 } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="kpi-card" style={{ borderTop: '3px solid #ef4444' }}>
            <Statistic
              title="Sắp nâng lương"
              value={salaryAlerts.length}
              prefix={<WarningOutlined style={{ color: '#ef4444' }} />}
              styles={{ content: { color: salaryAlerts.length > 0 ? '#ef4444' : '#16a34a', fontWeight: 700 } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="kpi-card" style={{ borderTop: '3px solid #8b5cf6' }}>
            <Statistic
              title={`Nghỉ hưu ${retireYears} năm tới`}
              value={retireIds.length}
              prefix={<ClockCircleOutlined style={{ color: '#8b5cf6' }} />}
              styles={{ content: { color: '#8b5cf6', fontWeight: 700 } }}
              suffix={
                <Select size="small" value={retireYears} onChange={setRetireYears} style={{ marginLeft: 4, width: 72 }} variant="borderless">
                  <Select.Option value={1}>1 năm</Select.Option>
                  <Select.Option value={3}>3 năm</Select.Option>
                  <Select.Option value={5}>5 năm</Select.Option>
                </Select>
              }
            />
          </Card>
        </Col>
      </Row>

      {/* Cơ cấu lao động — 4 thẻ nhỏ */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={12} sm={6}>
          <Card size="small" className="kpi-card">
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Viên chức biên chế</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>{nhomLaoDong.vienChucBienChe}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Viên chức + Tập sự</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="kpi-card">
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Lao động hợp đồng</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0891b2', fontVariantNumeric: 'tabular-nums' }}>{nhomLaoDong.laoDongHopDong}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>HĐ 111, 235, XĐT</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="kpi-card">
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Nhân viên phục vụ</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>{nhomLaoDong.nhanVienPhucVu}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>HĐ trường (TH, THCS)</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="kpi-card">
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Nhân viên nuôi dưỡng</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{nhomLaoDong.nhanVienNuoiDuong}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>HĐ trường (Mầm non)</div>
          </Card>
        </Col>
      </Row>

      {/* Biểu đồ */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
          <Card title="Nhân sự theo đơn vị trường" size="small" className="chart-card">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bySchoolData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: 'rgba(37,99,235,0.06)' }}
                />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
                <Bar dataKey="total" fill="url(#barGrad)" name="Nhân sự" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="total" position="top" style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Cơ cấu vị trí việc làm" size="small" className="chart-card">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={viTriViecLamData} dataKey="value" nameKey="name"
                  cx="50%" cy="42%" outerRadius={78} innerRadius={32}
                  label={({ name, value, percent }) => `${value} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={{ strokeWidth: 1 }}
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {viTriViecLamData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${v} người`]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={10}>
          <Card title="Trạng thái đề xuất điều chỉnh HSL - PCTN" size="small" className="chart-card">
            <Space orientation="vertical" style={{ width: '100%' }}>
              {statusCounts.map(({ status, count }) => (
                <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <Tag color={TRANG_THAI_COLORS[status]}>{TRANG_THAI_LABELS[status]}</Tag>
                  <Badge count={count} showZero color={count > 0 ? '#2563eb' : '#d9d9d9'} />
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={<>Cảnh báo sắp đến kỳ nâng lương <Tag color="orange">{salaryAlerts.length}</Tag></>}
            size="small" className="chart-card"
          >
            <Table scroll={{ x: 'max-content' }}
              size="small"
              dataSource={salaryAlerts.slice(0, 5)}
              rowKey="vienChucId"
              pagination={false}
              columns={[
                { title: 'Viên chức', dataIndex: 'hoTen', key: 'hoTen', ellipsis: true },
                { title: 'Đơn vị', dataIndex: 'donViTen', key: 'donViTen', ellipsis: true, responsive: ['lg'] },
                {
                  title: 'Ngày nâng lương', dataIndex: 'ngayNangLuongTiepTheo', key: 'ngay',
                  render: (v: any, row: any) => (
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
