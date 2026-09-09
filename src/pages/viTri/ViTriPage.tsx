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
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const updateDonVi = useDanhMucStore((s) => s.updateDonVi)
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const LOAI_ORDER: Record<string, number> = { MAM_NON: 1, TIEU_HOC: 2, THCS: 3, OTHER: 4 }
  const viTris = useMemo(() => allViTris.filter((v) => v.active), [allViTris])
  const donVis = useMemo(() => allDonVis.filter((d) => d.active).sort((a, b) => {
    const oa = LOAI_ORDER[a.loai] ?? 4; const ob = LOAI_ORDER[b.loai] ?? 4
    if (oa !== ob) return oa - ob
    return a.ten.localeCompare(b.ten, 'vi')
  }), [allDonVis])
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && isDangCongTac(v)), [allVienChucs])
  const canEdit = hasPermission('viTri', 'write')

  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  // Gộp theo từng trường: mỗi trường là 1 khối gồm các vị trí (chỉ hiển thị số có mặt)
  // + 1 dòng "Tổng cộng" mang chỉ tiêu giao cho cả trường (không giao chi tiết từng vị trí)
  const data = useMemo(() => {
    const scopedDonVis = scopeDonViId ? donVis.filter((d) => d.id === scopeDonViId) : donVis
    const rows: any[] = []

    // Chức danh nghề nghiệp là danh mục tùy biến → gom theo NHÓM chức danh
    // để không bỏ sót chức danh mới do admin thêm
    const nvChucDanhIds = chucDanhs.filter((c) => c.nhom === 'NHAN_VIEN').map((c) => c.id)
    const gvChucDanhIds = chucDanhs.filter((c) => c.nhom === 'GIAO_VIEN').map((c) => c.id)

    scopedDonVis.forEach((dv) => {
      const vts = viTris.filter((v) => v.donViId === dv.id)
      if (vts.length === 0) return
      const vcInDv = vienChucs.filter((vc) => vc.donViId === dv.id)

      // Các vị trí hỗ trợ được gộp thành 1 dòng "Nhân viên hỗ trợ" (cộng hết mọi chức danh nhóm nhân viên)
      const vtsQuanLyChuyenMon = vts.filter((v) => v.loai !== 'HO_TRO')
      const coViTriHoTro = vts.some((v) => v.loai === 'HO_TRO')
      const soDongViTri = vtsQuanLyChuyenMon.length + (coViTriHoTro ? 1 : 0)

      const buildRow = (matched: typeof vcInDv) => {
        const coMatNS = matched.filter((vc) => vc.nguonKinhPhi === 'NGAN_SACH').length
        const coMatSN = matched.filter((vc) => vc.nguonKinhPhi === 'SU_NGHIEP').length
        return { coMatNS, coMatSN, coMatHD: matched.length - coMatNS - coMatSN, coMatTong: matched.length }
      }

      let subNS = 0, subSN = 0, subHD = 0
      const positionRows = vtsQuanLyChuyenMon.map((vt, idx) => {
        let matched: typeof vcInDv
        if (vt.ten === 'Hiệu trưởng') {
          matched = vcInDv.filter((vc) => vc.chucVu === 'HIEU_TRUONG')
        } else if (vt.ten === 'Phó Hiệu trưởng') {
          matched = vcInDv.filter((vc) => vc.chucVu === 'PHO_HIEU_TRUONG')
        } else if (vt.loai === 'CHUYEN_MON') {
          matched = vcInDv.filter((vc) =>
            gvChucDanhIds.includes(vc.chucDanhId) && vc.chucVu !== 'HIEU_TRUONG' && vc.chucVu !== 'PHO_HIEU_TRUONG'
          )
        } else {
          matched = vcInDv.filter((vc) => vt.chucDanhIds.includes(vc.chucDanhId))
        }
        const counts = buildRow(matched)
        subNS += counts.coMatNS
        subSN += counts.coMatSN
        subHD += counts.coMatHD

        return {
          ...vt,
          id: vt.id,
          rowType: 'position' as const,
          donViTen: dv.ten,
          ...counts,
          groupSize: soDongViTri + 1,
          isFirstInGroup: idx === 0,
        }
      })
      rows.push(...positionRows)

      if (coViTriHoTro) {
        const matchedNv = vcInDv.filter((vc) => nvChucDanhIds.includes(vc.chucDanhId))
        const counts = buildRow(matchedNv)
        subNS += counts.coMatNS
        subSN += counts.coMatSN
        subHD += counts.coMatHD
        // Chi tiết từng chức danh nhân viên để hiển thị tooltip khi rê chuột
        const chiTietNv = chucDanhs
          .filter((c) => c.nhom === 'NHAN_VIEN' && c.active)
          .map((c) => ({ ten: c.ten, so: matchedNv.filter((vc) => vc.chucDanhId === c.id).length }))

        rows.push({
          id: `hotro_${dv.id}`,
          rowType: 'position' as const,
          ten: 'Nhân viên hỗ trợ',
          loai: 'HO_TRO',
          donViTen: dv.ten,
          ...counts,
          chiTietNv,
          groupSize: soDongViTri + 1,
          isFirstInGroup: vtsQuanLyChuyenMon.length === 0,
        })
      }

      const chiTieuNS = dv.chiTieuBienCheNganSach ?? 0
      const chiTieuSN = dv.chiTieuBienCheSuNghiep ?? 0
      const chiTieuHD = dv.chiTieuHopDong ?? 0
      const chiTieuCoNuoi = dv.chiTieuCoNuoi ?? 0
      const chiTieuTong = chiTieuNS + chiTieuSN + chiTieuHD + chiTieuCoNuoi
      const coMatTong = subNS + subSN + subHD
      rows.push({
        id: `subtotal_${dv.id}`,
        rowType: 'subtotal' as const,
        donViId: dv.id,
        donViTen: dv.ten,
        donViLoai: dv.loai,
        chiTieuNS, chiTieuSN, chiTieuHD, chiTieuCoNuoi, chiTieuTong,
        coMatNS: subNS, coMatSN: subSN, coMatHD: subHD, coMatTong,
        overQuota: coMatTong > chiTieuTong,
      })
    })

    return rows
  }, [viTris, vienChucs, scopeDonViId, donVis, chucDanhs])

  const onSave = (values: any) => {
    updateDonVi(editing.donViId, values)
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
      title: 'Vị trí', dataIndex: 'ten', key: 'ten', width: 150, ellipsis: true,
      render: (v: string, r: any) => r.rowType === 'subtotal' ? <Text strong>Tổng cộng</Text> : v,
    },
    {
      title: 'Loại', dataIndex: 'loai', key: 'loai', width: 110,
      render: (v: string, r: any) => r.rowType === 'subtotal' ? '' : <span style={{ whiteSpace: 'nowrap' }}>{LOAI_LABELS[v] ?? v}</span>,
    },
    {
      title: 'Chỉ tiêu giao (theo trường)',
      children: [
        {
          title: 'Ngân sách', dataIndex: 'chiTieuNS', key: 'ctns', width: 90, align: 'center' as const,
          render: (v: number, r: any) => r.rowType === 'subtotal' ? <Text strong>{v}</Text> : '',
        },
        {
          title: 'Sự nghiệp', dataIndex: 'chiTieuSN', key: 'ctsn', width: 90, align: 'center' as const,
          render: (v: number, r: any) => r.rowType === 'subtotal' ? <Text strong>{v}</Text> : '',
        },
        {
          title: 'Cô nuôi MN', dataIndex: 'chiTieuCoNuoi', key: 'ctcn', width: 90, align: 'center' as const,
          render: (v: number, r: any) => r.rowType === 'subtotal' ? (v > 0 ? <Text strong>{v}</Text> : <Text type="secondary">—</Text>) : '',
        },
        {
          title: 'Hợp đồng', dataIndex: 'chiTieuHD', key: 'cthd', width: 90, align: 'center' as const,
          render: (v: number, r: any) => r.rowType === 'subtotal' ? <Text strong>{v}</Text> : '',
        },
        {
          title: 'Tổng', dataIndex: 'chiTieuTong', key: 'cttong', width: 80, align: 'center' as const,
          render: (v: number, r: any) => r.rowType === 'subtotal' ? <Text strong>{v}</Text> : '',
        },
      ],
    },
    {
      title: 'Số có mặt',
      children: [
        { title: 'Ngân sách', dataIndex: 'coMatNS', key: 'cmns', width: 90, align: 'center' as const, render: (v: number, r: any) => r.rowType === 'subtotal' ? <Text strong>{v}</Text> : v },
        { title: 'Sự nghiệp', dataIndex: 'coMatSN', key: 'cmsn', width: 90, align: 'center' as const, render: (v: number, r: any) => r.rowType === 'subtotal' ? <Text strong>{v}</Text> : v },
        { title: 'Hợp đồng', dataIndex: 'coMatHD', key: 'cmhd', width: 90, align: 'center' as const, render: (v: number, r: any) => r.rowType === 'subtotal' ? <Text strong>{v}</Text> : v },
        {
          title: 'Tổng', dataIndex: 'coMatTong', key: 'cmtong', width: 80, align: 'center' as const,
          render: (v: number, r: any) => (
            <span style={{ color: r.overQuota ? '#f5222d' : 'inherit', fontWeight: r.overQuota || r.rowType === 'subtotal' ? 700 : 400 }}>
              {r.overQuota && <Tooltip title="Vượt chỉ tiêu!"><WarningOutlined style={{ color: '#f5222d', marginRight: 4 }} /></Tooltip>}
              {r.chiTietNv ? (
                <Tooltip
                  title={
                    r.chiTietNv.length > 0
                      ? <div>{r.chiTietNv.map((x: any) => <div key={x.ten}>{x.ten}: <b>{x.so}</b></div>)}</div>
                      : 'Chưa có nhân viên hỗ trợ'
                  }
                >
                  <span style={{ borderBottom: '1px dashed #999', cursor: 'help' }}>{v}</span>
                </Tooltip>
              ) : v}
            </span>
          ),
        },
      ],
    },
    {
      title: 'Tỷ lệ', key: 'ratio', width: 120,
      render: (_: any, r: any) => r.rowType === 'subtotal' ? (
        <Progress
          percent={r.chiTieuTong > 0 ? Math.round((r.coMatTong / r.chiTieuTong) * 100) : 0}
          size="small"
          status={r.overQuota ? 'exception' : r.coMatTong === r.chiTieuTong ? 'success' : 'active'}
        />
      ) : null,
    },
    ...(canEdit ? [{
      title: '', key: 'act', width: 130,
      render: (_: any, r: any) => r.rowType === 'subtotal' ? (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            setEditing(r)
            form.setFieldsValue({
              chiTieuBienCheNganSach: r.chiTieuNS,
              chiTieuBienCheSuNghiep: r.chiTieuSN,
              chiTieuCoNuoi: r.chiTieuCoNuoi,
              chiTieuHopDong: r.chiTieuHD,
            })
          }}
        >
          Giao chỉ tiêu
        </Button>
      ) : null,
    }] : []),
  ]

  // Gán màu nền xen kẽ cho từng khối trường
  const groupColors = ['#e6f4ff', '#f6ffed', '#fff7e6', '#f9f0ff', '#fff1f0', '#e6fffb', '#fffbe6', '#fff0f6', '#f0f5ff', '#fcffe6', '#fff2e8']
  const donViColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    let idx = 0
    for (const row of data) {
      if (row.rowType === 'position' && row.isFirstInGroup) {
        if (!map[row.donViTen]) { map[row.donViTen] = groupColors[idx % groupColors.length]; idx++ }
      } else if (row.rowType === 'subtotal') {
        if (!map[row.donViTen]) { map[row.donViTen] = groupColors[idx % groupColors.length]; idx++ }
      }
    }
    return map
  }, [data])

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 16 }}>Vị trí việc làm & Chỉ tiêu biên chế</Title>
      <style>{`
        .vt-table .ant-table-cell { padding: 3px 8px !important; line-height: 1.4 !important; }
        .vt-table .ant-table-thead .ant-table-cell { padding: 5px 8px !important; }
        .vt-subtotal-row td { border-top: 2px solid #096dd9 !important; background: transparent !important; font-weight: 700; }
        .vt-subtotal-row td.ant-table-cell-fix-left { background: inherit !important; }
      `}</style>
      <Table
        className="vt-table"
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        bordered
        scroll={{ x: 1350 }}
        pagination={false}
        rowClassName={(r) => r.rowType === 'subtotal' ? 'vt-subtotal-row' : ''}
        onRow={(r) => ({ style: { backgroundColor: donViColorMap[r.donViTen] ?? 'transparent' } })}
      />

      <Modal open={!!editing} title={`Giao chỉ tiêu: ${editing?.donViTen}`} onCancel={() => setEditing(null)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="chiTieuBienCheNganSach" label="Biên chế — Hưởng lương ngân sách" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="chiTieuBienCheSuNghiep" label="Biên chế — Nguồn thu sự nghiệp" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          {editing?.donViLoai === 'MAM_NON' && (
            <Form.Item name="chiTieuCoNuoi" label="Cô nuôi mầm non">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item name="chiTieuHopDong" label="Hợp đồng" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
