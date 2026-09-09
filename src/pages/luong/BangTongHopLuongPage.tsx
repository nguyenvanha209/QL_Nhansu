import { useMemo, useState } from 'react'
import { Table, Card, Select, Input, Space, Typography, Button } from 'antd'
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import { CHUC_VU_LABELS } from '@/types/vienChuc'
import { formatDate, matchSearch } from '@/utils/helpers'
import type { HeSoLuong, PhuCapVienChuc } from '@/types/luong'
import type { LoaiPhuCap, ChucDanhNgheNghiep } from '@/types/danhMuc'
import type { VienChuc } from '@/types/vienChuc'

const { Title } = Typography

const PC_VK_MA  = 'PC_THAM_NIEN_VK'
const PC_CV_MA  = 'PC_CHUC_VU'
const PC_TN_MA  = 'PC_TRACH_NHIEM'
const PC_TNN_MA = 'PC_THAM_NIEN'
const PC_UD_PREFIX = 'PCUD'

const r3 = (n: number) => Math.round(n * 1000) / 1000
const d3 = (n: number) => (n ? n.toFixed(3) : '')

interface RowData {
  key: string
  stt: number
  donViId: string
  hoTen: string
  ngaySinh: string
  chucVuHienThi: string
  maCDNN: string
  bac: number | ''
  heSo: number | ''
  vkPct: number
  vkHeSo: number
  tongHSLC: number
  thoiDiem: string
  pcCV: number
  pcTN: number
  pcTNNG_Pct: number
  pcTNNG_HeSo: number
  mocTNNG: string
  hsBaoLuu: number
  pcUD: number
  tong1Thang: number
  tong6Thang: number
}

function buildRow(
  stt: number,
  vc: VienChuc,
  heSos: HeSoLuong[],
  phuCaps: PhuCapVienChuc[],
  loaiPhuCaps: LoaiPhuCap[],
  chucDanhs: ChucDanhNgheNghiep[],
): RowData {
  const heSoRec = heSos.find((h) => h.vienChucId === vc.id && h.isActive)
  const mine = phuCaps.filter((p) => p.vienChucId === vc.id && p.isActive)

  const byMa = (ma: string) => {
    const loai = loaiPhuCaps.find((l) => l.ma === ma)
    const rec = loai ? mine.find((p) => p.loaiPhuCapId === loai.id) : undefined
    const val = rec ? (rec.giaTri > 0 ? rec.giaTri : loai?.giaTri ?? 0) : 0
    return { loai, rec, val }
  }

  const udLoaiIds = new Set(loaiPhuCaps.filter((l) => l.ma.startsWith(PC_UD_PREFIX)).map((l) => l.id))
  const udRec = mine.find((p) => udLoaiIds.has(p.loaiPhuCapId))
  const udLoai = udRec ? loaiPhuCaps.find((l) => l.id === udRec.loaiPhuCapId) : undefined
  const udVal = udRec ? (udRec.giaTri > 0 ? udRec.giaTri : udLoai?.giaTri ?? 0) : 0

  const { val: vkPct } = byMa(PC_VK_MA)
  const { val: cvCoeff } = byMa(PC_CV_MA)
  const { val: tnCoeff } = byMa(PC_TN_MA)
  const { val: tnnPct, rec: tnnRec } = byMa(PC_TNN_MA)

  const heSo = heSoRec?.heSo ?? 0
  const baoLuu = heSoRec?.heSoBaoLuu ?? 0
  const vkHeSo = r3(heSo * (vkPct / 100))
  const tongHSLC = r3(heSo + vkHeSo)
  const nen = tongHSLC + cvCoeff
  const pcTNNG_HeSo = r3(nen * (tnnPct / 100))
  const pcUD_HeSo = r3(nen * (udVal / 100))
  const tong1Thang = r3(tongHSLC + cvCoeff + tnCoeff + pcTNNG_HeSo + baoLuu + pcUD_HeSo)

  const chucDanh = chucDanhs.find((c) => c.id === vc.chucDanhId)
  const chucVuHienThi = vc.chucVu
    ? (CHUC_VU_LABELS[vc.chucVu as keyof typeof CHUC_VU_LABELS] ?? vc.chucVu)
    : (chucDanh?.ten ?? '')

  return {
    key: vc.id,
    stt,
    donViId: vc.donViId,
    hoTen: `${vc.ho} ${vc.ten}`.trim(),
    ngaySinh: formatDate(vc.ngaySinh),
    chucVuHienThi,
    maCDNN: chucDanh?.ma ?? '',
    bac: heSoRec?.bac ?? '',
    heSo: heSo || '',
    vkPct,
    vkHeSo,
    tongHSLC,
    thoiDiem: heSoRec ? formatDate(heSoRec.ngayHieuLuc) : '',
    pcCV: cvCoeff,
    pcTN: tnCoeff,
    pcTNNG_Pct: tnnPct,
    pcTNNG_HeSo,
    mocTNNG: tnnRec ? formatDate(tnnRec.ngayHieuLuc) : '',
    hsBaoLuu: baoLuu,
    pcUD: pcUD_HeSo,
    tong1Thang,
    tong6Thang: r3(tong1Thang * 6),
  }
}

const DV_ORDER: Record<string, number> = { MAM_NON: 1, TIEU_HOC: 2, THCS: 3, OTHER: 4 }

export default function BangTongHopLuongPage() {
  const { scopeDonViId } = useAuth()
  const allVC = useVienChucStore((s) => s.vienChucs)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active).sort((a, b) => {
    const oa = DV_ORDER[a.loai] ?? 4
    const ob = DV_ORDER[b.loai] ?? 4
    if (oa !== ob) return oa - ob
    return a.ten.localeCompare(b.ten, 'vi')
  }), [allDonVis])
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const heSos = useLuongStore((s) => s.heSoLuongs)
  const phuCaps = useLuongStore((s) => s.phuCapVienChucs)

  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    let list = allVC.filter((v) => v.active)
    if (scopeDonViId) list = list.filter((v) => v.donViId === scopeDonViId)
    if (filterDonVi) list = list.filter((v) => v.donViId === filterDonVi)
    if (search) list = list.filter((v) => matchSearch(`${v.ho} ${v.ten}`, search))
    const dvMap = new Map(donVis.map((d) => [d.id, d]))
    list = [...list].sort((a, b) => {
      const da = dvMap.get(a.donViId)
      const db = dvMap.get(b.donViId)
      const oa = DV_ORDER[da?.loai ?? 'OTHER'] ?? 4
      const ob = DV_ORDER[db?.loai ?? 'OTHER'] ?? 4
      if (oa !== ob) return oa - ob
      const tenCmp = (da?.ten ?? '').localeCompare(db?.ten ?? '', 'vi')
      if (tenCmp !== 0) return tenCmp
      return `${a.ho} ${a.ten}`.localeCompare(`${b.ho} ${b.ten}`, 'vi')
    })
    return list.map((vc, i) => buildRow(i + 1, vc, heSos, phuCaps, loaiPhuCaps, chucDanhs))
  }, [allVC, donVis, scopeDonViId, filterDonVi, search, heSos, phuCaps, loaiPhuCaps, chucDanhs])

  const columns: any[] = [
    {
      title: 'TT', key: 'stt', width: 46, fixed: 'left' as const, align: 'center' as const,
      render: (_: any, __: any, i: number) => i + 1,
    },
    {
      title: 'Họ và tên', key: 'hoTen', width: 175, fixed: 'left' as const,
      render: (_: any, r: RowData) => r.hoTen,
    },
    {
      title: 'Ngày, tháng, năm sinh', key: 'ngaySinh', width: 105, align: 'center' as const,
      render: (_: any, r: RowData) => r.ngaySinh,
    },
    {
      title: 'Chức vụ, vị trí đảm nhiệm', key: 'chucVu', width: 165,
      render: (_: any, r: RowData) => r.chucVuHienThi,
    },
    {
      title: 'Mã CDNN', key: 'maCDNN', width: 105, align: 'center' as const,
      render: (_: any, r: RowData) => r.maCDNN,
    },
    {
      title: 'Bậc', key: 'bac', width: 55, align: 'center' as const,
      render: (_: any, r: RowData) => r.bac,
    },
    {
      title: 'Hệ số', key: 'heSo', width: 65, align: 'right' as const,
      render: (_: any, r: RowData) => r.heSo,
    },
    {
      title: 'Phụ cấp thâm niên vượt khung',
      children: [
        {
          title: '%', key: 'vkPct', width: 55, align: 'center' as const,
          render: (_: any, r: RowData) => r.vkPct ? r.vkPct : '',
        },
        {
          title: 'Hệ số', key: 'vkHeSo', width: 70, align: 'right' as const,
          render: (_: any, r: RowData) => d3(r.vkHeSo),
        },
      ],
    },
    {
      title: 'Tổng hệ số lương chính', key: 'tongHSLC', width: 90, align: 'right' as const,
      render: (_: any, r: RowData) => r.tongHSLC ? r.tongHSLC.toFixed(3) : '',
    },
    {
      title: 'Thời điểm tính nâng bậc lương hoặc phụ cấp TNVK', key: 'thoiDiem', width: 120, align: 'center' as const,
      render: (_: any, r: RowData) => r.thoiDiem,
    },
    {
      title: 'Phụ cấp chức vụ', key: 'pcCV', width: 85, align: 'right' as const,
      render: (_: any, r: RowData) => d3(r.pcCV),
    },
    {
      title: 'Phụ cấp trách nhiệm', key: 'pcTN', width: 95, align: 'right' as const,
      render: (_: any, r: RowData) => d3(r.pcTN),
    },
    {
      title: 'Phụ cấp thâm niên nhà giáo',
      children: [
        {
          title: '%', key: 'pcTNNG_Pct', width: 55, align: 'center' as const,
          render: (_: any, r: RowData) => r.pcTNNG_Pct ? `${r.pcTNNG_Pct}%` : '',
        },
        {
          title: 'Hệ số', key: 'pcTNNG_HeSo', width: 70, align: 'right' as const,
          render: (_: any, r: RowData) => d3(r.pcTNNG_HeSo),
        },
        {
          title: 'Mốc xét nâng PC TNNG', key: 'mocTNNG', width: 100, align: 'center' as const,
          render: (_: any, r: RowData) => r.mocTNNG,
        },
      ],
    },
    {
      title: 'Hệ số chênh lệch bảo lưu', key: 'hsBaoLuu', width: 95, align: 'right' as const,
      render: (_: any, r: RowData) => d3(r.hsBaoLuu),
    },
    {
      title: 'Phụ cấp ưu đãi', key: 'pcUD', width: 90, align: 'right' as const,
      render: (_: any, r: RowData) => d3(r.pcUD),
    },
    {
      title: 'Tổng hệ số lương 1 tháng', key: 'tong1Thang', width: 100, align: 'right' as const,
      render: (_: any, r: RowData) => <strong>{r.tong1Thang.toFixed(3)}</strong>,
    },
    {
      title: 'Tổng hệ số lương 6 tháng đầu năm', key: 'tong6Thang', width: 120, align: 'right' as const,
      render: (_: any, r: RowData) => <strong>{r.tong6Thang.toFixed(3)}</strong>,
    },
  ]

  const handleExport = () => {
    const donViTen = filterDonVi
      ? (donVis.find((d) => d.id === filterDonVi)?.ten ?? 'TatCa')
      : 'TatCa'
    const exportRows = rows.map((r) => ({
      'TT': r.stt,
      'Họ và tên': r.hoTen,
      'Ngày sinh': r.ngaySinh,
      'Chức vụ, vị trí đảm nhiệm': r.chucVuHienThi,
      'Mã CDNN': r.maCDNN,
      'Bậc': r.bac,
      'Hệ số': r.heSo,
      'PC TNVK (%)': r.vkPct || '',
      'PC TNVK Hệ số': r.vkHeSo || '',
      'Tổng HS lương chính': r.tongHSLC,
      'Thời điểm tính nâng bậc / TNVK': r.thoiDiem,
      'PC Chức vụ': r.pcCV || '',
      'PC Trách nhiệm': r.pcTN || '',
      'PC TNNG (%)': r.pcTNNG_Pct || '',
      'PC TNNG Hệ số': r.pcTNNG_HeSo || '',
      'Mốc xét nâng TNNG': r.mocTNNG,
      'HS Chênh lệch bảo lưu': r.hsBaoLuu || '',
      'PC Ưu đãi nghề': r.pcUD || '',
      'Tổng HS lương 1 tháng': r.tong1Thang,
      'Tổng HS lương 6 tháng đầu năm': r.tong6Thang,
    }))
    const ws = XLSX.utils.json_to_sheet(exportRows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 26 }, { wch: 13 }, { wch: 22 }, { wch: 13 },
      { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
      { wch: 18 }, { wch: 11 }, { wch: 13 }, { wch: 11 }, { wch: 11 },
      { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 18 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bang TH Luong')
    XLSX.writeFile(wb, `BangTongHopLuong_${donViTen}_${dayjs().format('YYYYMMDD')}.xlsx`)
  }

  const tongTong6Thang = useMemo(() => rows.reduce((s, r) => s + r.tong6Thang, 0), [rows])

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Bảng tổng hợp lương{' '}
          <span style={{ fontWeight: 400, fontSize: 14, color: '#666' }}>
            ({rows.length} người — Tổng HS 6 tháng: <strong>{tongTong6Thang.toFixed(3)}</strong>)
          </span>
        </Title>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>Xuất Excel</Button>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Tìm kiếm họ tên..."
          style={{ width: 220 }}
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
      </Space>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="key"
        size="small"
        bordered
        scroll={{ x: 2000 }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `Tổng ${t} viên chức` }}
      />
    </Card>
  )
}
