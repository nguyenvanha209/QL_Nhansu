import { useState, useMemo, useEffect, Suspense } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Layout, Menu, Avatar, Dropdown, Badge, Space, Typography, Button, theme, Tooltip,
  Breadcrumb, Spin, Select,
} from 'antd'
import {
  DashboardOutlined, TeamOutlined, FileTextOutlined,
  BarChartOutlined, SettingOutlined, LogoutOutlined, BellOutlined,
  UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ClockCircleOutlined,
  AuditOutlined, TableOutlined, IdcardOutlined, ReadOutlined, SwapOutlined, FileSearchOutlined, CalculatorOutlined, NotificationOutlined,
  SolutionOutlined, WarningOutlined, BankOutlined, RiseOutlined, SafetyCertificateOutlined,
  SearchOutlined, AppstoreOutlined,
} from '@ant-design/icons'
import TimNhanh from './TimNhanh'
import type { MucTimNhanh } from './TimNhanh'
import { useBoNhiem } from '@/hooks/useBoNhiem'
import { useChuyenDoiKeToan } from '@/hooks/useChuyenDoiKeToan'
import { useAuth } from '@/hooks/useAuth'
import { usePhamVi } from '@/hooks/usePhamVi'
import { useKhoiStore } from '@/store/khoiStore'
import { KHOI_DON_VI } from '@/types/donVi'
import type { KhoiDonVi } from '@/types/donVi'
import { useSalaryAlerts } from '@/hooks/useSalaryAlerts'
import { ROLE_LABELS } from '@/types/auth'
import ChiBaoDongBo from './ChiBaoDongBo'
import { useThongBaoMoi } from '@/hooks/useThongBaoMoi'
import { useDeXuatCanXuLy, useDeXuatDangXuLy } from '@/hooks/useDeXuatCanXuLy'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useTruyLinhStore } from '@/store/truyLinhStore'
import { LOAI_HO_SO_NANG_LUONG, TEN_CHUC_NANG_NANG_LUONG, TEN_CHUC_NANG_DE_XUAT, laHoSoNangLuong } from '@/types/deXuat'
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
  '/truy-linh': 'Truy lĩnh nâng lương, phụ cấp thâm niên',
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
 * Tên mục menu (ngắn, một dòng) kèm số nhỏ dồn về bên phải:
 * đỏ = việc chờ chính bạn xử lý; xanh = tổng phiếu các trường đang trong quy trình (VHXH, Lãnh đạo, quản trị).
 * Tên đầy đủ của chức năng hiện ở tiêu đề trang và khi rê chuột.
 */
function NhanMenu({ ten, soCho = 0, soTong = 0 }: { ten: string; soCho?: number; soTong?: number }) {
  const so = (n: number, nen: string, tieuDe: string) => (
    <span title={tieuDe} style={{ display: 'inline-block', minWidth: 18, height: 18, lineHeight: '18px', padding: '0 5px', borderRadius: 9, background: nen, color: '#fff', fontSize: 11.5, fontWeight: 600, textAlign: 'center' }}>{n}</span>
  )
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ten}</span>
      {soCho > 0 && so(soCho, '#ef4444', `${soCho} việc chờ bạn xử lý`)}
      {soTong > 0 && so(soTong, '#0ea5e9', `${soTong} phiếu các đơn vị đang trong quy trình (đã lập, chưa phê duyệt xong)`)}
    </span>
  )
}
const nhanTitle = (ten: string, soCho: number, soTong: number) =>
  [ten, soCho ? `${soCho} chờ bạn xử lý` : '', soTong ? `${soTong} phiếu các đơn vị đang trong quy trình` : ''].filter(Boolean).join(' - ')

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { currentUser, logout, scopeDonViId, hasPermission } = useAuth()
  const { khoi } = usePhamVi()
  const datKhoi = useKhoiStore((s) => s.datKhoi)
  // Tài khoản của phòng chuyên môn, ĐVSN: ẩn các chức năng riêng của trường (quy mô, định mức, thông tin trường)
  const laDonViTruong = !scopeDonViId || khoi === 'TRUONG_HOC'
  // Truy lĩnh: Phòng VHXH thấy số bảng chờ duyệt; đơn vị thấy số bảng bị trả lại
  const bangTruyLinh = useTruyLinhStore((s) => s.bangs)
  const soTruyLinhCho = bangTruyLinh.filter((b) => (scopeDonViId
    ? b.donViId === scopeDonViId && b.trangThai === 'TRA_LAI'
    : b.trangThai === 'CHO_DUYET' && (currentUser?.role === 'CB_VH_XH' || currentUser?.role === 'ADMIN'))).length
  const coChucNangTruong = (q: boolean) => q && laDonViTruong
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
  const keToan = useChuyenDoiKeToan(scopeDonViId)
  const coXemBoNhiem = hasPermission('vienChuc', 'read')
  const soKeToan = coXemBoNhiem ? keToan.canNhac.length : 0
  const soBoNhiem = coXemBoNhiem ? boNhiem.canNhac.length + soKeToan : 0

  // Menu chia nhóm theo nghiệp vụ, tên mục ngắn một dòng; tên đầy đủ ở tiêu đề trang (BREADCRUMB_MAP) và khi rê chuột
  const nhom = (label: string, children: unknown[]) => {
    const c = children.filter(Boolean)
    return c.length ? { type: 'group' as const, label, children: c } : null
  }
  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
    nhom('Nhân sự', [
      hasPermission('vienChuc', 'read') && { key: '/vien-chuc', icon: <TeamOutlined />, label: 'Hồ sơ nhân sự' },
      hasPermission('vienChuc', 'read') && { key: '/vien-chuc/bhxh', icon: <SafetyCertificateOutlined />, label: 'Thông tin BHXH', title: 'Bổ sung thông tin đóng BHXH' },
      hasPermission('vienChuc', 'read') && { key: '/chuyen-cong-tac', icon: <SwapOutlined />, label: 'Chuyển công tác' },
    ]),
    nhom('Lương và chế độ', [
      hasPermission('luong', 'read') && { key: '/bang-tong-hop-luong', icon: <TableOutlined />, label: 'Bảng tổng hợp lương' },
      hasPermission('vienChuc', 'read') && { key: '/luong/ra-soat', icon: <FileSearchOutlined />, label: 'Rà soát ngạch - bậc' },
      coChucNangTruong(hasPermission('quyMo', 'read')) && { key: '/quy-mo', icon: <CalculatorOutlined />, label: 'Cơ cấu VTVL, định mức', title: 'Cơ cấu vị trí việc làm và định mức viên chức' },
    ]),
    nhom('Hồ sơ trình duyệt', [
      hasPermission('deXuat', 'read') && {
        key: '/ho-so-nang-luong', icon: <RiseOutlined />,
        label: <NhanMenu ten={laDonViTruong ? 'Nâng lương, PCTN' : 'Nâng lương'} soCho={soNangLuongCho} soTong={soNangLuongTong} />,
        title: nhanTitle(TEN_CHUC_NANG_NANG_LUONG, soNangLuongCho, soNangLuongTong),
      },
      hasPermission('deXuat', 'read') && {
        key: '/de-xuat', icon: <FileTextOutlined />,
        label: <NhanMenu ten="Điều chỉnh lương" soCho={soDeXuatCho} soTong={soDeXuatTong} />,
        title: nhanTitle(TEN_CHUC_NANG_DE_XUAT, soDeXuatCho, soDeXuatTong),
      },
      hasPermission('deXuat', 'read') && {
        key: '/thong-bao-ket-qua', icon: <NotificationOutlined />,
        label: <NhanMenu ten="Thông báo kết quả" soCho={soThongBaoMoi} />,
        title: 'Thông báo kết quả nâng lương, phụ cấp thâm niên',
      },
      hasPermission('deXuat', 'read') && {
        key: '/truy-linh', icon: <CalculatorOutlined />,
        label: <NhanMenu ten="Truy lĩnh" soCho={soTruyLinhCho} />,
        title: 'Truy lĩnh nâng lương, phụ cấp thâm niên theo kỳ 6 tháng',
      },
    ]),
    nhom('Theo dõi', [
      hasPermission('vienChuc', 'read') && {
        key: '/bo-nhiem', icon: <SolutionOutlined />,
        label: <NhanMenu ten={laDonViTruong ? 'Bổ nhiệm, kế toán' : 'Bổ nhiệm, chuyển đổi VT'} soCho={boNhiem.canNhac.length + soKeToan} />,
        title: 'Theo dõi bổ nhiệm cán bộ quản lý và định kỳ chuyển đổi vị trí kế toán',
      },
      hasPermission('duBao', 'read') && { key: '/du-bao', icon: <ClockCircleOutlined />, label: 'Dự báo nghỉ hưu' },
      hasPermission('baoCao', 'read') && { key: '/bao-cao', icon: <BarChartOutlined />, label: 'Báo cáo' },
    ]),
    hasPermission('admin', 'admin') && nhom('Quản trị', [
      { key: '/admin/danh-muc', icon: <AppstoreOutlined />, label: 'Danh mục hệ thống' },
      { key: '/admin/nguoi-dung', icon: <UserOutlined />, label: 'Tài khoản người dùng' },
      { key: '/admin/nhat-ky', icon: <AuditOutlined />, label: 'Nhật ký thao tác' },
    ]),
  ].filter(Boolean) as any[]

  // Danh sách chức năng cho ô Tìm nhanh (Ctrl+K): các mục menu được dùng + các trang ở đầu trang
  const chucNangs = useMemo<MucTimNhanh[]>(() => {
    const ds: MucTimNhanh[] = []
    for (const m of menuItems) {
      const con = m.type === 'group' ? m.children : [m]
      for (const c of con) ds.push({ den: c.key, ten: BREADCRUMB_MAP[c.key] ?? c.title ?? String(c.label), nhom: m.type === 'group' ? m.label : undefined, icon: c.icon })
    }
    if (coChucNangTruong(hasPermission('quyMo', 'read'))) ds.push({ den: '/thong-tin-truong', ten: 'Thông tin trường', icon: <BankOutlined /> })
    ds.push({ den: '/huong-dan', ten: 'Hướng dẫn sử dụng', icon: <ReadOutlined /> }, { den: '/tai-khoan', ten: 'Thông tin tài khoản, đổi mật khẩu', icon: <IdcardOutlined /> })
    return ds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role, laDonViTruong])

  const [moTim, setMoTim] = useState(false)
  useEffect(() => {
    const bam = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setMoTim(true) }
    }
    window.addEventListener('keydown', bam)
    return () => window.removeEventListener('keydown', bam)
  }, [])

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
      <TimNhanh mo={moTim} dong={() => setMoTim(false)} chucNangs={chucNangs} scopeDonViId={scopeDonViId ?? null} />
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={264}
        collapsedWidth={64}
        breakpoint="lg"
        onBreakpoint={(hep) => setCollapsed(hep)}
        theme="light"
        className="qlvc-sidebar"
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', borderRight: '1px solid #d6e4fb' }}
      >
        {/* Logo phường và tên phần mềm - bấm để về Tổng quan */}
        <div
          onClick={() => navigate('/dashboard')}
          title="Quản lý nhân sự lao động tiền lương - Phường Gia Viên"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '14px 0' : '14px 16px', borderBottom: '1px solid #d6e4fb',
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}logo-phuong.png`}
            alt="Logo Phường Gia Viên"
            width={38}
            height={38}
            style={{ display: 'block', borderRadius: '50%', flexShrink: 0 }}
          />
          {!collapsed && (
            <div style={{ lineHeight: '18px', minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, color: '#0f172a' }}>Quản lý nhân sự</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Phường Gia Viên</div>
            </div>
          )}
        </div>

        {/* Chỉ vùng menu cuộn; logo và nút thu gọn cố định, không đè lên các mục menu */}
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            items={menuItems}
            inlineIndent={16}
            onClick={({ key }) => navigate(key)}
            style={{ marginTop: 6 }}
          />
        </div>

        {/* Nút thu gọn ở đáy */}
        <div style={{ flex: '0 0 auto', borderTop: '1px solid #d6e4fb', padding: 8, display: 'flex', justifyContent: 'center' }}>
          <Tooltip title={collapsed ? 'Mở rộng' : 'Thu gọn'} placement="right">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ color: '#64748b', width: '100%' }}
              aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            />
          </Tooltip>
        </div>
      </Sider>

      <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header className="qlvc-header" style={{
          background: '#fff', padding: '0 20px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0, height: 56,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {/* Tiêu đề trang một dòng, dài thì rút gọn (rê chuột xem đủ) - không đẩy các nút bên phải xuống dòng */}
          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }} title={breadcrumbTitle}>
            <Breadcrumb
              items={[
                { title: <DashboardOutlined style={{ fontSize: 14 }} /> },
                { title: <span className="hd-tieu-de" style={{ fontWeight: 600, color: '#1e3a5f' }}>{breadcrumbTitle}</span> },
              ]}
              style={{ fontSize: 14, whiteSpace: 'nowrap' }}
            />
          </div>
          <Space size={8} style={{ flexShrink: 0 }}>
            {/* Khối đang xem - chỉ tài khoản toàn phường; tài khoản đơn vị luôn ở đơn vị mình */}
            {!scopeDonViId && (
              <Tooltip title="Chọn khối đơn vị để xem: danh sách, số liệu và danh mục chỉ hiện của khối đã chọn">
                <Select
                  value={khoi ?? 'ALL'}
                  onChange={(v: string) => datKhoi(v === 'ALL' ? null : (v as KhoiDonVi))}
                  options={[{ value: 'ALL', label: 'Tất cả các khối' }, ...KHOI_DON_VI.map((k) => ({ value: k.key, label: k.ten }))]}
                  style={{ width: 186 }}
                  className="hd-chon-khoi"
                  aria-label="Khối đơn vị đang xem"
                  popupMatchSelectWidth={false}
                />
              </Tooltip>
            )}
            <Button
              onClick={() => setMoTim(true)}
              icon={<SearchOutlined />}
              style={{ borderRadius: 8, color: '#64748b', background: 'rgba(255,255,255,0.85)', borderColor: '#d6e4fb' }}
              aria-label="Tìm nhanh (Ctrl+K)"
            >
              <span className="hd-btn-label">Tìm nhân sự, chức năng</span>
              <span className="hd-btn-label hd-phim-tat" style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 4, padding: '0 5px', marginLeft: 10, color: '#94a3b8' }}>Ctrl K</span>
            </Button>
            <ChiBaoDongBo />
            {coChucNangTruong(hasPermission('quyMo', 'read')) && (
              <Tooltip title="Quy mô trường lớp từng năm học">
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
                  style={{ background: '#2563eb', fontSize: 14, fontWeight: 600 }}
                >
                  {currentUser?.fullName?.charAt(0) ?? 'U'}
                </Avatar>
                {currentUser && (
                  <div className="hd-user-text" style={{ lineHeight: '16px', whiteSpace: 'nowrap' }}>
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
