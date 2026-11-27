import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Table, Card, Select, Input, Space, Typography, Button, Tag, Tooltip } from 'antd'
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons'
import { trangTuDanhSach, xuatExcelA4, ganCotTinh, ganDongTong, lamTronExcel } from '@/utils/excelA4'
import type { O } from '@/utils/excelA4'
import dayjs from 'dayjs'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import { usePhamVi } from '@/hooks/usePhamVi'
import { useAuth } from '@/hooks/useAuth'
import { loaiLaoDongTheoKhoi, LOAI_LAO_DONG_LABELS, duocTinhSoLieu } from '@/types/vienChuc'
import { formatDate, matchSearch, soSanhVienChuc } from '@/utils/helpers'
import type { VienChuc } from '@/types/vienChuc'
import { soSanhTruong, thuTuTruong } from '@/utils/dinhMuc'
import { buildRow } from '@/utils/dongLuongNguoi'
import type { RowData } from '@/utils/dongLuongNguoi'

const { Title, Text } = Typography

const r3 = (n: number) => Math.round(n * 1000) / 1000
const d3 = (n: number) => (n ? n.toFixed(3) : '')

interface SubtotalRow {
  _type: 'subtotal'
  key: string
  donViTen: string
  count: number
  heSo: number
  vkHeSo: number
  tongHSLC: number
  pcCV: number
  pcTN: number
  pcTNNG_HeSo: number
  hsBaoLuu: number
  pcUD: number
  pcCongVu: number
  tong1Thang: number
  tong6Thang: number
  mucLuongTien: number
}

type DisplayRow = RowData | SubtotalRow

const SUM_COLS = ['heSo', 'vkHeSo', 'tongHSLC', 'pcCV', 'pcTN', 'pcTNNG_HeSo', 'hsBaoLuu', 'pcUD', 'pcCongVu', 'tong1Thang', 'tong6Thang', 'mucLuongTien'] as const

function sumGroup(rows: RowData[]): Omit<SubtotalRow, '_type' | 'key' | 'donViTen' | 'count'> {
  const result: Record<string, number> = {}
  for (const col of SUM_COLS) result[col] = r3(rows.reduce((s, r) => s + (Number(r[col]) || 0), 0))
  return result as Omit<SubtotalRow, '_type' | 'key' | 'donViTen' | 'count'>
}

const DV_ORDER: Record<string, number> = { MAM_NON: 1, TIEU_HOC: 2, THCS: 3, OTHER: 4 }

export default function BangTongHopLuongPage() {
  const { scopeDonViId } = useAuth()
  const { trongPhamVi, khoi } = usePhamVi()
  const allVC = useVienChucStore((s) => s.vienChucs)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active && trongPhamVi(d.id)).sort((a, b) => {
    const oa = DV_ORDER[a.loai] ?? 4
    const ob = DV_ORDER[b.loai] ?? 4
    if (oa !== ob) return oa - ob
    return a.ten.localeCompare(b.ten, 'vi')
  }), [allDonVis])
  const thuTuDv = useMemo(() => thuTuTruong(allDonVis), [allDonVis])
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const heSos = useLuongStore((s) => s.heSoLuongs)
  const phuCaps = useLuongStore((s) => s.phuCapVienChucs)

  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)
  // Đổi khối ở đầu trang mà đơn vị đang chọn không thuộc khối mới → bỏ chọn đơn vị ngoài khối
  useEffect(() => { if (filterDonVi && !trongPhamVi(filterDonVi)) setFilterDonVi(undefined) }, [filterDonVi, trongPhamVi])
  const tenDonVi = useMemo(() => {
    const m = new Map(donVis.map((d) => [d.id, d.ten]))
    return (id: string) => m.get(id) ?? id
  }, [donVis])
  const [search, setSearch] = useState('')
  const [filterLoai, setFilterLoai] = useState<string | undefined>()

  const rows = useMemo<RowData[]>(() => {
    let list = allVC.filter(duocTinhSoLieu)
    list = list.filter((v) => trongPhamVi(v.donViId))
    if (filterDonVi) list = list.filter((v) => v.donViId === filterDonVi)
    if (filterLoai) list = list.filter((v) => v.loaiLaoDong === filterLoai)
    if (search) list = list.filter((v) => matchSearch(`${v.ho} ${v.ten}`, search))
    const dvMap = new Map(donVis.map((d) => [d.id, d]))
    // Trong mỗi trường, xếp theo thứ tự chuẩn: CBQL → Giáo viên → Nhân viên
    const theoVtvl = soSanhVienChuc<VienChuc>((v) => chucDanhs.find((c) => c.id === v.chucDanhId)?.nhom)
    list = [...list].sort((a, b) => {
      const da = dvMap.get(a.donViId)
      const db = dvMap.get(b.donViId)
      const oa = DV_ORDER[da?.loai ?? 'OTHER'] ?? 4
      const ob = DV_ORDER[db?.loai ?? 'OTHER'] ?? 4
      if (oa !== ob) return oa - ob
      const tenCmp = (da?.ten ?? '').localeCompare(db?.ten ?? '', 'vi')
      if (tenCmp !== 0) return tenCmp
      return theoVtvl(a, b)
    })
    return list.map((vc, i) => buildRow(i + 1, vc, heSos, phuCaps, loaiPhuCaps, chucDanhs))
  }, [allVC, donVis, trongPhamVi, filterDonVi, filterLoai, search, heSos, phuCaps, loaiPhuCaps, chucDanhs])

  // Chèn subtotal rows khi xem tất cả trường (không filter, không search)
  const displayRows = useMemo<DisplayRow[]>(() => {
    const showSubtotals = !filterDonVi && !search && !scopeDonViId
    if (!showSubtotals) return rows
    const dvMap = new Map(donVis.map((d) => [d.id, d.ten]))
    const groups: Map<string, RowData[]> = new Map()
    for (const r of rows) {
      const g = groups.get(r.donViId) ?? []
      g.push(r)
      groups.set(r.donViId, g)
    }
    const result: DisplayRow[] = []
    for (const [dvId, grp] of groups) {
      result.push(...grp)
      result.push({
        _type: 'subtotal',
        key: `sub_${dvId}`,
        donViTen: dvMap.get(dvId) ?? dvId,
        count: grp.length,
        ...sumGroup(grp),
      })
    }
    return result
  }, [rows, filterDonVi, search, scopeDonViId, donVis])

  // Grand total cho summary row
  const grandTotal = useMemo(() => sumGroup(rows), [rows])

  // Cột riêng nhà giáo (thâm niên, ưu đãi) chỉ ở khối trường; PC công vụ chỉ ở khối cơ quan. Xem tất cả thì hiện đủ.
  const hienNhaGiao = !khoi || khoi === 'TRUONG_HOC'
  const hienCongVu = !khoi || khoi === 'CO_QUAN'
  const cotAn = new Set([...(hienNhaGiao ? [] : ['tnng', 'pcUD']), ...(hienCongVu ? [] : ['pcCongVu'])])

  const tatCaCot: any[] = [
    {
      title: 'TT', key: 'stt', width: 46, fixed: 'left' as const, align: 'center' as const,
      render: (_: any, r: DisplayRow, i: number) => r._type === 'subtotal' ? '' : i + 1,
    },
    {
      title: 'Họ và tên', key: 'hoTen', width: 190, fixed: 'left' as const,
      render: (_: any, r: DisplayRow) =>
        r._type === 'subtotal'
          ? <Text strong style={{ color: '#1677ff' }}>Cộng: {r.donViTen} ({r.count} người)</Text>
          : r.hoTen,
      sorter: (a: DisplayRow, b: DisplayRow) =>
        a._type === 'subtotal' || b._type === 'subtotal' ? 0
          : (a as RowData).hoTen.localeCompare((b as RowData).hoTen, 'vi'),
    },
    // Tài khoản xem được nhiều trường thì phải biết mỗi dòng thuộc trường nào.
    // Dòng "Cộng" chỉ hiện ở cuối mỗi nhóm, cuộn giữa bảng là mất dấu.
    ...(scopeDonViId ? [] : [{
      title: 'Đơn vị', key: 'donVi', width: 235, fixed: 'left' as const,
      render: (_: any, r: DisplayRow) => (r._type === 'data' ? tenDonVi(r.donViId) : ''),
      sorter: (a: DisplayRow, b: DisplayRow) =>
        a._type === 'subtotal' || b._type === 'subtotal' ? 0
          : (thuTuDv.get((a as RowData).donViId) ?? 999) - (thuTuDv.get((b as RowData).donViId) ?? 999),
    }]),
    {
      title: 'Chức vụ, vị trí đảm nhiệm', key: 'chucVu', width: 210,
      render: (_: any, r: DisplayRow) => r._type === 'data' ? r.chucVuHienThi : '',
    },
    {
      title: 'Mã CDNN', key: 'maCDNN', width: 105, align: 'center' as const,
      render: (_: any, r: DisplayRow) => r._type === 'data' ? r.maCDNN : '',
    },
    {
      title: 'Bậc', key: 'bac', width: 55, align: 'center' as const,
      render: (_: any, r: DisplayRow) => r._type === 'data' ? r.bac : '',
      sorter: (a: DisplayRow, b: DisplayRow) =>
        a._type === 'subtotal' || b._type === 'subtotal' ? 0
          : ((a as RowData).bac as number || 0) - ((b as RowData).bac as number || 0),
    },
    {
      title: 'Hệ số', key: 'heSo', width: 70, align: 'right' as const,
      render: (_: any, r: DisplayRow) =>
        r._type === 'subtotal'
          ? <Text strong style={{ color: '#1677ff' }}>{r.heSo.toFixed(3)}</Text>
          : r.heSo,
      sorter: (a: DisplayRow, b: DisplayRow) =>
        a._type === 'subtotal' || b._type === 'subtotal' ? 0
          : ((a as RowData).heSo as number || 0) - ((b as RowData).heSo as number || 0),
    },
    {
      title: 'Phụ cấp thâm niên vượt khung',
      children: [
        {
          title: '%', key: 'vkPct', width: 55, align: 'center' as const,
          render: (_: any, r: DisplayRow) => r._type === 'data' && r.vkPct ? r.vkPct : '',
        },
        {
          title: 'Hệ số', key: 'vkHeSo', width: 70, align: 'right' as const,
          render: (_: any, r: DisplayRow) => r._type === 'subtotal' ? <Text strong>{d3(r.vkHeSo)}</Text> : d3((r as RowData).vkHeSo),
          sorter: (a: DisplayRow, b: DisplayRow) =>
            a._type === 'subtotal' || b._type === 'subtotal' ? 0 : (a as RowData).vkHeSo - (b as RowData).vkHeSo,
        },
      ],
    },
    {
      title: 'Tổng hệ số lương chính', key: 'tongHSLC', width: 90, align: 'right' as const,
      render: (_: any, r: DisplayRow) =>
        r._type === 'subtotal'
          ? <Text strong>{r.tongHSLC.toFixed(3)}</Text>
          : (r.tongHSLC ? r.tongHSLC.toFixed(3) : ''),
      sorter: (a: DisplayRow, b: DisplayRow) =>
        a._type === 'subtotal' || b._type === 'subtotal' ? 0 : (a as RowData).tongHSLC - (b as RowData).tongHSLC,
    },
    {
      title: 'Phụ cấp chức vụ', key: 'pcCV', width: 85, align: 'right' as const,
      render: (_: any, r: DisplayRow) => {
        if (r._type === 'subtotal') return <Text strong>{d3(r.pcCV)}</Text>
        const den = (r as RowData).pcCvBaoLuuDen
        return den
          ? <Tooltip title={`Bảo lưu PCCV (sắp xếp tổ chức) đến ${formatDate(den)}`}><span>{d3(r.pcCV)} <Tag color="gold" style={{ fontSize: 11, lineHeight: '14px', padding: '0 3px', marginInlineEnd: 0 }}>BL</Tag></span></Tooltip>
          : d3((r as RowData).pcCV)
      },
      sorter: (a: DisplayRow, b: DisplayRow) =>
        a._type === 'subtotal' || b._type === 'subtotal' ? 0 : (a as RowData).pcCV - (b as RowData).pcCV,
    },
    {
      title: 'Phụ cấp trách nhiệm', key: 'pcTN', width: 95, align: 'right' as const,
      render: (_: any, r: DisplayRow) => r._type === 'subtotal' ? <Text strong>{d3(r.pcTN)}</Text> : d3((r as RowData).pcTN),
      sorter: (a: DisplayRow, b: DisplayRow) =>
        a._type === 'subtotal' || b._type === 'subtotal' ? 0 : (a as RowData).pcTN - (b as RowData).pcTN,
    },
    {
      title: 'Phụ cấp thâm niên nhà giáo', key: 'tnng',
      children: [
        {
          title: '%', key: 'pcTNNG_Pct', width: 55, align: 'center' as const,
          render: (_: any, r: DisplayRow) => r._type === 'data' && r.pcTNNG_Pct ? `${r.pcTNNG_Pct}%` : '',
        },
        {
          title: 'Hệ số', key: 'pcTNNG_HeSo', width: 70, align: 'right' as const,
          render: (_: any, r: DisplayRow) => r._type === 'subtotal' ? <Text strong>{d3(r.pcTNNG_HeSo)}</Text> : d3((r as RowData).pcTNNG_HeSo),
          sorter: (a: DisplayRow, b: DisplayRow) =>
            a._type === 'subtotal' || b._type === 'subtotal' ? 0 : (a as RowData).pcTNNG_HeSo - (b as RowData).pcTNNG_HeSo,
        },
      ],
    },
    {
      title: 'Hệ số chênh lệch bảo lưu', key: 'hsBaoLuu', width: 95, align: 'right' as const,
      render: (_: any, r: DisplayRow) => r._type === 'subtotal' ? <Text strong>{d3(r.hsBaoLuu)}</Text> : d3((r as RowData).hsBaoLuu),
    },
    {
      title: 'PC ưu đãi nhà giáo', key: 'pcUD', width: 90, align: 'right' as const,
      render: (_: any, r: DisplayRow) => r._type === 'subtotal' ? <Text strong>{d3(r.pcUD)}</Text> : d3((r as RowData).pcUD),
      sorter: (a: DisplayRow, b: DisplayRow) =>
        a._type === 'subtotal' || b._type === 'subtotal' ? 0 : (a as RowData).pcUD - (b as RowData).pcUD,
    },
    {
      title: 'PC công vụ', key: 'pcCongVu', width: 85, align: 'right' as const,
      render: (_: any, r: DisplayRow) => r._type === 'subtotal' ? <Text strong>{d3(r.pcCongVu)}</Text> : d3((r as RowData).pcCongVu),
    },
    {
      // Cột chốt của cả bảng: tổng hệ số lương thực hưởng của từng viên chức,
      // gồm lương chính cộng toàn bộ phụ cấp. Tô nền để đọc bảng rộng không lạc.
      title: 'TỔNG HỆ SỐ LƯƠNG (1 tháng)', key: 'tong1Thang', width: 120, align: 'right' as const,
      onCell: () => ({ style: { background: '#e6f4ff' } }),
      render: (_: any, r: DisplayRow) =>
        r._type === 'subtotal'
          ? <Text strong style={{ color: '#1677ff' }}>{r.tong1Thang.toFixed(3)}</Text>
          : <Text strong style={{ color: '#0958d9', fontSize: 14 }}>{(r as RowData).tong1Thang.toFixed(3)}</Text>,
      sorter: (a: DisplayRow, b: DisplayRow) =>
        a._type === 'subtotal' || b._type === 'subtotal' ? 0 : (a as RowData).tong1Thang - (b as RowData).tong1Thang,
    },
    {
      title: 'Lương theo mức tiền (đ/tháng)', key: 'mucLuongTien', width: 120, align: 'right' as const,
      render: (_: any, r: DisplayRow) => {
        const v = r.mucLuongTien
        if (!v) return ''
        const s = v.toLocaleString('vi-VN')
        return r._type === 'subtotal' ? <Text strong>{s}</Text> : s
      },
      sorter: (a: DisplayRow, b: DisplayRow) =>
        a._type === 'subtotal' || b._type === 'subtotal' ? 0 : (a as RowData).mucLuongTien - (b as RowData).mucLuongTien,
    },
  ]

  const columns = tatCaCot.filter((c) => !cotAn.has(c.key))

  const handleExport = async () => {
    const donViTen = filterDonVi
      ? (donVis.find((d) => d.id === filterDonVi)?.ten ?? 'TatCa')
      : 'TatCa'
    const dvMap = new Map(donVis.map((d) => [d.id, d.ten]))
    const hang = (r: RowData): Record<string, O> => ({
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
      'Bảo lưu PCCV đến': r.pcCvBaoLuuDen ? formatDate(r.pcCvBaoLuuDen) : '',
      'PC Trách nhiệm': r.pcTN || '',
      ...(hienNhaGiao ? { 'PC TNNG (%)': r.pcTNNG_Pct || '', 'PC TNNG Hệ số': r.pcTNNG_HeSo || '', 'Mốc xét nâng TNNG': r.mocTNNG } : {}),
      'HS Chênh lệch bảo lưu': r.hsBaoLuu || '',
      ...(hienNhaGiao ? { 'PC ưu đãi nhà giáo': r.pcUD || '' } : {}),
      ...(hienCongVu ? { 'PC công vụ (%)': r.pcCongVuPct || '', 'PC công vụ Hệ số': r.pcCongVu || '' } : {}),
      'Tổng HS lương 1 tháng': r.tong1Thang,
      'Tổng HS lương 6 tháng đầu năm': r.tong6Thang,
      'Lương theo mức tiền (đ/tháng)': r.mucLuongTien || '',
    })
    const dongCong = (ten: string, t: ReturnType<typeof sumGroup>): Record<string, O> => ({
      ...Object.fromEntries(Object.keys(hang(rows[0])).map((k) => [k, ''])),
      'Họ và tên': ten,
      'Hệ số': t.heSo, 'PC TNVK Hệ số': t.vkHeSo, 'Tổng HS lương chính': t.tongHSLC, 'PC Chức vụ': t.pcCV,
      'PC Trách nhiệm': t.pcTN, 'HS Chênh lệch bảo lưu': t.hsBaoLuu,
      ...(hienNhaGiao ? { 'PC TNNG Hệ số': t.pcTNNG_HeSo, 'PC ưu đãi nhà giáo': t.pcUD } : {}),
      ...(hienCongVu ? { 'PC công vụ Hệ số': t.pcCongVu } : {}),
      'Tổng HS lương 1 tháng': t.tong1Thang, 'Tổng HS lương 6 tháng đầu năm': t.tong6Thang, 'Lương theo mức tiền (đ/tháng)': t.mucLuongTien,
    })
    if (!rows.length) return

    // Danh sách người, dòng "Cộng" từng trường (khi có nhiều trường) và dòng "TỔNG CỘNG" cuối bảng
    const nhom = new Map<string, RowData[]>()
    for (const r of rows) nhom.set(r.donViId, [...(nhom.get(r.donViId) ?? []), r])
    const coCongTruong = nhom.size > 1
    const data: Record<string, O>[] = []
    const dongNguoi: number[] = []
    const cacCong: { dong: number; cac: number[] }[] = []
    for (const [dvId, grp] of nhom) {
      const cac: number[] = []
      for (const r of grp) { cac.push(data.length); dongNguoi.push(data.length); data.push(hang(r)) }
      if (coCongTruong) { cacCong.push({ dong: data.length, cac }); data.push(dongCong(`Cộng: ${dvMap.get(dvId) ?? dvId} (${grp.length} người)`, sumGroup(grp))) }
    }
    const dongTongCong = data.length
    data.push(dongCong(`TỔNG CỘNG (${rows.length} người)`, sumGroup(rows)))

    const tieuDe = ['BẢNG TỔNG HỢP HỆ SỐ LƯƠNG, PHỤ CẤP', filterDonVi ? donViTen : khoi === 'CO_QUAN' ? 'Các phòng chuyên môn thuộc UBND phường Gia Viên' : khoi === 'DVSN' ? 'Các đơn vị sự nghiệp thuộc UBND phường Gia Viên' : khoi === 'TRUONG_HOC' ? 'Các trường thuộc phường Gia Viên' : 'Các đơn vị thuộc phường Gia Viên']
    const trang = trangTuDanhSach(data, 'Bang TH Luong', { tieuDe })
    // Dòng dữ liệu thứ i nằm ở dòng (tiêu đề + 1 dòng trống + dòng tiêu đề cột) + i
    const lech = tieuDe.length + 2
    const d = (i: number) => lech + i
    const cot = Object.keys(data[0])
    const c = (k: string) => cot.indexOf(k)
    const C = {
      heSo: c('Hệ số'), vkPct: c('PC TNVK (%)'), vkHs: c('PC TNVK Hệ số'), tongHSLC: c('Tổng HS lương chính'), cv: c('PC Chức vụ'),
      tn: c('PC Trách nhiệm'), tnngPct: c('PC TNNG (%)'), tnngHs: c('PC TNNG Hệ số'), bl: c('HS Chênh lệch bảo lưu'), ud: c('PC ưu đãi nhà giáo'),
      cvuPct: c('PC công vụ (%)'), cvuHs: c('PC công vụ Hệ số'),
      t1: c('Tổng HS lương 1 tháng'), t6: c('Tổng HS lương 6 tháng đầu năm'), tien: c('Lương theo mức tiền (đ/tháng)'),
    }
    const nguoi = dongNguoi.map(d)
    // Công thức trong từng dòng người - đúng cách phần mềm tính (làm tròn 3 chữ số)
    ganCotTinh(trang.dong, C.vkHs, nguoi, (o) => `ROUND(${o(C.heSo)}*${o(C.vkPct)}/100,3)`, (so) => lamTronExcel(so(C.heSo) * so(C.vkPct) / 100, 3))
    ganCotTinh(trang.dong, C.tongHSLC, nguoi, (o) => `ROUND(${o(C.heSo)}+${o(C.vkHs)},3)`, (so) => lamTronExcel(so(C.heSo) + so(C.vkHs), 3))
    // PC thâm niên nhà giáo / PC công vụ: % trên lương chính + PC chức vụ (cột nào không có trong bảng thì bỏ qua)
    if (C.cvuHs >= 0) ganCotTinh(trang.dong, C.cvuHs, nguoi, (o) => `ROUND((${o(C.tongHSLC)}+${o(C.cv)})*${o(C.cvuPct)}/100,3)`, (so) => lamTronExcel((so(C.tongHSLC) + so(C.cv)) * so(C.cvuPct) / 100, 3))
    if (C.tnngHs >= 0) ganCotTinh(trang.dong, C.tnngHs, nguoi, (o) => `ROUND((${o(C.tongHSLC)}+${o(C.cv)})*${o(C.tnngPct)}/100,3)`, (so) => lamTronExcel((so(C.tongHSLC) + so(C.cv)) * so(C.tnngPct) / 100, 3))
    const cotCongT1 = [C.tongHSLC, C.cv, C.tn, C.tnngHs, C.bl, C.ud, C.cvuHs].filter((x) => x >= 0)
    ganCotTinh(trang.dong, C.t1, nguoi,
      (o) => `ROUND(${cotCongT1.map(o).join('+')},3)`,
      (so) => lamTronExcel(cotCongT1.reduce((t, x) => t + so(x), 0), 3))
    ganCotTinh(trang.dong, C.t6, nguoi, (o) => `ROUND(${o(C.t1)}*6,3)`, (so) => lamTronExcel(so(C.t1) * 6, 3))
    // Dòng cộng từng trường = SUM người của trường; tổng cộng = SUM các dòng cộng (hoặc SUM người khi một trường)
    const cotCong = [C.heSo, C.vkHs, C.tongHSLC, C.cv, C.tn, C.tnngHs, C.bl, C.ud, C.cvuHs, C.t1, C.t6, C.tien].filter((x) => x >= 0)
    for (const g of cacCong) ganDongTong(trang.dong, d(g.dong), g.cac.map(d), cotCong)
    ganDongTong(trang.dong, d(dongTongCong), coCongTruong ? cacCong.map((g) => d(g.dong)) : nguoi, cotCong)

    trang.dam = [...cacCong.map((g) => d(g.dong)), d(dongTongCong)]
    trang.nen = Object.fromEntries([...cacCong.map((g) => [d(g.dong), 'FFEFF6FF']), [d(dongTongCong), 'FFDBEAFE']])
    await xuatExcelA4(`BangTongHopLuong_${donViTen}_${dayjs().format('YYYYMMDD')}`, [trang])
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Bảng tổng hợp lương{' '}
          <span style={{ fontWeight: 400, fontSize: 14, color: '#666' }}>
            ({rows.length} người - Tổng hệ số lương: <strong>{grandTotal.tong1Thang.toFixed(3)}</strong>
            {grandTotal.mucLuongTien > 0 && <> - Lương theo mức tiền: <strong>{grandTotal.mucLuongTien.toLocaleString('vi-VN')} đ</strong></>})
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
            placeholder="Chọn đơn vị"
            style={{ width: 240 }}
            value={filterDonVi}
            onChange={setFilterDonVi}
            allowClear
            options={donVis.map((d) => ({ value: d.id, label: d.ten }))}
          />
        )}
        <Select
          placeholder="Loại hình lao động"
          style={{ width: 220 }}
          value={filterLoai}
          onChange={setFilterLoai}
          allowClear
          options={loaiLaoDongTheoKhoi(khoi ?? undefined).map((k) => ({ value: k, label: LOAI_LAO_DONG_LABELS[k] }))}
        />
      </Space>

      <Table
        dataSource={displayRows}
        columns={columns}
        rowKey="key"
        size="small"
        bordered
        scroll={{ x: 1855, y: 'calc(100vh - 280px)' }}
        rowClassName={(r: DisplayRow) => r._type === 'subtotal' ? 'subtotal-row' : ''}
        pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: [50, 100, 200], showTotal: (t) => `Tổng ${rows.length} người` }}
        summary={() => {
          // Dựng theo danh sách thay vì viết cứng từng chỉ số cột. Trước đây các
          // chỉ số 0..19 cố định, nên chỉ cần thêm một cột là toàn bộ dòng tổng
          // lệch sang phải mà không ai để ý.
          const oTong: { noiDung?: ReactNode; canPhai?: boolean }[] = [
            { noiDung: `${rows.length} người` }, // chức vụ
            {}, // mã CDNN
            {}, // bậc
            { noiDung: grandTotal.heSo.toFixed(3), canPhai: true }, // hệ số
            {}, // % vượt khung
            { noiDung: d3(grandTotal.vkHeSo), canPhai: true },
            { noiDung: grandTotal.tongHSLC.toFixed(3), canPhai: true },
            { noiDung: d3(grandTotal.pcCV), canPhai: true },
            { noiDung: d3(grandTotal.pcTN), canPhai: true },
            ...(hienNhaGiao ? [{}, { noiDung: d3(grandTotal.pcTNNG_HeSo), canPhai: true }] : []), // % và hệ số thâm niên nhà giáo
            { noiDung: d3(grandTotal.hsBaoLuu), canPhai: true },
            ...(hienNhaGiao ? [{ noiDung: d3(grandTotal.pcUD), canPhai: true }] : []),
            ...(hienCongVu ? [{ noiDung: d3(grandTotal.pcCongVu), canPhai: true }] : []),
            { noiDung: <span style={{ color: '#0958d9' }}>{grandTotal.tong1Thang.toFixed(3)}</span>, canPhai: true },
            { noiDung: grandTotal.mucLuongTien ? grandTotal.mucLuongTien.toLocaleString('vi-VN') : '', canPhai: true },
          ]
          let i = 0
          return (
            <Table.Summary fixed="top">
              <Table.Summary.Row style={{ background: '#e6f4ff', fontWeight: 700 }}>
                <Table.Summary.Cell index={i++} colSpan={2} align="center">Tổng cộng</Table.Summary.Cell>
                {/* Cột đơn vị trường chỉ có khi xem nhiều trường */}
                {!scopeDonViId && <Table.Summary.Cell index={i++} />}
                {oTong.map((o) => (
                  <Table.Summary.Cell key={i} index={i++} align={o.canPhai ? 'right' : 'center'}>
                    {o.noiDung}
                  </Table.Summary.Cell>
                ))}
              </Table.Summary.Row>
            </Table.Summary>
          )
        }}
      />

      <style>{`.subtotal-row td { background: #f0f5ff !important; font-weight: 600; }`}</style>
    </Card>
  )
}
