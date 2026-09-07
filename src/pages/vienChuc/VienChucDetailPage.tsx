import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Button, Tabs, Table, Typography, Space, Timeline, Result } from 'antd'
import { EditOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { LOAI_LAO_DONG_LABELS } from '@/types/vienChuc'
import { LY_DO_LABELS } from '@/types/luong'
import { formatDate } from '@/utils/helpers'
import { formatVND, getLuongChinh } from '@/utils/calculations'

const { Title, Text } = Typography

export default function VienChucDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission, scopeDonViId } = useAuth()
  const getById = useVienChucStore((s) => s.getById)
  const vc = getById(id!)
  const donVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const allHeSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const allPhuCaps = useLuongStore((s) => s.phuCapVienChucs)
  const allLichSu = useLuongStore((s) => s.lichSuBienDongs)
  const heSoHistory = allHeSoLuongs.filter((h) => h.vienChucId === id).sort((a, b) => b.ngayHieuLuc.localeCompare(a.ngayHieuLuc))
  const activePhuCaps = allPhuCaps.filter((p) => p.vienChucId === id && p.isActive)
  const lichSu = allLichSu.filter((l) => l.vienChucId === id).sort((a, b) => b.ngayThayDoi.localeCompare(a.ngayThayDoi))
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)

  if (!vc) return <Result status="404" title="Không tìm thấy viên chức" extra={<Button onClick={() => navigate('/vien-chuc')}>Quay lại</Button>} />
  if (scopeDonViId && vc.donViId !== scopeDonViId) return <Result status="403" title="Không có quyền xem" />

  const donVi = donVis.find((d) => d.id === vc.donViId)
  const chucDanh = chucDanhs.find((c) => c.id === vc.chucDanhId)
  const activeHeSo = heSoHistory.find((h) => h.isActive)

  const heSoCols = [
    { title: 'Bậc', dataIndex: 'bac', key: 'bac', width: 60 },
    { title: 'Hệ số', dataIndex: 'heSo', key: 'heSo', width: 80 },
    { title: 'Ngày hiệu lực', dataIndex: 'ngayHieuLuc', key: 'nhl', render: (v: string) => formatDate(v) },
    { title: 'Ngày nâng tiếp', dataIndex: 'ngayNangLuongTiepTheo', key: 'nnt', render: (v: string) => formatDate(v) },
    { title: 'Lý do', dataIndex: 'lyDo', key: 'ld', render: (v: string) => LY_DO_LABELS[v as keyof typeof LY_DO_LABELS] ?? v },
    { title: 'Trạng thái', dataIndex: 'isActive', key: 'ts', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang áp dụng' : 'Lịch sử'}</Tag> },
  ]

  const phuCapCols = [
    { title: 'Loại phụ cấp', dataIndex: 'loaiPhuCapId', key: 'lpc', render: (id: string) => loaiPhuCaps.find((l) => l.id === id)?.ten ?? id },
    { title: 'Tỷ lệ/Mức', dataIndex: 'loaiPhuCapId', key: 'tl', render: (id: string) => { const lpc = loaiPhuCaps.find((l) => l.id === id); return lpc ? `${lpc.giaTri}${lpc.loaiCongThuc !== 'TIEN_MAT' ? '%' : 'đ'}` : '' } },
    { title: 'Ngày hiệu lực', dataIndex: 'ngayHieuLuc', key: 'nhl', render: (v: string) => formatDate(v) },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/vien-chuc')}>Quay lại</Button>
        {hasPermission('vienChuc', 'write') && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/vien-chuc/${vc.id}/edit`)}>Chỉnh sửa</Button>
        )}
      </Space>

      <Card title={<><Tag color="blue">{vc.ma}</Tag> {vc.ho} {vc.ten}</>}>
        <Tabs items={[
          {
            key: '1', label: 'Hồ sơ',
            children: (
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                <Descriptions.Item label="Họ và tên">{vc.ho} {vc.ten}</Descriptions.Item>
                <Descriptions.Item label="Ngày sinh">{formatDate(vc.ngaySinh)}</Descriptions.Item>
                <Descriptions.Item label="Giới tính">{vc.gioiTinh === 'NAM' ? 'Nam' : 'Nữ'}</Descriptions.Item>
                <Descriptions.Item label="CCCD">{vc.cccd ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Điện thoại">{vc.dienThoai ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Đơn vị">{donVi?.ten ?? vc.donViId}</Descriptions.Item>
                <Descriptions.Item label="Chức danh">{chucDanh?.ten ?? vc.chucDanhId}</Descriptions.Item>
                <Descriptions.Item label="Loại hình">{LOAI_LAO_DONG_LABELS[vc.loaiLaoDong]}</Descriptions.Item>
                <Descriptions.Item label="Ngày vào ngành">{formatDate(vc.ngayVaoNganh)}</Descriptions.Item>
                <Descriptions.Item label="Ngày vào đơn vị">{formatDate(vc.ngayVaoDonVi)}</Descriptions.Item>
                {activeHeSo && <>
                  <Descriptions.Item label="Bậc lương hiện tại">Bậc {activeHeSo.bac} — Hệ số {activeHeSo.heSo}</Descriptions.Item>
                  <Descriptions.Item label="Lương chính tham chiếu">{formatVND(getLuongChinh(activeHeSo.heSo))}</Descriptions.Item>
                  <Descriptions.Item label="Ngày nâng lương tiếp theo">
                    <Text type={new Date(activeHeSo.ngayNangLuongTiepTheo) < new Date() ? 'danger' : undefined}>
                      {formatDate(activeHeSo.ngayNangLuongTiepTheo)}
                    </Text>
                  </Descriptions.Item>
                </>}
              </Descriptions>
            ),
          },
          {
            key: '2', label: `Lịch sử lương (${heSoHistory.length})`,
            children: <Table dataSource={heSoHistory} columns={heSoCols} rowKey="id" size="small" pagination={false} />,
          },
          {
            key: '3', label: `Phụ cấp (${activePhuCaps.length})`,
            children: <Table dataSource={activePhuCaps} columns={phuCapCols} rowKey="id" size="small" pagination={false} />,
          },
          {
            key: '4', label: `Lịch sử biến động (${lichSu.length})`,
            children: (
              <Timeline items={lichSu.map((ls) => ({
                color: ls.loai === 'LUONG' ? 'blue' : ls.loai === 'CHUC_DANH' ? 'green' : 'gray',
                children: (
                  <div>
                    <Text strong>{ls.truongThayDoi}</Text>
                    <Text type="secondary"> — {formatDate(ls.ngayThayDoi)}</Text>
                    <div><Text type="secondary">Cũ: </Text>{ls.giaTriCu} → <Text type="secondary">Mới: </Text>{ls.giaTriMoi}</div>
                  </div>
                ),
              }))} />
            ),
          },
        ]} />
      </Card>
    </div>
  )
}
