import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  Card, Typography, Select, Table, Tag, Tabs, InputNumber, Button, Space, Alert, App, Input,
  Statistic, Row, Col, Tooltip, Empty, Segmented, Badge, Checkbox, Drawer,
} from 'antd'
import {
  SaveOutlined, DownloadOutlined, ArrowLeftOutlined, BulbOutlined, SearchOutlined, UndoOutlined, HistoryOutlined, TableOutlined,
} from '@ant-design/icons'
import { xuatExcelA4 } from '@/utils/excelA4'
import type { VungBang } from '@/utils/excelA4'
import { useNavigate } from 'react-router-dom'
import ChiTieuBienCheCard from './ChiTieuBienCheCard'
import { MAU_NHOM_VTVL } from '@/utils/mauNhomVtvl'
import { useAuth } from '@/hooks/useAuth'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { duocTinhSoLieu } from '@/types/vienChuc'
import type { VienChuc } from '@/types/vienChuc'
import type { DonVi } from '@/types/donVi'
import type { QuyMoTruong, QuyMoLichSu, NoiDungQuyMo } from '@/types/quyMo'
import { layNoiDung, soSanhNoiDung, tomTatNoiDung } from '@/utils/quyMoLichSu'
import { choGhiXongVaKiemTra } from '@/lib/supabase'
import { HANG_TRUONG_LABELS, getHangTruong } from '@/utils/hangTruong'
import { logAction } from '@/utils/auditLogger'
import { exportToExcel } from '@/utils/exportExcel'
import { formatDatetime } from '@/utils/helpers'
import {
  type CapHoc, type DongDinhMuc, type KetQuaDinhMuc, type DongPhanBoKiem, type TongNhom,
  laCapHoc, TEN_CAP, THU_TU_CAP, KHOI, NHOM_DINH_MUC, MON_GIANG_DAY, CO_HAI_BUOI, KHOI_TIN_TU_CHON,
  namHocHienHanh, dsNamHoc, idQuyMo, tinhDinhMuc, tongQuyMo, goiYMonDay, tenMonDay, fmt, lamTron1, nhomNguoi,
  demChuaPhanCongMN, thongKePhanCongMN,
} from '@/utils/dinhMuc'

const { Title, Text } = Typography

const NGUONG_HANG: Record<CapHoc, string> = {
  MAM_NON: 'Hạng I từ 9 nhóm, lớp; hạng II từ 6 đến 8; hạng III từ 5 trở xuống',
  TIEU_HOC: 'Hạng I từ 28 lớp; hạng II từ 18 đến 27; hạng III dưới 18',
  THCS: 'Hạng I từ 28 lớp; hạng II từ 18 đến 27; hạng III dưới 18',
}

type TruongKhoi = 'soLop' | 'soHocSinh' | 'soLop2Buoi' | 'soHocSinh2Buoi'

const quyMoTrong = (donViId: string, namHoc: string): QuyMoTruong => ({
  id: idQuyMo(donViId, namHoc), donViId, namHoc, khoi: {}, createdAt: '', updatedAt: '',
})

// So sánh phần người dùng nhập, bỏ qua thứ tự khóa và thông tin người cập nhật
function vanTay(q: QuyMoTruong | undefined, cap: CapHoc): string {
  if (!q) return vanTay(quyMoTrong('', ''), cap)
  return JSON.stringify({
    k: KHOI[cap].map((k) => {
      const o = q.khoi[k.ma]
      return [o?.soLop ?? 0, o?.soHocSinh ?? 0, ...(CO_HAI_BUOI[cap] ? [o?.soLop2Buoi ?? 0, o?.soHocSinh2Buoi ?? 0] : [])]
    }),
    b: cap === 'TIEU_HOC' ? [...(q.khoiDayTinThem ?? [])].sort() : [],
    t: Object.entries(q.dinhMucNhapTay ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    kn: cap === 'THCS' ? Object.entries(q.kiemNhiemNhapTay ?? {}).sort(([a], [b]) => a.localeCompare(b)) : [],
    d: cap === 'MAM_NON' ? q.soDiemTruong ?? 0 : 0,
    g: (q.ghiChu ?? '').trim(),
  })
}

const MAU_THUA = '#cf1322'
const MAU_THIEU = '#1d4ed8'
// Thừa (vượt định mức) = ĐỎ, thiếu (còn chỗ) = XANH DƯƠNG; nền đặc, chữ trắng đậm để nhìn rõ từ xa
const kieuChenhLech =(thua: boolean) => ({ background: thua ? MAU_THUA : MAU_THIEU, borderColor: thua ? MAU_THUA : MAU_THIEU, color: '#fff', fontWeight: 700 })

function ChenhLech({ v }: { v: number | null }) {
  if (v == null) return <Text type="secondary">-</Text>
  const r = lamTron1(v)
  if (r === 0) return <Tag color="success" style={{ marginInlineEnd: 0 }}>Đủ</Tag>
  return (
    <Tooltip title={r > 0 ? 'Thừa so với định mức' : 'Thiếu so với định mức'}>
      <Tag variant="solid" style={{ ...kieuChenhLech(r > 0), marginInlineEnd: 0, fontVariantNumeric: 'tabular-nums' }}>
        {r > 0 ? '+' : '-'}{fmt(Math.abs(r))}
      </Tag>
    </Tooltip>
  )
}

function useTenChucDanh() {
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  return useMemo(() => {
    const m = new Map(chucDanhs.map((c) => [c.id, c]))
    return {
      lay: (id?: string) => (id ? m.get(id) : undefined),
      ma: (id?: string) => (id ? m.get(id)?.ma : undefined),
    }
  }, [chucDanhs])
}

export default function QuyMoDinhMucPage() {
  const { scopeDonViId } = useAuth()
  const donVis = useDanhMucStore((s) => s.donVis)
  const [namHoc, setNamHoc] = useState(namHocHienHanh)
  const [chon, setChon] = useState<string | undefined>()

  const truongs = useMemo(
    () => donVis
      .filter((d) => d.active && laCapHoc(d.loai))
      .sort((a, b) => THU_TU_CAP[a.loai as CapHoc] - THU_TU_CAP[b.loai as CapHoc] || a.ten.localeCompare(b.ten, 'vi')),
    [donVis],
  )
  const donViId = scopeDonViId ?? chon
  const donVi = truongs.find((d) => d.id === donViId)
  const hienHanh = namHocHienHanh()

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Định mức viên chức và Cơ cấu VTVL</Title>
          <Text type="secondary">
            Khai báo số lớp, số học sinh từng khối; tính định mức theo TT 19/2023/TT-BGDĐT (mầm non) và TT 20/2023/TT-BGDĐT (tiểu học, THCS)
          </Text>
        </div>
        <Space wrap>
          <Select
            value={namHoc}
            onChange={setNamHoc}
            style={{ width: 230 }}
            options={dsNamHoc().map((n) => ({ value: n, label: `Năm học ${n}${n === hienHanh ? ' (hiện hành)' : ''}` }))}
          />
          {!scopeDonViId && (
            <Select
              value={chon}
              onChange={setChon}
              allowClear
              placeholder="Tổng hợp toàn phường"
              style={{ width: 240 }}
              showSearch
              optionFilterProp="label"
              options={truongs.map((d) => ({ value: d.id, label: d.ten }))}
            />
          )}
        </Space>
      </div>

      {donVi ? (
        <ChiTietTruong
          key={`${donVi.id}-${namHoc}`}
          donVi={donVi}
          namHoc={namHoc}
          onBack={scopeDonViId ? undefined : () => setChon(undefined)}
        />
      ) : scopeDonViId ? (
        <Empty description="Đơn vị của tài khoản không phải trường mầm non, tiểu học hoặc THCS" />
      ) : (
        <TongHopPhuong truongs={truongs} namHoc={namHoc} onChon={setChon} />
      )}
    </Card>
  )
}

// ───────────────────────────── Tổng hợp toàn phường ─────────────────────────────

const NHOM_TH: { key: 'QUAN_LY' | 'CHUYEN_MON' | 'HO_TRO'; ten: string }[] = [
  { key: 'QUAN_LY', ten: 'I. Lãnh đạo, quản lý' },
  { key: 'CHUYEN_MON', ten: 'II. Chuyên môn nghiệp vụ' },
  { key: 'HO_TRO', ten: 'III. Hỗ trợ' },
]
type ONhomTH = { dm: number | null; giao: number | null; cm: number; soGiao: number | null; soDm: number | null }
type DongTH = {
  key: string; loai: 'truong' | 'cap' | 'phuong'; ten: string; dv?: DonVi; cap?: CapHoc
  qm?: QuyMoTruong; kq?: KetQuaDinhMuc; soTruong?: number
  lop: number | null; hs: number | null
  nhom: Record<'QUAN_LY' | 'CHUYEN_MON' | 'HO_TRO', ONhomTH>
  hd235Giao: number | null; hd235CoMat: number
}
const congN = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0))

function TongHopPhuong({ truongs, namHoc, onChon }: { truongs: DonVi[]; namHoc: string; onChon: (id: string) => void }) {
  const quyMos = useDanhMucStore((s) => s.quyMoTruongs)
  const chiTieus = useDanhMucStore((s) => s.chiTieuBienChes)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const cd = useTenChucDanh()
  const navigate = useNavigate()
  const { laQuanTri, isVHXH, isLanhDao } = useAuth()

  // Mỗi trường, theo 3 nhóm VTVL: định mức, biên chế giao, biên chế có mặt, thừa/thiếu so giao và so định mức
  const truongRows = useMemo<DongTH[]>(() => truongs.map((dv) => {
    const cap = dv.loai as CapHoc
    const qm = quyMos.find((q) => q.id === idQuyMo(dv.id, namHoc))
    const nhanSu = vienChucs.filter((v) => v.donViId === dv.id)
    const kq = qm ? tinhDinhMuc(cap, qm, nhanSu, cd.lay) : undefined
    const kqDem = kq ?? tinhDinhMuc(cap, quyMoTrong(dv.id, namHoc), nhanSu, cd.lay)
    const ct = (chiTieus ?? []).find((x) => x.id === idQuyMo(dv.id, namHoc))
    const daGiao = !!ct && Object.values(ct.nhom).some((o) => (o?.nganSach ?? 0) + (o?.suNghiep ?? 0) + (o?.hd235 ?? 0) > 0)
    const nhom = Object.fromEntries(NHOM_TH.map(({ key }) => {
      const t = kq?.tongNhom.find((x) => x.nhom === key)
      const dm = kq && kq.tongLop && t?.apDungDinhMuc ? t.dinhMuc : null
      const giao = daGiao ? (ct!.nhom[key]?.nganSach ?? 0) + (ct!.nhom[key]?.suNghiep ?? 0) : null
      const o = kqDem.coMatNguon[key]
      const cm = o.nganSach + o.suNghiep + o.bcChuaRoNguon
      return [key, { dm, giao, cm, soGiao: giao == null ? null : cm - giao, soDm: dm == null ? null : cm - dm }]
    })) as DongTH['nhom']
    return {
      key: dv.id, loai: 'truong' as const, ten: dv.ten, dv, cap, qm, kq,
      lop: kq ? kq.tongLop : null, hs: kq ? kq.tongHS : null, nhom,
      hd235Giao: daGiao ? Object.values(ct!.nhom).reduce((s, o) => s + (o?.hd235 ?? 0), 0) : null,
      hd235CoMat: Object.values(kqDem.coMatNguon).reduce((s, o) => s + o.hd235, 0),
    }
  }), [truongs, quyMos, vienChucs, namHoc, cd, chiTieus])

  // Toàn phường trên cùng, rồi từng cấp: dòng cộng cấp đứng trước các trường của cấp đó
  const rows = useMemo(() => {
    const cong = (key: string, loai: 'cap' | 'phuong', ten: string, ds: DongTH[]): DongTH => ({
      key, loai, ten, soTruong: ds.length,
      lop: ds.reduce<number | null>((s, r) => congN(s, r.lop), null),
      hs: ds.reduce<number | null>((s, r) => congN(s, r.hs), null),
      nhom: Object.fromEntries(NHOM_TH.map(({ key: k }) => [k, {
        dm: ds.reduce<number | null>((s, r) => congN(s, r.nhom[k].dm), null),
        giao: ds.reduce<number | null>((s, r) => congN(s, r.nhom[k].giao), null),
        cm: ds.reduce((s, r) => s + r.nhom[k].cm, 0),
        soGiao: ds.reduce<number | null>((s, r) => congN(s, r.nhom[k].soGiao), null),
        soDm: ds.reduce<number | null>((s, r) => congN(s, r.nhom[k].soDm), null),
      }])) as DongTH['nhom'],
      hd235Giao: ds.reduce<number | null>((s, r) => congN(s, r.hd235Giao), null),
      hd235CoMat: ds.reduce((s, r) => s + r.hd235CoMat, 0),
    })
    const ra: DongTH[] = [cong('phuong', 'phuong', 'TOÀN PHƯỜNG', truongRows)]
    for (const c of ['MAM_NON', 'TIEU_HOC', 'THCS'] as CapHoc[]) {
      const ds = truongRows.filter((r) => r.cap === c)
      if (ds.length) ra.push(cong(`cap-${c}`, 'cap', `Cấp ${TEN_CAP[c]}`, ds), ...ds)
    }
    return ra
  }, [truongRows])

  const daKhai = truongRows.filter((r) => r.kq).length
  const daGiao = truongRows.filter((r) => r.hd235Giao != null).length
  const sttMap = new Map(truongRows.map((r, i) => [r.key, i + 1]))

  const xuat = () => {
    const dau: (string | number | null)[][] = [
      ['ỦY BAN NHÂN DÂN PHƯỜNG GIA VIÊN'], [],
      ['TỔNG HỢP ĐỊNH MỨC, CHỈ TIÊU BIÊN CHẾ VÀ CƠ CẤU VỊ TRÍ VIỆC LÀM CÁC TRƯỜNG'],
      [`Năm học ${namHoc} - nhóm vị trí việc làm theo khung của Sở Nội vụ Hải Phòng; giao và có mặt tính biên chế (ngân sách + sự nghiệp)`], [],
    ]
    const r0 = dau.length
    const cot5 = ['Định mức', 'Giao', 'Có mặt', 'Thừa/thiếu so giao', 'Thừa/thiếu so định mức']
    const h1 = ['STT', 'Trường', 'Số lớp', 'Số học sinh', ...NHOM_TH.flatMap((n) => [n.ten, null, null, null, null]), 'Hợp đồng NĐ 235', null]
    const h2 = [null, null, null, null, ...NHOM_TH.flatMap(() => cot5), 'Giao', 'Có mặt']
    const soCot = h1.length
    const gop = [
      ...[0, 1, 2, 3].map((c) => ({ r1: r0, c1: c, r2: r0 + 1, c2: c })),
      ...NHOM_TH.map((_, i) => ({ r1: r0, c1: 4 + i * 5, r2: r0, c2: 8 + i * 5 })),
      { r1: r0, c1: soCot - 2, r2: r0, c2: soCot - 1 },
    ]
    const dong: (string | number | null)[][] = [...dau, h1, h2]
    const dam: number[] = [0]
    const nen: Record<number, string> = {}
    const mauChu: Record<string, string> = {}
    const so = (v: number | null) => (v == null ? '' : lamTron1(v))
    for (const r of rows) {
      const i = dong.length
      dong.push([
        r.loai === 'truong' ? sttMap.get(r.key) ?? '' : '', r.loai === 'truong' ? r.ten : `${r.ten} (${r.soTruong} trường)`, so(r.lop), so(r.hs),
        ...NHOM_TH.flatMap(({ key }) => { const o = r.nhom[key]; return [so(o.dm), so(o.giao), o.cm, so(o.soGiao), so(o.soDm)] }),
        so(r.hd235Giao), r.hd235CoMat,
      ])
      NHOM_TH.forEach(({ key }, j) => {
        const cap: [number, number | null][] = [[7 + j * 5, r.nhom[key].soGiao], [8 + j * 5, r.nhom[key].soDm]]
        for (const [c, v] of cap) if (v != null && lamTron1(v) !== 0) mauChu[`${i}:${c}`] = v > 0 ? 'FFCF1322' : 'FF1D4ED8'
      })
      if (r.loai !== 'truong') { dam.push(i); nen[i] = r.loai === 'phuong' ? 'FFC7D2FE' : 'FFE0E7FF' }
    }
    const cuoi = dong.length
    dong.push([], ['Ghi chú: Giao và có mặt tính biên chế (ngân sách + sự nghiệp). Thừa (+) ghi màu đỏ, thiếu (-) ghi màu xanh. Tổ trưởng, tổ phó thuộc định mức giáo viên; ngoài danh mục VTVL (bảo vệ, phục vụ, lao công) không tính.'])
    xuatExcelA4(`Tong-hop-dinh-muc-chi-tieu-${namHoc}`, [{
      ten: 'Tổng hợp', dong, gop, rongCot: [5, 28, 7, 9, ...NHOM_TH.flatMap(() => [8, 7, 7, 9, 9]), 8, 8],
      bang: [{ tu: r0, den: cuoi - 1, soDongTieuDe: 2, soCot }], tieuDe: [2], giua: [3], nghieng: [3, cuoi + 1],
      dam, nen, mauChu, cotGiua: Array.from({ length: soCot }, (_, c) => c).filter((c) => c !== 1),
      nenCot: Object.fromEntries(NHOM_TH.flatMap(({ key }, j) => [0, 1, 2, 3, 4].map((x) => [4 + j * 5 + x, MAU_NHOM_VTVL[key].argbNen]))),
      cotDauNhom: [4, 9, 14, 19],
      huong: 'ngang', motTrang: true, coChu: 10,
    }]).catch(() => undefined)
  }

  const so = (v: number | null, nguyen = false) => (v == null ? <Text type="secondary">-</Text> : nguyen ? v.toLocaleString('vi-VN') : fmt(v))
  const dam = (r: DongTH, x: React.ReactNode) => (r.loai === 'truong' ? x : <b>{x}</b>)
  const lech = (v: number | null) => (v == null ? <Text type="secondary">-</Text> : <ChenhLech v={v} />)

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={`Năm học ${namHoc}: đã khai quy mô ${daKhai}/${truongRows.length} trường, đã giao chỉ tiêu ${daGiao}/${truongRows.length} trường`}
        description="Ba nhóm vị trí việc làm theo khung của Sở Nội vụ Hải Phòng. Giao và Có mặt tính biên chế (ngân sách + sự nghiệp); thừa/thiếu so với chỉ tiêu giao và so với định mức (thừa đỏ, thiếu xanh). Bấm tên trường để xem chi tiết và giao chỉ tiêu."
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        {(laQuanTri || isVHXH || isLanhDao) && (
          <Button icon={<TableOutlined />} onClick={() => navigate('/bao-cao?tab=dinh-muc-cap')}>Báo cáo chi tiết theo cấp học</Button>
        )}
        <Button icon={<DownloadOutlined />} onClick={xuat}>Xuất Excel</Button>
      </div>
      <Table<DongTH>
        size="small"
        bordered
        pagination={false}
        dataSource={rows}
        rowKey="key"
        className="bang-ke-ro"
        scroll={{ x: 1344, y: 'calc(100vh - 300px)' }}
        rowClassName={(r) => (r.loai === 'phuong' ? 'th-phuong' : r.loai === 'cap' ? 'th-cap' : '')}
        columns={[
          { title: 'STT', key: 'stt', width: 40, align: 'center', fixed: 'left', render: (_, r) => sttMap.get(r.key) ?? '' },
          {
            title: 'Trường', key: 'ten', width: 170, fixed: 'left',
            render: (_, r) => r.loai === 'truong'
              ? <Button type="link" style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => onChon(r.dv!.id)}>{r.ten}</Button>
              : <b>{r.ten} <Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>({r.soTruong} trường)</Text></b>,
          },
          { title: 'Số lớp', key: 'lop', width: 50, align: 'center', render: (_, r) => dam(r, so(r.lop, true)) },
          { title: 'Học sinh', key: 'hs', width: 62, align: 'center', render: (_, r) => dam(r, so(r.hs, true)) },
          // Mỗi nhóm VTVL một màu nền, vạch đậm bên trái cột đầu của nhóm
          ...NHOM_TH.map(({ key, ten }) => {
            const mau = MAU_NHOM_VTVL[key]
            const o = (dau = false) => ({
              onHeaderCell: () => ({ className: dau ? 'ke-nhom-dau' : undefined, style: { background: mau.tieuDe } }),
              onCell: () => ({ className: dau ? 'ke-nhom-dau' : undefined, style: { background: mau.nen } }),
            })
            return {
              title: <span style={{ color: mau.vien }}>{ten}</span>,
              onHeaderCell: () => ({ className: 'ke-nhom-dau', style: { background: mau.tieuDe } }),
              children: [
                { title: 'Định mức', key: `${key}-dm`, width: 56, align: 'center' as const, ...o(true), render: (_: unknown, r: DongTH) => dam(r, so(r.nhom[key].dm)) },
                { title: 'Giao', key: `${key}-g`, width: 46, align: 'center' as const, ...o(), render: (_: unknown, r: DongTH) => dam(r, so(r.nhom[key].giao)) },
                { title: 'Có mặt', key: `${key}-cm`, width: 50, align: 'center' as const, ...o(), render: (_: unknown, r: DongTH) => dam(r, r.nhom[key].cm) },
                { title: 'Thừa/ thiếu so giao', key: `${key}-sg`, width: 58, align: 'center' as const, ...o(), render: (_: unknown, r: DongTH) => lech(r.nhom[key].soGiao) },
                { title: 'Thừa/ thiếu so định mức', key: `${key}-sd`, width: 62, align: 'center' as const, ...o(), render: (_: unknown, r: DongTH) => lech(r.nhom[key].soDm) },
              ],
            }
          }),
          {
            title: 'Hợp đồng NĐ 235',
            onHeaderCell: () => ({ className: 'ke-nhom-dau' }),
            children: [
              { title: 'Giao', key: 'hdg', width: 46, align: 'center', onHeaderCell: () => ({ className: 'ke-nhom-dau' }), onCell: () => ({ className: 'ke-nhom-dau' }), render: (_, r) => dam(r, so(r.hd235Giao)) },
              { title: 'Có mặt', key: 'hdc', width: 50, align: 'center', render: (_, r) => dam(r, r.hd235CoMat) },
            ],
          },
          {
            title: 'Khai báo', key: 'kb', width: 110,
            render: (_, r) => {
              if (r.loai !== 'truong') return null
              if (!r.qm) return <Tag color="default">Chưa khai báo</Tag>
              return (
                <Space orientation="vertical" size={0}>
                  <Text style={{ fontSize: 13 }}>{formatDatetime(r.qm.updatedAt)}</Text>
                  {r.cap === 'TIEU_HOC' && r.kq!.tongLop2Buoi === 0 && <Tag color="error" style={{ marginTop: 2 }}>Chưa nhập lớp 2 buổi</Tag>}
                  {r.kq!.chuaPhanMon > 0 && <Tag color="warning" style={{ marginTop: 2 }}>{r.kq!.chuaPhanMon} GV chưa phân môn</Tag>}
                  {r.kq!.phanBoKiem && !r.kq!.phanBoKiem.khop && (
                    <Tag variant="solid" style={{ ...kieuChenhLech(r.kq!.phanBoKiem.conLai <= 0), marginTop: 2 }}>
                      Kiêm nhiệm {r.kq!.phanBoKiem.conLai > 0 ? `thiếu ${fmt(r.kq!.phanBoKiem.conLai)}` : `vượt ${fmt(-r.kq!.phanBoKiem.conLai)}`}
                    </Tag>
                  )}
                  {r.hd235Giao == null && <Tag style={{ marginTop: 2 }}>Chưa giao chỉ tiêu</Tag>}
                </Space>
              )
            },
          },
        ]}
      />
      <style>{'.th-phuong td { background: #c7d2fe !important; } .th-cap td { background: #e0e7ff !important; }'}</style>
    </>
  )
}

// ───────────────────────────── Chi tiết một trường ─────────────────────────────

function ChiTietTruong({ donVi, namHoc, onBack }: { donVi: DonVi; namHoc: string; onBack?: () => void }) {
  const { message, modal } = App.useApp()
  const { currentUser, hasPermission, scopeDonViId } = useAuth()
  const cap = donVi.loai as CapHoc
  const id = idQuyMo(donVi.id, namHoc)
  const quyMoDaLuu = useDanhMucStore((s) => s.quyMoTruongs.find((q) => q.id === id))
  const luuQuyMo = useDanhMucStore((s) => s.luuQuyMo)
  const updateDonVi = useDanhMucStore((s) => s.updateDonVi)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const cd = useTenChucDanh()
  const nhanSu = useMemo(() => vienChucs.filter((v) => v.donViId === donVi.id), [vienChucs, donVi.id])

  const dungTruong = !scopeDonViId || scopeDonViId === donVi.id
  const coTheSua = hasPermission('quyMo', 'write') && dungTruong
  const coTheSuaMon = hasPermission('vienChuc', 'write') && dungTruong

  const tatCaLichSu = useDanhMucStore((s) => s.quyMoLichSu)
  const lichSu = useMemo(
    () => (tatCaLichSu ?? []).filter((l) => l.quyMoId === id).sort((a, b) => b.thoiGian.localeCompare(a.thoiGian)),
    [tatCaLichSu, id],
  )
  const [moLichSu, setMoLichSu] = useState(false)
  const [goc, setGoc] = useState(quyMoDaLuu)
  const [nhap, setNhap] = useState<QuyMoTruong>(() => quyMoDaLuu ?? quyMoTrong(donVi.id, namHoc))
  const daDoi = vanTay(nhap, cap) !== vanTay(quyMoDaLuu, cap)

  // Bản mới từ máy khác: chưa sửa gì thì nạp luôn bản mới
  useEffect(() => {
    if (quyMoDaLuu?.updatedAt === goc?.updatedAt) return
    if (vanTay(nhap, cap) === vanTay(goc, cap)) setNhap(quyMoDaLuu ?? quyMoTrong(donVi.id, namHoc))
    setGoc(quyMoDaLuu)
  }, [quyMoDaLuu])

  const kq = useMemo(() => tinhDinhMuc(cap, nhap, nhanSu, cd.lay), [cap, nhap, nhanSu, cd])
  const hienHanh = namHoc === namHocHienHanh()

  const datKhoi = (ma: string, truong: TruongKhoi, v: number | null) =>
    setNhap((q) => {
      const moi = { ...(q.khoi[ma] ?? { soLop: 0, soHocSinh: 0 }), [truong]: v ?? 0 }
      // Số học 2 buổi không vượt tổng của khối
      if (moi.soLop2Buoi != null && moi.soLop2Buoi > moi.soLop) moi.soLop2Buoi = moi.soLop
      if (moi.soHocSinh2Buoi != null && moi.soHocSinh2Buoi > moi.soHocSinh) moi.soHocSinh2Buoi = moi.soHocSinh
      return { ...q, khoi: { ...q.khoi, [ma]: moi } }
    })

  const datNhapTay = (ma: string, v: number | null) =>
    setNhap((q) => {
      const t = { ...(q.dinhMucNhapTay ?? {}) }
      if (v == null) delete t[ma]
      else t[ma] = v
      return { ...q, dinhMucNhapTay: t }
    })

  // THCS: trường điều chỉnh số giáo viên kiêm nhiệm phân bổ cho một môn; bỏ trống = theo gợi ý
  const datKiem = (ma: string | null, v: number | null) =>
    setNhap((q) => {
      if (ma == null) {
        // Dùng lại toàn bộ gợi ý: bỏ mọi điều chỉnh theo môn
        const t = { ...(q.dinhMucNhapTay ?? {}) }
        for (const m of MON_GIANG_DAY.THCS) if (m.ma !== 'TONG_PHU_TRACH') delete t[m.ma]
        return { ...q, kiemNhiemNhapTay: {}, dinhMucNhapTay: t }
      }
      const k = { ...(q.kiemNhiemNhapTay ?? {}) }
      if (v == null) delete k[ma]
      else k[ma] = v
      // Bản cũ nhập thẳng định mức môn → bỏ để không chồng hai kiểu điều chỉnh
      const t = { ...(q.dinhMucNhapTay ?? {}) }
      delete t[ma]
      return { ...q, kiemNhiemNhapTay: k, dinhMucNhapTay: t }
    })

  /** Nạp một bản trong lịch sử vào form; chỉ có hiệu lực khi người dùng bấm "Lưu quy mô" */
  const nap = (nd: NoiDungQuyMo) => {
    setNhap((q) => ({ ...q, ...layNoiDung(nd), khoiDayTinThem: nd.khoiDayTinThem, dinhMucNhapTay: nd.dinhMucNhapTay, kiemNhiemNhapTay: nd.kiemNhiemNhapTay, soDiemTruong: nd.soDiemTruong, ghiChu: nd.ghiChu }))
    setMoLichSu(false)
    message.info('Đã nạp bản này vào form. Kiểm tra lại rồi bấm "Lưu quy mô" để áp dụng.')
  }

  const luu = () => {
    if (!currentUser) return
    const { tongLop, tongHS } = tongQuyMo(nhap, cap)
    const hangMoi = getHangTruong(cap, tongLop)
    const hangCu = donVi.soLop ? getHangTruong(cap, donVi.soLop) : undefined
    const capNhatSoLop = hienHanh && tongLop > 0 && tongLop !== donVi.soLop

    const thucHien = async () => {
      const khoi: QuyMoTruong['khoi'] = {}
      for (const k of KHOI[cap]) {
        const o = nhap.khoi[k.ma]
        khoi[k.ma] = {
          soLop: o?.soLop ?? 0,
          soHocSinh: o?.soHocSinh ?? 0,
          ...(CO_HAI_BUOI[cap] ? {
            soLop2Buoi: Math.min(o?.soLop2Buoi ?? 0, o?.soLop ?? 0),
            soHocSinh2Buoi: Math.min(o?.soHocSinh2Buoi ?? 0, o?.soHocSinh ?? 0),
          } : {}),
        }
      }
      const nhapTay = nhap.dinhMucNhapTay && Object.keys(nhap.dinhMucNhapTay).length ? nhap.dinhMucNhapTay : undefined
      const kiemTay = cap === 'THCS' && nhap.kiemNhiemNhapTay && Object.keys(nhap.kiemNhiemNhapTay).length ? nhap.kiemNhiemNhapTay : undefined
      const tinThem = cap === 'TIEU_HOC' ? (nhap.khoiDayTinThem ?? []).filter((k) => KHOI_TIN_TU_CHON.includes(k)) : []
      luuQuyMo({
        id, donViId: donVi.id, namHoc, khoi,
        khoiDayTinThem: tinThem.length ? tinThem : undefined,
        dinhMucNhapTay: nhapTay,
        kiemNhiemNhapTay: kiemTay,
        soDiemTruong: cap === 'MAM_NON' ? nhap.soDiemTruong || undefined : undefined,
        ghiChu: nhap.ghiChu?.trim() || undefined,
        nguoiCapNhatId: currentUser.id,
        nguoiCapNhat: currentUser.fullName,
      })
      if (capNhatSoLop) updateDonVi(donVi.id, { soLop: tongLop })
      logAction(currentUser.id, currentUser.fullName, 'UPDATE', 'DanhMuc', {
        entityId: id,
        donViId: donVi.id,
        moTa: `Khai báo quy mô năm học ${namHoc} - ${donVi.ten}: ${tongLop} lớp, ${tongHS} học sinh`
          + (capNhatSoLop ? `; số lớp xếp hạng ${donVi.soLop ?? 'chưa có'} → ${tongLop}` : ''),
      })
      // Chỉ báo "đã lưu" khi dữ liệu thực sự đã lên máy chủ; lỗi mạng thì nói rõ để người dùng không tắt máy
      const kq = await choGhiXongVaKiemTra()
      if (kq === 'loi') {
        message.warning({
          content: 'Đã lưu trên máy này nhưng CHƯA lên được máy chủ. Hệ thống đang tự thử lại - hãy kiểm tra mạng và không đóng trang.',
          duration: 10,
        })
      } else {
        message.success(capNhatSoLop ? 'Đã lưu quy mô lên máy chủ và cập nhật số lớp xếp hạng trường' : 'Đã lưu quy mô lên máy chủ')
      }
    }

    if (capNhatSoLop && hangCu && hangCu !== hangMoi) {
      modal.confirm({
        title: `Hạng trường đổi từ ${HANG_TRUONG_LABELS[hangCu]} sang ${HANG_TRUONG_LABELS[hangMoi]}`,
        content: (
          <div>
            <p>Số lớp xếp hạng của {donVi.ten} đổi từ {donVi.soLop} thành {tongLop}.</p>
            <p style={{ marginBottom: 0 }}>
              Hạng trường là căn cứ phụ cấp chức vụ (TT 33/2005/TT-BGDĐT) và số phó hiệu trưởng.
              Phụ cấp đang hưởng <b>không tự thay đổi</b>; khi chỉnh sửa hồ sơ hiệu trưởng, phó hiệu trưởng,
              hệ thống sẽ đề xuất mức theo hạng mới.
            </p>
          </div>
        ),
        okText: 'Lưu',
        cancelText: 'Hủy',
        onOk: thucHien,
      })
    } else thucHien()
  }

  const items = [
    { key: 'quyMo', label: 'Khai báo quy mô', children: <TheQuyMo cap={cap} nhap={nhap} kq={kq} coTheSua={coTheSua} hienHanh={hienHanh} namHoc={namHoc} donVi={donVi} datKhoi={datKhoi} setNhap={setNhap} /> },
    {
      key: 'dinhMuc', label: 'Định mức, chỉ tiêu & cơ cấu VTVL',
      children: <><ChiTieuBienCheCard donVi={donVi} namHoc={namHoc} kq={kq} /><TheDinhMuc kq={kq} nhap={nhap} coTheSua={coTheSua} datNhapTay={datNhapTay} datKiem={datKiem} daDoi={daDoi} /></>,
    },
    {
      key: 'phanMon',
      label: (
        <Badge count={cap === 'MAM_NON' ? demChuaPhanCongMN(nhanSu, cd.lay) : kq.chuaPhanMon} size="small" offset={[8, -2]}>
          {cap === 'MAM_NON' ? 'Phân công nhóm, lớp' : 'Phân công môn giảng dạy'}
        </Badge>
      ),
      children: <ThePhanMon cap={cap} nhanSu={nhanSu} kq={kq} coTheSua={coTheSuaMon} donVi={donVi} nhap={nhap} />,
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Space wrap>
          {onBack && <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Toàn phường</Button>}
          <Text strong style={{ fontSize: 16 }}>{donVi.ten}</Text>
          <Tag>{TEN_CAP[cap]}</Tag>
          {quyMoDaLuu
            ? <Text type="secondary" style={{ fontSize: 13 }}>Cập nhật {formatDatetime(quyMoDaLuu.updatedAt)} - {quyMoDaLuu.nguoiCapNhat}</Text>
            : <Tag color="warning">Chưa khai báo năm học {namHoc}</Tag>}
        </Space>
        <Space wrap>
          <Badge count={lichSu.length} size="small" color="#64748b" offset={[-4, 2]}>
            <Button icon={<HistoryOutlined />} onClick={() => setMoLichSu(true)}>Lịch sử khai báo</Button>
          </Badge>
          <Button icon={<DownloadOutlined />} onClick={() => xuatExcelTruong(donVi, namHoc, cap, nhap, kq)} disabled={!kq.tongLop}>
            Xuất Excel
          </Button>
          {coTheSua && (
            <>
              {daDoi && <Button icon={<UndoOutlined />} onClick={() => setNhap(quyMoDaLuu ?? quyMoTrong(donVi.id, namHoc))}>Hoàn tác</Button>}
              <Button type="primary" icon={<SaveOutlined />} onClick={luu} disabled={!daDoi || !kq.tongLop}>
                Lưu quy mô
              </Button>
            </>
          )}
        </Space>
      </div>
      {daDoi && <Alert type="warning" showIcon style={{ marginBottom: 8 }} title="Có thay đổi chưa lưu - số liệu định mức đang tính theo bản đang nhập" />}
      <Tabs items={items} />
      <LichSuQuyMoDrawer open={moLichSu} onClose={() => setMoLichSu(false)} lichSu={lichSu} cap={cap} coTheSua={coTheSua} onNap={nap} />
    </>
  )
}

// ───────────────────────────── Lịch sử khai báo quy mô ─────────────────────────────

function LichSuQuyMoDrawer({ open, onClose, lichSu, cap, coTheSua, onNap }: {
  open: boolean; onClose: () => void; lichSu: QuyMoLichSu[]; cap: CapHoc; coTheSua: boolean; onNap: (nd: NoiDungQuyMo) => void
}) {
  // lichSu đã sắp mới nhất trước; bản liền trước của dòng i là dòng i + 1
  return (
    <Drawer title="Lịch sử khai báo quy mô" size={760} open={open} onClose={onClose}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Mỗi lần bấm Lưu quy mô để lại một bản (tối đa 30 bản gần nhất)."
        description='Bản nào khai nhầm hoặc bị mất số liệu, bấm "Nạp vào form" để lấy lại rồi kiểm tra và Lưu quy mô.'
      />
      {lichSu.length === 0 ? (
        <Empty description="Chưa có lịch sử. Bản đầu tiên sẽ xuất hiện sau lần lưu tiếp theo." />
      ) : (
        <Table<QuyMoLichSu>
          size="small"
          bordered
          rowKey="id"
          pagination={false}
          dataSource={lichSu}
          columns={[
            {
              title: 'Thời điểm', key: 'tg', width: 140,
              render: (_, l, i) => (
                <Space orientation="vertical" size={0}>
                  <Text>{formatDatetime(l.thoiGian)}</Text>
                  {i === 0 && <Tag color="blue" style={{ marginTop: 2 }}>Bản hiện tại</Tag>}
                  {l.ghiChuBan && <Text type="secondary" style={{ fontSize: 12 }}>{l.ghiChuBan}</Text>}
                </Space>
              ),
            },
            { title: 'Người lưu', key: 'ng', width: 140, render: (_, l) => l.nguoiTen ?? '-' },
            {
              title: 'Nội dung', key: 'nd',
              render: (_, l, i) => {
                const doi = soSanhNoiDung(lichSu[i + 1]?.noiDung, l.noiDung, cap)
                return (
                  <Space orientation="vertical" size={2}>
                    <Text strong>{tomTatNoiDung(l.noiDung, cap)}</Text>
                    {doi.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: '#64748b' }}>
                        {doi.slice(0, 8).map((d) => <li key={d}>{d}</li>)}
                        {doi.length > 8 && <li>và {doi.length - 8} thay đổi khác</li>}
                      </ul>
                    )}
                  </Space>
                )
              },
            },
            {
              title: '', key: 'ac', width: 120, align: 'center',
              render: (_, l, i) => coTheSua && i > 0
                ? <Button size="small" onClick={() => onNap(l.noiDung)}>Nạp vào form</Button>
                : null,
            },
          ]}
        />
      )}
    </Drawer>
  )
}

// ───────────────────────────── Thẻ: Khai báo quy mô ─────────────────────────────

function TheQuyMo({ cap, nhap, kq, coTheSua, hienHanh, namHoc, donVi, datKhoi, setNhap }: {
  cap: CapHoc; nhap: QuyMoTruong; kq: KetQuaDinhMuc; coTheSua: boolean; hienHanh: boolean; namHoc: string; donVi: DonVi
  datKhoi: (ma: string, truong: TruongKhoi, v: number | null) => void
  setNhap: Dispatch<SetStateAction<QuyMoTruong>>
}) {
  const haiBuoi = CO_HAI_BUOI[cap]
  type DongKhoi = { key: string; ten: string; soLop: number; soHocSinh: number; soLop2Buoi: number; soHocSinh2Buoi: number }
  const dongs: DongKhoi[] = KHOI[cap].map((k) => {
    const x = nhap.khoi[k.ma]
    return { key: k.ma, ten: k.ten, soLop: x?.soLop ?? 0, soHocSinh: x?.soHocSinh ?? 0, soLop2Buoi: x?.soLop2Buoi ?? 0, soHocSinh2Buoi: x?.soHocSinh2Buoi ?? 0 }
  })
  const o = (r: DongKhoi, truong: TruongKhoi) => {
    const v = r[truong]
    // Số học 2 buổi không vượt tổng của khối
    const max = truong === 'soLop2Buoi' ? r.soLop : truong === 'soHocSinh2Buoi' ? r.soHocSinh : truong === 'soLop' ? 99 : 9999
    return coTheSua
      ? <InputNumber value={v} min={0} max={max} precision={0} onChange={(x) => datKhoi(r.key, truong, x)} style={{ width: 88 }} />
      : <Text>{v.toLocaleString('vi-VN')}</Text>
  }
  const cot = (title: string, key: TruongKhoi) => ({
    title, key, width: 104, align: 'center' as const, render: (_: unknown, r: DongKhoi) => o(r, key),
  })

  return (
    <Row gutter={[24, 16]}>
      <Col xs={24} xl={haiBuoi ? 16 : 14}>
        <Table
          size="small"
          bordered
          pagination={false}
          dataSource={dongs}
          scroll={{ x: haiBuoi ? 620 : undefined }}
          columns={[
            { title: cap === 'MAM_NON' ? 'Nhóm, lớp' : 'Khối', dataIndex: 'ten', key: 'ten', width: 90 },
            ...(haiBuoi
              ? [
                  { title: 'Tổng số', children: [cot('Số lớp', 'soLop'), cot('Số học sinh', 'soHocSinh')] },
                  { title: 'Trong đó học 2 buổi/ngày', children: [cot('Số lớp', 'soLop2Buoi'), cot('Số học sinh', 'soHocSinh2Buoi')] },
                ]
              : [cot('Số nhóm, lớp', 'soLop'), cot('Số trẻ', 'soHocSinh')]),
            { title: 'Bình quân/lớp', key: 'bq', width: 90, align: 'center' as const, render: (_: unknown, r: DongKhoi) => r.soLop ? fmt(r.soHocSinh / r.soLop) : '-' },
          ]}
          summary={() => (
            <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
              <Table.Summary.Cell index={0}>Tổng</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="center">{kq.tongLop}</Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="center">{kq.tongHS.toLocaleString('vi-VN')}</Table.Summary.Cell>
              {haiBuoi && <Table.Summary.Cell index={3} align="center">{kq.tongLop2Buoi}</Table.Summary.Cell>}
              {haiBuoi && <Table.Summary.Cell index={4} align="center">{kq.tongHS2Buoi.toLocaleString('vi-VN')}</Table.Summary.Cell>}
              <Table.Summary.Cell index={haiBuoi ? 5 : 3} align="center">{kq.tongLop ? fmt(kq.binhQuan) : '-'}</Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
        {haiBuoi && kq.tongLop > 0 && (
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Học 1 buổi/ngày: {kq.tongLop - kq.tongLop2Buoi} lớp, {(kq.tongHS - kq.tongHS2Buoi).toLocaleString('vi-VN')} học sinh.
            {cap === 'TIEU_HOC' && ' Định mức giáo viên: lớp 1 buổi 1,2 GV/lớp, lớp 2 buổi 1,5 GV/lớp.'}
          </Text>
        )}
        {cap === 'TIEU_HOC' && kq.tongLop > 0 && kq.tongLop2Buoi === 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 8 }}
            title="Chưa nhập số lớp học 2 buổi/ngày - định mức đang tính toàn bộ là lớp 1 buổi (1,2 giáo viên/lớp)"
          />
        )}
        {cap === 'MAM_NON' && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text>Số phân hiệu (điểm trường):</Text>
            {coTheSua
              ? <InputNumber value={nhap.soDiemTruong} min={1} max={20} precision={0} placeholder="1" onChange={(v) => setNhap((q) => ({ ...q, soDiemTruong: v ?? undefined }))} style={{ width: 88 }} />
              : <Text strong>{nhap.soDiemTruong ?? 1}</Text>}
            <Text type="secondary" style={{ fontSize: 13 }}>
              Căn cứ chỉ tiêu nhân viên thư viện: 01 người/phân hiệu, tối đa 03. Để trống tính là 01.
            </Text>
          </div>
        )}
        {cap === 'TIEU_HOC' && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text>Trường có dạy Tin học ở:</Text>
            <Checkbox.Group
              disabled={!coTheSua}
              value={nhap.khoiDayTinThem ?? []}
              onChange={(v) => setNhap((q) => ({ ...q, khoiDayTinThem: v as string[] }))}
              options={KHOI_TIN_TU_CHON.map((k) => ({ value: k, label: `Khối ${k.slice(1)}` }))}
            />
            <Text type="secondary" style={{ fontSize: 13 }}>
              Khối 3-5 bắt buộc theo chương trình GDPT 2018; khối 1, 2 tính thêm 1 tiết/tuần nếu trường có dạy.
            </Text>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <Text strong>Ghi chú, căn cứ số liệu</Text>
          {coTheSua
            ? <Input.TextArea rows={2} value={nhap.ghiChu} onChange={(e) => setNhap((q) => ({ ...q, ghiChu: e.target.value }))} placeholder="VD: Theo kế hoạch tuyển sinh năm học 2026-2027 đã được phê duyệt" style={{ marginTop: 6 }} />
            : <div style={{ marginTop: 4 }}><Text type="secondary">{nhap.ghiChu || '-'}</Text></div>}
        </div>
      </Col>
      <Col xs={24} xl={haiBuoi ? 8 : 10}>
        <Row gutter={[12, 12]}>
          <Col span={12}><Card size="small"><Statistic title="Tổng số lớp" value={kq.tongLop} /></Card></Col>
          <Col span={12}><Card size="small"><Statistic title={cap === 'MAM_NON' ? 'Tổng số trẻ' : 'Tổng học sinh'} value={kq.tongHS} groupSeparator="." /></Card></Col>
          <Col span={12}><Card size="small"><Statistic title="Bình quân/lớp" value={kq.tongLop ? lamTron1(kq.binhQuan) : 0} precision={1} decimalSeparator="," /></Card></Col>
          <Col span={12}><Card size="small"><Statistic title="Hạng trường" value={kq.tongLop ? HANG_TRUONG_LABELS[kq.hang] : '-'} /></Card></Col>
        </Row>
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          title="Căn cứ xếp hạng trường"
          description={
            <div style={{ fontSize: 14 }}>
              <div>{NGUONG_HANG[cap]} (TT 19/2023, TT 20/2023). Hạng trường quyết định số phó hiệu trưởng và phụ cấp chức vụ (TT 33/2005).</div>
              <div style={{ marginTop: 6 }}>
                {hienHanh
                  ? <>Đây là năm học hiện hành: khi lưu, tổng số lớp sẽ thành số lớp xếp hạng của trường (hiện ghi {donVi.soLop ?? 'chưa có'} lớp - {donVi.soLop ? HANG_TRUONG_LABELS[getHangTruong(cap, donVi.soLop)] : 'chưa xếp hạng'}).</>
                  : <>Năm học {namHoc} chỉ dùng để tính định mức, không thay đổi hạng trường hiện tại.</>}
              </div>
            </div>
          }
        />
      </Col>
    </Row>
  )
}

// ───────────────────────────── Thẻ: Định mức & cơ cấu ─────────────────────────────

type DongBang =
  | (DongDinhMuc & { key: string; loai: 'dong'; stt: number })
  | { key: string; loai: 'nhom'; ten: string; tong?: TongNhom; nhomKey: string }

const SO_LA_MA = ['I', 'II', 'III', 'IV']

function TheDinhMuc({ kq, nhap, coTheSua, datNhapTay, datKiem, daDoi }: {
  kq: KetQuaDinhMuc; nhap: QuyMoTruong; coTheSua: boolean; datNhapTay: (ma: string, v: number | null) => void
  datKiem: (ma: string | null, v: number | null) => void; daDoi: boolean
}) {
  if (!kq.tongLop) {
    return <Empty description={`Chưa có số lớp - khai báo quy mô ở thẻ "Khai báo quy mô" để tính định mức`} />
  }

  const data: DongBang[] = []
  for (const n of NHOM_DINH_MUC) {
    const ds = kq.dong.filter((d) => d.nhom === n.key)
    if (!ds.length) continue
    // Số cộng của nhóm nằm ngay trên dòng tiêu đề nhóm, không có dòng tổng riêng
    data.push({ key: `nhom-${n.key}`, loai: 'nhom', ten: n.ten, tong: kq.tongNhom.find((x) => x.nhom === n.key), nhomKey: n.key })
    ds.forEach((d, i) => data.push({ ...d, key: d.ma, loai: 'dong', stt: i + 1 }))
  }

  const laDong = (r: DongBang): r is Extract<DongBang, { loai: 'dong' }> => r.loai === 'dong'
  const tongCua = (r: DongBang) => (r.loai === 'nhom' ? r.tong : undefined)
  /** Ô số cộng nằm trên dòng tiêu đề nhóm */
  const so = (n: React.ReactNode) => <Text strong>{n}</Text>
  const soNhom = (nhom: string) => SO_LA_MA[NHOM_DINH_MUC.findIndex((n) => n.key === nhom)] ?? ''
  const tt = kq.toanTruong
  const nhomIV = kq.tongNhom.find((t) => !t.apDungDinhMuc)
  const ngoai = kq.tongNhom.reduce((s, t) => s + t.coMatNgoai, 0)

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title={`Định mức giáo viên: ${fmt(kq.gvDinhMuc)} - có mặt ${kq.gvCoMat}`}
        description={<ul style={{ margin: 0, paddingLeft: 18 }}>{kq.dienGiai.map((s) => <li key={s}>{s}</li>)}</ul>}
      />
      {kq.cap === 'TIEU_HOC' && kq.tongLop2Buoi === 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title="Chưa nhập số lớp học 2 buổi/ngày - định mức giáo viên đang tính toàn bộ là lớp 1 buổi (1,2 GV/lớp), thấp hơn thực tế"
          description='Nhập cột "Trong đó học 2 buổi/ngày" ở thẻ "Khai báo quy mô" (lớp 2 buổi tính 1,5 GV/lớp).'
        />
      )}
      {kq.chuaPhanMon > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={`${kq.chuaPhanMon} giáo viên chưa phân công môn - chưa đối chiếu được định mức theo từng môn`} description='Vào thẻ "Phân công môn giảng dạy" để gán môn (có nút gợi ý tự động theo nhiệm vụ chính).' />
      )}
      {kq.phanBoKiem && <BangPhanBoKiem kq={kq} coTheSua={coTheSua} datKiem={datKiem} />}
      <Table<DongBang>
        size="small"
        bordered
        pagination={false}
        dataSource={data}
        className="bang-ke-ro"
        scroll={{ x: 1100, y: 'calc(100vh - 260px)' }}
        rowClassName={(r) => (r.loai === 'nhom' ? `vt-n-${r.nhomKey} vt-tieu-de vt-nhom-dau` : `vt-n-${r.nhom}`)}
        columns={[
          {
            title: 'STT', key: 'stt', width: 50, align: 'center',
            // Dòng tiêu đề nhóm gộp 3 cột đầu (STT, Vị trí, Căn cứ) để ghi tên nhóm; các cột số bên phải ghi số cộng
            onCell: (r) => (r.loai === 'nhom' ? { colSpan: 3, style: { textAlign: 'left' } } : {}),
            render: (_, r) => {
              if (r.loai !== 'nhom') return r.stt
              const t = r.tong
              return (
                <Space size={8} wrap>
                  <Text strong style={{ color: '#1e3a8a' }}>{r.ten}</Text>
                  {t && !t.apDungDinhMuc && <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>(chỉ đếm số có mặt, không so với định mức)</Text>}
                  {t && t.coMatNgoai > 0 && <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>({t.coMatNgoai} người ở vị trí chưa có định mức, không đưa vào so sánh)</Text>}
                </Space>
              )
            },
          },
          {
            title: 'Vị trí việc làm', key: 'ten', width: 250, onCell: (r) => (r.loai === 'nhom' ? { colSpan: 0 } : {}),
            render: (_, r) => laDong(r) && (r.dongPhu ? <Text type="warning">{r.ten}</Text> : r.ten),
          },
          {
            title: 'Căn cứ tính', key: 'cc', width: 260, onCell: (r) => (r.loai === 'nhom' ? { colSpan: 0 } : {}),
            render: (_, r) => laDong(r) && <Text type="secondary" style={{ fontSize: 13 }}>{r.canCu}</Text>,
          },
          {
            title: 'Định mức theo quy định', key: 'dmt', width: 95, align: 'center',
            render: (_, r) => {
              const t = tongCua(r)
              if (t) return t.apDungDinhMuc ? so(fmt(t.dinhMucTinh)) : null
              return laDong(r) && (r.khongDinhMuc || r.trongGv ? <Text type="secondary" style={{ fontSize: 13 }}>{r.trongGv ? 'Thuộc định mức GV' : 'Không áp dụng'}</Text> : fmt(r.dinhMucTinh))
            },
          },
          {
            title: <Tooltip title="Trường nhập khi có căn cứ riêng (VD điểm trường lẻ, học sinh khuyết tật). Để trống thì dùng định mức theo quy định.">Điều chỉnh</Tooltip>,
            key: 'tay', width: 100, align: 'center',
            render: (_, r) => {
              if (!laDong(r) || r.khongDinhMuc || r.trongGv || r.dongPhu) return null
              if (r.phanBoKiem) {
                const k = kq.phanBoKiem?.dong.find((d) => d.ma === r.ma)
                return (
                  <Tooltip title='Môn THCS điều chỉnh ở bảng "Phân bổ giáo viên kiêm nhiệm" phía trên'>
                    <Text type="secondary" style={{ fontSize: 13 }}>{k?.nhapTay != null ? `KN ${fmt(k.nhapTay)}` : 'Theo phân bổ'}</Text>
                  </Tooltip>
                )
              }
              if (!coTheSua) return r.dinhMucNhapTay != null ? fmt(r.dinhMucNhapTay) : ''
              return (
                <InputNumber
                  size="small"
                  value={nhap.dinhMucNhapTay?.[r.ma]}
                  min={0}
                  max={r.toiDa ?? 200}
                  step={1}
                  precision={1}
                  placeholder="-"
                  onChange={(v) => datNhapTay(r.ma, v)}
                  style={{ width: 80 }}
                />
              )
            },
          },
          {
            title: 'Định mức áp dụng', key: 'dm', width: 90, align: 'center',
            render: (_, r) => tongCua(r) ? (tongCua(r)!.apDungDinhMuc ? so(fmt(tongCua(r)!.dinhMuc)) : null) : laDong(r) && !r.khongDinhMuc && !r.trongGv && (
              <Text strong>{fmt(r.dinhMuc)}{(r.dinhMucNhapTay != null || (r.phanBoKiem && kq.phanBoKiem?.dong.find((d) => d.ma === r.ma)?.nhapTay != null)) && <Tag color="purple" style={{ marginInlineStart: 4, fontSize: 11, lineHeight: '14px', padding: '0 3px' }}>tay</Tag>}</Text>
            ),
          },
          {
            title: 'Có mặt',
            children: [
              { title: 'Viên chức', key: 'vc', width: 75, align: 'center', render: (_, r) => (tongCua(r) ? so(tongCua(r)!.coMatVC) : laDong(r) && (r.coMatVC || '')) },
              { title: 'Hợp đồng', key: 'hd', width: 75, align: 'center', render: (_, r) => (tongCua(r) ? so(tongCua(r)!.coMatHD) : laDong(r) && (r.coMatHD || '')) },
              { title: 'Tổng', key: 'cm', width: 65, align: 'center', render: (_, r) => (tongCua(r) ? so(tongCua(r)!.coMat) : laDong(r) && <Text strong>{r.coMat}</Text>) },
            ],
          },
          {
            title: 'Thừa (+) / Thiếu (-)', key: 'cl', width: 95, align: 'center',
            render: (_, r) => {
              const t = tongCua(r)
              if (t) return t.apDungDinhMuc ? <ChenhLech v={t.chenhLech} /> : null
              return laDong(r) && (r.khongDinhMuc || r.trongGv ? null : <ChenhLech v={r.chenhLech} />)
            },
          },
        ]}
        summary={() => (
          <>
            <Table.Summary.Row style={{ background: '#e0e7ff', fontWeight: 600 }}>
              <Table.Summary.Cell index={0} colSpan={2}>Tổng toàn trường - nhóm I-III (so với định mức)</Table.Summary.Cell>
              <Table.Summary.Cell index={2}>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                  {kq.tongNhom.filter((t) => t.apDungDinhMuc).map((t) => `Nhóm ${soNhom(t.nhom)}: ${fmt(t.dinhMuc)}`).join(' + ')}
                  {ngoai > 0 && `; ${ngoai} người ở vị trí chưa có định mức không đưa vào so sánh`}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="center">{fmt(kq.tongNhom.filter((t) => t.apDungDinhMuc).reduce((s, t) => s + t.dinhMucTinh, 0))}</Table.Summary.Cell>
              <Table.Summary.Cell index={4} />
              <Table.Summary.Cell index={5} align="center">{fmt(kq.tongDinhMuc)}</Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="center">{kq.tongNhom.filter((t) => t.apDungDinhMuc).reduce((s, t) => s + t.coMatVC, 0)}</Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="center">{kq.tongNhom.filter((t) => t.apDungDinhMuc).reduce((s, t) => s + t.coMatHD, 0)}</Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="center">{kq.tongNhom.filter((t) => t.apDungDinhMuc).reduce((s, t) => s + t.coMat, 0)}</Table.Summary.Cell>
              <Table.Summary.Cell index={9} align="center"><ChenhLech v={kq.coMatCoDinhMuc - kq.tongDinhMuc} /></Table.Summary.Cell>
            </Table.Summary.Row>
            <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
              <Table.Summary.Cell index={0} colSpan={2}>Tổng lao động toàn trường (cả ngoài danh mục)</Table.Summary.Cell>
              <Table.Summary.Cell index={2}>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                  {nhomIV ? `Gồm ${nhomIV.coMat} người ngoài danh mục VTVL (không tính định mức)` : ''}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} colSpan={3} />
              <Table.Summary.Cell index={6} align="center">{tt.coMatVC}</Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="center">{tt.coMatHD}</Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="center">{tt.coMat}</Table.Summary.Cell>
              <Table.Summary.Cell index={9} />
            </Table.Summary.Row>
          </>
        )}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
        Có mặt đếm theo hồ sơ đang công tác tại trường: cán bộ quản lý theo chức vụ, giáo viên theo môn được phân công,
        nhân viên theo "Công việc cụ thể". Viên chức gồm biên chế và tập sự; còn lại tính là hợp đồng.
        {daDoi && ' Số liệu đang tính theo bản chưa lưu.'}
      </Text>
    </>
  )
}

// ───────────────────────────── THCS: phân bổ giáo viên kiêm nhiệm ─────────────────────────────

function TrangThaiPhanBo({ conLai }: { conLai: number }) {
  if (Math.abs(conLai) < 0.05) return <Tag color="success" style={{ marginInlineEnd: 0 }}>Khớp tổng</Tag>
  return conLai > 0
    ? <Tag variant="solid" style={{ ...kieuChenhLech(false), marginInlineEnd: 0 }}>Còn thiếu {fmt(conLai)}</Tag>
    : <Tag variant="solid" style={{ ...kieuChenhLech(true), marginInlineEnd: 0 }}>Vượt {fmt(-conLai)}</Tag>
}

function BangPhanBoKiem({ kq, coTheSua, datKiem }: {
  kq: KetQuaDinhMuc; coTheSua: boolean; datKiem: (ma: string | null, v: number | null) => void
}) {
  const pb = kq.phanBoKiem!
  const coMat = (ma: string) => kq.dong.find((d) => d.ma === ma)?.coMat ?? 0
  const tongDungLop = pb.dong.reduce((s, d) => s + d.dungLop, 0)
  const tongMon = pb.dong.reduce((s, d) => s + d.dinhMuc, 0)
  const tongCoMat = pb.dong.reduce((s, d) => s + coMat(d.ma), 0)
  const tatCaDaChinh = pb.soMonDieuChinh === pb.dong.length

  return (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      title={<Space wrap><span>Phân bổ giáo viên kiêm nhiệm theo môn</span><TrangThaiPhanBo conLai={pb.conLai} /></Space>}
      extra={coTheSua && pb.soMonDieuChinh > 0 && (
        <Button size="small" icon={<UndoOutlined />} onClick={() => datKiem(null, null)}>Dùng toàn bộ gợi ý</Button>
      )}
    >
      <Row gutter={[16, 8]} style={{ marginBottom: 8 }}>
        <Col xs={12} md={5}><Statistic title="Cần phân bổ" value={fmt(pb.tong)} styles={{ content: { fontSize: 20 } }} /></Col>
        <Col xs={12} md={5}><Statistic title="Đã phân bổ" value={fmt(pb.daPhanBo)} styles={{ content: { fontSize: 20, color: pb.khop ? '#16a34a' : '#dc2626' } }} /></Col>
        <Col xs={24} md={14}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Cần phân bổ = định mức giáo viên − đứng lớp các môn ({fmt(tongDungLop)}) − Tổng phụ trách (1), gồm:
            dạy kiêm GDĐP, HĐTN-HN {fmt(pb.kiemDay)}; chủ nhiệm {fmt(pb.chuNhiem)}; kiêm nhiệm khác {fmt(pb.khac)}.
            Hệ thống gợi ý chia theo tỷ lệ giờ đứng lớp; môn trường để trống tự nhận phần còn lại theo cùng tỷ lệ.
          </Text>
        </Col>
      </Row>
      {!pb.khop && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 8 }}
          title={pb.conLai > 0
            ? `Tổng phân bổ còn thiếu ${fmt(pb.conLai)} giáo viên so với số cần phân bổ`
            : `Tổng phân bổ vượt ${fmt(-pb.conLai)} giáo viên so với số cần phân bổ`}
          description={tatCaDaChinh
            ? 'Trường đã điều chỉnh tất cả các môn - sửa lại cho khớp, hoặc để trống một số môn để hệ thống tự cân đối phần còn lại.'
            : 'Số trường điều chỉnh đã vượt tổng cần phân bổ - giảm số ở các môn đã điều chỉnh.'}
        />
      )}
      <Table<DongPhanBoKiem>
        size="small"
        bordered
        pagination={false}
        rowKey="ma"
        dataSource={pb.dong}
        scroll={{ x: 820 }}
        columns={[
          { title: 'Môn', dataIndex: 'ten', key: 'ten', width: 110 },
          { title: 'Tiết/tuần', key: 'tiet', width: 75, align: 'center', render: (_, d) => fmt(d.tietTuan) },
          { title: 'Đứng lớp', key: 'dl', width: 80, align: 'center', render: (_, d) => fmt(d.dungLop) },
          {
            title: 'Giáo viên kiêm nhiệm',
            children: [
              { title: 'Gợi ý', key: 'gy', width: 70, align: 'center', render: (_, d) => <Text type="secondary">{fmt(d.goiY)}</Text> },
              {
                title: <Tooltip title="Để trống thì hệ thống tự chia phần còn lại">Trường điều chỉnh</Tooltip>,
                key: 'tay', width: 110, align: 'center',
                render: (_, d) => coTheSua
                  ? (
                    <InputNumber
                      size="small"
                      value={d.nhapTay}
                      min={0}
                      max={50}
                      step={0.5}
                      precision={1}
                      placeholder={fmt(d.goiY)}
                      onChange={(v) => datKiem(d.ma, v)}
                      style={{ width: 80 }}
                    />
                  )
                  : (d.nhapTay != null ? fmt(d.nhapTay) : ''),
              },
              {
                title: 'Áp dụng', key: 'ad', width: 75, align: 'center',
                render: (_, d) => <Text strong={d.nhapTay != null}>{fmt(d.apDung)}</Text>,
              },
            ],
          },
          { title: 'Định mức môn', key: 'dm', width: 85, align: 'center', render: (_, d) => <Text strong>{fmt(d.dinhMuc)}</Text> },
          { title: 'Có mặt', key: 'cm', width: 65, align: 'center', render: (_, d) => coMat(d.ma) },
          { title: 'Thừa/thiếu', key: 'cl', width: 85, align: 'center', render: (_, d) => <ChenhLech v={coMat(d.ma) - d.dinhMuc} /> },
        ]}
        summary={() => (
          <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
            <Table.Summary.Cell index={0}>Tổng</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center">{fmt(pb.dong.reduce((s, d) => s + d.tietTuan, 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="center">{fmt(tongDungLop)}</Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="center">{fmt(pb.tong)}</Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="center">{pb.soMonDieuChinh ? `${pb.soMonDieuChinh} môn` : ''}</Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="center"><Space size={4} wrap>{fmt(pb.daPhanBo)}<TrangThaiPhanBo conLai={pb.conLai} /></Space></Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="center">{fmt(tongMon)}</Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="center">{tongCoMat}</Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="center"><ChenhLech v={tongCoMat - tongMon} /></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 13 }}>
        Đối chiếu: định mức các môn {fmt(tongMon)} + Tổng phụ trách 1 = {fmt(tongMon + 1)}; định mức giáo viên toàn trường {fmt(kq.gvDinhMuc)}.
      </Text>
    </Card>
  )
}

// ───────────────────────────── Thẻ: Phân công môn giảng dạy ─────────────────────────────

function ThePhanMon({ cap, nhanSu, kq, coTheSua, donVi, nhap }: {
  cap: CapHoc; nhanSu: VienChuc[]; kq: KetQuaDinhMuc; coTheSua: boolean; donVi: DonVi; nhap: QuyMoTruong
}) {
  const laMN = cap === 'MAM_NON'
  const tenPhanCong = laMN ? 'nhóm, lớp' : 'môn'
  const { message, modal } = App.useApp()
  const { currentUser } = useAuth()
  const updateVienChuc = useVienChucStore((s) => s.updateVienChuc)
  const capNhatNhieu = useVienChucStore((s) => s.capNhatNhieu)
  const cd = useTenChucDanh()
  const [tim, setTim] = useState('')
  const [loc, setLoc] = useState<'tat-ca' | 'chua'>('tat-ca')

  const dsMon = MON_GIANG_DAY[cap]
  const hopLe = (ma?: string) => !!ma && dsMon.some((m) => m.ma === ma)

  const giaoViens = useMemo(
    () => nhanSu
      .filter((v) => duocTinhSoLieu(v) && nhomNguoi(v, cd.lay(v.chucDanhId)?.nhom) === 'GIAO_VIEN')
      .sort((a, b) => a.ten.localeCompare(b.ten, 'vi') || a.ho.localeCompare(b.ho, 'vi')),
    [nhanSu, cd],
  )

  const tkMN = laMN ? thongKePhanCongMN(nhanSu, cd.lay, nhap) : undefined

  const chuaPhan = giaoViens.filter((v) => !hopLe(v.monDay))
  const goiY = chuaPhan.map((v) => ({ v, ma: goiYMonDay(v, cap) })).filter((x): x is { v: VienChuc; ma: string } => !!x.ma)
  const q = tim.trim().toLowerCase()
  const hienThi = giaoViens
    .filter((v) => loc === 'tat-ca' || !hopLe(v.monDay))
    .filter((v) => !q || `${v.ho} ${v.ten} ${v.nhiemVuChinh ?? ''} ${v.trinhDoChuyenMon ?? ''}`.toLowerCase().includes(q))

  const apDungGoiY = () => {
    if (!currentUser || !goiY.length) return
    const demMon = new Map<string, number>()
    for (const g of goiY) demMon.set(g.ma, (demMon.get(g.ma) ?? 0) + 1)
    modal.confirm({
      title: `Điền ${tenPhanCong} gợi ý cho ${goiY.length} giáo viên chưa phân công?`,
      width: 520,
      content: (
        <div>
          <p>Gợi ý dựa trên "Nhiệm vụ chính", nếu trống thì theo "Trình độ chuyên môn". Kiểm tra lại sau khi điền.</p>
          <Space wrap size={[6, 6]}>
            {[...demMon].map(([ma, n]) => <Tag key={ma}>{tenMonDay(ma)}: {n}</Tag>)}
          </Space>
          {chuaPhan.length > goiY.length && (
            <p style={{ marginTop: 10, marginBottom: 0 }}>
              <Text type="secondary">{chuaPhan.length - goiY.length} giáo viên không đủ thông tin để gợi ý - cần chọn tay.</Text>
            </p>
          )}
        </div>
      ),
      okText: 'Điền gợi ý',
      cancelText: 'Hủy',
      onOk: () => {
        capNhatNhieu(
          goiY.map((g) => ({ id: g.v.id, patch: { monDay: g.ma } })),
          currentUser.id,
          currentUser.fullName,
          `Phân công ${laMN ? 'nhóm, lớp phụ trách' : 'môn giảng dạy'} theo gợi ý cho ${goiY.length} giáo viên - ${donVi.ten}`,
          donVi.id,
        )
        message.success(`Đã điền ${tenPhanCong} cho ${goiY.length} giáo viên`)
      },
    })
  }

  const gvDong = kq.dong.filter((d) => d.laGiaoVien && !d.dongPhu)

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
          Đã phân công {giaoViens.length - chuaPhan.length}/{giaoViens.length} giáo viên.{' '}
          {laMN
            ? 'Số giáo viên phân công / định mức theo nhóm, lớp độ tuổi (số nhóm, lớp × 2,5 nhà trẻ hoặc × 2,2 mẫu giáo) - để theo dõi, định mức chung của trường không đổi:'
            : 'Có mặt / định mức theo môn:'}
        </Text>
        <Space wrap size={[6, 6]}>
          {(laMN
            ? tkMN!.dong.map((d) => ({ ma: d.ma, ten: d.ten, coMat: d.soGv, dinhMuc: d.dinhMuc, cl: d.dinhMuc == null ? null : lamTron1(d.soGv - d.dinhMuc) }))
            : gvDong.map((d) => ({ ma: d.ma, ten: tenMonDay(d.ma) ?? d.ten, coMat: d.coMat, dinhMuc: d.dinhMuc, cl: d.chenhLech == null ? 0 : lamTron1(d.chenhLech) }))
          ).map((d) => (
            <Tag
              key={d.ma}
              color={d.cl === 0 ? 'success' : d.cl == null ? 'default' : undefined}
              style={{ ...(d.cl ? kieuChenhLech(d.cl > 0) : {}), fontWeight: d.cl ? 600 : undefined, fontVariantNumeric: 'tabular-nums' }}
            >
              {d.ten}: {d.coMat}{d.dinhMuc != null ? ` / ${fmt(d.dinhMuc)}` : ''}
            </Tag>
          ))}
        </Space>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Input prefix={<SearchOutlined />} placeholder="Tìm tên, nhiệm vụ, trình độ" allowClear value={tim} onChange={(e) => setTim(e.target.value)} style={{ width: 260 }} />
        <Segmented
          value={loc}
          onChange={(v) => setLoc(v as 'tat-ca' | 'chua')}
          options={[{ value: 'tat-ca', label: `Tất cả (${giaoViens.length})` }, { value: 'chua', label: `Chưa phân công (${chuaPhan.length})` }]}
        />
        {coTheSua && goiY.length > 0 && (
          <Button icon={<BulbOutlined />} onClick={apDungGoiY}>Gợi ý {tenPhanCong} cho {goiY.length} giáo viên</Button>
        )}
      </div>
      <Table
        size="small"
        rowKey="id"
        dataSource={hienThi}
        pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }}
        scroll={{ x: 900 }}
        columns={[
          { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: unknown, __: VienChuc, i: number) => i + 1 },
          // Bấm tiêu đề cột để sắp xếp
          { title: 'Họ và tên', key: 'ten', width: 200, sorter: (a: VienChuc, b: VienChuc) => a.ten.localeCompare(b.ten, 'vi') || a.ho.localeCompare(b.ho, 'vi'), render: (_: unknown, v: VienChuc) => `${v.ho} ${v.ten}` },
          { title: 'Mã ngạch', key: 'ngach', width: 110, sorter: (a: VienChuc, b: VienChuc) => (cd.ma(a.chucDanhId) ?? '').localeCompare(cd.ma(b.chucDanhId) ?? ''), render: (_: unknown, v: VienChuc) => <Text type="secondary" style={{ fontSize: 13 }}>{cd.ma(v.chucDanhId) ?? '-'}</Text> },
          { title: 'Nhiệm vụ chính', dataIndex: 'nhiemVuChinh', key: 'nv', width: 190, ellipsis: true, sorter: (a: VienChuc, b: VienChuc) => (a.nhiemVuChinh ?? '').localeCompare(b.nhiemVuChinh ?? '', 'vi') },
          { title: 'Trình độ chuyên môn', dataIndex: 'trinhDoChuyenMon', key: 'td', width: 190, ellipsis: true, sorter: (a: VienChuc, b: VienChuc) => (a.trinhDoChuyenMon ?? '').localeCompare(b.trinhDoChuyenMon ?? '', 'vi') },
          {
            title: laMN ? 'Nhóm, lớp phụ trách' : 'Môn giảng dạy', key: 'mon', width: laMN ? 330 : 220,
            // Chưa phân công xếp cuối khi sắp tăng dần
            sorter: (a: VienChuc, b: VienChuc) => Number(!hopLe(a.monDay)) - Number(!hopLe(b.monDay)) || (tenMonDay(a.monDay) ?? '').localeCompare(tenMonDay(b.monDay) ?? '', 'vi'),
            render: (_: unknown, v: VienChuc) => {
              const goiYMon = !hopLe(v.monDay) ? goiYMonDay(v, cap) : undefined
              if (!coTheSua) return hopLe(v.monDay) ? tenMonDay(v.monDay) : <Tag color="warning">Chưa phân công</Tag>
              return (
                <Space size={4}>
                  <Select
                    size="small"
                    value={hopLe(v.monDay) ? v.monDay : undefined}
                    placeholder={laMN ? 'Chọn nhóm, lớp' : 'Chọn môn'}
                    allowClear
                    style={{ width: laMN ? 250 : 130 }}
                    status={hopLe(v.monDay) ? undefined : 'warning'}
                    options={dsMon.map((m) => ({ value: m.ma, label: m.ten }))}
                    onChange={(ma?: string) => currentUser && updateVienChuc(v.id, { monDay: ma }, currentUser.id, currentUser.fullName)}
                  />
                  {goiYMon && (
                    <Tooltip title="Áp dụng môn gợi ý">
                      <Tag color="blue" style={{ cursor: 'pointer', marginInlineEnd: 0 }} onClick={() => currentUser && updateVienChuc(v.id, { monDay: goiYMon }, currentUser.id, currentUser.fullName)}>
                        {tenMonDay(goiYMon)}?
                      </Tag>
                    </Tooltip>
                  )}
                </Space>
              )
            },
          },
        ]}
      />
    </>
  )
}

// ───────────────────────────── Xuất Excel một trường ─────────────────────────────

function xuatExcelTruong(donVi: DonVi, namHoc: string, cap: CapHoc, nhap: QuyMoTruong, kq: KetQuaDinhMuc) {
  const so = (n: number | null) => (n == null ? '' : lamTron1(n))
  const aoa: (string | number)[][] = [
    ['UBND PHƯỜNG GIA VIÊN'],
    [donVi.ten.toUpperCase()],
    [],
    [`ĐỊNH MỨC VIÊN CHỨC VÀ CƠ CẤU VỊ TRÍ VIỆC LÀM NĂM HỌC ${namHoc}`],
    [cap === 'MAM_NON' ? 'Căn cứ Thông tư 19/2023/TT-BGDĐT' : 'Căn cứ Thông tư 20/2023/TT-BGDĐT'],
    [],
    ['I. QUY MÔ TRƯỜNG LỚP'],
  ]
  const haiBuoi = CO_HAI_BUOI[cap]
  const bang: VungBang[] = []
  const dam: number[] = []
  const nen: Record<number, string> = {}
  const mauChu: Record<string, string> = {}
  const batDauBang = (soCot: number) => bang.push({ tu: aoa.length, den: aoa.length, soDongTieuDe: 1, soCot })
  const ketThucBang = () => { bang[bang.length - 1].den = aoa.length - 1 }
  // Thừa đỏ, thiếu xanh dương - giống trên màn hình
  const toMau = (c: number, v: number | string) => { if (typeof v === 'number' && lamTron1(v) !== 0) mauChu[`${aoa.length - 1}:${c}`] = v > 0 ? 'FFCF1322' : 'FF1D4ED8' }
  batDauBang(haiBuoi ? 6 : 4)
  aoa.push(haiBuoi
    ? ['Khối', 'Số lớp', 'Số học sinh', 'Số lớp học 2 buổi/ngày', 'Số HS học 2 buổi/ngày', 'Bình quân/lớp']
    : ['Nhóm, lớp', 'Số lớp', 'Số trẻ', 'Bình quân/lớp'])
  for (const k of KHOI[cap]) {
    const o = nhap.khoi[k.ma]
    const lop = o?.soLop ?? 0
    const hs = o?.soHocSinh ?? 0
    const bq = lop ? lamTron1(hs / lop) : ''
    aoa.push(haiBuoi
      ? [k.ten, lop, hs, Math.min(o?.soLop2Buoi ?? 0, lop), Math.min(o?.soHocSinh2Buoi ?? 0, hs), bq]
      : [k.ten, lop, hs, bq])
  }
  aoa.push(haiBuoi
    ? ['Tổng', kq.tongLop, kq.tongHS, kq.tongLop2Buoi, kq.tongHS2Buoi, lamTron1(kq.binhQuan)]
    : ['Tổng', kq.tongLop, kq.tongHS, lamTron1(kq.binhQuan)])
  dam.push(aoa.length - 1)
  ketThucBang()
  if (cap === 'TIEU_HOC') {
    const tin = (nhap.khoiDayTinThem ?? []).map((k) => k.slice(1)).sort()
    aoa.push(['Khối dạy Tin học', tin.length ? `${tin.join(', ')}, 3, 4, 5` : '3, 4, 5'])
  }
  aoa.push(['Hạng trường', HANG_TRUONG_LABELS[kq.hang]], [], ['II. CÁCH TÍNH ĐỊNH MỨC GIÁO VIÊN'], ...kq.dienGiai.map((s) => [s]), [])
  if (kq.phanBoKiem) {
    const pb = kq.phanBoKiem
    aoa.push(['PHÂN BỔ GIÁO VIÊN KIÊM NHIỆM THEO MÔN'])
    dam.push(aoa.length - 1)
    batDauBang(7)
    aoa.push(['Môn', 'Tiết/tuần', 'Đứng lớp', 'Kiêm nhiệm gợi ý', 'Trường điều chỉnh', 'Kiêm nhiệm áp dụng', 'Định mức môn'])
    for (const d of pb.dong) aoa.push([d.ten, lamTron1(d.tietTuan), lamTron1(d.dungLop), lamTron1(d.goiY), d.nhapTay != null ? lamTron1(d.nhapTay) : '', lamTron1(d.apDung), lamTron1(d.dinhMuc)])
    aoa.push(['Tổng', '', lamTron1(pb.dong.reduce((s, d) => s + d.dungLop, 0)), lamTron1(pb.tong), '', lamTron1(pb.daPhanBo), lamTron1(pb.dong.reduce((s, d) => s + d.dinhMuc, 0))])
    dam.push(aoa.length - 1)
    ketThucBang()
    aoa.push([pb.khop ? 'Tổng phân bổ khớp số cần phân bổ' : `Tổng phân bổ ${pb.conLai > 0 ? 'còn thiếu' : 'vượt'} ${lamTron1(Math.abs(pb.conLai))} giáo viên`], [])
  }
  aoa.push(['III. ĐỊNH MỨC VIÊN CHỨC VÀ CƠ CẤU THEO VỊ TRÍ VIỆC LÀM'])
  dam.push(aoa.length - 1)
  batDauBang(8)
  aoa.push(['STT', 'Vị trí việc làm', 'Căn cứ tính', 'Định mức', 'Có mặt - Viên chức', 'Có mặt - Hợp đồng', 'Có mặt - Tổng', 'Thừa (+)/Thiếu (-)'])
  for (const n of NHOM_DINH_MUC) {
    const ds = kq.dong.filter((d) => d.nhom === n.key)
    if (!ds.length) continue
    const t = kq.tongNhom.find((x) => x.nhom === n.key)
    aoa.push([
      '', n.ten,
      !t ? '' : !t.apDungDinhMuc ? 'Chỉ đếm số có mặt, không so với định mức' : t.coMatNgoai ? `${t.coMatNgoai} người ở vị trí chưa có định mức, không đưa vào so sánh` : '',
      t?.apDungDinhMuc ? lamTron1(t.dinhMuc) : '', t?.coMatVC ?? '', t?.coMatHD ?? '', t?.coMat ?? '',
      t?.chenhLech == null ? '' : lamTron1(t.chenhLech),
    ])
    dam.push(aoa.length - 1)
    nen[aoa.length - 1] = 'FFEEF2FF'
    if (t?.chenhLech != null) toMau(7, t.chenhLech)
    ds.forEach((d, i) => {
      aoa.push([
        i + 1, d.ten, d.canCu, d.trongGv ? 'Thuộc định mức GV' : d.khongDinhMuc ? 'Không áp dụng' : so(d.dinhMuc),
        d.coMatVC, d.coMatHD, d.coMat, d.khongDinhMuc || d.trongGv ? '' : so(d.chenhLech),
      ])
      if (!d.khongDinhMuc && !d.trongGv && d.chenhLech != null) toMau(7, d.chenhLech)
    })
  }
  const coDm = kq.tongNhom.filter((t) => t.apDungDinhMuc)
  aoa.push(['', 'Tổng toàn trường - nhóm I-III (so với định mức)', '', lamTron1(kq.tongDinhMuc),
    coDm.reduce((s, t) => s + t.coMatVC, 0), coDm.reduce((s, t) => s + t.coMatHD, 0), coDm.reduce((s, t) => s + t.coMat, 0), lamTron1(kq.coMatCoDinhMuc - kq.tongDinhMuc)])
  toMau(7, kq.coMatCoDinhMuc - kq.tongDinhMuc)
  dam.push(aoa.length - 1)
  aoa.push(['', 'Tổng lao động toàn trường (cả ngoài danh mục)', '', '', kq.toanTruong.coMatVC, kq.toanTruong.coMatHD, kq.toanTruong.coMat, ''])
  dam.push(aoa.length - 1)
  ketThucBang()
  if (nhap.ghiChu) aoa.push([], [`Ghi chú: ${nhap.ghiChu}`])

  return xuatExcelA4(`Dinh-muc-${donVi.ma || donVi.id}-${namHoc}`, [{
    ten: 'Định mức',
    dong: aoa,
    rongCot: [6, 40, 40, 11, 11, 11, 11, 12],
    bang,
    tieuDe: [3],
    giua: [4],
    nghieng: [4],
    dam: [0, 1, 6, ...dam],
    nen,
    mauChu,
    cotGiua: [0],
    huong: 'ngang',
  }])
}
