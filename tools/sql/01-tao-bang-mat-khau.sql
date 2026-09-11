-- ============================================================
--  BẢO VỆ MẬT KHẨU BẰNG BĂM BCRYPT + HÀM ĐĂNG NHẬP RPC
--  Chạy trong: Supabase → SQL Editor → New query → Run
--  An toàn để chạy lại nhiều lần (idempotent).
--
--  Sau khi chạy file này, chạy tiếp 02-nap-mat-khau.sql để
--  nạp mật khẩu hiện có vào bảng (dạng đã băm).
-- ============================================================

-- pgcrypto cung cấp crypt() và gen_salt() để băm bcrypt
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Bảng mật khẩu — KHÔNG ai đọc trực tiếp được, kể cả anon
-- ------------------------------------------------------------
create table if not exists mat_khau (
  username   text primary key,
  pass_hash  text        not null,
  la_admin   boolean     not null default false,
  so_lan_sai int         not null default 0,
  khoa_den   timestamptz,
  updated_at timestamptz not null default now()
);

-- Bật RLS và KHÔNG tạo policy nào => mọi truy cập trực tiếp bị chặn.
-- Chỉ các hàm security definer bên dưới mới đụng được vào bảng này.
alter table mat_khau enable row level security;
revoke all on table mat_khau from anon, authenticated;

-- ------------------------------------------------------------
-- Tham số khóa tài khoản khi dò mật khẩu
-- ------------------------------------------------------------
-- 10 lần sai liên tiếp  ->  khóa 15 phút
-- Đếm lại về 0 mỗi khi đăng nhập đúng.

-- ------------------------------------------------------------
-- 1. ĐĂNG NHẬP
--    Trả về: {"ok":true}
--            {"ok":false,"ly_do":"SAI","con_lai":7}
--            {"ok":false,"ly_do":"KHOA","khoa_den":"..."}
-- ------------------------------------------------------------
create or replace function dang_nhap(p_username text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rec   mat_khau%rowtype;
  v_dung  boolean;
begin
  select * into v_rec from mat_khau where username = p_username;

  -- Không tiết lộ tài khoản có tồn tại hay không
  if not found then
    perform pg_sleep(0.1);
    return json_build_object('ok', false, 'ly_do', 'SAI', 'con_lai', 10);
  end if;

  -- Đang trong thời gian bị khóa
  if v_rec.khoa_den is not null and v_rec.khoa_den > now() then
    return json_build_object('ok', false, 'ly_do', 'KHOA', 'khoa_den', v_rec.khoa_den);
  end if;

  v_dung := (crypt(p_password, v_rec.pass_hash) = v_rec.pass_hash);

  if v_dung then
    update mat_khau set so_lan_sai = 0, khoa_den = null where username = p_username;
    return json_build_object('ok', true);
  end if;

  -- Sai mật khẩu: tăng bộ đếm, khóa nếu chạm ngưỡng
  update mat_khau
     set so_lan_sai = so_lan_sai + 1,
         khoa_den   = case when so_lan_sai + 1 >= 10 then now() + interval '15 minutes' else null end
   where username = p_username
   returning * into v_rec;

  if v_rec.khoa_den is not null then
    return json_build_object('ok', false, 'ly_do', 'KHOA', 'khoa_den', v_rec.khoa_den);
  end if;

  return json_build_object('ok', false, 'ly_do', 'SAI', 'con_lai', 10 - v_rec.so_lan_sai);
end;
$$;

-- ------------------------------------------------------------
-- 2. TỰ ĐỔI MẬT KHẨU (phải biết mật khẩu cũ)
-- ------------------------------------------------------------
create or replace function doi_mat_khau(p_username text, p_cu text, p_moi text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  if length(coalesce(p_moi, '')) < 6 then
    raise exception 'Mật khẩu mới phải từ 6 ký tự trở lên';
  end if;

  select pass_hash into v_hash from mat_khau where username = p_username;
  if not found or crypt(p_cu, v_hash) <> v_hash then
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
-- 3. ADMIN ĐẶT MẬT KHẨU CHO TÀI KHOẢN KHÁC (tạo mới hoặc đặt lại)
--    Admin phải nhập đúng mật khẩu của chính mình.
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
  if length(coalesce(p_moi, '')) < 6 then
    raise exception 'Mật khẩu phải từ 6 ký tự trở lên';
  end if;

  -- Xác thực người gọi đúng là quản trị viên
  select * into v_rec from mat_khau where username = p_admin;
  if not found or not v_rec.la_admin
     or crypt(p_admin_pass, v_rec.pass_hash) <> v_rec.pass_hash then
    return false;
  end if;

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
-- 4. ADMIN XÓA MẬT KHẨU CỦA MỘT TÀI KHOẢN
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
  select * into v_rec from mat_khau where username = p_admin;
  if not found or not v_rec.la_admin
     or crypt(p_admin_pass, v_rec.pass_hash) <> v_rec.pass_hash then
    return false;
  end if;

  delete from mat_khau where username = p_username;
  return true;
end;
$$;

-- ------------------------------------------------------------
-- Cấp quyền GỌI hàm (không phải quyền đọc bảng)
-- ------------------------------------------------------------
grant execute on function dang_nhap(text, text)                              to anon, authenticated;
grant execute on function doi_mat_khau(text, text, text)                     to anon, authenticated;
grant execute on function admin_dat_mat_khau(text, text, text, text, boolean) to anon, authenticated;
grant execute on function admin_xoa_mat_khau(text, text, text)               to anon, authenticated;

-- ------------------------------------------------------------
-- Kiểm tra: phải trả về 0 dòng (không đọc trực tiếp được)
-- ------------------------------------------------------------
-- select * from mat_khau;
