import { useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Segmented, Select, Space, Switch, Table, Typography } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { type CapHoc, TEN_CAP, THU_TU_CAP, dsNamHoc, fmt, laCapHoc, lamTron1, namHocHienHanh } from '@/utils/dinhMuc'
import type { ChucDanhTra } from '@/utils/dinhMuc'
import {
  type ChiSo, type DongBaoCao, CHI_SO_MAC_DINH, MA_TOAN_CAP, TAT_CA_CHI_SO, TEN_CHI_SO, TRUONG_CHI_SO,
  dungBaoCaoCapHoc, laSoKhac0, locVaDanhSo, trangExcelBaoCao,
} from '@/utils/baoCaoDinhMuc'
import { xuatExcelA4 } from '@/utils/excelA4'

const { Text } = Typography
const CAP: CapHoc[] = ['MAM_NON', 'TIEU_HOC', 'THCS']
const rongChiSo = (c: ChiSo) => (c === 'CL' ? 84 : c === 'CLG' ? 76 : c === 'DM' ? 72 : c === 'HD' ? 70 : 60)
const MAU_THUA = '#cf1322'
const MAU_THIEU = '#1d4ed8'

/** Báo cáo tổng hợp định mức và cơ cấu VTVL theo cấp học: các trường cùng cấp đặt cạnh nhau trong một bảng */
export default function BaoCaoDinhMucCapHoc() {
  const donVis = useDanhMucStore((s) => s.donVis)
  const quyMos = useDanhMucStore((s) => s.quyMoTruongs)
  const chiTieus = useDanhMucStore((s) => s.chiTieuBienChes)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const [cap, setCap] = useState<CapHoc>('MAM_NON')
  const [namHoc, setNamHoc] = useState(namHocHienHanh)
  const [chiSo, setChiSo] = useState<ChiSo[]>(CHI_SO_MAC_DINH)
  const [anTrong, setAnTrong] = useState(true)
  const [chonTruong, setChonTruong] = useState<string[]>([])
  const [dangXuat, setDangXuat] = useState(false)

  const layCd = useMemo(() => {
    const m = new Map(chucDanhs.map((c) => [c.id, c]))
    return (id?: string): ChucDanhTra | undefined => (id ? m.get(id) : undefined)
  }, [chucDanhs])

  const truongTheoCap = (c: CapHoc) => donVis
    .filter((d) => d.active && laCapHoc(d.loai) && d.loai === c)
    .sort((a, b) => THU_TU_CAP[a.loai as CapHoc] - THU_TU_CAP[b.loai as CapHoc] || a.ten.localeCompare(b.ten, 'vi'))
  const truongCap = truongTheoCap(cap)
  const truongHien = chonTruong.length ? truongCap.filter((t) => chonTruong.includes(t.id)) : truongCap

  const bc = useMemo(
    () => dungBaoCaoCapHoc(cap, namHoc, truongHien, quyMos, vienChucs, layCd, chiTieus ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cap, namHoc, truongHien.map((t) => t.id).join(','), quyMos, vienChucs, layCd, chiTieus],
  )
  const dongHien = locVaDanhSo(bc.dong, anTrong)
  const chuaKhai = bc.cot.filter((c) => !c.daKhai)

  const chiSoSapXep = TAT_CA_CHI_SO.filter((c) => chiSo.includes(c))
  const k = chiSoSapXep.length

  const oSo = (v: number | null | undefined, c: ChiSo) => {
    if (v == null) return <Text type="secondary">-</Text>
    if (c === 'CL' || c === 'CLG') {
      if (!laSoKhac0(v)) return <span style={{ color: '#16a34a' }}>0</span>
      return <b style={{ color: v > 0 ? MAU_THUA : MAU_THIEU }}>{v > 0 ? '+' : '-'}{fmt(Math.abs(v))}</b>
    }
    return c === 'DM' ? fmt(v) : lamTron1(v)
  }

  const nhomCot = [{ id: MA_TOAN_CAP, ten: `Toàn cấp ${TEN_CAP[cap]}`, tong: true }, ...bc.cot.map((c) => ({ id: c.id, ten: c.tenNgan, tong: false, daKhai: c.daKhai }))]
  const columns: ColumnsType<DongBaoCao> = [
    {
      title: 'STT', key: 'stt', width: 48, align: 'center', fixed: 'left',
      onCell: (d) => (d.loai === 'muc' ? { colSpan: 1 } : {}),
      render: (_, d) => d.stt ?? '',
    },
    {
      title: 'Vị trí việc làm', key: 'ten', width: 300, fixed: 'left',
      onCell: (d) => (d.loai === 'muc' ? { colSpan: 1 + nhomCot.length * k } : {}),
      render: (_, d) => (d.loai === 'muc' || d.loai === 'nhom' || d.loai === 'tong' ? <b>{d.ten}</b> : d.ten),
    },
    ...nhomCot.map((n) => ({
      title: (
        <span title={n.ten} style={{ whiteSpace: 'normal' }}>
          {n.ten}{'daKhai' in n && !n.daKhai && <><br /><Text type="warning" style={{ fontSize: 12, fontWeight: 400 }}>chưa khai quy mô</Text></>}
        </span>
      ),
      key: n.id,
      onHeaderCell: () => ({ className: 'ke-nhom-dau', style: n.tong ? { background: '#e0e7ff' } : {} }),
      children: chiSoSapXep.map((c, j) => ({
        onHeaderCell: () => ({ className: j === 0 ? 'ke-nhom-dau' : undefined }),
        title: TEN_CHI_SO[c].ngan,
        key: `${n.id}-${c}`,
        width: rongChiSo(c),
        align: 'center' as const,
        onCell: (d: DongBaoCao) => {
          if (d.loai === 'muc') return { colSpan: 0 }
          const dau = j === 0 ? 'ke-nhom-dau' : undefined
          if (d.loai === 'quyMo') return { colSpan: j === 0 ? k : 0, className: dau }
          return { className: dau, style: n.tong ? { background: '#f5f7ff' } : undefined }
        },
        render: (_: unknown, d: DongBaoCao) => {
          const v = d.gt[n.id] ?? {}
          if (d.loai === 'quyMo') return v.chu ?? (v.cm == null ? <Text type="secondary">-</Text> : v.cm.toLocaleString('vi-VN'))
          return oSo(v[TRUONG_CHI_SO[c]] as number | null | undefined, c)
        },
      })),
    })),
  ]

  const xuat = async (tatCa: boolean) => {
    setDangXuat(true)
    try {
      const trangs = (tatCa ? CAP : [cap]).map((c) => {
        const ds = c === cap ? truongHien : truongTheoCap(c)
        const b = dungBaoCaoCapHoc(c, namHoc, ds, quyMos, vienChucs, layCd, chiTieus ?? [])
        return trangExcelBaoCao(c, namHoc, { cot: b.cot, dong: locVaDanhSo(b.dong, anTrong) }, chiSoSapXep)
      })
      await xuatExcelA4(`Tong-hop-dinh-muc-VTVL-${tatCa ? 'ca-3-cap' : TEN_CAP[cap].replace(/\s+/g, '-')}-${namHoc}`, trangs)
    } finally {
      setDangXuat(false)
    }
  }

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Segmented<CapHoc>
          value={cap}
          onChange={(v) => { setCap(v); setChonTruong([]) }}
          options={CAP.map((c) => ({ value: c, label: TEN_CAP[c] }))}
        />
        <Select value={namHoc} onChange={setNamHoc} style={{ width: 200 }} options={dsNamHoc().map((n) => ({ value: n, label: `Năm học ${n}` }))} />
        <Select
          mode="multiple" allowClear maxTagCount="responsive" placeholder={`Tất cả ${truongCap.length} trường`}
          value={chonTruong} onChange={setChonTruong} style={{ minWidth: 280, maxWidth: 520 }}
          options={truongCap.map((t) => ({ value: t.id, label: t.ten }))}
        />
      </Space>
      <Space wrap style={{ marginBottom: 12 }} size={16}>
        <span>
          <Text type="secondary">Hiển thị: </Text>
          <Checkbox.Group
            value={chiSo}
            onChange={(v) => v.length && setChiSo(v as ChiSo[])}
            options={TAT_CA_CHI_SO.map((c) => ({ value: c, label: TEN_CHI_SO[c].day }))}
          />
        </span>
        <span><Switch size="small" checked={anTrong} onChange={setAnTrong} /> <Text>Ẩn vị trí không có số liệu</Text></span>
        <Button type="primary" icon={<FileExcelOutlined />} loading={dangXuat} onClick={() => xuat(false)}>Xuất Excel cấp {TEN_CAP[cap]}</Button>
        <Button icon={<FileExcelOutlined />} loading={dangXuat} onClick={() => xuat(true)}>Xuất cả 3 cấp</Button>
      </Space>
      {chuaKhai.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          title={`${chuaKhai.length} trường chưa khai báo quy mô năm học ${namHoc}: ${chuaKhai.map((c) => c.tenNgan).join(', ')}`}
          description="Các trường này chỉ có số có mặt, chưa có định mức để so sánh."
        />
      )}
      <Table<DongBaoCao>
        size="small"
        bordered
        rowKey="key"
        pagination={false}
        dataSource={dongHien}
        columns={columns}
        scroll={{ x: 348 + nhomCot.length * chiSoSapXep.reduce((s, c) => s + rongChiSo(c), 0), y: 'calc(100vh - 330px)' }}
        className="bang-ke-ro"
        rowClassName={(d) => (d.nhom ? (d.loai === 'nhom' ? `bc-nhom vt-n-${d.nhom} vt-tieu-de vt-nhom-dau` : `vt-n-${d.nhom}`) : `bc-${d.loai}`)}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
        Giao và có mặt tính biên chế (ngân sách + sự nghiệp); dòng nhóm so với chỉ tiêu giao và định mức, dòng từng vị trí chỉ so định mức; ở cột toàn cấp, thừa/thiếu so giao chỉ cộng các trường đã được giao. Thừa ghi màu đỏ, thiếu ghi màu xanh. Cột Toàn cấp cộng các trường đang hiển thị. Tổ trưởng, tổ phó thuộc định mức giáo viên (không cộng lại); cấp dưỡng hợp đồng, ngoài danh mục VTVL và giáo viên dạy chuyên không tính định mức.
      </Text>
      <style>{`
        .bc-muc td { background: #dbeafe !important; font-weight: 700; }
        .bc-nhom td { background: #f1f5f9 !important; font-weight: 600; }
        .bc-tong td { background: #e0e7ff !important; font-weight: 700; }
      `}</style>
    </>
  )
}
