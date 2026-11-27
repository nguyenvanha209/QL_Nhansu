import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { persistStorage } from '@/lib/supabase'
import type { DangKyLdtl, LichSuDangKy } from '@/types/dangKyLdtl'
import { TEN_KY_DANG_KY } from '@/types/dangKyLdtl'
import { logAction } from '@/utils/auditLogger'
import { useAuthStore } from './authStore'

// Đăng ký lao động tiền lương theo kỳ 6 tháng. Lưu chia theo đơn vị (khoá ql-dang-ky-ldtl::<đơn vị>) như truy lĩnh:
// tài khoản đơn vị chỉ đọc, ghi được bản của đơn vị mình (tools/sql/12).

interface DangKyLdtlState {
  dangKys: DangKyLdtl[]
  setDangKys: (v: DangKyLdtl[]) => void
  /** Tạo mới hoặc ghi đè theo id; `hanhDong` thêm một dòng lịch sử */
  luu: (b: Omit<DangKyLdtl, 'createdAt' | 'updatedAt'>, hanhDong?: LichSuDangKy['hanhDong'], ghiChu?: string) => DangKyLdtl
  xoa: (id: string) => void
}

const now = () => new Date().toISOString()
const nguoi = () => {
  const u = useAuthStore.getState().currentUser
  return { id: u?.id ?? 'system', ten: u?.fullName ?? 'Hệ thống' }
}
const TEN_HANH_DONG: Record<LichSuDangKy['hanhDong'], string> = {
  LAP: 'Lập / cập nhật', TRINH: 'Trình Thủ trưởng', THU_TRUONG_DUYET: 'Thủ trưởng duyệt', THAM_DINH: 'Thẩm định',
  DUYET: 'Phê duyệt', TRA_LAI: 'Trả lại', MO_LAI: 'Mở lại để sửa',
}

export const useDangKyLdtlStore = create<DangKyLdtlState>()(
  persist(
    (set, get) => ({
      dangKys: [],
      setDangKys: (v) => set({ dangKys: v }),

      luu: (b, hanhDong, ghiChu) => {
        const cu = get().dangKys.find((x) => x.id === b.id)
        const t = now()
        const { id, ten } = nguoi()
        const lichSu = hanhDong ? [...(b.lichSu ?? []), { luc: t, nguoi: ten, hanhDong, ...(ghiChu ? { ghiChu } : {}) }] : b.lichSu ?? []
        const ban: DangKyLdtl = { ...b, lichSu, createdAt: cu?.createdAt ?? t, updatedAt: t }
        set((s) => ({ dangKys: cu ? s.dangKys.map((x) => (x.id === b.id ? ban : x)) : [...s.dangKys, ban] }))
        logAction(id, ten, hanhDong === 'DUYET' || hanhDong === 'THU_TRUONG_DUYET' || hanhDong === 'THAM_DINH' ? 'APPROVE' : hanhDong === 'TRA_LAI' ? 'REJECT' : cu ? 'UPDATE' : 'CREATE', 'DangKyLdtl', {
          entityId: b.id,
          donViId: b.donViId,
          moTa: `${hanhDong ? TEN_HANH_DONG[hanhDong] : 'Lưu'} đăng ký lao động tiền lương ${TEN_KY_DANG_KY[b.ky]} ${b.nam} (${b.dong.length} người)${ghiChu ? ` - ${ghiChu}` : ''}`,
        })
        return ban
      },

      xoa: (id) => {
        const b = get().dangKys.find((x) => x.id === id)
        set((s) => ({ dangKys: s.dangKys.filter((x) => x.id !== id) }))
        const { id: uid, ten } = nguoi()
        logAction(uid, ten, 'DELETE', 'DangKyLdtl', { entityId: id, donViId: b?.donViId, moTa: `Xoá bản nháp đăng ký lao động tiền lương ${id}` })
      },
    }),
    { name: 'ql-dang-ky-ldtl', storage: persistStorage() },
  ),
)
