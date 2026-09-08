import { useState } from 'react'
import { Card, Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, Tag, Descriptions, Typography, Grid, App } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, BankOutlined, IdcardOutlined,
  DollarOutlined, ProfileOutlined, ApartmentOutlined, SolutionOutlined, FlagOutlined,
} from '@ant-design/icons'
import { useDanhMucStore } from '@/store/danhMucStore'
import { NHOM_CHUC_DANH_LABELS, LOAI_VI_TRI_LABELS, CONG_THUC_LABELS } from '@/types/danhMuc'
import { LOAI_DON_VI_LABELS } from '@/types/donVi'
import { getHangTruong, HANG_TRUONG_LABELS } from '@/utils/hangTruong'
import { TRANG_THAI_CONG_TAC_LABELS } from '@/types/vienChuc'
import type { TrangThaiCongTac } from '@/types/vienChuc'

const { Title, Text } = Typography

function TabLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{icon}{text}</span>
}

export default function DanhMucPage() {
  const screens = Grid.useBreakpoint()
  const isWide = !!screens.lg

  return (
    <Card styles={{ body: { padding: isWide ? 0 : 16 } }}>
      <Tabs
        tabPosition={isWide ? 'left' : 'top'}
        size="middle"
        style={{ minHeight: 520 }}
        tabBarStyle={isWide ? { width: 220, paddingTop: 12 } : undefined}
        items={[
          { key: '1', label: <TabLabel icon={<BankOutlined />} text="Đơn vị trường" />, children: <TabPane title="Đơn vị trường" desc="Danh sách trường học trực thuộc, số lớp và hạng trường (dùng để tính phụ cấp chức vụ)."><DonViTab /></TabPane> },
          { key: '2', label: <TabLabel icon={<IdcardOutlined />} text="Chức danh NN" />, children: <TabPane title="Chức danh nghề nghiệp" desc="Mã ngạch/hạng chức danh nghề nghiệp theo quy định, dùng khi xếp lương viên chức."><ChucDanhTab /></TabPane> },
          { key: '3', label: <TabLabel icon={<ProfileOutlined />} text="Loại phụ cấp" />, children: <TabPane title="Loại phụ cấp" desc="Các loại phụ cấp và công thức tính (% lương chính, % lương cơ sở, tiền mặt, hệ số)."><PhuCapTab /></TabPane> },
          { key: '4', label: <TabLabel icon={<DollarOutlined />} text="Mức lương cơ sở" />, children: <TabPane title="Mức lương cơ sở" desc="Mức lương cơ sở theo từng thời kỳ, lưu để tra cứu và tham chiếu văn bản."><LuongCoSoTab /></TabPane> },
          { key: '5', label: <TabLabel icon={<SolutionOutlined />} text="Chức vụ" />, children: <TabPane title="Chức vụ" desc="Chức vụ lãnh đạo, quản lý trong nhà trường. Admin có thể thêm/sửa/xóa để tùy biến."><ChucVuTab /></TabPane> },
          { key: '6', label: <TabLabel icon={<ApartmentOutlined />} text="VTVL" />, children: <TabPane title="Vị trí việc làm (VTVL)" desc="Phân loại vị trí việc làm của viên chức. Admin có thể thêm/sửa/xóa để tùy biến."><VtvlTab /></TabPane> },
          { key: '7', label: <TabLabel icon={<FlagOutlined />} text="Trạng thái" />, children: <TabPane title="Trạng thái công tác" desc="Vòng đời công tác của viên chức, ảnh hưởng tới số liệu tổng hợp toàn hệ thống."><TrangThaiTab /></TabPane> },
        ]}
      />
    </Card>
  )
}

function TabPane({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 16px 16px' }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>{title}</Title>
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>{desc}</Text>
      {children}
    </div>
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
    {
      title: 'Giá trị', dataIndex: 'giaTri', key: 'gt',
      render: (v: number, r: any) => r.loaiCongThuc === 'TIEN_MAT' ? `${v.toLocaleString()} đ` : r.loaiCongThuc === 'HE_SO' ? `+${v}` : `${v}%`,
    },
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
          <Form.Item name="giaTri" label="Giá trị (% / VNĐ / hệ số)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
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

function ChucVuTab() {
  const { message } = App.useApp()
  const { chucVus, addChucVu, updateChucVu } = useDanhMucStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const onSave = (values: any) => {
    if (editing) { updateChucVu(editing.id, values); message.success('Đã cập nhật') }
    else { addChucVu({ ...values, active: true }); message.success('Đã thêm') }
    setOpen(false); setEditing(null); form.resetFields()
  }

  const cols = [
    { title: 'Mã', dataIndex: 'ma', key: 'ma', width: 150 },
    { title: 'Chức vụ', dataIndex: 'ten', key: 'ten', width: 170 },
    { title: 'Áp dụng cho', dataIndex: 'apDung', key: 'apDung', width: 200, render: (v: string) => v ?? '—' },
    { title: 'Căn cứ pháp lý', dataIndex: 'canCu', key: 'canCu', ellipsis: true, render: (v: string) => v ?? '—' },
    { title: 'Ghi chú', dataIndex: 'moTa', key: 'moTa', ellipsis: true, render: (v: string) => v ?? '—' },
    {
      title: '', key: 'act', width: 80,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} />
          <Popconfirm title="Xóa chức vụ này?" onConfirm={() => { updateChucVu(r.id, { active: false }); message.success('Đã xóa') }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Căn cứ">
          Chức vụ quản lý trường học theo TT 19/2023/TT-BGDĐT (mầm non) và TT 20/2023/TT-BGDĐT (phổ thông). Hệ số phụ cấp chức vụ theo hạng trường
          (TT 33/2005/TT-BGDĐT) chỉ tự động tính cho 4 mã chuẩn: HIEU_TRUONG, PHO_HIEU_TRUONG, TO_TRUONG_CM, TO_PHO_CM.
        </Descriptions.Item>
      </Descriptions>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Thêm chức vụ</Button>
      <Table dataSource={chucVus.filter((c) => c.active)} columns={cols} rowKey="id" size="small" pagination={false} scroll={{ x: 800 }} />
      <Modal open={open} title={editing ? 'Sửa chức vụ' : 'Thêm chức vụ'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]} tooltip="Dùng 4 mã chuẩn để hệ thống tự tính phụ cấp chức vụ: HIEU_TRUONG, PHO_HIEU_TRUONG, TO_TRUONG_CM, TO_PHO_CM">
            <Input placeholder="VD: TO_TRUONG_VP" />
          </Form.Item>
          <Form.Item name="ten" label="Tên chức vụ" rules={[{ required: true }]}><Input placeholder="VD: Tổ trưởng văn phòng" /></Form.Item>
          <Form.Item name="apDung" label="Áp dụng cho"><Input placeholder="VD: Tiểu học, THCS" /></Form.Item>
          <Form.Item name="canCu" label="Căn cứ pháp lý"><Input placeholder="VD: TT 20/2023/TT-BGDĐT" /></Form.Item>
          <Form.Item name="moTa" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function VtvlTab() {
  const { message } = App.useApp()
  const { vtvls, addVtvl, updateVtvl } = useDanhMucStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const onSave = (values: any) => {
    if (editing) { updateVtvl(editing.id, values); message.success('Đã cập nhật') }
    else { addVtvl({ ...values, active: true }); message.success('Đã thêm') }
    setOpen(false); setEditing(null); form.resetFields()
  }

  const cols = [
    { title: 'Mã', dataIndex: 'ma', key: 'ma', width: 150 },
    { title: 'VTVL', dataIndex: 'ten', key: 'ten', width: 200 },
    { title: 'Mô tả', dataIndex: 'moTa', key: 'moTa', render: (v: string) => v ?? '—' },
    {
      title: '', key: 'act', width: 80,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} />
          <Popconfirm title="Xóa VTVL này?" onConfirm={() => { updateVtvl(r.id, { active: false }); message.success('Đã xóa') }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Căn cứ">
          Phân loại vị trí việc làm (VTVL) của viên chức, được chọn thủ công khi khai báo hồ sơ. Mã CBQL / GIAO_VIEN / NHAN_VIEN là 3 nhóm chuẩn,
          admin có thể bổ sung thêm nhóm khác nếu cần.
        </Descriptions.Item>
      </Descriptions>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Thêm VTVL</Button>
      <Table dataSource={vtvls.filter((v) => v.active)} columns={cols} rowKey="id" size="small" pagination={false} />
      <Modal open={open} title={editing ? 'Sửa VTVL' : 'Thêm VTVL'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]}><Input placeholder="VD: NHAN_VIEN_YT" /></Form.Item>
          <Form.Item name="ten" label="Tên VTVL" rules={[{ required: true }]}><Input placeholder="VD: Nhân viên y tế" /></Form.Item>
          <Form.Item name="moTa" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

const TRANG_THAI_INFO: Record<TrangThaiCongTac, string> = {
  DANG_LAM_VIEC: 'Đang công tác bình thường tại đơn vị',
  CHUYEN_DEN: 'Mới chuyển đến đơn vị từ nơi khác, vẫn tính là đang công tác',
  CHUYEN_DI: 'Đã chuyển công tác sang đơn vị/địa phương khác',
  NGHI_HUU: 'Đã nghỉ hưu theo chế độ',
  THOI_VIEC: 'Đã thôi việc, chấm dứt hợp đồng lao động/làm việc',
}

function TrangThaiTab() {
  const data = (Object.keys(TRANG_THAI_CONG_TAC_LABELS) as TrangThaiCongTac[]).map((t) => ({
    key: t,
    trangThai: TRANG_THAI_CONG_TAC_LABELS[t],
    moTa: TRANG_THAI_INFO[t],
  }))

  const cols = [
    { title: 'Trạng thái', dataIndex: 'trangThai', key: 'trangThai', width: 180 },
    { title: 'Ý nghĩa', dataIndex: 'moTa', key: 'moTa' },
  ]

  return (
    <>
      <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Căn cứ">
          Trạng thái công tác phản ánh vòng đời làm việc của viên chức. Chỉ người có trạng thái "Đang làm việc" hoặc "Chuyển đến" được tính vào số liệu
          Tổng quan, chỉ tiêu Vị trí việc làm, Báo cáo, Dự báo nghỉ hưu và danh sách chọn ở Đề xuất lương.
        </Descriptions.Item>
      </Descriptions>
      <Table dataSource={data} columns={cols} rowKey="key" size="small" pagination={false} />
    </>
  )
}
