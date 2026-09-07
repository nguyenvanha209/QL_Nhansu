import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/auth'
import { nanoid } from 'nanoid'
import { logAction } from '@/utils/auditLogger'

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
        return user
      },
      updateUser: (id, patch) => {
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))
        logAction('system', 'Hệ thống', 'UPDATE', 'User', id, `Cập nhật tài khoản ${id}`)
      },
      softDelete: (id) => get().updateUser(id, { active: false }),
      findByUsername: (username) => get().users.find((u) => u.username === username && u.active),
    }),
    { name: 'ql-users' }
  )
)
