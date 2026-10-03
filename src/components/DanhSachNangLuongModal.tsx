import { useMemo, useState } from 'react'
import { Modal, Table, Tag, Input, Select, Segmented, Space, Button, Typography, Tooltip } from 'antd'
import { SearchOutlined, DownloadOutlined, FileAddOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { SalaryAlert } from '@/hooks/useSalaryAlerts'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { getReviewUrgencyColor } from '@/utils/calculations'
import { formatDate, matchSearch } from '@/utils/helpers'
import { exportToExcel } from '@/utils/exportExcel'
import { laBacCuoi } from '@/utils/nangLuong'

const { Text } = Typography

type LocHan = 'TAT_CA' | 'QUA_HAN' | 'TRONG_30' | 'TU_31_90'

const trangThaiHan = (days: number) => (days < 0 ? 'Đã quá hạn' : days <= 30 ? 'Trong 30 ngày' : 'Trong 90 ngày')

/** Danh sách đầy đủ viên chức đến kỳ nâng lương (mở khi bấm số tổng ở thẻ cảnh báo trang Tổng quan) */
export default function DanhSachNangLuongModal({ open, onClose, alerts }: {
  open: boolean; onClose: () => void; alerts: SalaryAlert[]
}) {
  const navigate = useNavigate()
  const { scopeDonViId, hasPermission } = useAuth()
  const bacLuongs = useDanhMucStore((s) => s.bacLuongs)
  const [tim, setTim] = useState('')
  const [donVi, setDonVi] = useState<string | undefined>()
  const [han, setHan] = useState<LocHan>('TAT_CA')

  // Người ở bậc cuối không nâng bậc mà xét phụ cấp thâm niên vượt khung - đánh dấu để khỏi lập nhầm phiếu
  const ds = useMemo(
    () => alerts.map((a) => ({ ...a, bacCuoi: laBacCuoi(a.chucDanhId, a.bac, bacLuongs) })),
    [alerts, bacLuongs],
  )

  const dsDonVi = useMemo(
    () => [...new Map(ds.map((a) => [a.donViId, a.donViTen])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'vi'))
      .map(([value, label]) => ({ value, label })),
    [ds],
  )

  const dem = {
    TAT_CA: ds.length,
    QUA_HAN: ds.filter((a) => a.daysLeft < 0).length,
    TRONG_30: ds.filter((a) => a.daysLeft >= 0 && a.daysLeft <= 30).length,
    TU_31_90: ds.filter((a) => a.daysLeft > 30).length,
  }

  const loc = ds
    .filter((a) => !donVi || a.donViId === donVi)
    .filter((a) => han === 'TAT_CA'
      || (han === 'QUA_HAN' && a.daysLeft < 0)
      || (han === 'TRONG_30' && a.daysLeft >= 0 && a.daysLeft <= 30)
      || (han === 'TU_31_90' && a.daysLeft > 30))
    .filter((a) => !tim || matchSearch(`${a.hoTen} ${a.donViTen} ${a.chucDanhTen}`, tim))

  const xuat = () => exportToExcel(loc.map((a, i) => ({
    'STT': i + 1,
    'Họ và tên': a.hoTen,
    'Đơn vị': a.donViTen,
    'Chức danh': a.chucDanhTen,
    'Bậc': a.bac,
    'Hệ số': a.heSoHienTai,
    'Ngày nâng lương': formatDate(a.ngayNangLuongTiepTheo),
    'Còn (ngày)': a.daysLeft,
    'Tình trạng': trangThaiHan(a.daysLeft),
    'Ghi chú': a.bacCuoi ? 'Bậc cuối - xét PC thâm niên vượt khung' : '',
  })), 'Den-ky-nang-luong', 'Đến kỳ nâng lương')

  const coTheLapPhieu = hasPermission('deXuat', 'write')

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1080}
      title={`Viên chức đến kỳ nâng lương trong 90 ngày (${ds.length} người)`}
      destroyOnHidden
    >
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Segmented<LocHan>
            value={han}
            onChange={setHan}
            options={[
              { value: 'TAT_CA', label: `Tất cả (${dem.TAT_CA})` },
              { value: 'QUA_HAN', label: `Đã quá hạn (${dem.QUA_HAN})` },
              { value: 'TRONG_30', label: `Trong 30 ngày (${dem.TRONG_30})` },
              { value: 'TU_31_90', label: `31-90 ngày (${dem.TU_31_90})` },
            ]}
          />
          {!scopeDonViId && (
            <Select allowClear placeholder="Tất cả trường" style={{ width: 210 }} value={donVi} onChange={setDonVi} options={dsDonVi} showSearch optionFilterProp="label" />
          )}
          <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm họ tên, chức danh" style={{ width: 210 }} value={tim} onChange={(e) => setTim(e.target.value)} />
        </Space>
        <Space wrap>
          {coTheLapPhieu && (
            <Tooltip title="Mở trang lập phiếu Nâng bậc lương thường xuyên - chọn đợt và người trong bảng gợi ý">
              <Button icon={<FileAddOutlined />} onClick={() => { onClose(); navigate('/de-xuat/new?loai=NANG_BAC') }}>Lập phiếu nâng bậc</Button>
            </Tooltip>
          )}
          <Button icon={<DownloadOutlined />} onClick={xuat} disabled={!loc.length}>Xuất Excel</Button>
        </Space>
      </Space>
      <Table<(typeof ds)[number]>
        size="small"
        bordered
        rowKey="vienChucId"
        dataSource={loc}
        scroll={{ x: 900, y: 520 }}
        pagination={loc.length > 50 ? { pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} người` } : false}
        columns={[
          { title: 'STT', key: 'stt', width: 55, align: 'center', render: (_, __, i) => i + 1 },
          {
            title: 'Viên chức', dataIndex: 'hoTen', key: 'ten', width: 200,
            render: (v: string, r) => <a onClick={() => { onClose(); navigate(`/vien-chuc/${r.vienChucId}`) }}>{v}</a>,
          },
          ...(scopeDonViId ? [] : [{ title: 'Đơn vị', dataIndex: 'donViTen', key: 'dv', width: 180 }]),
          { title: 'Chức danh', dataIndex: 'chucDanhTen', key: 'cd', width: 190, ellipsis: true },
          {
            title: 'Bậc - hệ số', key: 'bac', width: 110, align: 'center',
            render: (_, r) => (
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {r.bac} - {r.heSoHienTai.toFixed(2)}
                {r.bacCuoi && <div><Tag color="purple" style={{ margin: 0, fontSize: 11 }}>Bậc cuối</Tag></div>}
              </span>
            ),
          },
          {
            title: 'Ngày nâng lương', key: 'ngay', width: 190,
            sorter: (a, b) => a.daysLeft - b.daysLeft,
            defaultSortOrder: 'ascend',
            render: (_, r) => (
              <Text style={{ color: getReviewUrgencyColor(r.daysLeft), fontVariantNumeric: 'tabular-nums' }}>
                {formatDate(r.ngayNangLuongTiepTheo)} ({r.daysLeft >= 0 ? `còn ${r.daysLeft} ngày` : `quá ${-r.daysLeft} ngày`})
              </Text>
            ),
          },
        ]}
      />
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 8 }}>
        Người có nhãn <Tag color="purple" style={{ fontSize: 11 }}>Bậc cuối</Tag> đã ở bậc cao nhất của ngạch: không nâng bậc mà xét phụ cấp thâm niên vượt khung.
        Bấm họ tên để mở hồ sơ.
      </Text>
    </Modal>
  )
}
