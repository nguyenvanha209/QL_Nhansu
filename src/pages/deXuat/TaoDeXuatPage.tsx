import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Select, Button, Table, Space, InputNumber, DatePicker, message, Typography, Divider } from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import type { ChiTietDeXuat } from '@/types/deXuat'

const { Title } = Typography

export default function TaoDeXuatPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { currentUser, scopeDonViId } = useAuth()
  const { addDeXuat, submitDeXuat } = useDeXuatStore.getState()
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active), [allVienChucs])
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const bacLuongs = useDanhMucStore((s) => s.bacLuongs)
  const [chiTiet, setChiTiet] = useState<ChiTietDeXuat[]>([])
  const [selectedDonVi, setSelectedDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)

  const vcOptions = vienChucs.filter((v) => !selectedDonVi || v.donViId === selectedDonVi).map((v) => ({ value: v.id, label: `${v.ho} ${v.ten}` }))

  const addVC = (vcId: string | undefined) => {
    if (!vcId) return
    if (chiTiet.find((c) => c.vienChucId === vcId)) { message.warning('Viên chức đã có trong danh sách'); return }
    const vc = vienChucs.find((v) => v.id === vcId)
    const hsl = heSoLuongs.find((h) => h.vienChucId === vcId && h.isActive)
    if (!vc || !hsl) return
    const bacs = bacLuongs.filter((b) => b.chucDanhId === hsl.chucDanhId).sort((a, b) => a.bac - b.bac)
    const nextBac = bacs.find((b) => b.bac === hsl.bac + 1)
    setChiTiet((prev) => [...prev, {
      vienChucId: vcId,
      chucDanhCuId: hsl.chucDanhId,
      bacCu: hsl.bac, heSoCu: hsl.heSo,
      chucDanhMoiId: hsl.chucDanhId,
      bacMoi: nextBac?.bac ?? hsl.bac + 1,
      heSoMoi: nextBac?.heSo ?? +(hsl.heSo + 0.33).toFixed(2),
      ngayHieuLuc: dayjs().format('YYYY-MM-DD'),
      lyDo: 'Đủ thời hạn nâng bậc thường xuyên',
    }])
  }

  const updateChiTiet = (idx: number, field: keyof ChiTietDeXuat, value: any) => {
    setChiTiet((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  const onFinish = async (values: any, submitNow = false) => {
    if (chiTiet.length === 0) { message.error('Thêm ít nhất một viên chức'); return }
    if (!currentUser) return

    const dx = addDeXuat({
      tieuDe: values.tieuDe,
      donViId: values.donViId,
      loai: values.loai,
      chiTiet,
      trangThai: 'NHAP',
      buocHienTai: 1,
      nguoiDeXuatId: currentUser.id,
      ngayDeXuat: dayjs().format('YYYY-MM-DD'),
      ghiChuDeXuat: values.ghiChu,
    })

    if (submitNow) {
      submitDeXuat(dx.id, currentUser.id, currentUser.fullName)
      message.success('Đã tạo và nộp đề xuất')
    } else {
      message.success('Đã lưu bản nháp')
    }
    navigate(`/de-xuat/${dx.id}`)
  }

  const detailCols = [
    { title: 'Viên chức', key: 'vc', render: (_: any, r: ChiTietDeXuat) => { const vc = vienChucs.find((v) => v.id === r.vienChucId); return vc ? `${vc.ho} ${vc.ten}` : r.vienChucId } },
    { title: 'Bậc cũ', dataIndex: 'bacCu', key: 'bac_cu', width: 80 },
    { title: 'Hệ số cũ', dataIndex: 'heSoCu', key: 'hs_cu', width: 90 },
    { title: 'Bậc mới', key: 'bac_moi', width: 90, render: (_: any, r: ChiTietDeXuat, idx: number) => <InputNumber size="small" value={r.bacMoi} min={1} max={12} onChange={(v) => updateChiTiet(idx, 'bacMoi', v)} /> },
    { title: 'Hệ số mới', key: 'hs_moi', width: 100, render: (_: any, r: ChiTietDeXuat, idx: number) => <InputNumber size="small" value={r.heSoMoi} min={1} step={0.01} onChange={(v) => updateChiTiet(idx, 'heSoMoi', v)} /> },
    { title: 'Ngày hiệu lực', key: 'nhl', width: 130, render: (_: any, r: ChiTietDeXuat, idx: number) => <DatePicker size="small" value={dayjs(r.ngayHieuLuc)} format="DD/MM/YYYY" onChange={(d) => updateChiTiet(idx, 'ngayHieuLuc', d?.format('YYYY-MM-DD') ?? '')} /> },
    { title: 'Xóa', key: 'del', width: 50, render: (_: any, __: any, idx: number) => <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setChiTiet((p) => p.filter((_, i) => i !== idx))} /> },
  ]

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/de-xuat')}>Quay lại</Button>
      </Space>
      <Title level={4}>Tạo đề xuất lương</Title>

      <Form form={form} layout="vertical" onFinish={(v) => onFinish(v, false)}>
        <Form.Item name="tieuDe" label="Tiêu đề" rules={[{ required: true }]}>
          <Input placeholder="VD: Nâng bậc lương 6 tháng đầu năm 2026 - TH Gia Viên 1" />
        </Form.Item>
        <Space wrap>
          <Form.Item name="donViId" label="Đơn vị" rules={[{ required: true }]} style={{ minWidth: 220 }}>
            <Select options={(scopeDonViId ? donVis.filter((d) => d.id === scopeDonViId) : donVis).map((d) => ({ value: d.id, label: d.ten }))} onChange={setSelectedDonVi} placeholder="Chọn đơn vị" />
          </Form.Item>
          <Form.Item name="loai" label="Loại đề xuất" rules={[{ required: true }]} style={{ minWidth: 180 }}>
            <Select options={[
              { value: 'NANG_BAC', label: 'Nâng bậc thường xuyên' },
              { value: 'NANG_TRUOC_HAN', label: 'Nâng bậc trước hạn' },
              { value: 'DIEU_CHINH', label: 'Điều chỉnh lương' },
              { value: 'CHUYEN_NGACH', label: 'Chuyển ngạch/chức danh' },
            ]} />
          </Form.Item>
        </Space>
        <Form.Item name="ghiChu" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Divider plain>Danh sách viên chức trong đề xuất</Divider>
        <Space style={{ marginBottom: 12 }}>
          <Select showSearch style={{ width: 260 }} placeholder="Chọn viên chức để thêm..." options={vcOptions} onSelect={addVC} filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())} value={undefined} />
          <span>{chiTiet.length} viên chức đã thêm</span>
        </Space>

        <Table dataSource={chiTiet} columns={detailCols} rowKey="vienChucId" size="small" pagination={false} scroll={{ x: 700 }} style={{ marginBottom: 16 }} />

        <Space>
          <Button htmlType="submit">Lưu bản nháp</Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => form.validateFields().then((v) => onFinish(v, true))}>
            Lưu & Nộp ngay
          </Button>
        </Space>
      </Form>
    </Card>
  )
}
