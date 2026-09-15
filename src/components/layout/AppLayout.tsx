import { useState, useMemo } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Layout, Menu, Avatar, Dropdown, Badge, Space, Typography, Button, theme, Tooltip,
  Breadcrumb,
} from 'antd'
import {
  DashboardOutlined, TeamOutlined, FileTextOutlined,
  BarChartOutlined, SettingOutlined, LogoutOutlined, BellOutlined,
  UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ClockCircleOutlined,
  AuditOutlined, FundOutlined, TableOutlined, IdcardOutlined, ReadOutlined, SwapOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'
import { useSalaryAlerts } from '@/hooks/useSalaryAlerts'
import { ROLE_LABELS } from '@/types/auth'

const { Header, Sider, Content, Footer } = Layout
const { Text } = Typography

const FOOTER_TEXT = 'QLVC&LĐ phường Gia Viên | Đơn vị: Phòng Văn hóa - Xã hội phường Gia Viên'

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Tổng quan',
  '/vien-chuc': 'Hồ sơ viên chức',
  '/bang-tong-hop-luong': 'Bảng tổng hợp lương',
  '/vi-tri': 'Vị trí việc làm',
  '/de-xuat': 'Đề xuất điều chỉnh HSL - PCTN',
  '/chuyen-cong-tac': 'Chuyển công tác',
  '/du-bao': 'Dự báo nghỉ hưu',
  '/bao-cao': 'Báo cáo',
  '/admin/danh-muc': 'Danh mục hệ thống',
  '/admin/nguoi-dung': 'Tài khoản người dùng',
  '/admin/nhat-ky': 'Nhật ký thao tác',
  '/huong-dan': 'Hướng dẫn sử dụng',
  '/tai-khoan': 'Thông tin tài khoản',
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { currentUser, logout, scopeDonViId, hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const alerts = useSalaryAlerts(scopeDonViId, 90)

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
    hasPermission('vienChuc', 'read') && { key: '/vien-chuc', icon: <TeamOutlined />, label: 'Hồ sơ viên chức' },
    { key: '/bang-tong-hop-luong', icon: <TableOutlined />, label: 'Bảng tổng hợp lương' },
    hasPermission('viTri', 'read') && { key: '/vi-tri', icon: <FundOutlined />, label: 'Vị trí việc làm' },
    hasPermission('deXuat', 'read') && {
      key: '/de-xuat', icon: <FileTextOutlined />,
      label: 'Đề xuất điều chỉnh HSL - PCTN',
      title: 'Đề xuất điều chỉnh Hệ số lương - PCTN',
      style: { height: 'auto', lineHeight: '18px', whiteSpace: 'normal', paddingTop: 7, paddingBottom: 7 },
    },
    hasPermission('vienChuc', 'read') && { key: '/chuyen-cong-tac', icon: <SwapOutlined />, label: 'Chuyển công tác' },
    hasPermission('duBao', 'read') && { key: '/du-bao', icon: <ClockCircleOutlined />, label: 'Dự báo nghỉ hưu' },
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
    return path.split('/').slice(0, 2).join('/') || '/dashboard'
  }

  const breadcrumbTitle = useMemo(() => {
    const path = location.pathname
    for (const [key, label] of Object.entries(BREADCRUMB_MAP)) {
      if (path.startsWith(key)) return label
    }
    return 'Tổng quan'
  }, [location.pathname])

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
        {/* Logo area */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 16px', gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            GV
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap' }}>
                QLVC&amp;LĐ
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: '14px', whiteSpace: 'nowrap' }}>
                Phường Gia Viên
              </div>
            </div>
          )}
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
            <Badge count={alerts.length} size="small" offset={[-2, 2]}>
              <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} onClick={() => navigate('/de-xuat')} style={{ borderRadius: 8 }} />
            </Badge>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 8, transition: 'background 0.2s' }}>
                <Avatar
                  size={32}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  {currentUser?.fullName?.charAt(0) ?? 'U'}
                </Avatar>
                {currentUser && (
                  <div style={{ lineHeight: '16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{currentUser.fullName}</div>
                    <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{ROLE_LABELS[currentUser.role]}</div>
                  </div>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: 16, flex: 1, overflow: 'auto', minHeight: 0 }}>
          <div className="qlvc-content-fade">
            <Outlet />
          </div>
        </Content>
        <Footer style={{
          textAlign: 'center', padding: '8px 16px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 12, color: token.colorTextSecondary,
          background: '#fff',
        }}>
          {FOOTER_TEXT}
        </Footer>
      </Layout>
    </Layout>
  )
}
