
--  GIAI ĐOẠN A - BƯỚC 1: TẠO TÀI KHOẢN ĐĂNG NHẬP SUPABASE AUTH
--  Chạy trong: Supabase → SQL Editor → New query → dán toàn bộ → Run
--  An toàn để chạy lại nhiều lần. CHƯA khoá dữ liệu - phần mềm đang chạy không bị ảnh hưởng.
--
--  Vì sao: trước đây máy chủ chỉ kiểm tra mật khẩu, còn "đã đăng nhập" là một bản ghi trong
--  trình duyệt - tự tạo được, không cần mật khẩu. Nay mỗi tài khoản có một tài khoản Supabase
--  Auth: đăng nhập đúng mới được máy chủ cấp phiên có chữ ký (JWT), làm căn cứ khoá dữ liệu ở bước 2.
--
--  Mật khẩu giữ nguyên: bảng mat_khau và Supabase Auth cùng dùng bcrypt nên chép thẳng mã băm,
--  không ai phải đặt lại mật khẩu. Đổi mật khẩu / quản trị đặt mật khẩu về sau (qua các hàm
--  doi_mat_khau, admin_dat_mat_khau sẵn có) được trigger tự đồng bộ sang Supabase Auth.
--
--  Sau khi chạy: Authentication → Sign In / Providers (hoặc Settings) → TẮT "Allow new users to sign up".

create extension if not exists pgcrypto;

-- Tên đăng nhập → email nội bộ dùng cho Supabase Auth (người dùng không cần biết email này).
-- Phần mềm tính đúng theo cùng quy tắc (src/lib/auth.ts - emailDangNhap).
create or replace function public.email_dang_nhap(p_username text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(p_username), '[^A-Za-z0-9._-]', '-', 'g')) || '@ql-nhansu.ngoquyen.edu.vn'
$$;

-- Tạo hoặc cập nhật tài khoản Supabase Auth cho một tên đăng nhập, dùng mã băm bcrypt có sẵn
create or replace function public.dong_bo_tai_khoan_auth(p_username text, p_hash text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := public.email_dang_nhap(p_username);
  v_id    uuid;
begin
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email, p_hash, now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'ql_username', p_username),
      '{}'::jsonb, now(), now(),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_id, v_id::text, 'email',
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = p_hash,
           banned_until = null,
           updated_at = now()
     where id = v_id;
  end if;
end;
$$;

-- Chỉ dùng nội bộ (trigger, lệnh nạp bên dưới) - không cho gọi từ trình duyệt
revoke all on function public.dong_bo_tai_khoan_auth(text, text) from public, anon, authenticated;

-- Đổi mật khẩu / tạo tài khoản → đồng bộ sang Auth; xoá mật khẩu → chặn đăng nhập
create or replace function public.trg_mat_khau_dong_bo_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if tg_op = 'DELETE' then
    update auth.users set banned_until = now() + interval '100 years'
     where email = public.email_dang_nhap(old.username);
    return old;
  end if;
  perform public.dong_bo_tai_khoan_auth(new.username, new.pass_hash);
  return new;
end;
$$;

drop trigger if exists mat_khau_dong_bo_auth on public.mat_khau;
create trigger mat_khau_dong_bo_auth
  after insert or update of pass_hash or delete on public.mat_khau
  for each row execute function public.trg_mat_khau_dong_bo_auth();

-- Nạp toàn bộ tài khoản hiện có
select public.dong_bo_tai_khoan_auth(username, pass_hash) from public.mat_khau;

-- Kiểm tra: số tài khoản đã có trong Supabase Auth (phải bằng số dòng của mat_khau)
select
  (select count(*) from public.mat_khau) as so_tai_khoan_mat_khau,
  (select count(*) from auth.users where email like '%@ql-nhansu.ngoquyen.edu.vn') as so_tai_khoan_auth;
