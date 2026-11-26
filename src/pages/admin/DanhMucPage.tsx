import { useState } from 'react'
import { Card, Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, Tag, Descriptions, Typography, Grid, App, Tooltip } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, BankOutlined, IdcardOutlined,
  DollarOutlined, ProfileOutlined, ApartmentOutlined, SolutionOutlined, FlagOutlined,
} from '@ant-design/icons'
import { useDanhMucStore } from '@/store/danhMucStore'
import { soSanhMaChucDanh } from '@/utils/helpers'
import { NHOM_CHUC_DANH_LABELS, LOAI_VI_TRI_LABELS, CONG_THUC_LABELS } from '@/types/danhMuc'
import { LOAI_DON_VI_LABELS, KHOI_DON_VI, khoiCuaLoai } from '@/types/donVi'
import type { KhoiDonVi } from '@/types/donVi'
import { usePhamVi } from '@/hooks/usePhamVi'
import { apDungChoKhoi, khoiChucDanh, khoiChucVu, khoiVtvl, khoiPhuCap, TEN_KHOI_NGAN } from '@/utils/khoiDanhMuc'
import { BANG_LUONG_CHUAN } from '@/utils/bangLuongChuan'
import { hangTruongTheoNamHoc, moTaHang, HANG_TRUONG_LABELS } from '@/utils/hangTruong'
import { namHocHienHanh, soSanhTruong } from '@/utils/dinhMuc'
import { sapXepLoaiPhuCap, PCUD_MUC_CU } from '@/utils/phuCapThuTu'
import { TRANG_THAI_CONG_TAC_LABELS } from '@/types/vienChuc'
import type { TrangThaiCongTac } from '@/types/vienChuc'

const { Title, Text } = Typography

// ── Khối áp dụng của mục danh mục ──
// Bỏ trống = tự suy theo mã (VD ngạch giáo viên → Trường học; ngạch công chức → Cơ quan). Danh mục chỉ hiện ở đơn vị
// thuộc khối áp dụng; Phòng VHXH, quản trị thấy hết. Ô chọn khối ở đầu trang lọc luôn các bảng danh mục này.
const MAU_KHOI: Record<KhoiDonVi, string> = { TRUONG_HOC: 'blue', CO_QUAN: 'purple', DVSN: 'cyan' }
function cotKhoi<T>(tinh: (r: T) => KhoiDonVi[], tuChon: (r: T) => boolean) {
  return {
    title: 'Khối áp dụng', key: 'khoi', width: 170,
    render: (_: unknown, r: T) => (
      <Space size={2} wrap>
        {tinh(r).map((k) => <Tag key={k} color={MAU_KHOI[k]} style={{ marginInlineEnd: 0 }}>{TEN_KHOI_NGAN[k]}</Tag>)}
        {!tuChon(r) && <Text type="secondary" style={{ fontSize: 11 }}>(tự suy)</Text>}
      </Space>
    ),
  }
}
const oKhoi = (
  <Form.Item name="khoi" label="Khối áp dụng" tooltip="Bỏ trống: tự xác định theo mã.">
    <Select mode="multiple" allowClear placeholder="Tự xác định theo mã" options={KHOI_DON_VI.map((k) => ({ value: k.key, label: k.ten }))} />
  </Form.Item>
)
const coKhoiRieng = (r: { khoi?: KhoiDonVi[] }) => !!r.khoi?.length

function TabLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{icon}{text}</span>
}

export default function DanhMucPage() {
  const screens = Grid.useBreakpoint()
  const isWide = !!screens.md

  return (
    <Card styles={{ body: { padding: isWide ? 0 : 16 } }}>
      <Tabs
        tabPlacement={isWide ? 'start' : 'top'}
        size="middle"
        style={{ minHeight: 520 }}
        tabBarStyle={isWide ? { width: 190, paddingTop: 12 } : undefined}
        items={[
          { key: '1', label: <TabLabel icon={<BankOutlined />} text="Đơn vị" />, children: <TabPane title="Đơn vị"><DonViTab /></TabPane> },
          { key: '2', label: <TabLabel icon={<IdcardOutlined />} text="Chức danh NN" />, children: <TabPane title="Chức danh nghề nghiệp"><ChucDanhTab /></TabPane> },
          { key: '3', label: <TabLabel icon={<ProfileOutlined />} text="Loại phụ cấp" />, children: <TabPane title="Loại phụ cấp"><PhuCapTab /></TabPane> },
          { key: '4', label: <TabLabel icon={<DollarOutlined />} text="Mức lương cơ sở" />, children: <TabPane title="Mức lương cơ sở"><LuongCoSoTab /></TabPane> },
          { key: '5', label: <TabLabel icon={<SolutionOutlined />} text="Chức vụ" />, children: <TabPane title="Chức vụ"><ChucVuTab /></TabPane> },
          { key: '6', label: <TabLabel icon={<ApartmentOutlined />} text="VTVL" />, children: <TabPane title="Vị trí việc làm (VTVL)"><VtvlTab /></TabPane> },
          { key: '7', label: <TabLabel icon={<FlagOutlined />} text="Trạng thái" />, children: <TabPane title="Trạng thái công tác"><TrangThaiTab /></TabPane> },
        ]}
      />
    </Card>
  )
}

function TabPane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 16px 16px' }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>{title}</Title>
      {children}
    </div>
  )
}

function DonViTab() {
  const { khoi: khoiXem } = usePhamVi()
  const { message } = App.useApp()
  const { donVis, addDonVi, updateDonVi, quyMoTruongs } = useDanhMucStore()
  const namHoc = namHocHienHanh()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const onSave = (values: any) => {
    const { ma, ten, loai } = values
    if (editing) { updateDonVi(editing.id, { ma, ten, loai }); message.success('Đã cập nhật') }
    else { addDonVi({ ma, ten, loai, active: true }); message.success('Đã thêm') }
    setOpen(false); setEditing(null); form.resetFields()
  }

  const cols = [
    { title: 'Mã', dataIndex: 'ma', key: 'ma', width: 80 },
    { title: 'Tên đơn vị', dataIndex: 'ten', key: 'ten' },
    { title: 'Loại', dataIndex: 'loai', key: 'loai', width: 130, render: (v: string) => LOAI_DON_VI_LABELS[v as keyof typeof LOAI_DON_VI_LABELS] ?? v },
    {
      title: `Hạng trường (năm học ${namHoc})`, key: 'hang', width: 120, align: 'center' as const,
      render: (_: any, r: any) => {
        const h = hangTruongTheoNamHoc(r, quyMoTruongs, namHoc)
        if (!h) return r.loai === 'OTHER' || khoiCuaLoai(r.loai) !== 'TRUONG_HOC' ? '-' : <Text type="secondary" style={{ fontSize: 13 }}>Chưa khai quy mô</Text>
        return <Tooltip title={moTaHang(h)}><Tag color={h.hang === 1 ? 'gold' : h.hang === 2 ? 'blue' : 'default'}>{HANG_TRUONG_LABELS[h.hang]}</Tag></Tooltip>
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
      <Table scroll={{ x: 'max-content' }} dataSource={donVis.filter((d) => !khoiXem || khoiCuaLoai(d.loai) === khoiXem).sort(soSanhTruong)} columns={cols} rowKey="id" size="small" pagination={false} />

      <Modal open={open} title={editing ? 'Sửa đơn vị' : 'Thêm đơn vị'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ten" label="Tên đơn vị" rules={[{ required: true }]}><Input placeholder="VD: Phòng Kinh tế, Hạ tầng và Đô thị" /></Form.Item>
          <Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
            <Select options={Object.entries(LOAI_DON_VI_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function ChucDanhTab() {
  const { khoi: khoiXem } = usePhamVi()
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
    cotKhoi(khoiChucDanh, coKhoiRieng),
    { title: '', key: 'act', render: (_: any, r: any) => (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} />
      </Space>
    )},
  ]

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Thêm chức danh</Button>
      <Table scroll={{ x: 'max-content' }} dataSource={chucDanhs.filter((c) => c.active && apDungChoKhoi(khoiChucDanh(c), khoiXem)).sort(soSanhMaChucDanh)} columns={cols} rowKey="id" size="small" pagination={false} />
      <Modal open={open} title={editing ? 'Sửa chức danh' : 'Thêm chức danh'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ten" label="Tên" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="nhom" label="Nhóm" rules={[{ required: true }]}>
            <Select options={Object.entries(NHOM_CHUC_DANH_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="maCu" label="Mã cũ (hạng I/II/III)"><Input /></Form.Item>
          <Form.Item name="tenCu" label="Tên cũ"><Input /></Form.Item>
          <Form.Item name="bangLuong" label="Bảng lương" rules={[{ required: true }]}><Select options={Object.keys(BANG_LUONG_CHUAN).map((v) => ({ value: v, label: v }))} /></Form.Item>
          {oKhoi}
        </Form>
      </Modal>
    </>
  )
}

function PhuCapTab() {
  const { khoi: khoiXem } = usePhamVi()
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
    { title: 'Mã', dataIndex: 'ma', key: 'ma', width: 170, render: (v: string) => <span style={{ whiteSpace: 'nowrap' }}>{v}</span> },
    {
      title: 'Tên phụ cấp', dataIndex: 'ten', key: 'ten', width: 300,
      render: (v: string, r: any) => PCUD_MUC_CU.has(r.ma) ? <Space size={6}>{v}<Tag>Mức cũ</Tag></Space> : v,
    },
    { title: 'Công thức', dataIndex: 'loaiCongThuc', key: 'ct', width: 270, render: (v: string) => CONG_THUC_LABELS[v as keyof typeof CONG_THUC_LABELS] ?? v ?? '-' },
    {
      title: 'Giá trị', dataIndex: 'giaTri', key: 'gt', width: 170,
      render: (v: number | null, r: any) => {
        if (!v) return <Typography.Text type="secondary">Nhập theo từng người</Typography.Text>
        return r.loaiCongThuc === 'TIEN_MAT' ? `${v.toLocaleString()} đ` : r.loaiCongThuc === 'HE_SO' ? `+${v}` : `${v}%`
      },
    },
    { title: 'Đối tượng / Căn cứ', dataIndex: 'moTa', key: 'moTa', render: (v?: string) => v ?? '-' },
    cotKhoi(khoiPhuCap, coKhoiRieng),
    { title: '', key: 'act', width: 60, render: (_: any, r: any) => <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} /> },
  ]

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Thêm loại phụ cấp</Button>
      <Table scroll={{ x: 1300 }} dataSource={sapXepLoaiPhuCap(loaiPhuCaps.filter((p) => p.active && apDungChoKhoi(khoiPhuCap(p), khoiXem)))} columns={cols} rowKey="id" size="small" pagination={false} />
      <Modal open={open} title={editing ? 'Sửa phụ cấp' : 'Thêm phụ cấp'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ten" label="Tên" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="loaiCongThuc" label="Công thức" rules={[{ required: true }]}>
            <Select options={Object.entries(CONG_THUC_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item
            name="giaTri"
            label="Giá trị (% / VNĐ / hệ số)"
            rules={[{ required: true }]}
            extra="Loại Hệ số nhập giá trị hệ số (VD 0,33), không nhập %. Để 0 nếu mỗi người một mức."
          ><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="moTa" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
          {oKhoi}
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
      <Table scroll={{ x: 'max-content' }} dataSource={[...mucLuongCosos].sort((a, b) => b.hieuLucTu.localeCompare(a.hieuLucTu))} columns={cols} rowKey="id" size="small" pagination={false} />
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
  const { khoi: khoiXem } = usePhamVi()
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
    { title: 'Chức vụ', dataIndex: 'ten', key: 'ten', width: 190 },
    { title: 'Áp dụng cho', dataIndex: 'apDung', key: 'apDung', width: 300, render: (v: string) => v ?? '-' },
    { title: 'Căn cứ pháp lý', dataIndex: 'canCu', key: 'canCu', ellipsis: true, render: (v: string) => v ?? '-' },
    { title: 'Ghi chú', dataIndex: 'moTa', key: 'moTa', ellipsis: true, render: (v: string) => v ?? '-' },
    cotKhoi(khoiChucVu, coKhoiRieng),
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
          TT 19/2023/TT-BGDĐT, TT 20/2023/TT-BGDĐT; phụ cấp chức vụ theo hạng trường: TT 33/2005/TT-BGDĐT (mã HT, P.HT, TTCM, TPCM).
        </Descriptions.Item>
      </Descriptions>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Thêm chức vụ</Button>
      <Table dataSource={chucVus.filter((c) => c.active && apDungChoKhoi(khoiChucVu(c), khoiXem))} columns={cols} rowKey="id" size="small" pagination={false} scroll={{ x: 1100 }} />
      <Modal open={open} title={editing ? 'Sửa chức vụ' : 'Thêm chức vụ'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]} tooltip="Mã chuẩn: HT, P.HT, TTCM, TPCM, TRP, P.TRP, CVP, P.CVP">
            <Input placeholder="VD: TO_TRUONG_VP" />
          </Form.Item>
          <Form.Item name="ten" label="Tên chức vụ" rules={[{ required: true }]}><Input placeholder="VD: Tổ trưởng văn phòng" /></Form.Item>
          <Form.Item name="apDung" label="Áp dụng cho"><Input placeholder="VD: Tiểu học, THCS" /></Form.Item>
          <Form.Item name="canCu" label="Căn cứ pháp lý"><Input placeholder="VD: TT 20/2023/TT-BGDĐT" /></Form.Item>
          <Form.Item name="moTa" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
          {oKhoi}
        </Form>
      </Modal>
    </>
  )
}

function VtvlTab() {
  const { khoi: khoiXem } = usePhamVi()
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
    { title: 'Mô tả', dataIndex: 'moTa', key: 'moTa', render: (v: string) => v ?? '-' },
    cotKhoi(khoiVtvl, coKhoiRieng),
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
        <Descriptions.Item label="Phụ cấp thâm niên">Áp dụng cho mã CBQL, GIAO_VIEN; không áp dụng cho NHAN_VIEN.</Descriptions.Item>
      </Descriptions>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Thêm VTVL</Button>
      <Table scroll={{ x: 'max-content' }} dataSource={vtvls.filter((v) => v.active && apDungChoKhoi(khoiVtvl(v), khoiXem))} columns={cols} rowKey="id" size="small" pagination={false} />
      <Modal open={open} title={editing ? 'Sửa VTVL' : 'Thêm VTVL'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="ma" label="Mã" rules={[{ required: true }]}><Input placeholder="VD: NHAN_VIEN_YT" /></Form.Item>
          <Form.Item name="ten" label="Tên VTVL" rules={[{ required: true }]}><Input placeholder="VD: Nhân viên y tế" /></Form.Item>
          <Form.Item name="moTa" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
          {oKhoi}
        </Form>
      </Modal>
    </>
  )
}

const TRANG_THAI_INFO: Record<TrangThaiCongTac, string> = {
  DANG_LAM_VIEC: 'Đang công tác tại đơn vị',
  CHUYEN_DEN: 'Chuyển đến từ nơi khác, tính là đang công tác',
  CHUYEN_DI: 'Đã chuyển công tác',
  NGHI_HUU: 'Đã nghỉ hưu',
  THOI_VIEC: 'Đã thôi việc, chấm dứt hợp đồng',
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
        <Descriptions.Item label="Lưu ý">
          Chỉ tính vào số liệu các trạng thái "Đang làm việc", "Chuyển đến".
        </Descriptions.Item>
      </Descriptions>
      <Table scroll={{ x: 'max-content' }} dataSource={data} columns={cols} rowKey="key" size="small" pagination={false} />
    </>
  )
}
