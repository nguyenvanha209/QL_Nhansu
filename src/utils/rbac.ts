import type { UserRole } from '@/types/auth'

type Action = 'read' | 'write' | 'approve' | 'admin'

const PERMISSIONS: Record<UserRole, Record<string, Action[]>> = {
  ADMIN: {
    '*': ['read', 'write', 'approve', 'admin'],
  },
  CB_VH_XH: {
    vienChuc: ['read', 'write'],
    viTri: ['read', 'write'],
    luong: ['read', 'write'],
    deXuat: ['read', 'write', 'approve'],
    baoCao: ['read'],
    duBao: ['read'],
  },
  LANH_DAO: {
    vienChuc: ['read'],
    viTri: ['read'],
    luong: ['read'],
    deXuat: ['read', 'approve'],
    baoCao: ['read'],
    duBao: ['read'],
  },
  HIEU_TRUONG: {
    vienChuc: ['read', 'write'],
    viTri: ['read'],
    luong: ['read'],
    deXuat: ['read', 'approve'],
    baoCao: ['read'],
    duBao: ['read'],
  },
  CB_TRUONG: {
    vienChuc: ['read', 'write'],
    viTri: ['read'],
    luong: ['read'],
    deXuat: ['read', 'write'],
    baoCao: ['read'],
    duBao: ['read'],
  },
}

export function can(role: UserRole, resource: string, action: Action): boolean {
  const perms = PERMISSIONS[role]
  if (!perms) return false
  const all = perms['*']
  const specific = perms[resource]
  return (all?.includes(action) || specific?.includes(action)) ?? false
}

export function canAny(role: UserRole, resource: string, actions: Action[]): boolean {
  return actions.some((a) => can(role, resource, a))
}
