import { useState, useMemo, Suspense } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Layout, Menu, Avatar, Dropdown, Badge, Space, Typography, Button, theme, Tooltip,
  Breadcrumb, Spin,
} from 'antd'
import {
  DashboardOutlined, TeamOutlined, FileTextOutlined,
  BarChartOutlined, SettingOutlined, LogoutOutlined, BellOutlined,
  UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ClockCircleOutlined,
  AuditOutlined, TableOutlined, IdcardOutlined, ReadOutlined, SwapOutlined, FileSearchOutlined, CalculatorOutlined, NotificationOutlined,
  SolutionOutlined, WarningOutlined, BankOutlined, RiseOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useBoNhiem } from '@/hooks/useBoNhiem'
import { useAuth } from '@/hooks/useAuth'
import { useSalaryAlerts } from '@/hooks/useSalaryAlerts'
import { ROLE_LABELS } from '@/types/auth'
import ChiBaoDongBo from './ChiBaoDongBo'
import { useThongBaoMoi } from '@/hooks/useThongBaoMoi'
import { useDeXuatCanXuLy, useDeXuatDangXuLy } from '@/hooks/useDeXuatCanXuLy'
import { useDeXuatStore } from '@/store/deXuatStore'
import { LOAI_HO_SO_NANG_LUONG, TEN_CHUC_NANG_NANG_LUONG, laHoSoNangLuong } from '@/types/deXuat'
import type { LoaiDeXuat } from '@/types/deXuat'

const { Header, Sider, Content, Footer } = Layout
const { Text } = Typography

const FOOTER_TEXT = 'QLVC&LĐ phường Gia Viên | Đơn vị: Phòng Văn hóa - Xã hội phường Gia Viên'

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Tổng quan',
  '/vien-chuc/bhxh': 'Bổ sung thông tin đóng BHXH',
  '/vien-chuc': 'Hồ sơ nhân sự',
  '/bang-tong-hop-luong': 'Bảng tổng hợp lương',
  '/luong/he-so': 'Hệ số lương',
  '/luong/ra-soat': 'Rà soát ngạch - bậc - hệ số',
  '/luong/phu-cap': 'Phụ cấp',
  '/quy-mo': 'Cơ cấu VTVL và định mức VC',
  '/de-xuat': 'Đề xuất điều chỉnh hệ số lương - phụ cấp',
  '/chuyen-cong-tac': 'Chuyển công tác',
  '/thong-bao-ket-qua': 'Thông báo kết quả nâng lương, phụ cấp thâm niên',
  '/bo-nhiem': 'Theo dõi bổ nhiệm',
  '/du-bao': 'Dự báo nghỉ hưu',
  '/bao-cao': 'Báo cáo',
  '/admin/danh-muc': 'Danh mục hệ thống',
  '/admin/nguoi-dung': 'Tài khoản người dùng',
  '/admin/nhat-ky': 'Nhật ký thao tác',
  '/huong-dan': 'Hướng dẫn sử dụng',
  '/thong-tin-truong': 'Thông tin trường',
  '/ho-so-nang-luong': 'Lập hồ sơ nâng lương - phụ cấp thâm niên',
  '/nang-truoc-han': 'Lập hồ sơ nâng lương - phụ cấp thâm niên',
  '/tai-khoan': 'Thông tin tài khoản',
}

/**
 * Tên mục menu kèm số nhỏ ĐẶT NGAY SAU CHỮ (không dùng Badge góc trên: tên dài xuống dòng thì số bị đẩy khuất):
 * đỏ = việc chờ chính bạn xử lý; xanh = tổng phiếu các trường đang trong quy trình (VHXH, Lãnh đạo, quản trị).
 */
function NhanMenu({ ten, soCho = 0, soTong = 0, mau }: { ten: string; soCho?: number; soTong?: number; mau?: string }) {
  const so = (n: number, nen: string, tieuDe: string) => (
    <span title={tieuDe} style={{ display: 'inline-block', minWidth: 18, height: 18, lineHeight: '18px', padding: '0 5px', marginLeft: 5, borderRadius: 9, background: nen, color: '#fff', fontSize: 11.5, fontWeight: 600, textAlign: 'center', verticalAlign: 'middle' }}>{n}</span>
  )
  return (
    <span style={{ color: mau ?? 'inherit' }}>
      {ten}
      {soCho > 0 && so(soCho, '#ef4444', `${soCho} việc chờ bạn xử lý`)}
      {soTong > 0 && so(soTong, '#0ea5e9', `${soTong} phiếu các trường đang trong quy trình (đã lập, chưa phê duyệt xong)`)}
    </span>
  )
}
const nhanTitle = (ten: string, soCho: number, soTong: number) =>
  [ten, soCho ? `${soCho} chờ bạn xử lý` : '', soTong ? `${soTong} phiếu các trường đang trong quy trình` : ''].filter(Boolean).join(' - ')

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { currentUser, logout, scopeDonViId, hasPermission } = useAuth()
  const soThongBaoMoi = useThongBaoMoi()
  const soDeXuatCho = useDeXuatCanXuLy()
  const soNangLuongCho = useDeXuatCanXuLy(LOAI_HO_SO_NANG_LUONG)
  const soNangLuongTong = useDeXuatDangXuLy(LOAI_HO_SO_NANG_LUONG)
  const soDeXuatTong = useDeXuatDangXuLy()
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const alerts = useSalaryAlerts(scopeDonViId, 90)
  const boNhiem = useBoNhiem(scopeDonViId)
  const coXemBoNhiem = hasPermission('vienChuc', 'read')
  const soBoNhiem = coXemBoNhiem ? boNhiem.canNhac.length : 0

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
    hasPermission('vienChuc', 'read') && { key: '/vien-chuc', icon: <TeamOutlined />, label: 'Hồ sơ nhân sự' },
    hasPermission('vienChuc', 'read') && { key: '/vien-chuc/bhxh', icon: <SafetyCertificateOutlined />, label: 'Bổ sung thông tin đóng BHXH', style: { height: 'auto', lineHeight: '18px', whiteSpace: 'normal', paddingTop: 7, paddingBottom: 7 } },
    hasPermission('luong', 'read') && { key: '/bang-tong-hop-luong', icon: <TableOutlined />, label: 'Bảng tổng hợp lương' },
    hasPermission('vienChuc', 'read') && { key: '/luong/ra-soat', icon: <FileSearchOutlined />, label: 'Rà soát ngạch - bậc' },
    hasPermission('quyMo', 'read') && { key: '/quy-mo', icon: <CalculatorOutlined />, label: 'Cơ cấu VTVL và định mức VC' },
    hasPermission('deXuat', 'read') && {
      key: '/ho-so-nang-luong', icon: <RiseOutlined />, className: 'menu-noi-bat',
      label: <NhanMenu ten={TEN_CHUC_NANG_NANG_LUONG} soCho={soNangLuongCho} soTong={soNangLuongTong} />,
      title: nhanTitle(TEN_CHUC_NANG_NANG_LUONG, soNangLuongCho, soNangLuongTong),
      style: { height: 'auto', lineHeight: '18px', whiteSpace: 'normal', paddingTop: 7, paddingBottom: 7 },
    },
    hasPermission('deXuat', 'read') && {
      key: '/thong-bao-ket-qua', icon: <NotificationOutlined />, className: 'menu-noi-bat',
      label: <NhanMenu ten="Thông báo kết quả nâng lương, phụ cấp thâm niên" soCho={soThongBaoMoi} />,
      title: 'Thông báo kết quả nâng lương, phụ cấp thâm niên',
      style: { height: 'auto', lineHeight: '18px', whiteSpace: 'normal', paddingTop: 7, paddingBottom: 7 },
    },
    hasPermission('vienChuc', 'read') && { key: '/chuyen-cong-tac', icon: <SwapOutlined />, label: 'Chuyển công tác' },
    hasPermission('vienChuc', 'read') && {
      key: '/bo-nhiem', icon: <SolutionOutlined />,
      label: <NhanMenu ten="Theo dõi bổ nhiệm" soCho={boNhiem.canNhac.length} />,
      title: 'Theo dõi bổ nhiệm cán bộ quản lý',
      style: { height: 'auto', lineHeight: '18px', whiteSpace: 'normal', paddingTop: 7, paddingBottom: 7 },
    },
    hasPermission('duBao', 'read') && { key: '/du-bao', icon: <ClockCircleOutlined />, label: 'Dự báo nghỉ hưu' },
    hasPermission('deXuat', 'read') && {
      key: '/de-xuat', icon: <FileTextOutlined />, className: 'menu-vang',
      label: <NhanMenu ten="Đề xuất điều chỉnh hệ số lương - phụ cấp" soCho={soDeXuatCho} soTong={soDeXuatTong} mau="#facc15" />,
      title: nhanTitle('Đề xuất điều chỉnh hệ số lương - phụ cấp', soDeXuatCho, soDeXuatTong),
      style: { height: 'auto', lineHeight: '18px', whiteSpace: 'normal', paddingTop: 7, paddingBottom: 7 },
    },
    hasPermission('baoCao', 'read') && { key: '/bao-cao', icon: <BarChartOutlined />, label: 'Báo cáo' },
    hasPermission('admin', 'admin') && {
      key: 'admin-group', icon: <SettingOutlined />, label: 'Quản trị',
      children: [
        { key: '/admin/danh-muc', label: 'Danh mục hệ thống' },
        { key: '/admin/nguoi-dung', label: 'Tài khoản người dùng' },
        { key: '/admin/nhat-ky', icon: <AuditOutlined />, label: 'Nhật ký thao tác' },
      ],
    },
  ].filter(Boolean) as any[]

  const getSelectedKey = () => {
    const path = location.pathname
    if (path.startsWith('/luong')) return path
    if (path.startsWith('/admin')) return path
    if (path === '/vien-chuc/bhxh') return path
    // Hồ sơ nâng lương - PCTN: phiếu mở ở /de-xuat/:id hoặc /nang-truoc-han/:id vẫn sáng mục của nó
    if (path.startsWith('/nang-truoc-han')) return '/ho-so-nang-luong'
    const m = path.match(/^\/de-xuat\/([^/]+)/)
    const dx = m ? useDeXuatStore.getState().deXuats.find((d) => d.id === m[1]) : undefined
    if (dx && laHoSoNangLuong(dx.loai)) return '/ho-so-nang-luong'
    if (path.startsWith('/de-xuat/new') && laHoSoNangLuong((new URLSearchParams(location.search).get('loai') ?? '') as LoaiDeXuat)) return '/ho-so-nang-luong'
    return path.split('/').slice(0, 2).join('/') || '/dashboard'
  }

  const breadcrumbTitle = useMemo(() => {
    const path = location.pathname
    const chon = getSelectedKey()
    if (chon === '/ho-so-nang-luong') return BREADCRUMB_MAP[chon]
    for (const [key, label] of Object.entries(BREADCRUMB_MAP)) {
      if (path.startsWith(key)) return label
    }
    return 'Tổng quan'
  }, [location.pathname, location.search])

  const userMenu = {
    items: [
      { key: 'info', label: <Text type="secondary">{currentUser?.fullName}</Text>, disabled: true },
      { type: 'divider' as const },
      { key: 'tai-khoan', icon: <IdcardOutlined />, label: 'Thông tin tài khoản' },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') { logout(); navigate('/login') }
      if (key === 'tai-khoan') navigate('/tai-khoan')
    },
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={240}
        collapsedWidth={64}
        className="qlvc-sidebar"
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
      >
        {/* Logo phường - hiện ở mọi trang (thanh menu dùng chung) */}
        <div
          onClick={() => navigate('/dashboard')}
          title="Quản lý nhân sự lao động tiền lương - Phường Gia Viên"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: collapsed ? '12px 0' : '16px 0 14px', cursor: 'pointer',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}${collapsed ? 'apple-touch-icon.png' : 'logo-phuong.png'}`}
            alt="Logo Phường Gia Viên"
            width={collapsed ? 40 : 120}
            height={collapsed ? 40 : 120}
            style={{
              display: 'block', borderRadius: '50%', background: '#fff', padding: collapsed ? 1 : 3,
              boxShadow: '0 4px 16px rgba(15,23,42,0.3)', transition: 'width .2s, height .2s',
            }}
          />
        </div>

        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={['admin-group']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8 }}
        />

        {/* Collapse button at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '8px',
          display: 'flex', justifyContent: 'center',
        }}>
          <Tooltip title={collapsed ? 'Mở rộng' : 'Thu gọn'} placement="right">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ color: 'rgba(255,255,255,0.65)', width: '100%' }}
            />
          </Tooltip>
        </div>
      </Sider>

      <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header style={{
          background: '#fff', padding: '0 20px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0, height: 56,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <Breadcrumb
            items={[
              { title: <DashboardOutlined style={{ fontSize: 14 }} /> },
              { title: <span style={{ fontWeight: 500 }}>{breadcrumbTitle}</span> },
            ]}
            style={{ fontSize: 14 }}
          />
          <Space size={8}>
            <ChiBaoDongBo />
            {hasPermission('quyMo', 'read') && (
              <Tooltip title="Thông tin chung và quy mô trường lớp từng năm học (căn cứ hạng trường, phụ cấp chức vụ, định mức)">
                <Button
                  type={location.pathname === '/thong-tin-truong' ? 'primary' : 'text'}
                  ghost={location.pathname === '/thong-tin-truong'}
                  icon={<BankOutlined />}
                  onClick={() => navigate('/thong-tin-truong')}
                  style={{ borderRadius: 8 }}
                >
                  <span className="hd-btn-label">Thông tin trường</span>
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Hướng dẫn sử dụng">
              <Button
                type="text"
                icon={<ReadOutlined />}
                onClick={() => navigate('/huong-dan')}
                style={{ borderRadius: 8 }}
              >
                <span className="hd-btn-label">Hướng dẫn</span>
              </Button>
            </Tooltip>
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              menu={{
                items: [
                  { key: '/ho-so-nang-luong?loai=NANG_BAC', icon: <WarningOutlined />, label: `Sắp đến kỳ nâng lương: ${alerts.length} người` },
                  ...(coXemBoNhiem ? [{ key: '/bo-nhiem', icon: <SolutionOutlined />, label: `Sắp hết nhiệm kỳ bổ nhiệm: ${soBoNhiem} người` }] : []),
                ],
                onClick: ({ key }) => navigate(key),
              }}
            >
              <Badge count={alerts.length + soBoNhiem} size="small" offset={[-2, 2]}>
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} style={{ borderRadius: 8 }} aria-label="Nhắc việc" />
              </Badge>
            </Dropdown>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 8, transition: 'background 0.2s' }}>
                <Avatar
                  size={32}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  {currentUser?.fullName?.charAt(0) ?? 'U'}
                </Avatar>
                {currentUser && (
                  <div style={{ lineHeight: '16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{currentUser.fullName}</div>
                    <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{ROLE_LABELS[currentUser.role]}</div>
                  </div>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: 16, flex: 1, overflow: 'auto', minHeight: 0 }}>
          <div className="qlvc-content-fade">
            {/* Trang tải theo nhu cầu: trong lúc tải mã trang vẫn giữ menu, đầu trang */}
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>}>
              <Outlet />
            </Suspense>
          </div>
        </Content>
        <Footer style={{
          textAlign: 'center', padding: '8px 16px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 13, color: token.colorTextSecondary,
          background: '#fff',
        }}>
          {FOOTER_TEXT}
        </Footer>
      </Layout>
    </Layout>
  )
}
