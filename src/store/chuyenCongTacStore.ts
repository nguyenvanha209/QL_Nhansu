import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { DeXuatChuyenCongTac } from '@/types/chuyenCongTac'
import type { VTVL, ChucVu } from '@/types/vienChuc'
import { persistStorage } from '@/lib/supabase'
import { useVienChucStore } from './vienChucStore'
import { useDanhMucStore } from './danhMucStore'
import { useLuongStore } from './luongStore'

export interface DuLieuTiepNhan {
  vtvl?: VTVL
  chucVu?: ChucVu
  viTriViecLamId?: string
  ngayVaoDonVi: string
}

interface ChuyenCongTacState {
  deXuats: DeXuatChuyenCongTac[]
  setDeXuats: (v: DeXuatChuyenCongTac[]) => void

  /** Đề xuất mà đơn vị này liên quan — là trường đi hoặc trường đến. Admin/VH-XH truyền null để xem tất cả. */
  getAll: (donViId?: string | null) => DeXuatChuyenCongTac[]
  getById: (id: string) => DeXuatChuyenCongTac | undefined
  /** Đang có phiếu chuyển chưa kết thúc cho viên chức này không */
  dangCoPhieuMo: (vienChucId: string) => boolean

  taoDeXuat: (
    d: Omit<DeXuatChuyenCongTac, 'id' | 'ma' | 'trangThai' | 'createdAt' | 'updatedAt'>,
    trinhNgay: boolean,
  ) => DeXuatChuyenCongTac
  capNhat: (id: string, patch: Partial<DeXuatChuyenCongTac>) => void
  xoa: (id: string) => void

  trinhDuyet: (id: string, actorId: string, actorName: string) => void
  duyet: (id: string, ghiChu: string, actorId: string, actorName: string) => void
  tuChoi: (id: string, ghiChu: string, actorId: string, actorName: string) => void
  tiepNhan: (id: string, data: DuLieuTiepNhan, actorId: string, actorName: string) => void
}

const now = () => new Date().toISOString()
const today = () => now().slice(0, 10)

let _counter = 1
const genMa = () => `CCT-${new Date().getFullYear()}-${String(_counter++).padStart(3, '0')}`

const tenDonVi = (id: string) =>
  useDanhMucStore.getState().donVis.find((d) => d.id === id)?.ten ?? id

export const useChuyenCongTacStore = create<ChuyenCongTacState>()(
  persist(
    (set, get) => ({
      deXuats: [],
      setDeXuats: (v) => set({ deXuats: v }),

      getAll: (donViId) => {
        const list = get().deXuats
        if (!donViId) return list
        return list.filter((d) => d.donViDiId === donViId || d.donViDenId === donViId)
      },

      getById: (id) => get().deXuats.find((d) => d.id === id),

      dangCoPhieuMo: (vienChucId) =>
        get().deXuats.some(
          (d) =>
            d.vienChucId === vienChucId &&
            (d.trangThai === 'NHAP' || d.trangThai === 'CHO_DUYET' || d.trangThai === 'DA_DUYET'),
        ),

      taoDeXuat: (data, trinhNgay) => {
        const item: DeXuatChuyenCongTac = {
          ...data,
          id: nanoid(),
          ma: genMa(),
          trangThai: trinhNgay ? 'CHO_DUYET' : 'NHAP',
          createdAt: now(),
          updatedAt: now(),
        }
        set((s) => ({ deXuats: [...s.deXuats, item] }))
        useLuongStore.getState().addNhatKy({
          userId: data.nguoiDeXuatId,
          userFullName: '',
          action: 'CREATE',
          entity: 'ChuyenCongTac',
          entityId: item.id,
          moTa: `Tạo đề nghị chuyển công tác ${item.ma}: ${data.hoTenSnapshot} → ${tenDonVi(data.donViDenId)}`,
          thoiGian: now(),
        })
        return item
      },

      capNhat: (id, patch) =>
        set((s) => ({
          deXuats: s.deXuats.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: now() } : d)),
        })),

      xoa: (id) => set((s) => ({ deXuats: s.deXuats.filter((d) => d.id !== id) })),

      trinhDuyet: (id, actorId, actorName) => {
        get().capNhat(id, { trangThai: 'CHO_DUYET', ngayDeXuat: today(), nguoiDeXuatId: actorId })
        useLuongStore.getState().addNhatKy({
          userId: actorId, userFullName: actorName, action: 'UPDATE',
          entity: 'ChuyenCongTac', entityId: id,
          moTa: `Trình đề nghị chuyển công tác ${id} lên Quản trị`, thoiGian: now(),
        })
      },

      // Duyệt: chuyển hồ sơ sang đơn vị mới, giữ nguyên ngạch/bậc/hệ số/phụ cấp.
      // Vị trí việc làm cũ gắn với trường cũ nên phải bỏ, chờ trường đến phân công lại.
      duyet: (id, ghiChu, actorId, actorName) => {
        const dx = get().getById(id)
        if (!dx || dx.trangThai !== 'CHO_DUYET') return

        const { getById: getVC, updateVienChuc } = useVienChucStore.getState()
        const vc = getVC(dx.vienChucId)
        if (!vc) return

        updateVienChuc(
          dx.vienChucId,
          { donViId: dx.donViDenId, trangThai: 'CHUYEN_DEN', viTriViecLamId: undefined },
          actorId,
          actorName,
        )

        const { addLichSuBienDong, addNhatKy } = useLuongStore.getState()
        addLichSuBienDong({
          vienChucId: dx.vienChucId,
          loai: 'DON_VI',
          truongThayDoi: 'Đơn vị công tác',
          giaTriCu: tenDonVi(dx.donViDiId),
          giaTriMoi: tenDonVi(dx.donViDenId),
          ngayThayDoi: dx.ngayChuyen,
          nguoiThayDoiId: actorId,
          deXuatId: id,
        })

        get().capNhat(id, {
          trangThai: 'DA_DUYET',
          nguoiDuyetId: actorId,
          ngayDuyet: today(),
          ghiChuDuyet: ghiChu,
        })

        addNhatKy({
          userId: actorId, userFullName: actorName, action: 'APPROVE',
          entity: 'ChuyenCongTac', entityId: id,
          moTa: `Duyệt chuyển công tác ${dx.ma}: ${dx.hoTenSnapshot} từ ${tenDonVi(dx.donViDiId)} sang ${tenDonVi(dx.donViDenId)}`,
          thoiGian: now(),
        })
      },

      tuChoi: (id, ghiChu, actorId, actorName) => {
        const dx = get().getById(id)
        if (!dx || dx.trangThai !== 'CHO_DUYET') return
        get().capNhat(id, {
          trangThai: 'TU_CHOI',
          nguoiDuyetId: actorId,
          ngayDuyet: today(),
          ghiChuDuyet: ghiChu,
        })
        useLuongStore.getState().addNhatKy({
          userId: actorId, userFullName: actorName, action: 'REJECT',
          entity: 'ChuyenCongTac', entityId: id,
          moTa: `Từ chối đề nghị chuyển công tác ${dx.ma}`, thoiGian: now(),
        })
      },

      // Trường đến phân công vị trí và ghi nhận thời điểm về đơn vị
      tiepNhan: (id, data, actorId, actorName) => {
        const dx = get().getById(id)
        if (!dx || dx.trangThai !== 'DA_DUYET') return

        const { updateVienChuc } = useVienChucStore.getState()
        updateVienChuc(
          dx.vienChucId,
          {
            vtvl: data.vtvl,
            chucVu: data.chucVu,
            viTriViecLamId: data.viTriViecLamId,
            ngayVaoDonVi: data.ngayVaoDonVi,
            trangThai: 'DANG_LAM_VIEC',
          },
          actorId,
          actorName,
        )

        const { addLichSuBienDong, addNhatKy } = useLuongStore.getState()
        addLichSuBienDong({
          vienChucId: dx.vienChucId,
          loai: 'TRANG_THAI',
          truongThayDoi: 'Tiếp nhận về đơn vị',
          giaTriCu: 'Chuyển đến',
          giaTriMoi: `Đang làm việc tại ${tenDonVi(dx.donViDenId)}`,
          ngayThayDoi: data.ngayVaoDonVi,
          nguoiThayDoiId: actorId,
          deXuatId: id,
        })

        get().capNhat(id, {
          trangThai: 'HOAN_TAT',
          nguoiTiepNhanId: actorId,
          ngayTiepNhan: today(),
          vtvlMoi: data.vtvl,
          chucVuMoi: data.chucVu,
          viTriViecLamMoiId: data.viTriViecLamId,
          ngayVaoDonViMoi: data.ngayVaoDonVi,
        })

        addNhatKy({
          userId: actorId, userFullName: actorName, action: 'UPDATE',
          entity: 'ChuyenCongTac', entityId: id,
          moTa: `Tiếp nhận ${dx.hoTenSnapshot} về ${tenDonVi(dx.donViDenId)} từ ${data.ngayVaoDonVi}`,
          thoiGian: now(),
        })
      },
    }),
    { name: 'ql-chuyen-cong-tac', storage: persistStorage() },
  ),
)
