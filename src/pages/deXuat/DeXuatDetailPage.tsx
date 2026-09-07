import { useParams, useNavigate } from 'react-router-dom'
import { Card, Steps, Button, Table, Tag, Descriptions, Modal, Input, Select, Space, Typography, Result, message, Divider } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, SyncOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/helpers'
import { TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '@/types/deXuat'

const { Title, Text } = Typography
const { TextArea } = Input

export default function DeXuatDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser, isVHXH, isLanhDao, isAdmin } = useAuth()
  const getById = useDeXuatStore((s) => s.getById)
  const { submitDeXuat, xetDuyetDeXuat, pheDuyetDeXuat } = useDeXuatStore.getState()
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

  const stepItems = [
    { title: 'Trường đề xuất', description: dx.ngayDeXuat ? formatDate(dx.ngayDeXuat) : 'Chờ nộp' },
    { title: 'VH-XH thẩm định', description: dx.ngayXetDuyet ? `${formatDate(dx.ngayXetDuyet)} — ${dx.ketQuaXetDuyet}` : 'Chờ xử lý' },
    { title: 'Lãnh đạo phê duyệt', description: dx.ngayPheDuyet ? `${formatDate(dx.ngayPheDuyet)} — ${dx.ketQuaPheDuyet}` : 'Chờ duyệt' },
  ]

  const currentStep = dx.trangThai === 'NHAP' ? 0 : dx.trangThai === 'CHO_XET_DUYET' ? 1 : dx.trangThai === 'CHO_PHE_DUYET' ? 2 : 3

  const detailCols = [
    { title: 'Viên chức', key: 'vc', render: (_: any, r: any) => { const vc = vienChucs.find((v) => v.id === r.vienChucId); return vc ? `${vc.ho} ${vc.ten}` : r.vienChucId } },
    { title: 'CD cũ', key: 'cdc', render: (_: any, r: any) => chucDanhs.find((c) => c.id === r.chucDanhCuId)?.ten ?? r.chucDanhCuId },
    { title: 'Bậc cũ → mới', key: 'bac', render: (_: any, r: any) => `${r.bacCu} (${r.heSoCu}) → ${r.bacMoi} (${r.heSoMoi})` },
    { title: 'CD mới', key: 'cdm', render: (_: any, r: any) => chucDanhs.find((c) => c.id === r.chucDanhMoiId)?.ten ?? r.chucDanhMoiId },
    { title: 'Ngày hiệu lực', dataIndex: 'ngayHieuLuc', key: 'nhl', render: (v: string) => formatDate(v) },
    { title: 'Lý do', dataIndex: 'lyDo', key: 'ld', ellipsis: true },
  ]

  const canSubmit = dx.trangThai === 'NHAP' && dx.nguoiDeXuatId === currentUser?.id
  const canXetDuyet = (isVHXH || isAdmin) && dx.trangThai === 'CHO_XET_DUYET'
  const canPheDuyet = (isLanhDao || isAdmin) && dx.trangThai === 'CHO_PHE_DUYET'

  const handleAction = () => {
    if (!currentUser) return
    setLoading(true)
    try {
      if (modalAction === 'submit') {
        submitDeXuat(id!, currentUser.id, currentUser.fullName)
        message.success('Đã nộp đề xuất lên VH-XH')
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
        message.success('Phê duyệt thành công — hồ sơ lương đã cập nhật')
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
          {dx.ghiChuDeXuat && <Descriptions.Item label="Ghi chú đề xuất" span={2}>{dx.ghiChuDeXuat}</Descriptions.Item>}
          {dx.ghiChuXetDuyet && <Descriptions.Item label="Ý kiến VH-XH" span={2}>{dx.ghiChuXetDuyet}</Descriptions.Item>}
          {dx.ghiChuPheDuyet && <Descriptions.Item label="Ý kiến lãnh đạo" span={2}>{dx.ghiChuPheDuyet}</Descriptions.Item>}
        </Descriptions>

        <Title level={5}>Chi tiết đề xuất ({dx.chiTiet.length} viên chức)</Title>
        <Table dataSource={dx.chiTiet} columns={detailCols} rowKey="vienChucId" size="small" pagination={false} scroll={{ x: 700 }} />

        <Divider />
        <Space wrap>
          {canSubmit && <Button type="primary" icon={<CheckOutlined />} onClick={() => openModal('submit')}>Nộp đề xuất lên VH-XH</Button>}
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
