import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Tag, Typography } from 'antd'
import {
  WarningOutlined, ClockCircleOutlined, AuditOutlined, FileTextOutlined, NotificationOutlined,
  SafetyCertificateOutlined, SolutionOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { usePhamVi } from '@/hooks/usePhamVi'
import { useAuth } from '@/hooks/useAuth'
import { useSalaryAlerts } from '@/hooks/useSalaryAlerts'
import { useDeXuatCanXuLy } from '@/hooks/useDeXuatCanXuLy'
import { useThongBaoMoi } from '@/hooks/useThongBaoMoi'
import { useBoNhiem } from '@/hooks/useBoNhiem'
import { useChuyenDoiKeToan } from '@/hooks/useChuyenDoiKeToan'
import { useVienChucStore } from '@/store/vienChucStore'
import { isDangCongTac } from '@/types/vienChuc'
import { LOAI_HO_SO_NANG_LUONG } from '@/types/deXuat'
import { KHOI_DON_VI } from '@/types/donVi'

interface Viec {
  key: string
  icon: ReactNode
  mau: 'red' | 'orange' | 'blue'
  noiDung: string
  so: number
  den: string
  nut: string
}

const MAU_ICON: Record<Viec['mau'], string> = { red: '#dc2626', orange: '#d97706', blue: '#2563eb' }

/**
 * Việc cần làm theo vai trò, đặt đầu trang Tổng quan: mỗi dòng là một loại việc tồn đọng trong phạm vi tài khoản
 * (trường mình hoặc toàn phường), bấm nút là tới đúng trang xử lý. Thứ tự: việc gấp / chờ chính mình xử lý trước.
 */
export default function ViecCanLam() {
  const navigate = useNavigate()
  const { scopeDonViId, hasPermission } = useAuth()
  const { trongPhamVi, khoi } = usePhamVi()
  const tatCaCanhBao = useSalaryAlerts(scopeDonViId, 90)
  const alerts = useMemo(() => tatCaCanhBao.filter((a) => trongPhamVi(a.donViId)), [tatCaCanhBao, trongPhamVi])
  const soNangLuongCho = useDeXuatCanXuLy(LOAI_HO_SO_NANG_LUONG)
  const soDeXuatCho = useDeXuatCanXuLy()
  const soThongBaoMoi = useThongBaoMoi()
  const boNhiemTatCa = useBoNhiem(scopeDonViId)
  const keToanTatCa = useChuyenDoiKeToan(scopeDonViId)
  const boNhiem = useMemo(() => ({
    canNhac: boNhiemTatCa.canNhac.filter((t) => trongPhamVi(t.vc.donViId)),
    chuaNhap: boNhiemTatCa.chuaNhap.filter((t) => trongPhamVi(t.vc.donViId)),
  }), [boNhiemTatCa, trongPhamVi])
  const keToan = useMemo(() => ({
    canNhac: keToanTatCa.canNhac.filter((t) => trongPhamVi(t.vc.donViId)),
    chuaNhap: keToanTatCa.chuaNhap.filter((t) => trongPhamVi(t.vc.donViId)),
  }), [keToanTatCa, trongPhamVi])
  const vienChucs = useVienChucStore((s) => s.vienChucs)

  const coXemHoSo = hasPermission('vienChuc', 'read')
  const coLapPhieu = hasPermission('deXuat', 'write')

  const soChuaKhaiBhxh = useMemo(
    () => (coXemHoSo
      ? vienChucs.filter((v) => v.active && isDangCongTac(v) && trongPhamVi(v.donViId) && !v.batDauBhxhGd && !v.khongThamGiaBhxh).length
      : 0),
    [vienChucs, trongPhamVi, coXemHoSo],
  )

  const viecs = useMemo<Viec[]>(() => {
    const quaHan = alerts.filter((a) => a.daysLeft < 0).length
    const sapDen = alerts.length - quaHan
    const ds: Viec[] = [
      { key: 'cho-nang-luong', icon: <AuditOutlined />, mau: 'red', so: soNangLuongCho, noiDung: khoi && khoi !== 'TRUONG_HOC' ? 'hồ sơ nâng lương chờ bạn xử lý' : 'hồ sơ nâng lương, PCTN chờ bạn xử lý', den: '/ho-so-nang-luong', nut: 'Xử lý' },
      { key: 'cho-dieu-chinh', icon: <FileTextOutlined />, mau: 'red', so: soDeXuatCho, noiDung: 'phiếu điều chỉnh lương chờ bạn xử lý', den: '/de-xuat', nut: 'Xử lý' },
      { key: 'qua-han', icon: <WarningOutlined />, mau: 'red', so: quaHan, noiDung: 'người đã quá hạn nâng bậc lương', den: '/ho-so-nang-luong?loai=NANG_BAC', nut: coLapPhieu ? 'Lập phiếu' : 'Xem' },
      { key: 'sap-den', icon: <ClockCircleOutlined />, mau: 'orange', so: sapDen, noiDung: 'người đến kỳ nâng bậc trong 90 ngày tới', den: '/ho-so-nang-luong?loai=NANG_BAC', nut: 'Xem' },
      { key: 'thong-bao', icon: <NotificationOutlined />, mau: 'blue', so: soThongBaoMoi, noiDung: 'thông báo kết quả nâng lương mới', den: '/thong-bao-ket-qua', nut: 'Xem' },
      { key: 'bo-nhiem', icon: <SolutionOutlined />, mau: 'orange', so: coXemHoSo ? boNhiem.canNhac.length : 0, noiDung: 'cán bộ quản lý sắp hoặc đã hết nhiệm kỳ', den: '/bo-nhiem', nut: 'Xem' },
      { key: 'ke-toan', icon: <SolutionOutlined />, mau: 'orange', so: coXemHoSo ? keToan.canNhac.length : 0, noiDung: 'kế toán đến hạn chuyển đổi vị trí', den: '/bo-nhiem?the=ke-toan', nut: 'Xem' },
      { key: 'bhxh', icon: <SafetyCertificateOutlined />, mau: 'blue', so: soChuaKhaiBhxh, noiDung: 'người chưa khai tháng bắt đầu đóng BHXH', den: '/vien-chuc/bhxh', nut: 'Khai bổ sung' },
      { key: 'qd-bo-nhiem', icon: <SolutionOutlined />, mau: 'blue', so: coXemHoSo ? boNhiem.chuaNhap.length : 0, noiDung: 'CBQL chưa nhập quyết định bổ nhiệm', den: '/bo-nhiem', nut: 'Nhập' },
      { key: 'moc-ke-toan', icon: <SolutionOutlined />, mau: 'blue', so: coXemHoSo ? keToan.chuaNhap.length : 0, noiDung: 'kế toán chưa nhập mốc bổ nhiệm', den: '/bo-nhiem?the=ke-toan', nut: 'Nhập mốc' },
    ]
    return ds.filter((v) => v.so > 0)
  }, [khoi, alerts, soNangLuongCho, soDeXuatCho, soThongBaoMoi, boNhiem, keToan, soChuaKhaiBhxh, coXemHoSo, coLapPhieu])

  return (
    <Card
      title="Việc cần làm"
      extra={<Typography.Text type="secondary" style={{ fontSize: 13 }}>{scopeDonViId ? 'Trong đơn vị của bạn' : khoi ? KHOI_DON_VI.find((k) => k.key === khoi)?.ten : 'Toàn phường'}</Typography.Text>}
      className="viec-can-lam"
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: 0 } }}
    >
      {viecs.length === 0 ? (
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 10, color: '#16a34a' }}>
          <CheckCircleOutlined style={{ fontSize: 18 }} />
          <span>Không có việc tồn đọng</span>
        </div>
      ) : (
        // Hai cột trên màn hình rộng (một cột trên màn hình hẹp) để khối gọn, phần số liệu bên dưới lên gần hơn
        <div className="viec-can-lam-luoi">
        {viecs.map((v) => (
          <div key={v.key} className="viec-can-lam-dong">
            <span style={{ color: MAU_ICON[v.mau], fontSize: 17, display: 'flex' }}>{v.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <Tag color={v.mau} style={{ marginInlineEnd: 8, fontWeight: 600 }}>{v.so.toLocaleString('vi-VN')}</Tag>
              {v.noiDung}
            </span>
            <Button size="small" onClick={() => navigate(v.den)}>{v.nut}</Button>
          </div>
        ))}
        </div>
      )}
    </Card>
  )
}
