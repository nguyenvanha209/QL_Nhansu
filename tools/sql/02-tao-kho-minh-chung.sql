-- Kho lưu minh chứng đính kèm phiếu đề xuất điều chỉnh lương – phụ cấp.
-- Chạy một lần trong Supabase: Dashboard → SQL Editor → dán toàn bộ → Run.
--
-- - Bucket riêng tư (không có link công khai); phần mềm mở file bằng link tạm thời 1 giờ.
-- - Giới hạn 3 MB mỗi file, chỉ nhận PDF, JPG, PNG (phần mềm cũng kiểm tra trước khi tải lên).
-- - Chỉ cho đọc và tải lên; KHÔNG cho sửa, xoá → minh chứng đã nộp không bị thay đổi.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('minh-chung', 'minh-chung', false, 3145728, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "minh-chung: doc" on storage.objects;
create policy "minh-chung: doc"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'minh-chung');

drop policy if exists "minh-chung: tai len" on storage.objects;
create policy "minh-chung: tai len"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'minh-chung');
