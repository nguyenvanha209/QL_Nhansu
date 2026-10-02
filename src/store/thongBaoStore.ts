import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { persistStorage } from '@/lib/supabase'
import type { ThongBaoKetQua } from '@/types/thongBao'
import { logAction } from '@/utils/auditLogger'
import { useAuthStore } from './authStore'

interface ThongBaoState {
  thongBaos: ThongBaoKetQua[]
  setThongBaos: (v: ThongBaoKetQua[]) => void
  /** Tạo mới hoặc ghi đè theo id (mỗi loại, mỗi kỳ một bản) */
  luuThongBao: (tb: Omit<ThongBaoKetQua, 'createdAt' | 'updatedAt'>) => void
  xoaThongBao: (id: string) => void
}

const now = () => new Date().toISOString()
const nguoi = () => {
  const u = useAuthStore.getState().currentUser
  return { id: u?.id ?? 'system', ten: u?.fullName ?? 'Hệ thống' }
}

export const useThongBaoStore = create<ThongBaoState>()(
  persist(
    (set, get) => ({
      thongBaos: [],
      setThongBaos: (v) => set({ thongBaos: v }),

      luuThongBao: (tb) => {
        const cu = get().thongBaos.find((x) => x.id === tb.id)
        const t = now()
        const ban: ThongBaoKetQua = { ...tb, createdAt: cu?.createdAt ?? t, updatedAt: t }
        set((s) => ({ thongBaos: cu ? s.thongBaos.map((x) => (x.id === tb.id ? ban : x)) : [...s.thongBaos, ban] }))
        const { id, ten } = nguoi()
        const doiTrangThai = cu?.trangThai !== tb.trangThai
        logAction(id, ten, 'UPDATE', 'ThongBaoKetQua', {
          entityId: tb.id,
          moTa: doiTrangThai && tb.trangThai === 'DA_BAN_HANH'
            ? `Ban hành thông báo ${tb.soThongBao} (${tb.dong.length} người)`
            : doiTrangThai && cu
              ? `Chuyển thông báo ${tb.soThongBao || tb.id} về bản nháp`
              : `Lưu nháp thông báo kết quả ${tb.id} (${tb.dong.length} người)`,
        })
      },

      xoaThongBao: (id) => {
        set((s) => ({ thongBaos: s.thongBaos.filter((x) => x.id !== id) }))
        const { id: uid, ten } = nguoi()
        logAction(uid, ten, 'DELETE', 'ThongBaoKetQua', { entityId: id, moTa: `Xoá bản nháp thông báo ${id}` })
      },
    }),
    { name: 'ql-thong-bao', storage: persistStorage() },
  ),
)
