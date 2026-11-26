import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { KhoiDonVi } from '@/types/donVi'

// Khối đang xem (ô chọn ở đầu trang) - chỉ dành cho tài khoản xem toàn phường (Phòng VHXH, lãnh đạo, quản trị).
// Là lựa chọn hiển thị riêng của từng máy, không đồng bộ lên máy chủ. null = tất cả các khối.
interface KhoiState {
  khoi: KhoiDonVi | null
  datKhoi: (k: KhoiDonVi | null) => void
}

const khoAnToan = {
  getItem: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* bỏ qua */ } },
  removeItem: (k: string) => { try { localStorage.removeItem(k) } catch { /* bỏ qua */ } },
}

export const useKhoiStore = create<KhoiState>()(
  persist(
    (set) => ({ khoi: null, datKhoi: (khoi) => set({ khoi }) }),
    { name: 'ql-khoi-dang-xem', storage: createJSONStorage(() => khoAnToan) },
  ),
)
