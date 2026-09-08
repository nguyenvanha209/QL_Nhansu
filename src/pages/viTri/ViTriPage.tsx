import { useMemo, useState } from 'react'
import { Table, Card, Typography, Progress, Tooltip, Button, Modal, Form, InputNumber, App } from 'antd'
import { WarningOutlined, EditOutlined } from '@ant-design/icons'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useAuth } from '@/hooks/useAuth'
import { isDangCongTac } from '@/types/vienChuc'

const { Title } = Typography

export default function ViTriPage() {
  const { message } = App.useApp()
  const { scopeDonViId, hasPermission } = useAuth()
  const allViTris = useDanhMucStore((s) => s.viTriViecLams)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const updateViTriViecLam = useDanhMucStore((s) => s.updateViTriViecLam)
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const viTris = useMemo(() => allViTris.filter((v) => v.active), [allViTris])
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && isDangCongTac(v)), [allVienChucs])
  const canEdit = hasPermission('viTri', 'write')

  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const data = useMemo(() => {
    const list = scopeDonViId ? viTris.filter((v) => v.donViId === scopeDonViId) : viTris
    return list.map((vt) => {
      const vcInDv = vienChucs.filter((vc) => vc.donViId === vt.donViId)
      let thucTe: number
      if (vt.ten === 'Hiệu trưởng') {
        thucTe = vcInDv.filter((vc) => vc.chucVu === 'HIEU_TRUONG').length
      } else if (vt.ten === 'Phó Hiệu trưởng') {
        thucTe = vcInDv.filter((vc) => vc.chucVu === 'PHO_HIEU_TRUONG').length
      } else if (vt.loai === 'CHUYEN_MON') {
        thucTe = vcInDv.filter((vc) =>
          vt.chucDanhIds.includes(vc.chucDanhId) && vc.chucVu !== 'HIEU_TRUONG' && vc.chucVu !== 'PHO_HIEU_TRUONG'
        ).length
      } else {
        thucTe = vcInDv.filter((vc) => vt.chucDanhIds.includes(vc.chucDanhId)).length
      }
      const tongChiTieu = vt.soLuongBienCheNganSach + vt.soLuongBienCheSuNghiep + vt.soLuongHopDong
      const overQuota = thucTe > tongChiTieu
      return { ...vt, thucTe, tongChiTieu, overQuota }
    })
  }, [viTris, vienChucs, scopeDonViId])

  const onSave = (values: any) => {
    updateViTriViecLam(editing.id, values)
    message.success('Đã cập nhật chỉ tiêu')
    setEditing(null)
  }

  const columns = [
    { title: 'Vị trí', dataIndex: 'ten', key: 'ten', ellipsis: true },
    {
      title: 'Đơn vị', dataIndex: 'donViId', key: 'dv', ellipsis: true,
      render: (id: string) => donVis.find((d) => d.id === id)?.ten ?? id,
    },
    { title: 'Loại', dataIndex: 'loai', key: 'loai', render: (v: string) => ({ QUAN_LY: 'Quản lý', CHUYEN_MON: 'Chuyên môn', HO_TRO: 'Hỗ trợ' }[v] ?? v) },
    { title: 'BC ngân sách', dataIndex: 'soLuongBienCheNganSach', key: 'bcns', width: 100, align: 'center' as const },
    { title: 'BC sự nghiệp', dataIndex: 'soLuongBienCheSuNghiep', key: 'bcsn', width: 100, align: 'center' as const },
    { title: 'HĐ', dataIndex: 'soLuongHopDong', key: 'hd', width: 70, align: 'center' as const },
    { title: 'Tổng CT', dataIndex: 'tongChiTieu', key: 'tct', width: 80, align: 'center' as const },
    {
      title: 'Thực tế', dataIndex: 'thucTe', key: 'tt', width: 80, align: 'center' as const,
      render: (v: number, r: any) => (
        <span style={{ color: r.overQuota ? '#f5222d' : 'inherit', fontWeight: r.overQuota ? 700 : 400 }}>
          {r.overQuota && <Tooltip title="Vượt chỉ tiêu!"><WarningOutlined style={{ color: '#f5222d', marginRight: 4 }} /></Tooltip>}
          {v}
        </span>
      ),
    },
    {
      title: 'Tỷ lệ', key: 'ratio', width: 120,
      render: (_: any, r: any) => (
        <Progress
          percent={r.tongChiTieu > 0 ? Math.round((r.thucTe / r.tongChiTieu) * 100) : 0}
          size="small"
          status={r.overQuota ? 'exception' : r.thucTe === r.tongChiTieu ? 'success' : 'active'}
        />
      ),
    },
    ...(canEdit ? [{
      title: '', key: 'act', width: 60,
      render: (_: any, r: any) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r) }} />
      ),
    }] : []),
  ]

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 16 }}>Vị trí việc làm & Chỉ tiêu biên chế</Title>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        scroll={{ x: 950 }}
        rowClassName={(r) => r.overQuota ? 'ant-table-row-selected' : ''}
        pagination={{ pageSize: 20, showTotal: (t) => `Tổng ${t} vị trí` }}
      />

      <Modal open={!!editing} title={`Chỉ tiêu: ${editing?.ten}`} onCancel={() => setEditing(null)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="soLuongBienCheNganSach" label="Biên chế — Hưởng lương ngân sách" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="soLuongBienCheSuNghiep" label="Biên chế — Nguồn thu sự nghiệp" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="soLuongHopDong" label="Hợp đồng" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
