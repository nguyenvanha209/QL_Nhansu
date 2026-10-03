import { useMemo, useState } from 'react'
import { Table, Card, Typography, Progress, Tooltip, Button, Modal, Form, InputNumber, App } from 'antd'
import { WarningOutlined, EditOutlined } from '@ant-design/icons'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useAuth } from '@/hooks/useAuth'
import { isDangCongTac } from '@/types/vienChuc'
import { LOAI_DON_VI_LABELS } from '@/types/donVi'

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

      // Chỉ viên chức biên chế (kể cả tập sự) mới tính theo nguồn kinh phí; mọi loại hợp đồng vào cột HĐ,
      // kể cả hồ sơ hợp đồng nhập từ Excel còn ghi nguồn "Ngân sách"
      const laBienChe = (vc: (typeof vcInDv)[number]) => vc.loaiLaoDong === 'VIEN_CHUC' || vc.loaiLaoDong === 'TAP_SU'
      const buildRow = (matched: typeof vcInDv) => {
        const coMatNS = matched.filter((vc) => laBienChe(vc) && vc.nguonKinhPhi === 'NGAN_SACH').length
        const coMatSN = matched.filter((vc) => laBienChe(vc) && vc.nguonKinhPhi === 'SU_NGHIEP').length
        return { coMatNS, coMatSN, coMatHD: matched.length - coMatNS - coMatSN, coMatTong: matched.length }
      }

      let subNS = 0, subSN = 0, subHD = 0
      const positionRows = vtsQuanLyChuyenMon.map((vt, idx) => {
        let matched: typeof vcInDv
        if (vt.ten === 'Hiệu trưởng') {
          matched = vcInDv.filter((vc) => vc.chucVu === 'HT')
        } else if (vt.ten === 'Phó Hiệu trưởng') {
          matched = vcInDv.filter((vc) => vc.chucVu === 'P.HT')
        } else if (vt.loai === 'CHUYEN_MON') {
          matched = vcInDv.filter((vc) =>
            (gvChucDanhIds.includes(vc.chucDanhId) || (!vc.chucDanhId && vc.vtvl === 'GIAO_VIEN'))
            && vc.chucVu !== 'HT' && vc.chucVu !== 'P.HT'
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
        // Hợp đồng không bắt buộc mã ngạch → hồ sơ chưa có ngạch thì xếp theo VTVL Nhân viên
        const matchedNv = vcInDv.filter((vc) => nvChucDanhIds.includes(vc.chucDanhId) || (!vc.chucDanhId && vc.vtvl === 'NHAN_VIEN'))
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

    // Tài khoản của một trường chỉ thấy trường mình: không có tổng cấp, tổng phường
    if (scopeDonViId) return rows

    // Tách thành từng khối trường (mỗi khối kết thúc bằng dòng "Tổng cộng" của trường)
    const khoiTruong: { loai: string; rows: any[]; sub: any }[] = []
    let dangGom: any[] = []
    for (const r of rows) {
      dangGom.push(r)
      if (r.rowType === 'subtotal') {
        khoiTruong.push({ loai: r.donViLoai, rows: dangGom, sub: r })
        dangGom = []
      }
    }

    const CAC_COT = ['chiTieuNS', 'chiTieuSN', 'chiTieuHD', 'chiTieuCoNuoi', 'chiTieuTong', 'coMatNS', 'coMatSN', 'coMatHD', 'coMatTong'] as const
    const dongTong = (kieu: 'phuong' | 'cap', id: string, nhan: string, subs: any[]) => {
      const tong = Object.fromEntries(CAC_COT.map((k) => [k, subs.reduce((a, x) => a + (x[k] ?? 0), 0)])) as Record<(typeof CAC_COT)[number], number>
      return { id, rowType: kieu, nhan, soTruong: subs.length, ...tong, overQuota: tong.coMatTong > tong.chiTieuTong }
    }

    const ra: any[] = [dongTong('phuong', 'tong_phuong', 'TỔNG TOÀN PHƯỜNG', khoiTruong.map((k) => k.sub))]
    const thuTuCap = ['MAM_NON', 'TIEU_HOC', 'THCS', ...new Set(khoiTruong.map((k) => k.loai))].filter((v, i, a) => a.indexOf(v) === i)
    for (const loai of thuTuCap) {
      const cua = khoiTruong.filter((k) => k.loai === loai)
      if (!cua.length) continue
      const ten = loai === 'OTHER' ? 'Đơn vị khác' : `Cấp ${LOAI_DON_VI_LABELS[loai as keyof typeof LOAI_DON_VI_LABELS] ?? loai}`
      ra.push(dongTong('cap', `tong_cap_${loai}`, ten, cua.map((k) => k.sub)), ...cua.flatMap((k) => k.rows))
    }
    return ra
  }, [viTris, vienChucs, scopeDonViId, donVis, chucDanhs])

  const onSave = (values: any) => {
    updateDonVi(editing.donViId, values)
    message.success('Đã giao chỉ tiêu')
    setEditing(null)
  }

  // Dòng tổng cấp / tổng phường: nhãn gộp ba cột đầu, số liệu ở các cột bên phải
  const laTongGop = (r: any) => r.rowType === 'cap' || r.rowType === 'phuong'
  // Mọi dòng tổng (của trường, của cấp, của phường) hiển thị số theo cùng một cách
  const laTong = (r: any) => r.rowType !== 'position'

  const columns = [
    {
      title: 'Trường', dataIndex: 'donViTen', key: 'dv', width: 230,
      render: (v: string, r: any) => laTongGop(r)
        ? <Text strong style={{ fontSize: r.rowType === 'phuong' ? 14 : 13 }}>{r.nhan} <Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>({r.soTruong} trường)</Text></Text>
        : <Text strong>{v}</Text>,
      onCell: (r: any) => (laTongGop(r)
        ? { colSpan: 3 }
        : { rowSpan: r.rowType === 'position' && r.isFirstInGroup ? r.groupSize : 0 }),
    },
    {
      title: 'Vị trí', dataIndex: 'ten', key: 'ten', width: 223, ellipsis: true,
      onCell: (r: any) => (laTongGop(r) ? { colSpan: 0 } : {}),
      render: (v: string, r: any) => r.rowType === 'subtotal' ? <Text strong>Tổng cộng</Text> : v,
    },
    {
      title: 'Loại', dataIndex: 'loai', key: 'loai', width: 120,
      onCell: (r: any) => (laTongGop(r) ? { colSpan: 0 } : {}),
      render: (v: string, r: any) => laTong(r) ? '' : <span style={{ whiteSpace: 'nowrap' }}>{LOAI_LABELS[v] ?? v}</span>,
    },
    {
      title: 'Chỉ tiêu giao (theo trường)',
      children: [
        {
          title: 'Ngân sách', dataIndex: 'chiTieuNS', key: 'ctns', width: 80, align: 'center' as const,
          render: (v: number, r: any) => laTong(r) ? <Text strong>{v}</Text> : '',
        },
        {
          title: 'Sự nghiệp', dataIndex: 'chiTieuSN', key: 'ctsn', width: 80, align: 'center' as const,
          render: (v: number, r: any) => laTong(r) ? <Text strong>{v}</Text> : '',
        },
        {
          title: 'Cô nuôi MN', dataIndex: 'chiTieuCoNuoi', key: 'ctcn', width: 80, align: 'center' as const,
          render: (v: number, r: any) => laTong(r) ? (v > 0 ? <Text strong>{v}</Text> : <Text type="secondary">-</Text>) : '',
        },
        {
          title: 'Hợp đồng', dataIndex: 'chiTieuHD', key: 'cthd', width: 80, align: 'center' as const,
          render: (v: number, r: any) => laTong(r) ? <Text strong>{v}</Text> : '',
        },
        {
          title: 'Tổng', dataIndex: 'chiTieuTong', key: 'cttong', width: 70, align: 'center' as const,
          render: (v: number, r: any) => laTong(r) ? <Text strong>{v}</Text> : '',
        },
      ],
    },
    {
      title: 'Số có mặt',
      children: [
        { title: 'Ngân sách', dataIndex: 'coMatNS', key: 'cmns', width: 80, align: 'center' as const, render: (v: number, r: any) => laTong(r) ? <Text strong>{v}</Text> : v },
        { title: 'Sự nghiệp', dataIndex: 'coMatSN', key: 'cmsn', width: 80, align: 'center' as const, render: (v: number, r: any) => laTong(r) ? <Text strong>{v}</Text> : v },
        { title: 'Hợp đồng', dataIndex: 'coMatHD', key: 'cmhd', width: 80, align: 'center' as const, render: (v: number, r: any) => laTong(r) ? <Text strong>{v}</Text> : v },
        {
          title: 'Tổng', dataIndex: 'coMatTong', key: 'cmtong', width: 70, align: 'center' as const,
          render: (v: number, r: any) => (
            <span style={{ color: r.overQuota ? '#f5222d' : 'inherit', fontWeight: r.overQuota || laTong(r) ? 700 : 400 }}>
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
      title: 'Tỷ lệ', key: 'ratio', width: 135,
      render: (_: any, r: any) => laTong(r) ? (
        <Progress
          percent={r.chiTieuTong > 0 ? Math.round((r.coMatTong / r.chiTieuTong) * 100) : 0}
          size="small"
          status={r.overQuota ? 'exception' : r.coMatTong === r.chiTieuTong ? 'success' : 'active'}
        />
      ) : null,
    },
    ...(canEdit ? [{
      title: '', key: 'act', width: 150,
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

  const kieuDong = (r: any) => {
    if (r.rowType === 'phuong') return { backgroundColor: '#bfdbfe' }
    if (r.rowType === 'cap') return { backgroundColor: '#dbeafe' }
    return { backgroundColor: donViColorMap[r.donViTen] ?? 'transparent' }
  }

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 16 }}>Vị trí việc làm & Chỉ tiêu biên chế</Title>
      <style>{`
        .vt-table .ant-table-cell { padding: 3px 8px !important; line-height: 1.4 !important; }
        .vt-table .ant-table-thead .ant-table-cell { padding: 5px 8px !important; }
        .vt-subtotal-row td { border-top: 2px solid #096dd9 !important; background: transparent !important; font-weight: 700; }
        .vt-subtotal-row td.ant-table-cell-fix-left { background: inherit !important; }
        .vt-phuong-row td { border-top: 2px solid #1d4ed8 !important; border-bottom: 2px solid #1d4ed8 !important; background: transparent !important; }
        .vt-cap-row td { border-top: 2px solid #3b82f6 !important; background: transparent !important; }
      `}</style>
      <Table
        className="vt-table"
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        bordered
        scroll={{ x: 1558 }}
        pagination={false}
        rowClassName={(r) => (r.rowType === 'subtotal' ? 'vt-subtotal-row' : r.rowType === 'cap' ? 'vt-cap-row' : r.rowType === 'phuong' ? 'vt-phuong-row' : '')}
        onRow={(r) => ({ style: kieuDong(r) })}
      />

      <Modal open={!!editing} title={`Giao chỉ tiêu: ${editing?.donViTen}`} onCancel={() => setEditing(null)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="chiTieuBienCheNganSach" label="Biên chế - Hưởng lương ngân sách" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="chiTieuBienCheSuNghiep" label="Biên chế - Nguồn thu sự nghiệp" rules={[{ required: true }]}>
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
