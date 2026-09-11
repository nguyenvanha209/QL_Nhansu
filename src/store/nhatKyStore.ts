import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { persistStorage } from '@/lib/supabase'
import type { NhatKyThaoTac } from '@/types/luong'

// Nhật ký tách khỏi ql-luong và có kho riêng.
//
// Trước đây nhật ký nằm chung khối với hệ số lương và phụ cấp — khối đó nặng
// hơn 500KB. Mỗi lần ai đó đăng nhập là phải ghi lại toàn bộ khối. Hai người
// thao tác gần nhau thì một bên bị từ chối ghi và mất luôn bản ghi nhật ký,
// nên số lượt đăng nhập ghi được ít hơn thực tế rất nhiều.
//
// Kho riêng nhẹ, ghi nhanh, và xung đột ở đây chỉ ảnh hưởng nhật ký chứ không
// đụng tới dữ liệu lương.

const GIOI_HAN = 5000

interface NhatKyState {
  nhatKys: NhatKyThaoTac[]
  setNhatKys: (ds: NhatKyThaoTac[]) => void
  them: (d: Omit<NhatKyThaoTac, 'id'>) => void
  xoaTruoc: (mocISO: string) => number
}

export const useNhatKyStore = create<NhatKyState>()(
  persist(
    (set, get) => ({
      nhatKys: [],
      setNhatKys: (ds) => set({ nhatKys: ds.slice(0, GIOI_HAN) }),
      them: (d) =>
        set((s) => ({ nhatKys: [{ ...d, id: nanoid() }, ...s.nhatKys].slice(0, GIOI_HAN) })),
      xoaTruoc: (mocISO) => {
        const truoc = get().nhatKys.length
        set((s) => ({ nhatKys: s.nhatKys.filter((n) => n.thoiGian >= mocISO) }))
        return truoc - get().nhatKys.length
      },
    }),
    { name: 'ql-nhat-ky', storage: persistStorage() },
  ),
)
