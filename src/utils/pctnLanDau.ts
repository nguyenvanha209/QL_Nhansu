import dayjs from 'dayjs'
import type { KhaiPctnLanDau, DongQuaTrinhPctn } from '@/types/deXuat'

// Xếp phụ cấp thâm niên nhà giáo lần đầu (NĐ 77/2021/NĐ-CP; Công văn hướng dẫn của Phòng VH-XH):
// đủ 5 năm (60 tháng) giảng dạy, giáo dục có đóng BHXH bắt buộc thì hưởng 5%, từ năm thứ sáu mỗi năm (đủ 12 tháng) +1%.
// Không tính: thời gian tập sự, nghỉ việc riêng không lương liên tục từ 01 tháng, ốm đau thai sản vượt quy định,
// đi học / công tác quá hạn, bị tạm đình chỉ, tạm giữ, tạm giam.
// Đối chiếu 17 trường hợp trong danh sách TB423/2026: mốc đủ 5 năm = ngày 01 của
// (tháng bắt đầu đóng BHXH giảng dạy + 60 tháng + số tháng không tính).

/** Ngày đủ 5 năm (60 tháng) thời gian tính hưởng - undefined khi chưa khai tháng bắt đầu */
export function ngayDu5Nam(k: Pick<KhaiPctnLanDau, 'batDauBhxh' | 'thangTapSu' | 'thangKhongTinhKhac'>): string | undefined {
  if (!k.batDauBhxh || !/^\d{4}-\d{2}$/.test(k.batDauBhxh)) return undefined
  const khongTinh = Math.max(0, (k.thangTapSu || 0) + (k.thangKhongTinhKhac || 0))
  return dayjs(`${k.batDauBhxh}-01`).add(60 + khongTinh, 'month').format('YYYY-MM-DD')
}

/** Ngày bắt đầu được hưởng mặc định: ngày tuyển dụng, làm tròn lên ngày 01 của tháng (VD 13/02 → 01/03) */
export function huongTuMacDinh(ngayTuyenDung?: string): string | undefined {
  if (!ngayTuyenDung) return undefined
  const d = dayjs(ngayTuyenDung)
  return d.date() === 1 ? d.format('YYYY-MM-DD') : d.add(1, 'month').startOf('month').format('YYYY-MM-DD')
}

/**
 * Gợi ý quá trình hưởng tính đến hết kỳ xét (`denNgay`): mỗi mốc kỷ niệm từ ngày đủ 5 năm là một dòng (5%, 6%…).
 * Mốc trước ngày được hưởng (`huongTu`) không trả tiền; nếu mốc kế tiếp còn ở sau kỳ thì giữ dòng của
 * mức đang có tại ngày được hưởng, hưởng từ ngày đó (VD TB423: 10% mốc 01/12/2025, hưởng từ 01/03/2026).
 * Kế toán sửa được từng dòng khi hồ sơ có trường hợp riêng.
 */
export function goiYQuaTrinh(k: KhaiPctnLanDau, denNgay: string): DongQuaTrinhPctn[] {
  const du = ngayDu5Nam(k)
  if (!du || du > denNgay) return []
  const huongTu = k.huongTu && k.huongTu > du ? k.huongTu : du
  const moc: DongQuaTrinhPctn[] = []
  for (let n = 0; ; n++) {
    const m = dayjs(du).add(n, 'year').format('YYYY-MM-DD')
    if (m > denNgay) break
    moc.push({ tyLe: 5 + n, mocXet: m, thoiGianHuong: m })
  }
  const sauHuong = moc.filter((d) => d.mocXet >= huongTu)
  const truocHuong = moc.filter((d) => d.mocXet < huongTu)
  if (truocHuong.length && (!sauHuong.length || sauHuong[0].mocXet > huongTu)) {
    const dangCo = truocHuong[truocHuong.length - 1]
    return [{ ...dangCo, thoiGianHuong: huongTu }, ...sauHuong]
  }
  return sauHuong
}

/** Dòng cuối của quá trình là mức đang hưởng: căn cứ ghi phụ cấp và mốc xét nâng lần sau */
export const dongCuoi = (q?: DongQuaTrinhPctn[]) => (q?.length ? q[q.length - 1] : undefined)

export const ghiChuMacDinh = (k: Pick<KhaiPctnLanDau, 'thangTapSu' | 'thangKhongTinhKhac' | 'lyDoKhongTinh'>) =>
  [k.thangTapSu ? `Thời gian tập sự ${k.thangTapSu} tháng` : '', k.thangKhongTinhKhac ? `${k.lyDoKhongTinh || 'Thời gian không tính'} ${k.thangKhongTinhKhac} tháng` : '']
    .filter(Boolean).join('; ')
