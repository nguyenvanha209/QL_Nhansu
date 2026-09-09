import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { VienChuc } from '@/types/vienChuc'
import { isDangCongTac } from '@/types/vienChuc'
import { logAction } from '@/utils/auditLogger'
import { toUpperName } from '@/utils/helpers'
import { persistStorage } from '@/lib/supabase'

interface VienChucState {
  vienChucs: VienChuc[]
  setVienChucs: (v: VienChuc[]) => void
  addVienChuc: (d: Omit<VienChuc, 'id' | 'ma' | 'createdAt' | 'updatedAt'>, actorId?: string, actorName?: string) => VienChuc
  updateVienChuc: (id: string, patch: Partial<VienChuc>, actorId?: string, actorName?: string) => void
  softDelete: (id: string, actorId?: string, actorName?: string) => void
  getAll: (donViId?: string | null) => VienChuc[]
  getById: (id: string) => VienChuc | undefined
  countByDonVi: (donViId: string) => number
}

const now = () => new Date().toISOString()

let _counter = 1
const genMa = () => `VC${String(Date.now()).slice(-6)}${String(_counter++).padStart(3, '0')}`

/** Quy định: họ tên viên chức, người lao động luôn lưu IN HOA. Chuẩn hoá tại store
 *  để mọi đường ghi (biểu mẫu, nhập Excel, chuyển công tác) đều đi qua một chỗ. */
function chuanHoaHoTen<T extends { ho?: string; ten?: string }>(d: T): T {
  const out = { ...d }
  if (out.ho !== undefined) out.ho = toUpperName(out.ho)
  if (out.ten !== undefined) out.ten = toUpperName(out.ten)
  return out
}

export const useVienChucStore = create<VienChucState>()(
  persist(
    (set, get) => ({
      vienChucs: [],
      setVienChucs: (v) => set({ vienChucs: v }),

      addVienChuc: (data, actorId = 'system', actorName = 'Hệ thống') => {
        const vc: VienChuc = {
          ...chuanHoaHoTen(data),
          id: nanoid(),
          ma: genMa(),
          createdAt: now(),
          updatedAt: now(),
        }
        set((s) => ({ vienChucs: [...s.vienChucs, vc] }))
        logAction(actorId, actorName, 'CREATE', 'VienChuc', vc.id, `Thêm viên chức: ${vc.ho} ${vc.ten}`)
        return vc
      },

      updateVienChuc: (id, patch, actorId = 'system', actorName = 'Hệ thống') => {
        const p = chuanHoaHoTen(patch)
        set((s) => ({
          vienChucs: s.vienChucs.map((v) => (v.id === id ? { ...v, ...p, updatedAt: now() } : v)),
        }))
        logAction(actorId, actorName, 'UPDATE', 'VienChuc', id, `Cập nhật viên chức ${id}`)
      },

      softDelete: (id, actorId = 'system', actorName = 'Hệ thống') => {
        get().updateVienChuc(id, { active: false }, actorId, actorName)
        logAction(actorId, actorName, 'DELETE', 'VienChuc', id, `Xóa (soft) viên chức ${id}`)
      },

      getAll: (donViId) => {
        const list = get().vienChucs.filter((v) => v.active && isDangCongTac(v))
        return donViId ? list.filter((v) => v.donViId === donViId) : list
      },

      getById: (id) => get().vienChucs.find((v) => v.id === id),

      countByDonVi: (donViId) => get().vienChucs.filter((v) => v.active && isDangCongTac(v) && v.donViId === donViId).length,
    }),
    { name: 'ql-vien-chuc', storage: persistStorage() }
  )
)
