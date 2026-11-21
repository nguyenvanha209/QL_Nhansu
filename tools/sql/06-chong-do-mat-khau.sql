-- ============================================================
--  CHỐNG DÒ MẬT KHẨU QUA CÁC HÀM ĐỔI / ĐẶT MẬT KHẨU
--  CHỈ CHẠY SAU KHI: đã chạy 01, 04, 05. An toàn để chạy lại.
--  Chạy trong: Supabase → SQL Editor → New query → dán toàn bộ → Run.
--
--  Lỗ hổng: doi_mat_khau, admin_dat_mat_khau, admin_xoa_mat_khau trước đây mở cho cả
--  người CHƯA đăng nhập (anon) và KHÔNG đếm số lần sai - đi vòng qua cơ chế khoá
--  10 lần sai của dang_nhap, dò được mật khẩu (kể cả mật khẩu quản trị) không giới hạn.
--
--  Sau khi chạy:
--   - 3 hàm chỉ gọi được khi đã đăng nhập, và chỉ cho đúng chủ tài khoản
--     (tên đăng nhập truyền vào phải khớp phiên đăng nhập hiện tại);
--   - nhập sai mật khẩu ở các hàm này cũng bị đếm, 10 lần sai khoá 15 phút như đăng nhập;
--   - mật khẩu mới tối thiểu 8 ký tự (mật khẩu cũ đang dùng vẫn đăng nhập bình thường).
-- ============================================================

-- Ghi nhận một lần nhập sai; đủ 10 lần thì khoá 15 phút (cùng ngưỡng với dang_nhap)
create or replace function public.ghi_nhan_sai_mat_khau(p_username text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update mat_khau
     set so_lan_sai = so_lan_sai + 1,
         khoa_den   = case when so_lan_sai + 1 >= 10 then now() + interval '15 minutes' else khoa_den end
   where username = p_username;
end;
$$;
revoke all on function public.ghi_nhan_sai_mat_khau(text) from public, anon, authenticated;

-- Phiên đăng nhập hiện tại có đúng là tài khoản p_username không
create or replace function public.la_phien_cua(p_username text)
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = public.email_dang_nhap(p_username)
$$;

-- ------------------------------------------------------------
-- 1. TỰ ĐỔI MẬT KHẨU
-- ------------------------------------------------------------
create or replace function doi_mat_khau(p_username text, p_cu text, p_moi text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_rec mat_khau%rowtype;
begin
  if not public.la_phien_cua(p_username) then
    return false;
  end if;
  if length(coalesce(p_moi, '')) < 8 then
    raise exception 'Mật khẩu mới phải từ 8 ký tự trở lên';
  end if;
  select * into v_rec from mat_khau where username = p_username;
  if not found then
    return false;
  end if;
  if v_rec.khoa_den is not null and v_rec.khoa_den > now() then
    raise exception 'Tài khoản đang bị tạm khoá do nhập sai nhiều lần, thử lại sau 15 phút';
  end if;
  if crypt(p_cu, v_rec.pass_hash) <> v_rec.pass_hash then
    perform public.ghi_nhan_sai_mat_khau(p_username);
    return false;
  end if;
  update mat_khau
     set pass_hash  = crypt(p_moi, gen_salt('bf')),
         so_lan_sai = 0, khoa_den = null, updated_at = now()
   where username = p_username;
  return true;
end;
$$;

-- ------------------------------------------------------------
-- 2. QUẢN TRỊ ĐẶT MẬT KHẨU CHO TÀI KHOẢN KHÁC
-- ------------------------------------------------------------
create or replace function admin_dat_mat_khau(
  p_admin      text,
  p_admin_pass text,
  p_username   text,
  p_moi        text,
  p_la_admin   boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_rec mat_khau%rowtype;
begin
  if not public.la_phien_cua(p_admin) then
    return false;
  end if;
  if length(coalesce(p_moi, '')) < 8 then
    raise exception 'Mật khẩu phải từ 8 ký tự trở lên';
  end if;
  select * into v_rec from mat_khau where username = p_admin;
  if not found or not v_rec.la_admin then
    return false;
  end if;
  if v_rec.khoa_den is not null and v_rec.khoa_den > now() then
    raise exception 'Tài khoản quản trị đang bị tạm khoá do nhập sai nhiều lần, thử lại sau 15 phút';
  end if;
  if crypt(p_admin_pass, v_rec.pass_hash) <> v_rec.pass_hash then
    perform public.ghi_nhan_sai_mat_khau(p_admin);
    return false;
  end if;
  update mat_khau set so_lan_sai = 0 where username = p_admin;
  insert into mat_khau (username, pass_hash, la_admin)
       values (p_username, crypt(p_moi, gen_salt('bf')), p_la_admin)
  on conflict (username) do update
      set pass_hash  = excluded.pass_hash,
          la_admin   = excluded.la_admin,
          so_lan_sai = 0, khoa_den = null, updated_at = now();
  return true;
end;
$$;

-- ------------------------------------------------------------
-- 3. QUẢN TRỊ XOÁ MẬT KHẨU CỦA MỘT TÀI KHOẢN
-- ------------------------------------------------------------
create or replace function admin_xoa_mat_khau(
  p_admin text, p_admin_pass text, p_username text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_rec mat_khau%rowtype;
begin
  if not public.la_phien_cua(p_admin) then
    return false;
  end if;
  select * into v_rec from mat_khau where username = p_admin;
  if not found or not v_rec.la_admin then
    return false;
  end if;
  if v_rec.khoa_den is not null and v_rec.khoa_den > now() then
    raise exception 'Tài khoản quản trị đang bị tạm khoá do nhập sai nhiều lần, thử lại sau 15 phút';
  end if;
  if crypt(p_admin_pass, v_rec.pass_hash) <> v_rec.pass_hash then
    perform public.ghi_nhan_sai_mat_khau(p_admin);
    return false;
  end if;
  update mat_khau set so_lan_sai = 0 where username = p_admin;
  delete from mat_khau where username = p_username;
  return true;
end;
$$;

-- ------------------------------------------------------------
-- 4. Chỉ người đã đăng nhập mới được gọi (đăng nhập dang_nhap vẫn mở cho anon)
-- ------------------------------------------------------------
revoke all on function doi_mat_khau(text, text, text)                     from public, anon;
revoke all on function admin_dat_mat_khau(text, text, text, text, boolean) from public, anon;
revoke all on function admin_xoa_mat_khau(text, text, text)               from public, anon;
grant execute on function doi_mat_khau(text, text, text)                     to authenticated;
grant execute on function admin_dat_mat_khau(text, text, text, text, boolean) to authenticated;
grant execute on function admin_xoa_mat_khau(text, text, text)               to authenticated;

-- 5. Kiểm tra: anon không còn quyền gọi 3 hàm (kết quả mong đợi: false, false, false)
select has_function_privilege('anon', 'doi_mat_khau(text, text, text)', 'execute')                     as anon_doi,
       has_function_privilege('anon', 'admin_dat_mat_khau(text, text, text, text, boolean)', 'execute') as anon_dat,
       has_function_privilege('anon', 'admin_xoa_mat_khau(text, text, text)', 'execute')               as anon_xoa;
