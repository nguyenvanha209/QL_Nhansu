import { useAuthStore } from '@/store/authStore'
import { can } from '@/utils/rbac'

export function useAuth() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)

  const hasPermission = (resource: string, action: 'read' | 'write' | 'approve' | 'admin') => {
    if (!currentUser) return false
    return can(currentUser.role, resource, action)
  }

  const isScopedToDonVi = currentUser?.role === 'CB_TRUONG'
  const scopeDonViId = isScopedToDonVi ? currentUser?.donViId : null

  return {
    currentUser,
    logout,
    hasPermission,
    isAdmin: currentUser?.role === 'ADMIN',
    isVHXH: currentUser?.role === 'CB_VH_XH',
    isLanhDao: currentUser?.role === 'LANH_DAO',
    isCBTruong: currentUser?.role === 'CB_TRUONG',
    scopeDonViId,
    isScopedToDonVi,
  }
}
