import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Form, Input, Select, DatePicker, Button, Row, Col,
  Space, Typography, Divider, InputNumber, Alert, App,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import { LOAI_LAO_DONG_LABELS, CHUC_VU_LABELS } from '@/types/vienChuc'
import type { ChucVu } from '@/types/vienChuc'
import { getHangTruong, getPhuCapChucVuHeSo, HANG_TRUONG_LABELS } from '@/utils/hangTruong'
import type { LoaiDonVi } from '@/types/donVi'

const { Title, Text } = Typography

function PhuCapGiaTriInput({ value, onChange, fieldName }: { value?: number; onChange?: (v: number | null) => void; fieldName: number }) {
  const form = Form.useFormInstance()
  const loaiPhuCapId = Form.useWatch(['phuCaps', fieldName, 'loaiPhuCapId'], form)
  const loaiPhuCaps = useDanhMucStore.getState().loaiPhuCaps
  const selected = loaiPhuCaps.find((p) => p.id === loaiPhuCapId)
  const suffix = selected?.loaiCongThuc === 'TIEN_MAT' ? 'đ' : '%'
  return <InputNumber value={value} onChange={onChange} style={{ width: '100%' }} placeholder="Giá trị" addonAfter={suffix} min={0} />
}

export default function VienChucFormPage() {
  const { message } = App.useApp()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { currentUser, scopeDonViId } = useAuth()
  const { getById, addVienChuc, updateVienChuc } = useVienChucStore()
  const { donVis, chucDanhs, bacLuongs, loaiPhuCaps, getBacLuongsForChucDanh } = useDanhMucStore.getState()
  const luongState = useLuongStore.getState()

  const vc = isEdit ? getById(id) : undefined
  const donViOptions = (scopeDonViId
    ? donVis.filter((d) => d.id === scopeDonViId)
    : donVis.filter((d) => d.active)
  ).map((d) => ({ value: d.id, label: d.ten }))

  const chucDanhOptions = chucDanhs
    .filter((c) => c.active)
    .map((c) => ({ value: c.id, label: `${c.ma} — ${c.ten}` }))

  const phuCapOptions = loaiPhuCaps
    .filter((pc) => pc.active)
    .map((pc) => ({ value: pc.id, label: `${pc.ma} — ${pc.ten}` }))

  const watchChucDanhId = Form.useWatch('chucDanhId', form)
  const bacLuongOptions = useMemo(() => {
    if (!watchChucDanhId) return []
    return getBacLuongsForChucDanh(watchChucDanhId).map((b) => ({
      value: b.id,
      label: `Bậc ${b.bac} — Hệ số ${b.heSo.toFixed(2)}`,
    }))
  }, [watchChucDanhId])

  const watchDonViId = Form.useWatch('donViId', form)
  const watchChucVu = Form.useWatch('chucVu', form)
  const pccvInfo = useMemo(() => {
    if (!watchDonViId || !watchChucVu) return null
    const dv = donVis.find((d) => d.id === watchDonViId)
    if (!dv || !dv.soLop || dv.loai === 'OTHER') return null
    const hang = getHangTruong(dv.loai as LoaiDonVi, dv.soLop)
    const heSo = getPhuCapChucVuHeSo(dv.loai as LoaiDonVi, hang, watchChucVu as ChucVu)
    return { hang, heSo, loai: dv.loai }
  }, [watchDonViId, watchChucVu, donVis])

  const watchBacLuongId = Form.useWatch('bacLuongId', form)
  const selectedBac = useMemo(() => bacLuongs.find((b) => b.id === watchBacLuongId), [watchBacLuongId])

  useEffect(() => {
    if (!vc) return
    form.setFieldsValue({
      ...vc,
      ngaySinh: dayjs(vc.ngaySinh),
      ngayVaoNganh: dayjs(vc.ngayVaoNganh),
      ngayVaoDonVi: dayjs(vc.ngayVaoDonVi),
      ngayHetTapSu: vc.ngayHetTapSu ? dayjs(vc.ngayHetTapSu) : undefined,
      ngayVaoBienChe: vc.ngayVaoBienChe ? dayjs(vc.ngayVaoBienChe) : undefined,
    })
    const heSo = luongState.getActiveHeSo(id!)
    if (heSo) {
      const bac = bacLuongs.find((b) => b.chucDanhId === heSo.chucDanhId && b.bac === heSo.bac)
      if (bac) form.setFieldValue('bacLuongId', bac.id)
    }
    const activePCs = luongState.getActivePhuCaps(id!)
    if (activePCs.length > 0) {
      form.setFieldValue(
        'phuCaps',
        activePCs.map((pc) => ({ loaiPhuCapId: pc.loaiPhuCapId, giaTri: pc.giaTri }))
      )
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
    const { bacLuongId, phuCaps, ...vcData } = formatted

    if (isEdit && vc) {
      updateVienChuc(id!, vcData, currentUser?.id, currentUser?.fullName)

      const selectedBacLuong = bacLuongs.find((b) => b.id === bacLuongId)
      const currentHeSo = luongState.getActiveHeSo(id)
      if (
        selectedBacLuong &&
        (!currentHeSo || currentHeSo.bac !== selectedBacLuong.bac || currentHeSo.chucDanhId !== values.chucDanhId)
      ) {
        if (currentHeSo) luongState.deactivateHeSoLuong(currentHeSo.id)
        const ngayHieuLuc = dayjs().format('YYYY-MM-DD')
        const ngayTiepTheo = dayjs(ngayHieuLuc).add(selectedBacLuong.thoiGianNangLuong, 'year').format('YYYY-MM-DD')
        const newHeSo = luongState.addHeSoLuong({
          vienChucId: id!,
          chucDanhId: values.chucDanhId,
          bac: selectedBacLuong.bac,
          heSo: selectedBacLuong.heSo,
          ngayHieuLuc,
          ngayNangLuongTiepTheo: ngayTiepTheo,
          lyDo: 'DIEU_CHINH',
          isActive: true,
          createdBy: currentUser?.id ?? 'system',
        })
        updateVienChuc(id!, { heSoLuongHienTaiId: newHeSo.id })
      }

      const existingPCs = luongState.getActivePhuCaps(id)
      existingPCs.forEach((pc) => luongState.deactivatePhuCap(pc.id))
      const ngayHL = vcData.ngayVaoNganh || dayjs().format('YYYY-MM-DD')
      for (const pc of phuCaps || []) {
        if (pc.loaiPhuCapId) {
          luongState.addPhuCap({
            vienChucId: id!,
            loaiPhuCapId: pc.loaiPhuCapId,
            giaTri: pc.giaTri || 0,
            ngayHieuLuc: ngayHL,
            isActive: true,
            createdBy: currentUser?.id ?? 'system',
          })
        }
      }

      message.success('Cập nhật thành công')
      navigate(`/vien-chuc/${id}`)
    } else {
      const selectedBacLuong = bacLuongs.find((b) => b.id === bacLuongId)
      const newVc = addVienChuc({ ...vcData, active: true }, currentUser?.id, currentUser?.fullName)

      if (selectedBacLuong) {
        const ngayHieuLuc = vcData.ngayVaoNganh || dayjs().format('YYYY-MM-DD')
        const ngayTiepTheo = dayjs(ngayHieuLuc).add(selectedBacLuong.thoiGianNangLuong, 'year').format('YYYY-MM-DD')
        const newHeSo = luongState.addHeSoLuong({
          vienChucId: newVc.id,
          chucDanhId: values.chucDanhId,
          bac: selectedBacLuong.bac,
          heSo: selectedBacLuong.heSo,
          ngayHieuLuc,
          ngayNangLuongTiepTheo: ngayTiepTheo,
          lyDo: 'TUYEN_DUNG',
          isActive: true,
          createdBy: currentUser?.id ?? 'system',
        })
        updateVienChuc(newVc.id, { heSoLuongHienTaiId: newHeSo.id })
      }

      const ngayHL = vcData.ngayVaoNganh || dayjs().format('YYYY-MM-DD')
      for (const pc of phuCaps || []) {
        if (pc.loaiPhuCapId) {
          luongState.addPhuCap({
            vienChucId: newVc.id,
            loaiPhuCapId: pc.loaiPhuCapId,
            giaTri: pc.giaTri || 0,
            ngayHieuLuc: ngayHL,
            isActive: true,
            createdBy: currentUser?.id ?? 'system',
          })
        }
      }

      message.success('Thêm viên chức thành công')
      navigate(`/vien-chuc/${newVc.id}`)
    }
  }

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit ? `/vien-chuc/${id}` : '/vien-chuc')}>
          Quay lại
        </Button>
      </Space>
      <Title level={4}>{isEdit ? 'Chỉnh sửa hồ sơ' : 'Thêm viên chức mới'}</Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ gioiTinh: 'NU', loaiLaoDong: 'VIEN_CHUC', phuCaps: [] }}
      >
        {/* ── Thông tin cá nhân ── */}
        <Divider titlePlacement="left">Thông tin cá nhân</Divider>
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
        </Row>

        {/* ── Thông tin công tác ── */}
        <Divider titlePlacement="left">Thông tin công tác</Divider>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="donViId" label="Đơn vị công tác" rules={[{ required: true }]}>
              <Select options={donViOptions} placeholder="Chọn đơn vị" showSearch optionFilterProp="label" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="chucDanhId" label="Mã chức danh nghề nghiệp" rules={[{ required: true }]}>
              <Select
                options={chucDanhOptions}
                placeholder="Chọn chức danh"
                showSearch
                optionFilterProp="label"
                onChange={() => form.setFieldValue('bacLuongId', undefined)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="loaiLaoDong" label="Loại hình lao động" rules={[{ required: true }]}>
              <Select options={Object.entries(LOAI_LAO_DONG_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="chucVu" label="Chức vụ">
              <Select
                options={Object.entries(CHUC_VU_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                placeholder="Không (giáo viên/nhân viên)"
                allowClear
              />
            </Form.Item>
          </Col>
          {pccvInfo && (
            <Col xs={24}>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={`PC Chức vụ: hệ số ${pccvInfo.heSo.toFixed(2)} × lương cơ sở (${HANG_TRUONG_LABELS[pccvInfo.hang]} — TT 33/2005)`}
              />
            </Col>
          )}
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
        </Row>

        {/* ── Lương & Phụ cấp ── */}
        <Divider titlePlacement="left">Lương & Phụ cấp</Divider>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="bacLuongId"
              label="Bậc lương"
              rules={[{ required: !isEdit, message: 'Chọn bậc lương' }]}
            >
              <Select
                options={bacLuongOptions}
                placeholder={watchChucDanhId ? 'Chọn bậc lương' : 'Chọn chức danh trước'}
                disabled={!watchChucDanhId}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Hệ số lương">
              <InputNumber
                value={selectedBac?.heSo}
                disabled
                style={{ width: '100%' }}
                precision={2}
                placeholder="Tự động theo bậc"
              />
            </Form.Item>
          </Col>
          {selectedBac && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Thời gian nâng bậc">
                <Input value={`${selectedBac.thoiGianNangLuong} năm / bậc`} disabled />
              </Form.Item>
            </Col>
          )}
        </Row>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text strong style={{ fontSize: 14 }}>Phụ cấp đang hưởng</Text>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                const current = form.getFieldValue('phuCaps') || []
                form.setFieldValue('phuCaps', [...current, { loaiPhuCapId: undefined, giaTri: 0 }])
              }}
            >
              Thêm phụ cấp
            </Button>
          </div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            PC Thâm niên nghề sẽ chuyển sang PC nghề nghiệp theo NĐ 182/2026
          </Text>

          <Form.List name="phuCaps">
            {(fields, { remove }) => (
              <>
                {fields.length === 0 && (
                  <Text type="secondary" italic>Chưa khai báo phụ cấp</Text>
                )}
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="top" style={{ marginBottom: 4 }}>
                    <Col flex="auto">
                      <Form.Item
                        {...restField}
                        name={[name, 'loaiPhuCapId']}
                        rules={[{ required: true, message: 'Chọn loại' }]}
                        style={{ marginBottom: 8 }}
                      >
                        <Select
                          options={phuCapOptions}
                          placeholder="Chọn loại phụ cấp"
                          showSearch
                          optionFilterProp="label"
                          onChange={(val: string) => {
                            const selected = loaiPhuCaps.find((p) => p.id === val)
                            if (selected) {
                              const current = form.getFieldValue('phuCaps')
                              current[name].giaTri = selected.giaTri
                              form.setFieldsValue({ phuCaps: [...current] })
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col flex="140px">
                      <Form.Item {...restField} name={[name, 'giaTri']} style={{ marginBottom: 8 }}>
                        <PhuCapGiaTriInput fieldName={name} />
                      </Form.Item>
                    </Col>
                    <Col flex="36px">
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                        style={{ marginTop: 4 }}
                      />
                    </Col>
                  </Row>
                ))}
              </>
            )}
          </Form.List>
        </div>

        {/* ── Ghi chú ── */}
        <Divider titlePlacement="left">Ghi chú</Divider>
        <Row gutter={16}>
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
