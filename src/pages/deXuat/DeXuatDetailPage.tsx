import { useParams, useNavigate } from 'react-router-dom'
import { Card, Steps, Button, Table, Tag, Descriptions, Modal, Input, Select, Space, Typography, Result, Divider, App } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, SyncOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/helpers'
import { TRANG_THAI_LABELS, TRANG_THAI_COLORS, LOAI_DE_XUAT_LABELS } from '@/types/deXuat'

const { Title, Text } = Typography
const { TextArea } = Input

export default function DeXuatDetailPage() {
  const { message } = App.useApp()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser, isVHXH, isLanhDao, laQuanTri, isHieuTruong } = useAuth()
  const getById = useDeXuatStore((s) => s.getById)
  const { submitDeXuat, duyetHieuTruong, xetDuyetDeXuat, pheDuyetDeXuat } = useDeXuatStore.getState()
  const donVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const vienChucs = useVienChucStore((s) => s.vienChucs)

  const dx = getById(id!)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalAction, setModalAction] = useState<string>('')
  const [ghiChu, setGhiChu] = useState('')
  const [loading, setLoading] = useState(false)

  if (!dx) return <Result status="404" title="Không tìm thấy đề xuất" extra={<Button onClick={() => navigate('/de-xuat')}>Quay lại</Button>} />

  const donVi = donVis.find((d) => d.id === dx.donViId)

  const laPctn = dx.loai === 'PHU_CAP_THAM_NIEN'

  const ketQuaLabel = (kq?: string) => kq === 'DONG_Y' ? 'Đồng ý' : kq === 'PHE_DUYET' ? 'Phê duyệt' : kq === 'TU_CHOI' ? 'Từ chối' : kq === 'YEU_CAU_BO_SUNG' ? 'Yêu cầu bổ sung' : ''

  const stepItems = [
    { title: 'Kế toán trường lập', content: dx.ngayDeXuat ? formatDate(dx.ngayDeXuat) : 'Chờ nộp' },
    { title: 'Hiệu trưởng duyệt', content: dx.ngayDuyetHT ? `${formatDate(dx.ngayDuyetHT)} — ${ketQuaLabel(dx.ketQuaDuyetHT)}` : 'Chờ duyệt' },
    { title: 'VH-XH thẩm định', content: dx.ngayXetDuyet ? `${formatDate(dx.ngayXetDuyet)} — ${ketQuaLabel(dx.ketQuaXetDuyet)}` : 'Chờ xử lý' },
    { title: 'Lãnh đạo phê duyệt', content: dx.ngayPheDuyet ? `${formatDate(dx.ngayPheDuyet)} — ${ketQuaLabel(dx.ketQuaPheDuyet)}` : 'Chờ duyệt' },
  ]

  const currentStep = dx.trangThai === 'NHAP' ? 0
    : dx.trangThai === 'CHO_HIEU_TRUONG_DUYET' ? 1
    : dx.trangThai === 'CHO_XET_DUYET' ? 2
    : dx.trangThai === 'CHO_PHE_DUYET' ? 3
    : 4

  const colVienChuc = { title: 'Viên chức', key: 'vc', render: (_: any, r: any) => { const vc = vienChucs.find((v) => v.id === r.vienChucId); return vc ? `${vc.ho} ${vc.ten}` : r.vienChucId } }
  const colLyDo = { title: 'Lý do', dataIndex: 'lyDo', key: 'ld', ellipsis: true }

  const detailCols = laPctn
    ? [
        colVienChuc,
        { title: 'PCTN cũ', key: 'pctnc', width: 90, render: (_: any, r: any) => `${r.pctnCu ?? 0}%` },
        { title: 'PCTN mới', key: 'pctnm', width: 100, render: (_: any, r: any) => <b>{r.pctnMoi ?? 0}%</b> },
        { title: 'Mốc hưởng PCTN', dataIndex: 'ngayHieuLuc', key: 'nhl', width: 140, render: (v: string) => formatDate(v) },
        colLyDo,
      ]
    : [
        colVienChuc,
        { title: 'CD cũ', key: 'cdc', render: (_: any, r: any) => chucDanhs.find((c) => c.id === r.chucDanhCuId)?.ten ?? r.chucDanhCuId },
        { title: 'Bậc cũ → mới', key: 'bac', render: (_: any, r: any) => `${r.bacCu} (${r.heSoCu}) → ${r.bacMoi} (${r.heSoMoi})` },
        { title: 'CD mới', key: 'cdm', render: (_: any, r: any) => chucDanhs.find((c) => c.id === r.chucDanhMoiId)?.ten ?? r.chucDanhMoiId },
        { title: 'Mốc hưởng lương', dataIndex: 'ngayHieuLuc', key: 'nhl', render: (v: string) => formatDate(v) },
        colLyDo,
      ]

  const canSubmit = dx.trangThai === 'NHAP' && dx.nguoiDeXuatId === currentUser?.id
  const canDuyetHT = (isHieuTruong || laQuanTri) && dx.trangThai === 'CHO_HIEU_TRUONG_DUYET'
  const canXetDuyet = (isVHXH || laQuanTri) && dx.trangThai === 'CHO_XET_DUYET'
  const canPheDuyet = (isLanhDao || laQuanTri) && dx.trangThai === 'CHO_PHE_DUYET'

  const handleAction = () => {
    if (!currentUser) return
    setLoading(true)
    try {
      if (modalAction === 'submit') {
        submitDeXuat(id!, currentUser.id, currentUser.fullName)
        message.success('Đã trình đề xuất lên Hiệu trưởng')
      } else if (modalAction === 'ht_approve') {
        duyetHieuTruong(id!, 'DONG_Y', ghiChu, currentUser.id, currentUser.fullName)
        message.success('Hiệu trưởng đã duyệt — chuyển VH-XH thẩm định')
      } else if (modalAction === 'ht_reject') {
        duyetHieuTruong(id!, 'TU_CHOI', ghiChu, currentUser.id, currentUser.fullName)
        message.warning('Đã từ chối đề xuất')
      } else if (modalAction === 'ht_supplement') {
        duyetHieuTruong(id!, 'YEU_CAU_BO_SUNG', ghiChu, currentUser.id, currentUser.fullName)
        message.info('Đã yêu cầu bổ sung hồ sơ')
      } else if (modalAction === 'xd_approve') {
        xetDuyetDeXuat(id!, 'DONG_Y', ghiChu, currentUser.id, currentUser.fullName)
        message.success('Đã thẩm định — chuyển Lãnh đạo phê duyệt')
      } else if (modalAction === 'xd_reject') {
        xetDuyetDeXuat(id!, 'TU_CHOI', ghiChu, currentUser.id, currentUser.fullName)
        message.warning('Đã từ chối đề xuất')
      } else if (modalAction === 'xd_supplement') {
        xetDuyetDeXuat(id!, 'YEU_CAU_BO_SUNG', ghiChu, currentUser.id, currentUser.fullName)
        message.info('Đã yêu cầu bổ sung hồ sơ')
      } else if (modalAction === 'pd_approve') {
        pheDuyetDeXuat(id!, 'PHE_DUYET', ghiChu, currentUser.id, currentUser.fullName)
        message.success(laPctn ? 'Phê duyệt thành công — phụ cấp thâm niên đã cập nhật' : 'Phê duyệt thành công — hồ sơ lương đã cập nhật')
      } else if (modalAction === 'pd_reject') {
        pheDuyetDeXuat(id!, 'TU_CHOI', ghiChu, currentUser.id, currentUser.fullName)
        message.warning('Đã từ chối')
      }
    } finally {
      setLoading(false)
      setModalOpen(false)
      setGhiChu('')
    }
  }

  const openModal = (action: string) => { setModalAction(action); setGhiChu(''); setModalOpen(true) }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/de-xuat')}>Quay lại</Button>
      </Space>

      <Card title={<><Tag color={TRANG_THAI_COLORS[dx.trangThai]}>{TRANG_THAI_LABELS[dx.trangThai]}</Tag> {dx.ma} — {dx.tieuDe}</>}>
        <Steps current={currentStep} items={stepItems} size="small" style={{ marginBottom: 24 }} />

        <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Đơn vị">{donVi?.ten ?? dx.donViId}</Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">{formatDate(dx.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="Loại đề xuất" span={2}>{LOAI_DE_XUAT_LABELS[dx.loai]}</Descriptions.Item>
          {dx.ghiChuDeXuat && <Descriptions.Item label="Ghi chú đề xuất" span={2}>{dx.ghiChuDeXuat}</Descriptions.Item>}
          {dx.ghiChuDuyetHT && <Descriptions.Item label="Ý kiến Hiệu trưởng" span={2}>{dx.ghiChuDuyetHT}</Descriptions.Item>}
          {dx.ghiChuXetDuyet && <Descriptions.Item label="Ý kiến VH-XH" span={2}>{dx.ghiChuXetDuyet}</Descriptions.Item>}
          {dx.ghiChuPheDuyet && <Descriptions.Item label="Ý kiến lãnh đạo" span={2}>{dx.ghiChuPheDuyet}</Descriptions.Item>}
        </Descriptions>

        <Title level={5}>Chi tiết đề xuất ({dx.chiTiet.length} viên chức)</Title>
        <Table dataSource={dx.chiTiet} columns={detailCols} rowKey="vienChucId" size="small" pagination={false} scroll={{ x: 700 }} />

        <Divider />
        <Space wrap>
          {canSubmit && <Button type="primary" icon={<CheckOutlined />} onClick={() => openModal('submit')}>Trình Hiệu trưởng duyệt</Button>}
          {canDuyetHT && <>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => openModal('ht_approve')}>Duyệt — chuyển VH-XH</Button>
            <Button icon={<SyncOutlined />} onClick={() => openModal('ht_supplement')}>Yêu cầu bổ sung</Button>
            <Button danger icon={<CloseOutlined />} onClick={() => openModal('ht_reject')}>Từ chối</Button>
          </>}
          {canXetDuyet && <>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => openModal('xd_approve')}>Đồng ý — chuyển lãnh đạo</Button>
            <Button icon={<SyncOutlined />} onClick={() => openModal('xd_supplement')}>Yêu cầu bổ sung</Button>
            <Button danger icon={<CloseOutlined />} onClick={() => openModal('xd_reject')}>Từ chối</Button>
          </>}
          {canPheDuyet && <>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => openModal('pd_approve')}>Phê duyệt</Button>
            <Button danger icon={<CloseOutlined />} onClick={() => openModal('pd_reject')}>Từ chối</Button>
          </>}
        </Space>
      </Card>

      <Modal
        open={modalOpen}
        title={modalAction.includes('approve') || modalAction === 'submit' ? 'Xác nhận' : 'Lý do từ chối / yêu cầu'}
        onCancel={() => setModalOpen(false)}
        onOk={handleAction}
        confirmLoading={loading}
        okText="Xác nhận"
        cancelText="Hủy"
      >
        <TextArea rows={4} placeholder="Nhập ghi chú / lý do..." value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
      </Modal>
    </div>
  )
}
