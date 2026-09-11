export type UserRole = 'ADMIN' | 'CB_VH_XH' | 'LANH_DAO' | 'HIEU_TRUONG' | 'CB_TRUONG'

// Mật khẩu KHÔNG nằm ở đây. Hồ sơ tài khoản được đồng bộ công khai qua app_state,
// nên mật khẩu được băm bcrypt và giữ ở bảng riêng `mat_khau` trên Supabase —
// bảng đó bật RLS không policy, chỉ truy cập được qua các hàm trong src/lib/auth.ts.
export interface User {
  id: string
  username: string
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
  HIEU_TRUONG: 'Hiệu trưởng',
  CB_TRUONG: 'Cán bộ trường (kế toán)',
}
