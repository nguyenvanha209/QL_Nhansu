import { useMemo, useState } from 'react'
import { Table, Card, Typography, Tag, Input, Select, Space, Tooltip, Badge } from 'antd'
import { SearchOutlined, WarningOutlined } from '@ant-design/icons'
import { useLuongStore } from '@/store/luongStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { useSalaryAlerts } from '@/hooks/useSalaryAlerts'
import { getDaysUntilReview, getReviewUrgencyColor, formatVND, getLuongChinh } from '@/utils/calculations'
import { matchSearch, formatDate } from '@/utils/helpers'
import { LY_DO_LABELS } from '@/types/luong'

const { Title, Text } = Typography

export default function HeSoLuongPage() {
  const { scopeDonViId } = useAuth()
  const [search, setSearch] = useState('')
  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)

  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)

  const alerts = useSalaryAlerts(scopeDonViId, 90)

  const data = useMemo(() => {
    return heSoLuongs
      .filter((h) => h.isActive)
      .map((h) => {
        const vc = vienChucs.find((v) => v.id === h.vienChucId)
        const dv = donVis.find((d) => d.id === vc?.donViId)
        const cd = chucDanhs.find((c) => c.id === h.chucDanhId)
        const days = getDaysUntilReview(h.ngayNangLuongTiepTheo)
        return { ...h, hoTen: vc ? `${vc.ho} ${vc.ten}` : '', donViId: vc?.donViId ?? '', donViTen: dv?.ten ?? '', chucDanhTen: cd?.ten ?? '', days }
      })
      .filter((r) => {
        if (scopeDonViId && r.donViId !== scopeDonViId) return false
        if (filterDonVi && r.donViId !== filterDonVi) return false
        if (search) return matchSearch(r.hoTen, search)
        return true
      })
      .sort((a, b) => a.days - b.days)
  }, [heSoLuongs, vienChucs, donVis, chucDanhs, filterDonVi, search, scopeDonViId])

  const columns = [
    {
      title: 'Viên chức', dataIndex: 'hoTen', key: 'ht', ellipsis: true,
      render: (v: string, r: any) => (
        <span>
          {r.days <= 90 && <Badge status="warning" style={{ marginRight: 4 }} />}
          {v}
        </span>
      ),
    },
    { title: 'Đơn vị', dataIndex: 'donViTen', key: 'dv', ellipsis: true, responsive: ['lg' as const] },
    { title: 'Chức danh', dataIndex: 'chucDanhTen', key: 'cd', ellipsis: true },
    { title: 'Bậc', dataIndex: 'bac', key: 'bac', width: 60, align: 'center' as const },
    { title: 'Hệ số', dataIndex: 'heSo', key: 'hs', width: 80, align: 'center' as const },
    { title: 'Lương chính', key: 'lc', width: 130, render: (_: any, r: any) => formatVND(getLuongChinh(r.heSo)) },
    { title: 'Ngày hiệu lực', dataIndex: 'ngayHieuLuc', key: 'nhl', width: 110, render: (v: string) => formatDate(v) },
    {
      title: 'Ngày nâng lương tiếp theo', dataIndex: 'ngayNangLuongTiepTheo', key: 'nnt', width: 180,
      render: (v: string, r: any) => (
        <Tooltip title={r.days <= 0 ? 'Đã quá hạn' : r.days <= 30 ? 'Rất gấp' : r.days <= 90 ? 'Sắp đến' : undefined}>
          <Text style={{ color: getReviewUrgencyColor(r.days) }}>
            {r.days <= 90 && <WarningOutlined style={{ marginRight: 4 }} />}
            {formatDate(v)}
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
              ({r.days > 0 ? `còn ${r.days} ngày` : `quá ${-r.days} ngày`})
            </Text>
          </Text>
        </Tooltip>
      ),
    },
    { title: 'Lý do', dataIndex: 'lyDo', key: 'ld', render: (v: string) => LY_DO_LABELS[v as keyof typeof LY_DO_LABELS] ?? v },
  ]

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Hệ số lương
          {alerts.length > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{alerts.length} sắp đến kỳ nâng</Tag>}
        </Title>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input prefix={<SearchOutlined />} placeholder="Tìm viên chức..." style={{ width: 220 }} value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
        {!scopeDonViId && (
          <Select placeholder="Lọc theo đơn vị" style={{ width: 200 }} value={filterDonVi} onChange={setFilterDonVi} allowClear options={donVis.map((d) => ({ value: d.id, label: d.ten }))} />
        )}
      </Space>

      <Table dataSource={data} columns={columns} rowKey="id" size="small" scroll={{ x: 900 }}
        rowClassName={(r) => r.days <= 30 ? 'ant-table-row-danger' : r.days <= 90 ? 'ant-table-row-warning' : ''}
        pagination={{ pageSize: 20, showTotal: (t) => `Tổng ${t} bản ghi` }}
      />
    </Card>
  )
}
