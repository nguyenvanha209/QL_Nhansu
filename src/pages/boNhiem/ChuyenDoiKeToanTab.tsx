import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, App, Button, Card, Col, DatePicker, Input, InputNumber, Row, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileExcelOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/hooks/useAuth'
import { useChuyenDoiKeToan } from '@/hooks/useChuyenDoiKeToan'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { MUC_CHUYEN_DOI_KE_TOAN, moTaThoiGianLam } from '@/utils/chuyenDoiKeToan'
import type { MucChuyenDoiKeToan, TinhTrangKeToan } from '@/utils/chuyenDoiKeToan'
import { BANG_CHUAN, cotGiua, cotNgay, cotSTT, phanTrang } from '@/utils/cotBang'
import { exportToExcel } from '@/utils/exportExcel'
import { formatDate } from '@/utils/helpers'
import { soSanhTruong, thuTuTruong } from '@/utils/dinhMuc'
import { logAction } from '@/utils/auditLogger'

const { Text } = Typography

type BoLoc = 'CAN_NHAC' | 'TAT_CA' | MucChuyenDoiKeToan
type Nhap = { ngay?: string; soQuyetDinh?: string }

const O_LOC: { key: BoLoc; ten: string; mau: string }[] = [
  { key: 'QUA_TOI_DA', ten: 'Quá thời hạn tối đa', mau: MUC_CHUYEN_DOI_KE_TOAN.QUA_TOI_DA.mau },
  { key: 'DU_THOI_HAN', ten: 'Đủ thời hạn chuyển đổi', mau: MUC_CHUYEN_DOI_KE_TOAN.DU_THOI_HAN.mau },
  { key: 'SAP_DU', ten: 'Sắp đủ thời hạn', mau: MUC_CHUYEN_DOI_KE_TOAN.SAP_DU.mau },
  { key: 'CHUA_NHAP', ten: 'Chưa nhập mốc', mau: '#64748b' },
  { key: 'TAT_CA', ten: 'Tất cả kế toán', mau: '#2563eb' },
]

/**
 * Thẻ "Kế toán - chuyển đổi vị trí" của Theo dõi bổ nhiệm: các trường nhập mốc bổ nhiệm, phân công kế toán gần nhất;
 * phần mềm tính hạn tối thiểu / tối đa theo thời hạn định kỳ chuyển đổi và nhắc Phòng VHXH, Lãnh đạo, quản trị.
 */
export default function ChuyenDoiKeToanTab() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { currentUser, scopeDonViId, hasPermission, laQuanTri, isVHXH } = useAuth()
  const { tatCa, quyDinh } = useChuyenDoiKeToan(scopeDonViId)
  const donVis = useDanhMucStore((s) => s.donVis)
  const setQuyDinh = useDanhMucStore((s) => s.setQuyDinhKeToan)
  const tenDv = useMemo(() => new Map(donVis.map((d) => [d.id, d.ten])), [donVis])
  const thuTu = useMemo(() => thuTuTruong(donVis), [donVis])
  const suaDuoc = hasPermission('vienChuc', 'write')
  const suaQuyDinh = laQuanTri || isVHXH
  const [loc, setLoc] = useState<BoLoc>('CAN_NHAC')
  const [donViId, setDonViId] = useState<string>()
  const [nhap, setNhap] = useState<Record<string, Nhap>>({})
  const [qd, setQd] = useState(quyDinh)

  const trongTruong = tatCa.filter((t) => !donViId || t.vc.donViId === donViId)
    .sort((a, b) => (thuTu.get(a.vc.donViId) ?? 999) - (thuTu.get(b.vc.donViId) ?? 999))
  const khop = (t: TinhTrangKeToan, l: BoLoc) => (l === 'TAT_CA' ? true : l === 'CAN_NHAC' ? ['QUA_TOI_DA', 'DU_THOI_HAN', 'SAP_DU'].includes(t.muc) : t.muc === l)
  const ds = trongTruong.filter((t) => khop(t, loc))

  const giaTri = (t: TinhTrangKeToan): Nhap => nhap[t.vc.id] ?? { ngay: t.moc, soQuyetDinh: t.soQuyetDinh }
  const doi = (t: TinhTrangKeToan, patch: Nhap) => setNhap((cu) => ({ ...cu, [t.vc.id]: { ...giaTri(t), ...patch } }))
  const khacGoc = (t: TinhTrangKeToan) => {
    const n = nhap[t.vc.id]
    return !!n && ((n.ngay ?? '') !== (t.moc ?? '') || (n.soQuyetDinh ?? '') !== (t.soQuyetDinh ?? ''))
  }
  const soThayDoi = tatCa.filter(khacGoc).length

  const luu = () => {
    if (!currentUser) return
    const thay = tatCa.filter(khacGoc)
    if (!thay.length) { message.info('Chưa có thay đổi'); return }
    const thieu = thay.filter((t) => !nhap[t.vc.id]?.ngay)
    if (thieu.length) { message.warning(`${thieu.length} người chưa chọn mốc bổ nhiệm - chọn ngày hoặc bỏ thay đổi`); return }
    useVienChucStore.getState().capNhatNhieu(
      thay.map((t) => {
        const n = nhap[t.vc.id]!
        return { id: t.vc.id, patch: { boNhiemKeToan: { ngay: n.ngay!, soQuyetDinh: n.soQuyetDinh?.trim() || undefined, ghiChu: t.vc.boNhiemKeToan?.ghiChu } } }
      }),
      currentUser.id, currentUser.fullName,
      `Nhập mốc bổ nhiệm kế toán gần nhất (theo dõi chuyển đổi vị trí công tác) cho ${thay.length} người`,
      scopeDonViId ?? undefined,
    )
    setNhap({})
    message.success(`Đã lưu ${thay.length} người`)
  }

  const luuQuyDinh = () => {
    if (!currentUser) return
    if (qd.thangToiThieu < 1 || qd.thangToiDa < qd.thangToiThieu) { message.error('Thời hạn tối đa phải không nhỏ hơn thời hạn tối thiểu'); return }
    setQuyDinh(qd)
    logAction(currentUser.id, currentUser.fullName, 'UPDATE', 'DanhMuc', { moTa: `Cập nhật thời hạn định kỳ chuyển đổi vị trí kế toán: ${qd.thangToiThieu} - ${qd.thangToiDa} tháng, nhắc trước ${qd.thangNhacTruoc} tháng` })
    message.success('Đã lưu thời hạn')
  }

  const xuat = () => exportToExcel(ds.map((t, i) => ({
    'STT': i + 1,
    'Trường': tenDv.get(t.vc.donViId) ?? '',
    'Họ và tên': `${t.vc.ho} ${t.vc.ten}`,
    'Mốc bổ nhiệm, phân công kế toán gần nhất': formatDate(t.moc),
    'Số quyết định': t.soQuyetDinh ?? '',
    'Đã làm': moTaThoiGianLam(t.soThangDaLam),
    [`Đủ thời hạn tối thiểu (${quyDinh.thangToiThieu} tháng)`]: formatDate(t.ngayToiThieu),
    [`Hạn tối đa (${quyDinh.thangToiDa} tháng)`]: formatDate(t.ngayToiDa),
    'Tình trạng': MUC_CHUYEN_DOI_KE_TOAN[t.muc].ten,
    'Ngày nghỉ hưu': formatDate(t.ngayNghiHuu),
  })), 'KeToan-ChuyenDoiViTri', 'Kế toán')

  const columns: ColumnsType<TinhTrangKeToan> = [
    cotSTT<TinhTrangKeToan>(),
    ...(scopeDonViId ? [] : [{ title: 'Trường', key: 'dv', width: 200, render: (_: unknown, t: TinhTrangKeToan) => tenDv.get(t.vc.donViId) ?? '' }]),
    {
      title: 'Họ và tên', key: 'ht', width: 200, fixed: 'left',
      render: (_, t) => <a onClick={() => navigate(`/vien-chuc/${t.vc.id}`)}>{t.vc.ho} {t.vc.ten}</a>,
    },
    {
      title: 'Mốc bổ nhiệm, phân công kế toán gần nhất', key: 'moc', width: 190, align: 'center',
      render: (_, t) => (suaDuoc
        ? <DatePicker size="small" format="DD/MM/YYYY" placeholder="Chọn ngày" status={khacGoc(t) ? 'warning' : undefined} style={{ width: 130 }}
            value={giaTri(t).ngay ? dayjs(giaTri(t).ngay) : null} onChange={(v) => doi(t, { ngay: v ? v.format('YYYY-MM-DD') : undefined })} />
        : formatDate(t.moc) || <Text type="warning">Chưa nhập</Text>),
    },
    {
      title: 'Số quyết định', key: 'qd', width: 170,
      render: (_, t) => (suaDuoc
        ? <Input size="small" placeholder="Số QĐ (nếu có)" value={giaTri(t).soQuyetDinh} onChange={(e) => doi(t, { soQuyetDinh: e.target.value })} />
        : t.soQuyetDinh ?? ''),
    },
    cotGiua<TinhTrangKeToan>('Đã làm', 'dalam', 110, (t) => moTaThoiGianLam(t.soThangDaLam)),
    cotNgay<TinhTrangKeToan>(`Đủ thời hạn tối thiểu`, (t) => t.ngayToiThieu, { dam: true, width: 130 }),
    cotNgay<TinhTrangKeToan>('Hạn tối đa', (t) => t.ngayToiDa, { width: 115 }),
    cotGiua<TinhTrangKeToan>('Tình trạng', 'tt', 210, (t) => <Tag color={MUC_CHUYEN_DOI_KE_TOAN[t.muc].mau} style={{ marginInlineEnd: 0 }}>{MUC_CHUYEN_DOI_KE_TOAN[t.muc].ten}</Tag>),
    cotNgay<TinhTrangKeToan>('Ngày nghỉ hưu', (t) => t.ngayNghiHuu, { width: 115 }),
  ]

  return (
    <div>
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        title="Định kỳ chuyển đổi vị trí công tác của kế toán các trường"
        description={<>
          Căn cứ: Điều 24 Luật Phòng, chống tham nhũng; Chương V Nghị định 59/2019/NĐ-CP; Điều 9 Nghị định 184/2026/NĐ-CP (sửa đổi NĐ 59/2019).
          Kế toán trường nhập <b>mốc bổ nhiệm, phân công kế toán gần nhất</b>; phần mềm tính hạn và nhắc khi sắp đủ, đã đủ hoặc quá thời hạn chuyển đổi.
          Danh sách gồm người có <i>Công việc cụ thể = Kế toán</i> ở hồ sơ nhân sự (mốc cũng nhập được ở hồ sơ).
        </>}
      />
      <Card size="small" style={{ marginBottom: 12 }} title="Thời hạn định kỳ áp dụng">
        <Space wrap>
          <Text>Tối thiểu</Text>
          <InputNumber min={1} max={120} value={qd.thangToiThieu} disabled={!suaQuyDinh} onChange={(v) => setQd({ ...qd, thangToiThieu: v ?? qd.thangToiThieu })} addonAfter="tháng" />
          <Text>Tối đa</Text>
          <InputNumber min={1} max={120} value={qd.thangToiDa} disabled={!suaQuyDinh} onChange={(v) => setQd({ ...qd, thangToiDa: v ?? qd.thangToiDa })} addonAfter="tháng" />
          <Text>Nhắc trước</Text>
          <InputNumber min={0} max={24} value={qd.thangNhacTruoc} disabled={!suaQuyDinh} onChange={(v) => setQd({ ...qd, thangNhacTruoc: v ?? 0 })} addonAfter="tháng" />
          {suaQuyDinh && <Button icon={<SaveOutlined />} disabled={JSON.stringify(qd) === JSON.stringify(quyDinh)} onClick={luuQuyDinh}>Lưu thời hạn</Button>}
          <Text type="secondary" style={{ fontSize: 13 }}>Đặt theo văn bản đang áp dụng (VD từ đủ 03 đến 05 năm = 36 - 60 tháng); Phòng VHXH, quản trị sửa được.</Text>
        </Space>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {O_LOC.map((o) => {
          const so = trongTruong.filter((t) => khop(t, o.key)).length
          const chon = loc === o.key
          return (
            <Col key={o.key} flex="1 1 150px">
              <Card size="small" hoverable onClick={() => setLoc(chon ? 'CAN_NHAC' : o.key)}
                style={{ borderTop: `3px solid ${o.mau}`, background: chon ? '#f0f5ff' : undefined, outline: chon ? `2px solid ${o.mau}` : undefined }}>
                <div style={{ fontSize: 14, color: '#475569' }}>{o.ten}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: so ? o.mau : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{so}</div>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Space wrap style={{ marginBottom: 8 }}>
        {!scopeDonViId && (
          <Select allowClear placeholder="Tất cả trường" style={{ width: 260 }} value={donViId} onChange={setDonViId} showSearch optionFilterProp="label"
            options={donVis.filter((d) => d.active).sort(soSanhTruong).map((d) => ({ value: d.id, label: d.ten }))} />
        )}
        {suaDuoc && <Button type="primary" icon={<SaveOutlined />} disabled={!soThayDoi} onClick={luu}>Lưu {soThayDoi ? `${soThayDoi} thay đổi` : ''}</Button>}
        {soThayDoi > 0 && <Button onClick={() => setNhap({})}>Bỏ thay đổi</Button>}
        <Button icon={<FileExcelOutlined />} onClick={xuat} disabled={!ds.length}>Xuất Excel</Button>
        <Text type="secondary">{loc === 'CAN_NHAC' ? 'Cần nhắc (quá hạn, đủ thời hạn, sắp đủ)' : O_LOC.find((o) => o.key === loc)?.ten} - {ds.length} người</Text>
        {loc !== 'CAN_NHAC' && <a onClick={() => setLoc('CAN_NHAC')}>Về danh sách cần nhắc</a>}
      </Space>
      <Table<TinhTrangKeToan> {...BANG_CHUAN} rowKey={(t) => t.vc.id} dataSource={ds} columns={columns} pagination={phanTrang('người', 50)}
        locale={{ emptyText: loc === 'CAN_NHAC' ? 'Không có kế toán nào đến mốc nhắc' : 'Không có' }} />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
        Nghỉ hưu trước khi đủ thời hạn thì không cần chuyển đổi. Trường hợp chưa chuyển đổi theo quy định (đang bị kiểm tra, xử lý kỷ luật, điều trị bệnh hiểm nghèo, đi học dài hạn…) do cấp có thẩm quyền xem xét - ghi chú ở hồ sơ.
      </Text>
    </div>
  )
}
