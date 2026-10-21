import { useMemo, useState } from 'react'
import { Alert, Button, Col, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import { FileExcelOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { CHUC_VU_LABELS, LOAI_LAO_DONG_LABELS, isDangCongTac } from '@/types/vienChuc'
import type { VienChuc } from '@/types/vienChuc'
import { calcRetirementDate, calcPensionStartDate, moTaTuoiNghiHuu } from '@/utils/retirement'
import { formatDate } from '@/utils/helpers'
import { exportToExcel } from '@/utils/exportExcel'
import type { ColumnsType } from 'antd/es/table'
import { BANG_CHUAN, phanTrang, cotSTT, cotHoTen, cotNgay, cotChu, cotGiua, tenGioiTinh } from '@/utils/cotBang'
import { laBienChe, soSanhTruong } from '@/utils/dinhMuc'

const { Text } = Typography

const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

type Dong = VienChuc & {
  donViTen: string; chucDanhTen: string; maNgach: string
  ngayNghiHuu: string; ngayHuongHuu: string; tuoiNghiHuu: string; namNghiHuu: number
}

/**
 * Viên chức đã nghỉ hưu, để Phòng VHXH theo dõi:
 * - hồ sơ đã chuyển trạng thái "Nghỉ hưu";
 * - người đã qua thời điểm nghỉ hưu (theo NĐ 135/2020) mà hồ sơ vẫn ghi đang công tác - cần trường cập nhật
 *   trạng thái, hoặc có quyết định kéo dài thời gian công tác.
 */
export default function DaNghiHuu() {
  const navigate = useNavigate()
  const { scopeDonViId, hasPermission } = useAuth()
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const [che, setChe] = useState<'DA_NGHI' | 'QUA_TUOI'>('DA_NGHI')
  const [nam, setNam] = useState<number | undefined>()
  const [filterDonVi, setFilterDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active).sort(soSanhTruong), [allDonVis])

  const { daNghi, quaTuoi } = useMemo(() => {
    const homNay = toDateStr(new Date())
    const dvTheoId = new Map(allDonVis.map((d) => [d.id, d]))
    const cdTheoId = new Map(chucDanhs.map((c) => [c.id, c]))
    const lam = (vc: VienChuc): Dong => {
      const gt = vc.gioiTinh as 'NAM' | 'NU'
      const ngayNghiHuu = vc.ngaySinh ? toDateStr(calcRetirementDate(vc.ngaySinh, gt)) : ''
      return {
        ...vc,
        donViTen: dvTheoId.get(vc.donViId)?.ten ?? '',
        chucDanhTen: cdTheoId.get(vc.chucDanhId)?.ten ?? '',
        maNgach: cdTheoId.get(vc.chucDanhId)?.ma ?? '',
        ngayNghiHuu,
        ngayHuongHuu: vc.ngaySinh ? toDateStr(calcPensionStartDate(vc.ngaySinh, gt)) : '',
        tuoiNghiHuu: vc.ngaySinh ? moTaTuoiNghiHuu(vc.ngaySinh, gt) : '',
        namNghiHuu: Number(ngayNghiHuu.slice(0, 4)) || 0,
      }
    }
    // Chỉ viên chức biên chế (viên chức, tập sự)
    const trongPhamVi = allVienChucs.filter((v) => v.active && laBienChe(v) && (!scopeDonViId || v.donViId === scopeDonViId))
    const daNghi = trongPhamVi.filter((v) => v.trangThai === 'NGHI_HUU').map(lam)
    // Đã qua thời điểm nghỉ hưu nhưng hồ sơ vẫn đang công tác
    const quaTuoi = trongPhamVi.filter((v) => isDangCongTac(v) && v.ngaySinh).map(lam).filter((r) => r.ngayNghiHuu && r.ngayNghiHuu <= homNay)
    const sx = (a: Dong, b: Dong) => b.ngayNghiHuu.localeCompare(a.ngayNghiHuu) || a.donViTen.localeCompare(b.donViTen, 'vi')
    return { daNghi: daNghi.sort(sx), quaTuoi: quaTuoi.sort(sx) }
  }, [allVienChucs, allDonVis, chucDanhs, scopeDonViId])

  const cacNam = useMemo(() => [...new Set(daNghi.map((r) => r.namNghiHuu).filter(Boolean))].sort((a, b) => b - a), [daNghi])
  const namNay = new Date().getFullYear()
  const goc = che === 'DA_NGHI' ? daNghi : quaTuoi
  const data = useMemo(
    () => goc.filter((r) => (!filterDonVi || r.donViId === filterDonVi) && (che !== 'DA_NGHI' || !nam || r.namNghiHuu === nam)),
    [goc, filterDonVi, nam, che],
  )

  const xemHoSo = hasPermission('vienChuc', 'read')
  // Theo quy chuẩn bảng (utils/cotBang): mọi cột có độ rộng, Họ và tên ghim trái
  const columns: ColumnsType<Dong> = [
    cotSTT<Dong>(),
    cotHoTen<Dong>(xemHoSo ? (r) => navigate(`/vien-chuc/${r.id}`) : undefined),
    cotNgay<Dong>('Ngày sinh', (r) => r.ngaySinh),
    cotGiua<Dong>('Giới tính', 'gt', 75, (r) => tenGioiTinh(r.gioiTinh)),
    cotChu<Dong>('Đơn vị', (r) => r.donViTen, 190, { sapXep: true }),
    cotChu<Dong>('Chức danh', (r) => r.chucDanhTen, 220, { phu: (r) => r.maNgach }),
    cotGiua<Dong>('Chức vụ', 'cv', 100, (r) => (r.chucVu ? CHUC_VU_LABELS[r.chucVu] ?? r.chucVu : '')),
    cotChu<Dong>('Loại hình', (r) => LOAI_LAO_DONG_LABELS[r.loaiLaoDong] ?? r.loaiLaoDong, 160),
    cotGiua<Dong>('Tuổi nghỉ hưu', 'tnh', 130, (r) => <Text type="secondary">{r.tuoiNghiHuu}</Text>),
    cotNgay<Dong>('Thời điểm nghỉ hưu', (r) => r.ngayNghiHuu, { dam: true, width: 115, sapXep: true }),
    cotNgay<Dong>('Hưởng chế độ hưu trí từ', (r) => r.ngayHuongHuu, { width: 115 }),
    che === 'QUA_TUOI'
      ? cotGiua<Dong>('Tình trạng', 'tt', 150, () => <Tag color="volcano" style={{ marginInlineEnd: 0 }}>Hồ sơ còn ghi đang công tác</Tag>)
      : cotChu<Dong>('Ghi chú', (r) => r.ghiChu, 200),
  ]

  const xuat = () => exportToExcel(
    data.map((r, i) => ({
      STT: i + 1, 'Họ và tên': `${r.ho} ${r.ten}`, 'Ngày sinh': formatDate(r.ngaySinh), 'Giới tính': r.gioiTinh === 'NAM' ? 'Nam' : 'Nữ',
      'Đơn vị': r.donViTen, 'Chức danh': r.chucDanhTen, 'Mã ngạch': r.maNgach, 'Chức vụ': r.chucVu ? CHUC_VU_LABELS[r.chucVu] ?? r.chucVu : '',
      'Loại hình': LOAI_LAO_DONG_LABELS[r.loaiLaoDong] ?? r.loaiLaoDong, 'Tuổi nghỉ hưu': r.tuoiNghiHuu,
      'Thời điểm nghỉ hưu': formatDate(r.ngayNghiHuu), 'Hưởng chế độ hưu trí từ': formatDate(r.ngayHuongHuu), 'Ghi chú': r.ghiChu ?? '',
    })),
    che === 'DA_NGHI' ? 'Vien_chuc_da_nghi_huu' : 'Da_den_tuoi_chua_cap_nhat',
    che === 'DA_NGHI' ? 'Đã nghỉ hưu' : 'Đến tuổi chưa cập nhật',
    [che === 'DA_NGHI'
      ? `DANH SÁCH VIÊN CHỨC ĐÃ NGHỈ HƯU${nam ? ` NĂM ${nam}` : ''}`
      : 'DANH SÁCH ĐÃ ĐẾN TUỔI NGHỈ HƯU NHƯNG HỒ SƠ CÒN GHI ĐANG CÔNG TÁC'],
  )

  const demTheoTruong = (ds: Dong[]) => (filterDonVi ? ds.filter((r) => r.donViId === filterDonVi) : ds)
  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Statistic title="Đã nghỉ hưu (hồ sơ đã chuyển trạng thái)" value={demTheoTruong(daNghi).length} prefix={<TeamOutlined />} /></Col>
        <Col xs={24} sm={8}><Statistic title={`Nghỉ hưu trong năm ${namNay}`} value={demTheoTruong(daNghi).filter((r) => r.namNghiHuu === namNay).length} /></Col>
        <Col xs={24} sm={8}>
          <Statistic
            title="Đã đến tuổi, hồ sơ chưa chuyển trạng thái"
            value={demTheoTruong(quaTuoi).length}
            prefix={<WarningOutlined />}
            styles={{ content: { color: demTheoTruong(quaTuoi).length ? '#d4380d' : '#52c41a' } }}
          />
        </Col>
      </Row>

      {quaTuoi.length > 0 && che === 'DA_NGHI' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`${quaTuoi.length} người đã qua thời điểm nghỉ hưu nhưng hồ sơ vẫn ghi đang công tác`}
          description="Trường mở hồ sơ, chuyển trạng thái sang Nghỉ hưu (kèm ghi chú số quyết định); trường hợp có quyết định kéo dài thời gian công tác thì ghi chú vào hồ sơ."
          action={<Button size="small" onClick={() => setChe('QUA_TUOI')}>Xem danh sách</Button>}
        />
      )}

      <Space wrap style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        <Space wrap>
          <Segmented<'DA_NGHI' | 'QUA_TUOI'>
            value={che}
            onChange={setChe}
            options={[
              { value: 'DA_NGHI', label: `Đã nghỉ hưu (${demTheoTruong(daNghi).length})` },
              { value: 'QUA_TUOI', label: `Đến tuổi, chưa cập nhật hồ sơ (${demTheoTruong(quaTuoi).length})` },
            ]}
          />
          {che === 'DA_NGHI' && (
            <Select
              placeholder="Tất cả các năm"
              allowClear
              value={nam}
              onChange={setNam}
              style={{ width: 160 }}
              options={cacNam.map((n) => ({ value: n, label: `Nghỉ hưu năm ${n} (${demTheoTruong(daNghi).filter((r) => r.namNghiHuu === n).length})` }))}
            />
          )}
          {!scopeDonViId && (
            <Select placeholder="Lọc đơn vị" style={{ width: 220 }} value={filterDonVi} onChange={setFilterDonVi} allowClear showSearch optionFilterProp="label" options={donVis.map((d) => ({ value: d.id, label: d.ten }))} />
          )}
        </Space>
        <Button icon={<FileExcelOutlined />} onClick={xuat} disabled={!data.length}>Xuất Excel</Button>
      </Space>

      <Table<Dong>
        {...BANG_CHUAN}
        dataSource={data}
        columns={columns}
        rowKey="id"
        pagination={phanTrang('người')}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
        Thời điểm nghỉ hưu tính theo tuổi nghỉ hưu tại Nghị định 135/2020/NĐ-CP (theo tháng, năm sinh); hưởng chế độ hưu trí từ ngày đầu tháng liền kề.
        Danh sách "Đã nghỉ hưu" lấy các hồ sơ có trạng thái công tác là Nghỉ hưu.
      </Text>
    </>
  )
}
