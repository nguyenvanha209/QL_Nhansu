import { supabase, napPhienDangNhap, dayGhiNgay } from './supabase'

// Mật khẩu không còn nằm trong ql-users. Chúng được băm bcrypt và lưu ở bảng
// mat_khau trên Supabase - bảng này bật RLS và không có policy nào, nên không
// đọc trực tiếp được kể cả khi có khóa anon. Mọi thao tác đi qua các hàm
// security definer khai báo ở tools/sql/01-tao-bang-mat-khau.sql.

/** Email nội bộ của tài khoản trong Supabase Auth - cùng quy tắc với public.email_dang_nhap (tools/sql/04) */
export const emailDangNhap = (username: string) =>
  `${username.trim().replace(/[^A-Za-z0-9._-]/g, '-').toLowerCase()}@ql-nhansu.ngoquyen.edu.vn`

/** Đăng xuất phiên máy chủ (không chờ - mất mạng vẫn đăng xuất được ở máy) */
export function dangXuatMayChu() {
  // Lệnh ghi đang chờ gom (VD nhật ký đăng xuất) phải gửi trước khi mất phiên
  dayGhiNgay()
  supabase?.auth.signOut().catch(() => {})
}

export type KetQuaDangNhap =
  | { ok: true }
  | { ok: false; lyDo: 'CHUA_KICH_HOAT' }
  | { ok: false; lyDo: 'SAI'; conLai: number }
  | { ok: false; lyDo: 'KHOA'; khoaDen: string }
  | { ok: false; lyDo: 'CHUA_CAU_HINH' }
  | { ok: false; lyDo: 'LOI' }

export async function dangNhap(username: string, password: string): Promise<KetQuaDangNhap> {
  if (!supabase) return { ok: false, lyDo: 'CHUA_CAU_HINH' }

  const { data, error } = await supabase.rpc('dang_nhap', {
    p_username: username,
    p_password: password,
  })

  if (error) {
    console.error('[dang_nhap]', error.message)
    return { ok: false, lyDo: 'LOI' }
  }
  if (data?.ok) {
    // Mật khẩu đúng → lấy phiên có chữ ký của máy chủ; dữ liệu chỉ mở cho phiên này
    const { error: e2 } = await supabase.auth.signInWithPassword({ email: emailDangNhap(username), password })
    if (e2) {
      console.error('[dang_nhap] Supabase Auth:', e2.message)
      return /invalid login credentials|not found|banned/i.test(e2.message) ? { ok: false, lyDo: 'CHUA_KICH_HOAT' } : { ok: false, lyDo: 'LOI' }
    }
    await napPhienDangNhap()
    return { ok: true }
  }
  if (data?.ly_do === 'KHOA') return { ok: false, lyDo: 'KHOA', khoaDen: data.khoa_den }
  return { ok: false, lyDo: 'SAI', conLai: data?.con_lai ?? 0 }
}

// Phân biệt rõ "sai mật khẩu cũ" với "không gọi được máy chủ". Gộp chung thành
// false khiến người dùng mất mạng bị báo là gõ sai mật khẩu, tưởng đã đổi xong
// trong khi máy chủ chưa ghi nhận gì.
export type KetQuaDoiMatKhau =
  | { ok: true }
  | { ok: false; lyDo: 'SAI_MK_CU' }
  | { ok: false; lyDo: 'CHUA_CAU_HINH' }
  | { ok: false; lyDo: 'LOI'; thongBao: string }

export async function doiMatKhau(username: string, cu: string, moi: string): Promise<KetQuaDoiMatKhau> {
  if (!supabase) return { ok: false, lyDo: 'CHUA_CAU_HINH' }

  const { data, error } = await supabase.rpc('doi_mat_khau', {
    p_username: username,
    p_cu: cu,
    p_moi: moi,
  })

  if (error) {
    console.error('[doi_mat_khau]', error.message)
    return { ok: false, lyDo: 'LOI', thongBao: error.message }
  }
  return data === true ? { ok: true } : { ok: false, lyDo: 'SAI_MK_CU' }
}

export type KetQuaDatMatKhau =
  | { ok: true }
  | { ok: false; lyDo: 'SAI_MK_ADMIN' }
  | { ok: false; lyDo: 'CHUA_CAU_HINH' }
  | { ok: false; lyDo: 'LOI'; thongBao: string }

// Admin phải nhập lại mật khẩu của chính mình cho mỗi lần cấp/đặt lại mật khẩu.
export async function adminDatMatKhau(
  adminUsername: string,
  adminPassword: string,
  username: string,
  matKhauMoi: string,
  laAdmin = false,
): Promise<KetQuaDatMatKhau> {
  if (!supabase) return { ok: false, lyDo: 'CHUA_CAU_HINH' }

  const { data, error } = await supabase.rpc('admin_dat_mat_khau', {
    p_admin: adminUsername,
    p_admin_pass: adminPassword,
    p_username: username,
    p_moi: matKhauMoi,
    p_la_admin: laAdmin,
  })

  if (error) {
    console.error('[admin_dat_mat_khau]', error.message)
    return { ok: false, lyDo: 'LOI', thongBao: error.message }
  }
  return data === true ? { ok: true } : { ok: false, lyDo: 'SAI_MK_ADMIN' }
}

export async function adminXoaMatKhau(
  adminUsername: string,
  adminPassword: string,
  username: string,
): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('admin_xoa_mat_khau', {
    p_admin: adminUsername,
    p_admin_pass: adminPassword,
    p_username: username,
  })
  if (error) { console.error('[admin_xoa_mat_khau]', error.message); return false }
  return data === true
}
