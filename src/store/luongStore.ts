import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { HeSoLuong, PhuCapVienChuc, LichSuBienDong, NhatKyThaoTac } from '@/types/luong'
import { persistStorage } from '@/lib/supabase'

interface LuongState {
  heSoLuongs: HeSoLuong[]
  phuCapVienChucs: PhuCapVienChuc[]
  lichSuBienDongs: LichSuBienDong[]
  nhatKyThaoTacs: NhatKyThaoTac[]

  setHeSoLuongs: (v: HeSoLuong[]) => void
  addHeSoLuong: (d: Omit<HeSoLuong, 'id' | 'createdAt'>) => HeSoLuong
  updateHeSoLuong: (id: string, patch: Partial<HeSoLuong>) => void
  deactivateHeSoLuong: (id: string) => void
  getActiveHeSo: (vienChucId: string) => HeSoLuong | undefined
  getHeSoHistory: (vienChucId: string) => HeSoLuong[]

  setPhuCapVienChucs: (v: PhuCapVienChuc[]) => void
  addPhuCap: (d: Omit<PhuCapVienChuc, 'id' | 'createdAt'>) => PhuCapVienChuc
  updatePhuCap: (id: string, patch: Partial<PhuCapVienChuc>) => void
  deactivatePhuCap: (id: string) => void
  getActivePhuCaps: (vienChucId: string) => PhuCapVienChuc[]

  setLichSuBienDongs: (v: LichSuBienDong[]) => void
  addLichSuBienDong: (d: Omit<LichSuBienDong, 'id'>) => void
  getLichSuByVienChuc: (vienChucId: string) => LichSuBienDong[]

  addNhatKy: (d: Omit<NhatKyThaoTac, 'id'>) => void
}

const now = () => new Date().toISOString()

export const useLuongStore = create<LuongState>()(
  persist(
    (set, get) => ({
      heSoLuongs: [],
      phuCapVienChucs: [],
      lichSuBienDongs: [],
      nhatKyThaoTacs: [],

      setHeSoLuongs: (v) => set({ heSoLuongs: v }),
      addHeSoLuong: (data) => {
        const item: HeSoLuong = { ...data, id: nanoid(), createdAt: now() }
        set((s) => ({ heSoLuongs: [...s.heSoLuongs, item] }))
        return item
      },
      updateHeSoLuong: (id, patch) =>
        set((s) => ({
          heSoLuongs: s.heSoLuongs.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        })),
      deactivateHeSoLuong: (id) =>
        set((s) => ({
          heSoLuongs: s.heSoLuongs.map((h) => (h.id === id ? { ...h, isActive: false } : h)),
        })),
      getActiveHeSo: (vienChucId) =>
        get().heSoLuongs.find((h) => h.vienChucId === vienChucId && h.isActive),
      getHeSoHistory: (vienChucId) =>
        get()
          .heSoLuongs.filter((h) => h.vienChucId === vienChucId)
          .sort((a, b) => b.ngayHieuLuc.localeCompare(a.ngayHieuLuc)),

      setPhuCapVienChucs: (v) => set({ phuCapVienChucs: v }),
      addPhuCap: (data) => {
        const item: PhuCapVienChuc = { ...data, id: nanoid(), createdAt: now() }
        set((s) => ({ phuCapVienChucs: [...s.phuCapVienChucs, item] }))
        return item
      },
      updatePhuCap: (id, patch) =>
        set((s) => ({
          phuCapVienChucs: s.phuCapVienChucs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      deactivatePhuCap: (id) =>
        set((s) => ({
          phuCapVienChucs: s.phuCapVienChucs.map((p) =>
            p.id === id ? { ...p, isActive: false, ngayHetHan: now().slice(0, 10) } : p
          ),
        })),
      getActivePhuCaps: (vienChucId) =>
        get().phuCapVienChucs.filter((p) => p.vienChucId === vienChucId && p.isActive),

      setLichSuBienDongs: (v) => set({ lichSuBienDongs: v }),
      addLichSuBienDong: (data) => {
        const item: LichSuBienDong = { ...data, id: nanoid() }
        set((s) => ({ lichSuBienDongs: [...s.lichSuBienDongs, item] }))
      },
      getLichSuByVienChuc: (vienChucId) =>
        get()
          .lichSuBienDongs.filter((l) => l.vienChucId === vienChucId)
          .sort((a, b) => b.ngayThayDoi.localeCompare(a.ngayThayDoi)),

      addNhatKy: (data) => {
        const item: NhatKyThaoTac = { ...data, id: nanoid() }
        set((s) => ({ nhatKyThaoTacs: [item, ...s.nhatKyThaoTacs].slice(0, 5000) }))
      },
    }),
    { name: 'ql-luong', storage: persistStorage() }
  )
)
