// NĐ 135/2020/NĐ-CP: tuổi nghỉ hưu tăng dần
// Nam: từ 60 → 62 tuổi, tăng 3 tháng/năm từ 2021, đạt 62 vào 2028
// Nữ: từ 55 → 60 tuổi, tăng 4 tháng/năm từ 2021, đạt 60 vào 2036

export function getRetirementAge(gioiTinh: 'NAM' | 'NU', birthYear: number): number {
  const retirementYear = birthYear + (gioiTinh === 'NAM' ? 62 : 60)
  if (gioiTinh === 'NAM') {
    // Phase-in: +3 months/year from 2021, base 60 → 62 reached 2028
    const yearsSince2021 = Math.max(0, retirementYear - 2021)
    const addMonths = Math.min(yearsSince2021 * 3, 24) // cap at 24 months = 2 years
    return 60 + addMonths / 12
  } else {
    const yearsSince2021 = Math.max(0, retirementYear - 2021)
    const addMonths = Math.min(yearsSince2021 * 4, 60) // cap at 60 months = 5 years
    return 55 + addMonths / 12
  }
}

export interface RetirementInfo {
  id: string
  hoTen: string
  ngaySinh: string
  gioiTinh: 'NAM' | 'NU'
  donViId: string
  donViTen: string
  chucDanhId: string
  ngayNghiHuu: string
  daysUntilRetirement: number
  yearsUntilRetirement: number
}

export function calcRetirementDate(ngaySinh: string, gioiTinh: 'NAM' | 'NU'): Date {
  const birth = new Date(ngaySinh)
  const birthYear = birth.getFullYear()
  const baseAge = gioiTinh === 'NAM' ? 60 : 55
  const phaseYears = gioiTinh === 'NAM' ? 8 : 15
  const monthsPerYear = gioiTinh === 'NAM' ? 3 : 4

  const estimatedRetirementYear = birthYear + baseAge + 2
  const yearsSince2021 = Math.max(0, estimatedRetirementYear - 2021)
  const addMonths = Math.min(yearsSince2021 * monthsPerYear, gioiTinh === 'NAM' ? 24 : 60)

  const retirementDate = new Date(birth)
  retirementDate.setFullYear(birth.getFullYear() + baseAge)
  retirementDate.setMonth(retirementDate.getMonth() + addMonths)
  return retirementDate
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
