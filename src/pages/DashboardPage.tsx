import { useMemo, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Select, Typography, Space, Badge, Segmented } from 'antd'
import { TeamOutlined, FileTextOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
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
import { NHOM_VI_TRI, NHOM_LOAI_HINH, nhomViTri, nhomLoaiHinh } from '@/utils/nhomViTri'
import type { NhomViTri, NhomLoaiHinh } from '@/utils/nhomViTri'

const { Title, Text } = Typography
const LOAI_ORDER: Record<string, number> = { MAM_NON: 1, TIEU_HOC: 2, THCS: 3, OTHER: 4 }

const CAP_HOC = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'MAM_NON', label: 'Mầm non' },
  { value: 'TIEU_HOC', label: 'Tiểu học' },
  { value: 'THCS', label: 'THCS' },
]

export default function DashboardPage() {
  const { currentUser, scopeDonViId } = useAuth()
  const navigate = useNavigate()
  const [capHoc, setCapHoc] = useState('ALL')
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && isDangCongTac(v) && (!scopeDonViId || v.donViId === scopeDonViId)), [allVienChucs, scopeDonViId])
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const allDeXuats = useDeXuatStore((s) => s.deXuats)
  const deXuats = useMemo(() => allDeXuats.filter((d) => !scopeDonViId || d.donViId === scopeDonViId), [allDeXuats, scopeDonViId])
  const salaryAlerts = useSalaryAlerts(scopeDonViId, 90)
  const [retireYears, setRetireYears] = useState(3)

  // Chia 2 chiều: nhóm vị trí (hàng) × nhóm loại hình (cột). Tài khoản trường chỉ có một cấp học nên không cần lọc.
  const loaiTruong = useMemo(() => new Map(allDonVis.map((d) => [d.id, d.loai])), [allDonVis])
  const nhomCd = useMemo(() => new Map(chucDanhs.map((c) => [c.id, c.nhom])), [chucDanhs])
  const nhanSu = useMemo(
    () => (capHoc === 'ALL' || scopeDonViId ? vienChucs : vienChucs.filter((v) => loaiTruong.get(v.donViId) === capHoc))
      .map((v) => ({ v, nhom: nhomViTri(v, nhomCd.get(v.chucDanhId)), loaiHinh: nhomLoaiHinh(v.loaiLaoDong) })),
    [vienChucs, capHoc, scopeDonViId, loaiTruong, nhomCd],
  )

  const coCau = useMemo(() => {
    const dem = {} as Record<NhomViTri, Record<NhomLoaiHinh, number>>
    for (const n of NHOM_VI_TRI) dem[n.key] = { BIEN_CHE: 0, HD_235: 0, HD_TRUONG: 0, HD_KHAC: 0 }
    for (const x of nhanSu) dem[x.nhom][x.loaiHinh]++
    return dem
  }, [nhanSu])
  const tongNhom = (n: NhomViTri) => NHOM_LOAI_HINH.reduce((s, l) => s + coCau[n][l.key], 0)
  const tongLoaiHinh = (l: NhomLoaiHinh) => NHOM_VI_TRI.reduce((s, n) => s + coCau[n.key][l], 0)

  // Mở danh sách hồ sơ đúng ô vừa bấm
  const moDanhSach = (nhom?: NhomViTri, loaiHinh?: NhomLoaiHinh) => {
    const q = new URLSearchParams()
    if (nhom) q.set('nhom', nhom)
    if (loaiHinh) q.set('loaiHinh', loaiHinh)
    if (capHoc !== 'ALL' && !scopeDonViId) q.set('capHoc', capHoc)
    navigate(`/vien-chuc?${q.toString()}`)
  }

  const bySchoolData = useMemo(() => {
    const sorted = [...donVis]
      .filter((d) => capHoc === 'ALL' || d.loai === capHoc)
      .sort((a, b) => {
        const oa = LOAI_ORDER[a.loai] ?? 99
        const ob = LOAI_ORDER[b.loai] ?? 99
        if (oa !== ob) return oa - ob
        return a.ten.localeCompare(b.ten, 'vi')
      })
    return sorted.map((dv) => {
      const row: Record<string, string | number> = { name: dv.ten.replace('Trường ', '').replace('Trường THCS ', 'THCS ') }
      let total = 0
      for (const n of NHOM_VI_TRI) {
        const c = nhanSu.filter((x) => x.v.donViId === dv.id && x.nhom === n.key).length
        row[n.key] = c
        total += c
      }
      row.total = total
      return row
    }).filter((d) => (d.total as number) > 0)
  }, [donVis, nhanSu, capHoc])

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

      {/* Cơ cấu nhân sự theo nhóm vị trí — 5 nhóm không trùng nhau, cộng lại bằng tổng lao động */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 8px', flexWrap: 'wrap', gap: 8 }}>
        <Text strong style={{ fontSize: 15 }}>
          Cơ cấu nhân sự{capHoc !== 'ALL' && !scopeDonViId ? ` — ${CAP_HOC.find((c) => c.value === capHoc)?.label}` : ''}
          <Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}> ({nhanSu.length} người)</Text>
        </Text>
        {!scopeDonViId && <Segmented size="small" options={CAP_HOC} value={capHoc} onChange={(v) => setCapHoc(String(v))} />}
      </div>
      <Row gutter={[12, 12]}>
        {NHOM_VI_TRI.map((n) => {
          const tong = tongNhom(n.key)
          const bienChe = coCau[n.key].BIEN_CHE
          return (
            <Col key={n.key} flex="1 1 170px">
              <Card
                size="small"
                className="kpi-card"
                hoverable
                onClick={() => moDanhSach(n.key)}
                style={{ borderTop: `3px solid ${n.mau}`, height: '100%' }}
              >
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{n.ten}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: n.mau, fontVariantNumeric: 'tabular-nums' }}>{tong}</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Biên chế {bienChe} · Hợp đồng {tong - bienChe}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{n.moTa}</div>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={12}>
          <Card title="Bảng cơ cấu: nhóm vị trí × loại hình" size="small" className="chart-card">
            <Table<{ key: string; ten: string; mau: string }>
              size="small"
              pagination={false}
              bordered
              scroll={{ x: 'max-content' }}
              rowKey="key"
              dataSource={[...NHOM_VI_TRI.map((n) => ({ key: n.key, ten: n.ten, mau: n.mau })), { key: 'TONG', ten: 'Tổng cộng', mau: '' }]}
              rowClassName={(r) => (r.key === 'TONG' ? 'dash-tong-row' : '')}
              columns={[
                {
                  title: 'Nhóm vị trí', dataIndex: 'ten', key: 'ten', onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
                  render: (v: string, r) => r.key === 'TONG'
                    ? <b>{v}</b>
                    : <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: r.mau, marginRight: 6 }} />{v}</span>,
                },
                ...NHOM_LOAI_HINH.map((l) => ({
                  title: <span title={l.ten} style={{ whiteSpace: 'nowrap' }}>{l.tenNgan}</span>, key: l.key, align: 'right' as const, width: 78,
                  render: (_: unknown, r: { key: string }) => {
                    const so = r.key === 'TONG' ? tongLoaiHinh(l.key) : coCau[r.key as NhomViTri][l.key]
                    if (!so) return <Text type="secondary">–</Text>
                    return <a onClick={() => moDanhSach(r.key === 'TONG' ? undefined : (r.key as NhomViTri), l.key)}>{so}</a>
                  },
                })),
                {
                  title: 'Tổng', key: 'tong', align: 'right' as const, width: 70,
                  render: (_: unknown, r: { key: string }) => {
                    const so = r.key === 'TONG' ? nhanSu.length : tongNhom(r.key as NhomViTri)
                    return <a onClick={() => moDanhSach(r.key === 'TONG' ? undefined : (r.key as NhomViTri))}><b>{so}</b></a>
                  },
                },
              ]}
            />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Bấm vào số để mở danh sách hồ sơ tương ứng. Nhân viên được chia nhóm theo ô <i>Công việc cụ thể</i> trong hồ sơ.
            </Text>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Nhân sự theo đơn vị trường" size="small" className="chart-card">
            <ResponsiveContainer width="100%" height={Math.max(260, bySchoolData.length * 26 + 40)}>
              <BarChart data={bySchoolData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: 'rgba(37,99,235,0.06)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
                {NHOM_VI_TRI.map((n, i) => (
                  <Bar
                    key={n.key}
                    dataKey={n.key}
                    name={n.ten}
                    stackId="nhom"
                    fill={n.mau}
                    radius={i === NHOM_VI_TRI.length - 1 ? [0, 3, 3, 0] : undefined}
                  />
                ))}
              </BarChart>
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
      <style>{`.dash-tong-row td { background: #f0f5ff !important; font-weight: 600; }`}</style>
    </div>
  )
}
