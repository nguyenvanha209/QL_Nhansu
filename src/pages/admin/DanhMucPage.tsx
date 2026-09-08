import { useState } from 'react'
import { Card, Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, Tag, Descriptions, App } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useDanhMucStore } from '@/store/danhMucStore'
import { NHOM_CHUC_DANH_LABELS, LOAI_VI_TRI_LABELS, CONG_THUC_LABELS } from '@/types/danhMuc'
import { LOAI_DON_VI_LABELS } from '@/types/donVi'
import { getHangTruong, HANG_TRUONG_LABELS } from '@/utils/hangTruong'
import { CHUC_VU_LABELS } from '@/types/vienChuc'
import type { ChucVu } from '@/types/vienChuc'

export default function DanhMucPage() {
  return (
    <Card>
      <Tabs items={[
        { key: '1', label: 'Đơn vị trường', children: <DonViTab /> },
        { key: '2', label: 'Chức danh NN', children: <ChucDanhTab /> },
        { key: '3', label: 'Loại phụ cấp', children: <PhuCapTab /> },
        { key: '4', label: 'Mức lương cơ sở', children: <LuongCoSoTab /> },
        { key: '5', label: 'Chức vụ', children: <ChucVuTab /> },
      ]} />
    </Card>
  )
}

function DonViTab() {
  const { message } = App.useApp()
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
    { title: 'Loại', dataIndex: 'loai', key: 'loai', width: 90, render: (v: string) => LOAI_DON_VI_LABELS[v as keyof typeof LOAI_DON_VI_LABELS] ?? v },
    { title: 'Số lớp', dataIndex: 'soLop', key: 'sl', width: 75, align: 'center' as const, render: (v: number) => v ?? '—' },
    {
      title: 'Hạng trường', key: 'hang', width: 95, align: 'center' as const,
      render: (_: any, r: any) => {
        if (!r.soLop || r.loai === 'OTHER') return '—'
        const hang = getHangTruong(r.loai, r.soLop)
        return <Tag color={hang === 1 ? 'gold' : hang === 2 ? 'blue' : 'default'}>{HANG_TRUONG_LABELS[hang]}</Tag>
      },
    },
    { title: 'Trạng thái', dataIndex: 'active', key: 'ac', width: 100, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Hoạt động' : 'Dừng'}</Tag> },
    { title: '', key: 'act', width: 80, render: (_: any, r: any) => (
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

      <Modal open={open} title={editing ? 'Sửa đơn vị' : 'Thêm đơn vị'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ten" label="Tên trường" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
            <Select options={Object.entries(LOAI_DON_VI_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="soLop" label="Số lớp" tooltip="Dùng xếp hạng trường → phụ cấp chức vụ">
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="diaChi" label="Địa chỉ"><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function ChucDanhTab() {
  const { message } = App.useApp()
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
      <Modal open={open} title={editing ? 'Sửa chức danh' : 'Thêm chức danh'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
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
  const { message } = App.useApp()
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
      <Modal open={open} title={editing ? 'Sửa phụ cấp' : 'Thêm phụ cấp'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
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
  const { message } = App.useApp()
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
      <Modal open={open} title="Thêm mức lương cơ sở" onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
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

const CHUC_VU_INFO: Record<ChucVu, { apDung: string; canCu: string; ghiChu: string }> = {
  HIEU_TRUONG: {
    apDung: 'Mầm non, Tiểu học, THCS',
    canCu: 'TT 19/2023/TT-BGDĐT (mầm non), TT 20/2023/TT-BGDĐT (tiểu học, THCS)',
    ghiChu: 'Quản lý, điều hành toàn bộ hoạt động nhà trường',
  },
  PHO_HIEU_TRUONG: {
    apDung: 'Mầm non, Tiểu học, THCS',
    canCu: 'TT 19/2023/TT-BGDĐT (mầm non), TT 20/2023/TT-BGDĐT (tiểu học, THCS)',
    ghiChu: 'Số lượng theo hạng trường và quy mô lớp/học sinh',
  },
  TO_TRUONG_CM: {
    apDung: 'Tiểu học, THCS (trường có tổ chuyên môn)',
    canCu: 'TT 20/2023/TT-BGDĐT',
    ghiChu: 'Phụ trách 1 tổ chuyên môn theo cơ cấu tổ chức nhà trường',
  },
  TO_PHO_CM: {
    apDung: 'Tiểu học, THCS (trường có tổ chuyên môn)',
    canCu: 'TT 20/2023/TT-BGDĐT',
    ghiChu: 'Hỗ trợ tổ trưởng chuyên môn',
  },
}

function ChucVuTab() {
  const data = (Object.keys(CHUC_VU_LABELS) as ChucVu[]).map((cv) => ({
    key: cv,
    chucVu: CHUC_VU_LABELS[cv],
    ...CHUC_VU_INFO[cv],
  }))

  const cols = [
    { title: 'Chức vụ', dataIndex: 'chucVu', key: 'chucVu', width: 180 },
    { title: 'Áp dụng cho', dataIndex: 'apDung', key: 'apDung', width: 220 },
    { title: 'Căn cứ pháp lý', dataIndex: 'canCu', key: 'canCu' },
    { title: 'Ghi chú', dataIndex: 'ghiChu', key: 'ghiChu' },
  ]

  return (
    <>
      <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Căn cứ">
          Vị trí việc làm khối quản lý trường học được quy định theo TT 19/2023/TT-BGDĐT (danh mục vị trí việc làm lĩnh vực giáo dục mầm non)
          và TT 20/2023/TT-BGDĐT (danh mục vị trí việc làm lĩnh vực giáo dục phổ thông). Hệ số phụ cấp chức vụ theo hạng trường (TT 33/2005/TT-BGDĐT)
          được hệ thống tự động tính khi khai báo chức vụ trong hồ sơ viên chức.
        </Descriptions.Item>
      </Descriptions>
      <Table dataSource={data} columns={cols} rowKey="key" size="small" pagination={false} />
    </>
  )
}
