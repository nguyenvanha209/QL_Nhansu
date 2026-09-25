import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import { logAction } from '@/utils/auditLogger'
import { PCUD_MUC_CU } from '@/utils/phuCapThuTu'
import { doanCongViec } from '@/utils/nhomViTri'
import { useChuyenCongTacStore, tachHoSoChuyenCongTac } from '@/store/chuyenCongTacStore'
import type { BacLuong, NhomChucDanh } from '@/types/danhMuc'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useUserStore } from '@/store/userStore'
import { useNhatKyStore } from '@/store/nhatKyStore'
import { useDeXuatStore } from '@/store/deXuatStore'
import { getHangTruong, getPhuCapChucVuHeSo } from '@/utils/hangTruong'
import { toUpperName } from '@/utils/helpers'
import type { ChucVu, VTVL } from '@/types/vienChuc'
import { IS_BIEN_CHE } from '@/types/vienChuc'

const MO_TA_THAM_NIEN = 'CBQL và giáo viên (nhân viên không hưởng): 5% khi đủ 5 năm, mỗi năm tiếp theo +1%. Vẫn giữ nguyên, hưởng song song với PC ưu đãi nhà giáo'

const REQUIRED_PHU_CAPS = [
  { ma: 'PC_CHUC_VU', ten: 'PC Chức vụ (TT 33/2005)', loaiCongThuc: 'HE_SO' as const, giaTri: 0, moTa: 'Phụ cấp chức vụ HT/PHT/TT/TP — hệ số theo loại trường × hạng trường, cộng thẳng vào tổng hệ số lương', active: true },
  { ma: 'PC_THAM_NIEN', ten: 'PC Thâm niên nghề', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 5, moTa: MO_TA_THAM_NIEN, active: true },
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
  { ma: 'HT', ten: 'Hiệu trưởng', apDung: 'Mầm non, Tiểu học, THCS', canCu: 'TT 19/2023/TT-BGDĐT (mầm non), TT 20/2023/TT-BGDĐT (tiểu học, THCS)', moTa: 'Quản lý, điều hành toàn bộ hoạt động nhà trường', active: true },
  { ma: 'P.HT', ten: 'Phó Hiệu trưởng', apDung: 'Mầm non, Tiểu học, THCS', canCu: 'TT 19/2023/TT-BGDĐT (mầm non), TT 20/2023/TT-BGDĐT (tiểu học, THCS)', moTa: 'Số lượng theo hạng trường và quy mô lớp/học sinh', active: true },
  { ma: 'TTCM', ten: 'Tổ trưởng chuyên môn', apDung: 'Tiểu học, THCS (trường có tổ chuyên môn)', canCu: 'TT 20/2023/TT-BGDĐT', moTa: 'Phụ trách 1 tổ chuyên môn theo cơ cấu tổ chức nhà trường', active: true },
  { ma: 'TPCM', ten: 'Tổ phó chuyên môn', apDung: 'Tiểu học, THCS (trường có tổ chuyên môn)', canCu: 'TT 20/2023/TT-BGDĐT', moTa: 'Hỗ trợ tổ trưởng chuyên môn', active: true },
]

// PC ưu đãi nhà giáo (PC ưu đãi theo nghề) — NĐ 182/2026, thực hiện từ 01/01/2026.
// Theo cấp học: mầm non, tiểu học 45%; THCS 40%; nhân sự hỗ trợ giáo dục 20%.
// PC thâm niên nghề là khoản RIÊNG, vẫn giữ nguyên — NĐ 182 không thay thế thâm niên nghề.
// Mức 35%/30% cũ (QĐ 244/2005) giữ lại để không làm hỏng lịch sử, chỉ đổi tên.
// Hệ số chênh lệch bảo lưu là giá trị hệ số (VD 0,33), không phải %.
const CAN_CU_ND182 = 'NĐ 182/2026, thực hiện từ 01/01/2026'
const PCUD_MOI = [
  { ma: 'PCUD_45', ten: 'PC ưu đãi nhà giáo – Mầm non, Tiểu học 45%', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 45, moTa: `Nhà giáo, CBQL trường mầm non, tiểu học — điều kiện bình thường. ${CAN_CU_ND182}`, active: true },
  { ma: 'PCUD_40', ten: 'PC ưu đãi nhà giáo – THCS 40%', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 40, moTa: `Nhà giáo, CBQL trường THCS — điều kiện bình thường. ${CAN_CU_ND182}`, active: true },
  { ma: 'PCUD_20', ten: 'PC ưu đãi – Nhân sự hỗ trợ giáo dục 20%', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 20, moTa: `Nhân viên (kế toán, văn thư, thư viện, y tế...) ở trường mầm non, phổ thông. ${CAN_CU_ND182}`, active: true },
  { ma: 'PC_BAO_LUU', ten: 'Hệ số chênh lệch bảo lưu', loaiCongThuc: 'HE_SO' as const, giaTri: 0, moTa: 'Nhập giá trị hệ số chênh lệch được bảo lưu (VD 0,33 — không phải %), cộng thẳng vào tổng hệ số lương', active: true },
]
const pcudMoi = (ma: string) => PCUD_MOI.find((p) => p.ma === ma)!
// Đổi tên/mô tả chỉ khi vẫn còn tên hoặc mô tả cũ, để không ghi đè chỉnh sửa của quản trị
const DOI_TEN_PHU_CAP: Record<string, { tenCu: string[]; moTaCu?: string[]; ten: string; moTa: string }> = {
  PCUD_35: { tenCu: ['PC Ưu đãi nghề (35%)', 'PC ưu đãi nghề 35% (mức cũ QĐ 244)'], ten: 'PC ưu đãi nghề 35% (mức cũ QĐ 244)', moTa: 'Mức cũ cho GV mầm non, tiểu học theo QĐ 244/2005/QĐ-TTg, áp dụng đến 31/12/2025 — nay thay bằng PCUD_45' },
  PCUD_30: { tenCu: ['PC Ưu đãi nghề (30%)', 'PC ưu đãi nghề 30% (mức cũ QĐ 244)'], ten: 'PC ưu đãi nghề 30% (mức cũ QĐ 244)', moTa: 'Mức cũ cho GV THCS theo QĐ 244/2005/QĐ-TTg, áp dụng đến 31/12/2025 — nay thay bằng PCUD_40' },
  PCUD_45: { tenCu: ['PC ưu đãi nghề 45%'], ten: pcudMoi('PCUD_45').ten, moTa: pcudMoi('PCUD_45').moTa },
  PCUD_40: { tenCu: ['Phụ cấp ưu đãi 40%', 'PC ưu đãi nghề 40%'], ten: pcudMoi('PCUD_40').ten, moTa: pcudMoi('PCUD_40').moTa },
  PCUD_20: { tenCu: ['PC Ưu đãi nghề (20%)', 'PC ưu đãi nghề 20%'], ten: pcudMoi('PCUD_20').ten, moTa: pcudMoi('PCUD_20').moTa },
  PC_BAO_LUU: { tenCu: ['Phụ cấp chênh lệch bảo lưu'], ten: pcudMoi('PC_BAO_LUU').ten, moTa: pcudMoi('PC_BAO_LUU').moTa },
  // Mô tả cũ ghi nhầm thâm niên nghề "chuyển sang PC nghề nghiệp" → sửa lại: vẫn giữ nguyên
  PC_THAM_NIEN: { tenCu: [], moTaCu: ['5% sau 5 năm, +1%/năm. Chuyển sang PC nghề nghiệp theo NĐ 182/2026'], ten: 'PC Thâm niên nghề', moTa: MO_TA_THAM_NIEN },
}

function migratePhuCapUuDaiVaBaoLuu() {
  const { loaiPhuCaps, addLoaiPhuCap, updateLoaiPhuCap } = useDanhMucStore.getState()
  const theoMa = new Map(loaiPhuCaps.map((p) => [p.ma, p]))
  for (const pc of PCUD_MOI) {
    const co = theoMa.get(pc.ma)
    if (!co) { addLoaiPhuCap(pc); continue }
    // PCUD_40 nhập từ bảng lương thiếu công thức và giá trị → bổ sung
    const patch: Record<string, unknown> = {}
    if (!co.loaiCongThuc || (pc.ma === 'PC_BAO_LUU' && co.loaiCongThuc !== 'HE_SO')) patch.loaiCongThuc = pc.loaiCongThuc
    if (co.giaTri == null) patch.giaTri = pc.giaTri
    if (Object.keys(patch).length) updateLoaiPhuCap(co.id, patch)
  }
  for (const [ma, doi] of Object.entries(DOI_TEN_PHU_CAP)) {
    const co = useDanhMucStore.getState().loaiPhuCaps.find((p) => p.ma === ma)
    if (co && (doi.tenCu.includes(co.ten) || doi.moTaCu?.includes(co.moTa ?? ''))) updateLoaiPhuCap(co.id, { ten: doi.ten, moTa: doi.moTa })
  }

  // Hệ số chênh lệch bảo lưu bị nhập nhầm theo % (VD 33 thay vì 0,33) → quy về hệ số
  const baoLuu = useDanhMucStore.getState().loaiPhuCaps.find((p) => p.ma === 'PC_BAO_LUU')
  const lg = useLuongStore.getState()
  const laNhamPhanTram = (v?: number) => v != null && v >= 5
  if (baoLuu && lg.phuCapVienChucs.some((p) => p.loaiPhuCapId === baoLuu.id && laNhamPhanTram(p.giaTri))) {
    lg.setPhuCapVienChucs(lg.phuCapVienChucs.map((p) =>
      p.loaiPhuCapId === baoLuu.id && laNhamPhanTram(p.giaTri) ? { ...p, giaTri: p.giaTri / 100 } : p))
  }
  if (lg.heSoLuongs.some((h) => laNhamPhanTram(h.heSoBaoLuu))) {
    lg.setHeSoLuongs(lg.heSoLuongs.map((h) =>
      laNhamPhanTram(h.heSoBaoLuu) ? { ...h, heSoBaoLuu: h.heSoBaoLuu! / 100 } : h))
  }
}

// Chuyển hàng loạt PC ưu đãi nghề sang mức NĐ 182/2026 (hiệu lực 01/01/2026):
// GV, CBQL mầm non/tiểu học 45%; GV, CBQL THCS 40%; nhân viên 20%.
// - Bản ghi hiệu lực trước 01/01/2026 lệch mức: đóng lại, mở bản ghi mới từ 01/01/2026.
// - Bản ghi hiệu lực từ 2026 mà vẫn gán mức cũ QĐ 244 (35/30%): sai ngay từ đầu → sửa tại chỗ.
// Bản ghi mới hiệu lực từ 2026 với mức NĐ 182 không bị xét lại → chỉnh tay về sau không bị chạy đè.
const NGAY_HL_ND182 = '2026-01-01'
function migrateUuDaiTheoNd182() {
  const dm = useDanhMucStore.getState()
  const vcs = useVienChucStore.getState().vienChucs
  const lg = useLuongStore.getState()
  const loaiTheoMa = new Map(dm.loaiPhuCaps.map((p) => [p.ma, p]))
  const loaiUd = new Map(dm.loaiPhuCaps.filter((p) => p.ma.startsWith('PCUD')).map((p) => [p.id, p]))
  const vcTheoId = new Map(vcs.map((v) => [v.id, v]))
  const dvTheoId = new Map(dm.donVis.map((d) => [d.id, d]))
  const nhomNgach = new Map(dm.chucDanhs.map((c) => [c.id, c.nhom]))

  const mucDung = (vcId: string): string | undefined => {
    const vc = vcTheoId.get(vcId)
    if (!vc) return
    const laNhanVien = vc.vtvl ? vc.vtvl === 'NHAN_VIEN' : nhomNgach.get(vc.chucDanhId) === 'NHAN_VIEN'
    if (laNhanVien) return 'PCUD_20'
    const loaiTruong = dvTheoId.get(vc.donViId)?.loai
    if (loaiTruong === 'MAM_NON' || loaiTruong === 'TIEU_HOC') return 'PCUD_45'
    if (loaiTruong === 'THCS') return 'PCUD_40'
  }

  const homNay = dayjs().format('YYYY-MM-DD')
  const moi: typeof lg.phuCapVienChucs = []
  const lichSu: typeof lg.lichSuBienDongs = []
  const dong = new Set<string>()
  const suaTaiCho = new Map<string, { loaiPhuCapId: string; giaTri: number; ghiChu: string }>()
  for (const p of lg.phuCapVienChucs) {
    const loaiCu = loaiUd.get(p.loaiPhuCapId)
    if (!p.isActive || !loaiCu) continue
    const tu2026 = p.ngayHieuLuc >= NGAY_HL_ND182
    if (tu2026 && !PCUD_MUC_CU.has(loaiCu.ma)) continue
    const loaiMoi = loaiTheoMa.get(mucDung(p.vienChucId) ?? '')
    if (!loaiMoi) continue
    const mucCu = p.giaTri > 0 ? p.giaTri : loaiCu.giaTri
    if (loaiMoi.id === loaiCu.id && mucCu === loaiMoi.giaTri) continue
    lichSu.push({
      id: nanoid(), vienChucId: p.vienChucId, loai: 'PHU_CAP', truongThayDoi: 'PC ưu đãi nhà giáo',
      giaTriCu: `${mucCu}%`, giaTriMoi: `${loaiMoi.giaTri}% (NĐ 182/2026)`,
      ngayThayDoi: homNay, nguoiThayDoiId: 'system',
    })
    if (tu2026) {
      suaTaiCho.set(p.id, { loaiPhuCapId: loaiMoi.id, giaTri: loaiMoi.giaTri, ghiChu: 'Sửa mức PC ưu đãi nghề theo NĐ 182/2026' })
      continue
    }
    dong.add(p.id)
    moi.push({
      id: nanoid(), vienChucId: p.vienChucId, loaiPhuCapId: loaiMoi.id, giaTri: loaiMoi.giaTri,
      ngayHieuLuc: NGAY_HL_ND182, ghiChu: 'Chuyển mức PC ưu đãi nghề theo NĐ 182/2026',
      isActive: true, createdAt: new Date().toISOString(), createdBy: 'system',
    })
  }
  if (!lichSu.length) return

  lg.setPhuCapVienChucs([
    ...lg.phuCapVienChucs.map((p) => {
      if (dong.has(p.id)) return { ...p, isActive: false, ngayHetHan: '2025-12-31' }
      const sua = suaTaiCho.get(p.id)
      return sua ? { ...p, ...sua } : p
    }),
    ...moi,
  ])
  lg.setLichSuBienDongs([...lg.lichSuBienDongs, ...lichSu])
  logAction('system', 'Hệ thống', 'UPDATE', 'PhuCap', undefined,
    `Chuyển ${lichSu.length} hồ sơ sang mức PC ưu đãi nghề NĐ 182/2026 (hiệu lực 01/01/2026)`)
}

// Phiếu chuyển công tác đã duyệt/hoàn tất nhưng hồ sơ chưa từng sang trường đến (phiếu cũ,
// hoặc bị tiếp nhận khi chưa qua bước duyệt) → tách hồ sơ theo quy trình mới: trường đi giữ
// hồ sơ Chuyển đi, trường đến có hồ sơ mới mang theo lương, phụ cấp và thông tin tiếp nhận.
function migrateTachHoSoChuyenCongTac() {
  const cct = useChuyenCongTacStore.getState()
  for (const dx of cct.deXuats) {
    if (dx.vienChucMoiId || (dx.trangThai !== 'DA_DUYET' && dx.trangThai !== 'HOAN_TAT')) continue
    const vc = useVienChucStore.getState().getById(dx.vienChucId)
    if (!vc || vc.donViId !== dx.donViDiId) continue

    const moiId = tachHoSoChuyenCongTac(dx, 'system', 'Hệ thống', dx.ngayVaoDonViMoi ?? dx.ngayChuyen)
    if (!moiId) continue
    if (dx.trangThai === 'HOAN_TAT') {
      useVienChucStore.getState().updateVienChuc(moiId, {
        trangThai: 'DANG_LAM_VIEC',
        ...(dx.vtvlMoi && { vtvl: dx.vtvlMoi }),
        ...(dx.chucVuMoi && { chucVu: dx.chucVuMoi }),
        ...(dx.viTriViecLamMoiId && { viTriViecLamId: dx.viTriViecLamMoiId }),
      })
    }
    cct.capNhat(dx.id, { vienChucMoiId: moiId })
    logAction('system', 'Hệ thống', 'UPDATE', 'ChuyenCongTac', dx.id,
      `Tách hồ sơ theo phiếu ${dx.ma}: ${dx.hoTenSnapshot} — giữ hồ sơ Chuyển đi ở trường đi, tạo hồ sơ ở trường đến`)
  }
}

// Hồ sơ do tài khoản trường thêm mới từng bị mất đơn vị công tác (ô Đơn vị bị ẩn nên không
// được gửi khi lưu) → không lên bảng lương, báo cáo. Gán lại theo trường của tài khoản đã tạo.
function migrateGanDonViHoSoThieu() {
  const vcState = useVienChucStore.getState()
  const thieu = vcState.vienChucs.filter((v) => !v.donViId)
  if (!thieu.length) return
  const nhatKys = useNhatKyStore.getState().nhatKys
  const users = useUserStore.getState().users
  for (const vc of thieu) {
    const taoBoi = nhatKys.find((n) => n.action === 'CREATE' && n.entityId === vc.id)?.userId
    const donViId = users.find((u) => u.id === taoBoi)?.donViId
    if (!donViId) continue
    vcState.updateVienChuc(vc.id, { donViId })
    logAction('system', 'Hệ thống', 'UPDATE', 'VienChuc', vc.id,
      `Gán lại đơn vị cho hồ sơ ${vc.ho} ${vc.ten} (bị thiếu do lỗi thêm mới từ tài khoản trường)`)
  }
}

// Chức danh cần đúng hạng và bảng lương theo quy định. Hệ số lưu trong hồ sơ vẫn giữ nguyên;
// chỉ sửa/bổ sung danh mục để chọn bậc, tính ngày nâng lương và rà soát lệch cho đúng.
// - Mã cũ trước TT 01, 02/2021 (TTLT 20, 21/2015) từng bị gán sai hạng, bảng lương
//   (VD V.07.03.09 ghi "hạng III, A1" trong khi đúng là hạng IV, loại B 12 bậc).
// - V.07.07.21 là Giáo vụ (loại A0), trước đây ghi nhầm "Nhân viên hành chính trường học" loại B.
// - Tư vấn học sinh (tư vấn tâm lý học đường) theo TT 11/2024/TT-BGDĐT: chưa có trong danh mục.
const BANG_LUONG: Record<string, { heSos: number[]; thoiGian: 2 | 3 }> = {
  'A2.1': { heSos: [4.4, 4.74, 5.08, 5.42, 5.76, 6.1, 6.44, 6.78], thoiGian: 3 },
  'A2.2': { heSos: [4.0, 4.34, 4.68, 5.02, 5.36, 5.7, 6.04, 6.38], thoiGian: 3 },
  A1: { heSos: [2.34, 2.67, 3.0, 3.33, 3.66, 3.99, 4.32, 4.65, 4.98], thoiGian: 3 },
  A0: { heSos: [2.1, 2.41, 2.72, 3.03, 3.34, 3.65, 3.96, 4.27, 4.58, 4.89], thoiGian: 3 },
  B: { heSos: [1.86, 2.06, 2.26, 2.46, 2.66, 2.86, 3.06, 3.26, 3.46, 3.66, 3.86, 4.06], thoiGian: 2 },
}
const CHUC_DANH_DUNG: { ma: string; ten: string; nhom: NhomChucDanh; bangLuong: keyof typeof BANG_LUONG }[] = [
  { ma: 'V.07.03.07', ten: 'Giáo viên tiểu học hạng II (mã cũ)', nhom: 'GIAO_VIEN', bangLuong: 'A1' },
  { ma: 'V.07.03.08', ten: 'Giáo viên tiểu học hạng III (mã cũ)', nhom: 'GIAO_VIEN', bangLuong: 'A0' },
  { ma: 'V.07.03.09', ten: 'Giáo viên tiểu học hạng IV (mã cũ)', nhom: 'GIAO_VIEN', bangLuong: 'B' },
  { ma: 'V.07.02.06', ten: 'Giáo viên mầm non hạng IV (mã cũ)', nhom: 'GIAO_VIEN', bangLuong: 'B' },
  { ma: 'V.07.07.21', ten: 'Giáo vụ', nhom: 'NHAN_VIEN', bangLuong: 'A0' },
  { ma: 'V.07.07.24', ten: 'Tư vấn học sinh (tư vấn tâm lý học đường) hạng III', nhom: 'NHAN_VIEN', bangLuong: 'A1' },
  { ma: 'V.07.07.23', ten: 'Tư vấn học sinh (tư vấn tâm lý học đường) hạng II', nhom: 'NHAN_VIEN', bangLuong: 'A2.2' },
  { ma: 'V.07.07.22', ten: 'Tư vấn học sinh (tư vấn tâm lý học đường) hạng I', nhom: 'NHAN_VIEN', bangLuong: 'A2.1' },
]
function migrateChucDanhTheoQuyDinh() {
  const dm = useDanhMucStore.getState()
  let bacLuongs = dm.bacLuongs
  let doi = false
  for (const dung of CHUC_DANH_DUNG) {
    let cd = useDanhMucStore.getState().chucDanhs.find((c) => c.ma === dung.ma)
    const bang = BANG_LUONG[dung.bangLuong]
    // Chức danh chưa có (VD tư vấn học sinh) → bổ sung kèm bảng bậc
    if (!cd) {
      cd = dm.addChucDanh({ ma: dung.ma, ten: dung.ten, nhom: dung.nhom, bangLuong: dung.bangLuong, active: true })
      bacLuongs = [...bacLuongs, ...bang.heSos.map((heSo, i) => ({
        id: `bl_${cd!.id}_${i + 1}`, chucDanhId: cd!.id, bac: i + 1, heSo, thoiGianNangLuong: bang.thoiGian,
      }))]
      doi = true
      logAction('system', 'Hệ thống', 'CREATE', 'ChucDanh', cd.id,
        `Bổ sung chức danh ${dung.ma} — ${dung.ten} (${dung.bangLuong}, ${bang.heSos.length} bậc)`)
      continue
    }
    const bacHienTai = bacLuongs.filter((b) => b.chucDanhId === cd.id).sort((a, b) => a.bac - b.bac)
    const bacDung = bacHienTai.length === bang.heSos.length
      && bacHienTai.every((b, i) => b.heSo === bang.heSos[i] && b.thoiGianNangLuong === bang.thoiGian)
    // Đã đúng bảng lương và bậc thì thôi (không ghi đè tên nếu quản trị đổi tên về sau)
    if (cd.bangLuong === dung.bangLuong && bacDung) continue

    dm.updateChucDanh(cd.id, { ten: dung.ten, bangLuong: dung.bangLuong, nhom: dung.nhom })
    if (!bacDung) {
      bacLuongs = [
        ...bacLuongs.filter((b) => b.chucDanhId !== cd.id),
        ...bang.heSos.map((heSo, i) => ({
          id: `bl_${cd.id}_${i + 1}`, chucDanhId: cd.id, bac: i + 1, heSo, thoiGianNangLuong: bang.thoiGian,
        })),
      ]
    }
    doi = true
    logAction('system', 'Hệ thống', 'UPDATE', 'ChucDanh', cd.id,
      `Sửa mã ${dung.ma}: "${cd.ten}" (${cd.bangLuong}) → "${dung.ten}" (${dung.bangLuong}, ${bang.heSos.length} bậc)`)
  }
  if (doi) useDanhMucStore.getState().setBacLuongs(bacLuongs)
}

// Tự điền trước "Công việc cụ thể" cho nhân viên từ nhiệm vụ chính / tên chức danh.
// Chỉ điền ô đang trống; không đoán chắc thì để trống — trang Rà soát sẽ nhắc trường chọn.
function migrateDienCongViecNhanVien() {
  const vcState = useVienChucStore.getState()
  const cdTheoId = new Map(useDanhMucStore.getState().chucDanhs.map((c) => [c.id, c]))
  const laNhanVien = (v: (typeof vcState.vienChucs)[number]) =>
    v.vtvl ? v.vtvl === 'NHAN_VIEN' : cdTheoId.get(v.chucDanhId)?.nhom === 'NHAN_VIEN'
  const canDien = vcState.vienChucs
    .filter((v) => !v.congViec && laNhanVien(v))
    .map((v) => ({ id: v.id, congViec: doanCongViec(v.nhiemVuChinh, cdTheoId.get(v.chucDanhId)?.ten) }))
    .filter((x) => x.congViec)
  if (!canDien.length) return
  const theoId = new Map(canDien.map((x) => [x.id, x.congViec]))
  vcState.setVienChucs(vcState.vienChucs.map((v) => (theoId.has(v.id) ? { ...v, congViec: theoId.get(v.id) } : v)))
  logAction('system', 'Hệ thống', 'UPDATE', 'VienChuc', undefined,
    `Tự điền "Công việc cụ thể" cho ${canDien.length} nhân viên theo nhiệm vụ chính / chức danh`)
}

// Ngạch văn thư (TT 02/2021/TT-BNV): 02.006 Văn thư viên chính (A2.1), 02.007 Văn thư viên (A1),
// 02.008 Văn thư viên trung cấp (B). Trước đây nhập nhầm: V.02.008 / V.2.008 ghi "Giáo viên âm nhạc/mỹ thuật"
// bảng A1, V.02.007 ghi "Chuyên viên", và một mã tự đặt "VT – Văn thư" (bảng B). Hệ số của người đang
// hưởng vốn khớp ngạch văn thư → chỉ sửa danh mục, gộp VT và V.2.008 vào 02.008, hệ số giữ nguyên.
function migrateNgachVanThu() {
  const dm = useDanhMucStore.getState()
  const theoMa = (ma: string) => useDanhMucStore.getState().chucDanhs.find((c) => c.ma === ma)
  const moTaMa = new Map(dm.chucDanhs.map((c) => [c.id, `${c.ma} ${c.ten}`]))
  let bacLuongs = dm.bacLuongs
  const datBang = (cdId: string, bang: keyof typeof BANG_LUONG) => {
    const b = BANG_LUONG[bang]
    bacLuongs = [
      ...bacLuongs.filter((x) => x.chucDanhId !== cdId),
      ...b.heSos.map((heSo, i) => ({ id: `bl_${cdId}_${i + 1}`, chucDanhId: cdId, bac: i + 1, heSo, thoiGianNangLuong: b.thoiGian })),
    ]
  }
  let doi = false

  const v02008 = theoMa('V.02.008')
  if (v02008) {
    dm.updateChucDanh(v02008.id, { ma: '02.008', ten: 'Văn thư viên trung cấp', nhom: 'NHAN_VIEN', bangLuong: 'B' })
    datBang(v02008.id, 'B')
    doi = true
  }
  const v02007 = theoMa('V.02.007')
  if (v02007) {
    dm.updateChucDanh(v02007.id, { ma: '02.007', ten: 'Văn thư viên', nhom: 'NHAN_VIEN', bangLuong: 'A1' })
    datBang(v02007.id, 'A1')
    doi = true
  }
  if (!theoMa('02.006')) {
    const cd = dm.addChucDanh({ ma: '02.006', ten: 'Văn thư viên chính', nhom: 'NHAN_VIEN', bangLuong: 'A2.1', active: true })
    datBang(cd.id, 'A2.1')
    doi = true
  }
  if (doi) useDanhMucStore.getState().setBacLuongs(bacLuongs)

  // Gộp VT và V.2.008 vào 02.008: hồ sơ, bản ghi lương, vị trí việc làm → rồi ẩn mã cũ
  const dich = theoMa('02.008')
  if (!dich) return
  const gop = useDanhMucStore.getState().chucDanhs.filter((c) => (c.ma === 'VT' || c.ma === 'V.2.008') && c.id !== dich.id)
  if (!gop.length) return
  const idCu = new Set(gop.map((c) => c.id))
  const vcState = useVienChucStore.getState()
  const lg = useLuongStore.getState()
  const doiNguoi = vcState.vienChucs.filter((v) => idCu.has(v.chucDanhId))
  if (doiNguoi.length) {
    vcState.setVienChucs(vcState.vienChucs.map((v) => (idCu.has(v.chucDanhId) ? { ...v, chucDanhId: dich.id } : v)))
    const homNay = dayjs().format('YYYY-MM-DD')
    lg.setLichSuBienDongs([
      ...lg.lichSuBienDongs,
      ...doiNguoi.map((v) => ({
        id: nanoid(), vienChucId: v.id, loai: 'CHUC_DANH' as const, truongThayDoi: 'Mã ngạch',
        giaTriCu: moTaMa.get(v.chucDanhId) ?? v.chucDanhId, giaTriMoi: '02.008 Văn thư viên trung cấp (sửa mã nhập nhầm, hệ số giữ nguyên)',
        ngayThayDoi: homNay, nguoiThayDoiId: 'system',
      })),
    ])
  }
  if (lg.heSoLuongs.some((h) => idCu.has(h.chucDanhId))) {
    useLuongStore.getState().setHeSoLuongs(useLuongStore.getState().heSoLuongs.map((h) => (idCu.has(h.chucDanhId) ? { ...h, chucDanhId: dich.id } : h)))
  }
  const dmNow = useDanhMucStore.getState()
  if (dmNow.viTriViecLams.some((v) => v.chucDanhIds.some((i) => idCu.has(i)))) {
    dmNow.setViTriViecLams(dmNow.viTriViecLams.map((v) => (v.chucDanhIds.some((i) => idCu.has(i))
      ? { ...v, chucDanhIds: [...new Set(v.chucDanhIds.map((i) => (idCu.has(i) ? dich.id : i)))] }
      : v)))
  }
  for (const c of gop) if (c.active) dmNow.updateChucDanh(c.id, { active: false })
  logAction('system', 'Hệ thống', 'UPDATE', 'ChucDanh', dich.id,
    `Sửa ngạch văn thư: V.02.008 → 02.008 Văn thư viên trung cấp (B), V.02.007 → 02.007 Văn thư viên (A1); gộp ${gop.map((c) => c.ma).join(', ')} vào 02.008 (${doiNguoi.length} hồ sơ)`)
}

// Một người chỉ được có một bản ghi lương đang áp dụng. Bản ghi trùng (thường do đồng bộ giữa các máy
// ghi đè nhau) mà cùng bậc, cùng hệ số thì giữ bản tạo sau cùng — đó là lần sửa mới nhất của trường —
// và tắt các bản còn lại. Trùng mà khác bậc/hệ số thì không tự đoán; trang Rà soát sẽ báo để trường xử lý.
function migrateGopBanGhiLuongTrung() {
  const lg = useLuongStore.getState()
  const theoNguoi = new Map<string, typeof lg.heSoLuongs>()
  for (const h of lg.heSoLuongs) {
    if (!h.isActive) continue
    theoNguoi.set(h.vienChucId, [...(theoNguoi.get(h.vienChucId) ?? []), h])
  }
  const tat = new Set<string>()
  const giu = new Map<string, string>()
  for (const [vcId, ds] of theoNguoi) {
    if (ds.length < 2) continue
    if (!ds.every((h) => h.bac === ds[0].bac && Math.abs(h.heSo - ds[0].heSo) < 0.001)) continue
    const moiNhat = [...ds].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0]
    giu.set(vcId, moiNhat.id)
    for (const h of ds) if (h.id !== moiNhat.id) tat.add(h.id)
  }
  if (!tat.size) return
  lg.setHeSoLuongs(lg.heSoLuongs.map((h) => (tat.has(h.id) ? { ...h, isActive: false } : h)))
  const vcState = useVienChucStore.getState()
  vcState.setVienChucs(vcState.vienChucs.map((v) => (giu.has(v.id) ? { ...v, heSoLuongHienTaiId: giu.get(v.id)! } : v)))
  logAction('system', 'Hệ thống', 'UPDATE', 'HeSoLuong', undefined,
    `Gộp bản ghi lương trùng: ${giu.size} hồ sơ có nhiều bản ghi đang áp dụng (cùng bậc, hệ số) — giữ bản mới nhất`)
}

// Chức vụ phải dùng mã ngắn HT / P.HT / TTCM / TPCM — bảng hệ số PCCV (TT 33/2005) chỉ nhận các mã này.
// Bộ mã dài cũ (HIEU_TRUONG…) chọn vào sẽ không có phụ cấp chức vụ → chuyển hồ sơ sang mã ngắn và ẩn bộ mã dài.
const MA_CHUC_VU_CU: Record<string, string> = {
  HIEU_TRUONG: 'HT', PHO_HIEU_TRUONG: 'P.HT', TO_TRUONG_CM: 'TTCM', TO_PHO_CM: 'TPCM',
}
function migrateMaChucVuTrung() {
  const vcState = useVienChucStore.getState()
  const canDoi = vcState.vienChucs.filter((v) =>
    (v.chucVu && MA_CHUC_VU_CU[v.chucVu]) || (v.baoLuuPccv && MA_CHUC_VU_CU[v.baoLuuPccv.chucVuCu]))
  if (canDoi.length) {
    vcState.setVienChucs(vcState.vienChucs.map((v) => {
      const moi = { ...v }
      if (v.chucVu && MA_CHUC_VU_CU[v.chucVu]) moi.chucVu = MA_CHUC_VU_CU[v.chucVu]
      if (v.baoLuuPccv && MA_CHUC_VU_CU[v.baoLuuPccv.chucVuCu])
        moi.baoLuuPccv = { ...v.baoLuuPccv, chucVuCu: MA_CHUC_VU_CU[v.baoLuuPccv.chucVuCu] }
      return moi
    }))
    logAction('system', 'Hệ thống', 'UPDATE', 'VienChuc', undefined,
      `Chuyển ${canDoi.length} hồ sơ từ mã chức vụ dài (HIEU_TRUONG…) sang mã chuẩn HT / P.HT / TTCM / TPCM`)
  }
  const dm = useDanhMucStore.getState()
  for (const cv of dm.chucVus) {
    if (cv.active && MA_CHUC_VU_CU[cv.ma]) dm.updateChucVu(cv.id, { active: false })
  }
}

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

// Chuyển nhật ký cũ từ khối ql-luong sang kho riêng, rồi dọn khỏi chỗ cũ để
// khối lương nhẹ bớt. Chạy một lần, gộp theo id nên chạy lại cũng không nhân đôi.
function migrateNhatKySangKhoRieng() {
  const lg = useLuongStore.getState()
  const cu = lg.nhatKyThaoTacs ?? []
  if (!cu.length) return

  const nk = useNhatKyStore.getState()
  const daCo = new Set(nk.nhatKys.map((n) => n.id))
  const them = cu.filter((n) => !daCo.has(n.id))

  if (them.length) {
    nk.setNhatKys(
      [...them, ...nk.nhatKys].sort((a, b) => (b.thoiGian ?? '').localeCompare(a.thoiGian ?? '')),
    )
  }
  lg.setNhatKyThaoTacs([])
}

export function initSeedData() {
  ensureRequiredPhuCaps()
  ensureVtvlVaChucVu()
  migrateHoTenInHoa()
  migratePhuCapChucVuFormula()
  migratePhuCapUuDaiVaBaoLuu()
  migrateUuDaiTheoNd182()
  migrateTachHoSoChuyenCongTac()
  migrateGanDonViHoSoThieu()
  migrateChucDanhTheoQuyDinh()
  migrateDienCongViecNhanVien()
  migrateMaChucVuTrung()
  migrateNgachVanThu()
  migrateGopBanGhiLuongTrung()
  migrateChiTieuToDonVi()
  migrateNhatKySangKhoRieng()

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
    { id: 'pc6', ma: 'PC_THAM_NIEN', ten: 'PC Thâm niên nghề', loaiCongThuc: 'PHAN_TRAM_LUONG_CHINH' as const, giaTri: 5, moTa: MO_TA_THAM_NIEN, active: true },
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

      const chucVu = i === 0 ? 'HT' : i === 1 ? 'P.HT' : i === 4 ? 'TTCM' : undefined
      const vtvl: VTVL = isNv ? 'NHAN_VIEN' : (chucVu === 'HT' || chucVu === 'P.HT') ? 'CBQL' : 'GIAO_VIEN'
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
