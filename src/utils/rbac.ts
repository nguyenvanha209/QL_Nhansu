import type { User, UserRole } from '@/types/auth'

// Hành động. Ba bước duyệt phiếu đề xuất là ba quyền riêng để cấp / thu hồi được cho từng tài khoản:
// approve = Thủ trưởng đơn vị duyệt (bước 2), thamDinh = Phòng VHXH thẩm định (bước 3),
// pheDuyet = Lãnh đạo Phòng VHXH phê duyệt (bước 4). Ở các chức năng khác approve = duyệt / ban hành.
export type Action = 'read' | 'write' | 'approve' | 'thamDinh' | 'pheDuyet' | 'admin'

// Nguồn sự thật duy nhất về phân quyền: menu, định tuyến, nút thao tác và bảng quyền ở trang
// Tài khoản người dùng đều đọc từ đây.
export interface TaiNguyen {
  key: string
  label: string
  /** Các hành động có nghĩa với chức năng này, kèm tên hiển thị trong bảng quyền */
  actions: { key: Action; label: string }[]
}

const XEM = { key: 'read' as const, label: 'Xem' }

export const RESOURCES: TaiNguyen[] = [
  { key: 'vienChuc', label: 'Hồ sơ nhân sự', actions: [XEM, { key: 'write', label: 'Thêm, sửa' }] },
  { key: 'bhxh', label: 'Thông tin BHXH', actions: [XEM, { key: 'write', label: 'Khai, nhập Excel' }] },
  { key: 'chuyenCongTac', label: 'Chuyển công tác', actions: [XEM, { key: 'write', label: 'Lập đề nghị' }, { key: 'approve', label: 'Duyệt' }] },
  { key: 'boNhiem', label: 'Bổ nhiệm, kế toán', actions: [XEM, { key: 'write', label: 'Nhập quyết định, mốc' }] },
  { key: 'luong', label: 'Lương, rà soát ngạch - bậc', actions: [XEM, { key: 'write', label: 'Sửa trực tiếp' }] },
  { key: 'quyMo', label: 'Cơ cấu VTVL, định mức', actions: [XEM, { key: 'write', label: 'Khai, giao chỉ tiêu' }] },
  { key: 'thongTinTruong', label: 'Thông tin trường', actions: [XEM, { key: 'write', label: 'Khai quy mô' }] },
  {
    key: 'deXuat', label: 'Phiếu nâng lương, điều chỉnh',
    actions: [
      XEM, { key: 'write', label: 'Lập, trình' }, { key: 'approve', label: 'Thủ trưởng duyệt' },
      { key: 'thamDinh', label: 'Thẩm định' }, { key: 'pheDuyet', label: 'Phê duyệt' },
    ],
  },
  { key: 'truyLinh', label: 'Truy lĩnh', actions: [XEM, { key: 'write', label: 'Lập, trình' }, { key: 'approve', label: 'Duyệt' }] },
  { key: 'thongBao', label: 'Thông báo kết quả', actions: [XEM, { key: 'write', label: 'Tổng hợp, soạn' }, { key: 'approve', label: 'Ban hành' }] },
  { key: 'baoCao', label: 'Báo cáo', actions: [XEM] },
  { key: 'duBao', label: 'Dự báo nghỉ hưu', actions: [XEM] },
  { key: 'quyDinh', label: 'Quy định nghiệp vụ (mức nâng trước hạn, kỳ chuyển đổi kế toán)', actions: [{ key: 'write', label: 'Sửa' }] },
  { key: 'admin', label: 'Quản trị hệ thống (danh mục, tài khoản, nhật ký)', actions: [{ key: 'admin', label: 'Quản trị' }] },
]

// Tên cũ còn có thể nằm trong quyền riêng đã lưu hoặc mã cũ: trang Vị trí việc làm đã gộp vào Cơ cấu VTVL
const BI_DANH: Record<string, string> = { viTri: 'quyMo' }

const R = (...a: Action[]) => a
const PERMISSIONS: Record<UserRole, Record<string, Action[]>> = {
  ADMIN: {
    '*': ['read', 'write', 'approve', 'thamDinh', 'pheDuyet', 'admin'],
  },
  CB_VH_XH: {
    vienChuc: R('read', 'write'),
    bhxh: R('read', 'write'),
    chuyenCongTac: R('read', 'write', 'approve'),
    boNhiem: R('read', 'write'),
    luong: R('read', 'write'),
    quyMo: R('read', 'write'),
    thongTinTruong: R('read', 'write'),
    deXuat: R('read', 'write', 'thamDinh'),
    truyLinh: R('read'),
    thongBao: R('read', 'write'),
    baoCao: R('read'),
    duBao: R('read'),
    quyDinh: R('write'),
  },
  LANH_DAO: {
    vienChuc: R('read'),
    bhxh: R('read'),
    chuyenCongTac: R('read'),
    boNhiem: R('read'),
    luong: R('read'),
    quyMo: R('read'),
    thongTinTruong: R('read'),
    deXuat: R('read', 'pheDuyet'),
    truyLinh: R('read', 'approve'),
    thongBao: R('read', 'approve'),
    baoCao: R('read'),
    duBao: R('read'),
  },
  HIEU_TRUONG: {
    vienChuc: R('read', 'write'),
    bhxh: R('read', 'write'),
    chuyenCongTac: R('read', 'write'),
    boNhiem: R('read', 'write'),
    luong: R('read'),
    quyMo: R('read', 'write'),
    thongTinTruong: R('read', 'write'),
    deXuat: R('read', 'approve'),
    truyLinh: R('read', 'write'),
    thongBao: R('read'),
    baoCao: R('read'),
    duBao: R('read'),
  },
  CB_TRUONG: {
    vienChuc: R('read', 'write'),
    bhxh: R('read', 'write'),
    chuyenCongTac: R('read', 'write'),
    boNhiem: R('read', 'write'),
    luong: R('read'),
    quyMo: R('read', 'write'),
    thongTinTruong: R('read', 'write'),
    deXuat: R('read', 'write'),
    truyLinh: R('read', 'write'),
    thongBao: R('read'),
    baoCao: R('read'),
    duBao: R('read'),
  },
}

export const ROLE_DESC: Record<UserRole, string> = {
  ADMIN: 'Toàn quyền: quản trị danh mục, tài khoản, nhật ký; làm thay mọi bước. Không giới hạn đơn vị.',
  CB_VH_XH: 'Cán bộ Phòng VHXH: sửa hồ sơ, lương các đơn vị thuộc khối phụ trách; thẩm định phiếu (bước 3); tổng hợp thông báo kết quả; duyệt chuyển công tác.',
  LANH_DAO: 'Lãnh đạo Phòng VHXH (Trưởng phòng được ủy quyền): phê duyệt phiếu (bước 4), duyệt truy lĩnh, ban hành thông báo kết quả; xem dữ liệu khối phụ trách.',
  HIEU_TRUONG: 'Thủ trưởng đơn vị (Hiệu trưởng, Trưởng phòng, Giám đốc): sửa hồ sơ đơn vị mình; duyệt phiếu của đơn vị (bước 2); trình bảng truy lĩnh.',
  CB_TRUONG: 'Cán bộ đơn vị (kế toán, tổ chức): sửa hồ sơ đơn vị mình; lập phiếu đề xuất (bước 1), bảng truy lĩnh, đề nghị chuyển công tác.',
}

export const khoaQuyen = (resource: string, action: Action) => `${resource}:${action}`

// Quyền mặc định của vai trò, chưa tính phần tùy chỉnh riêng của tài khoản
export function quyenTheoVaiTro(role: UserRole, resource: string, action: Action): boolean {
  const perms = PERMISSIONS[role]
  if (!perms) return false
  const r = BI_DANH[resource] ?? resource
  return (perms['*']?.includes(action) || perms[r]?.includes(action)) ?? false
}

type NguoiDung = Pick<User, 'role' | 'quyenRieng'> | null | undefined

// Quyền thực tế: mặc định theo vai trò, có thể được cấp thêm hoặc thu hồi riêng
// cho từng tài khoản. Thu hồi luôn thắng cấp thêm - khi hai bên mâu thuẫn thì
// chọn phía an toàn hơn.
export function can(user: NguoiDung, resource: string, action: Action): boolean {
  if (!user) return false
  const k = khoaQuyen(BI_DANH[resource] ?? resource, action)
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
    for (const a of r.actions) {
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

/** Tên dễ đọc của một khoá quyền "taiNguyen:hanhDong" (hiển thị quyền riêng) */
export function tenQuyen(k: string): string {
  const [r, a] = k.split(':')
  const tn = RESOURCES.find((x) => x.key === (BI_DANH[r] ?? r))
  const hd = tn?.actions.find((x) => x.key === a)
  return tn && hd ? `${tn.label} - ${hd.label}` : k
}

export function demQuyenRieng(q: User['quyenRieng']): number {
  return (q?.them?.length ?? 0) + (q?.bot?.length ?? 0)
}
