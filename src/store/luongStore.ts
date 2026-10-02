import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { HeSoLuong, PhuCapVienChuc, LichSuBienDong, NhatKyThaoTac } from '@/types/luong'
import { persistStorage } from '@/lib/supabase'
import { useNhatKyStore } from './nhatKyStore'
import { useDanhMucStore } from './danhMucStore'
import { hoPhuCap, ngayKetThucKhiThay } from '@/utils/phuCapDangHuong'

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
  /** Xoá hẳn bản ghi nhập sai (chỉ quản trị dùng khi xử lý dữ liệu trùng) */
  xoaPhuCap: (id: string) => void
  xoaHeSoLuong: (id: string) => void
  getActivePhuCaps: (vienChucId: string) => PhuCapVienChuc[]

  setLichSuBienDongs: (v: LichSuBienDong[]) => void
  addLichSuBienDong: (d: Omit<LichSuBienDong, 'id'>) => void
  getLichSuByVienChuc: (vienChucId: string) => LichSuBienDong[]

  addNhatKy: (d: Omit<NhatKyThaoTac, 'id'>) => void
  setNhatKyThaoTacs: (v: NhatKyThaoTac[]) => void
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
          heSoLuongs: s.heSoLuongs.map((h) => (h.id === id ? { ...h, ...patch, updatedAt: now() } : h)),
        })),
      deactivateHeSoLuong: (id) =>
        set((s) => ({
          heSoLuongs: s.heSoLuongs.map((h) => (h.id === id ? { ...h, isActive: false, updatedAt: now() } : h)),
        })),
      getActiveHeSo: (vienChucId) =>
        get().heSoLuongs.find((h) => h.vienChucId === vienChucId && h.isActive),
      getHeSoHistory: (vienChucId) =>
        get()
          .heSoLuongs.filter((h) => h.vienChucId === vienChucId)
          .sort((a, b) => b.ngayHieuLuc.localeCompare(a.ngayHieuLuc)),

      setPhuCapVienChucs: (v) => set({ phuCapVienChucs: v }),
      // Mỗi người chỉ một bản đang hưởng cho mỗi loại phụ cấp: ghi bản mới thì đóng bản cũ cùng loại.
      // Thiếu quy tắc này, lưu biểu mẫu trên máy chưa kịp nhận bản mới từ máy chủ đã sinh bản trùng.
      addPhuCap: (data) => {
        const item: PhuCapVienChuc = { ...data, id: nanoid(), createdAt: now() }
        const loais = useDanhMucStore.getState().loaiPhuCaps
        const ho = hoPhuCap(item.loaiPhuCapId, loais)
        const t = now()
        set((s) => ({
          phuCapVienChucs: [
            ...s.phuCapVienChucs.map((p) =>
              item.isActive && p.isActive && p.vienChucId === item.vienChucId && hoPhuCap(p.loaiPhuCapId, loais) === ho
                ? { ...p, isActive: false, ngayHetHan: ngayKetThucKhiThay(p.ngayHieuLuc, item.ngayHieuLuc), updatedAt: t }
                : p,
            ),
            item,
          ],
        }))
        return item
      },
      updatePhuCap: (id, patch) =>
        set((s) => ({
          phuCapVienChucs: s.phuCapVienChucs.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now() } : p)),
        })),
      deactivatePhuCap: (id) =>
        set((s) => ({
          phuCapVienChucs: s.phuCapVienChucs.map((p) =>
            p.id === id ? { ...p, isActive: false, ngayHetHan: now().slice(0, 10), updatedAt: now() } : p
          ),
        })),
      // Lọc bỏ khỏi mảng: lớp đồng bộ nhận ra id bị xoá có chủ đích và không kéo lại từ máy chủ
      xoaPhuCap: (id) => set((s) => ({ phuCapVienChucs: s.phuCapVienChucs.filter((p) => p.id !== id) })),
      xoaHeSoLuong: (id) => set((s) => ({ heSoLuongs: s.heSoLuongs.filter((h) => h.id !== id) })),
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

      // Nhật ký đã chuyển sang kho riêng ql-nhat-ky. Giữ lại hàm này và chuyển
      // hướng để mọi chỗ gọi cũ vẫn chạy đúng, không phải sửa hàng chục nơi.
      // Ghi vào đây trước kia có nghĩa là viết lại cả khối lương hơn 500KB, nên
      // hai người thao tác gần nhau là một bên mất bản ghi.
      setNhatKyThaoTacs: (v) => set({ nhatKyThaoTacs: v }),
      addNhatKy: (data) => {
        useNhatKyStore.getState().them(data)
      },
    }),
    { name: 'ql-luong', storage: persistStorage() }
  )
)
