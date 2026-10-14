// Thống kê viên chức theo mã chức danh nghề nghiệp của từng trường, từng cấp học và bậc nghề nghiệp dự kiến
// khi chuyển theo Nghị định 232/2026/NĐ-CP (vị trí việc làm của viên chức, hiệu lực 01/7/2026).
// Quy tắc chuyển (Điều 18): theo loại bảng lương của chức danh đang giữ - B → bậc 1, A0 → bậc 2, A1 → bậc 3,
// A2 → bậc 4 (A2.2 chuyển sang bảng A2.1), A3 → bậc 5; hệ số giữ nguyên trừ trường hợp A2.2.
import { Fragment, useMemo, useState } from 'react'
import { Alert, Button, Modal, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { duocTinhSoLieu } from '@/types/vienChuc'
import type { VienChuc } from '@/types/vienChuc'
import type { DonVi } from '@/types/donVi'
import type { ChucDanhNgheNghiep } from '@/types/danhMuc'
import { type CapHoc, TEN_CAP, THU_TU_CAP, laBienChe, nhomNguoi, viTriCuaNguoi } from '@/utils/dinhMuc'
import { exportToExcel } from '@/utils/exportExcel'

const { Text } = Typography

type Bac = 1 | 2 | 3 | 4 | 5
const CAC_BAC: Bac[] = [1, 2, 3, 4, 5]
const MAU_BAC: Record<Bac, string> = { 1: 'default', 2: 'cyan', 3: 'blue', 4: 'geekblue', 5: 'purple' }
const phanTram = (a: number, b: number) => (b ? `${(Math.round((a / b) * 1000) / 10).toLocaleString('vi-VN')}%` : '')

/** Bậc nghề nghiệp dự kiến theo loại bảng lương của chức danh đang giữ (Điều 18 NĐ 232/2026) */
export function bacTheoBangLuong(bangLuong?: string): Bac | null {
  const b = (bangLuong ?? '').toUpperCase().replace(/\s/g, '')
  if (b === 'B') return 1
  if (b === 'A0') return 2
  if (b === 'A1') return 3
  if (b.startsWith('A2')) return 4
  if (b.startsWith('A3')) return 5
  return null
}

/** Bảng lương A2.1 (NĐ 204/2004, bảng 3) - đích chuyển của người đang xếp A2.2 */
const HE_SO_A21 = [4.40, 4.74, 5.08, 5.42, 5.76, 6.10, 6.44, 6.78]
/** Xếp vào bậc có hệ số bằng hoặc cao hơn gần nhất (TT 02/2007/TT-BNV); quá bậc cuối thì giữ bậc cuối */
function heSoA21DuKien(heSo: number): { bac: number; heSo: number; vuotKhung: boolean } {
  const i = HE_SO_A21.findIndex((h) => h >= heSo - 1e-9)
  if (i < 0) return { bac: HE_SO_A21.length, heSo: HE_SO_A21[HE_SO_A21.length - 1], vuotKhung: true }
  return { bac: i + 1, heSo: HE_SO_A21[i], vuotKhung: false }
}

/** Khung bậc nghề nghiệp của vị trí việc làm (Phụ lục II, III NĐ 232/2026) */
const KHUNG_GV: Record<CapHoc, [Bac, Bac]> = { MAM_NON: [2, 4], TIEU_HOC: [3, 4], THCS: [3, 4] }
const KHUNG_NV: Record<string, [Bac, Bac]> = {
  KE_TOAN: [1, 4], VAN_THU: [1, 4], THU_QUY: [1, 3], Y_TE: [1, 3], NAU_AN: [1, 3],
  GIAO_VU: [2, 3], THIET_BI: [2, 3], HO_TRO_KT: [2, 3], TU_VAN: [3, 4], QUAN_TRI_CS: [2, 4],
}
const TEN_VT_NV: Record<string, string> = {
  KE_TOAN: 'Kế toán', VAN_THU: 'Văn thư', THU_QUY: 'Thủ quỹ', Y_TE: 'Y tế trường học', NAU_AN: 'Cấp dưỡng',
  GIAO_VU: 'Giáo vụ', THIET_BI: 'Thiết bị, thí nghiệm', HO_TRO_KT: 'Hỗ trợ GD người khuyết tật', TU_VAN: 'Tư vấn học sinh', QUAN_TRI_CS: 'Quản trị công sở',
}

interface NguoiTinh {
  vc: VienChuc
  truong: DonVi
  cap: CapHoc
  cd?: ChucDanhNgheNghiep
  heSo?: number
  bac: Bac | null
  viTri: string
  khung?: [Bac, Bac]
  ngoaiKhung: boolean
  a22?: { bac: number; heSo: number; vuotKhung: boolean }
}

type LocCot = { cdId?: string; bac?: Bac | 'CHUA'; ngoaiKhung?: boolean; a22?: boolean }
type Dong = {
  key: string; loai: 'phuong' | 'cap' | 'truong'; ten: string; stt?: number; soTruong?: number
  nguoi: NguoiTinh[]
}

export default function ChucDanhBacNgheNghiep({ truongs }: { truongs: DonVi[] }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const nhieuTruong = truongs.length > 1
  const [loc, setLoc] = useState<'ALL' | CapHoc>('ALL')
  const [xem, setXem] = useState<{ tieuDe: string; ds: NguoiTinh[] } | null>(null)

  // Tính cho từng viên chức đang công tác của các trường
  const nguoi = useMemo(() => {
    const cdTheoId = new Map(chucDanhs.map((c) => [c.id, c]))
    const heSoTheoVc = new Map<string, number>()
    for (const h of [...heSoLuongs].filter((x) => x.isActive).sort((a, b) => a.ngayHieuLuc.localeCompare(b.ngayHieuLuc))) heSoTheoVc.set(h.vienChucId, h.heSo)
    const truongTheoId = new Map(truongs.map((t) => [t.id, t]))
    const ra: NguoiTinh[] = []
    for (const vc of vienChucs) {
      const truong = truongTheoId.get(vc.donViId)
      if (!truong || !duocTinhSoLieu(vc) || !laBienChe(vc)) continue
      const cap = truong.loai as CapHoc
      const cd = vc.chucDanhId ? cdTheoId.get(vc.chucDanhId) : undefined
      const bac = bacTheoBangLuong(cd?.bangLuong)
      const nhom = nhomNguoi(vc, cd?.nhom)
      const ma = viTriCuaNguoi(vc, cap, cd)
      const khung = nhom === 'NHAN_VIEN' ? KHUNG_NV[ma] : KHUNG_GV[cap]
      const viTri = nhom === 'NHAN_VIEN' ? (TEN_VT_NV[ma] ?? 'Nhân viên khác') : `Giáo viên ${TEN_CAP[cap].toLowerCase()}${nhom === 'CBQL' ? ' (CBQL)' : ''}`
      const heSo = heSoTheoVc.get(vc.id)
      const laA22 = (cd?.bangLuong ?? '').toUpperCase().replace(/\s/g, '') === 'A2.2'
      ra.push({
        vc, truong, cap, cd, heSo, bac, viTri, khung,
        ngoaiKhung: !!(bac && khung && (bac < khung[0] || bac > khung[1])),
        a22: laA22 && heSo != null ? heSoA21DuKien(heSo) : undefined,
      })
    }
    return ra
  }, [chucDanhs, vienChucs, heSoLuongs, truongs])

  const truongHien = useMemo(
    () => truongs
      .filter((t) => loc === 'ALL' || t.loai === loc)
      .sort((a, b) => THU_TU_CAP[a.loai as CapHoc] - THU_TU_CAP[b.loai as CapHoc] || a.ten.localeCompare(b.ten, 'vi')),
    [truongs, loc],
  )

  // Dòng: toàn phường / tổng cấp / từng trường
  const dongs = useMemo(() => {
    const cua = (ids: Set<string>) => nguoi.filter((n) => ids.has(n.truong.id))
    const ra: Dong[] = []
    if (nhieuTruong) ra.push({ key: '__p', loai: 'phuong', ten: loc === 'ALL' ? 'TOÀN PHƯỜNG' : `TOÀN CẤP ${TEN_CAP[loc].toUpperCase()}`, soTruong: truongHien.length, nguoi: cua(new Set(truongHien.map((t) => t.id))) })
    for (const cap of (['MAM_NON', 'TIEU_HOC', 'THCS'] as CapHoc[])) {
      const ds = truongHien.filter((t) => t.loai === cap)
      if (!ds.length) continue
      if (nhieuTruong && loc === 'ALL') ra.push({ key: `__c${cap}`, loai: 'cap', ten: `Cấp ${TEN_CAP[cap]}`, soTruong: ds.length, nguoi: cua(new Set(ds.map((t) => t.id))) })
      ds.forEach((t, i) => ra.push({ key: t.id, loai: 'truong', ten: t.ten, stt: i + 1, nguoi: cua(new Set([t.id])) }))
    }
    return ra
  }, [nguoi, truongHien, nhieuTruong, loc])

  // Cột mã chức danh: chỉ các mã đang có người ở các trường đang xem, nhóm giáo viên trước, nhân viên sau
  const nguoiHien = dongs[0]?.nguoi ?? []
  const cacMa = useMemo(() => {
    const m = new Map<string, ChucDanhNgheNghiep>()
    for (const n of nguoiHien) if (n.cd) m.set(n.cd.id, n.cd)
    const thuTu = { QUAN_LY: 0, GIAO_VIEN: 1, NHAN_VIEN: 2 } as Record<string, number>
    return [...m.values()].sort((a, b) => (thuTu[a.nhom] ?? 3) - (thuTu[b.nhom] ?? 3) || a.ma.localeCompare(b.ma))
  }, [nguoiHien])
  const khongMa = nguoiHien.some((n) => !n.cd)

  const loc1 = (ds: NguoiTinh[], l: LocCot) => ds.filter((n) =>
    (l.cdId === undefined || (l.cdId === '' ? !n.cd : n.cd?.id === l.cdId))
    && (l.bac === undefined || (l.bac === 'CHUA' ? n.bac == null : n.bac === l.bac))
    && (!l.ngoaiKhung || n.ngoaiKhung)
    && (!l.a22 || !!n.a22))

  const o = (r: Dong, l: LocCot, tieuDe: string, tyLe = false) => {
    const ds = loc1(r.nguoi, l)
    if (!ds.length) return <Text type="secondary">-</Text>
    const so = r.loai === 'truong' ? ds.length : <b>{ds.length}</b>
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        <a onClick={() => setXem({ tieuDe: `${tieuDe} - ${r.ten}`, ds })}>{so}</a>
        {tyLe && <Text type="secondary" style={{ fontSize: 12 }}> ({phanTram(ds.length, r.nguoi.length)})</Text>}
      </span>
    )
  }
  /** Mã chức danh tương đương từng bậc (dòng cuối bảng) */
  const maCuaBac = (b: Bac) => cacMa.filter((cd) => bacTheoBangLuong(cd.bangLuong) === b)

  const tongA22 = nguoiHien.filter((n) => n.a22)
  const chenhA22 = tongA22.reduce((s, n) => s + (n.a22!.heSo - (n.heSo ?? 0)), 0)
  const soNgoaiKhung = nguoiHien.filter((n) => n.ngoaiKhung).length
  const soChuaBac = nguoiHien.filter((n) => n.bac == null).length

  const columns: ColumnsType<Dong> = [
    { title: 'STT', key: 'stt', width: 46, align: 'center', fixed: 'left', render: (_, r) => r.stt ?? '' },
    {
      title: 'Trường', key: 'ten', width: 190, fixed: 'left',
      render: (_, r) => (r.loai === 'truong' ? r.ten : <span><b>{r.ten}</b>{r.soTruong ? <Text type="secondary" style={{ fontSize: 12 }}> ({r.soTruong} trường)</Text> : null}</span>),
    },
    { title: 'Tổng VC', key: 'tong', width: 64, align: 'center', render: (_, r) => o(r, {}, 'Tất cả viên chức') },
    {
      title: 'Theo mã chức danh nghề nghiệp',
      children: [
        ...cacMa.map((cd) => ({
          title: (
            <Tooltip title={`${cd.ten} - lương ${cd.bangLuong} → bậc ${bacTheoBangLuong(cd.bangLuong) ?? '?'}`}>
              <div style={{ lineHeight: 1.25 }}>
                <div>{cd.ma}</div>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>{cd.bangLuong} · bậc {bacTheoBangLuong(cd.bangLuong) ?? '?'}</Text>
              </div>
            </Tooltip>
          ),
          key: `cd-${cd.id}`, width: 82, align: 'center' as const,
          render: (_: unknown, r: Dong) => o(r, { cdId: cd.id }, `${cd.ma} ${cd.ten}`),
        })),
        ...(khongMa ? [{ title: 'Chưa có mã', key: 'cd-none', width: 70, align: 'center' as const, render: (_: unknown, r: Dong) => o(r, { cdId: '' }, 'Chưa có mã chức danh') }] : []),
      ],
    },
    {
      title: 'Bậc nghề nghiệp dự kiến (NĐ 232/2026)',
      children: [
        ...CAC_BAC.map((b) => ({ title: `Bậc ${b}`, key: `b${b}`, width: 86, align: 'center' as const, render: (_: unknown, r: Dong) => o(r, { bac: b }, `Bậc ${b} dự kiến`, true) })),
        ...(soChuaBac ? [{ title: 'Chưa xác định', key: 'bchua', width: 76, align: 'center' as const, render: (_: unknown, r: Dong) => o(r, { bac: 'CHUA' }, 'Chưa xác định bậc') }] : []),
      ],
    },
    { title: <Tooltip title="Bậc dự kiến nằm ngoài khung bậc của vị trí việc làm (VD giáo viên tiểu học loại B → bậc 1, khung 3-4)">Ngoài khung</Tooltip>, key: 'nk', width: 70, align: 'center', render: (_, r) => o(r, { ngoaiKhung: true }, 'Ngoài khung bậc vị trí') },
    { title: <Tooltip title="Đang xếp lương A2.2, khi chuyển bậc 4 được xếp sang bảng A2.1 - hệ số có thể tăng">A2.2 → A2.1</Tooltip>, key: 'a22', width: 72, align: 'center', render: (_, r) => o(r, { a22: true }, 'Chuyển A2.2 sang A2.1') },
  ]

  const xuatBang = () => {
    const rows = dongs.map((r) => {
      const d: Record<string, string | number> = { STT: r.stt ?? '', 'Trường': r.ten, 'Tổng VC': r.nguoi.length }
      for (const cd of cacMa) d[`${cd.ma} (${cd.bangLuong})`] = loc1(r.nguoi, { cdId: cd.id }).length || ''
      if (khongMa) d['Chưa có mã'] = loc1(r.nguoi, { cdId: '' }).length || ''
      for (const b of CAC_BAC) {
        const n = loc1(r.nguoi, { bac: b }).length
        d[`Bậc ${b}`] = n || ''
        d[`Bậc ${b} (%)`] = n ? phanTram(n, r.nguoi.length) : ''
      }
      if (soChuaBac) d['Chưa xác định bậc'] = loc1(r.nguoi, { bac: 'CHUA' }).length || ''
      d['Ngoài khung'] = loc1(r.nguoi, { ngoaiKhung: true }).length || ''
      d['A2.2 → A2.1'] = loc1(r.nguoi, { a22: true }).length || ''
      return d
    })
    // Dòng cuối: mã CDNN chuyển tương đương sang bậc nào, bậc nào gồm các mã nào
    const td: Record<string, string | number> = { STT: '', 'Trường': 'Chuyển tương đương mã CDNN → bậc', 'Tổng VC': '' }
    for (const cd of cacMa) td[`${cd.ma} (${cd.bangLuong})`] = bacTheoBangLuong(cd.bangLuong) ? `Bậc ${bacTheoBangLuong(cd.bangLuong)}` : 'Chưa rõ'
    if (khongMa) td['Chưa có mã'] = ''
    for (const b of CAC_BAC) { td[`Bậc ${b}`] = maCuaBac(b).map((c) => c.ma).join(', '); td[`Bậc ${b} (%)`] = '' }
    if (soChuaBac) td['Chưa xác định bậc'] = ''
    td['Ngoài khung'] = ''
    td['A2.2 → A2.1'] = ''
    rows.push(td)
    exportToExcel(rows, 'Chuc_danh_bac_nghe_nghiep', 'Chức danh - bậc NN', [
      'THỐNG KÊ VIÊN CHỨC THEO MÃ CHỨC DANH NGHỀ NGHIỆP VÀ BẬC NGHỀ NGHIỆP DỰ KIẾN',
      'Theo Nghị định 232/2026/NĐ-CP - số liệu dự kiến, chờ hướng dẫn chuyển xếp',
    ])
  }

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Bậc nghề nghiệp dự kiến theo Nghị định 232/2026/NĐ-CP - chỉ để tham khảo, chờ phê duyệt vị trí việc làm và hướng dẫn chuyển xếp (hạn chậm nhất 01/7/2027)"
        description={(
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Chỉ tính viên chức (biên chế, tập sự) đang công tác. Bậc dự kiến theo loại lương của chức danh đang giữ: B → bậc 1, A0 → bậc 2, A1 → bậc 3, A2 → bậc 4, A3 → bậc 5; hệ số giữ nguyên.</li>
            <li>Đang xếp A2.2 (giáo viên mầm non hạng I, tiểu học/THCS hạng II) chuyển sang bảng A2.1: xếp bậc có hệ số bằng hoặc cao hơn gần nhất. Khung bậc: giáo viên mầm non 2-4, tiểu học/THCS 3-4; nhân viên theo vị trí (kế toán, văn thư 1-4; y tế, thủ quỹ 1-3; giáo vụ, thiết bị 2-3...).</li>
            <li>Bấm vào số để xem danh sách người.</li>
          </ul>
        )}
      />
      <Space wrap style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        <Space wrap>
          {nhieuTruong && (
            <Segmented<'ALL' | CapHoc>
              value={loc}
              onChange={setLoc}
              options={[{ value: 'ALL', label: 'Toàn phường' }, ...(['MAM_NON', 'TIEU_HOC', 'THCS'] as CapHoc[]).map((c) => ({ value: c, label: TEN_CAP[c] }))]}
            />
          )}
          <Text type="secondary">{nguoiHien.length} viên chức</Text>
          {soNgoaiKhung > 0 && <Tag color="warning">{soNgoaiKhung} người ngoài khung bậc</Tag>}
          {tongA22.length > 0 && (
            <Tag color="purple" style={{ cursor: 'pointer' }} onClick={() => setXem({ tieuDe: 'Chuyển A2.2 sang A2.1', ds: tongA22 })}>
              {tongA22.length} người A2.2 → A2.1, hệ số tăng tổng {chenhA22.toFixed(2).replace('.', ',')}
            </Tag>
          )}
        </Space>
        <Button icon={<FileExcelOutlined />} onClick={xuatBang}>Xuất Excel</Button>
      </Space>
      <Table<Dong>
        size="small"
        bordered
        rowKey="key"
        pagination={false}
        dataSource={dongs}
        columns={columns}
        scroll={{ x: 'max-content', y: 'calc(100vh - 300px)' }}
        onRow={(r) => (r.loai === 'truong' ? {} : { style: { background: r.loai === 'phuong' ? '#e0e7ff' : '#f1f5f9' } })}
        summary={() => {
          // 3 cột đầu (STT, Trường, Tổng VC) gộp làm ô tiêu đề; các ô sau đánh chỉ số từ 3
          let i = 3
          const cell = (n: React.ReactNode) => <Table.Summary.Cell index={i++} align="center">{n}</Table.Summary.Cell>
          const nho = (x: React.ReactNode) => <Text style={{ fontSize: 12 }}>{x}</Text>
          return (
            <Table.Summary>
              <Table.Summary.Row style={{ background: '#fef9c3' }}>
                <Table.Summary.Cell index={0} colSpan={3}><b>Chuyển tương đương mã CDNN → bậc nghề nghiệp</b></Table.Summary.Cell>
                {cacMa.map((cd) => {
                  const b = bacTheoBangLuong(cd.bangLuong)
                  return <Fragment key={cd.id}>{cell(b ? <Tag color={MAU_BAC[b]} style={{ marginInlineEnd: 0 }}>Bậc {b}</Tag> : nho('Chưa rõ'))}</Fragment>
                })}
                {khongMa && cell(nho('-'))}
                {CAC_BAC.map((b) => {
                  const ma = maCuaBac(b)
                  return <Fragment key={b}>{cell(ma.length ? nho(<Tooltip title={ma.map((c) => `${c.ma} ${c.ten}`).join('; ')}>{ma.map((c) => c.ma).join(', ')}</Tooltip>) : nho('-'))}</Fragment>
                })}
                {soChuaBac > 0 && cell(nho('-'))}
                {cell(null)}
                {cell(nho('A2.2 → A2.1'))}
              </Table.Summary.Row>
            </Table.Summary>
          )
        }}
      />
      <DanhSach xem={xem} onClose={() => setXem(null)} xemHoSo={hasPermission('vienChuc', 'read')} moHoSo={(id) => { setXem(null); navigate(`/vien-chuc/${id}`) }} />
    </>
  )
}

const so2 = (v?: number) => (v == null ? '-' : v.toFixed(2).replace('.', ','))

function DanhSach({ xem, onClose, xemHoSo, moHoSo }: {
  xem: { tieuDe: string; ds: NguoiTinh[] } | null; onClose: () => void; xemHoSo: boolean; moHoSo: (id: string) => void
}) {
  const ds = useMemo(
    () => [...(xem?.ds ?? [])].sort((a, b) => a.truong.ten.localeCompare(b.truong.ten, 'vi') || a.vc.ten.localeCompare(b.vc.ten, 'vi') || a.vc.ho.localeCompare(b.vc.ho, 'vi')),
    [xem],
  )
  const coA22 = ds.some((n) => n.a22)
  const xuat = () => exportToExcel(ds.map((n, i) => ({
    STT: i + 1, 'Họ và tên': `${n.vc.ho} ${n.vc.ten}`, 'Trường': n.truong.ten, 'Mã CDNN': n.cd?.ma ?? '', 'Chức danh': n.cd?.ten ?? '',
    'Loại lương': n.cd?.bangLuong ?? '', 'Hệ số hiện hưởng': n.heSo ?? '', 'Vị trí việc làm': n.viTri,
    'Khung bậc vị trí': n.khung ? `${n.khung[0]}-${n.khung[1]}` : '', 'Bậc dự kiến': n.bac ?? 'Chưa xác định',
    ...(coA22 ? { 'Hệ số A2.1 dự kiến': n.a22?.heSo ?? '', 'Bậc lương A2.1': n.a22?.bac ?? '' } : {}),
    'Ghi chú': n.ngoaiKhung ? 'Ngoài khung bậc vị trí' : '',
  })), 'Danh_sach_bac_nghe_nghiep', 'Danh sách', [xem?.tieuDe.toUpperCase() ?? '', 'Bậc nghề nghiệp dự kiến theo NĐ 232/2026/NĐ-CP'])

  return (
    <Modal open={!!xem} onCancel={onClose} footer={null} width={1100} title={xem?.tieuDe} destroyOnHidden>
      <Space style={{ marginBottom: 12 }}>
        <Text type="secondary">{ds.length} người</Text>
        <Button size="small" icon={<FileExcelOutlined />} onClick={xuat}>Xuất Excel</Button>
      </Space>
      <Table<NguoiTinh>
        size="small"
        bordered
        rowKey={(n) => n.vc.id}
        pagination={false}
        dataSource={ds}
        scroll={{ x: 'max-content', y: 480 }}
        columns={[
          { title: 'STT', key: 'stt', width: 46, align: 'center', render: (_, __, i) => i + 1 },
          { title: 'Họ và tên', key: 'ten', width: 180, render: (_, n) => (xemHoSo ? <a onClick={() => moHoSo(n.vc.id)}>{n.vc.ho} {n.vc.ten}</a> : `${n.vc.ho} ${n.vc.ten}`) },
          { title: 'Trường', key: 'tr', width: 170, render: (_, n) => n.truong.ten },
          { title: 'Mã CDNN', key: 'ma', width: 95, render: (_, n) => n.cd?.ma ?? <Text type="warning">Chưa có</Text> },
          { title: 'Loại lương', key: 'bl', width: 70, align: 'center', render: (_, n) => n.cd?.bangLuong ?? '-' },
          { title: 'Hệ số', key: 'hs', width: 65, align: 'center', render: (_, n) => so2(n.heSo) },
          { title: 'Vị trí việc làm', key: 'vt', width: 170, render: (_, n) => n.viTri },
          { title: 'Khung bậc', key: 'kh', width: 70, align: 'center', render: (_, n) => (n.khung ? `${n.khung[0]}-${n.khung[1]}` : '-') },
          {
            title: 'Bậc dự kiến', key: 'bac', width: 80, align: 'center',
            render: (_, n) => (n.bac == null ? <Text type="warning">Chưa xác định</Text> : n.ngoaiKhung ? <Tag color="warning" style={{ marginInlineEnd: 0 }}>Bậc {n.bac}</Tag> : `Bậc ${n.bac}`),
          },
          ...(coA22 ? [{
            title: 'Hệ số A2.1 dự kiến', key: 'a21', width: 110, align: 'center' as const,
            render: (_: unknown, n: NguoiTinh) => (n.a22
              ? <Tooltip title={`Bậc ${n.a22.bac}/8 bảng A2.1${n.a22.vuotKhung ? ' - hệ số hiện hưởng cao hơn bậc cuối A2.1, xem xét vượt khung' : ''}`}><b>{so2(n.a22.heSo)}</b> <Text type="secondary" style={{ fontSize: 12 }}>(+{so2(n.a22.heSo - (n.heSo ?? 0))})</Text></Tooltip>
              : ''),
          }] : []),
        ]}
      />
    </Modal>
  )
}
