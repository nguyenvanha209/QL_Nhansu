import { nanoid } from 'nanoid'
import dayjs from 'dayjs'
import type { BacLuong } from '@/types/danhMuc'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useUserStore } from '@/store/userStore'
import { useDeXuatStore } from '@/store/deXuatStore'

export function initSeedData() {
  // Check store state instead of localStorage so Supabase-backed stores are handled correctly
  if (useDanhMucStore.getState().donVis.length > 0) return

  const { setDonVis, setChucDanhs, setBacLuongs, setMucLuongCosos, setLoaiPhuCaps, setViTriViecLams } =
    useDanhMucStore.getState()
  const { setVienChucs } = useVienChucStore.getState()
  const { setHeSoLuongs, setPhuCapVienChucs } = useLuongStore.getState()
  const { setUsers } = useUserStore.getState()
  const { setDeXuats } = useDeXuatStore.getState()

  // --- Đơn vị ---
  const donVis = [
    { id: 'dv1', ma: 'MN01', ten: 'Trường MN Gia Viên', loai: 'MAM_NON' as const, diaChi: 'Phường Gia Viên', active: true, createdAt: d('2020-01-01') },
    { id: 'dv2', ma: 'TH01', ten: 'Trường TH Gia Viên 1', loai: 'TIEU_HOC' as const, diaChi: 'Phường Gia Viên', active: true, createdAt: d('2020-01-01') },
    { id: 'dv3', ma: 'TH02', ten: 'Trường TH Gia Viên 2', loai: 'TIEU_HOC' as const, diaChi: 'Phường Gia Viên', active: true, createdAt: d('2020-01-01') },
    { id: 'dv4', ma: 'CS01', ten: 'Trường THCS Gia Viên', loai: 'THCS' as const, diaChi: 'Phường Gia Viên', active: true, createdAt: d('2020-01-01') },
    { id: 'dv5', ma: 'CS02', ten: 'Trường THCS Phạm Hồng Thái', loai: 'THCS' as const, diaChi: 'Phường Gia Viên', active: true, createdAt: d('2020-01-01') },
  ]
  setDonVis(donVis)

  // --- Chức danh ---
  const chucDanhs = [
    { id: 'cd1', ma: 'GVMN', ten: 'Giáo viên Mầm non', nhom: 'GIAO_VIEN' as const, bangLuong: 'A1', active: true },
    { id: 'cd2', ma: 'GVTH', ten: 'Giáo viên Tiểu học', nhom: 'GIAO_VIEN' as const, bangLuong: 'A1', active: true },
    { id: 'cd3', ma: 'GVTHCS', ten: 'Giáo viên THCS', nhom: 'GIAO_VIEN' as const, bangLuong: 'A1', active: true },
    { id: 'cd4', ma: 'HT', ten: 'Hiệu trưởng', nhom: 'QUAN_LY' as const, bangLuong: 'A1', active: true },
    { id: 'cd5', ma: 'PHT', ten: 'Phó Hiệu trưởng', nhom: 'QUAN_LY' as const, bangLuong: 'A1', active: true },
    { id: 'cd6', ma: 'KT', ten: 'Kế toán', nhom: 'NHAN_VIEN' as const, bangLuong: 'A0', active: true },
    { id: 'cd7', ma: 'VT', ten: 'Văn thư', nhom: 'NHAN_VIEN' as const, bangLuong: 'B', active: true },
    { id: 'cd8', ma: 'YT', ten: 'Y tế học đường', nhom: 'NHAN_VIEN' as const, bangLuong: 'B', active: true },
  ]
  setChucDanhs(chucDanhs)

  // --- Bậc lương ---
  const bacLuongs: BacLuong[] = []
  const gvBacs = [
    { bac: 1, heSo: 2.34 }, { bac: 2, heSo: 2.67 }, { bac: 3, heSo: 3.00 },
    { bac: 4, heSo: 3.33 }, { bac: 5, heSo: 3.66 }, { bac: 6, heSo: 3.99 },
    { bac: 7, heSo: 4.32 }, { bac: 8, heSo: 4.65 }, { bac: 9, heSo: 4.98 },
  ]
  ;['cd1', 'cd2', 'cd3', 'cd4', 'cd5'].forEach((cdId) => {
    gvBacs.forEach((b) => bacLuongs.push({ id: nanoid(), chucDanhId: cdId, bac: b.bac, heSo: b.heSo, thoiGianNangLuong: 3 as const }))
  })
  const nvBacs = [
    { bac: 1, heSo: 2.10 }, { bac: 2, heSo: 2.41 }, { bac: 3, heSo: 2.72 },
    { bac: 4, heSo: 3.03 }, { bac: 5, heSo: 3.34 }, { bac: 6, heSo: 3.65 },
  ]
  ;['cd6', 'cd7', 'cd8'].forEach((cdId) => {
    nvBacs.forEach((b) => bacLuongs.push({ id: nanoid(), chucDanhId: cdId, bac: b.bac, heSo: b.heSo, thoiGianNangLuong: 2 as const }))
  })
  setBacLuongs(bacLuongs)

  // --- Mức lương cơ sở ---
  setMucLuongCosos([
    { id: 'mlcs1', mucLuong: 1800000, hieuLucTu: '2019-07-01', hieuLucDen: '2023-06-30', quyetDinhSo: 'NĐ 38/2019' },
    { id: 'mlcs2', mucLuong: 1800000, hieuLucTu: '2023-07-01', hieuLucDen: '2024-06-30', quyetDinhSo: 'NĐ 24/2023' },
    { id: 'mlcs3', mucLuong: 2340000, hieuLucTu: '2024-07-01', hieuLucDen: '2026-06-30', quyetDinhSo: 'NĐ 73/2024' },
    { id: 'mlcs4', mucLuong: 2530000, hieuLucTu: '2026-07-01', quyetDinhSo: 'NĐ 161/2026' },
  ])

  // --- Loại phụ cấp ---
  setLoaiPhuCaps([
    { id: 'pc1', ma: 'PCUD_35', ten: 'PC Ưu đãi nghề (35%)', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 35, moTa: 'Giáo viên MN, TH - NĐ 182/2026', active: true },
    { id: 'pc2', ma: 'PCUD_30', ten: 'PC Ưu đãi nghề (30%)', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 30, moTa: 'Giáo viên THCS - NĐ 182/2026', active: true },
    { id: 'pc3', ma: 'PCUD_20', ten: 'PC Ưu đãi nghề (20%)', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 20, moTa: 'Nhân viên hỗ trợ - NĐ 182/2026', active: true },
    { id: 'pc4', ma: 'PCCV_HT', ten: 'PC Chức vụ Hiệu trưởng', loaiCongThuc: 'PHAN_TRAM_LUONG_CO_SO' as const, giaTri: 25, moTa: 'PC chức vụ lãnh đạo', active: true },
    { id: 'pc5', ma: 'PCCV_PHT', ten: 'PC Chức vụ Phó Hiệu trưởng', loaiCongThuc: 'PHAN_TRAM_LUONG_CO_SO' as const, giaTri: 15, moTa: 'PC chức vụ lãnh đạo', active: true },
  ])

  // --- Vị trí việc làm ---
  const viTriData: Array<{ ten: string; loai: 'QUAN_LY' | 'CHUYEN_MON' | 'HO_TRO'; soLuongBienChe: number; soLuongHopDong: number; chucDanhIds: string[] }> = [
    { ten: 'Hiệu trưởng', loai: 'QUAN_LY', soLuongBienChe: 1, soLuongHopDong: 0, chucDanhIds: ['cd4'] },
    { ten: 'Phó Hiệu trưởng', loai: 'QUAN_LY', soLuongBienChe: 2, soLuongHopDong: 0, chucDanhIds: ['cd5'] },
    { ten: 'Giáo viên đứng lớp', loai: 'CHUYEN_MON', soLuongBienChe: 15, soLuongHopDong: 3, chucDanhIds: ['cd1', 'cd2', 'cd3'] },
    { ten: 'Kế toán', loai: 'HO_TRO', soLuongBienChe: 1, soLuongHopDong: 0, chucDanhIds: ['cd6'] },
    { ten: 'Văn thư - Thư viện', loai: 'HO_TRO', soLuongBienChe: 1, soLuongHopDong: 1, chucDanhIds: ['cd7'] },
  ]
  const viTriViecLams: any[] = []
  donVis.forEach((dv) => {
    viTriData.forEach((vt) => {
      viTriViecLams.push({ id: nanoid(), ma: `${vt.ten.substring(0, 3).toUpperCase()}-${dv.ma}`, ten: vt.ten, loai: vt.loai, donViId: dv.id, soLuongBienChe: vt.soLuongBienChe, soLuongHopDong: vt.soLuongHopDong, chucDanhIds: vt.chucDanhIds, active: true })
    })
  })
  setViTriViecLams(viTriViecLams)

  // --- Viên chức + Hệ số lương ---
  const names = [
    ['Nguyễn Thị', 'Lan'], ['Trần Văn', 'Hùng'], ['Lê Thị', 'Hoa'], ['Phạm Văn', 'Nam'],
    ['Hoàng Thị', 'Mai'], ['Đỗ Văn', 'Dũng'], ['Vũ Thị', 'Linh'], ['Bùi Văn', 'Tuấn'],
    ['Đặng Thị', 'Thu'], ['Ngô Văn', 'Cường'],
  ]
  const loaiLDs = ['VIEN_CHUC', 'VIEN_CHUC', 'VIEN_CHUC', 'VIEN_CHUC', 'VIEN_CHUC', 'VIEN_CHUC', 'HOP_DONG_235', 'HOP_DONG_235', 'TAP_SU', 'HOP_DONG_TRUONG'] as const
  const gioiTinhs: Array<'NAM' | 'NU'> = ['NU', 'NAM', 'NU', 'NAM', 'NU', 'NAM', 'NU', 'NAM', 'NU', 'NAM']
  const birthYears = [1975, 1980, 1982, 1978, 1985, 1990, 1988, 1992, 1995, 1970]
  const chucDanhMap: Record<string, string> = { dv1: 'cd1', dv2: 'cd2', dv3: 'cd2', dv4: 'cd3', dv5: 'cd3' }

  const allVCs: any[] = []
  const allHeSos: any[] = []
  const allPhuCaps: any[] = []

  donVis.forEach((dv, di) => {
    names.forEach(([ho, ten], i) => {
      const vcId = nanoid()
      const hslId = nanoid()
      const gioiTinh = i % 2 === 0 ? 'NU' : ('NAM' as 'NAM' | 'NU')
      const byear = birthYears[i]
      const chucDanhId = i >= 8 ? 'cd6' : i === 9 ? 'cd7' : chucDanhMap[dv.id]
      const bac = Math.min(1 + Math.floor(i * 0.8) + di, 9)
      const heSoArr = gvBacs
      const heSo = heSoArr[Math.min(bac - 1, heSoArr.length - 1)].heSo

      // Some employees: upcoming review
      const monthsOffset = i < 2 ? 1 : i < 4 ? 2 : i < 6 ? 4 : 18
      const ngayHieuLuc = dayjs().subtract(3 * 12 - monthsOffset, 'month').format('YYYY-MM-DD')
      const ngayTiepTheo = dayjs(ngayHieuLuc).add(3, 'year').format('YYYY-MM-DD')

      const ngaySinh = `${byear}-${String((i % 12) + 1).padStart(2, '0')}-15`
      const ngayVaoNganh = `${byear + 22}-09-01`

      const vc = {
        id: vcId,
        ma: `VC${String(di * 10 + i + 1).padStart(5, '0')}`,
        ho: ho + ` ${String.fromCharCode(65 + di)}`,
        ten,
        ngaySinh,
        gioiTinh,
        donViId: dv.id,
        loaiLaoDong: loaiLDs[i],
        chucDanhId,
        ngayVaoNganh,
        ngayVaoDonVi: ngayVaoNganh,
        heSoLuongHienTaiId: hslId,
        active: true,
        createdAt: d('2024-01-01'),
        updatedAt: d('2024-01-01'),
      }
      allVCs.push(vc)

      allHeSos.push({
        id: hslId,
        vienChucId: vcId,
        chucDanhId,
        bac,
        heSo,
        ngayHieuLuc,
        ngayNangLuongTiepTheo: ngayTiepTheo,
        lyDo: 'TUYEN_DUNG',
        isActive: true,
        createdAt: d('2024-01-01'),
        createdBy: 'system',
      })

      // PC ưu đãi nghề
      const pcUuDaiId = dv.loai === 'THCS' ? 'pc2' : dv.loai === 'MAM_NON' || dv.loai === 'TIEU_HOC' ? 'pc1' : 'pc3'
      allPhuCaps.push({
        id: nanoid(),
        vienChucId: vcId,
        loaiPhuCapId: pcUuDaiId,
        giaTri: 0,
        ngayHieuLuc: ngayVaoNganh,
        isActive: true,
        createdAt: d('2024-01-01'),
        createdBy: 'system',
      })
    })
  })

  setVienChucs(allVCs)
  setHeSoLuongs(allHeSos)
  setPhuCapVienChucs(allPhuCaps)

  // --- Tài khoản ---
  setUsers([
    { id: 'u1', username: 'admin', password: '123456', fullName: 'Quản trị viên', role: 'ADMIN', donViId: null, active: true, createdAt: d('2024-01-01') },
    { id: 'u2', username: 'vhxh01', password: '123456', fullName: 'Nguyễn Văn Phong (VH-XH)', role: 'CB_VH_XH', donViId: null, active: true, createdAt: d('2024-01-01') },
    { id: 'u3', username: 'lanhdao01', password: '123456', fullName: 'Trần Thị Bích (Lãnh đạo)', role: 'LANH_DAO', donViId: null, active: true, createdAt: d('2024-01-01') },
    { id: 'u4', username: 'truong01', password: '123456', fullName: 'Lê Văn Hải (HT TH Gia Viên 1)', role: 'CB_TRUONG', donViId: 'dv2', active: true, createdAt: d('2024-01-01') },
  ])

  // --- Đề xuất mẫu ---
  const vc1 = allVCs[0]
  const vc2 = allVCs[1]
  const hsl1 = allHeSos[0]
  const hsl2 = allHeSos[1]
  setDeXuats([
    {
      id: 'dx1', ma: 'DX-2026-001', tieuDe: 'Nâng bậc lương 6 tháng đầu năm 2026 - TH Gia Viên 1',
      donViId: 'dv2', loai: 'NANG_BAC', buocHienTai: 2, trangThai: 'CHO_XET_DUYET',
      chiTiet: [{
        vienChucId: vc1.id, chucDanhCuId: hsl1.chucDanhId, bacCu: hsl1.bac, heSoCu: hsl1.heSo,
        chucDanhMoiId: hsl1.chucDanhId, bacMoi: hsl1.bac + 1, heSoMoi: gvBacs[hsl1.bac] ? gvBacs[hsl1.bac].heSo : hsl1.heSo + 0.33,
        ngayHieuLuc: '2026-07-01', lyDo: 'Đủ thời gian 3 năm',
      }],
      nguoiDeXuatId: 'u4', ngayDeXuat: '2026-08-01', createdAt: d('2026-08-01'), updatedAt: d('2026-08-01'),
    },
    {
      id: 'dx2', ma: 'DX-2026-002', tieuDe: 'Nâng bậc lương - MN Gia Viên',
      donViId: 'dv1', loai: 'NANG_BAC', buocHienTai: 3, trangThai: 'CHO_PHE_DUYET',
      chiTiet: [{
        vienChucId: vc2.id, chucDanhCuId: hsl2.chucDanhId, bacCu: hsl2.bac, heSoCu: hsl2.heSo,
        chucDanhMoiId: hsl2.chucDanhId, bacMoi: hsl2.bac + 1, heSoMoi: hsl2.heSo + 0.33,
        ngayHieuLuc: '2026-07-01', lyDo: 'Đủ thời gian 3 năm',
      }],
      nguoiDeXuatId: 'u2', ngayDeXuat: '2026-07-15',
      nguoiXetDuyetId: 'u2', ngayXetDuyet: '2026-07-20', ketQuaXetDuyet: 'DONG_Y', ghiChuXetDuyet: 'Hồ sơ hợp lệ',
      createdAt: d('2026-07-15'), updatedAt: d('2026-07-20'),
    },
    {
      id: 'dx3', ma: 'DX-2026-003', tieuDe: 'Nâng bậc tháng 1/2026 - THCS Gia Viên',
      donViId: 'dv4', loai: 'NANG_BAC', buocHienTai: 3, trangThai: 'DA_PHE_DUYET',
      chiTiet: [],
      nguoiDeXuatId: 'u2', ngayDeXuat: '2026-01-10',
      nguoiXetDuyetId: 'u2', ngayXetDuyet: '2026-01-15', ketQuaXetDuyet: 'DONG_Y', ghiChuXetDuyet: 'Đồng ý',
      nguoiPheDuyetId: 'u3', ngayPheDuyet: '2026-01-18', ketQuaPheDuyet: 'PHE_DUYET', ghiChuPheDuyet: 'Phê duyệt',
      createdAt: d('2026-01-10'), updatedAt: d('2026-01-18'),
    },
  ])

}

function d(s: string) {
  return new Date(s).toISOString()
}

const gvBacs = [
  { bac: 1, heSo: 2.34 }, { bac: 2, heSo: 2.67 }, { bac: 3, heSo: 3.00 },
  { bac: 4, heSo: 3.33 }, { bac: 5, heSo: 3.66 }, { bac: 6, heSo: 3.99 },
  { bac: 7, heSo: 4.32 }, { bac: 8, heSo: 4.65 }, { bac: 9, heSo: 4.98 },
]
