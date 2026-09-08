import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { DeXuatLuong, TrangThaiDeXuat, ChiTietDeXuat } from '@/types/deXuat'
import type { LyDoNangLuong } from '@/types/luong'
import { persistStorage } from '@/lib/supabase'
import { useLuongStore } from './luongStore'
import { useVienChucStore } from './vienChucStore'
import { useDanhMucStore } from './danhMucStore'

interface DeXuatState {
  deXuats: DeXuatLuong[]
  setDeXuats: (v: DeXuatLuong[]) => void
  addDeXuat: (d: Omit<DeXuatLuong, 'id' | 'ma' | 'createdAt' | 'updatedAt'>) => DeXuatLuong
  updateDeXuat: (id: string, patch: Partial<DeXuatLuong>) => void
  getAll: (donViId?: string | null) => DeXuatLuong[]
  getById: (id: string) => DeXuatLuong | undefined
  getCountByStatus: (trangThai: TrangThaiDeXuat, donViId?: string | null) => number

  submitDeXuat: (id: string, actorId: string, actorName: string) => void
  duyetHieuTruong: (id: string, ketQua: 'DONG_Y' | 'TU_CHOI' | 'YEU_CAU_BO_SUNG', ghiChu: string, actorId: string, actorName: string) => void
  xetDuyetDeXuat: (id: string, ketQua: 'DONG_Y' | 'TU_CHOI' | 'YEU_CAU_BO_SUNG', ghiChu: string, actorId: string, actorName: string) => void
  pheDuyetDeXuat: (id: string, ketQua: 'PHE_DUYET' | 'TU_CHOI', ghiChu: string, actorId: string, actorName: string) => void
}

const now = () => new Date().toISOString()
let _dxCounter = 1
const genMa = (donViId: string) => `DX-${new Date().getFullYear()}-${String(_dxCounter++).padStart(3, '0')}`

export const useDeXuatStore = create<DeXuatState>()(
  persist(
    (set, get) => ({
      deXuats: [],
      setDeXuats: (v) => set({ deXuats: v }),

      addDeXuat: (data) => {
        const item: DeXuatLuong = {
          ...data,
          id: nanoid(),
          ma: genMa(data.donViId),
          createdAt: now(),
          updatedAt: now(),
        }
        set((s) => ({ deXuats: [...s.deXuats, item] }))
        return item
      },

      updateDeXuat: (id, patch) =>
        set((s) => ({
          deXuats: s.deXuats.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: now() } : d)),
        })),

      getAll: (donViId) => {
        const list = get().deXuats
        return donViId ? list.filter((d) => d.donViId === donViId) : list
      },

      getById: (id) => get().deXuats.find((d) => d.id === id),

      getCountByStatus: (trangThai, donViId) =>
        get()
          .getAll(donViId)
          .filter((d) => d.trangThai === trangThai).length,

      submitDeXuat: (id, actorId, actorName) => {
        get().updateDeXuat(id, { trangThai: 'CHO_HIEU_TRUONG_DUYET', buocHienTai: 2, ngayDeXuat: now().slice(0, 10), nguoiDeXuatId: actorId })
        const { addNhatKy } = useLuongStore.getState()
        addNhatKy({ userId: actorId, userFullName: actorName, action: 'UPDATE', entity: 'DeXuatLuong', entityId: id, moTa: `Trình đề xuất ${id} lên Hiệu trưởng`, thoiGian: now() })
      },

      duyetHieuTruong: (id, ketQua, ghiChu, actorId, actorName) => {
        const patch: Partial<DeXuatLuong> = {
          nguoiDuyetHTId: actorId,
          ngayDuyetHT: now().slice(0, 10),
          ketQuaDuyetHT: ketQua,
          ghiChuDuyetHT: ghiChu,
        }
        if (ketQua === 'DONG_Y') {
          patch.trangThai = 'CHO_XET_DUYET'
          patch.buocHienTai = 3
        } else if (ketQua === 'TU_CHOI') {
          patch.trangThai = 'TU_CHOI'
        } else {
          patch.trangThai = 'YEU_CAU_BO_SUNG'
        }
        get().updateDeXuat(id, patch)
        const { addNhatKy } = useLuongStore.getState()
        addNhatKy({ userId: actorId, userFullName: actorName, action: ketQua === 'DONG_Y' ? 'APPROVE' : 'REJECT', entity: 'DeXuatLuong', entityId: id, moTa: `Hiệu trưởng duyệt đề xuất ${id}: ${ketQua}`, thoiGian: now() })
      },

      xetDuyetDeXuat: (id, ketQua, ghiChu, actorId, actorName) => {
        const patch: Partial<DeXuatLuong> = {
          nguoiXetDuyetId: actorId,
          ngayXetDuyet: now().slice(0, 10),
          ketQuaXetDuyet: ketQua,
          ghiChuXetDuyet: ghiChu,
        }
        if (ketQua === 'DONG_Y') {
          patch.trangThai = 'CHO_PHE_DUYET'
          patch.buocHienTai = 4
        } else if (ketQua === 'TU_CHOI') {
          patch.trangThai = 'TU_CHOI'
        } else {
          patch.trangThai = 'YEU_CAU_BO_SUNG'
        }
        get().updateDeXuat(id, patch)
        const { addNhatKy } = useLuongStore.getState()
        addNhatKy({ userId: actorId, userFullName: actorName, action: ketQua === 'DONG_Y' ? 'APPROVE' : 'REJECT', entity: 'DeXuatLuong', entityId: id, moTa: `VH-XH xét duyệt đề xuất ${id}: ${ketQua}`, thoiGian: now() })
      },

      pheDuyetDeXuat: (id, ketQua, ghiChu, actorId, actorName) => {
        const dx = get().getById(id)
        if (!dx) return
        const patch: Partial<DeXuatLuong> = {
          nguoiPheDuyetId: actorId,
          ngayPheDuyet: now().slice(0, 10),
          ketQuaPheDuyet: ketQua,
          ghiChuPheDuyet: ghiChu,
          trangThai: ketQua === 'PHE_DUYET' ? 'DA_PHE_DUYET' : 'TU_CHOI',
        }
        get().updateDeXuat(id, patch)

        if (ketQua === 'PHE_DUYET' && dx.loai === 'PHU_CAP_THAM_NIEN') {
          // Phiếu phụ cấp thâm niên: cập nhật PCTN vào Phụ cấp + Lịch sử biến động
          const { addPhuCap, deactivatePhuCap, getActivePhuCaps, addLichSuBienDong, addNhatKy } =
            useLuongStore.getState()
          const loaiPctn = useDanhMucStore.getState().loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN')
          const { updateVienChuc } = useVienChucStore.getState()

          dx.chiTiet.forEach((ct: ChiTietDeXuat) => {
            if (!loaiPctn) return
            const cu = getActivePhuCaps(ct.vienChucId).find((p) => p.loaiPhuCapId === loaiPctn.id)
            if (cu) deactivatePhuCap(cu.id)

            // Ghi mốc hưởng PCTN mới vào hồ sơ để làm căn cứ cho kỳ đề xuất sau
            updateVienChuc(ct.vienChucId, { mocHuongPctn: ct.ngayHieuLuc })

            addPhuCap({
              vienChucId: ct.vienChucId,
              loaiPhuCapId: loaiPctn.id,
              giaTri: ct.pctnMoi ?? 0,
              ngayHieuLuc: ct.ngayHieuLuc,
              ghiChu: `Theo đề xuất ${dx.ma}`,
              isActive: true,
              createdBy: actorId,
            })

            addLichSuBienDong({
              vienChucId: ct.vienChucId,
              loai: 'PHU_CAP',
              truongThayDoi: 'Phụ cấp thâm niên',
              giaTriCu: cu ? `${cu.giaTri}%` : `${ct.pctnCu ?? 0}%`,
              giaTriMoi: `${ct.pctnMoi ?? 0}%`,
              ngayThayDoi: ct.ngayHieuLuc,
              nguoiThayDoiId: actorId,
              deXuatId: id,
            })
          })

          addNhatKy({ userId: actorId, userFullName: actorName, action: 'APPROVE', entity: 'DeXuatLuong', entityId: id, moTa: `Lãnh đạo phê duyệt đề xuất phụ cấp thâm niên ${id}`, thoiGian: now() })
        } else if (ketQua === 'PHE_DUYET') {
          const { addHeSoLuong, deactivateHeSoLuong, getActiveHeSo, addLichSuBienDong, addNhatKy } =
            useLuongStore.getState()
          const { updateVienChuc } = useVienChucStore.getState()

          dx.chiTiet.forEach((ct: ChiTietDeXuat) => {
            const cur = getActiveHeSo(ct.vienChucId)
            if (cur) deactivateHeSoLuong(cur.id)

            const thoiGian = ct.bacMoi <= 8 ? (2 as const) : (3 as const)
            const ngayTiepTheo = new Date(ct.ngayHieuLuc)
            ngayTiepTheo.setFullYear(ngayTiepTheo.getFullYear() + thoiGian)

            const newHeSo = addHeSoLuong({
              vienChucId: ct.vienChucId,
              chucDanhId: ct.chucDanhMoiId,
              bac: ct.bacMoi,
              heSo: ct.heSoMoi,
              ngayHieuLuc: ct.ngayHieuLuc,
              ngayNangLuongTiepTheo: ngayTiepTheo.toISOString().slice(0, 10),
              lyDo: 'NANG_BAC' as LyDoNangLuong,
              deXuatId: id,
              isActive: true,
              createdBy: actorId,
            })

            updateVienChuc(ct.vienChucId, {
              heSoLuongHienTaiId: newHeSo.id,
              chucDanhId: ct.chucDanhMoiId,
            })

            addLichSuBienDong({
              vienChucId: ct.vienChucId,
              loai: 'LUONG',
              truongThayDoi: 'Hệ số lương',
              giaTriCu: cur ? `Bậc ${cur.bac} - Hệ số ${cur.heSo}` : '',
              giaTriMoi: `Bậc ${ct.bacMoi} - Hệ số ${ct.heSoMoi}`,
              ngayThayDoi: ct.ngayHieuLuc,
              nguoiThayDoiId: actorId,
              deXuatId: id,
            })
          })

          addNhatKy({ userId: actorId, userFullName: actorName, action: 'APPROVE', entity: 'DeXuatLuong', entityId: id, moTa: `Lãnh đạo phê duyệt đề xuất ${id}`, thoiGian: now() })
        } else {
          const { addNhatKy } = useLuongStore.getState()
          addNhatKy({ userId: actorId, userFullName: actorName, action: 'REJECT', entity: 'DeXuatLuong', entityId: id, moTa: `Lãnh đạo từ chối đề xuất ${id}`, thoiGian: now() })
        }
      },
    }),
    { name: 'ql-de-xuat', storage: persistStorage() }
  )
)
