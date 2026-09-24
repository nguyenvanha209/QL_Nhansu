import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Form, Input, Select, DatePicker, Button, Row, Col,
  Space, Typography, Divider, InputNumber, Alert, App, Tag,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import { LOAI_LAO_DONG_LABELS, TRANG_THAI_CONG_TAC_LABELS, NGUON_KINH_PHI_LABELS, HINH_THUC_LUONG_LABELS, coPhuCapThamNien } from '@/types/vienChuc'
import { chucDanhHopLeVoiVtvl } from '@/utils/vtvlRules'
import type { ChucVu, LoaiLaoDong, HinhThucLuong } from '@/types/vienChuc'
import { getHangTruong, getPhuCapChucVuHeSo, HANG_TRUONG_LABELS } from '@/utils/hangTruong'
import type { LoaiDonVi } from '@/types/donVi'
import { splitHoTen, toUpperName } from '@/utils/helpers'
import { sapXepLoaiPhuCap } from '@/utils/phuCapThuTu'

const { Title, Text } = Typography

function PhuCapGiaTriInput({ value, onChange, fieldName }: { value?: number; onChange?: (v: number | null) => void; fieldName: number }) {
  const form = Form.useFormInstance()
  const loaiPhuCapId = Form.useWatch(['phuCaps', fieldName, 'loaiPhuCapId'], form)
  const loaiPhuCaps = useDanhMucStore.getState().loaiPhuCaps
  const selected = loaiPhuCaps.find((p) => p.id === loaiPhuCapId)
  const suffix = selected?.loaiCongThuc === 'TIEN_MAT' ? 'đ' : selected?.loaiCongThuc === 'HE_SO' ? 'hệ số' : '%'
  return (
    <Space.Compact style={{ width: '100%' }}>
      <InputNumber
        value={value}
        onChange={onChange}
        style={{ width: '100%' }}
        placeholder={selected?.loaiCongThuc === 'HE_SO' ? 'VD 0,33' : 'Giá trị'}
        min={0}
        step={selected?.loaiCongThuc === 'HE_SO' ? 0.01 : 1}
      />
      <Button disabled style={{ pointerEvents: 'none' }}>{suffix}</Button>
    </Space.Compact>
  )
}

export default function VienChucFormPage() {
  const { message } = App.useApp()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { currentUser, scopeDonViId, isCBTruong } = useAuth()
  const { getById, addVienChuc, updateVienChuc } = useVienChucStore()
  const { donVis, chucDanhs, bacLuongs, loaiPhuCaps, vtvls, chucVus, getBacLuongsForChucDanh } = useDanhMucStore.getState()
  const luongState = useLuongStore.getState()

  const vc = isEdit ? getById(id) : undefined
  const donViOptions = (scopeDonViId
    ? donVis.filter((d) => d.id === scopeDonViId)
    : donVis.filter((d) => d.active)
  ).map((d) => ({ value: d.id, label: d.ten }))

  const watchVtvl = Form.useWatch('vtvl', form) as string | undefined
  const watchChucDanhIdRaw = Form.useWatch('chucDanhId', form) as string | undefined
  const duocHuongPctn = coPhuCapThamNien(watchVtvl, chucDanhs.find((c) => c.id === watchChucDanhIdRaw)?.nhom)

  // Ngạch/hạng lọc theo VTVL; ngạch đang gán của hồ sơ cũ luôn được giữ lại để không mất dữ liệu
  const chucDanhOptions = chucDanhs
    .filter((c) => c.active)
    .filter((c) => chucDanhHopLeVoiVtvl(c.nhom, watchVtvl) || c.id === watchChucDanhIdRaw)
    .map((c) => ({
      value: c.id,
      label: chucDanhHopLeVoiVtvl(c.nhom, watchVtvl)
        ? `${c.ma} — ${c.ten}`
        : `${c.ma} — ${c.ten} (không thuộc VTVL đang chọn)`,
    }))

  const phuCapOptions = sapXepLoaiPhuCap(loaiPhuCaps.filter((pc) => pc.active))
    .filter((pc) => duocHuongPctn || pc.ma !== 'PC_THAM_NIEN')
    .map((pc) => ({ value: pc.id, label: `${pc.ma} — ${pc.ten}` }))

  const vtvlOptions = vtvls.filter((v) => v.active).map((v) => ({ value: v.ma, label: v.ten }))
  const chucVuOptions = chucVus.filter((c) => c.active).map((c) => ({ value: c.ma, label: c.ten }))

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

  useEffect(() => {
    if (!pccvInfo || pccvInfo.heSo <= 0) return
    const pcChucVu = loaiPhuCaps.find((p) => p.ma === 'PC_CHUC_VU')
    if (!pcChucVu) return
    const current: any[] = form.getFieldValue('phuCaps') || []
    const idx = current.findIndex((pc) => pc?.loaiPhuCapId === pcChucVu.id)
    if (idx >= 0) {
      if (current[idx].giaTri === pccvInfo.heSo) return
      const updated = [...current]
      updated[idx] = { ...updated[idx], giaTri: pccvInfo.heSo }
      form.setFieldValue('phuCaps', updated)
    } else {
      form.setFieldValue('phuCaps', [...current, { loaiPhuCapId: pcChucVu.id, giaTri: pccvInfo.heSo }])
    }
  }, [pccvInfo, loaiPhuCaps])

  // Nhân viên không hưởng PC thâm niên → gỡ dòng phụ cấp này nếu đang có
  const watchPhuCaps = Form.useWatch('phuCaps', form) as { loaiPhuCapId?: string }[] | undefined
  useEffect(() => {
    if (duocHuongPctn) return
    const pcThamNien = loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN')
    if (!pcThamNien) return
    const current: any[] = form.getFieldValue('phuCaps') || []
    if (!current.some((pc) => pc?.loaiPhuCapId === pcThamNien.id)) return
    form.setFieldValue('phuCaps', current.filter((pc) => pc?.loaiPhuCapId !== pcThamNien.id))
    message.warning('Vị trí việc làm Nhân viên không hưởng phụ cấp thâm niên — đã gỡ dòng PC Thâm niên nghề')
  }, [duocHuongPctn, watchPhuCaps, loaiPhuCaps])

  const watchBacLuongId = Form.useWatch('bacLuongId', form)
  const selectedBac = useMemo(() => bacLuongs.find((b) => b.id === watchBacLuongId), [watchBacLuongId])
  const watchLoaiLaoDong = Form.useWatch('loaiLaoDong', form) as LoaiLaoDong | undefined
  // Viên chức biên chế: bắt buộc khai mã ngạch, nguồn kinh phí, ngày vào biên chế, bậc lương.
  // Các loại hình hợp đồng: mã ngạch, bậc lương không bắt buộc; không có nguồn kinh phí / ngày biên chế.
  const laBienChe = watchLoaiLaoDong === 'VIEN_CHUC'
  const watchTrangThai = Form.useWatch('trangThai', form) as string | undefined
  const watchHinhThucLuong = Form.useWatch('hinhThucLuong', form) as HinhThucLuong | undefined
  // Hợp đồng nhận lương theo mức tiền → không khai bậc lương, hệ số
  const luongTheoTien = !laBienChe && watchHinhThucLuong === 'TIEN'
  const nhanBienChe = (text: string) => (
    <Space size={6}>
      {text}
      {laBienChe && <Tag color="blue" style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '16px' }}>VC biên chế</Tag>}
    </Space>
  )

  useEffect(() => {
    if (!vc) return
    form.setFieldsValue({
      ...vc,
      hoTenFull: `${vc.ho} ${vc.ten}`.trim(),
      hinhThucLuong: vc.hinhThucLuong ?? 'HE_SO',
      trangThai: vc.trangThai ?? 'DANG_LAM_VIEC',
      ngaySinh: dayjs(vc.ngaySinh),
      ngayVaoNganh: dayjs(vc.ngayVaoNganh),
      ngayVaoDonVi: dayjs(vc.ngayVaoDonVi),
      ngayHetTapSu: vc.ngayHetTapSu ? dayjs(vc.ngayHetTapSu) : undefined,
      ngayVaoBienChe: vc.ngayVaoBienChe ? dayjs(vc.ngayVaoBienChe) : undefined,
      mocHuongPctn: vc.mocHuongPctn ? dayjs(vc.mocHuongPctn) : undefined,
      ngayChuyenDi: vc.ngayChuyenDi ? dayjs(vc.ngayChuyenDi) : undefined,
    })
    const heSo = luongState.getActiveHeSo(id!)
    if (heSo) {
      const bac = bacLuongs.find((b) => b.chucDanhId === heSo.chucDanhId && b.bac === heSo.bac)
      if (bac) form.setFieldValue('bacLuongId', bac.id)
      form.setFieldValue('mocHuongLuong', dayjs(heSo.ngayHieuLuc))
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
    const { hoTenFull, mocHuongLuong, ...restValues } = values
    const { ho, ten } = splitHoTen(toUpperName(hoTenFull))
    const formatted = {
      ...restValues,
      ho,
      ten,
      ngaySinh: values.ngaySinh?.format('YYYY-MM-DD'),
      ngayVaoNganh: values.ngayVaoNganh?.format('YYYY-MM-DD'),
      ngayVaoDonVi: values.ngayVaoDonVi?.format('YYYY-MM-DD'),
      ngayHetTapSu: values.ngayHetTapSu?.format('YYYY-MM-DD'),
      ngayVaoBienChe: values.ngayVaoBienChe?.format('YYYY-MM-DD'),
      mocHuongPctn: values.mocHuongPctn?.format('YYYY-MM-DD'),
      ngayChuyenDi: values.trangThai === 'CHUYEN_DI' ? values.ngayChuyenDi?.format('YYYY-MM-DD') : undefined,
    }
    if (formatted.loaiLaoDong !== 'VIEN_CHUC') formatted.nguonKinhPhi = undefined
    const theoTien = formatted.loaiLaoDong !== 'VIEN_CHUC' && formatted.hinhThucLuong === 'TIEN'
    if (formatted.loaiLaoDong === 'VIEN_CHUC') formatted.hinhThucLuong = undefined
    if (!theoTien) formatted.mucLuongTien = undefined
    // Lương theo tiền: không ghi bậc lương / hệ số mới
    if (theoTien) formatted.bacLuongId = undefined
    const nhomNgach = chucDanhs.find((c) => c.id === formatted.chucDanhId)?.nhom
    const huongPctn = coPhuCapThamNien(formatted.vtvl, nhomNgach)
    // Nhân viên không hưởng phụ cấp thâm niên → không giữ mốc PCTN
    if (!huongPctn) formatted.mocHuongPctn = undefined
    const { bacLuongId, phuCaps: phuCapsRaw, ...vcData } = formatted
    // Chốt chặn cuối: không ghi PC thâm niên cho vị trí không được hưởng
    const pcThamNienId = loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN')?.id
    const phuCaps = huongPctn
      ? phuCapsRaw
      : (phuCapsRaw || []).filter((pc: any) => pc?.loaiPhuCapId !== pcThamNienId)
    const mocHuongLuongStr: string | undefined = mocHuongLuong?.format('YYYY-MM-DD')

    if (isEdit && vc) {
      updateVienChuc(id!, vcData, currentUser?.id, currentUser?.fullName)

      const selectedBacLuong = bacLuongs.find((b) => b.id === bacLuongId)
      const currentHeSo = luongState.getActiveHeSo(id)
      if (
        selectedBacLuong &&
        (!currentHeSo || currentHeSo.bac !== selectedBacLuong.bac || currentHeSo.chucDanhId !== values.chucDanhId)
      ) {
        if (currentHeSo) luongState.deactivateHeSoLuong(currentHeSo.id)
        const ngayHieuLuc = mocHuongLuongStr || dayjs().format('YYYY-MM-DD')
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
        const ngayHieuLuc = mocHuongLuongStr || vcData.ngayVaoNganh || dayjs().format('YYYY-MM-DD')
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

      message.success('Thêm hồ sơ nhân sự thành công')
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
      <Title level={4}>{isEdit ? 'Chỉnh sửa hồ sơ' : 'Thêm hồ sơ nhân sự mới'}</Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ gioiTinh: 'NU', loaiLaoDong: 'VIEN_CHUC', hinhThucLuong: 'HE_SO', phuCaps: [], trangThai: 'DANG_LAM_VIEC', laDangVien: false, mocHuongLuong: dayjs(), donViId: scopeDonViId ?? undefined }}
      >
        {/* ── Thông tin cá nhân ── */}
        <Divider titlePlacement="left">Thông tin cá nhân</Divider>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="hoTenFull"
              label="Họ và tên"
              rules={[{ required: true, message: 'Nhập họ và tên' }]}
              getValueFromEvent={(e) => e.target.value.toLocaleUpperCase('vi')}
              extra="Họ tên luôn được lưu IN HOA"
            >
              <Input placeholder="VD: NGUYỄN THỊ HOA" style={{ textTransform: 'uppercase' }} />
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
            <Form.Item name="laDangVien" label="Đảng viên">
              <Select options={[{ value: true, label: 'Có' }, { value: false, label: 'Không' }]} />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Thông tin công tác ── */}
        <Divider titlePlacement="left">Thông tin công tác</Divider>
        <Row gutter={16}>
          {!isCBTruong && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="donViId" label="Đơn vị công tác" rules={[{ required: true }]}>
                <Select options={donViOptions} placeholder="Chọn đơn vị" showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="loaiLaoDong" label="Loại hình lao động" rules={[{ required: true }]}>
              <Select
                options={Object.entries(LOAI_LAO_DONG_LABELS).filter(([k]) => k !== 'TAP_SU').map(([k, v]) => ({ value: k, label: v }))}
                onChange={(v: LoaiLaoDong) => {
                  // Chuyển sang hợp đồng → gỡ các lỗi "bắt buộc" còn sót của viên chức biên chế
                  if (v !== 'VIEN_CHUC') {
                    form.setFields([{ name: 'chucDanhId', errors: [] }, { name: 'bacLuongId', errors: [] }])
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="vtvl"
              label="VTVL (Vị trí việc làm)"
              rules={[{ required: true, message: 'Chọn VTVL' }]}
              tooltip="VTVL quyết định nhóm ngạch/hạng được chọn và quyền hưởng phụ cấp thâm niên"
            >
              <Select
                options={vtvlOptions}
                placeholder="Chọn VTVL"
                onChange={(v: string) => {
                  // Ngạch đang chọn không còn hợp lệ với VTVL mới → bỏ ngạch và bậc lương kèm theo
                  const dangChon = chucDanhs.find((c) => c.id === form.getFieldValue('chucDanhId'))
                  if (dangChon && !chucDanhHopLeVoiVtvl(dangChon.nhom, v)) {
                    form.setFieldsValue({ chucDanhId: undefined, bacLuongId: undefined })
                    message.info(`Ngạch "${dangChon.ma} — ${dangChon.ten}" không thuộc VTVL vừa chọn, vui lòng chọn lại ngạch/hạng`)
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="chucVu" label="Chức vụ">
              <Select options={chucVuOptions} placeholder="Không (giáo viên/nhân viên)" allowClear />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="chucDanhId"
              label={nhanBienChe('Mã ngạch/Hạng')}
              rules={[{ required: laBienChe, message: 'Chọn mã ngạch/hạng' }]}
            >
              <Select
                options={chucDanhOptions}
                placeholder={laBienChe ? 'Chọn chức danh' : 'Không bắt buộc'}
                showSearch
                allowClear={!laBienChe}
                optionFilterProp="label"
                onChange={() => form.setFieldValue('bacLuongId', undefined)}
              />
            </Form.Item>
          </Col>
          {laBienChe && (
            <>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="nguonKinhPhi" label={nhanBienChe('Nguồn kinh phí')} rules={[{ required: true, message: 'Chọn nguồn kinh phí' }]}>
                  <Select options={Object.entries(NGUON_KINH_PHI_LABELS).map(([k, v]) => ({ value: k, label: v }))} placeholder="Chọn nguồn kinh phí" />
                </Form.Item>
              </Col>
            </>
          )}
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="trangThai"
              label="Trạng thái công tác"
              rules={[{ required: true }]}
              tooltip="Chuyển đi, Nghỉ hưu, Thôi việc: hồ sơ vẫn được giữ để tra cứu nhưng không tính vào bảng lương và báo cáo số liệu. Chuyển trong phường thì làm phiếu Chuyển công tác; chuyển ra ngoài tỉnh/phường thì đặt trạng thái Chuyển đi tại đây."
            >
              <Select options={Object.entries(TRANG_THAI_CONG_TAC_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
            </Form.Item>
          </Col>
          {watchTrangThai === 'CHUYEN_DI' && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="ngayChuyenDi" label="Ngày chuyển đi" rules={[{ required: true, message: 'Chọn ngày chuyển đi' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
          {pccvInfo && (
            <Col xs={24}>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                title={`Đã tự động thêm PC Chức vụ (hệ số +${pccvInfo.heSo.toFixed(2)} — ${HANG_TRUONG_LABELS[pccvInfo.hang]}, TT 33/2005) vào tổng hệ số lương`}
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
          {laBienChe && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="ngayVaoBienChe"
                label={nhanBienChe('Ngày vào biên chế')}
                rules={[{ required: true, message: 'Chọn ngày vào biên chế' }]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
        </Row>
        {laBienChe ? (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Các ô gắn nhãn <Tag color="blue" style={{ fontSize: 11, lineHeight: '16px' }}>VC biên chế</Tag>
            là thông tin bắt buộc theo quy định đối với viên chức biên chế.
          </Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Loại hình hợp đồng: Mã ngạch/Hạng và Bậc lương không bắt buộc; không khai nguồn kinh phí, ngày vào biên chế.
          </Text>
        )}

        {/* ── Trình độ & Nhiệm vụ ── */}
        <Divider titlePlacement="left">Trình độ & Nhiệm vụ</Divider>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="trinhDoChuyenMon" label="Trình độ chuyên môn nghiệp vụ">
              <Input placeholder="VD: Đại học Sư phạm Tiểu học" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="nhiemVuChinh" label="Nhiệm vụ chính">
              <Input placeholder="VD: Giảng dạy lớp 5A" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="trinhDoKhac" label="Trình độ khác">
              <Input placeholder="VD: Chuyên môn khác, tin học, ngoại ngữ, LLCT..." />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Lương & Phụ cấp ── */}
        <Divider titlePlacement="left">Lương & Phụ cấp</Divider>
        <Row gutter={16}>
          {!laBienChe && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="hinhThucLuong"
                label="Hình thức nhận lương"
                tooltip="Loại hình hợp đồng có thể nhận lương theo bậc/hệ số, hoặc theo một mức tiền cố định mỗi tháng"
                rules={[{ required: true }]}
              >
                <Select options={Object.entries(HINH_THUC_LUONG_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
          )}
          {luongTheoTien && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="mucLuongTien"
                label="Mức lương (VNĐ/tháng)"
                rules={[{ required: true, message: 'Nhập mức lương' }]}
              >
                <InputNumber<number>
                  min={0}
                  step={100000}
                  style={{ width: '100%' }}
                  placeholder="VD: 5.000.000"
                  formatter={(v) => (v == null || String(v) === '' ? '' : Number(v).toLocaleString('vi-VN'))}
                  parser={(v) => Number((v ?? '').replace(/\D/g, ''))}
                  suffix="đ"
                />
              </Form.Item>
            </Col>
          )}
          {!luongTheoTien && (<>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="bacLuongId"
              label={nhanBienChe('Bậc lương')}
              rules={[{ required: laBienChe && !isEdit, message: 'Chọn bậc lương' }]}
            >
              <Select
                options={bacLuongOptions}
                placeholder={watchChucDanhId ? (laBienChe ? 'Chọn bậc lương' : 'Không bắt buộc') : 'Chọn chức danh trước'}
                disabled={!watchChucDanhId}
                allowClear={!laBienChe}
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
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="mocHuongLuong"
              label="Mốc hưởng lương"
              tooltip="Ngày hiệu lực bậc lương — chỉ áp dụng khi thêm mới hoặc thay đổi bậc lương"
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn mốc hưởng lương" />
            </Form.Item>
          </Col>
          </>)}
          {duocHuongPctn && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="mocHuongPctn"
                label="Mốc hưởng PCTN"
                tooltip="Mốc hưởng phụ cấp thâm niên — căn cứ để trường đề xuất nâng 1%/năm ở kỳ sau (6 tháng đầu hoặc cuối năm). Chỉ áp dụng với CBQL và giáo viên."
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn mốc hưởng PCTN" />
              </Form.Item>
            </Col>
          )}
        </Row>
        {!duocHuongPctn && watchVtvl && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Vị trí việc làm Nhân viên không hưởng phụ cấp thâm niên nên không khai báo mốc hưởng PCTN.
          </Text>
        )}

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
            PC Thâm niên nghề (CBQL, giáo viên) vẫn giữ nguyên, hưởng song song với PC ưu đãi nhà giáo.
            PC ưu đãi nhà giáo chọn theo cấp học (NĐ 182/2026): mầm non, tiểu học 45%; THCS 40%; nhân viên 20%.
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
                      <Form.Item
                        {...restField}
                        name={[name, 'giaTri']}
                        style={{ marginBottom: 8 }}
                        rules={[{
                          // Loại "Hệ số" (chức vụ, trách nhiệm, chênh lệch bảo lưu) nhập giá trị hệ số, không phải %
                          validator: (_, v) => {
                            const loai = loaiPhuCaps.find((p) => p.id === form.getFieldValue(['phuCaps', name, 'loaiPhuCapId']))
                            return loai?.loaiCongThuc === 'HE_SO' && v >= 5
                              ? Promise.reject(new Error(`Nhập hệ số (VD ${(v / 100).toLocaleString('vi')}), không nhập %`))
                              : Promise.resolve()
                          },
                        }]}
                      >
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
