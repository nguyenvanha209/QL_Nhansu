import { useMemo, useState } from 'react'
import { Card, Tabs, Table, Button, Select, Space, Typography, Statistic, Row, Col } from 'antd'
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import { useSalaryAlerts } from '@/hooks/useSalaryAlerts'
import { exportToExcel } from '@/utils/exportExcel'
import { exportToPdf } from '@/utils/exportPdf'
import { formatDate } from '@/utils/helpers'
import { LOAI_LAO_DONG_LABELS, isDangCongTac } from '@/types/vienChuc'

const { Title } = Typography

export default function BaoCaoPage() {
  const { scopeDonViId } = useAuth()
  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && isDangCongTac(v) && (!scopeDonViId || v.donViId === scopeDonViId)), [allVienChucs, scopeDonViId])
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const salaryAlerts = useSalaryAlerts(scopeDonViId, 90)

  const filtered = useMemo(() => {
    if (filterDonVi) return vienChucs.filter((v) => v.donViId === filterDonVi)
    return vienChucs
  }, [vienChucs, filterDonVi])

  const enriched = useMemo(() => filtered.map((vc) => {
    const dv = donVis.find((d) => d.id === vc.donViId)
    const cd = chucDanhs.find((c) => c.id === vc.chucDanhId)
    const hsl = heSoLuongs.find((h) => h.vienChucId === vc.id && h.isActive)
    return { ...vc, donViTen: dv?.ten ?? '', chucDanhTen: cd?.ten ?? '', bac: hsl?.bac ?? 0, heSo: hsl?.heSo ?? 0, ngayNangTiep: hsl?.ngayNangLuongTiepTheo ?? '' }
  }), [filtered, donVis, chucDanhs, heSoLuongs])

  const vcCols = [
    { title: 'Mã VC', dataIndex: 'ma', key: 'ma', width: 100 },
    { title: 'Họ và tên', key: 'ht', render: (_: any, r: any) => `${r.ho} ${r.ten}` },
    { title: 'Ngày sinh', dataIndex: 'ngaySinh', key: 'ns', render: (v: string) => formatDate(v) },
    { title: 'Giới tính', dataIndex: 'gioiTinh', key: 'gt', render: (v: string) => v === 'NAM' ? 'Nam' : 'Nữ' },
    { title: 'Đơn vị', dataIndex: 'donViTen', key: 'dv' },
    { title: 'Chức danh', dataIndex: 'chucDanhTen', key: 'cd' },
    { title: 'Loại HĐ', dataIndex: 'loaiLaoDong', key: 'll', render: (v: string) => LOAI_LAO_DONG_LABELS[v as keyof typeof LOAI_LAO_DONG_LABELS] ?? v },
    { title: 'Bậc', dataIndex: 'bac', key: 'bac' },
    { title: 'Hệ số', dataIndex: 'heSo', key: 'hs' },
    { title: 'Ngày nâng tiếp', dataIndex: 'ngayNangTiep', key: 'nnt', render: (v: string) => formatDate(v) },
    { title: 'Ngày vào ngành', dataIndex: 'ngayVaoNganh', key: 'nvn', render: (v: string) => formatDate(v) },
  ]

  const alertCols = [
    { title: 'Họ và tên', dataIndex: 'hoTen', key: 'ht' },
    { title: 'Đơn vị', dataIndex: 'donViTen', key: 'dv' },
    { title: 'Chức danh', dataIndex: 'chucDanhTen', key: 'cd' },
    { title: 'Bậc / Hệ số', key: 'bh', render: (_: any, r: any) => `Bậc ${r.bac} / ${r.heSoHienTai}` },
    { title: 'Ngày nâng lương', dataIndex: 'ngayNangLuongTiepTheo', key: 'nnt', render: (v: string) => formatDate(v) },
    { title: 'Còn lại', dataIndex: 'daysLeft', key: 'days', render: (v: number) => `${v > 0 ? v + ' ngày' : 'Quá hạn ' + (-v) + ' ngày'}` },
  ]

  const exportVCExcel = () => {
    const rows = enriched.map((r) => ({ 'Mã VC': r.ma, 'Họ tên': `${r.ho} ${r.ten}`, 'Ngày sinh': formatDate(r.ngaySinh), 'Giới tính': r.gioiTinh === 'NAM' ? 'Nam' : 'Nữ', 'Đơn vị': r.donViTen, 'Chức danh': r.chucDanhTen, 'Loại HĐ': LOAI_LAO_DONG_LABELS[r.loaiLaoDong as keyof typeof LOAI_LAO_DONG_LABELS] ?? r.loaiLaoDong, 'Bậc': r.bac, 'Hệ số': r.heSo, 'Ngày nâng tiếp': formatDate(r.ngayNangTiep) }))
    exportToExcel(rows, 'BaoCao_VienChuc', 'Viên chức')
  }

  const exportVCPdf = () => {
    exportToPdf(
      'Báo cáo tổng hợp nhân sự',
      ['Mã VC', 'Họ tên', 'Đơn vị', 'Chức danh', 'Bậc', 'Hệ số'],
      enriched.map((r) => [r.ma, `${r.ho} ${r.ten}`, r.donViTen, r.chucDanhTen, r.bac, r.heSo]),
      'BaoCao_VienChuc'
    )
  }

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 16 }}>Báo cáo & Thống kê</Title>

      <Space wrap style={{ marginBottom: 16 }}>
        {!scopeDonViId && (
          <Select placeholder="Lọc theo đơn vị" style={{ width: 220 }} value={filterDonVi} onChange={setFilterDonVi} allowClear options={donVis.map((d) => ({ value: d.id, label: d.ten }))} />
        )}
      </Space>

      <Tabs items={[
        {
          key: '1', label: `Tổng hợp nhân sự (${enriched.length})`,
          children: (
            <>
              <Space style={{ marginBottom: 12 }}>
                <Button icon={<FileExcelOutlined />} onClick={exportVCExcel}>Xuất Excel</Button>
                <Button icon={<FilePdfOutlined />} onClick={exportVCPdf}>Xuất PDF</Button>
              </Space>
              <Table dataSource={enriched} columns={vcCols} rowKey="id" size="small" scroll={{ x: 1100 }} pagination={{ pageSize: 20 }} />
            </>
          ),
        },
        {
          key: '2', label: `Sắp đến kỳ nâng lương (${salaryAlerts.length})`,
          children: (
            <>
              <Space style={{ marginBottom: 12 }}>
                <Button icon={<FileExcelOutlined />} onClick={() => {
                  const rows = salaryAlerts.map((r) => ({ 'Họ tên': r.hoTen, 'Đơn vị': r.donViTen, 'Chức danh': r.chucDanhTen, 'Bậc': r.bac, 'Hệ số': r.heSoHienTai, 'Ngày nâng lương': formatDate(r.ngayNangLuongTiepTheo), 'Còn lại (ngày)': r.daysLeft }))
                  exportToExcel(rows, 'DanhSach_SapNangLuong')
                }}>Xuất Excel</Button>
              </Space>
              <Table dataSource={salaryAlerts} columns={alertCols} rowKey="vienChucId" size="small" scroll={{ x: 700 }} pagination={{ pageSize: 20 }} />
            </>
          ),
        },
        {
          key: '3', label: 'Thống kê theo đơn vị',
          children: (
            <Row gutter={[16, 16]}>
              {donVis.map((dv) => {
                const count = vienChucs.filter((v) => v.donViId === dv.id).length
                return count > 0 ? (
                  <Col key={dv.id} xs={24} sm={12} md={8}>
                    <Card size="small">
                      <Statistic title={dv.ten} value={count} suffix="người" />
                    </Card>
                  </Col>
                ) : null
              })}
            </Row>
          ),
        },
      ]} />
    </Card>
  )
}
