// NĐ 135/2020/NĐ-CP: lộ trình tuổi nghỉ hưu trong điều kiện lao động bình thường
//
// Điều 169 BLLĐ 2019: từ năm 2021 nam đủ 60 tuổi 03 tháng, nữ đủ 55 tuổi 04 tháng;
// sau đó mỗi năm tăng thêm 3 tháng (nam) / 4 tháng (nữ) cho đến khi nam đủ 62 tuổi
// vào năm 2028 và nữ đủ 60 tuổi vào năm 2035.
//
// Lưu ý nghiệp vụ (đây là chỗ rất dễ tính sai): Phụ lục I và II của NĐ 135 xác định
// tuổi nghỉ hưu theo **tháng, năm sinh** chứ không theo năm người lao động tròn 60/55
// tuổi. Vì tuổi nghỉ hưu tăng 3 tháng (nam) / 4 tháng (nữ) trong khi thời gian trôi đi
// 12 tháng, nên mỗi bậc của lộ trình ứng với một nhóm 9 tháng sinh (nam) hoặc
// 8 tháng sinh (nữ) liên tiếp:
//   Nam: T1–T9/1961 = 60 tuổi 3 tháng; T10/1961–T6/1962 = 60 tuổi 6 tháng; ...
//   Nữ:  T1–T8/1966 = 55 tuổi 4 tháng; T9/1966–T4/1967 = 55 tuổi 8 tháng; ...
// Kiểm chứng mốc kết thúc lộ trình: nam sinh T4/1966 đủ 62 tuổi vào T4/2028; nữ sinh
// T5/1975 đủ 60 tuổi vào T5/2035 — khớp với Điều 169.
//
// Thời điểm nghỉ hưu = ngày cuối cùng của tháng đủ tuổi nghỉ hưu theo lộ trình.
// Thời điểm hưởng chế độ hưu trí = ngày đầu tiên của tháng liền kề sau đó.
// Nếu hồ sơ không xác định được ngày, tháng sinh thì lấy 01/01 của năm sinh làm căn cứ.

type GioiTinh = 'NAM' | 'NU'

interface LoTrinh {
  namBatDau: number      // năm sinh mở đầu lộ trình
  tuoiGocThang: number   // tuổi nghỉ hưu của bậc đầu tiên, quy ra tháng
  buocThang: number      // mỗi bậc tăng thêm bao nhiêu tháng tuổi
  nhomThangSinh: number  // mỗi bậc gồm bao nhiêu tháng sinh liên tiếp
  tranThang: number      // trần tuổi nghỉ hưu, quy ra tháng
  sanThang: number       // tuổi nghỉ hưu của người sinh trước lộ trình
}

const LO_TRINH: Record<GioiTinh, LoTrinh> = {
  NAM: { namBatDau: 1961, tuoiGocThang: 60 * 12 + 3, buocThang: 3, nhomThangSinh: 9, tranThang: 62 * 12, sanThang: 60 * 12 },
  NU:  { namBatDau: 1966, tuoiGocThang: 55 * 12 + 4, buocThang: 4, nhomThangSinh: 8, tranThang: 60 * 12, sanThang: 55 * 12 },
}

// Chuẩn hoá ngày sinh — nếu không xác định được ngày/tháng hợp lệ, lấy 01/01 năm sinh
function chuanHoaNgaySinh(ngaySinh: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ngaySinh ?? '')
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(ngaySinh)
  if (!isNaN(d.getTime())) return d
  const year = parseInt((ngaySinh ?? '').slice(0, 4), 10)
  return new Date(year || new Date().getFullYear(), 0, 1)
}

/**
 * Tuổi nghỉ hưu theo lộ trình NĐ 135, quy ra số tháng, xác định theo tháng/năm sinh.
 * Xuất khẩu để đối chiếu với Phụ lục I/II khi cần kiểm tra nghiệp vụ.
 */
export function tuoiNghiHuuThang(ngaySinh: string, gioiTinh: GioiTinh): number {
  const birth = chuanHoaNgaySinh(ngaySinh)
  const lt = LO_TRINH[gioiTinh]
  // Số tháng sinh tính từ tháng 01 của năm mở đầu lộ trình
  const thangSinh = (birth.getFullYear() - lt.namBatDau) * 12 + birth.getMonth()
  if (thangSinh < 0) return lt.sanThang
  const bac = Math.floor(thangSinh / lt.nhomThangSinh)
  return Math.min(lt.tuoiGocThang + bac * lt.buocThang, lt.tranThang)
}

/** Diễn giải tuổi nghỉ hưu dạng "57 tuổi 4 tháng" để hiển thị và đối chiếu */
export function moTaTuoiNghiHuu(ngaySinh: string, gioiTinh: GioiTinh): string {
  const t = tuoiNghiHuuThang(ngaySinh, gioiTinh)
  const nam = Math.floor(t / 12)
  const thang = t % 12
  return thang ? `${nam} tuổi ${thang} tháng` : `${nam} tuổi`
}

// Ngày đủ tuổi nghỉ hưu theo lộ trình (chưa làm tròn về cuối tháng)
function ngayDuTuoiNghiHuu(ngaySinh: string, gioiTinh: GioiTinh): Date {
  const birth = chuanHoaNgaySinh(ngaySinh)
  const d = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate())
  d.setMonth(d.getMonth() + tuoiNghiHuuThang(ngaySinh, gioiTinh))
  return d
}

// Thời điểm nghỉ hưu = ngày cuối cùng của tháng đủ tuổi nghỉ hưu
export function calcRetirementDate(ngaySinh: string, gioiTinh: GioiTinh): Date {
  const d = ngayDuTuoiNghiHuu(ngaySinh, gioiTinh)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

// Thời điểm hưởng chế độ hưu trí = ngày đầu tiên của tháng liền kề sau thời điểm nghỉ hưu
export function calcPensionStartDate(ngaySinh: string, gioiTinh: GioiTinh): Date {
  const retire = calcRetirementDate(ngaySinh, gioiTinh)
  return new Date(retire.getFullYear(), retire.getMonth() + 1, 1)
}

export function getDaysUntilRetirement(ngaySinh: string, gioiTinh: GioiTinh): number {
  const rd = calcRetirementDate(ngaySinh, gioiTinh)
  const now = new Date()
  return Math.ceil((rd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/** Số tháng còn lại đến thời điểm nghỉ hưu — đếm theo tháng thật, không quy đổi 30 ngày */
export function getMonthsUntilRetirement(ngaySinh: string, gioiTinh: GioiTinh): number {
  const rd = calcRetirementDate(ngaySinh, gioiTinh)
  const now = new Date()
  let thang = (rd.getFullYear() - now.getFullYear()) * 12 + (rd.getMonth() - now.getMonth())
  if (rd.getDate() < now.getDate()) thang -= 1
  return Math.max(thang, 0)
}

export function filterRetirementInYears(
  vienChucs: Array<{ id: string; ngaySinh: string; gioiTinh: GioiTinh }>,
  years: number
): string[] {
  const now = new Date()
  const moc = new Date(now.getFullYear() + years, now.getMonth(), now.getDate())
  return vienChucs
    .filter((v) => {
      const rd = calcRetirementDate(v.ngaySinh, v.gioiTinh)
      return rd >= now && rd <= moc
    })
    .map((v) => v.id)
}
