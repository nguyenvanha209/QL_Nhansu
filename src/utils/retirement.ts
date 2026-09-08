// NĐ 135/2020/NĐ-CP: lộ trình tuổi nghỉ hưu
// Nam: năm 2021 = 60 tuổi 3 tháng, mỗi năm tiếp theo +3 tháng, đạt 62 tuổi vào năm 2028
// Nữ: năm 2021 = 55 tuổi 4 tháng, mỗi năm tiếp theo +4 tháng, đạt 60 tuổi vào năm 2035
// Thời điểm nghỉ hưu = ngày cuối cùng của tháng đủ tuổi nghỉ hưu theo lộ trình
// Thời điểm hưởng chế độ hưu trí = ngày đầu tiên của tháng liền kề sau thời điểm nghỉ hưu
// Nếu hồ sơ không xác định được ngày, tháng sinh thì lấy ngày 01/01 của năm sinh làm căn cứ

const BASE_AGE: Record<'NAM' | 'NU', number> = { NAM: 60, NU: 55 }
const THANG_TANG_MOI_NAM: Record<'NAM' | 'NU', number> = { NAM: 3, NU: 4 }
const CAP_THANG_TANG: Record<'NAM' | 'NU', number> = { NAM: 24, NU: 60 } // Nam tối đa +24 tháng (62 tuổi); Nữ tối đa +60 tháng (60 tuổi)

// Chuẩn hoá ngày sinh — nếu không xác định được ngày/tháng hợp lệ, lấy 01/01 năm sinh
function chuanHoaNgaySinh(ngaySinh: string): Date {
  const d = new Date(ngaySinh)
  if (!isNaN(d.getTime())) return d
  const year = parseInt((ngaySinh ?? '').slice(0, 4), 10)
  return new Date(year || new Date().getFullYear(), 0, 1)
}

// Số tháng được cộng thêm vào tuổi nghỉ hưu cơ sở, theo năm đủ tuổi cơ sở (60/55)
function soThangTangTheoLoTrinh(namDuTuoiCoSo: number, gioiTinh: 'NAM' | 'NU'): number {
  if (namDuTuoiCoSo < 2021) return 0
  return Math.min((namDuTuoiCoSo - 2020) * THANG_TANG_MOI_NAM[gioiTinh], CAP_THANG_TANG[gioiTinh])
}

// Ngày đủ tuổi nghỉ hưu theo lộ trình (chưa làm tròn về cuối tháng)
function ngayDuTuoiNghiHuu(ngaySinh: string, gioiTinh: 'NAM' | 'NU'): Date {
  const birth = chuanHoaNgaySinh(ngaySinh)
  const baseAge = BASE_AGE[gioiTinh]
  const namDuTuoiCoSo = birth.getFullYear() + baseAge
  const soThang = soThangTangTheoLoTrinh(namDuTuoiCoSo, gioiTinh)
  const d = new Date(birth)
  d.setFullYear(d.getFullYear() + baseAge)
  d.setMonth(d.getMonth() + soThang)
  return d
}

// Thời điểm nghỉ hưu = ngày cuối cùng của tháng đủ tuổi nghỉ hưu
export function calcRetirementDate(ngaySinh: string, gioiTinh: 'NAM' | 'NU'): Date {
  const d = ngayDuTuoiNghiHuu(ngaySinh, gioiTinh)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

// Thời điểm hưởng chế độ hưu trí = ngày đầu tiên của tháng liền kề sau thời điểm nghỉ hưu
export function calcPensionStartDate(ngaySinh: string, gioiTinh: 'NAM' | 'NU'): Date {
  const retire = calcRetirementDate(ngaySinh, gioiTinh)
  return new Date(retire.getFullYear(), retire.getMonth() + 1, 1)
}

export function getDaysUntilRetirement(ngaySinh: string, gioiTinh: 'NAM' | 'NU'): number {
  const rd = calcRetirementDate(ngaySinh, gioiTinh)
  const now = new Date()
  return Math.ceil((rd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function filterRetirementInYears(
  vienChucs: Array<{ id: string; ngaySinh: string; gioiTinh: 'NAM' | 'NU' }>,
  years: number
): string[] {
  const limit = years * 365
  return vienChucs
    .filter((v) => {
      const days = getDaysUntilRetirement(v.ngaySinh, v.gioiTinh)
      return days >= 0 && days <= limit
    })
    .map((v) => v.id)
}
