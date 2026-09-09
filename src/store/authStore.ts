import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types/auth'

interface AuthState {
  currentUser: User | null
  login: (user: User) => void
  logout: () => void
}

// Phiên đăng nhập chỉ được lưu trên máy người dùng.
// Trước đây store này dùng persistStorage() (localStorage + Supabase), khiến người
// đăng nhập sau ghi đè phiên của tất cả các trường khác — mọi máy cùng đọc một
// bản ghi ql-auth nên bị "hoá thân" thành nhau, kèm theo mật khẩu lộ trong DB.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      login: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),
    }),
    { name: 'ql-auth', storage: createJSONStorage(() => localStorage) }
  )
)
