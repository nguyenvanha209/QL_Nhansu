import { useState } from 'react'
import { Alert, App, Button, Col, DatePicker, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { nanoid } from 'nanoid'
import type { BoNhiem, HinhThucBoNhiem, VienChuc } from '@/types/vienChuc'
import { CHUC_VU_LABELS, HINH_THUC_BO_NHIEM_LABELS } from '@/types/vienChuc'
import { useAuth } from '@/hooks/useAuth'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { formatDate } from '@/utils/helpers'
import {
  CHUC_VU_BO_NHIEM, MOC_CHUAN_BI_THANG, MOC_DEN_HAN_NGAY, laChucVuBoNhiem, moTaConLai,
  ngayHetNhiemKyMacDinh, nhiemKyHienTai, tinhTrangBoNhiem,
} from '@/utils/boNhiem'
import { TagKeoDai, TagMucBoNhiem } from './BoNhiemTags'

const { Text } = Typography
const COQUAN_MAC_DINH = 'UBND phường Gia Viên'

interface GiaTriForm {
  chucVu: string
  hinhThuc: HinhThucBoNhiem
  soQuyetDinh: string
  ngayQuyetDinh: Dayjs
  coQuanQuyetDinh: string
  ngayBatDau: Dayjs
  ngayHetNhiemKy: Dayjs
  ghiChu?: string
}

const moTaBoNhiem = (b: BoNhiem) =>
  `${CHUC_VU_LABELS[b.chucVu] ?? b.chucVu} - ${HINH_THUC_BO_NHIEM_LABELS[b.hinhThuc]} - QĐ ${b.soQuyetDinh} ngày ${formatDate(b.ngayQuyetDinh)} - nhiệm kỳ ${formatDate(b.ngayBatDau)} đến ${formatDate(b.ngayHetNhiemKy)}`

/** Thẻ "Bổ nhiệm" trong hồ sơ HT/P.HT: kế toán nhập, Phòng VHXH sửa được; mọi thay đổi ghi lịch sử và nhật ký */
export default function BoNhiemTab({ vc }: { vc: VienChuc }) {
  const { currentUser, hasPermission, scopeDonViId } = useAuth()
  const { message } = App.useApp()
  const capNhatNhieu = useVienChucStore((s) => s.capNhatNhieu)
  const [form] = Form.useForm<GiaTriForm>()
  const [dangSua, setDangSua] = useState<BoNhiem | 'MOI' | null>(null)
  // Người dùng đã tự sửa ngày hết nhiệm kỳ thì thôi tự tính lại theo ngày bắt đầu
  const [tuSuaNgayHet, setTuSuaNgayHet] = useState(false)

  const coQuyenSua = hasPermission('vienChuc', 'write') && (!scopeDonViId || vc.donViId === scopeDonViId)
  const ds = [...(vc.boNhiems ?? [])].sort((a, b) => b.ngayBatDau.localeCompare(a.ngayBatDau))
  const hienTai = nhiemKyHienTai(vc)
  const tt = laChucVuBoNhiem(vc.chucVu) ? tinhTrangBoNhiem(vc) : undefined

  const moForm = (b: BoNhiem | 'MOI') => {
    setDangSua(b)
    setTuSuaNgayHet(b !== 'MOI')
    if (b === 'MOI') {
      form.setFieldsValue({
        chucVu: laChucVuBoNhiem(vc.chucVu) ? vc.chucVu : 'HT',
        hinhThuc: ds.length ? 'BO_NHIEM_LAI' : 'LAN_DAU',
        soQuyetDinh: '',
        ngayQuyetDinh: undefined,
        coQuanQuyetDinh: hienTai?.coQuanQuyetDinh ?? COQUAN_MAC_DINH,
        // Bổ nhiệm lại nối tiếp ngay sau nhiệm kỳ cũ
        ngayBatDau: hienTai ? dayjs(hienTai.ngayHetNhiemKy).add(1, 'day') : undefined,
        ngayHetNhiemKy: hienTai ? dayjs(ngayHetNhiemKyMacDinh(dayjs(hienTai.ngayHetNhiemKy).add(1, 'day').format('YYYY-MM-DD'))) : undefined,
        ghiChu: '',
      } as Partial<GiaTriForm>)
    } else {
      form.setFieldsValue({
        ...b,
        ngayQuyetDinh: dayjs(b.ngayQuyetDinh),
        ngayBatDau: dayjs(b.ngayBatDau),
        ngayHetNhiemKy: dayjs(b.ngayHetNhiemKy),
      })
    }
  }

  const ghi = (moi: BoNhiem[], moTa: string, cu: string, giaTriMoi: string) => {
    const actorId = currentUser?.id ?? 'system'
    capNhatNhieu([{ id: vc.id, patch: { boNhiems: moi } }], actorId, currentUser?.fullName ?? 'Hệ thống', `${moTa} - ${vc.ho} ${vc.ten}: ${giaTriMoi}`, vc.donViId)
    useLuongStore.getState().addLichSuBienDong({
      vienChucId: vc.id, loai: 'BO_NHIEM', truongThayDoi: moTa,
      giaTriCu: cu, giaTriMoi,
      ngayThayDoi: dayjs().format('YYYY-MM-DD'), nguoiThayDoiId: actorId,
    })
  }

  const luu = async () => {
    const v = await form.validateFields()
    const t = new Date().toISOString()
    const ban: Omit<BoNhiem, 'id' | 'createdAt' | 'createdBy'> = {
      chucVu: v.chucVu,
      hinhThuc: v.hinhThuc,
      soQuyetDinh: v.soQuyetDinh.trim(),
      ngayQuyetDinh: v.ngayQuyetDinh.format('YYYY-MM-DD'),
      coQuanQuyetDinh: v.coQuanQuyetDinh.trim(),
      ngayBatDau: v.ngayBatDau.format('YYYY-MM-DD'),
      ngayHetNhiemKy: v.ngayHetNhiemKy.format('YYYY-MM-DD'),
      ghiChu: v.ghiChu?.trim() || undefined,
    }
    if (dangSua === 'MOI') {
      const b: BoNhiem = { ...ban, id: nanoid(), createdAt: t, createdBy: currentUser?.id ?? 'system' }
      ghi([...(vc.boNhiems ?? []), b], 'Thêm quyết định bổ nhiệm', hienTai ? moTaBoNhiem(hienTai) : '(chưa có)', moTaBoNhiem(b))
    } else if (dangSua) {
      const b: BoNhiem = { ...dangSua, ...ban, updatedAt: t }
      ghi((vc.boNhiems ?? []).map((x) => (x.id === b.id ? b : x)), 'Sửa quyết định bổ nhiệm', moTaBoNhiem(dangSua), moTaBoNhiem(b))
    }
    message.success('Đã lưu quyết định bổ nhiệm')
    setDangSua(null)
  }

  const xoa = (b: BoNhiem) => {
    ghi((vc.boNhiems ?? []).filter((x) => x.id !== b.id), 'Xoá quyết định bổ nhiệm', moTaBoNhiem(b), '(đã xoá)')
    message.success('Đã xoá')
  }

  const doiNgayBatDau = (d: Dayjs | null) => {
    if (d && !tuSuaNgayHet) form.setFieldValue('ngayHetNhiemKy', dayjs(ngayHetNhiemKyMacDinh(d.format('YYYY-MM-DD'))))
  }
  const doiHinhThuc = (h: HinhThucBoNhiem) => {
    // Kéo dài: thường đến thời điểm nghỉ hưu
    if (h === 'KEO_DAI' && tt?.ngayNghiHuu) { form.setFieldValue('ngayHetNhiemKy', dayjs(tt.ngayNghiHuu)); setTuSuaNgayHet(true) }
  }

  return (
    <>
      {tt && (
        <Alert
          style={{ marginBottom: 12 }}
          type={tt.muc === 'QUA_HAN' || tt.muc === 'DEN_HAN' ? 'error' : tt.muc === 'CHUAN_BI' ? 'warning' : tt.muc === 'CHUA_NHAP' ? 'info' : 'success'}
          showIcon
          title={
            <Space wrap size={8}>
              <span>
                {tt.bn
                  ? <>Nhiệm kỳ hiện tại đến <b>{formatDate(tt.bn.ngayHetNhiemKy)}</b> ({moTaConLai(tt.soNgayCon)})</>
                  : 'Chưa nhập quyết định bổ nhiệm'}
              </span>
              <TagMucBoNhiem muc={tt.muc} />
              {tt.xemXetKeoDai && <TagKeoDai ngayNghiHuu={tt.ngayNghiHuu} />}
            </Space>
          }
          description={
            <span>
              Nghỉ hưu: {formatDate(tt.ngayNghiHuu) || '-'}. Hệ thống nhắc Phòng VHXH khi còn {MOC_CHUAN_BI_THANG} tháng (chuẩn bị hồ sơ) và
              {' '}{MOC_DEN_HAN_NGAY} ngày (hạn hoàn thành quy trình bổ nhiệm lại). Nhập quyết định bổ nhiệm lại thì tự sang nhiệm kỳ mới.
            </span>
          }
        />
      )}
      {!tt && ds.length > 0 && (
        <Alert style={{ marginBottom: 12 }} type="info" showIcon title="Hiện không giữ chức vụ Hiệu trưởng / Phó Hiệu trưởng - không nhắc nhiệm kỳ. Danh sách dưới đây là lịch sử." />
      )}
      {coQuyenSua && (
        <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => moForm('MOI')}>Thêm lần bổ nhiệm</Button>
      )}
      <Table<BoNhiem>
        scroll={{ x: 'max-content' }}
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={ds}
        locale={{ emptyText: 'Chưa có quyết định bổ nhiệm' }}
        columns={[
          { title: 'Chức vụ', dataIndex: 'chucVu', key: 'cv', width: 150, render: (v: string) => CHUC_VU_LABELS[v] ?? v },
          { title: 'Hình thức', dataIndex: 'hinhThuc', key: 'ht', width: 210, render: (v: HinhThucBoNhiem) => HINH_THUC_BO_NHIEM_LABELS[v] },
          { title: 'Số QĐ', dataIndex: 'soQuyetDinh', key: 'so', width: 140 },
          { title: 'Ngày QĐ', dataIndex: 'ngayQuyetDinh', key: 'nqd', width: 115, render: (v: string) => formatDate(v) },
          { title: 'Cơ quan ra QĐ', dataIndex: 'coQuanQuyetDinh', key: 'cq', width: 210 },
          { title: 'Từ ngày', dataIndex: 'ngayBatDau', key: 'bd', width: 115, render: (v: string) => formatDate(v) },
          { title: 'Đến ngày', dataIndex: 'ngayHetNhiemKy', key: 'het', width: 115, render: (v: string, b) => b.id === hienTai?.id ? <b>{formatDate(v)}</b> : formatDate(v) },
          { title: 'Ghi chú', dataIndex: 'ghiChu', key: 'gc', render: (v?: string) => <Text type="secondary">{v ?? ''}</Text> },
          ...(coQuyenSua ? [{
            title: '', key: 'act', width: 90,
            render: (_: unknown, b: BoNhiem) => (
              <Space size={4}>
                <Button size="small" icon={<EditOutlined />} onClick={() => moForm(b)} />
                <Popconfirm title="Xoá quyết định bổ nhiệm này?" description={moTaBoNhiem(b)} okText="Xoá" okButtonProps={{ danger: true }} cancelText="Huỷ" onConfirm={() => xoa(b)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          }] : []),
        ]}
      />

      <Modal
        open={!!dangSua}
        title={dangSua === 'MOI' ? 'Thêm lần bổ nhiệm' : 'Sửa quyết định bổ nhiệm'}
        okText="Lưu"
        cancelText="Huỷ"
        onOk={luu}
        onCancel={() => setDangSua(null)}
        width={720}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="chucVu" label="Chức vụ" rules={[{ required: true }]}>
                <Select options={CHUC_VU_BO_NHIEM.map((c) => ({ value: c, label: CHUC_VU_LABELS[c] }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hinhThuc" label="Hình thức" rules={[{ required: true }]}>
                <Select onChange={doiHinhThuc} options={Object.entries(HINH_THUC_BO_NHIEM_LABELS).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="soQuyetDinh" label="Số quyết định" rules={[{ required: true, whitespace: true, message: 'Nhập số quyết định' }]}>
                <Input placeholder="VD: 125/QĐ-UBND" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ngayQuyetDinh" label="Ngày quyết định" rules={[{ required: true, message: 'Chọn ngày quyết định' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="coQuanQuyetDinh" label="Cơ quan ra quyết định" rules={[{ required: true, whitespace: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngayBatDau" label="Giữ chức vụ từ ngày" rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} onChange={doiNgayBatDau} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="ngayHetNhiemKy"
                label="Đến ngày (hết nhiệm kỳ)"
                extra="Tự tính 5 năm từ ngày bắt đầu; sửa nếu quyết định ghi khác"
                dependencies={['ngayBatDau']}
                rules={[
                  { required: true, message: 'Chọn ngày hết nhiệm kỳ' },
                  ({ getFieldValue }) => ({
                    validator: (_, v: Dayjs | undefined) => {
                      const bd: Dayjs | undefined = getFieldValue('ngayBatDau')
                      return !v || !bd || v.isAfter(bd) ? Promise.resolve() : Promise.reject(new Error('Phải sau ngày bắt đầu'))
                    },
                  }),
                ]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} onChange={() => setTuSuaNgayHet(true)} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="ghiChu" label="Ghi chú">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}
