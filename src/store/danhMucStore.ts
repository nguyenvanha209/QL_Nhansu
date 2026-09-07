import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type {
  ChucDanhNgheNghiep,
  ViTriViecLam,
  BacLuong,
  MucLuongCoso,
  LoaiPhuCap,
} from '@/types/danhMuc'
import type { DonVi } from '@/types/donVi'

interface DanhMucState {
  donVis: DonVi[]
  chucDanhs: ChucDanhNgheNghiep[]
  viTriViecLams: ViTriViecLam[]
  bacLuongs: BacLuong[]
  mucLuongCosos: MucLuongCoso[]
  loaiPhuCaps: LoaiPhuCap[]

  setDonVis: (v: DonVi[]) => void
  addDonVi: (d: Omit<DonVi, 'id' | 'createdAt'>) => DonVi
  updateDonVi: (id: string, patch: Partial<DonVi>) => void

  setChucDanhs: (v: ChucDanhNgheNghiep[]) => void
  addChucDanh: (d: Omit<ChucDanhNgheNghiep, 'id'>) => ChucDanhNgheNghiep
  updateChucDanh: (id: string, patch: Partial<ChucDanhNgheNghiep>) => void

  setViTriViecLams: (v: ViTriViecLam[]) => void
  addViTriViecLam: (d: Omit<ViTriViecLam, 'id'>) => ViTriViecLam
  updateViTriViecLam: (id: string, patch: Partial<ViTriViecLam>) => void

  setBacLuongs: (v: BacLuong[]) => void
  addBacLuong: (d: Omit<BacLuong, 'id'>) => BacLuong
  updateBacLuong: (id: string, patch: Partial<BacLuong>) => void

  setMucLuongCosos: (v: MucLuongCoso[]) => void
  addMucLuongCoso: (d: Omit<MucLuongCoso, 'id'>) => MucLuongCoso
  updateMucLuongCoso: (id: string, patch: Partial<MucLuongCoso>) => void

  setLoaiPhuCaps: (v: LoaiPhuCap[]) => void
  addLoaiPhuCap: (d: Omit<LoaiPhuCap, 'id'>) => LoaiPhuCap
  updateLoaiPhuCap: (id: string, patch: Partial<LoaiPhuCap>) => void

  getActiveMucLuongCoso: (date?: string) => MucLuongCoso | undefined
  getBacLuongsForChucDanh: (chucDanhId: string) => BacLuong[]
}

const now = () => new Date().toISOString()

export const useDanhMucStore = create<DanhMucState>()(
  persist(
    (set, get) => ({
      donVis: [],
      chucDanhs: [],
      viTriViecLams: [],
      bacLuongs: [],
      mucLuongCosos: [],
      loaiPhuCaps: [],

      setDonVis: (v) => set({ donVis: v }),
      addDonVi: (d) => {
        const item: DonVi = { ...d, id: nanoid(), createdAt: now() }
        set((s) => ({ donVis: [...s.donVis, item] }))
        return item
      },
      updateDonVi: (id, patch) =>
        set((s) => ({ donVis: s.donVis.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),

      setChucDanhs: (v) => set({ chucDanhs: v }),
      addChucDanh: (d) => {
        const item: ChucDanhNgheNghiep = { ...d, id: nanoid() }
        set((s) => ({ chucDanhs: [...s.chucDanhs, item] }))
        return item
      },
      updateChucDanh: (id, patch) =>
        set((s) => ({ chucDanhs: s.chucDanhs.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),

      setViTriViecLams: (v) => set({ viTriViecLams: v }),
      addViTriViecLam: (d) => {
        const item: ViTriViecLam = { ...d, id: nanoid() }
        set((s) => ({ viTriViecLams: [...s.viTriViecLams, item] }))
        return item
      },
      updateViTriViecLam: (id, patch) =>
        set((s) => ({
          viTriViecLams: s.viTriViecLams.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),

      setBacLuongs: (v) => set({ bacLuongs: v }),
      addBacLuong: (d) => {
        const item: BacLuong = { ...d, id: nanoid() }
        set((s) => ({ bacLuongs: [...s.bacLuongs, item] }))
        return item
      },
      updateBacLuong: (id, patch) =>
        set((s) => ({ bacLuongs: s.bacLuongs.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),

      setMucLuongCosos: (v) => set({ mucLuongCosos: v }),
      addMucLuongCoso: (d) => {
        const item: MucLuongCoso = { ...d, id: nanoid() }
        set((s) => ({ mucLuongCosos: [...s.mucLuongCosos, item] }))
        return item
      },
      updateMucLuongCoso: (id, patch) =>
        set((s) => ({
          mucLuongCosos: s.mucLuongCosos.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),

      setLoaiPhuCaps: (v) => set({ loaiPhuCaps: v }),
      addLoaiPhuCap: (d) => {
        const item: LoaiPhuCap = { ...d, id: nanoid() }
        set((s) => ({ loaiPhuCaps: [...s.loaiPhuCaps, item] }))
        return item
      },
      updateLoaiPhuCap: (id, patch) =>
        set((s) => ({
          loaiPhuCaps: s.loaiPhuCaps.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),

      getActiveMucLuongCoso: (date = new Date().toISOString().slice(0, 10)) => {
        return get()
          .mucLuongCosos.filter((m) => m.hieuLucTu <= date && (!m.hieuLucDen || m.hieuLucDen >= date))
          .sort((a, b) => b.hieuLucTu.localeCompare(a.hieuLucTu))[0]
      },

      getBacLuongsForChucDanh: (chucDanhId) =>
        get()
          .bacLuongs.filter((b) => b.chucDanhId === chucDanhId)
          .sort((a, b) => a.bac - b.bac),
    }),
    { name: 'ql-danh-muc' }
  )
)
