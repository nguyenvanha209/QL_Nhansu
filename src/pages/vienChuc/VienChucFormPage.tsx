import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, message, Space, Typography } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import { LOAI_LAO_DONG_LABELS } from '@/types/vienChuc'

const { Title } = Typography

export default function VienChucFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { currentUser, scopeDonViId } = useAuth()
  const { getById, addVienChuc, updateVienChuc } = useVienChucStore()
  const { donVis, chucDanhs, bacLuongs, getBacLuongsForChucDanh } = useDanhMucStore.getState()
  const { addHeSoLuong } = useLuongStore.getState()

  const vc = isEdit ? getById(id) : undefined
  const donViOptions = (scopeDonViId ? donVis.filter((d) => d.id === scopeDonViId) : donVis.filter((d) => d.active)).map((d) => ({ value: d.id, label: d.ten }))
  const chucDanhOptions = chucDanhs.filter((c) => c.active).map((c) => ({ value: c.id, label: c.ten }))

  useEffect(() => {
    if (vc) {
      form.setFieldsValue({
        ...vc,
        ngaySinh: dayjs(vc.ngaySinh),
        ngayVaoNganh: dayjs(vc.ngayVaoNganh),
        ngayVaoDonVi: dayjs(vc.ngayVaoDonVi),
        ngayHetTapSu: vc.ngayHetTapSu ? dayjs(vc.ngayHetTapSu) : undefined,
        ngayVaoBienChe: vc.ngayVaoBienChe ? dayjs(vc.ngayVaoBienChe) : undefined,
      })
    }
  }, [vc])

  const onFinish = (values: any) => {
    const formatted = {
      ...values,
      ngaySinh: values.ngaySinh?.format('YYYY-MM-DD'),
      ngayVaoNganh: values.ngayVaoNganh?.format('YYYY-MM-DD'),
      ngayVaoDonVi: values.ngayVaoDonVi?.format('YYYY-MM-DD'),
      ngayHetTapSu: values.ngayHetTapSu?.format('YYYY-MM-DD'),
      ngayVaoBienChe: values.ngayVaoBienChe?.format('YYYY-MM-DD'),
    }

    if (isEdit && vc) {
      updateVienChuc(id!, formatted, currentUser?.id, currentUser?.fullName)
      message.success('Cập nhật thành công')
      navigate(`/vien-chuc/${id}`)
    } else {
      const bacs = getBacLuongsForChucDanh(values.chucDanhId)
      const firstBac = bacs[0]
      const newVc = addVienChuc(
        { ...formatted, active: true },
        currentUser?.id,
        currentUser?.fullName
      )
      if (firstBac) {
        const ngayTiepTheo = dayjs(formatted.ngayVaoNganh).add(firstBac.thoiGianNangLuong, 'year').format('YYYY-MM-DD')
        const newHeSo = addHeSoLuong({
          vienChucId: newVc.id,
          chucDanhId: values.chucDanhId,
          bac: firstBac.bac,
          heSo: firstBac.heSo,
          ngayHieuLuc: formatted.ngayVaoNganh,
          ngayNangLuongTiepTheo: ngayTiepTheo,
          lyDo: 'TUYEN_DUNG',
          isActive: true,
          createdBy: currentUser?.id ?? 'system',
        })
        updateVienChuc(newVc.id, { heSoLuongHienTaiId: newHeSo.id })
      }
      message.success('Thêm viên chức thành công')
      navigate(`/vien-chuc/${newVc.id}`)
    }
  }

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit ? `/vien-chuc/${id}` : '/vien-chuc')}>Quay lại</Button>
      </Space>
      <Title level={4}>{isEdit ? 'Chỉnh sửa hồ sơ' : 'Thêm viên chức mới'}</Title>

      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ gioiTinh: 'NU', loaiLaoDong: 'VIEN_CHUC' }}>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="ho" label="Họ và tên đệm" rules={[{ required: true }]}>
              <Input placeholder="VD: Nguyễn Thị" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="ten" label="Tên" rules={[{ required: true }]}>
              <Input placeholder="VD: Hoa" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="gioiTinh" label="Giới tính" rules={[{ required: true }]}>
              <Select options={[{ value: 'NAM', label: 'Nam' }, { value: 'NU', label: 'Nữ' }]} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="ngaySinh" label="Ngày sinh" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="cccd" label="Số CCCD">
              <Input placeholder="12 số" maxLength={12} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="dienThoai" label="Điện thoại">
              <Input placeholder="0xxxxxxxxx" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="donViId" label="Đơn vị công tác" rules={[{ required: true }]}>
              <Select options={donViOptions} placeholder="Chọn đơn vị" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="chucDanhId" label="Chức danh nghề nghiệp" rules={[{ required: true }]}>
              <Select options={chucDanhOptions} placeholder="Chọn chức danh" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="loaiLaoDong" label="Loại hình lao động" rules={[{ required: true }]}>
              <Select options={Object.entries(LOAI_LAO_DONG_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="ngayVaoNganh" label="Ngày vào ngành" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="ngayVaoDonVi" label="Ngày vào đơn vị" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="ngayVaoBienChe" label="Ngày vào biên chế">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="ghiChu" label="Ghi chú">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              {isEdit ? 'Lưu thay đổi' : 'Thêm mới'}
            </Button>
            <Button onClick={() => navigate(isEdit ? `/vien-chuc/${id}` : '/vien-chuc')}>Hủy</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}
