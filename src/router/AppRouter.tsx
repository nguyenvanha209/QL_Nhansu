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
import PhuCapPage from '@/pages/luong/PhuCapPage'
import DeXuatListPage from '@/pages/deXuat/DeXuatListPage'
import TaoDeXuatPage from '@/pages/deXuat/TaoDeXuatPage'
import DeXuatDetailPage from '@/pages/deXuat/DeXuatDetailPage'
import DuBaoNghiHuuPage from '@/pages/duBao/DuBaoNghiHuuPage'
import BaoCaoPage from '@/pages/baoCao/BaoCaoPage'
import DanhMucPage from '@/pages/admin/DanhMucPage'
import UserManagePage from '@/pages/admin/UserManagePage'
import AuditLogPage from '@/pages/admin/AuditLogPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <BrowserRouter basename="/QLVC-GIAVIEN">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="vien-chuc" element={<VienChucListPage />} />
          <Route path="vien-chuc/new" element={<VienChucFormPage />} />
          <Route path="vien-chuc/:id" element={<VienChucDetailPage />} />
          <Route path="vien-chuc/:id/edit" element={<VienChucFormPage />} />
          <Route path="vi-tri" element={<ViTriPage />} />
          <Route path="luong/he-so" element={<HeSoLuongPage />} />
          <Route path="luong/phu-cap" element={<PhuCapPage />} />
          <Route path="de-xuat" element={<DeXuatListPage />} />
          <Route path="de-xuat/new" element={<TaoDeXuatPage />} />
          <Route path="de-xuat/:id" element={<DeXuatDetailPage />} />
          <Route path="du-bao" element={<DuBaoNghiHuuPage />} />
          <Route path="bao-cao" element={<BaoCaoPage />} />
          <Route path="admin/danh-muc" element={<RoleGuard allowedRoles={['ADMIN']}><DanhMucPage /></RoleGuard>} />
          <Route path="admin/nguoi-dung" element={<RoleGuard allowedRoles={['ADMIN']}><UserManagePage /></RoleGuard>} />
          <Route path="admin/nhat-ky" element={<RoleGuard allowedRoles={['ADMIN']}><AuditLogPage /></RoleGuard>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
