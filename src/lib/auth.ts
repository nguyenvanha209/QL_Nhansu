import { supabase } from './supabase'

// Mật khẩu không còn nằm trong ql-users. Chúng được băm bcrypt và lưu ở bảng
// mat_khau trên Supabase — bảng này bật RLS và không có policy nào, nên không
// đọc trực tiếp được kể cả khi có khóa anon. Mọi thao tác đi qua các hàm
// security definer khai báo ở tools/sql/01-tao-bang-mat-khau.sql.

export type KetQuaDangNhap =
  | { ok: true }
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
  if (data?.ok) return { ok: true }
  if (data?.ly_do === 'KHOA') return { ok: false, lyDo: 'KHOA', khoaDen: data.khoa_den }
  return { ok: false, lyDo: 'SAI', conLai: data?.con_lai ?? 0 }
}

export async function doiMatKhau(username: string, cu: string, moi: string): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('doi_mat_khau', {
    p_username: username,
    p_cu: cu,
    p_moi: moi,
  })
  if (error) { console.error('[doi_mat_khau]', error.message); return false }
  return data === true
}

// Admin phải nhập lại mật khẩu của chính mình cho mỗi lần cấp/đặt lại mật khẩu.
export async function adminDatMatKhau(
  adminUsername: string,
  adminPassword: string,
  username: string,
  matKhauMoi: string,
  laAdmin = false,
): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('admin_dat_mat_khau', {
    p_admin: adminUsername,
    p_admin_pass: adminPassword,
    p_username: username,
    p_moi: matKhauMoi,
    p_la_admin: laAdmin,
  })
  if (error) { console.error('[admin_dat_mat_khau]', error.message); return false }
  return data === true
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
