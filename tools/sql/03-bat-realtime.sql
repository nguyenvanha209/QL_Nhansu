-- Bật Realtime cho bảng dữ liệu app_state: khi Kế toán lưu hồ sơ, máy chủ báo ngay
-- cho các máy đang mở (Admin, lãnh đạo) để tự làm mới — không phải chờ.
-- Chạy một lần trong Supabase: Dashboard → SQL Editor → dán → Run.
-- (Chưa chạy thì phần mềm vẫn tự kiểm tra thay đổi 30 giây một lần.)

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table public.app_state;
  end if;
end $$;
