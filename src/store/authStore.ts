import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types/auth'
import { logAction } from '@/utils/auditLogger'

interface AuthState {
  currentUser: User | null
  login: (user: User) => void
  logout: (tuDong?: boolean) => void
}

// Phiên đăng nhập chỉ được lưu trên máy người dùng.
// Trước đây store này dùng persistStorage() (localStorage + Supabase), khiến người
// đăng nhập sau ghi đè phiên của tất cả các trường khác — mọi máy cùng đọc một
// bản ghi ql-auth nên bị "hoá thân" thành nhau, kèm theo mật khẩu lộ trong DB.
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      login: (user) => set({ currentUser: user }),
      // Ghi vết đăng xuất ngay tại đây để bắt được cả lần thoát thủ công lẫn
      // lần bị tự đăng xuất do không thao tác.
      logout: (tuDong) => {
        const u = get().currentUser
        if (u) {
          logAction(u.id, u.fullName, 'LOGOUT', 'User', {
            entityId: u.id,
            moTa: tuDong
              ? `Tự đăng xuất do không thao tác: ${u.username}`
              : `Đăng xuất: ${u.username}`,
            donViId: u.donViId ?? undefined,
          })
        }
        set({ currentUser: null })
      },
    }),
    { name: 'ql-auth', storage: createJSONStorage(() => localStorage) }
  )
)
