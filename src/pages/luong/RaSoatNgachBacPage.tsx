import { useMemo, useState } from 'react'
import { Table, Card, Typography, Tag, Input, Select, Space, Button, Alert } from 'antd'
import { SearchOutlined, FileExcelOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useLuongStore } from '@/store/luongStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { matchSearch, soSanhVienChuc } from '@/utils/helpers'
import { exportToExcel } from '@/utils/exportExcel'
import { duocTinhSoLieu, nhanLuongTheoTien, laVienChucBienChe, LOAI_LAO_DONG_LABELS } from '@/types/vienChuc'

const { Title, Text } = Typography

// Các lỗi dữ liệu lương cần trường rà soát, xếp theo mức độ ảnh hưởng tới bảng lương
type LoaiLech = 'THIEU_NGACH' | 'THIEU_LUONG' | 'BAC_VUOT' | 'HE_SO_LECH' | 'NGACH_KHAC' | 'THIEU_CONG_VIEC' | 'TEN_LOI_FONT'

const LECH_LABELS: Record<LoaiLech, { ten: string; mau: string }> = {
  THIEU_NGACH: { ten: 'Chưa có mã ngạch', mau: 'red' },
  THIEU_LUONG: { ten: 'Chưa có bậc, hệ số', mau: 'red' },
  BAC_VUOT: { ten: 'Bậc vượt bảng lương', mau: 'volcano' },
  HE_SO_LECH: { ten: 'Hệ số không khớp bảng', mau: 'orange' },
  NGACH_KHAC: { ten: 'Lương ghi theo mã khác', mau: 'gold' },
  THIEU_CONG_VIEC: { ten: 'Chưa chọn công việc cụ thể', mau: 'cyan' },
  TEN_LOI_FONT: { ten: 'Tên lỗi font (TCVN3)', mau: 'purple' },
}

// Ký tự bảng mã TCVN3 hiển thị sai trong Unicode (VD "NGUYÔN THÞ LUYªN") — tên tiếng Việt không bao giờ có
const KY_TU_TCVN3 = /[¡-¿×Þ÷þ]/

interface DongRaSoat {
  key: string
  vcId: string
  hoTen: string
  donViId: string
  loaiLaoDong: string
  maCd: string
  tenCd: string
  bangLuong: string
  bac?: number
  heSo?: number
  heSoTheoBang?: number
  soBac?: number
  loi: LoaiLech[]
  chiTiet: string[]
  goiY: string
}

const r2 = (n: number) => Math.round(n * 100) / 100

export default function RaSoatNgachBacPage() {
  const navigate = useNavigate()
  const { scopeDonViId } = useAuth()
  const [search, setSearch] = useState('')
  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)
  const [filterLoi, setFilterLoi] = useState<LoaiLech | undefined>()

  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const bacLuongs = useDanhMucStore((s) => s.bacLuongs)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active).sort((a, b) => a.ten.localeCompare(b.ten, 'vi')), [allDonVis])
  const tenDonVi = useMemo(() => new Map(allDonVis.map((d) => [d.id, d.ten])), [allDonVis])

  const rows = useMemo<DongRaSoat[]>(() => {
    const cdTheoId = new Map(chucDanhs.map((c) => [c.id, c]))
    const bacTheoCd = new Map<string, { bac: number; heSo: number }[]>()
    for (const b of bacLuongs) {
      const ds = bacTheoCd.get(b.chucDanhId) ?? []
      ds.push(b)
      bacTheoCd.set(b.chucDanhId, ds)
    }
    // Hệ số → những bảng lương có bậc mang đúng hệ số đó, để gợi ý mã/bậc khả dĩ
    const bangTheoHeSo = new Map<number, Set<string>>()
    for (const cd of chucDanhs) {
      for (const b of bacTheoCd.get(cd.id) ?? []) {
        const k = r2(b.heSo)
        const ds = bangTheoHeSo.get(k) ?? new Set<string>()
        ds.add(`bảng ${cd.bangLuong} bậc ${b.bac}`)
        bangTheoHeSo.set(k, ds)
      }
    }

    let list = vienChucs.filter((v) => duocTinhSoLieu(v))
    if (scopeDonViId) list = list.filter((v) => v.donViId === scopeDonViId)
    const nhomCua = (v: (typeof list)[number]) => cdTheoId.get(v.chucDanhId)?.nhom
    list = [...list].sort((a, b) =>
      (tenDonVi.get(a.donViId) ?? '').localeCompare(tenDonVi.get(b.donViId) ?? '', 'vi') || soSanhVienChuc(nhomCua)(a, b))

    const ketQua: DongRaSoat[] = []
    for (const vc of list) {
      const hoTen = `${vc.ho} ${vc.ten}`.trim()
      const cd = cdTheoId.get(vc.chucDanhId)
      const hs = heSoLuongs.find((h) => h.vienChucId === vc.id && h.isActive)
      const bang = (cd ? bacTheoCd.get(cd.id) ?? [] : []).slice().sort((a, b) => a.bac - b.bac)
      const bienChe = laVienChucBienChe(vc.loaiLaoDong)
      const loi: LoaiLech[] = []
      const chiTiet: string[] = []
      let heSoTheoBang: number | undefined

      if (KY_TU_TCVN3.test(hoTen)) {
        loi.push('TEN_LOI_FONT')
        chiTiet.push('Họ tên còn ký tự bảng mã TCVN3, cần gõ lại bằng Unicode')
      }
      if (vc.vtvl === 'NHAN_VIEN' && !vc.congViec) {
        loi.push('THIEU_CONG_VIEC')
        chiTiet.push('Nhân viên chưa chọn công việc cụ thể (kế toán, bảo vệ, cấp dưỡng…) — cần để chia nhóm trên Tổng quan')
      }
      // Lương theo mức tiền: không có ngạch, bậc, hệ số để đối chiếu — chỉ kiểm tra tên, công việc
      const theoTien = nhanLuongTheoTien(vc)
      if (!cd && bienChe) {
        loi.push('THIEU_NGACH')
        chiTiet.push('Viên chức biên chế chưa có mã ngạch/hạng')
      }
      if (theoTien) {
        // bỏ qua kiểm tra lương
      } else if (!hs) {
        // Người lương theo mức tiền đã loại ở trên → ai còn lại mà chưa có bậc, hệ số đều chưa khai lương
        loi.push('THIEU_LUONG')
        chiTiet.push(bienChe ? 'Chưa có bậc, hệ số lương đang hưởng' : 'Hợp đồng chưa khai lương (bậc/hệ số hoặc mức tiền)')
      } else if (cd && bang.length) {
        if (hs.chucDanhId && hs.chucDanhId !== cd.id) {
          loi.push('NGACH_KHAC')
          chiTiet.push(`Bản ghi lương theo mã ${cdTheoId.get(hs.chucDanhId)?.ma ?? hs.chucDanhId}, hồ sơ đang ghi mã ${cd.ma}`)
        }
        const bacBang = bang.find((b) => b.bac === hs.bac)
        if (!bacBang) {
          loi.push('BAC_VUOT')
          chiTiet.push(`Bậc ${hs.bac} không có trong bảng ${cd.bangLuong} (${bang.length} bậc)`)
        } else if (r2(bacBang.heSo) !== r2(hs.heSo)) {
          heSoTheoBang = bacBang.heSo
          loi.push('HE_SO_LECH')
          chiTiet.push(`Bậc ${hs.bac} bảng ${cd.bangLuong} là ${bacBang.heSo.toFixed(2)}, hồ sơ đang ghi ${hs.heSo.toFixed(2)}`)
        } else {
          heSoTheoBang = bacBang.heSo
        }
      }
      if (!loi.length) continue

      const khop = hs && (loi.includes('BAC_VUOT') || loi.includes('HE_SO_LECH'))
        ? [...(bangTheoHeSo.get(r2(hs.heSo)) ?? [])]
        : []
      ketQua.push({
        key: vc.id,
        vcId: vc.id,
        hoTen,
        donViId: vc.donViId,
        loaiLaoDong: vc.loaiLaoDong,
        maCd: cd?.ma ?? '',
        tenCd: cd?.ten ?? '',
        bangLuong: cd?.bangLuong ?? '',
        bac: hs?.bac,
        heSo: hs?.heSo,
        heSoTheoBang,
        soBac: bang.length || undefined,
        loi,
        chiTiet,
        goiY: khop.length ? `Hệ số ${hs!.heSo.toFixed(2)} khớp ${khop.join('; ')}` : '',
      })
    }
    return ketQua
  }, [vienChucs, heSoLuongs, chucDanhs, bacLuongs, scopeDonViId, tenDonVi])

  const data = useMemo(() => rows.filter((r) =>
    (!filterDonVi || r.donViId === filterDonVi)
    && (!filterLoi || r.loi.includes(filterLoi))
    && (!search || matchSearch(`${r.hoTen} ${r.maCd}`, search)),
  ), [rows, filterDonVi, filterLoi, search])

  const demTheoLoi = useMemo(() => {
    const dem: Partial<Record<LoaiLech, number>> = {}
    for (const r of rows.filter((x) => !filterDonVi || x.donViId === filterDonVi)) {
      for (const l of r.loi) dem[l] = (dem[l] ?? 0) + 1
    }
    return dem
  }, [rows, filterDonVi])

  const columns = [
    {
      title: 'Họ và tên', key: 'hoTen', width: 200, fixed: 'left' as const,
      render: (_: unknown, r: DongRaSoat) => (
        <a onClick={() => navigate(`/vien-chuc/${r.vcId}`)}>{r.hoTen}</a>
      ),
    },
    ...(scopeDonViId ? [] : [{
      title: 'Đơn vị', key: 'dv', width: 170,
      render: (_: unknown, r: DongRaSoat) => tenDonVi.get(r.donViId) ?? '',
    }]),
    {
      title: 'Mã CDNN', key: 'cd', width: 230,
      render: (_: unknown, r: DongRaSoat) => r.maCd
        ? <><Text strong>{r.maCd}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.tenCd}</Text></>
        : <Text type="secondary">{LOAI_LAO_DONG_LABELS[r.loaiLaoDong as keyof typeof LOAI_LAO_DONG_LABELS]}</Text>,
    },
    {
      title: 'Bảng', key: 'bang', width: 70, align: 'center' as const,
      render: (_: unknown, r: DongRaSoat) => r.bangLuong ? `${r.bangLuong}${r.soBac ? ` (${r.soBac})` : ''}` : '',
    },
    { title: 'Bậc', dataIndex: 'bac', key: 'bac', width: 55, align: 'center' as const },
    {
      title: 'Hệ số đang ghi', key: 'hs', width: 90, align: 'right' as const,
      render: (_: unknown, r: DongRaSoat) => r.heSo?.toFixed(2) ?? '',
    },
    {
      title: 'Hệ số theo bảng', key: 'hsb', width: 90, align: 'right' as const,
      render: (_: unknown, r: DongRaSoat) => r.heSoTheoBang?.toFixed(2) ?? '',
    },
    {
      title: 'Vấn đề', key: 'loi', width: 330,
      render: (_: unknown, r: DongRaSoat) => (
        <Space orientation="vertical" size={2}>
          <Space size={4} wrap>{r.loi.map((l) => <Tag key={l} color={LECH_LABELS[l].mau}>{LECH_LABELS[l].ten}</Tag>)}</Space>
          {r.chiTiet.map((c) => <Text key={c} style={{ fontSize: 12 }}>{c}</Text>)}
        </Space>
      ),
    },
    {
      title: 'Gợi ý', dataIndex: 'goiY', key: 'goiY', width: 260,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
  ]

  const xuatExcel = () => {
    exportToExcel(data.map((r) => ({
      'Họ và tên': r.hoTen,
      'Đơn vị': tenDonVi.get(r.donViId) ?? '',
      'Mã CDNN': r.maCd,
      'Tên chức danh': r.tenCd,
      'Bảng lương': r.bangLuong,
      'Bậc': r.bac ?? '',
      'Hệ số đang ghi': r.heSo ?? '',
      'Hệ số theo bảng': r.heSoTheoBang ?? '',
      'Vấn đề': r.loi.map((l) => LECH_LABELS[l].ten).join('; '),
      'Chi tiết': r.chiTiet.join('; '),
      'Gợi ý': r.goiY,
    })), 'RaSoat_NgachBacHeSo', 'Rà soát')
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Rà soát ngạch – bậc – hệ số ({data.length})</Title>
        <Button icon={<FileExcelOutlined />} onClick={xuatExcel} disabled={!data.length}>Xuất Excel</Button>
      </div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Danh sách hồ sơ đang công tác có mã ngạch, bậc, hệ số không khớp danh mục bảng lương. Hệ thống không tự sửa — trường kiểm tra quyết định xếp lương rồi vào hồ sơ để sửa mã ngạch hoặc bậc cho đúng. Người nhận lương theo mức tiền chỉ được kiểm tra họ tên và công việc cụ thể."
      />
      <Space wrap style={{ marginBottom: 12 }}>
        {(Object.keys(LECH_LABELS) as LoaiLech[]).filter((l) => demTheoLoi[l]).map((l) => (
          <Tag
            key={l}
            color={filterLoi === l ? LECH_LABELS[l].mau : undefined}
            style={{ cursor: 'pointer' }}
            onClick={() => setFilterLoi(filterLoi === l ? undefined : l)}
          >
            {LECH_LABELS[l].ten}: {demTheoLoi[l]}
          </Tag>
        ))}
      </Space>
      <Space wrap style={{ marginBottom: 16, display: 'flex' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Tìm họ tên, mã CDNN..."
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        {!scopeDonViId && (
          <Select
            placeholder="Chọn đơn vị trường"
            style={{ width: 240 }}
            value={filterDonVi}
            onChange={setFilterDonVi}
            allowClear
            options={donVis.map((d) => ({ value: d.id, label: d.ten }))}
          />
        )}
        <Select
          placeholder="Loại vấn đề"
          style={{ width: 220 }}
          value={filterLoi}
          onChange={setFilterLoi}
          allowClear
          options={(Object.keys(LECH_LABELS) as LoaiLech[]).map((l) => ({ value: l, label: LECH_LABELS[l].ten }))}
        />
      </Space>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="key"
        size="small"
        bordered
        scroll={{ x: 1400 }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `${t} hồ sơ cần rà soát` }}
      />
    </Card>
  )
}
