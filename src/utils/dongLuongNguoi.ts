import type { HeSoLuong, PhuCapVienChuc } from '@/types/luong'
import type { LoaiPhuCap, ChucDanhNgheNghiep } from '@/types/danhMuc'
import type { VienChuc } from '@/types/vienChuc'
import { CHUC_VU_LABELS, nhanLuongTheoTien } from '@/types/vienChuc'
import { formatDate } from '@/utils/helpers'
import { pccvThucHuong, dangBaoLuuPccv } from '@/utils/baoLuuPccv'
import { chonBanDangHuong } from '@/utils/phuCapDangHuong'

// Hệ số lương, phụ cấp đang hưởng của một người - dùng chung cho Bảng tổng hợp lương và Đăng ký lao động tiền lương

const PC_VK_MA  = 'PC_THAM_NIEN_VK'
const PC_CV_MA  = 'PC_CHUC_VU'
const PC_TN_MA  = 'PC_TRACH_NHIEM'
const PC_TNN_MA = 'PC_THAM_NIEN'
const PC_BAO_LUU_MA = 'PC_BAO_LUU'
const PC_UD_PREFIX = 'PCUD'
const PC_CVU_MA = 'PC_CONG_VU'

const r3 = (n: number) => Math.round(n * 1000) / 1000

export interface RowData {
  _type: 'data'
  key: string
  stt: number
  donViId: string
  hoTen: string
  ngaySinh: string
  chucVuHienThi: string
  maCDNN: string
  bac: number | ''
  heSo: number | ''
  vkPct: number
  vkHeSo: number
  tongHSLC: number
  thoiDiem: string
  pcCV: number
  /** Đang hưởng PCCV bảo lưu (sắp xếp tổ chức) - ngày hết bảo lưu */
  pcCvBaoLuuDen?: string
  pcTN: number
  pcTNNG_Pct: number
  pcTNNG_HeSo: number
  mocTNNG: string
  hsBaoLuu: number
  pcUD: number
  /** PC công vụ (công chức, cơ quan hành chính): % và quy ra hệ số */
  pcCongVuPct: number
  pcCongVu: number
  tong1Thang: number
  tong6Thang: number
  /** Hợp đồng nhận lương theo mức tiền (đ/tháng) - không có hệ số lương chính */
  mucLuongTien: number
}

export function buildRow(
  stt: number,
  vc: VienChuc,
  heSos: HeSoLuong[],
  phuCaps: PhuCapVienChuc[],
  loaiPhuCaps: LoaiPhuCap[],
  chucDanhs: ChucDanhNgheNghiep[],
): RowData {
  // Lương theo mức tiền: không tính theo bậc, hệ số (kể cả khi còn sót bản ghi hệ số cũ)
  const theoTien = nhanLuongTheoTien(vc)
  // Ưu tiên bản ghi hồ sơ đang trỏ tới; phòng khi có bản ghi trùng do đồng bộ (trang Rà soát sẽ báo)
  const heSoRec = theoTien ? undefined
    : heSos.find((h) => h.id === vc.heSoLuongHienTaiId && h.isActive && h.vienChucId === vc.id)
      ?? heSos.find((h) => h.vienChucId === vc.id && h.isActive)
  const mine = phuCaps.filter((p) => p.vienChucId === vc.id && p.isActive)

  // Còn bản trùng thì lấy bản có ngày hiệu lực mới nhất (trang Rà soát báo "Phụ cấp ghi trùng")
  const byMa = (ma: string) => {
    const loai = loaiPhuCaps.find((l) => l.ma === ma)
    const rec = loai ? chonBanDangHuong(mine.filter((p) => p.loaiPhuCapId === loai.id)) : undefined
    const val = rec ? (rec.giaTri > 0 ? rec.giaTri : loai?.giaTri ?? 0) : 0
    return { loai, rec, val }
  }

  const udLoaiIds = new Set(loaiPhuCaps.filter((l) => l.ma.startsWith(PC_UD_PREFIX)).map((l) => l.id))
  const udRec = chonBanDangHuong(mine.filter((p) => udLoaiIds.has(p.loaiPhuCapId)))
  const udLoai = udRec ? loaiPhuCaps.find((l) => l.id === udRec.loaiPhuCapId) : undefined
  const udVal = udRec ? (udRec.giaTri > 0 ? udRec.giaTri : udLoai?.giaTri ?? 0) : 0

  const { val: vkPct } = byMa(PC_VK_MA)
  // PCCV thực hưởng: mức bảo lưu (sắp xếp tổ chức) nếu còn hạn, không thì theo chức vụ hiện tại.
  // Nền tính PC thâm niên, ưu đãi dùng luôn mức thực hưởng này.
  const { val: cvTheoChucVu } = byMa(PC_CV_MA)
  const cvCoeff = pccvThucHuong(vc, cvTheoChucVu)
  const cvBaoLuu = dangBaoLuuPccv(vc) && cvCoeff > cvTheoChucVu
  const { val: tnCoeff } = byMa(PC_TN_MA)
  const { val: tnnPct, rec: tnnRec } = byMa(PC_TNN_MA)
  const { val: cvuPct } = byMa(PC_CVU_MA)

  const heSo = heSoRec?.heSo ?? 0
  // Hệ số chênh lệch bảo lưu nằm ở hai chỗ tuỳ nguồn nhập: một số hồ sơ ghi
  // thẳng vào bản ghi hệ số lương, số khác (nhập từ bảng lương Excel) lại ghi
  // thành một khoản phụ cấp riêng. Đọc cả hai, nếu không cột này luôn trống và
  // phần bảo lưu bị thiếu khỏi tổng hệ số của người đó.
  const { val: baoLuuPhuCap } = byMa(PC_BAO_LUU_MA)
  const baoLuu = baoLuuPhuCap || (heSoRec?.heSoBaoLuu ?? 0)
  const vkHeSo = r3(heSo * (vkPct / 100))
  const tongHSLC = r3(heSo + vkHeSo)
  const nen = tongHSLC + cvCoeff
  const pcTNNG_HeSo = r3(nen * (tnnPct / 100))
  const pcUD_HeSo = r3(nen * (udVal / 100))
  // PC công vụ: % trên lương ngạch bậc + PC thâm niên vượt khung + PC chức vụ (đúng nền `nen`) - chỉ công chức có
  const pcCongVu = r3(nen * (cvuPct / 100))
  const tong1Thang = r3(tongHSLC + cvCoeff + tnCoeff + pcTNNG_HeSo + baoLuu + pcUD_HeSo + pcCongVu)

  const chucDanh = chucDanhs.find((c) => c.id === vc.chucDanhId)
  const chucVuHienThi = vc.chucVu
    ? (CHUC_VU_LABELS[vc.chucVu as keyof typeof CHUC_VU_LABELS] ?? vc.chucVu)
    : (chucDanh?.ten ?? '')

  return {
    _type: 'data',
    key: vc.id,
    stt,
    donViId: vc.donViId,
    hoTen: `${vc.ho} ${vc.ten}`.trim(),
    ngaySinh: formatDate(vc.ngaySinh),
    chucVuHienThi,
    maCDNN: chucDanh?.ma ?? '',
    bac: heSoRec?.bac ?? '',
    heSo: heSo || '',
    vkPct,
    vkHeSo,
    tongHSLC,
    thoiDiem: heSoRec ? formatDate(heSoRec.ngayHieuLuc) : '',
    pcCV: cvCoeff,
    pcCvBaoLuuDen: cvBaoLuu ? vc.baoLuuPccv!.denNgay : undefined,
    pcTN: tnCoeff,
    pcTNNG_Pct: tnnPct,
    pcTNNG_HeSo,
    mocTNNG: tnnRec ? formatDate(tnnRec.ngayHieuLuc) : '',
    hsBaoLuu: baoLuu,
    pcUD: pcUD_HeSo,
    pcCongVuPct: cvuPct,
    pcCongVu,
    tong1Thang,
    tong6Thang: r3(tong1Thang * 6),
    mucLuongTien: theoTien ? (vc.mucLuongTien ?? 0) : 0,
  }
}

