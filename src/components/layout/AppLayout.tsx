import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Layout, Menu, Avatar, Dropdown, Badge, Space, Typography, Button, theme
} from 'antd'
import {
  DashboardOutlined, TeamOutlined, FileTextOutlined, DollarOutlined,
  BarChartOutlined, SettingOutlined, LogoutOutlined, BellOutlined,
  UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ClockCircleOutlined,
  AuditOutlined, FundOutlined, TableOutlined, IdcardOutlined, ReadOutlined, SwapOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'
import { useSalaryAlerts } from '@/hooks/useSalaryAlerts'
import { ROLE_LABELS } from '@/types/auth'

const { Header, Sider, Content, Footer } = Layout
const { Text } = Typography

const APP_NAME = 'QLVC&LĐ phường Gia Viên (các CSGD)'
const FOOTER_TEXT = `${APP_NAME} | Đơn vị: Phòng Văn hóa - Xã hội phường Gia Viên`

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { currentUser, logout, isAdmin, isCBTruong, scopeDonViId, hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const alerts = useSalaryAlerts(scopeDonViId, 90)

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
    hasPermission('vienChuc', 'read') && { key: '/vien-chuc', icon: <TeamOutlined />, label: 'Hồ sơ viên chức' },
    { key: '/bang-tong-hop-luong', icon: <TableOutlined />, label: 'Bảng tổng hợp lương' },
    hasPermission('viTri', 'read') && { key: '/vi-tri', icon: <FundOutlined />, label: 'Vị trí việc làm' },
    // Tạm ẩn nhóm "Lương & Phụ cấp" — theo dõi qua Đề xuất điều chỉnh HSL - PCTN & hồ sơ viên chức
    hasPermission('deXuat', 'read') && {
      key: '/de-xuat', icon: <FileTextOutlined />,
      label: 'Đề xuất điều chỉnh Hệ số lương - PCTN',
      title: 'Đề xuất điều chỉnh Hệ số lương - PCTN',
      style: { height: 'auto', lineHeight: '18px', whiteSpace: 'normal', paddingTop: 7, paddingBottom: 7 },
    },
    hasPermission('vienChuc', 'read') && { key: '/chuyen-cong-tac', icon: <SwapOutlined />, label: 'Chuyển công tác' },
    hasPermission('duBao', 'read') && { key: '/du-bao', icon: <ClockCircleOutlined />, label: 'Dự báo nghỉ hưu' },
    hasPermission('baoCao', 'read') && { key: '/bao-cao', icon: <BarChartOutlined />, label: 'Báo cáo' },
    isAdmin && {
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
        style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? 0 : '0 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          {!collapsed ? (
            <Space>
              <Avatar style={{ background: token.colorPrimary }} icon={<UserOutlined />} size="small" />
              <Text strong style={{ fontSize: 12, lineHeight: '16px' }}>QLVC&amp;LĐ Gia Viên</Text>
            </Space>
          ) : (
            <Avatar style={{ background: token.colorPrimary }} icon={<UserOutlined />} size="small" />
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={['admin-group']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header style={{ background: token.colorBgContainer, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${token.colorBorderSecondary}`, flexShrink: 0 }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space>
            <Button
              type="text"
              icon={<ReadOutlined />}
              onClick={() => navigate('/huong-dan')}
              title="Hướng dẫn sử dụng — xem và in"
            >
              <span className="hd-btn-label">Hướng dẫn sử dụng</span>
            </Button>
            <Badge count={alerts.length} size="small">
              <Button type="text" icon={<BellOutlined />} onClick={() => navigate('/de-xuat')} />
            </Badge>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
                {currentUser && (
                  <span style={{ fontSize: 13 }}>
                    {currentUser.fullName}
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                      ({ROLE_LABELS[currentUser.role]})
                    </Text>
                  </span>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: 16, flex: 1, overflow: 'auto', minHeight: 0 }}>
          <Outlet />
        </Content>
        <Footer style={{ textAlign: 'center', padding: '8px 16px', borderTop: `1px solid ${token.colorBorderSecondary}`, fontSize: 12, color: token.colorTextSecondary }}>
          {FOOTER_TEXT}
        </Footer>
      </Layout>
    </Layout>
  )
}
