import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import RoleGuard from '@/components/common/RoleGuard'
import { useAuth } from '@/hooks/useAuth'

import LoginPage from '@/pages/LoginPage'

// Mỗi trang là một gói mã riêng, chỉ tải khi mở trang đó (lần đầu vào phần mềm không phải tải mã của cả 22 trang)
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const VienChucListPage = lazy(() => import('@/pages/vienChuc/VienChucListPage'))
const VienChucFormPage = lazy(() => import('@/pages/vienChuc/VienChucFormPage'))
const VienChucDetailPage = lazy(() => import('@/pages/vienChuc/VienChucDetailPage'))
const HeSoLuongPage = lazy(() => import('@/pages/luong/HeSoLuongPage'))
const RaSoatNgachBacPage = lazy(() => import('@/pages/luong/RaSoatNgachBacPage'))
const PhuCapPage = lazy(() => import('@/pages/luong/PhuCapPage'))
const BangTongHopLuongPage = lazy(() => import('@/pages/luong/BangTongHopLuongPage'))
const DeXuatListPage = lazy(() => import('@/pages/deXuat/DeXuatListPage'))
const TaoDeXuatPage = lazy(() => import('@/pages/deXuat/TaoDeXuatPage'))
const DeXuatDetailPage = lazy(() => import('@/pages/deXuat/DeXuatDetailPage'))
const DuBaoNghiHuuPage = lazy(() => import('@/pages/duBao/DuBaoNghiHuuPage'))
const TheoDoiBoNhiemPage = lazy(() => import('@/pages/boNhiem/TheoDoiBoNhiemPage'))
const BaoCaoPage = lazy(() => import('@/pages/baoCao/BaoCaoPage'))
const DanhMucPage = lazy(() => import('@/pages/admin/DanhMucPage'))
const UserManagePage = lazy(() => import('@/pages/admin/UserManagePage'))
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage'))
const AccountSettingsPage = lazy(() => import('@/pages/account/AccountSettingsPage'))
const HuongDanPage = lazy(() => import('@/pages/HuongDanPage'))
const ChuyenCongTacPage = lazy(() => import('@/pages/chuyenCongTac/ChuyenCongTacPage'))
const QuyMoDinhMucPage = lazy(() => import('@/pages/quyMo/QuyMoDinhMucPage'))
const ThongBaoKetQuaPage = lazy(() => import('@/pages/thongBao/ThongBaoKetQuaPage'))
const ThongTinTruongPage = lazy(() => import('@/pages/thongTinTruong/ThongTinTruongPage'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="vien-chuc" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'vienChuc', action: 'read' }}><VienChucListPage /></RoleGuard>} />
          <Route path="vien-chuc/new" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'vienChuc', action: 'write' }}><VienChucFormPage /></RoleGuard>} />
          <Route path="vien-chuc/:id" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'vienChuc', action: 'read' }}><VienChucDetailPage /></RoleGuard>} />
          <Route path="vien-chuc/:id/edit" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'vienChuc', action: 'write' }}><VienChucFormPage /></RoleGuard>} />
          <Route path="bang-tong-hop-luong" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'luong', action: 'read' }}><BangTongHopLuongPage /></RoleGuard>} />
          {/* Trang Vị trí việc làm cũ đã gộp vào Cơ cấu VTVL và định mức VC (chỉ tiêu giao theo nhóm VTVL) */}
          <Route path="vi-tri" element={<Navigate to="/quy-mo" replace />} />
          <Route path="thong-tin-truong" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'quyMo', action: 'read' }}><ThongTinTruongPage /></RoleGuard>} />
          <Route path="quy-mo" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'quyMo', action: 'read' }}><QuyMoDinhMucPage /></RoleGuard>} />
          <Route path="luong/he-so" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'luong', action: 'read' }}><HeSoLuongPage /></RoleGuard>} />
          <Route path="luong/ra-soat" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'vienChuc', action: 'read' }}><RaSoatNgachBacPage /></RoleGuard>} />
          <Route path="luong/phu-cap" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'luong', action: 'read' }}><PhuCapPage /></RoleGuard>} />
          <Route path="chuyen-cong-tac" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'vienChuc', action: 'read' }}><ChuyenCongTacPage /></RoleGuard>} />
          <Route path="de-xuat" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'deXuat', action: 'read' }}><DeXuatListPage /></RoleGuard>} />
          <Route path="de-xuat/new" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'deXuat', action: 'write' }}><TaoDeXuatPage /></RoleGuard>} />
          <Route path="de-xuat/:id" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'deXuat', action: 'read' }}><DeXuatDetailPage /></RoleGuard>} />
          <Route path="de-xuat/:id/edit" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'deXuat', action: 'write' }}><TaoDeXuatPage /></RoleGuard>} />
          <Route path="thong-bao-ket-qua" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'deXuat', action: 'read' }}><ThongBaoKetQuaPage /></RoleGuard>} />
          <Route path="bo-nhiem" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'vienChuc', action: 'read' }}><TheoDoiBoNhiemPage /></RoleGuard>} />
          <Route path="du-bao"element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'duBao', action: 'read' }}><DuBaoNghiHuuPage /></RoleGuard>} />
          <Route path="bao-cao" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'baoCao', action: 'read' }}><BaoCaoPage /></RoleGuard>} />
          <Route path="admin/danh-muc" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'admin', action: 'admin' }}><DanhMucPage /></RoleGuard>} />
          <Route path="admin/nguoi-dung" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'admin', action: 'admin' }}><UserManagePage /></RoleGuard>} />
          <Route path="admin/nhat-ky" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'admin', action: 'admin' }}><AuditLogPage /></RoleGuard>} />
          <Route path="tai-khoan" element={<AccountSettingsPage />} />
          <Route path="huong-dan" element={<HuongDanPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
