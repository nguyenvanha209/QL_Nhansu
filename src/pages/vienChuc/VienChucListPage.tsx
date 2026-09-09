import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Input, Select, Space, Tag, Typography, Card, Tooltip, Popconfirm, App } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, EyeOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { matchSearch, formatDate } from '@/utils/helpers'
import { LOAI_LAO_DONG_LABELS, VTVL_LABELS, TRANG_THAI_CONG_TAC_LABELS } from '@/types/vienChuc'
import type { TrangThaiCongTac } from '@/types/vienChuc'
import ImportVienChucModal, { ExportExcelButton } from './ImportVienChucModal'

const TRANG_THAI_COLORS: Record<TrangThaiCongTac, string> = {
  DANG_LAM_VIEC: 'green',
  CHUYEN_DEN: 'blue',
  CHUYEN_DI: 'orange',
  NGHI_HUU: 'purple',
  THOI_VIEC: 'default',
}

const { Title } = Typography

export default function VienChucListPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { scopeDonViId, hasPermission } = useAuth()
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const softDelete = useVienChucStore((s) => s.softDelete)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const vtvls = useDanhMucStore((s) => s.vtvls)

  const [search, setSearch] = useState('')
  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)
  const [filterLoai, setFilterLoai] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [importOpen, setImportOpen] = useState(false)

  const data = useMemo(() => {
    let list = allVienChucs.filter((v) => v.active && (!scopeDonViId || v.donViId === scopeDonViId))
    if (filterDonVi) list = list.filter((v) => v.donViId === filterDonVi)
    if (filterLoai) list = list.filter((v) => v.loaiLaoDong === filterLoai)
    if (filterTrangThai) list = list.filter((v) => (v.trangThai ?? 'DANG_LAM_VIEC') === filterTrangThai)
    if (search) list = list.filter((v) => matchSearch(`${v.ho} ${v.ten} ${v.ma}`, search))
    return list
  }, [allVienChucs, scopeDonViId, filterDonVi, filterLoai, filterTrangThai, search])

  const canWrite = hasPermission('vienChuc', 'write')

  const columns = [
    { title: 'Mã VC', dataIndex: 'ma', key: 'ma', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: 'Họ và tên', key: 'hoTen', ellipsis: true,
      render: (_: any, r: any) => (
        <Button type="link" onClick={() => navigate(`/vien-chuc/${r.id}`)} style={{ padding: 0 }}>
          {r.ho} {r.ten}
        </Button>
      ),
    },
    { title: 'Ngày sinh', dataIndex: 'ngaySinh', key: 'ns', width: 110, render: (v: string) => formatDate(v) },
    { title: 'Giới tính', dataIndex: 'gioiTinh', key: 'gt', width: 80, render: (v: string) => v === 'NAM' ? 'Nam' : 'Nữ' },
    {
      title: 'Đơn vị', dataIndex: 'donViId', key: 'dv', ellipsis: true,
      render: (id: string) => donVis.find((d) => d.id === id)?.ten ?? id,
    },
    {
      title: 'Chức danh', dataIndex: 'chucDanhId', key: 'cd', ellipsis: true,
      render: (id: string) => chucDanhs.find((c) => c.id === id)?.ten ?? id,
    },
    {
      title: 'Loại hình', dataIndex: 'loaiLaoDong', key: 'll',
      render: (v: string) => <Tag color={v === 'VIEN_CHUC' ? 'blue' : v === 'TAP_SU' ? 'cyan' : 'default'}>{LOAI_LAO_DONG_LABELS[v as keyof typeof LOAI_LAO_DONG_LABELS] ?? v}</Tag>,
    },
    {
      title: 'VTVL', dataIndex: 'vtvl', key: 'vtvl', width: 130,
      render: (v?: string) => v ? <Tag color={v === 'CBQL' ? 'gold' : v === 'GIAO_VIEN' ? 'blue' : 'default'}>{vtvls.find((x) => x.ma === v)?.ten ?? VTVL_LABELS[v as keyof typeof VTVL_LABELS] ?? v}</Tag> : '—',
    },
    {
      title: 'Trạng thái', dataIndex: 'trangThai', key: 'trangThai', width: 130,
      render: (v?: TrangThaiCongTac) => {
        const key = v ?? 'DANG_LAM_VIEC'
        return <Tag color={TRANG_THAI_COLORS[key]}>{TRANG_THAI_CONG_TAC_LABELS[key]}</Tag>
      },
    },
    {
      title: 'Thao tác', key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/vien-chuc/${r.id}`)} />
          </Tooltip>
          {canWrite && (
            <Tooltip title="Chỉnh sửa">
              <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/vien-chuc/${r.id}/edit`)} />
            </Tooltip>
          )}
          {canWrite && (
            <Popconfirm title="Xác nhận xóa?" onConfirm={() => { softDelete(r.id); message.success('Đã xóa') }}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Danh sách viên chức ({data.length})</Title>
        <Space>
          <ExportExcelButton vienChucs={data} />
          {canWrite && (
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Nhập từ Excel
            </Button>
          )}
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/vien-chuc/new')}>
              Thêm viên chức
            </Button>
          )}
        </Space>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Tìm kiếm họ tên, mã VC..."
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        {!scopeDonViId && (
          <Select
            placeholder="Chọn đơn vị trường"
            style={{ width: 200 }}
            value={filterDonVi}
            onChange={setFilterDonVi}
            allowClear
            options={donVis.map((d) => ({ value: d.id, label: d.ten }))}
          />
        )}
        <Select
          placeholder="Loại hình lao động"
          style={{ width: 180 }}
          value={filterLoai}
          onChange={setFilterLoai}
          allowClear
          options={Object.entries(LOAI_LAO_DONG_LABELS).map(([k, v]) => ({ value: k, label: v }))}
        />
        <Select
          placeholder="Trạng thái"
          style={{ width: 160 }}
          value={filterTrangThai}
          onChange={setFilterTrangThai}
          allowClear
          options={Object.entries(TRANG_THAI_CONG_TAC_LABELS).map(([k, v]) => ({ value: k, label: v }))}
        />
      </Space>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Tổng ${t} bản ghi` }}
      />

      <ImportVienChucModal open={importOpen} onClose={() => setImportOpen(false)} />
    </Card>
  )
}
