import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Button, Tabs, Table, Typography, Space, Timeline, Result, Alert, Popconfirm, App } from 'antd'
import { EditOutlined, ArrowLeftOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { PhuCapVienChuc, HeSoLuong } from '@/types/luong'
import XuLyPhuCapTrungModal from '@/components/XuLyPhuCapTrungModal'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { CHUC_VU_LABELS, LOAI_LAO_DONG_LABELS, VTVL_LABELS, TRANG_THAI_CONG_TAC_LABELS, NGUON_KINH_PHI_LABELS, IS_BIEN_CHE, HINH_THUC_LUONG_LABELS, coPhuCapThamNien, nhanLuongTheoTien } from '@/types/vienChuc'
import type { TrangThaiCongTac } from '@/types/vienChuc'
import { LY_DO_LABELS } from '@/types/luong'
import { formatDate } from '@/utils/helpers'
import { CONG_VIEC_LABELS } from '@/utils/nhomViTri'
import { dangBaoLuuPccv, dangTinhTheoBaoLuu, tenHienThiLoaiPhuCap, TEN_PCCV_BAO_LUU } from '@/utils/baoLuuPccv'
import { chonBanDangHuong, nhomTheoLoai } from '@/utils/phuCapDangHuong'
import { useUserStore } from '@/store/userStore'

const { Title, Text } = Typography

const TRANG_THAI_COLORS: Record<TrangThaiCongTac, string> = {
  DANG_LAM_VIEC: 'green',
  CHUYEN_DEN: 'blue',
  CHUYEN_DI: 'orange',
  NGHI_HUU: 'purple',
  THOI_VIEC: 'default',
}

export default function VienChucDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission, scopeDonViId, laQuanTri, currentUser } = useAuth()
  const { message } = App.useApp()
  const [banGiu, setBanGiu] = useState<PhuCapVienChuc | null>(null)
  const getById = useVienChucStore((s) => s.getById)
  const updateVienChuc = useVienChucStore((s) => s.updateVienChuc)
  const vc = getById(id!)
  const donVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const allHeSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const allPhuCaps = useLuongStore((s) => s.phuCapVienChucs)
  const allLichSu = useLuongStore((s) => s.lichSuBienDongs)
  const heSoHistory = allHeSoLuongs.filter((h) => h.vienChucId === id).sort((a, b) => b.ngayHieuLuc.localeCompare(a.ngayHieuLuc))
  const activePhuCaps = allPhuCaps.filter((p) => p.vienChucId === id && p.isActive)
  const lichSu = allLichSu.filter((l) => l.vienChucId === id).sort((a, b) => b.ngayThayDoi.localeCompare(a.ngayThayDoi))
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const users = useUserStore((s) => s.users)
  // Mỗi loại một dòng đang hưởng; nếu dữ liệu còn bản trùng thì hiện đủ và chỉ rõ bản bảng lương đang dùng
  const pcTheoLoai = [...nhomTheoLoai(activePhuCaps, loaiPhuCaps).values()]
  const soLoaiTrung = pcTheoLoai.filter((a) => a.length > 1).length
  const dongDangHuong = pcTheoLoai.flatMap((a) => {
    const dangDung = chonBanDangHuong(a)!
    return [...a]
      .sort((x, y) => (y.ngayHieuLuc ?? '').localeCompare(x.ngayHieuLuc ?? ''))
      .map((p) => ({ ...p, trung: a.length > 1, dangDung: p.id === dangDung.id }))
  })
  const lichSuPhuCap = allPhuCaps
    .filter((p) => p.vienChucId === id && !p.isActive)
    .sort((a, b) => (b.ngayHieuLuc ?? '').localeCompare(a.ngayHieuLuc ?? ''))
  const nguonPhuCap = (createdBy?: string) =>
    createdBy === 'import' ? 'Nhập dữ liệu'
      : createdBy === 'system' ? 'Hệ thống'
      : users.find((u) => u.id === createdBy)?.fullName ?? 'Người dùng'
  const vtvls = useDanhMucStore((s) => s.vtvls)

  if (!vc) return <Result status="404" title="Không tìm thấy viên chức" extra={<Button onClick={() => navigate('/vien-chuc')}>Quay lại</Button>} />
  if (scopeDonViId && vc.donViId !== scopeDonViId) return <Result status="403" title="Không có quyền xem" />

  const donVi = donVis.find((d) => d.id === vc.donViId)
  const chucDanh = chucDanhs.find((c) => c.id === vc.chucDanhId)
  const activeHeSo = heSoHistory.find((h) => h.isActive)

  // Chuyển công tác trong phường: liên kết giữa hồ sơ ở trường đi và trường đến
  const hoSoLienKet = (hoSoId: string | undefined, huong: 'sang' | 'từ') => {
    const kia = hoSoId ? getById(hoSoId) : undefined
    if (!kia) return null
    const tenTruong = donVis.find((d) => d.id === kia.donViId)?.ten ?? kia.donViId
    const coTheXem = !scopeDonViId || kia.donViId === scopeDonViId
    return (
      <span>
        {' '}- {huong} {coTheXem ? <a onClick={() => navigate(`/vien-chuc/${kia.id}`)}>{tenTruong}</a> : tenTruong}
      </span>
    )
  }

  // ── Quản trị xử lý dữ liệu trùng / nhập sai (kế toán không còn quyền sửa phụ cấp, bậc lương đã nhập) ──
  const tenVc = `${vc.ho} ${vc.ten}`
  const ghiNhatKy = (action: 'UPDATE' | 'DELETE', entity: string, moTa: string) =>
    useLuongStore.getState().addNhatKy({
      userId: currentUser?.id ?? 'system',
      userFullName: currentUser?.fullName ?? 'Hệ thống',
      action, entity, entityId: vc.id, moTa,
      thoiGian: new Date().toISOString(),
      donViId: vc.donViId,
    })
  const ghiLichSu = (loai: 'LUONG' | 'PHU_CAP', truongThayDoi: string, giaTriCu: string, giaTriMoi: string) =>
    useLuongStore.getState().addLichSuBienDong({
      vienChucId: vc.id, loai, truongThayDoi, giaTriCu, giaTriMoi,
      ngayThayDoi: dayjs().format('YYYY-MM-DD'),
      nguoiThayDoiId: currentUser?.id ?? 'system',
    })
  const mucPhuCap = (r: Pick<PhuCapVienChuc, 'loaiPhuCapId' | 'giaTri'>) => {
    const lpc = loaiPhuCaps.find((l) => l.id === r.loaiPhuCapId)
    if (!lpc) return ''
    const giaTri = r.giaTri > 0 ? r.giaTri : lpc.giaTri
    if (lpc.loaiCongThuc === 'TIEN_MAT') return `${giaTri.toLocaleString()}đ`
    if (lpc.loaiCongThuc === 'HE_SO') return `+${giaTri}`
    return `${giaTri}%`
  }
  const moTaPhuCap = (p: PhuCapVienChuc) =>
    `${tenHienThiLoaiPhuCap(loaiPhuCaps.find((l) => l.id === p.loaiPhuCapId)) || p.loaiPhuCapId} ${mucPhuCap(p)} từ ${formatDate(p.ngayHieuLuc)} (${nguonPhuCap(p.createdBy)})`
  const banKhacCungLoai = banGiu
    ? (pcTheoLoai.find((a) => a.some((p) => p.id === banGiu.id)) ?? []).filter((p) => p.id !== banGiu.id)
    : []
  const xoaBanLichSuPhuCap = (p: PhuCapVienChuc) => {
    useLuongStore.getState().xoaPhuCap(p.id)
    ghiLichSu('PHU_CAP', 'Xoá bản lịch sử phụ cấp nhập sai', moTaPhuCap(p), '(đã xoá)')
    ghiNhatKy('DELETE', 'PhuCapVienChuc', `Xoá bản lịch sử phụ cấp nhập sai của ${tenVc}: ${moTaPhuCap(p)}`)
    message.success('Đã xoá bản ghi')
  }

  const moTaHeSo = (h: HeSoLuong) => `Bậc ${h.bac} - hệ số ${h.heSo} từ ${formatDate(h.ngayHieuLuc)}`
  const heSoDangApDung = heSoHistory.filter((h) => h.isActive)
  const giuHeSo = (h: HeSoLuong) => {
    const khac = heSoDangApDung.filter((x) => x.id !== h.id)
    for (const x of khac) useLuongStore.getState().deactivateHeSoLuong(x.id)
    updateVienChuc(vc.id, { heSoLuongHienTaiId: h.id }, currentUser?.id, currentUser?.fullName)
    ghiLichSu('LUONG', 'Xử lý bản ghi lương trùng', khac.map(moTaHeSo).join(' | '), `Giữ: ${moTaHeSo(h)} (các bản kia chuyển lịch sử)`)
    ghiNhatKy('UPDATE', 'HeSoLuong', `Xử lý bản ghi lương trùng của ${tenVc}: giữ ${moTaHeSo(h)}, chuyển lịch sử ${khac.map(moTaHeSo).join('; ')}`)
    message.success('Đã giữ bản ghi lương này')
  }
  const xoaHeSo = (h: HeSoLuong) => {
    useLuongStore.getState().xoaHeSoLuong(h.id)
    if (vc.heSoLuongHienTaiId === h.id) {
      const conLai = heSoDangApDung.find((x) => x.id !== h.id)
      updateVienChuc(vc.id, { heSoLuongHienTaiId: conLai?.id }, currentUser?.id, currentUser?.fullName)
    }
    ghiLichSu('LUONG', 'Xoá bản ghi lương nhập sai', moTaHeSo(h), '(đã xoá)')
    ghiNhatKy('DELETE', 'HeSoLuong', `Xoá bản ghi lương nhập sai của ${tenVc}: ${moTaHeSo(h)}`)
    message.success('Đã xoá bản ghi lương')
  }
  // Được xoá: bản lịch sử, hoặc bản đang áp dụng khi còn bản đang áp dụng khác (trùng)
  const coTheXoaHeSo = (h: HeSoLuong) => !h.isActive || heSoDangApDung.length > 1
  const cotQuanTriHeSo = laQuanTri && heSoHistory.length > 1 ? [{
    title: 'Quản trị', key: 'qt',
    render: (_: unknown, h: HeSoLuong) => (
      <Space size={4}>
        {h.isActive && heSoDangApDung.length > 1 && (
          <Popconfirm title="Giữ bản ghi lương này?" description="Các bản đang áp dụng khác chuyển sang lịch sử." okText="Giữ" cancelText="Huỷ" onConfirm={() => giuHeSo(h)}>
            <Button size="small" icon={<CheckOutlined />}>Giữ bản này</Button>
          </Popconfirm>
        )}
        {coTheXoaHeSo(h) && (
          <Popconfirm title="Xoá hẳn bản ghi lương này?" description={moTaHeSo(h)} okText="Xoá" okButtonProps={{ danger: true }} cancelText="Huỷ" onConfirm={() => xoaHeSo(h)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
      </Space>
    ),
  }] : []

  const heSoCols = [
    { title: 'Bậc', dataIndex: 'bac', key: 'bac', width: 60 },
    { title: 'Hệ số', dataIndex: 'heSo', key: 'heSo', width: 80 },
    { title: 'HS chênh lệch bảo lưu', dataIndex: 'heSoBaoLuu', key: 'baoLuu', width: 100, render: (v?: number) => v ?? '-' },
    { title: 'Ngày hiệu lực', dataIndex: 'ngayHieuLuc', key: 'nhl', render: (v: string) => formatDate(v) },
    { title: 'Ngày nâng tiếp', dataIndex: 'ngayNangLuongTiepTheo', key: 'nnt', render: (v: string) => formatDate(v) },
    { title: 'Lý do', dataIndex: 'lyDo', key: 'ld', render: (v: string) => LY_DO_LABELS[v as keyof typeof LY_DO_LABELS] ?? v },
    { title: 'Trạng thái', dataIndex: 'isActive', key: 'ts', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang áp dụng' : 'Lịch sử'}</Tag> },
    ...cotQuanTriHeSo,
  ]

  const phuCapCols = [
    { title: 'Loại phụ cấp', dataIndex: 'loaiPhuCapId', key: 'lpc', render: (id: string) => tenHienThiLoaiPhuCap(loaiPhuCaps.find((l) => l.id === id)) || id },
    { title: 'Tỷ lệ/Mức', key: 'tl', render: (_: unknown, r: PhuCapVienChuc) => mucPhuCap(r) },
  ]
  const cotNguon = { title: 'Nguồn', dataIndex: 'createdBy', key: 'ng', render: (v: string) => <Text type="secondary" style={{ fontSize: 13 }}>{nguonPhuCap(v)}</Text> }
  // PC chức vụ bảo lưu (sau sắp xếp): bảng lương lấy mức cao hơn giữa mức bảo lưu và PC chức vụ hiện tại
  const pcCvId = loaiPhuCaps.find((l) => l.ma === 'PC_CHUC_VU')?.id
  const pcCvHienTai = chonBanDangHuong(activePhuCaps.filter((p) => p.loaiPhuCapId === pcCvId))?.giaTri ?? 0
  const tinhTheoBaoLuu = dangTinhTheoBaoLuu(vc, pcCvHienTai)
  const tenChucVu = (ma?: string) => (ma ? CHUC_VU_LABELS[ma] ?? ma : 'không có chức vụ')
  const cotDangHuong = [
    ...phuCapCols,
    { title: 'Từ ngày', dataIndex: 'ngayHieuLuc', key: 'nhl', render: (v: string) => formatDate(v) },
    cotNguon,
    {
      title: '', key: 'tt',
      render: (_: unknown, r: { trung: boolean; dangDung: boolean; loaiPhuCapId: string }) =>
        r.loaiPhuCapId === pcCvId && tinhTheoBaoLuu ? <Tag>Không tính - đang hưởng mức bảo lưu</Tag>
          : !r.trung ? <Tag color="green">Đang hưởng</Tag>
          : r.dangDung ? <Tag color="orange">Đang tính lương</Tag>
          : <Tag color="red">Bản trùng</Tag>,
    },
    ...(laQuanTri && soLoaiTrung > 0 ? [{
      title: 'Quản trị', key: 'qt',
      render: (_: unknown, r: PhuCapVienChuc & { trung: boolean }) =>
        r.trung && <Button size="small" icon={<CheckOutlined />} onClick={() => setBanGiu(r)}>Giữ bản này</Button>,
    }] : []),
  ]
  const cotLichSu = [
    ...phuCapCols,
    { title: 'Từ ngày', dataIndex: 'ngayHieuLuc', key: 'nhl', render: (v: string) => formatDate(v) },
    { title: 'Đến ngày', dataIndex: 'ngayHetHan', key: 'nhh', render: (v?: string) => (v ? formatDate(v) : '-') },
    cotNguon,
    { title: 'Ghi chú', dataIndex: 'ghiChu', key: 'gc', render: (v?: string) => <Text type="secondary" style={{ fontSize: 13 }}>{v ?? ''}</Text> },
    ...(laQuanTri ? [{
      title: '', key: 'xoa',
      render: (_: unknown, p: PhuCapVienChuc) => (
        <Popconfirm title="Xoá hẳn bản lịch sử này?" description="Chỉ xoá bản nhập sai; giai đoạn hưởng có thật nên giữ lại." okText="Xoá" okButtonProps={{ danger: true }} cancelText="Huỷ" onConfirm={() => xoaBanLichSuPhuCap(p)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    }] : []),
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/vien-chuc')}>Quay lại</Button>
        {hasPermission('vienChuc', 'write') && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/vien-chuc/${vc.id}/edit`)}>Chỉnh sửa</Button>
        )}
      </Space>

      <Card title={<>
        <Tag color="blue">{vc.ma}</Tag> {vc.ho} {vc.ten}{' '}
        <Tag color={TRANG_THAI_COLORS[vc.trangThai ?? 'DANG_LAM_VIEC']}>{TRANG_THAI_CONG_TAC_LABELS[vc.trangThai ?? 'DANG_LAM_VIEC']}</Tag>
      </>}>
        <Tabs items={[
          {
            key: '1', label: 'Hồ sơ',
            children: (
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                <Descriptions.Item label="Họ và tên">{vc.ho} {vc.ten}</Descriptions.Item>
                <Descriptions.Item label="Ngày sinh">{formatDate(vc.ngaySinh)}</Descriptions.Item>
                <Descriptions.Item label="Giới tính">{vc.gioiTinh === 'NAM' ? 'Nam' : 'Nữ'}</Descriptions.Item>
                <Descriptions.Item label="CCCD">{vc.cccd ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Điện thoại">{vc.dienThoai ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Đơn vị">{donVi?.ten ?? vc.donViId}</Descriptions.Item>
                <Descriptions.Item label="Ngạch/hạng">{chucDanh?.ten ?? vc.chucDanhId}</Descriptions.Item>
                <Descriptions.Item label="Loại hình">{LOAI_LAO_DONG_LABELS[vc.loaiLaoDong]}</Descriptions.Item>
                {vc.trangThai === 'CHUYEN_DI' && (
                  <Descriptions.Item label="Chuyển đi">
                    {vc.ngayChuyenDi ? formatDate(vc.ngayChuyenDi) : '-'}
                    {hoSoLienKet(vc.chuyenSangHoSoId, 'sang')}
                  </Descriptions.Item>
                )}
                {vc.baoLuuPccv && (
                  <Descriptions.Item label={TEN_PCCV_BAO_LUU}>
                    {CHUC_VU_LABELS[vc.baoLuuPccv.chucVuCu] ?? vc.baoLuuPccv.chucVuCu} - hệ số {vc.baoLuuPccv.heSo}, đến {formatDate(vc.baoLuuPccv.denNgay)}{' '}
                    {dangBaoLuuPccv(vc) ? <Tag color="gold">Đang bảo lưu</Tag> : <Tag>Đã hết</Tag>}
                    <br /><Text type="secondary" style={{ fontSize: 13 }}>QĐ {vc.baoLuuPccv.soQuyetDinh} ngày {formatDate(vc.baoLuuPccv.ngayQuyetDinh)}</Text>
                  </Descriptions.Item>
                )}
                {vc.chuyenTuHoSoId && (
                  <Descriptions.Item label="Chuyển đến từ">{hoSoLienKet(vc.chuyenTuHoSoId, 'từ')}</Descriptions.Item>
                )}
                {IS_BIEN_CHE[vc.loaiLaoDong] && (
                  <Descriptions.Item label="Nguồn kinh phí">{vc.nguonKinhPhi ? NGUON_KINH_PHI_LABELS[vc.nguonKinhPhi] : '-'}</Descriptions.Item>
                )}
                <Descriptions.Item label="VTVL">{vc.vtvl ? (vtvls.find((x) => x.ma === vc.vtvl)?.ten ?? VTVL_LABELS[vc.vtvl] ?? vc.vtvl) : '-'}</Descriptions.Item>
                {vc.vtvl === 'NHAN_VIEN' && (
                  <Descriptions.Item label="Công việc cụ thể">{vc.congViec ? CONG_VIEC_LABELS[vc.congViec] : <Text type="warning">Chưa chọn</Text>}</Descriptions.Item>
                )}
                <Descriptions.Item label="Đảng viên">{vc.laDangVien ? 'Có' : 'Không'}</Descriptions.Item>
                <Descriptions.Item label="Ngày vào ngành">{formatDate(vc.ngayVaoNganh)}</Descriptions.Item>
                <Descriptions.Item label="Ngày vào đơn vị">{formatDate(vc.ngayVaoDonVi)}</Descriptions.Item>
                <Descriptions.Item label="Trình độ chuyên môn nghiệp vụ">{vc.trinhDoChuyenMon ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Nhiệm vụ chính">{vc.nhiemVuChinh ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Trình độ khác">{vc.trinhDoKhac ?? '-'}</Descriptions.Item>
                {coPhuCapThamNien(vc.vtvl) && (
                  <Descriptions.Item label="Mốc hưởng PCTN">{vc.mocHuongPctn ? formatDate(vc.mocHuongPctn) : '-'}</Descriptions.Item>
                )}
                {nhanLuongTheoTien(vc) && <>
                  <Descriptions.Item label="Hình thức nhận lương">{HINH_THUC_LUONG_LABELS.TIEN}</Descriptions.Item>
                  <Descriptions.Item label="Mức lương">{vc.mucLuongTien != null ? `${vc.mucLuongTien.toLocaleString('vi-VN')} đ/tháng` : '-'}</Descriptions.Item>
                </>}
                {activeHeSo && !nhanLuongTheoTien(vc) && <>
                  <Descriptions.Item label="Bậc lương hiện tại">Bậc {activeHeSo.bac} - Hệ số {activeHeSo.heSo}</Descriptions.Item>
                  <Descriptions.Item label="Ngày nâng lương tiếp theo">
                    <Text type={new Date(activeHeSo.ngayNangLuongTiepTheo) < new Date() ? 'danger' : undefined}>
                      {formatDate(activeHeSo.ngayNangLuongTiepTheo)}
                    </Text>
                  </Descriptions.Item>
                </>}
              </Descriptions>
            ),
          },
          {
            key: '2', label: `Lịch sử lương (${heSoHistory.length})`,
            children: <Table scroll={{ x: 'max-content' }} dataSource={heSoHistory} columns={heSoCols} rowKey="id" size="small" pagination={false} />,
          },
          {
            key: '3', label: <>Phụ cấp ({pcTheoLoai.length}){soLoaiTrung > 0 && <Tag color="red" style={{ marginInlineStart: 6 }}>trùng</Tag>}</>,
            children: (
              <>
                {soLoaiTrung > 0 && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 12 }}
                    title={`${soLoaiTrung} loại phụ cấp đang ghi trùng (nhiều bản cùng còn hiệu lực)`}
                    description={laQuanTri
                      ? 'Bảng lương đang dùng bản gắn nhãn "Đang tính lương" (ngày hiệu lực mới nhất). Đối chiếu quyết định, bấm "Giữ bản này" ở bản đúng; bản còn lại chuyển vào lịch sử hoặc xoá hẳn nếu nhập sai.'
                      : 'Bảng lương đang dùng bản gắn nhãn "Đang tính lương" (ngày hiệu lực mới nhất). Báo Quản trị hệ thống (hoặc Phòng VHXH) để chọn bản đúng và xoá bản nhập sai.'}
                  />
                )}
                {vc.baoLuuPccv && (
                  <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                    <Space wrap size={8} style={{ marginBottom: 4 }}>
                      <Text strong>{TEN_PCCV_BAO_LUU}</Text>
                      {!dangBaoLuuPccv(vc)
                        ? <Tag>Đã hết hạn</Tag>
                        : tinhTheoBaoLuu ? <Tag color="gold">Đang tính lương</Tag>
                        : <Tag color="red">Không có tác dụng - kiểm tra lại</Tag>}
                    </Space>
                    <div style={{ fontSize: 14 }}>
                      Chức vụ cũ: <b>{tenChucVu(vc.baoLuuPccv.chucVuCu)}</b> - hệ số bảo lưu <b>{String(vc.baoLuuPccv.heSo).replace('.', ',')}</b>,
                      từ {formatDate(vc.baoLuuPccv.ngayQuyetDinh)} đến {formatDate(vc.baoLuuPccv.denNgay)} (QĐ {vc.baoLuuPccv.soQuyetDinh}).
                      Chức vụ hiện tại: {tenChucVu(vc.chucVu)}, PC chức vụ hiện tại {String(pcCvHienTai).replace('.', ',')}.
                    </div>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {dangBaoLuuPccv(vc) && !tinhTheoBaoLuu
                        ? 'Mức bảo lưu không cao hơn PC chức vụ hiện tại nên không được tính. Dòng "PC chức vụ hiện tại" chỉ ghi mức theo chức vụ đang giữ; mức của chức vụ cũ ghi ở mục bảo lưu này.'
                        : 'Khoản này khác "Hệ số chênh lệch bảo lưu (lương)". Bảng lương lấy mức cao hơn giữa mức bảo lưu và PC chức vụ hiện tại; hết hạn thì tự về mức theo chức vụ hiện tại.'}
                    </Text>
                  </div>
                )}
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Đang hưởng</Text>
                <Table scroll={{ x: 'max-content' }} dataSource={dongDangHuong} columns={cotDangHuong} rowKey="id" size="small" pagination={false}
                  locale={{ emptyText: 'Không có phụ cấp đang hưởng' }} />
                {lichSuPhuCap.length > 0 && (
                  <>
                    <Text strong style={{ display: 'block', margin: '16px 0 6px' }}>Lịch sử ({lichSuPhuCap.length})</Text>
                    <Table scroll={{ x: 'max-content' }} dataSource={lichSuPhuCap} columns={cotLichSu} rowKey="id" size="small" pagination={false} />
                  </>
                )}
                <XuLyPhuCapTrungModal
                  giu={banGiu}
                  banKhac={banKhacCungLoai}
                  donViId={vc.donViId}
                  tenVienChuc={tenVc}
                  moTa={moTaPhuCap}
                  onClose={() => setBanGiu(null)}
                />
              </>
            ),
          },
          {
            key: '4', label: `Lịch sử biến động (${lichSu.length})`,
            children: (
              <Timeline items={lichSu.map((ls) => ({
                color: ls.loai === 'LUONG' ? 'blue' : ls.loai === 'CHUC_DANH' ? 'green' : 'gray',
                content: (
                  <div>
                    <Text strong>{ls.truongThayDoi}</Text>
                    <Text type="secondary"> - {formatDate(ls.ngayThayDoi)}</Text>
                    <div><Text type="secondary">Cũ: </Text>{ls.giaTriCu} → <Text type="secondary">Mới: </Text>{ls.giaTriMoi}</div>
                  </div>
                ),
              }))} />
            ),
          },
        ]} />
      </Card>
    </div>
  )
}
