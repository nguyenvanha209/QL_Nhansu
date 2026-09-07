import { useState } from 'react'
import { Card, Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useDanhMucStore } from '@/store/danhMucStore'
import { NHOM_CHUC_DANH_LABELS, LOAI_VI_TRI_LABELS, CONG_THUC_LABELS } from '@/types/danhMuc'
import { LOAI_DON_VI_LABELS } from '@/types/donVi'

export default function DanhMucPage() {
  return (
    <Card>
      <Tabs items={[
        { key: '1', label: 'Đơn vị trường', children: <DonViTab /> },
        { key: '2', label: 'Chức danh NN', children: <ChucDanhTab /> },
        { key: '3', label: 'Loại phụ cấp', children: <PhuCapTab /> },
        { key: '4', label: 'Mức lương cơ sở', children: <LuongCoSoTab /> },
      ]} />
    </Card>
  )
}

function DonViTab() {
  const { donVis, addDonVi, updateDonVi } = useDanhMucStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const onSave = (values: any) => {
    if (editing) { updateDonVi(editing.id, values); message.success('Đã cập nhật') }
    else { addDonVi({ ...values, active: true }); message.success('Đã thêm') }
    setOpen(false); setEditing(null); form.resetFields()
  }

  const cols = [
    { title: 'Mã', dataIndex: 'ma', key: 'ma', width: 80 },
    { title: 'Tên trường', dataIndex: 'ten', key: 'ten' },
    { title: 'Loại', dataIndex: 'loai', key: 'loai', render: (v: string) => LOAI_DON_VI_LABELS[v as keyof typeof LOAI_DON_VI_LABELS] ?? v },
    { title: 'Trạng thái', dataIndex: 'active', key: 'ac', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Hoạt động' : 'Dừng'}</Tag> },
    { title: '', key: 'act', render: (_: any, r: any) => (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} />
        <Popconfirm title="Xác nhận?" onConfirm={() => updateDonVi(r.id, { active: false })}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>
    )},
  ]

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Thêm đơn vị</Button>
      <Table dataSource={donVis} columns={cols} rowKey="id" size="small" pagination={false} />
      <Modal open={open} title={editing ? 'Sửa đơn vị' : 'Thêm đơn vị'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ten" label="Tên trường" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
            <Select options={Object.entries(LOAI_DON_VI_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="diaChi" label="Địa chỉ"><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function ChucDanhTab() {
  const { chucDanhs, addChucDanh, updateChucDanh } = useDanhMucStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const onSave = (values: any) => {
    if (editing) { updateChucDanh(editing.id, values); message.success('Đã cập nhật') }
    else { addChucDanh({ ...values, active: true }); message.success('Đã thêm') }
    setOpen(false); setEditing(null); form.resetFields()
  }

  const cols = [
    { title: 'Mã', dataIndex: 'ma', key: 'ma', width: 100 },
    { title: 'Tên chức danh', dataIndex: 'ten', key: 'ten' },
    { title: 'Nhóm', dataIndex: 'nhom', key: 'nhom', render: (v: string) => NHOM_CHUC_DANH_LABELS[v as keyof typeof NHOM_CHUC_DANH_LABELS] ?? v },
    { title: 'Mã cũ', dataIndex: 'maCu', key: 'maCu' },
    { title: '', key: 'act', render: (_: any, r: any) => (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} />
      </Space>
    )},
  ]

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Thêm chức danh</Button>
      <Table dataSource={chucDanhs.filter((c) => c.active)} columns={cols} rowKey="id" size="small" pagination={false} />
      <Modal open={open} title={editing ? 'Sửa chức danh' : 'Thêm chức danh'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ten" label="Tên" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="nhom" label="Nhóm" rules={[{ required: true }]}>
            <Select options={Object.entries(NHOM_CHUC_DANH_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="maCu" label="Mã cũ (hạng I/II/III)"><Input /></Form.Item>
          <Form.Item name="tenCu" label="Tên cũ"><Input /></Form.Item>
          <Form.Item name="bangLuong" label="Bảng lương" rules={[{ required: true }]}><Select options={['A0', 'A1', 'A2.1', 'A2.2', 'B'].map((v) => ({ value: v, label: v }))} /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function PhuCapTab() {
  const { loaiPhuCaps, addLoaiPhuCap, updateLoaiPhuCap } = useDanhMucStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const onSave = (values: any) => {
    if (editing) { updateLoaiPhuCap(editing.id, values); message.success('Đã cập nhật') }
    else { addLoaiPhuCap({ ...values, active: true }); message.success('Đã thêm') }
    setOpen(false); setEditing(null); form.resetFields()
  }

  const cols = [
    { title: 'Mã', dataIndex: 'ma', key: 'ma', width: 120 },
    { title: 'Tên phụ cấp', dataIndex: 'ten', key: 'ten' },
    { title: 'Công thức', dataIndex: 'loaiCongThuc', key: 'ct', render: (v: string) => CONG_THUC_LABELS[v as keyof typeof CONG_THUC_LABELS] ?? v },
    { title: 'Giá trị', dataIndex: 'giaTri', key: 'gt', render: (v: number, r: any) => r.loaiCongThuc === 'TIEN_MAT' ? `${v.toLocaleString()} đ` : `${v}%` },
    { title: '', key: 'act', render: (_: any, r: any) => <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} /> },
  ]

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Thêm loại phụ cấp</Button>
      <Table dataSource={loaiPhuCaps.filter((p) => p.active)} columns={cols} rowKey="id" size="small" pagination={false} />
      <Modal open={open} title={editing ? 'Sửa phụ cấp' : 'Thêm phụ cấp'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ten" label="Tên" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="loaiCongThuc" label="Công thức" rules={[{ required: true }]}>
            <Select options={Object.entries(CONG_THUC_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="giaTri" label="Giá trị (% hoặc VNĐ)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="moTa" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function LuongCoSoTab() {
  const { mucLuongCosos, addMucLuongCoso, updateMucLuongCoso } = useDanhMucStore()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const cols = [
    { title: 'Mức lương (VNĐ)', dataIndex: 'mucLuong', key: 'ml', render: (v: number) => v.toLocaleString() },
    { title: 'Hiệu lực từ', dataIndex: 'hieuLucTu', key: 'hlt' },
    { title: 'Hiệu lực đến', dataIndex: 'hieuLucDen', key: 'hld', render: (v: string) => v ?? 'Hiện tại' },
    { title: 'Quyết định số', dataIndex: 'quyetDinhSo', key: 'qd' },
    {
      title: 'Trạng thái', key: 'ts', render: (_: any, r: any) => {
        const today = new Date().toISOString().slice(0, 10)
        const active = r.hieuLucTu <= today && (!r.hieuLucDen || r.hieuLucDen >= today)
        return <Tag color={active ? 'green' : 'default'}>{active ? 'Đang áp dụng' : 'Lịch sử'}</Tag>
      },
    },
  ]

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => { form.resetFields(); setOpen(true) }}>Thêm mức lương cơ sở</Button>
      <Table dataSource={[...mucLuongCosos].sort((a, b) => b.hieuLucTu.localeCompare(a.hieuLucTu))} columns={cols} rowKey="id" size="small" pagination={false} />
      <Modal open={open} title="Thêm mức lương cơ sở" onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(v) => { addMucLuongCoso(v); setOpen(false); form.resetFields(); message.success('Đã thêm') }}>
          <Form.Item name="mucLuong" label="Mức lương (VNĐ)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="hieuLucTu" label="Hiệu lực từ" rules={[{ required: true }]}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name="hieuLucDen" label="Hiệu lực đến"><Input placeholder="YYYY-MM-DD (để trống = hiện tại)" /></Form.Item>
          <Form.Item name="quyetDinhSo" label="Quyết định số"><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}
