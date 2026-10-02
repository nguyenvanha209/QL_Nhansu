
--  GIAI ĐOẠN A - BƯỚC 2: KHOÁ DỮ LIỆU - CHỈ NGƯỜI ĐÃ ĐĂNG NHẬP ĐƯỢC ĐỌC, GHI
--  CHỈ CHẠY SAU KHI: đã chạy 04-tai-khoan-supabase-auth.sql, bản phần mềm mới đã lên mạng
--  và đã đăng nhập thử thành công ở https://ql-nhansu.ngoquyen.edu.vn
--  Chạy trong: Supabase → SQL Editor → New query → dán toàn bộ → Run. An toàn để chạy lại.
--
--  Trước đây khoá kết nối công khai (nằm trong mã trang web) đọc và sửa được toàn bộ dữ liệu
--  nhân sự (CCCD, số điện thoại, lương...) mà không cần đăng nhập.
--
--  Quay lại như cũ (chỉ khi khẩn cấp): xem cuối file.

-- 1. Bảng dữ liệu chính
alter table public.app_state enable row level security;
revoke all on table public.app_state from anon, public;
grant select, insert, update, delete on table public.app_state to authenticated;

drop policy if exists "app_state: nguoi da dang nhap" on public.app_state;
create policy "app_state: nguoi da dang nhap"
  on public.app_state for all
  to authenticated
  using (true)
  with check (true);

-- 2. Kho minh chứng: chỉ người đã đăng nhập xem và tải lên (vẫn không cho sửa, xoá)
drop policy if exists "minh-chung: doc" on storage.objects;
create policy "minh-chung: doc"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'minh-chung');

drop policy if exists "minh-chung: tai len" on storage.objects;
create policy "minh-chung: tai len"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'minh-chung');

-- 3. Kiểm tra: các quy tắc đang có trên app_state
select policyname, roles, cmd from pg_policies where schemaname = 'public' and tablename = 'app_state';

-- ------------------------------------------------------------
-- QUAY LẠI NHƯ CŨ (chỉ khi khẩn cấp - dữ liệu lại mở cho mọi người):
--   grant select, insert, update, delete on table public.app_state to anon;
--   drop policy if exists "app_state: nguoi da dang nhap" on public.app_state;
--   alter table public.app_state disable row level security;
-- ------------------------------------------------------------
