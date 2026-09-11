import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/auth'
import { nanoid } from 'nanoid'
import { persistStorage } from '@/lib/supabase'
import { logAction, soSanhThayDoi } from '@/utils/auditLogger'
import { useAuthStore } from './authStore'
import { demQuyenRieng } from '@/utils/rbac'

const nguoiThaoTac = () => {
  const u = useAuthStore.getState().currentUser
  return { id: u?.id ?? 'system', name: u?.fullName ?? 'Hệ thống' }
}

const NHAN_TRUONG_USER: Record<string, string> = {
  fullName: 'Họ và tên',
  role: 'Vai trò',
  donViId: 'Đơn vị phụ trách',
  active: 'Trạng thái hoạt động',
  quyenRieng: 'Quyền riêng',
}

interface UserState {
  users: User[]
  setUsers: (users: User[]) => void
  addUser: (data: Omit<User, 'id' | 'createdAt'>) => User
  updateUser: (id: string, patch: Partial<User>) => void
  softDelete: (id: string) => void
  findByUsername: (username: string) => User | undefined
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      users: [],
      setUsers: (users) => set({ users }),
      addUser: (data) => {
        const user: User = { ...data, id: nanoid(), createdAt: new Date().toISOString() }
        set((s) => ({ users: [...s.users, user] }))
        const a = nguoiThaoTac()
        logAction(a.id, a.name, 'CREATE', 'User', {
          entityId: user.id,
          donViId: user.donViId ?? undefined,
          moTa: `Tạo tài khoản ${user.username} (${user.fullName}) — vai trò ${user.role}`,
        })
        return user
      },
      updateUser: (id, patch) => {
        const truoc = get().users.find((u) => u.id === id)
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))
        if (!truoc) return

        // Trước đây chỗ này ghi người thực hiện là "Hệ thống" nên nhật ký không
        // quy được trách nhiệm cho ai. Nay lấy đúng người đang đăng nhập.
        const a = nguoiThaoTac()
        const doiQuyen = 'quyenRieng' in patch
        const soQuyen = demQuyenRieng(patch.quyenRieng)

        logAction(a.id, a.name, doiQuyen ? 'PERMISSION' : 'UPDATE', 'User', {
          entityId: id,
          donViId: (patch.donViId ?? truoc.donViId) ?? undefined,
          moTa: doiQuyen
            ? soQuyen
              ? `Đổi quyền riêng của ${truoc.username}: ${soQuyen} quyền khác mặc định vai trò`
              : `Trả quyền của ${truoc.username} về đúng mặc định vai trò`
            : `Cập nhật tài khoản ${truoc.username}`,
          chiTiet: soSanhThayDoi(
            truoc as unknown as Record<string, unknown>,
            patch as Record<string, unknown>,
            NHAN_TRUONG_USER,
          ),
        })
      },
      softDelete: (id) => {
        const u = get().users.find((x) => x.id === id)
        set((s) => ({ users: s.users.map((x) => (x.id === id ? { ...x, active: false } : x)) }))
        const a = nguoiThaoTac()
        logAction(a.id, a.name, 'DELETE', 'User', {
          entityId: id,
          moTa: `Khóa tài khoản ${u?.username ?? id}`,
        })
      },
      findByUsername: (username) => get().users.find((u) => u.username === username && u.active),
    }),
    { name: 'ql-users', storage: persistStorage() }
  )
)
