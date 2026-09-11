import type { User, UserRole } from '@/types/auth'

export type Action = 'read' | 'write' | 'approve' | 'admin'

// Nguồn sự thật duy nhất về phân quyền. Trước đây ma trận này bị chép thành hai
// bản — một bản chạy thật ở đây, một bản chỉ để hiển thị trong trang quản trị.
// Hai bản có thể lệch nhau, khiến giao diện báo một đằng còn hệ thống chạy một
// nẻo. Mọi nơi nay đều dùng chung các hằng số dưới đây.

export const RESOURCES: { key: string; label: string }[] = [
  { key: 'vienChuc', label: 'Hồ sơ viên chức' },
  { key: 'viTri',    label: 'Vị trí việc làm' },
  { key: 'luong',    label: 'Lương & hệ số' },
  { key: 'deXuat',   label: 'Đề xuất điều chỉnh' },
  { key: 'baoCao',   label: 'Báo cáo' },
  { key: 'duBao',    label: 'Dự báo nghỉ hưu' },
  { key: 'admin',    label: 'Quản trị hệ thống' },
]

export const ACTIONS: { key: Action; label: string }[] = [
  { key: 'read',    label: 'Xem' },
  { key: 'write',   label: 'Sửa' },
  { key: 'approve', label: 'Duyệt' },
  { key: 'admin',   label: 'Quản trị' },
]

const PERMISSIONS: Record<UserRole, Record<string, Action[]>> = {
  ADMIN: {
    '*': ['read', 'write', 'approve', 'admin'],
  },
  CB_VH_XH: {
    vienChuc: ['read', 'write'],
    viTri: ['read', 'write'],
    luong: ['read', 'write'],
    deXuat: ['read', 'write', 'approve'],
    baoCao: ['read'],
    duBao: ['read'],
  },
  LANH_DAO: {
    vienChuc: ['read'],
    viTri: ['read'],
    luong: ['read'],
    deXuat: ['read', 'approve'],
    baoCao: ['read'],
    duBao: ['read'],
  },
  HIEU_TRUONG: {
    vienChuc: ['read', 'write'],
    viTri: ['read'],
    luong: ['read'],
    deXuat: ['read', 'approve'],
    baoCao: ['read'],
    duBao: ['read'],
  },
  CB_TRUONG: {
    vienChuc: ['read', 'write'],
    viTri: ['read'],
    luong: ['read'],
    deXuat: ['read', 'write'],
    baoCao: ['read'],
    duBao: ['read'],
  },
}

export const ROLE_DESC: Record<UserRole, string> = {
  ADMIN: 'Toàn quyền — quản trị hệ thống, tài khoản, danh mục. Không giới hạn phạm vi đơn vị.',
  CB_VH_XH: 'Cán bộ Phòng VH-XH: xem + sửa toàn bộ hồ sơ, lương, đề xuất của tất cả trường.',
  LANH_DAO: 'Lãnh đạo UBND phường: chỉ xem và phê duyệt, không chỉnh sửa dữ liệu.',
  HIEU_TRUONG: 'Hiệu trưởng: xem + sửa hồ sơ trường mình, tạo và duyệt đề xuất của trường.',
  CB_TRUONG: 'Cán bộ trường (kế toán): xem + sửa hồ sơ và tạo đề xuất — chỉ trong phạm vi trường được gán.',
}

export const khoaQuyen = (resource: string, action: Action) => `${resource}:${action}`

// Quyền mặc định của vai trò, chưa tính phần tùy chỉnh riêng của tài khoản
export function quyenTheoVaiTro(role: UserRole, resource: string, action: Action): boolean {
  const perms = PERMISSIONS[role]
  if (!perms) return false
  return (perms['*']?.includes(action) || perms[resource]?.includes(action)) ?? false
}

type NguoiDung = Pick<User, 'role' | 'quyenRieng'> | null | undefined

// Quyền thực tế: mặc định theo vai trò, có thể được cấp thêm hoặc thu hồi riêng
// cho từng tài khoản. Thu hồi luôn thắng cấp thêm — khi hai bên mâu thuẫn thì
// chọn phía an toàn hơn.
export function can(user: NguoiDung, resource: string, action: Action): boolean {
  if (!user) return false
  const k = khoaQuyen(resource, action)
  if (user.quyenRieng?.bot?.includes(k)) return false
  if (user.quyenRieng?.them?.includes(k)) return true
  return quyenTheoVaiTro(user.role, resource, action)
}

export function canAny(user: NguoiDung, resource: string, actions: Action[]): boolean {
  return actions.some((a) => can(user, resource, a))
}

// Đối chiếu bảng tích chọn của quản trị viên với mặc định của vai trò để rút ra
// danh sách cấp thêm / thu hồi. Nhờ vậy khi vai trò đổi, những quyền trùng với
// mặc định mới sẽ tự biến mất khỏi phần tùy chỉnh thay vì nằm lại vô nghĩa.
export function tinhQuyenRieng(
  role: UserRole,
  chon: Record<string, boolean>,
): User['quyenRieng'] {
  const them: string[] = []
  const bot: string[] = []
  for (const r of RESOURCES) {
    for (const a of ACTIONS) {
      const k = khoaQuyen(r.key, a.key)
      const macDinh = quyenTheoVaiTro(role, r.key, a.key)
      const muon = !!chon[k]
      if (muon && !macDinh) them.push(k)
      if (!muon && macDinh) bot.push(k)
    }
  }
  if (!them.length && !bot.length) return undefined
  return { ...(them.length ? { them } : {}), ...(bot.length ? { bot } : {}) }
}

export function demQuyenRieng(q: User['quyenRieng']): number {
  return (q?.them?.length ?? 0) + (q?.bot?.length ?? 0)
}
