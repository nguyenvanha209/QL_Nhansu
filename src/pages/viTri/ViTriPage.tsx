import { useMemo, useState } from 'react'
import { Table, Card, Typography, Progress, Tooltip, Button, Modal, Form, InputNumber, App } from 'antd'
import { WarningOutlined, EditOutlined } from '@ant-design/icons'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useAuth } from '@/hooks/useAuth'
import { isDangCongTac } from '@/types/vienChuc'

const { Title, Text } = Typography

const LOAI_LABELS: Record<string, string> = { QUAN_LY: 'Quản lý', CHUYEN_MON: 'Chuyên môn', HO_TRO: 'Hỗ trợ' }

export default function ViTriPage() {
  const { message } = App.useApp()
  const { scopeDonViId, hasPermission } = useAuth()
  const allViTris = useDanhMucStore((s) => s.viTriViecLams)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const updateViTriViecLam = useDanhMucStore((s) => s.updateViTriViecLam)
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const viTris = useMemo(() => allViTris.filter((v) => v.active), [allViTris])
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && isDangCongTac(v)), [allVienChucs])
  const canEdit = hasPermission('viTri', 'write')

  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  // Gộp theo từng trường: mỗi trường là 1 khối gồm các vị trí + 1 dòng "Tổng cộng"
  const data = useMemo(() => {
    const scopedDonVis = scopeDonViId ? donVis.filter((d) => d.id === scopeDonViId) : donVis
    const rows: any[] = []

    scopedDonVis.forEach((dv) => {
      const vts = viTris.filter((v) => v.donViId === dv.id)
      if (vts.length === 0) return
      const vcInDv = vienChucs.filter((vc) => vc.donViId === dv.id)

      let subNS = 0, subSN = 0, subHD = 0, subThucTe = 0
      const positionRows = vts.map((vt, idx) => {
        let thucTe: number
        if (vt.ten === 'Hiệu trưởng') {
          thucTe = vcInDv.filter((vc) => vc.chucVu === 'HIEU_TRUONG').length
        } else if (vt.ten === 'Phó Hiệu trưởng') {
          thucTe = vcInDv.filter((vc) => vc.chucVu === 'PHO_HIEU_TRUONG').length
        } else if (vt.loai === 'CHUYEN_MON') {
          thucTe = vcInDv.filter((vc) =>
            vt.chucDanhIds.includes(vc.chucDanhId) && vc.chucVu !== 'HIEU_TRUONG' && vc.chucVu !== 'PHO_HIEU_TRUONG'
          ).length
        } else {
          thucTe = vcInDv.filter((vc) => vt.chucDanhIds.includes(vc.chucDanhId)).length
        }
        const tongChiTieu = vt.soLuongBienCheNganSach + vt.soLuongBienCheSuNghiep + vt.soLuongHopDong
        subNS += vt.soLuongBienCheNganSach
        subSN += vt.soLuongBienCheSuNghiep
        subHD += vt.soLuongHopDong
        subThucTe += thucTe
        return {
          ...vt,
          id: vt.id,
          rowType: 'position' as const,
          donViTen: dv.ten,
          thucTe,
          tongChiTieu,
          overQuota: thucTe > tongChiTieu,
          groupSize: vts.length + 1,
          isFirstInGroup: idx === 0,
        }
      })
      rows.push(...positionRows)

      const subTong = subNS + subSN + subHD
      rows.push({
        id: `subtotal_${dv.id}`,
        rowType: 'subtotal' as const,
        donViTen: dv.ten,
        soLuongBienCheNganSach: subNS,
        soLuongBienCheSuNghiep: subSN,
        soLuongHopDong: subHD,
        tongChiTieu: subTong,
        thucTe: subThucTe,
        overQuota: subThucTe > subTong,
      })
    })

    return rows
  }, [viTris, vienChucs, scopeDonViId, donVis])

  const onSave = (values: any) => {
    updateViTriViecLam(editing.id, values)
    message.success('Đã giao chỉ tiêu')
    setEditing(null)
  }

  const columns = [
    {
      title: 'Trường', dataIndex: 'donViTen', key: 'dv', width: 150,
      render: (v: string) => <Text strong>{v}</Text>,
      onCell: (r: any) => ({ rowSpan: r.rowType === 'position' && r.isFirstInGroup ? r.groupSize : 0 }),
    },
    {
      title: 'Vị trí', dataIndex: 'ten', key: 'ten', ellipsis: true,
      render: (v: string, r: any) => r.rowType === 'subtotal' ? <Text strong>Tổng cộng</Text> : v,
    },
    {
      title: 'Loại', dataIndex: 'loai', key: 'loai', width: 90,
      render: (v: string, r: any) => r.rowType === 'subtotal' ? '' : (LOAI_LABELS[v] ?? v),
    },
    {
      title: 'Chỉ tiêu giao',
      children: [
        {
          title: 'Ngân sách', dataIndex: 'soLuongBienCheNganSach', key: 'bcns', width: 90, align: 'center' as const,
          render: (v: number, r: any) => r.rowType === 'subtotal' ? <Text strong>{v}</Text> : v,
        },
        {
          title: 'Sự nghiệp', dataIndex: 'soLuongBienCheSuNghiep', key: 'bcsn', width: 90, align: 'center' as const,
          render: (v: number, r: any) => r.rowType === 'subtotal' ? <Text strong>{v}</Text> : v,
        },
        {
          title: 'Hợp đồng', dataIndex: 'soLuongHopDong', key: 'hd', width: 90, align: 'center' as const,
          render: (v: number, r: any) => r.rowType === 'subtotal' ? <Text strong>{v}</Text> : v,
        },
        {
          title: 'Tổng', dataIndex: 'tongChiTieu', key: 'tct', width: 80, align: 'center' as const,
          render: (v: number) => <Text strong>{v}</Text>,
        },
      ],
    },
    {
      title: 'Số có mặt', dataIndex: 'thucTe', key: 'tt', width: 100, align: 'center' as const,
      render: (v: number, r: any) => (
        <span style={{ color: r.overQuota ? '#f5222d' : 'inherit', fontWeight: r.overQuota || r.rowType === 'subtotal' ? 700 : 400 }}>
          {r.overQuota && <Tooltip title="Vượt chỉ tiêu!"><WarningOutlined style={{ color: '#f5222d', marginRight: 4 }} /></Tooltip>}
          {v}
        </span>
      ),
    },
    {
      title: 'Tỷ lệ', key: 'ratio', width: 120,
      render: (_: any, r: any) => (
        <Progress
          percent={r.tongChiTieu > 0 ? Math.round((r.thucTe / r.tongChiTieu) * 100) : 0}
          size="small"
          status={r.overQuota ? 'exception' : r.thucTe === r.tongChiTieu ? 'success' : 'active'}
        />
      ),
    },
    ...(canEdit ? [{
      title: '', key: 'act', width: 130,
      render: (_: any, r: any) => r.rowType === 'subtotal' ? null : (
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r) }}>Giao chỉ tiêu</Button>
      ),
    }] : []),
  ]

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 16 }}>Vị trí việc làm & Chỉ tiêu biên chế</Title>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        bordered
        scroll={{ x: 1050 }}
        pagination={false}
        rowClassName={(r) => r.rowType === 'subtotal' ? 'vt-subtotal-row' : r.overQuota ? 'ant-table-row-selected' : ''}
      />

      <Modal open={!!editing} title={`Giao chỉ tiêu: ${editing?.ten} — ${editing?.donViTen}`} onCancel={() => setEditing(null)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="soLuongBienCheNganSach" label="Biên chế — Hưởng lương ngân sách" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="soLuongBienCheSuNghiep" label="Biên chế — Nguồn thu sự nghiệp" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="soLuongHopDong" label="Hợp đồng" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
