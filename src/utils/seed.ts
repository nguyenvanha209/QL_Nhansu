import dayjs from 'dayjs'
import type { BacLuong } from '@/types/danhMuc'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useUserStore } from '@/store/userStore'
import { useDeXuatStore } from '@/store/deXuatStore'
import { getHangTruong, getPhuCapChucVuHeSo } from '@/utils/hangTruong'
import { toUpperName } from '@/utils/helpers'
import type { ChucVu, VTVL } from '@/types/vienChuc'
import { IS_BIEN_CHE } from '@/types/vienChuc'

const REQUIRED_PHU_CAPS = [
  { ma: 'PC_CHUC_VU', ten: 'PC Chức vụ (TT 33/2005)', loaiCongThuc: 'HE_SO' as const, giaTri: 0, moTa: 'Phụ cấp chức vụ HT/PHT/TT/TP — hệ số theo loại trường × hạng trường, cộng thẳng vào tổng hệ số lương', active: true },
  { ma: 'PC_THAM_NIEN', ten: 'PC Thâm niên nghề', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 5, moTa: '5% sau 5 năm, +1%/năm. Chuyển sang PC nghề nghiệp theo NĐ 182/2026', active: true },
  { ma: 'PC_TRACH_NHIEM', ten: 'PC Trách nhiệm công việc', loaiCongThuc: 'HE_SO' as const, giaTri: 0, moTa: 'Hệ số theo từng vị trí công việc, VD: Kế toán 0,2 — chọn và nhập hệ số thủ công', active: true },
  { ma: 'PC_THAM_NIEN_VK', ten: 'PC Thâm niên vượt khung', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 0, moTa: 'Đã xếp bậc lương cuối cùng đủ 36 tháng (loại A0-A3) hoặc 24 tháng (loại B,C): 5%, +1%/năm từ năm tiếp theo — chọn và nhập % thủ công', active: true },
]

function ensureRequiredPhuCaps() {
  const { loaiPhuCaps, addLoaiPhuCap } = useDanhMucStore.getState()
  const existing = new Set(loaiPhuCaps.map((p) => p.ma))
  for (const pc of REQUIRED_PHU_CAPS) {
    if (!existing.has(pc.ma)) addLoaiPhuCap(pc)
  }
}

const DEFAULT_VTVLS = [
  { ma: 'CBQL', ten: 'Cán bộ quản lý', moTa: 'Hiệu trưởng, Phó Hiệu trưởng — trực tiếp quản lý, điều hành nhà trường', active: true },
  { ma: 'GIAO_VIEN', ten: 'Giáo viên', moTa: 'Trực tiếp giảng dạy, kể cả trường hợp kiêm nhiệm tổ trưởng/tổ phó chuyên môn', active: true },
  { ma: 'NHAN_VIEN', ten: 'Nhân viên', moTa: 'Kế toán, văn thư, thư viện, y tế học đường và các vị trí hỗ trợ, phục vụ khác', active: true },
]

const DEFAULT_CHUC_VUS = [
  { ma: 'HIEU_TRUONG', ten: 'Hiệu trưởng', apDung: 'Mầm non, Tiểu học, THCS', canCu: 'TT 19/2023/TT-BGDĐT (mầm non), TT 20/2023/TT-BGDĐT (tiểu học, THCS)', moTa: 'Quản lý, điều hành toàn bộ hoạt động nhà trường', active: true },
  { ma: 'PHO_HIEU_TRUONG', ten: 'Phó Hiệu trưởng', apDung: 'Mầm non, Tiểu học, THCS', canCu: 'TT 19/2023/TT-BGDĐT (mầm non), TT 20/2023/TT-BGDĐT (tiểu học, THCS)', moTa: 'Số lượng theo hạng trường và quy mô lớp/học sinh', active: true },
  { ma: 'TO_TRUONG_CM', ten: 'Tổ trưởng chuyên môn', apDung: 'Tiểu học, THCS (trường có tổ chuyên môn)', canCu: 'TT 20/2023/TT-BGDĐT', moTa: 'Phụ trách 1 tổ chuyên môn theo cơ cấu tổ chức nhà trường', active: true },
  { ma: 'TO_PHO_CM', ten: 'Tổ phó chuyên môn', apDung: 'Tiểu học, THCS (trường có tổ chuyên môn)', canCu: 'TT 20/2023/TT-BGDĐT', moTa: 'Hỗ trợ tổ trưởng chuyên môn', active: true },
]

// Danh mục VTVL / Chức vụ chuyển từ hằng số cứng sang dữ liệu admin tùy biến được
function ensureVtvlVaChucVu() {
  const { vtvls, addVtvl, chucVus, addChucVu } = useDanhMucStore.getState()
  const vtvlMas = new Set(vtvls.map((v) => v.ma))
  for (const v of DEFAULT_VTVLS) {
    if (!vtvlMas.has(v.ma)) addVtvl(v)
  }
  const chucVuMas = new Set(chucVus.map((c) => c.ma))
  for (const c of DEFAULT_CHUC_VUS) {
    if (!chucVuMas.has(c.ma)) addChucVu(c)
  }
}

// PC Chức vụ đổi từ "% lương cơ sở" sang "hệ số cộng thẳng" (TT 33/2005 vốn là hệ số, không phải %)
function migratePhuCapChucVuFormula() {
  const { loaiPhuCaps, updateLoaiPhuCap } = useDanhMucStore.getState()
  const pcChucVu = loaiPhuCaps.find((p) => p.ma === 'PC_CHUC_VU')
  if (pcChucVu && pcChucVu.loaiCongThuc !== 'HE_SO') {
    updateLoaiPhuCap(pcChucVu.id, { loaiCongThuc: 'HE_SO' })
  }
  // Dữ liệu PC Chức vụ đã lưu theo % cũ (vd 50) cần quy đổi lại thành hệ số (0.5)
  const luongState = useLuongStore.getState()
  if (pcChucVu) {
    const needsFix = luongState.phuCapVienChucs.some((p) => p.loaiPhuCapId === pcChucVu.id && p.giaTri > 1)
    if (needsFix) {
      luongState.setPhuCapVienChucs(
        luongState.phuCapVienChucs.map((p) =>
          p.loaiPhuCapId === pcChucVu.id && p.giaTri > 1 ? { ...p, giaTri: p.giaTri / 100 } : p
        )
      )
    }
  }
}

// Chỉ tiêu biên chế/hợp đồng chuyển từ cấp vị trí việc làm sang cấp trường
// (giao tổng số cho cả trường, không giao chi tiết từng vị trí)
function migrateChiTieuToDonVi() {
  const dm = useDanhMucStore.getState()
  const needsMigration = dm.donVis.some((d) => d.chiTieuBienCheNganSach === undefined)
  if (!needsMigration) return
  dm.setDonVis(
    dm.donVis.map((d) => {
      if (d.chiTieuBienCheNganSach !== undefined) return d
      const vts = dm.viTriViecLams.filter((v: any) => v.donViId === d.id)
      const chiTieuBienCheNganSach = vts.reduce((s, v: any) => s + (v.soLuongBienCheNganSach ?? v.soLuongBienChe ?? 0), 0)
      const chiTieuBienCheSuNghiep = vts.reduce((s, v: any) => s + (v.soLuongBienCheSuNghiep ?? 0), 0)
      const chiTieuHopDong = vts.reduce((s, v: any) => s + (v.soLuongHopDong ?? 0), 0)
      return { ...d, chiTieuBienCheNganSach, chiTieuBienCheSuNghiep, chiTieuHopDong }
    })
  )
}

// Quy định: họ tên viên chức, người lao động luôn IN HOA. Chuẩn hoá một lần cho
// dữ liệu đã nhập trước khi có quy định này; các bản ghi mới đã được store lo.
function migrateHoTenInHoa() {
  const vcState = useVienChucStore.getState()
  const canSua = vcState.vienChucs.some(
    (v) => v.ho !== toUpperName(v.ho) || v.ten !== toUpperName(v.ten),
  )
  if (!canSua) return
  vcState.setVienChucs(
    vcState.vienChucs.map((v) => ({ ...v, ho: toUpperName(v.ho), ten: toUpperName(v.ten) })),
  )
}

export function initSeedData() {
  ensureRequiredPhuCaps()
  ensureVtvlVaChucVu()
  migrateHoTenInHoa()
  migratePhuCapChucVuFormula()
  migrateChiTieuToDonVi()

  const dm = useDanhMucStore.getState()

  // KHÔNG BAO GIỜ tự xoá dữ liệu đang có.
  // Trước đây ở đây có các nhánh "force re-seed" dựa trên suy đoán (id ngẫu nhiên,
  // năm sinh 1975, thiếu soLop...). Khi hệ thống chạy dữ liệu thật, các suy đoán đó
  // bắt trúng hồ sơ thật và xoá sạch toàn bộ viên chức, lương, phụ cấp, đề xuất —
  // bản seed sau đó còn bị đẩy ngược lên Supabase. Mọi thay đổi cấu trúc dữ liệu
  // phải xử lý bằng hàm ensure*/migrate* bổ sung tại chỗ, không xoá rồi tạo lại.

  // Chỉ seed khi CHƯA có bất kỳ dữ liệu nào (lần chạy đầu tiên trên máy trống)
  if (dm.donVis.length > 0 || useVienChucStore.getState().vienChucs.length > 0) return

  const { setDonVis, setChucDanhs, setBacLuongs, setMucLuongCosos, setLoaiPhuCaps, setViTriViecLams } =
    useDanhMucStore.getState()
  const { setVienChucs } = useVienChucStore.getState()
  const { setHeSoLuongs, setPhuCapVienChucs } = useLuongStore.getState()
  const { setUsers } = useUserStore.getState()
  const { setDeXuats } = useDeXuatStore.getState()

  // --- Đơn vị ---
  const donVis = [
    { id: 'dv1', ma: 'MN01', ten: 'Trường MN Gia Viên', loai: 'MAM_NON' as const, soLop: 8, diaChi: 'Phường Gia Viên', chiTieuBienCheNganSach: 18, chiTieuBienCheSuNghiep: 2, chiTieuHopDong: 4, active: true, createdAt: d('2020-01-01') },
    { id: 'dv2', ma: 'TH01', ten: 'Trường TH Gia Viên 1', loai: 'TIEU_HOC' as const, soLop: 22, diaChi: 'Phường Gia Viên', chiTieuBienCheNganSach: 18, chiTieuBienCheSuNghiep: 2, chiTieuHopDong: 4, active: true, createdAt: d('2020-01-01') },
    { id: 'dv3', ma: 'TH02', ten: 'Trường TH Gia Viên 2', loai: 'TIEU_HOC' as const, soLop: 15, diaChi: 'Phường Gia Viên', chiTieuBienCheNganSach: 18, chiTieuBienCheSuNghiep: 2, chiTieuHopDong: 4, active: true, createdAt: d('2020-01-01') },
    { id: 'dv4', ma: 'CS01', ten: 'Trường THCS Gia Viên', loai: 'THCS' as const, soLop: 24, diaChi: 'Phường Gia Viên', chiTieuBienCheNganSach: 18, chiTieuBienCheSuNghiep: 2, chiTieuHopDong: 4, active: true, createdAt: d('2020-01-01') },
    { id: 'dv5', ma: 'CS02', ten: 'Trường THCS Phạm Hồng Thái', loai: 'THCS' as const, soLop: 12, diaChi: 'Phường Gia Viên', chiTieuBienCheNganSach: 18, chiTieuBienCheSuNghiep: 2, chiTieuHopDong: 4, active: true, createdAt: d('2020-01-01') },
  ]
  setDonVis(donVis)

  // --- Chức danh nghề nghiệp (TT 31/2026/TT-BGDĐT) ---
  const chucDanhs = [
    // Mầm non
    { id: 'cd_mn1', ma: 'V.07.02.24', ten: 'Giáo viên mầm non hạng I', nhom: 'GIAO_VIEN' as const, bangLuong: 'A2.2', active: true },
    { id: 'cd_mn2', ma: 'V.07.02.25', ten: 'Giáo viên mầm non hạng II', nhom: 'GIAO_VIEN' as const, bangLuong: 'A1', active: true },
    { id: 'cd_mn3', ma: 'V.07.02.26', ten: 'Giáo viên mầm non hạng III', nhom: 'GIAO_VIEN' as const, bangLuong: 'A0', active: true },
    // Tiểu học
    { id: 'cd_th1', ma: 'V.07.03.27', ten: 'Giáo viên tiểu học hạng I', nhom: 'GIAO_VIEN' as const, bangLuong: 'A2.1', active: true },
    { id: 'cd_th2', ma: 'V.07.03.28', ten: 'Giáo viên tiểu học hạng II', nhom: 'GIAO_VIEN' as const, bangLuong: 'A2.2', active: true },
    { id: 'cd_th3', ma: 'V.07.03.29', ten: 'Giáo viên tiểu học hạng III', nhom: 'GIAO_VIEN' as const, bangLuong: 'A1', active: true },
    // THCS
    { id: 'cd_cs1', ma: 'V.07.04.30', ten: 'Giáo viên THCS hạng I', nhom: 'GIAO_VIEN' as const, bangLuong: 'A2.1', active: true },
    { id: 'cd_cs2', ma: 'V.07.04.31', ten: 'Giáo viên THCS hạng II', nhom: 'GIAO_VIEN' as const, bangLuong: 'A2.2', active: true },
    { id: 'cd_cs3', ma: 'V.07.04.32', ten: 'Giáo viên THCS hạng III', nhom: 'GIAO_VIEN' as const, bangLuong: 'A1', active: true },
    // Nhân viên hỗ trợ
    { id: 'cd_kt', ma: 'KT', ten: 'Kế toán', nhom: 'NHAN_VIEN' as const, bangLuong: 'A0', active: true },
    { id: 'cd_vt', ma: 'VT', ten: 'Văn thư', nhom: 'NHAN_VIEN' as const, bangLuong: 'B', active: true },
    { id: 'cd_yt', ma: 'YT', ten: 'Y tế học đường', nhom: 'NHAN_VIEN' as const, bangLuong: 'B', active: true },
  ]
  setChucDanhs(chucDanhs)

  // --- Bậc lương (NĐ 204/2004/NĐ-CP, Bảng 3) ---
  const bacLuongs: BacLuong[] = []

  // A2.1: GV TH hạng I, GV THCS hạng I
  const a21Bacs = [
    { bac: 1, heSo: 4.40 }, { bac: 2, heSo: 4.74 }, { bac: 3, heSo: 5.08 },
    { bac: 4, heSo: 5.42 }, { bac: 5, heSo: 5.76 }, { bac: 6, heSo: 6.10 },
    { bac: 7, heSo: 6.44 }, { bac: 8, heSo: 6.78 },
  ]
  ;['cd_th1', 'cd_cs1'].forEach((cdId) => {
    a21Bacs.forEach((b) => bacLuongs.push({ id: `bl_${cdId}_${b.bac}`, chucDanhId: cdId, bac: b.bac, heSo: b.heSo, thoiGianNangLuong: 3 as const }))
  })

  // A2.2: GV MN hạng I, GV TH hạng II, GV THCS hạng II
  const a22Bacs = [
    { bac: 1, heSo: 4.00 }, { bac: 2, heSo: 4.34 }, { bac: 3, heSo: 4.68 },
    { bac: 4, heSo: 5.02 }, { bac: 5, heSo: 5.36 }, { bac: 6, heSo: 5.70 },
    { bac: 7, heSo: 6.04 }, { bac: 8, heSo: 6.38 },
  ]
  ;['cd_mn1', 'cd_th2', 'cd_cs2'].forEach((cdId) => {
    a22Bacs.forEach((b) => bacLuongs.push({ id: `bl_${cdId}_${b.bac}`, chucDanhId: cdId, bac: b.bac, heSo: b.heSo, thoiGianNangLuong: 3 as const }))
  })

  // A1: GV MN hạng II, GV TH hạng III, GV THCS hạng III
  const a1Bacs = [
    { bac: 1, heSo: 2.34 }, { bac: 2, heSo: 2.67 }, { bac: 3, heSo: 3.00 },
    { bac: 4, heSo: 3.33 }, { bac: 5, heSo: 3.66 }, { bac: 6, heSo: 3.99 },
    { bac: 7, heSo: 4.32 }, { bac: 8, heSo: 4.65 }, { bac: 9, heSo: 4.98 },
  ]
  ;['cd_mn2', 'cd_th3', 'cd_cs3'].forEach((cdId) => {
    a1Bacs.forEach((b) => bacLuongs.push({ id: `bl_${cdId}_${b.bac}`, chucDanhId: cdId, bac: b.bac, heSo: b.heSo, thoiGianNangLuong: 3 as const }))
  })

  // A0: GV MN hạng III, Kế toán
  const a0Bacs = [
    { bac: 1, heSo: 2.10 }, { bac: 2, heSo: 2.41 }, { bac: 3, heSo: 2.72 },
    { bac: 4, heSo: 3.03 }, { bac: 5, heSo: 3.34 }, { bac: 6, heSo: 3.65 },
    { bac: 7, heSo: 3.96 }, { bac: 8, heSo: 4.27 }, { bac: 9, heSo: 4.58 },
    { bac: 10, heSo: 4.89 },
  ]
  ;['cd_mn3', 'cd_kt'].forEach((cdId) => {
    a0Bacs.forEach((b) => bacLuongs.push({ id: `bl_${cdId}_${b.bac}`, chucDanhId: cdId, bac: b.bac, heSo: b.heSo, thoiGianNangLuong: 3 as const }))
  })

  // B: Văn thư, Y tế
  const bBacs = [
    { bac: 1, heSo: 1.86 }, { bac: 2, heSo: 2.06 }, { bac: 3, heSo: 2.26 },
    { bac: 4, heSo: 2.46 }, { bac: 5, heSo: 2.66 }, { bac: 6, heSo: 2.86 },
    { bac: 7, heSo: 3.06 }, { bac: 8, heSo: 3.26 }, { bac: 9, heSo: 3.46 },
    { bac: 10, heSo: 3.66 }, { bac: 11, heSo: 3.86 }, { bac: 12, heSo: 4.06 },
  ]
  ;['cd_vt', 'cd_yt'].forEach((cdId) => {
    bBacs.forEach((b) => bacLuongs.push({ id: `bl_${cdId}_${b.bac}`, chucDanhId: cdId, bac: b.bac, heSo: b.heSo, thoiGianNangLuong: 2 as const }))
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
    // PC Ưu đãi nghề
    { id: 'pc1', ma: 'PCUD_35', ten: 'PC Ưu đãi nghề (35%)', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 35, moTa: 'GV MN, TH - NĐ 182/2026', active: true },
    { id: 'pc2', ma: 'PCUD_30', ten: 'PC Ưu đãi nghề (30%)', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 30, moTa: 'GV THCS - NĐ 182/2026', active: true },
    { id: 'pc3', ma: 'PCUD_20', ten: 'PC Ưu đãi nghề (20%)', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 20, moTa: 'NV hỗ trợ - NĐ 182/2026', active: true },
    // PC Chức vụ — hệ số tự động theo loại trường × hạng trường × chức vụ (TT 33/2005), cộng thẳng vào tổng hệ số lương
    { id: 'pc_cv', ma: 'PC_CHUC_VU', ten: 'PC Chức vụ (TT 33/2005)', loaiCongThuc: 'HE_SO' as const, giaTri: 0, moTa: 'Phụ cấp chức vụ HT/PHT/TT/TP — hệ số theo loại trường × hạng trường, cộng thẳng vào tổng hệ số lương', active: true },
    // PC Thâm niên nghề
    { id: 'pc6', ma: 'PC_THAM_NIEN', ten: 'PC Thâm niên nghề', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 5, moTa: '5% sau 5 năm, +1%/năm. Chuyển sang PC nghề nghiệp theo NĐ 182/2026', active: true },
    // PC Trách nhiệm công việc — hệ số theo vị trí, chọn và nhập tay
    { id: 'pc_tn', ma: 'PC_TRACH_NHIEM', ten: 'PC Trách nhiệm công việc', loaiCongThuc: 'HE_SO' as const, giaTri: 0, moTa: 'Hệ số theo từng vị trí công việc, VD: Kế toán 0,2 — chọn và nhập hệ số thủ công', active: true },
    // PC Thâm niên vượt khung — chọn và nhập tay
    { id: 'pc_tnvk', ma: 'PC_THAM_NIEN_VK', ten: 'PC Thâm niên vượt khung', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 0, moTa: 'Đã xếp bậc lương cuối cùng đủ 36 tháng (loại A0-A3) hoặc 24 tháng (loại B,C): 5%, +1%/năm từ năm tiếp theo — chọn và nhập % thủ công', active: true },
  ])

  // --- Vị trí việc làm ---
  const gvCdByLoaiDv: Record<string, string[]> = {
    MAM_NON: ['cd_mn1', 'cd_mn2', 'cd_mn3'],
    TIEU_HOC: ['cd_th1', 'cd_th2', 'cd_th3'],
    THCS: ['cd_cs1', 'cd_cs2', 'cd_cs3'],
  }
  const viTriDataFn = (loaiDv: string) => [
    { ten: 'Hiệu trưởng', loai: 'QUAN_LY' as const, chucDanhIds: gvCdByLoaiDv[loaiDv] || [] },
    { ten: 'Phó Hiệu trưởng', loai: 'QUAN_LY' as const, chucDanhIds: gvCdByLoaiDv[loaiDv] || [] },
    { ten: 'Giáo viên đứng lớp', loai: 'CHUYEN_MON' as const, chucDanhIds: gvCdByLoaiDv[loaiDv] || [] },
    { ten: 'Kế toán', loai: 'HO_TRO' as const, chucDanhIds: ['cd_kt'] },
    { ten: 'Văn thư - Thư viện', loai: 'HO_TRO' as const, chucDanhIds: ['cd_vt'] },
  ]
  const viTriViecLams: any[] = []
  donVis.forEach((dv) => {
    viTriDataFn(dv.loai).forEach((vt, vi) => {
      viTriViecLams.push({ id: `vt_${dv.id}_${vi}`, ma: `${vt.ten.substring(0, 3).toUpperCase()}-${dv.ma}`, ten: vt.ten, loai: vt.loai, donViId: dv.id, chucDanhIds: vt.chucDanhIds, active: true })
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
  const birthYears = [1970, 1980, 1982, 1978, 1985, 1990, 1988, 1992, 1972, 1966]
  // Default hạng: MN hạng II (A1), TH hạng III (A1), THCS hạng III (A1)
  const chucDanhMap: Record<string, string> = { dv1: 'cd_mn2', dv2: 'cd_th3', dv3: 'cd_th3', dv4: 'cd_cs3', dv5: 'cd_cs3' }

  const allVCs: any[] = []
  const allHeSos: any[] = []
  const allPhuCaps: any[] = []

  donVis.forEach((dv, di) => {
    names.forEach(([ho, ten], i) => {
      const vcId = `vc_${di}_${i}`
      const hslId = `hsl_${di}_${i}`
      const gioiTinh = i % 2 === 0 ? 'NU' : ('NAM' as 'NAM' | 'NU')
      const byear = birthYears[i]
      const chucDanhId = i === 8 ? 'cd_kt' : i === 9 ? 'cd_vt' : chucDanhMap[dv.id]
      const isNv = i >= 8
      const maxBac = isNv ? (i === 9 ? 12 : 10) : 9
      const bac = Math.min(1 + Math.floor(i * 0.8) + di, maxBac)
      const heSoArr = isNv ? (i === 9 ? bBacs : a0Bacs) : a1Bacs
      const heSo = heSoArr[Math.min(bac - 1, heSoArr.length - 1)].heSo

      // Some employees: upcoming review
      const monthsOffset = i < 2 ? 1 : i < 4 ? 2 : i < 6 ? 4 : 18
      const ngayHieuLuc = dayjs().subtract(3 * 12 - monthsOffset, 'month').format('YYYY-MM-DD')
      const ngayTiepTheo = dayjs(ngayHieuLuc).add(3, 'year').format('YYYY-MM-DD')

      const ngaySinh = `${byear}-${String((i % 12) + 1).padStart(2, '0')}-15`
      const ngayVaoNganh = `${byear + 22}-09-01`

      const chucVu = i === 0 ? 'HIEU_TRUONG' : i === 1 ? 'PHO_HIEU_TRUONG' : i === 4 ? 'TO_TRUONG_CM' : undefined
      const vtvl: VTVL = isNv ? 'NHAN_VIEN' : (chucVu === 'HIEU_TRUONG' || chucVu === 'PHO_HIEU_TRUONG') ? 'CBQL' : 'GIAO_VIEN'
      const vc: any = {
        id: vcId,
        ma: `VC${String(di * 10 + i + 1).padStart(5, '0')}`,
        ho: ho + ` ${String.fromCharCode(65 + di)}`,
        ten,
        ngaySinh,
        gioiTinh,
        donViId: dv.id,
        loaiLaoDong: loaiLDs[i],
        chucDanhId,
        vtvl,
        trangThai: 'DANG_LAM_VIEC',
        nguonKinhPhi: IS_BIEN_CHE[loaiLDs[i]] ? 'NGAN_SACH' : undefined,
        ngayVaoNganh,
        ngayVaoDonVi: ngayVaoNganh,
        heSoLuongHienTaiId: hslId,
        active: true,
        createdAt: d('2024-01-01'),
        updatedAt: d('2024-01-01'),
      }
      if (chucVu) vc.chucVu = chucVu
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
        id: `pcud_${di}_${i}`,
        vienChucId: vcId,
        loaiPhuCapId: pcUuDaiId,
        giaTri: 0,
        ngayHieuLuc: ngayVaoNganh,
        isActive: true,
        createdAt: d('2024-01-01'),
        createdBy: 'system',
      })

      // PC Chức vụ — auto-calculated from school type × ranking × position
      if (chucVu) {
        const hang = getHangTruong(dv.loai, dv.soLop ?? 0)
        const pccvHeSo = getPhuCapChucVuHeSo(dv.loai, hang, chucVu as ChucVu)
        if (pccvHeSo > 0) {
          allPhuCaps.push({
            id: `pccv_${di}_${i}`,
            vienChucId: vcId,
            loaiPhuCapId: 'pc_cv',
            giaTri: pccvHeSo,
            ngayHieuLuc: ngayVaoNganh,
            isActive: true,
            createdAt: d('2024-01-01'),
            createdBy: 'system',
          })
        }
      }
    })
  })

  setVienChucs(allVCs)
  setHeSoLuongs(allHeSos)
  setPhuCapVienChucs(allPhuCaps)

  // --- Tài khoản ---
  setUsers([
    { id: 'u1', username: 'admin', fullName: 'Quản trị viên', role: 'ADMIN', donViId: null, active: true, createdAt: d('2024-01-01') },
    { id: 'u2', username: 'vhxh01', fullName: 'Nguyễn Văn Phong (VH-XH)', role: 'CB_VH_XH', donViId: null, active: true, createdAt: d('2024-01-01') },
    { id: 'u3', username: 'lanhdao01', fullName: 'Trần Thị Bích (Lãnh đạo)', role: 'LANH_DAO', donViId: null, active: true, createdAt: d('2024-01-01') },
    { id: 'u4', username: 'truong01', fullName: 'Lê Thị Mai (Kế toán TH Gia Viên 1)', role: 'CB_TRUONG', donViId: 'dv2', active: true, createdAt: d('2024-01-01') },
    { id: 'u5', username: 'hieutruong01', fullName: 'Lê Văn Hải (HT TH Gia Viên 1)', role: 'HIEU_TRUONG', donViId: 'dv2', active: true, createdAt: d('2024-01-01') },
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
        chucDanhMoiId: hsl1.chucDanhId, bacMoi: hsl1.bac + 1, heSoMoi: a1Bacs[hsl1.bac] ? a1Bacs[hsl1.bac].heSo : hsl1.heSo + 0.33,
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

const a21Bacs = [
  { bac: 1, heSo: 4.40 }, { bac: 2, heSo: 4.74 }, { bac: 3, heSo: 5.08 },
  { bac: 4, heSo: 5.42 }, { bac: 5, heSo: 5.76 }, { bac: 6, heSo: 6.10 },
  { bac: 7, heSo: 6.44 }, { bac: 8, heSo: 6.78 },
]
const a22Bacs = [
  { bac: 1, heSo: 4.00 }, { bac: 2, heSo: 4.34 }, { bac: 3, heSo: 4.68 },
  { bac: 4, heSo: 5.02 }, { bac: 5, heSo: 5.36 }, { bac: 6, heSo: 5.70 },
  { bac: 7, heSo: 6.04 }, { bac: 8, heSo: 6.38 },
]
const a1Bacs = [
  { bac: 1, heSo: 2.34 }, { bac: 2, heSo: 2.67 }, { bac: 3, heSo: 3.00 },
  { bac: 4, heSo: 3.33 }, { bac: 5, heSo: 3.66 }, { bac: 6, heSo: 3.99 },
  { bac: 7, heSo: 4.32 }, { bac: 8, heSo: 4.65 }, { bac: 9, heSo: 4.98 },
]
const a0Bacs = [
  { bac: 1, heSo: 2.10 }, { bac: 2, heSo: 2.41 }, { bac: 3, heSo: 2.72 },
  { bac: 4, heSo: 3.03 }, { bac: 5, heSo: 3.34 }, { bac: 6, heSo: 3.65 },
  { bac: 7, heSo: 3.96 }, { bac: 8, heSo: 4.27 }, { bac: 9, heSo: 4.58 },
  { bac: 10, heSo: 4.89 },
]
const bBacs = [
  { bac: 1, heSo: 1.86 }, { bac: 2, heSo: 2.06 }, { bac: 3, heSo: 2.26 },
  { bac: 4, heSo: 2.46 }, { bac: 5, heSo: 2.66 }, { bac: 6, heSo: 2.86 },
  { bac: 7, heSo: 3.06 }, { bac: 8, heSo: 3.26 }, { bac: 9, heSo: 3.46 },
  { bac: 10, heSo: 3.66 }, { bac: 11, heSo: 3.86 }, { bac: 12, heSo: 4.06 },
]
