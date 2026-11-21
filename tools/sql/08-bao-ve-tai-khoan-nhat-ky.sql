-- ============================================================
--  BẢO MẬT GIAI ĐOẠN B (BƯỚC ĐỆM): MÁY CHỦ CHẶN TỰ NÂNG QUYỀN VÀ XOÁ NHẬT KÝ
--  CHỈ CHẠY SAU KHI: đã chạy 01, 04, 05, 06. An toàn để chạy lại.
--  Chạy trong: Supabase → SQL Editor → New query → dán toàn bộ → Run.
--
--  Trước đây mọi tài khoản đã đăng nhập ghi được toàn bộ dữ liệu, kể cả danh sách tài khoản
--  (vai trò, trường phụ trách) và nhật ký thao tác - nên một tài khoản trường có thể tự sửa
--  mình thành Quản trị hoặc xoá dấu vết. Sau khi chạy, máy chủ tự kiểm tra mỗi lần ghi:
--   - Danh sách tài khoản (ql-users): chỉ quản trị viên được thêm, xoá tài khoản hoặc đổi vai trò,
--     trường phụ trách, trạng thái, quyền riêng. Người khác vẫn sửa được họ tên của mình.
--   - Nhật ký thao tác (ql-nhat-ky): chỉ được THÊM; không ai ngoài quản trị viên được xoá hay sửa
--     bản ghi (trừ phần cũ nhất tự cắt khi vượt giới hạn 5.000 dòng).
--   - Không ai ngoài quản trị viên xoá được hai kho này.
--  Quản trị viên xác định theo bảng mật khẩu trên máy chủ (mat_khau.la_admin) - trình duyệt không sửa được.
--  Công cụ quản trị (SQL Editor, khoá service_role) không bị chặn.
--
--  Phần còn lại (giai đoạn B đầy đủ, chưa làm): chặn đọc/ghi hồ sơ, lương theo từng trường ngay tại máy chủ.
-- ============================================================

-- 1. Đồng bộ cờ quản trị: tài khoản có vai trò ADMIN đang hoạt động thì la_admin = true (chỉ bật, không tắt)
update public.mat_khau m
   set la_admin = true
  from public.app_state a, jsonb_array_elements(a.value -> 'state' -> 'users') u
 where a.key = 'ql-users'
   and u ->> 'role' = 'ADMIN'
   and coalesce((u ->> 'active')::boolean, true)
   and m.username = u ->> 'username'
   and not m.la_admin;

-- 2. Phiên hiện tại có phải quản trị viên không
create or replace function public.la_quan_tri()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from mat_khau
     where la_admin and public.email_dang_nhap(username) = coalesce(auth.jwt() ->> 'email', '')
  )
$$;
revoke all on function public.la_quan_tri() from public, anon;
grant execute on function public.la_quan_tri() to authenticated;

-- 3. Phần "quyền" của danh sách tài khoản (bỏ qua họ tên, ngày tạo) để so sánh trước / sau
create or replace function public.phan_quyen_tai_khoan(p_value jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u -> 'id', 'username', u -> 'username', 'role', u -> 'role',
           'donViId', u -> 'donViId', 'active', u -> 'active', 'quyenRieng', u -> 'quyenRieng')
         order by u ->> 'id'), '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_value -> 'state' -> 'users', '[]'::jsonb)) u
$$;

-- 4. Kiểm tra mỗi lần ghi bảng app_state
create or replace function public.bao_ve_app_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moc     text;
  v_mat     bigint;
  v_so_cu   bigint;
begin
  -- Công cụ quản trị (service_role, SQL Editor) và quản trị viên: không chặn
  if coalesce(auth.role(), '') <> 'authenticated' or public.la_quan_tri() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.key in ('ql-users', 'ql-nhat-ky') then
      raise exception 'Chỉ quản trị viên được xoá kho dữ liệu %', old.key;
    end if;
    return old;
  end if;

  if new.key = 'ql-users' then
    if tg_op = 'INSERT' then
      raise exception 'Chỉ quản trị viên được tạo danh sách tài khoản';
    end if;
    if public.phan_quyen_tai_khoan(old.value) is distinct from public.phan_quyen_tai_khoan(new.value) then
      raise exception 'Chỉ quản trị viên được thêm, xoá tài khoản hoặc đổi vai trò, trường phụ trách, trạng thái';
    end if;

  elsif new.key = 'ql-nhat-ky' and tg_op = 'UPDATE' then
    -- Mọi bản ghi cũ từ mốc thời gian sớm nhất còn giữ trở về sau phải còn nguyên (không xoá, không sửa)
    select min(n ->> 'thoiGian') into v_moc
      from jsonb_array_elements(coalesce(new.value -> 'state' -> 'nhatKys', '[]'::jsonb)) n;
    select count(*) into v_so_cu
      from jsonb_array_elements(coalesce(old.value -> 'state' -> 'nhatKys', '[]'::jsonb)) o;
    if v_moc is null then
      if v_so_cu > 0 then
        raise exception 'Không được xoá nhật ký thao tác';
      end if;
    else
      select count(*) into v_mat from (
        select o from jsonb_array_elements(coalesce(old.value -> 'state' -> 'nhatKys', '[]'::jsonb)) o
         where o ->> 'thoiGian' >= v_moc
        except
        select n from jsonb_array_elements(coalesce(new.value -> 'state' -> 'nhatKys', '[]'::jsonb)) n
      ) x;
      if v_mat > 0 then
        raise exception 'Không được xoá hoặc sửa nhật ký thao tác (% bản ghi)', v_mat;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bao_ve_app_state on public.app_state;
create trigger bao_ve_app_state
  before insert or update or delete on public.app_state
  for each row execute function public.bao_ve_app_state();

-- 5. Kiểm tra: các tài khoản quản trị (cột la_admin phải là true với tài khoản quản trị thật)
select u ->> 'username' as tai_khoan, u ->> 'fullName' as ho_ten, u ->> 'role' as vai_tro, m.la_admin
  from public.app_state a
  cross join jsonb_array_elements(a.value -> 'state' -> 'users') u
  left join public.mat_khau m on m.username = u ->> 'username'
 where a.key = 'ql-users' and (u ->> 'role' = 'ADMIN' or m.la_admin);

-- ------------------------------------------------------------
-- GỠ BỎ (chỉ khi khẩn cấp):  drop trigger if exists bao_ve_app_state on public.app_state;
-- ------------------------------------------------------------
