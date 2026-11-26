import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { persistStorage } from '@/lib/supabase'
import type { BangTruyLinh, LichSuTruyLinh } from '@/types/truyLinh'
import { TEN_KY_TRUY_LINH } from '@/types/truyLinh'
import { logAction } from '@/utils/auditLogger'
import { useAuthStore } from './authStore'

// Bảng truy lĩnh nâng lương, nâng PCTN theo kỳ 6 tháng. Lưu chia theo đơn vị (khoá ql-truy-linh::<đơn vị>)
// như hồ sơ, lương: tài khoản trường chỉ đọc, ghi được bảng của trường mình (tools/sql/09).

interface TruyLinhState {
  bangs: BangTruyLinh[]
  setBangs: (v: BangTruyLinh[]) => void
  /** Tạo mới hoặc ghi đè theo id; `hanhDong` thêm một dòng lịch sử */
  luuBang: (b: Omit<BangTruyLinh, 'createdAt' | 'updatedAt'>, hanhDong?: LichSuTruyLinh['hanhDong'], ghiChu?: string) => BangTruyLinh
  xoaBang: (id: string) => void
}

const now = () => new Date().toISOString()
const nguoi = () => {
  const u = useAuthStore.getState().currentUser
  return { id: u?.id ?? 'system', ten: u?.fullName ?? 'Hệ thống' }
}
const TEN_HANH_DONG: Record<LichSuTruyLinh['hanhDong'], string> = {
  LAP: 'Lập / cập nhật', TRINH: 'Trình duyệt', DUYET: 'Duyệt', TRA_LAI: 'Trả lại', MO_LAI: 'Mở lại để sửa',
}

export const useTruyLinhStore = create<TruyLinhState>()(
  persist(
    (set, get) => ({
      bangs: [],
      setBangs: (v) => set({ bangs: v }),

      luuBang: (b, hanhDong, ghiChu) => {
        const cu = get().bangs.find((x) => x.id === b.id)
        const t = now()
        const { id, ten } = nguoi()
        const lichSu = hanhDong ? [...(b.lichSu ?? []), { luc: t, nguoi: ten, hanhDong, ...(ghiChu ? { ghiChu } : {}) }] : b.lichSu ?? []
        const ban: BangTruyLinh = { ...b, lichSu, createdAt: cu?.createdAt ?? t, updatedAt: t }
        set((s) => ({ bangs: cu ? s.bangs.map((x) => (x.id === b.id ? ban : x)) : [...s.bangs, ban] }))
        logAction(id, ten, hanhDong === 'DUYET' ? 'APPROVE' : hanhDong === 'TRA_LAI' ? 'REJECT' : cu ? 'UPDATE' : 'CREATE', 'BangTruyLinh', {
          entityId: b.id,
          donViId: b.donViId,
          moTa: `${hanhDong ? TEN_HANH_DONG[hanhDong] : 'Lưu'} bảng truy lĩnh ${TEN_KY_TRUY_LINH[b.ky]} ${b.nam} (${b.luong.length} nâng lương, ${b.pctn.length} PCTN)${ghiChu ? ` - ${ghiChu}` : ''}`,
        })
        return ban
      },

      xoaBang: (id) => {
        const b = get().bangs.find((x) => x.id === id)
        set((s) => ({ bangs: s.bangs.filter((x) => x.id !== id) }))
        const { id: uid, ten } = nguoi()
        logAction(uid, ten, 'DELETE', 'BangTruyLinh', { entityId: id, donViId: b?.donViId, moTa: `Xoá bản nháp bảng truy lĩnh ${id}` })
      },
    }),
    { name: 'ql-truy-linh', storage: persistStorage() },
  ),
)
