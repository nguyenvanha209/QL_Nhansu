import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import RoleGuard from '@/components/common/RoleGuard'
import { useAuth } from '@/hooks/useAuth'

import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import VienChucListPage from '@/pages/vienChuc/VienChucListPage'
import VienChucFormPage from '@/pages/vienChuc/VienChucFormPage'
import VienChucDetailPage from '@/pages/vienChuc/VienChucDetailPage'
import ViTriPage from '@/pages/viTri/ViTriPage'
import HeSoLuongPage from '@/pages/luong/HeSoLuongPage'
import RaSoatNgachBacPage from '@/pages/luong/RaSoatNgachBacPage'
import PhuCapPage from '@/pages/luong/PhuCapPage'
import BangTongHopLuongPage from '@/pages/luong/BangTongHopLuongPage'
import DeXuatListPage from '@/pages/deXuat/DeXuatListPage'
import TaoDeXuatPage from '@/pages/deXuat/TaoDeXuatPage'
import DeXuatDetailPage from '@/pages/deXuat/DeXuatDetailPage'
import DuBaoNghiHuuPage from '@/pages/duBao/DuBaoNghiHuuPage'
import BaoCaoPage from '@/pages/baoCao/BaoCaoPage'
import DanhMucPage from '@/pages/admin/DanhMucPage'
import UserManagePage from '@/pages/admin/UserManagePage'
import AuditLogPage from '@/pages/admin/AuditLogPage'
import AccountSettingsPage from '@/pages/account/AccountSettingsPage'
import HuongDanPage from '@/pages/HuongDanPage'
import ChuyenCongTacPage from '@/pages/chuyenCongTac/ChuyenCongTacPage'
import QuyMoDinhMucPage from '@/pages/quyMo/QuyMoDinhMucPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <BrowserRouter basename="/QL_Nhansu">
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
          <Route path="vi-tri" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'viTri', action: 'read' }}><ViTriPage /></RoleGuard>} />
          <Route path="quy-mo" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'quyMo', action: 'read' }}><QuyMoDinhMucPage /></RoleGuard>} />
          <Route path="luong/he-so" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'luong', action: 'read' }}><HeSoLuongPage /></RoleGuard>} />
          <Route path="luong/ra-soat" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'vienChuc', action: 'read' }}><RaSoatNgachBacPage /></RoleGuard>} />
          <Route path="luong/phu-cap" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'luong', action: 'read' }}><PhuCapPage /></RoleGuard>} />
          <Route path="chuyen-cong-tac" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'vienChuc', action: 'read' }}><ChuyenCongTacPage /></RoleGuard>} />
          <Route path="de-xuat" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'deXuat', action: 'read' }}><DeXuatListPage /></RoleGuard>} />
          <Route path="de-xuat/new" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'deXuat', action: 'write' }}><TaoDeXuatPage /></RoleGuard>} />
          <Route path="de-xuat/:id" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'deXuat', action: 'read' }}><DeXuatDetailPage /></RoleGuard>} />
          <Route path="de-xuat/:id/edit" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'deXuat', action: 'write' }}><TaoDeXuatPage /></RoleGuard>} />
          <Route path="du-bao" element={<RoleGuard allowedRoles={['ADMIN']} quyen={{ resource: 'duBao', action: 'read' }}><DuBaoNghiHuuPage /></RoleGuard>} />
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
