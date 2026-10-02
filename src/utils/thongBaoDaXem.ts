import type { ThongBaoKetQua, CapHocTB } from '@/types/thongBao'

// Đánh dấu "đã xem" lưu riêng trên máy từng người: nhiều trường cùng ghi vào một bản thông báo
// chung trên máy chủ sẽ dễ đè nhau, mà việc đã xem chỉ là tiện ích cho người xem.
const khoa = (userId?: string) => `qlvc-tb-da-xem-${userId ?? 'khach'}`
const ma = (tb: Pick<ThongBaoKetQua, 'id' | 'banHanhLuc'>) => `${tb.id}@${tb.banHanhLuc}`

export function daXemThongBao(userId?: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(khoa(userId)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function danhDauDaXem(userId: string, tb: Pick<ThongBaoKetQua, 'id' | 'banHanhLuc'>) {
  try {
    const s = daXemThongBao(userId)
    s.add(ma(tb))
    localStorage.setItem(khoa(userId), JSON.stringify([...s]))
    window.dispatchEvent(new Event('qlvc-tb-da-xem'))
  } catch { /* bỏ qua: chế độ riêng tư */ }
}

/** Số thông báo đã ban hành mà người này chưa mở (trường: chỉ tính thông báo có phần cấp học của trường) */
export function demThongBaoMoi(thongBaos: ThongBaoKetQua[], userId?: string, capTruong?: CapHocTB | null): number {
  const daXem = daXemThongBao(userId)
  return thongBaos.filter((t) => t.trangThai === 'DA_BAN_HANH'
    && (!capTruong || t.dong.some((d) => d.cap === capTruong))
    && !daXem.has(ma(t))).length
}
