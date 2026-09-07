export type UserRole = 'ADMIN' | 'CB_VH_XH' | 'LANH_DAO' | 'CB_TRUONG'

export interface User {
  id: string
  username: string
  password: string
  fullName: string
  role: UserRole
  donViId: string | null
  active: boolean
  createdAt: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Quản trị hệ thống',
  CB_VH_XH: 'Cán bộ Văn hóa - Xã hội',
  LANH_DAO: 'Lãnh đạo UBND phường',
  CB_TRUONG: 'Cán bộ trường',
}
