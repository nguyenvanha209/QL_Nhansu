import { useMemo, useState } from 'react'
import { Card, Table, Select, Space, Tag, Typography, Statistic, Row, Col, Tabs, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DaNghiHuu from './DaNghiHuu'
import { ClockCircleOutlined, FileExcelOutlined } from '@ant-design/icons'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { calcRetirementDate, calcPensionStartDate, getDaysUntilRetirement, getMonthsUntilRetirement, moTaTuoiNghiHuu } from '@/utils/retirement'
import { formatDate } from '@/utils/helpers'
import { isDangCongTac, CHUC_VU_LABELS } from '@/types/vienChuc'
import type { VienChuc } from '@/types/vienChuc'
import { laBienChe, soSanhTruong } from '@/utils/dinhMuc'
import { exportToExcel } from '@/utils/exportExcel'
import { BANG_CHUAN, phanTrang, cotSTT, cotHoTen, cotNgay, cotChu, cotGiua, tenGioiTinh } from '@/utils/cotBang'

const { Title, Text } = Typography

const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

type Dong = VienChuc & {
  days: number; months: number; tuoiNghiHuu: string; retireDate: string; pensionDate: string
  donViTen: string; chucDanhTen: string; maNgach: string
}

const mucDo = (days: number) =>
  days <= 90 ? { ten: 'Rất gấp', mau: 'red' } : days <= 180 ? { ten: 'Gấp', mau: 'orange' } : days <= 365 ? { ten: 'Cần chuẩn bị', mau: 'gold' } : { ten: 'Theo dõi', mau: 'default' }

export default function DuBaoNghiHuuPage() {
  const navigate = useNavigate()
  const { scopeDonViId, hasPermission } = useAuth()
  const [years, setYears] = useState(3)
  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)

  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && laBienChe(v) && isDangCongTac(v) && (!scopeDonViId || v.donViId === scopeDonViId)), [allVienChucs, scopeDonViId])
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active).sort(soSanhTruong), [allDonVis])
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)

  const data = useMemo<Dong[]>(() => {
    // Mốc tính theo ngày thật, không quy đổi 365 ngày/năm (lệch do năm nhuận)
    const homNay = new Date()
    const mocCuoi = new Date(homNay.getFullYear() + years, homNay.getMonth(), homNay.getDate())
    return vienChucs
      .map((vc) => {
        const gt = vc.gioiTinh as 'NAM' | 'NU'
        const dv = donVis.find((d) => d.id === vc.donViId)
        const cd = chucDanhs.find((c) => c.id === vc.chucDanhId)
        return {
          ...vc,
          days: getDaysUntilRetirement(vc.ngaySinh, gt),
          months: getMonthsUntilRetirement(vc.ngaySinh, gt),
          tuoiNghiHuu: moTaTuoiNghiHuu(vc.ngaySinh, gt),
          retireDate: toDateStr(calcRetirementDate(vc.ngaySinh, gt)),
          pensionDate: toDateStr(calcPensionStartDate(vc.ngaySinh, gt)),
          donViTen: dv?.ten ?? '',
          chucDanhTen: cd?.ten ?? '',
          maNgach: cd?.ma ?? '',
        }
      })
      .filter((r) => {
        if (r.days < 0 || new Date(r.retireDate) > mocCuoi) return false
        if (filterDonVi && r.donViId !== filterDonVi) return false
        return true
      })
      .sort((a, b) => a.days - b.days)
  }, [vienChucs, donVis, chucDanhs, years, filterDonVi])

  const urgentCount = data.filter((r) => r.days <= 180).length

  // Theo quy chuẩn bảng (utils/cotBang): mọi cột có độ rộng, Họ và tên ghim trái
  const columns: ColumnsType<Dong> = [
    cotSTT<Dong>(),
    cotHoTen<Dong>(hasPermission('vienChuc', 'read') ? (r) => navigate(`/vien-chuc/${r.id}`) : undefined),
    cotNgay<Dong>('Ngày sinh', (r) => r.ngaySinh),
    cotGiua<Dong>('Giới tính', 'gt', 75, (r) => tenGioiTinh(r.gioiTinh)),
    cotChu<Dong>('Đơn vị', (r) => r.donViTen, 190, { sapXep: true }),
    cotChu<Dong>('Chức danh', (r) => r.chucDanhTen, 220, { phu: (r) => r.maNgach }),
    cotGiua<Dong>('Chức vụ', 'cv', 100, (r) => (r.chucVu ? CHUC_VU_LABELS[r.chucVu] ?? r.chucVu : '')),
    // Tuổi nghỉ hưu theo lộ trình để đối chiếu thẳng với Phụ lục I/II NĐ 135
    cotGiua<Dong>('Tuổi nghỉ hưu', 'tnh', 130, (r) => <Text type="secondary">{r.tuoiNghiHuu}</Text>),
    cotNgay<Dong>('Thời điểm nghỉ hưu', (r) => r.retireDate, { dam: true, width: 115, sapXep: true }),
    cotNgay<Dong>('Hưởng chế độ hưu trí từ', (r) => r.pensionDate, { width: 115 }),
    cotGiua<Dong>('Còn lại', 'months', 90, (r) => (
      <Tag color={r.days <= 180 ? 'red' : r.days <= 365 ? 'orange' : 'blue'} style={{ marginInlineEnd: 0 }}>{r.months} tháng</Tag>
    ), (a, b) => a.days - b.days),
    cotGiua<Dong>('Mức độ', 'level', 120, (r) => {
      const m = mucDo(r.days)
      return <Tag color={m.mau} style={{ marginInlineEnd: 0 }}>{m.ten}</Tag>
    }),
  ]

  const xuat = () => exportToExcel(
    data.map((r, i) => ({
      STT: i + 1, 'Họ và tên': `${r.ho} ${r.ten}`, 'Ngày sinh': formatDate(r.ngaySinh), 'Giới tính': tenGioiTinh(r.gioiTinh),
      'Đơn vị': r.donViTen, 'Chức danh': r.chucDanhTen, 'Mã ngạch': r.maNgach, 'Chức vụ': r.chucVu ? CHUC_VU_LABELS[r.chucVu] ?? r.chucVu : '',
      'Tuổi nghỉ hưu': r.tuoiNghiHuu, 'Thời điểm nghỉ hưu': formatDate(r.retireDate), 'Hưởng chế độ hưu trí từ': formatDate(r.pensionDate),
      'Còn lại (tháng)': r.months, 'Mức độ': mucDo(r.days).ten,
    })),
    'Du_bao_nghi_huu', 'Dự báo nghỉ hưu', [`DANH SÁCH VIÊN CHỨC DỰ KIẾN NGHỈ HƯU TRONG ${years} NĂM`],
  )

  const [params, setParams] = useSearchParams()
  const the = params.get('tab') === 'da-nghi' ? 'da-nghi' : 'du-bao'

  const duBao = (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Statistic title={`Nghỉ hưu trong ${years} năm`} value={data.length} prefix={<ClockCircleOutlined />} styles={{ content: { color: data.length > 0 ? '#f5222d' : '#52c41a' } }} /></Col>
        <Col xs={24} sm={8}><Statistic title="Cần chuẩn bị gấp (≤ 6 tháng)" value={urgentCount} styles={{ content: { color: urgentCount > 0 ? '#fa8c16' : '#52c41a' } }} /></Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Space wrap>
          <Select value={years} onChange={setYears} style={{ width: 140 }} options={[{ value: 1, label: 'Trong 1 năm' }, { value: 3, label: 'Trong 3 năm' }, { value: 5, label: 'Trong 5 năm' }]} />
          {!scopeDonViId && (
            <Select placeholder="Tất cả đơn vị" style={{ width: 230 }} value={filterDonVi} onChange={setFilterDonVi} allowClear showSearch optionFilterProp="label" options={donVis.map((d) => ({ value: d.id, label: d.ten }))} />
          )}
        </Space>
        <Button icon={<FileExcelOutlined />} onClick={xuat} disabled={!data.length}>Xuất Excel</Button>
      </div>

      <Table<Dong>
        {...BANG_CHUAN}
        dataSource={data}
        columns={columns}
        rowKey="id"
        pagination={phanTrang('viên chức dự kiến nghỉ hưu')}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
        Thời điểm nghỉ hưu theo tuổi nghỉ hưu tại Nghị định 135/2020/NĐ-CP (theo tháng, năm sinh); hưởng chế độ hưu trí từ ngày đầu tháng liền kề.
        Mức độ: rất gấp ≤ 3 tháng, gấp ≤ 6 tháng, cần chuẩn bị ≤ 12 tháng.
      </Text>
    </>
  )

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 0 }}>Dự báo nghỉ hưu</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Chỉ tính viên chức biên chế (viên chức, tập sự); không tính lao động hợp đồng.</Text>
      <Tabs
        activeKey={the}
        onChange={(k) => setParams(k === 'da-nghi' ? { tab: 'da-nghi' } : {}, { replace: true })}
        items={[
          { key: 'du-bao', label: 'Dự báo nghỉ hưu', children: duBao },
          { key: 'da-nghi', label: 'Viên chức đã nghỉ hưu', children: <DaNghiHuu /> },
        ]}
      />
    </Card>
  )
}
