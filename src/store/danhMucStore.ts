import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { persistStorage } from '@/lib/supabase'
import type {
  ChucDanhNgheNghiep,
  ViTriViecLam,
  BacLuong,
  MucLuongCoso,
  LoaiPhuCap,
  VtvlDanhMuc,
  ChucVuDanhMuc,
} from '@/types/danhMuc'
import type { DonVi } from '@/types/donVi'
import type { QuyMoTruong, QuyMoLichSu } from '@/types/quyMo'
import { layNoiDung, giongNhau } from '@/utils/quyMoLichSu'

interface DanhMucState {
  donVis: DonVi[]
  quyMoTruongs: QuyMoTruong[]
  /** Mỗi lần lưu quy mô để lại một bản, giữ tối đa SO_BAN_LICH_SU_QUY_MO bản gần nhất cho mỗi trường và năm học */
  quyMoLichSu: QuyMoLichSu[]
  chucDanhs: ChucDanhNgheNghiep[]
  viTriViecLams: ViTriViecLam[]
  bacLuongs: BacLuong[]
  mucLuongCosos: MucLuongCoso[]
  loaiPhuCaps: LoaiPhuCap[]
  vtvls: VtvlDanhMuc[]
  chucVus: ChucVuDanhMuc[]

  setDonVis: (v: DonVi[]) => void
  addDonVi: (d: Omit<DonVi, 'id' | 'createdAt'>) => DonVi
  updateDonVi: (id: string, patch: Partial<DonVi>) => void

  /** Ghi đè theo id (một bản ghi cho mỗi trường, mỗi năm học) */
  luuQuyMo: (qm: Omit<QuyMoTruong, 'createdAt' | 'updatedAt'>) => void

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

  setVtvls: (v: VtvlDanhMuc[]) => void
  addVtvl: (d: Omit<VtvlDanhMuc, 'id'>) => VtvlDanhMuc
  updateVtvl: (id: string, patch: Partial<VtvlDanhMuc>) => void

  setChucVus: (v: ChucVuDanhMuc[]) => void
  addChucVu: (d: Omit<ChucVuDanhMuc, 'id'>) => ChucVuDanhMuc
  updateChucVu: (id: string, patch: Partial<ChucVuDanhMuc>) => void

  getActiveMucLuongCoso: (date?: string) => MucLuongCoso | undefined
  getBacLuongsForChucDanh: (chucDanhId: string) => BacLuong[]
}

const now = () => new Date().toISOString()

const SO_BAN_LICH_SU_QUY_MO = 30

export const useDanhMucStore = create<DanhMucState>()(
  persist(
    (set, get) => ({
      donVis: [],
      quyMoTruongs: [],
      quyMoLichSu: [],
      chucDanhs: [],
      viTriViecLams: [],
      bacLuongs: [],
      mucLuongCosos: [],
      loaiPhuCaps: [],
      vtvls: [],
      chucVus: [],

      setDonVis: (v) => set({ donVis: v }),
      addDonVi: (d) => {
        const item: DonVi = { ...d, id: nanoid(), createdAt: now() }
        set((s) => ({ donVis: [...s.donVis, item] }))
        return item
      },
      updateDonVi: (id, patch) =>
        set((s) => ({ donVis: s.donVis.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),

      luuQuyMo: (qm) =>
        set((s) => {
          const cu = s.quyMoTruongs.find((q) => q.id === qm.id)
          const t = now()
          const ban: QuyMoTruong = { ...qm, createdAt: cu?.createdAt ?? t, updatedAt: t }
          const quyMoTruongs = cu ? s.quyMoTruongs.map((q) => (q.id === qm.id ? ban : q)) : [...s.quyMoTruongs, ban]

          // Lịch sử: lần đầu có lịch sử thì lưu cả bản đang có làm mốc, rồi bản vừa lưu (bỏ qua nếu y hệt bản trước)
          const lichSuCu = s.quyMoLichSu ?? []
          const cuaBan = lichSuCu.filter((l) => l.quyMoId === qm.id).sort((a, b) => a.thoiGian.localeCompare(b.thoiGian))
          const moi: QuyMoLichSu[] = []
          if (cu && !cuaBan.length) {
            moi.push({
              id: nanoid(), quyMoId: qm.id, donViId: qm.donViId, namHoc: qm.namHoc, thoiGian: cu.updatedAt || t,
              nguoiId: cu.nguoiCapNhatId, nguoiTen: cu.nguoiCapNhat, noiDung: layNoiDung(cu), ghiChuBan: 'Bản có sẵn trước khi có lịch sử',
            })
          }
          const noiDungMoi = layNoiDung(ban)
          const truoc = moi.at(-1)?.noiDung ?? cuaBan.at(-1)?.noiDung
          if (!truoc || !giongNhau(truoc, noiDungMoi)) {
            moi.push({
              id: nanoid(), quyMoId: qm.id, donViId: qm.donViId, namHoc: qm.namHoc, thoiGian: t,
              nguoiId: qm.nguoiCapNhatId, nguoiTen: qm.nguoiCapNhat, noiDung: noiDungMoi,
            })
          }
          if (!moi.length) return { quyMoTruongs }
          const giu = new Set([...cuaBan, ...moi].sort((a, b) => b.thoiGian.localeCompare(a.thoiGian)).slice(0, SO_BAN_LICH_SU_QUY_MO).map((l) => l.id))
          const quyMoLichSu = [...lichSuCu, ...moi].filter((l) => l.quyMoId !== qm.id || giu.has(l.id))
          return { quyMoTruongs, quyMoLichSu }
        }),

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

      setVtvls: (v) => set({ vtvls: v }),
      addVtvl: (d) => {
        const item: VtvlDanhMuc = { ...d, id: nanoid() }
        set((s) => ({ vtvls: [...s.vtvls, item] }))
        return item
      },
      updateVtvl: (id, patch) =>
        set((s) => ({ vtvls: s.vtvls.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),

      setChucVus: (v) => set({ chucVus: v }),
      addChucVu: (d) => {
        const item: ChucVuDanhMuc = { ...d, id: nanoid() }
        set((s) => ({ chucVus: [...s.chucVus, item] }))
        return item
      },
      updateChucVu: (id, patch) =>
        set((s) => ({ chucVus: s.chucVus.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),

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
    { name: 'ql-danh-muc', storage: persistStorage() }
  )
)
