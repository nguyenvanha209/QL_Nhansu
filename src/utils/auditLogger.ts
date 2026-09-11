import { useNhatKyStore } from '@/store/nhatKyStore'
import type { HanhDongNhatKy, ThayDoiTruong } from '@/types/luong'

// Nhật ký ghi thẳng vào kho riêng của nó. Trước đây phải nạp động luongStore để
// tránh phụ thuộc vòng; nay kho nhật ký không phụ thuộc kho nào khác nên gọi
// trực tiếp được, bỏ được độ trễ bất định của import động.

// Rút gọn trình duyệt và hệ điều hành để biết thao tác thực hiện từ máy nào.
function motaThietBi(): string | undefined {
  if (typeof navigator === 'undefined') return undefined
  const ua = navigator.userAgent
  const tr =
    /Edg\//.test(ua) ? 'Edge'
      : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox'
      : /Safari\//.test(ua) ? 'Safari'
      : 'Trình duyệt khác'
  const hdh =
    /Windows/.test(ua) ? 'Windows'
      : /Android/.test(ua) ? 'Android'
      : /iPhone|iPad/.test(ua) ? 'iOS'
      : /Mac OS/.test(ua) ? 'macOS'
      : /Linux/.test(ua) ? 'Linux'
      : ''
  return hdh ? `${tr} trên ${hdh}` : tr
}

export interface TuyChonNhatKy {
  entityId?: string
  moTa?: string
  donViId?: string
  chiTiet?: ThayDoiTruong[]
}

export function logAction(
  userId: string,
  userFullName: string,
  action: HanhDongNhatKy,
  entity: string,
  entityIdHoacTuyChon?: string | TuyChonNhatKy,
  moTa?: string,
) {
  // Giữ nguyên cách gọi cũ (entityId, moTa) đồng thời nhận thêm dạng đối tượng
  // để ghi được chi tiết từng trường.
  const t: TuyChonNhatKy =
    typeof entityIdHoacTuyChon === 'string' || entityIdHoacTuyChon === undefined
      ? { entityId: entityIdHoacTuyChon, moTa }
      : entityIdHoacTuyChon

  useNhatKyStore.getState().them({
    userId,
    userFullName,
    action,
    entity,
    entityId: t.entityId,
    moTa: t.moTa ?? `${action} ${entity}${t.entityId ? ` [${t.entityId}]` : ''}`,
    thoiGian: new Date().toISOString(),
    donViId: t.donViId,
    chiTiet: t.chiTiet?.length ? t.chiTiet : undefined,
    thietBi: motaThietBi(),
  })
}

// So hai bản ghi và rút ra danh sách trường thực sự thay đổi, dùng cho các thao
// tác cập nhật để nhật ký nói rõ sửa gì thành gì.
export function soSanhThayDoi(
  truoc: Record<string, unknown> | undefined,
  sau: Record<string, unknown>,
  nhan: Record<string, string> = {},
  boQua: string[] = ['updatedAt', 'createdAt', 'id'],
): ThayDoiTruong[] {
  if (!truoc) return []
  const ra: ThayDoiTruong[] = []
  for (const k of Object.keys(sau)) {
    if (boQua.includes(k)) continue
    const a = truoc[k]
    const b = sau[k]
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    ra.push({
      truong: nhan[k] ?? k,
      truoc: a === undefined || a === null || a === '' ? '(trống)' : String(a),
      sau: b === undefined || b === null || b === '' ? '(trống)' : String(b),
    })
  }
  return ra
}
