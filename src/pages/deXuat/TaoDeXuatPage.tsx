import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Select, Button, Table, Space, InputNumber, DatePicker, Typography, Divider, Tag, App } from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import type { ChiTietDeXuat, LoaiDeXuat } from '@/types/deXuat'
import { LOAI_DE_XUAT_LABELS } from '@/types/deXuat'
import { isDangCongTac } from '@/types/vienChuc'

const { Title } = Typography

export default function TaoDeXuatPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { currentUser, scopeDonViId } = useAuth()
  const { addDeXuat, submitDeXuat } = useDeXuatStore.getState()
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && isDangCongTac(v)), [allVienChucs])
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const bacLuongs = useDanhMucStore((s) => s.bacLuongs)
  const [chiTiet, setChiTiet] = useState<ChiTietDeXuat[]>([])
  const [selectedDonVi, setSelectedDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)
  const [loaiDeXuat, setLoaiDeXuat] = useState<LoaiDeXuat>('NANG_BAC')
  const laPctn = loaiDeXuat === 'PHU_CAP_THAM_NIEN'
  const phuCapVienChucs = useLuongStore((s) => s.phuCapVienChucs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const loaiPctn = loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN')

  const vcOptions = vienChucs.filter((v) => !selectedDonVi || v.donViId === selectedDonVi).map((v) => ({ value: v.id, label: `${v.ho} ${v.ten}` }))

  const addVC = (vcId: string | undefined, ngayHieuLucOverride?: string) => {
    if (!vcId) return
    if (chiTiet.find((c) => c.vienChucId === vcId)) { message.warning('Viên chức đã có trong danh sách'); return }
    const vc = vienChucs.find((v) => v.id === vcId)
    const hsl = heSoLuongs.find((h) => h.vienChucId === vcId && h.isActive)
    if (!vc || !hsl) return
    const bacs = bacLuongs.filter((b) => b.chucDanhId === hsl.chucDanhId).sort((a, b) => a.bac - b.bac)
    const nextBac = bacs.find((b) => b.bac === hsl.bac + 1)
    // PCTN đang hưởng (nếu có) để cán bộ đối chiếu khi nhập mức mới
    const pctnHienTai = loaiPctn
      ? phuCapVienChucs.find((p) => p.vienChucId === vcId && p.isActive && p.loaiPhuCapId === loaiPctn.id)?.giaTri ?? 0
      : 0
    setChiTiet((prev) => [...prev, {
      vienChucId: vcId,
      chucDanhCuId: hsl.chucDanhId,
      bacCu: hsl.bac, heSoCu: hsl.heSo,
      chucDanhMoiId: hsl.chucDanhId,
      bacMoi: nextBac?.bac ?? hsl.bac + 1,
      heSoMoi: nextBac?.heSo ?? +(hsl.heSo + 0.33).toFixed(2),
      ngayHieuLuc: ngayHieuLucOverride ?? dayjs().format('YYYY-MM-DD'),
      lyDo: laPctn ? 'Nâng phụ cấp thâm niên theo niên hạn' : 'Đủ thời hạn nâng bậc thường xuyên',
      pctnCu: pctnHienTai,
      pctnMoi: pctnHienTai,
    }])
  }

  // ── Gợi ý viên chức đến kỳ nâng lương thường xuyên (2 đợt/năm: 6 tháng đầu / 6 tháng cuối) ──
  const currentYear = dayjs().year()
  const [dotNam, setDotNam] = useState(currentYear)
  const [dotKy, setDotKy] = useState<'H1' | 'H2'>(dayjs().month() < 6 ? 'H1' : 'H2')
  const [selectedGoiY, setSelectedGoiY] = useState<string[]>([])

  const dotRange = useMemo(() => (
    dotKy === 'H1'
      ? { start: `${dotNam}-01-01`, end: `${dotNam}-06-30` }
      : { start: `${dotNam}-07-01`, end: `${dotNam}-12-31` }
  ), [dotNam, dotKy])

  const goiYData = useMemo(() => {
    return vienChucs
      .filter((v) => !selectedDonVi || v.donViId === selectedDonVi)
      .filter((v) => !chiTiet.some((c) => c.vienChucId === v.id))
      .map((v) => ({ vc: v, hsl: heSoLuongs.find((h) => h.vienChucId === v.id && h.isActive) }))
      .filter((x): x is { vc: typeof vienChucs[number]; hsl: NonNullable<typeof x.hsl> } => !!x.hsl)
      .filter(({ hsl }) => hsl.ngayNangLuongTiepTheo >= dotRange.start && hsl.ngayNangLuongTiepTheo <= dotRange.end)
      .map(({ vc, hsl }) => ({
        id: vc.id,
        hoTen: `${vc.ho} ${vc.ten}`,
        bac: hsl.bac,
        heSo: hsl.heSo,
        ngayNangLuongTiepTheo: hsl.ngayNangLuongTiepTheo,
      }))
      .sort((a, b) => a.ngayNangLuongTiepTheo.localeCompare(b.ngayNangLuongTiepTheo))
  }, [vienChucs, selectedDonVi, chiTiet, heSoLuongs, dotRange])

  const themDaChon = () => {
    selectedGoiY.forEach((vcId) => {
      const item = goiYData.find((g) => g.id === vcId)
      if (item) addVC(item.id, item.ngayNangLuongTiepTheo)
    })
    setSelectedGoiY([])
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

  const colVienChuc = { title: 'Viên chức', key: 'vc', render: (_: any, r: ChiTietDeXuat) => { const vc = vienChucs.find((v) => v.id === r.vienChucId); return vc ? `${vc.ho} ${vc.ten}` : r.vienChucId } }
  const colXoa = { title: 'Xóa', key: 'del', width: 50, render: (_: any, __: any, idx: number) => <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setChiTiet((p) => p.filter((_, i) => i !== idx))} /> }

  const detailCols = laPctn
    ? [
        colVienChuc,
        { title: 'PCTN hiện tại', key: 'pctn_cu', width: 110, render: (_: any, r: ChiTietDeXuat) => `${r.pctnCu ?? 0}%` },
        {
          title: 'PCTN đề nghị', key: 'pctn_moi', width: 120,
          render: (_: any, r: ChiTietDeXuat, idx: number) => (
            <InputNumber size="small" value={r.pctnMoi} min={0} max={100} addonAfter={undefined} onChange={(v) => updateChiTiet(idx, 'pctnMoi', v)} />
          ),
        },
        {
          title: 'Mốc hưởng PCTN', key: 'nhl', width: 150,
          render: (_: any, r: ChiTietDeXuat, idx: number) => <DatePicker size="small" value={dayjs(r.ngayHieuLuc)} format="DD/MM/YYYY" onChange={(d) => updateChiTiet(idx, 'ngayHieuLuc', d?.format('YYYY-MM-DD') ?? '')} />,
        },
        colXoa,
      ]
    : [
        colVienChuc,
        { title: 'Bậc cũ', dataIndex: 'bacCu', key: 'bac_cu', width: 80 },
        { title: 'Hệ số cũ', dataIndex: 'heSoCu', key: 'hs_cu', width: 90 },
        { title: 'Bậc mới', key: 'bac_moi', width: 90, render: (_: any, r: ChiTietDeXuat, idx: number) => <InputNumber size="small" value={r.bacMoi} min={1} max={12} onChange={(v) => updateChiTiet(idx, 'bacMoi', v)} /> },
        { title: 'Hệ số mới', key: 'hs_moi', width: 100, render: (_: any, r: ChiTietDeXuat, idx: number) => <InputNumber size="small" value={r.heSoMoi} min={1} step={0.01} onChange={(v) => updateChiTiet(idx, 'heSoMoi', v)} /> },
        { title: 'Mốc hưởng lương', key: 'nhl', width: 150, render: (_: any, r: ChiTietDeXuat, idx: number) => <DatePicker size="small" value={dayjs(r.ngayHieuLuc)} format="DD/MM/YYYY" onChange={(d) => updateChiTiet(idx, 'ngayHieuLuc', d?.format('YYYY-MM-DD') ?? '')} /> },
        colXoa,
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
          <Form.Item name="loai" label="Loại đề xuất" rules={[{ required: true }]} style={{ minWidth: 220 }}>
            <Select
              options={Object.entries(LOAI_DE_XUAT_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              onChange={(v: LoaiDeXuat) => { setLoaiDeXuat(v); setChiTiet([]) }}
            />
          </Form.Item>
        </Space>
        <Form.Item name="ghiChu" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>

        {!laPctn && <>
        <Divider plain>Gợi ý viên chức đến kỳ nâng lương thường xuyên</Divider>
        <Space wrap style={{ marginBottom: 12 }}>
          <InputNumber value={dotNam} onChange={(v) => setDotNam(v ?? currentYear)} style={{ width: 100 }} />
          <Select
            value={dotKy}
            onChange={setDotKy}
            style={{ width: 180 }}
            options={[
              { value: 'H1', label: '6 tháng đầu năm' },
              { value: 'H2', label: '6 tháng cuối năm' },
            ]}
          />
          <Button type="primary" ghost disabled={selectedGoiY.length === 0} onClick={themDaChon}>
            Thêm {selectedGoiY.length > 0 ? selectedGoiY.length : ''} đã chọn vào đề xuất
          </Button>
        </Space>
        <Table
          dataSource={goiYData}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 500, y: 240 }}
          style={{ marginBottom: 16 }}
          rowSelection={{ selectedRowKeys: selectedGoiY, onChange: (keys) => setSelectedGoiY(keys as string[]) }}
          locale={{ emptyText: 'Không có viên chức nào đến kỳ nâng lương trong đợt này' }}
          columns={[
            { title: 'Viên chức', dataIndex: 'hoTen', key: 'ht' },
            { title: 'Bậc/Hệ số hiện tại', key: 'bh', width: 140, render: (_: any, r: any) => `Bậc ${r.bac} — ${r.heSo}` },
            { title: 'Ngày nâng lương tiếp theo', dataIndex: 'ngayNangLuongTiepTheo', key: 'nnt', width: 160, render: (v: string) => <Tag color="blue">{dayjs(v).format('DD/MM/YYYY')}</Tag> },
          ]}
        />
        </>}

        <Divider plain>Danh sách viên chức trong đề xuất</Divider>
        <Space style={{ marginBottom: 12 }}>
          <Select showSearch style={{ width: 260 }} placeholder="Chọn viên chức để thêm..." options={vcOptions} onSelect={(v: string | undefined) => addVC(v)} filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())} value={undefined} />
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
