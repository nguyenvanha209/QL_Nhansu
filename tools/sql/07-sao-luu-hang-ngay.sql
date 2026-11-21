-- ============================================================
--  SAO LƯU TỰ ĐỘNG HẰNG NGÀY (giữ 30 ngày gần nhất)
--  Chạy trong: Supabase → SQL Editor → New query → dán toàn bộ → Run. An toàn để chạy lại.
--
--  Mỗi ngày lúc 23:00 (giờ Việt Nam) chụp TOÀN BỘ bảng app_state (mọi kho dữ liệu của phần mềm)
--  vào bảng sao_luu. Bản cũ hơn 30 ngày tự xoá. Chỉ quản trị cơ sở dữ liệu (SQL Editor, khoá
--  service_role) đọc được bảng sao lưu - người dùng phần mềm không đọc, không sửa được.
--
--  Lưu ý: bản sao lưu nằm cùng máy chủ Supabase - chống được ghi nhầm, xoá nhầm, lỗi phần mềm;
--  KHÔNG chống được sự cố của chính Supabase. Mỗi tháng vẫn nên tải một bản về Drive:
--  node tools/db.mjs backup
-- ============================================================

create extension if not exists pg_cron;

create table if not exists public.sao_luu (
  id        bigserial primary key,
  chup_luc  timestamptz not null default now(),
  so_kho    int not null,
  du_lieu   jsonb not null   -- { "<key>": { "value": ..., "updated_at": "..." }, ... }
);
alter table public.sao_luu enable row level security;   -- không có policy: phần mềm không truy cập được
revoke all on table public.sao_luu from public, anon, authenticated;
revoke all on sequence public.sao_luu_id_seq from public, anon, authenticated;

create or replace function public.chup_sao_luu(p_giu_ngay int default 30)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  insert into sao_luu (so_kho, du_lieu)
  select count(*), coalesce(jsonb_object_agg(key, jsonb_build_object('value', value, 'updated_at', updated_at)), '{}'::jsonb)
    from app_state
  returning id into v_id;
  delete from sao_luu where chup_luc < now() - make_interval(days => p_giu_ngay);
  return v_id;
end;
$$;
revoke all on function public.chup_sao_luu(int) from public, anon, authenticated;

-- Lịch chạy: 16:00 UTC = 23:00 giờ Việt Nam
select cron.unschedule(jobid) from cron.job where jobname = 'sao-luu-hang-ngay';
select cron.schedule('sao-luu-hang-ngay', '0 16 * * *', $$select public.chup_sao_luu(30)$$);

-- Chụp ngay một bản đầu tiên và xem danh sách (dung lượng thực sau nén)
select public.chup_sao_luu(30) as ban_vua_chup;
select id, chup_luc at time zone 'Asia/Ho_Chi_Minh' as luc, so_kho,
       pg_size_pretty(pg_column_size(du_lieu)::bigint) as dung_luong
  from public.sao_luu order by id desc;

-- ------------------------------------------------------------
--  KHÔI PHỤC (chỉ làm khi thật cần, nên hỏi người phụ trách kỹ thuật trước)
--  1. Xem danh sách bản sao lưu (câu select ngay trên), chọn id cần khôi phục.
--  2. Chụp thêm một bản hiện trạng trước khi khôi phục:   select public.chup_sao_luu(30);
--  3. Khôi phục MỘT kho (VD 'ql-vien-chuc') từ bản id = 12.
--     Kho lớn được chia mảnh (tên dạng 'ql-vien-chuc::<mã mảnh>'): phải khôi phục ĐỦ các mảnh, nên thay
--     điều kiện a.key = 'ql-vien-chuc' bằng  (a.key = 'ql-vien-chuc' or a.key like 'ql-vien-chuc::%').
--       update app_state a set value = s.du_lieu -> a.key -> 'value', updated_at = now()
--         from sao_luu s where s.id = 12 and a.key = 'ql-vien-chuc' and s.du_lieu ? a.key;
--     Khôi phục TẤT CẢ các kho từ bản id = 12:
--       insert into app_state (key, value, updated_at)
--       select k, v -> 'value', now() from sao_luu s, jsonb_each(s.du_lieu) as e(k, v) where s.id = 12
--       on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
--  4. Mọi máy đang mở phần mềm tự nhận dữ liệu khôi phục (hoặc tải lại trang).
--  Xem lịch chạy:  select * from cron.job_run_details order by start_time desc limit 10;
-- ------------------------------------------------------------
