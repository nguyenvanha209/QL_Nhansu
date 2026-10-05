import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, DatePicker, Drawer, Input, InputNumber, Space, Table, Tag, Typography } from 'antd'
import { HistoryOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/hooks/useAuth'
import { useDanhMucStore } from '@/store/danhMucStore'
import type { DonVi } from '@/types/donVi'
import type { ChiTieuBienChe, NhomChiTieu, OChiTieu } from '@/types/quyMo'
import { NHOM_DINH_MUC, fmt, idQuyMo, lamTron1 } from '@/utils/dinhMuc'
import type { KetQuaDinhMuc } from '@/utils/dinhMuc'
import { formatDate, formatDatetime } from '@/utils/helpers'
import { logAction } from '@/utils/auditLogger'

const { Text } = Typography
const MAU_THUA = '#cf1322'
const MAU_THIEU = '#1d4ed8'

const NHOM: { key: NhomChiTieu; ten: string; chiHopDong?: boolean }[] = [
  { key: 'QUAN_LY', ten: 'I. Lãnh đạo, quản lý' },
  { key: 'CHUYEN_MON', ten: 'II. Chuyên môn nghiệp vụ' },
  { key: 'HO_TRO', ten: 'III. Hỗ trợ' },
  { key: 'NGOAI_DM', ten: 'Ngoài danh mục VTVL', chiHopDong: true },
]

const tongCT = (o?: OChiTieu) => (o?.nganSach ?? 0) + (o?.suNghiep ?? 0) + (o?.hd235 ?? 0)

/** Số chênh lệch: thừa đỏ, thiếu xanh, khớp xanh lá */
function Lech({ v }: { v: number | null }) {
  if (v == null) return <Text type="secondary">-</Text>
  const r = lamTron1(v)
  if (r === 0) return <span style={{ color: '#16a34a', fontWeight: 600 }}>0</span>
  return <b style={{ color: r > 0 ? MAU_THUA : MAU_THIEU }}>{r > 0 ? '+' : '-'}{fmt(Math.abs(r))}</b>
}

/**
 * Chỉ tiêu biên chế (chia nguồn ngân sách / sự nghiệp) và hợp đồng NĐ 235 giao theo 3 nhóm VTVL cho từng trường, từng năm học.
 * Phòng VHXH và quản trị giao; trường xem để đối chiếu với định mức và số có mặt.
 */
export default function ChiTieuBienCheCard({ donVi, namHoc, kq }: { donVi: DonVi; namHoc: string; kq: KetQuaDinhMuc }) {
  const { message } = App.useApp()
  const { currentUser, hasPermission, scopeDonViId } = useAuth()
  const coTheGiao = hasPermission('viTri', 'write') && !scopeDonViId
  const id = idQuyMo(donVi.id, namHoc)
  const daLuu = useDanhMucStore((s) => (s.chiTieuBienChes ?? []).find((x) => x.id === id))
  const tatCaLichSu = useDanhMucStore((s) => s.chiTieuLichSu)
  const luuChiTieu = useDanhMucStore((s) => s.luuChiTieu)
  const lichSu = useMemo(() => (tatCaLichSu ?? []).filter((l) => l.chiTieuId === id).sort((a, b) => b.thoiGian.localeCompare(a.thoiGian)), [tatCaLichSu, id])

  const [nhap, setNhap] = useState<ChiTieuBienChe['nhom']>(daLuu?.nhom ?? {})
  const [soQd, setSoQd] = useState(daLuu?.soQuyetDinh ?? '')
  const [ngayQd, setNgayQd] = useState<string | undefined>(daLuu?.ngayQuyetDinh)
  const [ghiChu, setGhiChu] = useState(daLuu?.ghiChu ?? '')
  const [moLichSu, setMoLichSu] = useState(false)
  // Máy khác vừa lưu: nạp lại khi chưa sửa gì
  const vanTay = (n: ChiTieuBienChe['nhom'], a?: string, b?: string, c?: string) => JSON.stringify([n, a ?? '', b ?? '', c ?? ''])
  const daDoi = vanTay(nhap, soQd, ngayQd, ghiChu) !== vanTay(daLuu?.nhom ?? {}, daLuu?.soQuyetDinh, daLuu?.ngayQuyetDinh, daLuu?.ghiChu)
  useEffect(() => {
    if (daDoi) return
    setNhap(daLuu?.nhom ?? {}); setSoQd(daLuu?.soQuyetDinh ?? ''); setNgayQd(daLuu?.ngayQuyetDinh); setGhiChu(daLuu?.ghiChu ?? '')
  }, [daLuu?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const dat = (nhom: NhomChiTieu, truong: keyof OChiTieu, v: number | null) =>
    setNhap((cu) => ({ ...cu, [nhom]: { ...cu[nhom], [truong]: v == null ? undefined : v } }))

  const luu = () => {
    luuChiTieu({
      id, donViId: donVi.id, namHoc, nhom: nhap,
      soQuyetDinh: soQd.trim() || undefined, ngayQuyetDinh: ngayQd, ghiChu: ghiChu.trim() || undefined,
      nguoiCapNhatId: currentUser?.id, nguoiCapNhat: currentUser?.fullName,
    })
    const tong = NHOM.reduce((s, n) => s + tongCT(nhap[n.key]), 0)
    logAction(currentUser?.id ?? 'system', currentUser?.fullName ?? 'Hệ thống', 'UPDATE', 'ChiTieuBienChe',
      { entityId: id, donViId: donVi.id, moTa: `Giao chỉ tiêu năm học ${namHoc} - ${donVi.ten}: tổng ${tong}${soQd ? ` (QĐ ${soQd})` : ''}` })
    message.success('Đã lưu chỉ tiêu')
  }

  const dmNhom = (k: NhomChiTieu) => {
    const t = kq.tongNhom.find((x) => x.nhom === k)
    return t?.apDungDinhMuc && kq.tongLop ? t.dinhMuc : null
  }
  const coMat = (k: NhomChiTieu) => kq.coMatNguon[k]
  type Dong = { key: string; ten: string; nhom?: NhomChiTieu; chiHopDong?: boolean }
  const data: Dong[] = [...NHOM.map((n) => ({ key: n.key, ten: n.ten, nhom: n.key, chiHopDong: n.chiHopDong })), { key: 'TONG', ten: 'Tổng toàn trường' }]
  const cong = (f: (k: NhomChiTieu) => number) => NHOM.reduce((s, n) => s + f(n.key), 0)
  const ct = (r: Dong, truong: keyof OChiTieu) => (r.nhom ? nhap[r.nhom]?.[truong] : cong((k) => nhap[k]?.[truong] ?? 0))
  const cm = (r: Dong, f: (o: ReturnType<typeof coMat>) => number) => (r.nhom ? f(coMat(r.nhom)) : cong((k) => f(coMat(k))))
  const daGiao = NHOM.some((n) => tongCT(nhap[n.key]) > 0)

  const oNhap = (r: Dong, truong: keyof OChiTieu) => {
    if (!r.nhom) return <b>{ct(r, truong) || 0}</b>
    if (r.chiHopDong && truong !== 'hd235') return <Text type="secondary">-</Text>
    const v = nhap[r.nhom]?.[truong]
    return coTheGiao
      ? <InputNumber size="small" min={0} value={v} onChange={(x) => dat(r.nhom!, truong, x)} style={{ width: 70 }} />
      : (v ?? <Text type="secondary">-</Text>)
  }

  const bienCheCm = (o: ReturnType<typeof coMat>) => o.nganSach + o.suNghiep + o.bcChuaRoNguon
  const coChuaRoNguon = cong((k) => coMat(k).bcChuaRoNguon) > 0

  return (
    <Card
      size="small"
      style={{ marginBottom: 16, borderColor: '#bfdbfe' }}
      title={<span>Chỉ tiêu biên chế, hợp đồng giao năm học {namHoc}</span>}
      extra={
        <Space wrap>
          {daLuu && <Text type="secondary" style={{ fontSize: 13 }}>Cập nhật {formatDatetime(daLuu.updatedAt)}{daLuu.nguoiCapNhat ? ` - ${daLuu.nguoiCapNhat}` : ''}</Text>}
          <Button size="small" icon={<HistoryOutlined />} onClick={() => setMoLichSu(true)} disabled={!lichSu.length}>Lịch sử giao ({lichSu.length})</Button>
          {coTheGiao && <Button size="small" type="primary" icon={<SaveOutlined />} onClick={luu} disabled={!daDoi}>Lưu chỉ tiêu</Button>}
        </Space>
      }
    >
      {!daGiao && (
        <Alert
          type="info" showIcon style={{ marginBottom: 10 }}
          title={coTheGiao ? 'Chưa giao chỉ tiêu năm học này - nhập số theo quyết định giao rồi bấm Lưu chỉ tiêu' : 'Phòng VHXH chưa giao chỉ tiêu năm học này'}
          description={(donVi.chiTieuBienCheNganSach || donVi.chiTieuBienCheSuNghiep || donVi.chiTieuHopDong || donVi.chiTieuCoNuoi)
            ? `Chỉ tiêu tổng đã giao trước đây (chưa chia nhóm): biên chế ngân sách ${donVi.chiTieuBienCheNganSach ?? 0}, sự nghiệp ${donVi.chiTieuBienCheSuNghiep ?? 0}${donVi.chiTieuCoNuoi ? `, cô nuôi ${donVi.chiTieuCoNuoi}` : ''}, hợp đồng ${donVi.chiTieuHopDong ?? 0}.`
            : undefined}
        />
      )}
      {coChuaRoNguon && (
        <Alert type="warning" showIcon style={{ marginBottom: 10 }} title={`${cong((k) => coMat(k).bcChuaRoNguon)} viên chức biên chế chưa khai nguồn kinh phí (ngân sách / sự nghiệp) - cột "Chưa rõ nguồn"; trường bổ sung trong hồ sơ`} />
      )}
      <Table<Dong>
        size="small" bordered pagination={false} rowKey="key" dataSource={data} scroll={{ x: 'max-content' }}
        rowClassName={(r) => (r.nhom ? '' : 'ct-tong')}
        columns={[
          { title: 'Nhóm vị trí việc làm', key: 'ten', width: 210, render: (_, r) => (r.nhom ? r.ten : <b>{r.ten}</b>) },
          {
            title: 'Định mức', key: 'dm', width: 80, align: 'center',
            render: (_, r) => (r.chiHopDong ? <Text type="secondary">-</Text> : r.nhom ? fmt(dmNhom(r.nhom)) : <b>{fmt(kq.tongLop ? kq.tongDinhMuc : null)}</b>),
          },
          {
            title: 'Chỉ tiêu giao',
            children: [
              { title: 'BC Ngân sách', key: 'ns', width: 92, align: 'center', render: (_, r) => oNhap(r, 'nganSach') },
              { title: 'BC sự nghiệp', key: 'sn', width: 92, align: 'center', render: (_, r) => oNhap(r, 'suNghiep') },
              {
                title: 'Biên chế', key: 'bc', width: 72, align: 'center',
                onCell: () => ({ style: { background: '#f8fafc' } }),
                render: (_, r) => (r.chiHopDong ? <Text type="secondary">-</Text> : <b>{(ct(r, 'nganSach') ?? 0) + (ct(r, 'suNghiep') ?? 0)}</b>),
              },
              { title: 'Hợp đồng NĐ 235', key: 'hd', width: 92, align: 'center', render: (_, r) => oNhap(r, 'hd235') },
              { title: 'Tổng', key: 'tct', width: 64, align: 'center', render: (_, r) => <b>{r.nhom ? tongCT(nhap[r.nhom]) : cong((k) => tongCT(nhap[k]))}</b> },
            ],
          },
          {
            title: 'Có mặt',
            children: [
              { title: 'BC Ngân sách', key: 'cns', width: 92, align: 'center', render: (_, r) => cm(r, (o) => o.nganSach) },
              { title: 'BC sự nghiệp', key: 'csn', width: 92, align: 'center', render: (_, r) => cm(r, (o) => o.suNghiep) },
              ...(coChuaRoNguon ? [{ title: 'Biên chế chưa rõ nguồn', key: 'ccr', width: 92, align: 'center' as const, render: (_: unknown, r: Dong) => cm(r, (o) => o.bcChuaRoNguon) }] : []),
              {
                title: 'Biên chế', key: 'cbc', width: 72, align: 'center',
                onCell: () => ({ style: { background: '#f8fafc' } }),
                render: (_, r) => <b>{cm(r, bienCheCm)}</b>,
              },
              { title: 'Hợp đồng NĐ 235', key: 'chd', width: 92, align: 'center', render: (_, r) => cm(r, (o) => o.hd235) },
              { title: 'Hợp đồng khác', key: 'chk', width: 84, align: 'center', render: (_, r) => cm(r, (o) => o.hdKhac) },
            ],
          },
          {
            title: 'So với chỉ tiêu',
            children: [
              {
                title: 'Biên chế', key: 'lbc', width: 80, align: 'center',
                render: (_, r) => (r.chiHopDong || !daGiao ? <Text type="secondary">-</Text>
                  : <Lech v={cm(r, bienCheCm) - ((ct(r, 'nganSach') ?? 0) + (ct(r, 'suNghiep') ?? 0))} />),
              },
              {
                title: 'Hợp đồng NĐ 235', key: 'lhd', width: 90, align: 'center',
                render: (_, r) => (!daGiao ? <Text type="secondary">-</Text> : <Lech v={cm(r, (o) => o.hd235) - (ct(r, 'hd235') ?? 0)} />),
              },
            ],
          },
        ]}
      />
      <Space wrap style={{ marginTop: 10 }} size={12}>
        <span>
          <Text type="secondary">Quyết định giao số </Text>
          {coTheGiao ? <Input size="small" value={soQd} onChange={(e) => setSoQd(e.target.value)} style={{ width: 160 }} placeholder="VD: 120/QĐ-UBND" /> : <b>{soQd || '-'}</b>}
        </span>
        <span>
          <Text type="secondary">ngày </Text>
          {coTheGiao
            ? <DatePicker size="small" format="DD/MM/YYYY" value={ngayQd ? dayjs(ngayQd) : null} onChange={(d) => setNgayQd(d ? d.format('YYYY-MM-DD') : undefined)} />
            : <b>{formatDate(ngayQd) || '-'}</b>}
        </span>
        <span style={{ flex: 1 }}>
          <Text type="secondary">Ghi chú </Text>
          {coTheGiao ? <Input size="small" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} style={{ width: 360 }} /> : <span>{ghiChu || '-'}</span>}
        </span>
      </Space>
      <div style={{ marginTop: 6 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          So với chỉ tiêu: có mặt trừ chỉ tiêu giao - thừa đỏ, thiếu xanh. Có mặt đếm theo vị trí của từng người
          (giáo viên ở nhóm II, nhân viên theo công việc cụ thể); hợp đồng NĐ 235 là hồ sơ có loại hình "Hợp đồng NĐ 235/2026".
        </Text>
      </div>
      <style>{'.ct-tong td { background: #eef2ff !important; font-weight: 600; }'}</style>

      <Drawer open={moLichSu} onClose={() => setMoLichSu(false)} title={`Lịch sử giao chỉ tiêu - ${donVi.ten} - ${namHoc}`} size="large">
        {lichSu.map((l) => (
          <Card key={l.id} size="small" style={{ marginBottom: 10 }}
            title={<Space wrap><span>{formatDatetime(l.thoiGian)}</span>{l.nguoiTen && <Tag>{l.nguoiTen}</Tag>}</Space>}
            extra={coTheGiao && (
              <Button size="small" onClick={() => {
                setNhap(l.noiDung.nhom); setSoQd(l.noiDung.soQuyetDinh ?? ''); setNgayQd(l.noiDung.ngayQuyetDinh); setGhiChu(l.noiDung.ghiChu ?? '')
                setMoLichSu(false); message.info('Đã nạp bản này - bấm Lưu chỉ tiêu để áp dụng')
              }}>Nạp lại bản này</Button>
            )}
          >
            {NHOM.map((n) => {
              const o = l.noiDung.nhom[n.key]
              return tongCT(o) ? (
                <div key={n.key}>{n.ten}: ngân sách {o?.nganSach ?? 0}, sự nghiệp {o?.suNghiep ?? 0}, hợp đồng NĐ 235 {o?.hd235 ?? 0}</div>
              ) : null
            })}
            {l.noiDung.soQuyetDinh && <Text type="secondary">QĐ {l.noiDung.soQuyetDinh}{l.noiDung.ngayQuyetDinh ? ` ngày ${formatDate(l.noiDung.ngayQuyetDinh)}` : ''}</Text>}
          </Card>
        ))}
      </Drawer>
    </Card>
  )
}
