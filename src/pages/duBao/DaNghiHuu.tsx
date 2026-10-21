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
import { laBienChe } from '@/utils/dinhMuc'

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
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])

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
  const columns = [
    { title: 'STT', key: 'stt', width: 55, align: 'center' as const, render: (_: unknown, __: Dong, i: number) => i + 1 },
    {
      title: 'Họ và tên', key: 'hoTen', width: 190,
      render: (_: unknown, r: Dong) => (xemHoSo ? <a onClick={() => navigate(`/vien-chuc/${r.id}`)}>{r.ho} {r.ten}</a> : `${r.ho} ${r.ten}`),
      sorter: (a: Dong, b: Dong) => a.ten.localeCompare(b.ten, 'vi') || a.ho.localeCompare(b.ho, 'vi'),
    },
    { title: 'Ngày sinh', dataIndex: 'ngaySinh', key: 'ns', width: 105, render: (v: string) => formatDate(v) },
    { title: 'Giới tính', dataIndex: 'gioiTinh', key: 'gt', width: 75, render: (v: string) => (v === 'NAM' ? 'Nam' : 'Nữ') },
    {
      title: 'Đơn vị', dataIndex: 'donViTen', key: 'dv', width: 200, ellipsis: true,
      sorter: (a: Dong, b: Dong) => a.donViTen.localeCompare(b.donViTen, 'vi'),
    },
    { title: 'Chức danh', key: 'cd', width: 210, ellipsis: true, render: (_: unknown, r: Dong) => <span>{r.chucDanhTen}{r.maNgach && <Text type="secondary" style={{ fontSize: 12 }}> ({r.maNgach})</Text>}</span> },
    { title: 'Chức vụ', key: 'cv', width: 110, render: (_: unknown, r: Dong) => (r.chucVu ? CHUC_VU_LABELS[r.chucVu] ?? r.chucVu : '') },
    { title: 'Loại hình', key: 'lh', width: 150, render: (_: unknown, r: Dong) => LOAI_LAO_DONG_LABELS[r.loaiLaoDong] ?? r.loaiLaoDong },
    { title: 'Tuổi nghỉ hưu', dataIndex: 'tuoiNghiHuu', key: 'tnh', width: 130, render: (v: string) => <Text type="secondary">{v}</Text> },
    {
      title: 'Thời điểm nghỉ hưu', dataIndex: 'ngayNghiHuu', key: 'nnh', width: 125,
      render: (v: string) => <Text strong>{formatDate(v)}</Text>,
      sorter: (a: Dong, b: Dong) => a.ngayNghiHuu.localeCompare(b.ngayNghiHuu),
    },
    { title: 'Hưởng chế độ hưu trí từ', dataIndex: 'ngayHuongHuu', key: 'nhh', width: 125, render: (v: string) => formatDate(v) },
    ...(che === 'QUA_TUOI' ? [{
      title: 'Tình trạng', key: 'tt', width: 190,
      render: () => <Tag color="volcano">Đã qua tuổi, hồ sơ còn đang công tác</Tag>,
    }] : [{ title: 'Ghi chú', dataIndex: 'ghiChu', key: 'gc', width: 200, ellipsis: true }]),
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
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20, showTotal: (t) => `Tổng ${t} người` }}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
        Thời điểm nghỉ hưu tính theo tuổi nghỉ hưu tại Nghị định 135/2020/NĐ-CP (theo tháng, năm sinh); hưởng chế độ hưu trí từ ngày đầu tháng liền kề.
        Danh sách "Đã nghỉ hưu" lấy các hồ sơ có trạng thái công tác là Nghỉ hưu.
      </Text>
    </>
  )
}
