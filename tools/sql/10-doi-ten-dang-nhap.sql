-- ============================================================
--  ĐỔI TÊN ĐĂNG NHẬP MỘT TÀI KHOẢN (mặc định: admin → admin_nguyenha)
--  Chạy trong: Supabase → SQL Editor → New query → dán toàn bộ → Run.
--
--  Tên đăng nhập nằm ở 3 nơi, phải đổi cùng lúc trong một giao dịch:
--   1. public.mat_khau.username         (đăng nhập bước 1 - RPC dang_nhap)
--   2. auth.users.email + identities    (đăng nhập bước 2 - Supabase Auth, email = <tên>@ql-nhansu.ngoquyen.edu.vn)
--   3. app_state 'ql-users'             (danh sách tài khoản; RLS 08, 09 đối chiếu vai trò theo tên này)
--  Mật khẩu giữ nguyên. Các phiên đang đăng nhập bằng tên cũ phải đăng nhập lại.
--  Chạy lại khi đã đổi rồi: không làm gì (báo "không tìm thấy tên cũ").
-- ============================================================
do $$
declare
  v_cu   text := 'admin';
  v_moi  text := 'admin_nguyenha';
  v_email_cu  text := public.email_dang_nhap(v_cu);
  v_email_moi text := public.email_dang_nhap(v_moi);
  v_id   uuid;
  v_so   int;
begin
  if not exists (select 1 from public.mat_khau where username = v_cu) then
    raise notice 'Không tìm thấy tên cũ "%" trong mat_khau - bỏ qua', v_cu;
    return;
  end if;
  if exists (select 1 from public.mat_khau where username = v_moi)
     or exists (select 1 from auth.users where email = v_email_moi) then
    raise exception 'Tên mới "%" đã có tài khoản - dừng', v_moi;
  end if;

  -- 1. Bảng mật khẩu (trigger đồng bộ Auth chỉ chạy khi đổi pass_hash nên không bị gọi ở đây)
  update public.mat_khau set username = v_moi where username = v_cu;

  -- 2. Supabase Auth
  select id into v_id from auth.users where email = v_email_cu;
  if v_id is null then
    raise exception 'Không thấy tài khoản Auth % - dừng', v_email_cu;
  end if;
  update auth.users
     set email = v_email_moi,
         raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('ql_username', v_moi),
         updated_at = now()
   where id = v_id;
  update auth.identities
     set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email_moi),
         updated_at = now()
   where user_id = v_id and provider = 'email';

  -- 3. Danh sách tài khoản trong app_state
  update public.app_state a
     set value = jsonb_set(
           a.value, '{state,users}',
           (select jsonb_agg(case when u ->> 'username' = v_cu then u || jsonb_build_object('username', v_moi) else u end
                             order by o)
              from jsonb_array_elements(a.value -> 'state' -> 'users') with ordinality as t(u, o))),
         updated_at = now()
   where a.key = 'ql-users';
  get diagnostics v_so = row_count;
  if v_so <> 1 then
    raise exception 'Không cập nhật được ql-users (% dòng) - dừng', v_so;
  end if;

  raise notice 'Đã đổi "%" → "%"', v_cu, v_moi;
end $$;

-- Kiểm tra
select username, la_admin from public.mat_khau where username in ('admin', 'admin_nguyenha');
select email, raw_app_meta_data ->> 'ql_username' as ql_username from auth.users where email like 'admin%@ql-nhansu.ngoquyen.edu.vn';
select u ->> 'username' as username, u ->> 'fullName' as ho_ten, u ->> 'role' as vai_tro
  from public.app_state a, jsonb_array_elements(a.value -> 'state' -> 'users') u
 where a.key = 'ql-users' and u ->> 'role' = 'ADMIN';
