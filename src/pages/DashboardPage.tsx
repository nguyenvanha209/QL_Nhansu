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
import { getReviewUrgencyColor } from '@/utils/calculations'
import { formatDate } from '@/utils/helpers'
import { TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '@/types/deXuat'
import { isDangCongTac } from '@/types/vienChuc'
import type { LoaiDonVi } from '@/types/donVi'

const { Title, Text } = Typography
const LOAI_ORDER: Record<string, number> = { MAM_NON: 1, TIEU_HOC: 2, THCS: 3, OTHER: 4 }

export default function DashboardPage() {
  const { scopeDonViId } = useAuth()
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && isDangCongTac(v) && (!scopeDonViId || v.donViId === scopeDonViId)), [allVienChucs, scopeDonViId])
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const allDeXuats = useDeXuatStore((s) => s.deXuats)
  const deXuats = useMemo(() => allDeXuats.filter((d) => !scopeDonViId || d.donViId === scopeDonViId), [allDeXuats, scopeDonViId])
  const salaryAlerts = useSalaryAlerts(scopeDonViId, 90)
  const [retireYears, setRetireYears] = useState(3)

  // Bản đồ donViId → loại đơn vị (để phân loại nhân viên nuôi dưỡng vs phục vụ)
  const donViLoaiMap = useMemo(() => {
    const map: Record<string, LoaiDonVi | undefined> = {}
    allDonVis.forEach((d) => { map[d.id] = d.loai as LoaiDonVi | undefined })
    return map
  }, [allDonVis])

  // 4 nhóm lao động
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

  // Nhân sự theo trường (sắp xếp MN → TH → THCS → ABC)
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

  // Cơ cấu theo vị trí việc làm
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
      { name: 'CBQL', value: counts.cbql, color: '#722ed1' },
      { name: 'Giáo viên', value: counts.giaoVien, color: '#1677ff' },
      { name: 'Kế toán', value: counts.keToan, color: '#13c2c2' },
      { name: 'Văn thư', value: counts.vanThu, color: '#fa8c16' },
      { name: 'Thư viện', value: counts.thuVien, color: '#eb2f96' },
      { name: 'Thiết bị', value: counts.thietBi, color: '#faad14' },
      { name: 'Nuôi dưỡng', value: counts.nuoiDuong, color: '#52c41a' },
      { name: 'Phục vụ/LĐ', value: counts.phucVu, color: '#f5222d' },
      { name: 'Y tế', value: counts.yTe, color: '#a0d911' },
      { name: 'Nhân viên khác', value: counts.khac, color: '#8c8c8c' },
    ].filter((d) => d.value > 0)
  }, [vienChucs, chucDanhs])

  // Đề xuất theo trạng thái
  const statusCounts = useMemo(() => {
    const statuses = ['CHO_HIEU_TRUONG_DUYET', 'CHO_XET_DUYET', 'CHO_PHE_DUYET', 'DA_PHE_DUYET', 'TU_CHOI'] as const
    return statuses.map((s) => ({ status: s, count: deXuats.filter((d) => d.trangThai === s).length }))
  }, [deXuats])

  // Nghỉ hưu
  const retireIds = useMemo(() => filterRetirementInYears(vienChucs.map((v) => ({ id: v.id, ngaySinh: v.ngaySinh, gioiTinh: v.gioiTinh as 'NAM' | 'NU' })), retireYears), [vienChucs, retireYears])

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Tổng quan hệ thống</Title>

      {/* KPI vận hành */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Đề xuất đang xử lý" value={deXuats.filter((d) => d.trangThai === 'CHO_HIEU_TRUONG_DUYET' || d.trangThai === 'CHO_XET_DUYET' || d.trangThai === 'CHO_PHE_DUYET').length} prefix={<FileTextOutlined />} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Sắp đến kỳ nâng lương" value={salaryAlerts.length} prefix={<WarningOutlined />} styles={{ content: { color: salaryAlerts.length > 0 ? '#f5222d' : '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title={`Nghỉ hưu trong ${retireYears} năm`} value={retireIds.length} prefix={<ClockCircleOutlined />} styles={{ content: { color: '#722ed1' } }} suffix={
              <Select size="small" value={retireYears} onChange={setRetireYears} style={{ marginLeft: 8, width: 80 }}>
                <Select.Option value={1}>1 năm</Select.Option>
                <Select.Option value={3}>3 năm</Select.Option>
                <Select.Option value={5}>5 năm</Select.Option>
              </Select>
            } />
          </Card>
        </Col>
      </Row>

      {/* Tổng số lao động + cơ cấu — cùng một hàng */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Tổng số LĐ — nổi bật */}
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: '#1677ff', border: 'none', height: '100%' }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 6 }}>
              <TeamOutlined style={{ marginRight: 6 }} />Tổng số lao động
            </div>
            <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
              {vienChucs.length}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 8 }}>
              Đang công tác tại các CSGD
            </div>
          </Card>
        </Col>
        {/* Viên chức biên chế — nổi bật thứ 2 */}
        <Col xs={12} sm={6} lg={5}>
          <Card size="small" style={{ borderTop: '3px solid #1677ff', height: '100%' }}>
            <Statistic title="Viên chức biên chế" value={nhomLaoDong.vienChucBienChe} valueStyle={{ fontSize: 26, color: '#1677ff', fontWeight: 700 }} />
            <Text type="secondary" style={{ fontSize: 11 }}>Viên chức + Tập sự</Text>
          </Card>
        </Col>
        {/* 3 nhóm còn lại */}
        <Col xs={12} sm={6} lg={4}>
          <Card size="small" style={{ borderTop: '3px solid #13c2c2', height: '100%' }}>
            <Statistic title="Lao động hợp đồng" value={nhomLaoDong.laoDongHopDong} valueStyle={{ fontSize: 22, color: '#13c2c2' }} />
            <Text type="secondary" style={{ fontSize: 11 }}>HĐ 111, 235, XĐT</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={5}>
          <Card size="small" style={{ borderTop: '3px solid #fa8c16', height: '100%' }}>
            <Statistic title="Nhân viên phục vụ" value={nhomLaoDong.nhanVienPhucVu} valueStyle={{ fontSize: 22, color: '#fa8c16' }} />
            <Text type="secondary" style={{ fontSize: 11 }}>HĐ trường (TH, THCS)</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card size="small" style={{ borderTop: '3px solid #52c41a', height: '100%' }}>
            <Statistic title="Nhân viên nuôi dưỡng" value={nhomLaoDong.nhanVienNuoiDuong} valueStyle={{ fontSize: 22, color: '#52c41a' }} />
            <Text type="secondary" style={{ fontSize: 11 }}>HĐ trường (Mầm non)</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Biểu đồ theo trường */}
        <Col xs={24} lg={14}>
          <Card title="Nhân sự theo đơn vị trường" size="small">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bySchoolData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#1677ff" name="Nhân sự" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Cơ cấu theo vị trí việc làm */}
        <Col xs={24} lg={10}>
          <Card title="Cơ cấu vị trí việc làm" size="small">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={viTriViecLamData} dataKey="value" nameKey="name" cx="50%" cy="38%" outerRadius={72} innerRadius={30}>
                  {viTriViecLamData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} người`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Trạng thái đề xuất */}
        <Col xs={24} lg={10}>
          <Card title="Trạng thái đề xuất điều chỉnh HSL - PCTN" size="small">
            <Space orientation="vertical" style={{ width: '100%' }}>
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
