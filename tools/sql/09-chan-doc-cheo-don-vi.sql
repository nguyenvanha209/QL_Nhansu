-- ============================================================
--  BẢO MẬT GIAI ĐOẠN B (ĐẦY ĐỦ): CHẶN ĐỌC, GHI CHÉO GIỮA CÁC ĐƠN VỊ NGAY TẠI MÁY CHỦ
--  CHỈ CHẠY SAU KHI:
--   1. Đã chạy 01, 04, 05, 06, 08 (cần hàm la_quan_tri và trigger bảo vệ danh sách tài khoản của 08).
--   2. BẢN PHẦN MỀM MỚI (có phân hệ công chức) ĐÃ LÊN MẠNG và mọi máy đã tải lại trang (Ctrl+F5).
--      Bản cũ chưa biết phiếu đề xuất được chia theo đơn vị.
--  Chạy trong: Supabase → SQL Editor → New query → dán toàn bộ → Run. An toàn để chạy lại.
--
--  Trước đây: mọi tài khoản đã đăng nhập đọc được hồ sơ, lương, phiếu đề xuất của TẤT CẢ đơn vị qua API
--  (giao diện chỉ ẩn đi). Sau khi chạy:
--   - Tài khoản đơn vị (Thủ trưởng đơn vị, Cán bộ đơn vị - vai trò HIEU_TRUONG, CB_TRUONG) chỉ đọc, ghi được
--     hồ sơ (ql-vien-chuc), lương - phụ cấp (ql-luong), phiếu đề xuất (ql-de-xuat), bảng truy lĩnh (ql-truy-linh)
--     của ĐƠN VỊ MÌNH.
--   - Phòng VHXH, lãnh đạo UBND, quản trị: đọc, ghi toàn bộ như cũ.
--   - Tài khoản không có trong danh sách tài khoản: không đọc được ba kho trên.
--  Vai trò, đơn vị của tài khoản lấy từ danh sách tài khoản trên máy chủ (ql-users) - đã được trigger của 08
--  chặn tự sửa, nên tài khoản đơn vị không tự mở rộng phạm vi được.
--
--  Các kho chưa chia theo đơn vị (vẫn mở cho mọi tài khoản đã đăng nhập): danh mục, tài khoản (không có mật khẩu),
--  chuyển công tác, thông báo kết quả, nhật ký thao tác.
-- ============================================================

-- 1. Vai trò và đơn vị của phiên hiện tại (theo danh sách tài khoản trên máy chủ)
create or replace function public.vai_tro_phien(out vai_tro text, out don_vi_id text)
language sql
stable
security definer
set search_path = public
as $$
  select u ->> 'role', u ->> 'donViId'
    from app_state a, jsonb_array_elements(a.value -> 'state' -> 'users') u
   where a.key = 'ql-users'
     and coalesce((u ->> 'active')::boolean, true)
     and public.email_dang_nhap(u ->> 'username') = coalesce(auth.jwt() ->> 'email', '')
   limit 1
$$;
revoke all on function public.vai_tro_phien() from public, anon;
grant execute on function public.vai_tro_phien() to authenticated;

-- 2. Phiên hiện tại có được đọc / ghi ô dữ liệu này không
--    Kho chia theo đơn vị có tên dạng '<kho>::<mã đơn vị>'; '<kho>::_goc' là phần chung (không chứa hồ sơ của đơn vị nào).
create or replace function public.duoc_truy_cap_kho(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_vi   int := position('::' in p_key);
  v_ten  text := case when v_vi = 0 then p_key else left(p_key, v_vi - 1) end;
  v_manh text := case when v_vi = 0 then null else substr(p_key, v_vi + 2) end;
  v_role text;
  v_dv   text;
begin
  if v_ten not in ('ql-vien-chuc', 'ql-luong', 'ql-de-xuat', 'ql-truy-linh') then
    return true;
  end if;
  if public.la_quan_tri() then
    return true;
  end if;
  select vai_tro, don_vi_id into v_role, v_dv from public.vai_tro_phien();
  if v_role is null then
    return false;
  end if;
  if v_role not in ('HIEU_TRUONG', 'CB_TRUONG') then
    return true;                       -- Phòng VHXH, lãnh đạo, quản trị: toàn phường
  end if;
  if v_manh is null then
    return false;                      -- ô cũ chưa chia chứa dữ liệu mọi đơn vị
  end if;
  return v_manh = '_goc' or (v_dv is not null and v_manh = v_dv);
end;
$$;
revoke all on function public.duoc_truy_cap_kho(text) from public, anon;
grant execute on function public.duoc_truy_cap_kho(text) to authenticated;

-- 3. Chia phiếu đề xuất (ql-de-xuat) thành từng mảnh theo đơn vị - chỉ khi còn ô cũ và chưa có mảnh nào
do $$
declare
  v jsonb;
begin
  select value into v from public.app_state where key = 'ql-de-xuat';
  if v is null then
    raise notice 'ql-de-xuat: không còn ô cũ (đã chia hoặc chưa có dữ liệu) - bỏ qua';
    return;
  end if;
  if exists (select 1 from public.app_state where key like 'ql-de-xuat::%') then
    raise notice 'ql-de-xuat: đã có mảnh - bỏ qua, phần mềm tự gộp ô cũ ở lần ghi tới';
    return;
  end if;

  -- Bản sao lưu ngay trước khi chia (nếu đã chạy 07)
  if to_regprocedure('public.chup_sao_luu(integer)') is not null then
    perform public.chup_sao_luu(30);
  end if;

  insert into public.app_state (key, value, updated_at)
  select 'ql-de-xuat::' || m.manh,
         jsonb_build_object('state', jsonb_build_object('deXuats', m.ds), 'version', v -> 'version'),
         now()
    from (
      select coalesce(nullif(d ->> 'donViId', ''), '_goc') as manh, jsonb_agg(d) as ds
        from jsonb_array_elements(coalesce(v -> 'state' -> 'deXuats', '[]'::jsonb)) d
       group by 1
    ) m
   where m.manh <> '_goc';

  -- Mảnh chung: các trường không phải mảng + phiếu không có đơn vị (nếu có)
  insert into public.app_state (key, value, updated_at)
  values (
    'ql-de-xuat::_goc',
    jsonb_set(v, '{state,deXuats}', coalesce((
      select jsonb_agg(d) from jsonb_array_elements(coalesce(v -> 'state' -> 'deXuats', '[]'::jsonb)) d
       where coalesce(nullif(d ->> 'donViId', ''), '_goc') = '_goc'), '[]'::jsonb)),
    now()
  );

  delete from public.app_state where key = 'ql-de-xuat';
  raise notice 'ql-de-xuat: đã chia theo đơn vị';
end;
$$;

-- 4. Thay quy tắc "mọi người đã đăng nhập" bằng quy tắc theo đơn vị.
--    Gỡ cả quy tắc cũ "allow_all" (từ thời đầu dự án, cho mọi vai trò toàn quyền): các quy tắc được CỘNG
--    với nhau, còn nó thì quy tắc theo đơn vị không có tác dụng. Khoá công khai (anon) vẫn bị chặn ở quyền bảng (05).
drop policy if exists "allow_all" on public.app_state;
drop policy if exists "app_state: nguoi da dang nhap" on public.app_state;
drop policy if exists "app_state: doc theo don vi" on public.app_state;
drop policy if exists "app_state: them theo don vi" on public.app_state;
drop policy if exists "app_state: sua theo don vi" on public.app_state;
drop policy if exists "app_state: xoa theo don vi" on public.app_state;

create policy "app_state: doc theo don vi" on public.app_state
  for select to authenticated using (public.duoc_truy_cap_kho(key));
create policy "app_state: them theo don vi" on public.app_state
  for insert to authenticated with check (public.duoc_truy_cap_kho(key));
create policy "app_state: sua theo don vi" on public.app_state
  for update to authenticated using (public.duoc_truy_cap_kho(key)) with check (public.duoc_truy_cap_kho(key));
create policy "app_state: xoa theo don vi" on public.app_state
  for delete to authenticated using (public.duoc_truy_cap_kho(key));

-- 5. Kiểm tra
-- 5a. Các quy tắc đang có (phải đúng 4 quy tắc "... theo don vi", không còn allow_all)
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'app_state' order by policyname;
-- 5b. Các mảnh phiếu đề xuất theo đơn vị và số phiếu mỗi mảnh
select key, jsonb_array_length(value -> 'state' -> 'deXuats') as so_phieu
  from public.app_state where key like 'ql-de-xuat%' order by key;
-- 5c. Tài khoản đơn vị chưa gán đơn vị (sẽ chỉ thấy phần chung, không thấy hồ sơ nào) - nên rỗng
select u ->> 'username' as tai_khoan, u ->> 'fullName' as ho_ten, u ->> 'role' as vai_tro
  from public.app_state a, jsonb_array_elements(a.value -> 'state' -> 'users') u
 where a.key = 'ql-users' and u ->> 'role' in ('HIEU_TRUONG', 'CB_TRUONG')
   and coalesce(u ->> 'donViId', '') = '';

-- ------------------------------------------------------------
-- QUAY LẠI NHƯ TRƯỚC (chỉ khi khẩn cấp - mọi tài khoản lại đọc được dữ liệu mọi đơn vị):
--   drop policy if exists "app_state: doc theo don vi" on public.app_state;
--   drop policy if exists "app_state: them theo don vi" on public.app_state;
--   drop policy if exists "app_state: sua theo don vi" on public.app_state;
--   drop policy if exists "app_state: xoa theo don vi" on public.app_state;
--   create policy "app_state: nguoi da dang nhap" on public.app_state for all to authenticated using (true) with check (true);
-- (Phiếu đề xuất đã chia mảnh vẫn dùng bình thường, không cần gộp lại.)
-- ------------------------------------------------------------
