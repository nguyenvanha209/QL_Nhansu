import { useAuthStore } from '@/store/authStore'
import { can } from '@/utils/rbac'
import type { Action } from '@/utils/rbac'

export function useAuth() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)

  // Truyền cả tài khoản chứ không chỉ vai trò, để phần quyền cấp thêm / thu hồi
  // riêng của từng tài khoản được tính đến.
  const hasPermission = (resource: string, action: Action) => can(currentUser, resource, action)

  // Hiệu trưởng và cán bộ trường đều chỉ thấy dữ liệu trường mình
  const isScopedToDonVi = currentUser?.role === 'CB_TRUONG' || currentUser?.role === 'HIEU_TRUONG'
  const scopeDonViId = isScopedToDonVi ? currentUser?.donViId : null

  return {
    currentUser,
    logout,
    hasPermission,
    // Quyền quản trị THỰC TẾ: đúng vai trò ADMIN, hoặc được cấp riêng quyền
    // quản trị. Dùng cho những chỗ lấy quyền admin làm cửa thoát. Khác với
    // isAdmin bên dưới — cái đó chỉ nói về vai trò, dùng khi cần đúng danh tính.
    laQuanTri: can(currentUser, 'admin', 'admin'),
    isAdmin: currentUser?.role === 'ADMIN',
    isVHXH: currentUser?.role === 'CB_VH_XH',
    isLanhDao: currentUser?.role === 'LANH_DAO',
    isCBTruong: currentUser?.role === 'CB_TRUONG',
    isHieuTruong: currentUser?.role === 'HIEU_TRUONG',
    scopeDonViId,
    isScopedToDonVi,
  }
}
