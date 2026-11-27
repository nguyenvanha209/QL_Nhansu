-- ============================================================
--  ĐĂNG KÝ LAO ĐỘNG TIỀN LƯƠNG: chặn đọc / ghi chéo đơn vị như bảng truy lĩnh
--  CHỈ CHẠY SAU KHI: đã chạy 09, 11 và BẢN PHẦN MỀM MỚI (có mục "Đăng ký LĐTL") đã lên mạng.
--  Chạy trong: Supabase → SQL Editor → New query → dán toàn bộ → Run. An toàn để chạy lại.
--
--  Bản đăng ký lưu chia theo đơn vị (mảnh 'ql-dang-ky-ldtl::<mã đơn vị>'). Sau khi chạy: tài khoản đơn vị chỉ đọc, ghi
--  bản của đơn vị mình; tài khoản cấp phường được giao khối chỉ đọc, ghi đơn vị thuộc khối đó (như 11).
-- ============================================================

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
  v_khoi text[];
begin
  if v_ten not in ('ql-vien-chuc', 'ql-luong', 'ql-de-xuat', 'ql-truy-linh', 'ql-dang-ky-ldtl') then
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
    v_khoi := public.khoi_phu_trach_phien();
    if v_khoi is null or cardinality(v_khoi) = 0 then
      return true;                     -- cấp phường không giới hạn khối: toàn phường
    end if;
    if v_manh is null then
      return false;                    -- ô cũ chưa chia chứa dữ liệu mọi khối
    end if;
    return v_manh = '_goc' or public.khoi_cua_don_vi(v_manh) = any (v_khoi);
  end if;
  if v_manh is null then
    return false;                      -- ô cũ chưa chia chứa dữ liệu mọi đơn vị
  end if;
  return v_manh = '_goc' or (v_dv is not null and v_manh = v_dv);
end;
$$;
revoke all on function public.duoc_truy_cap_kho(text) from public, anon;
grant execute on function public.duoc_truy_cap_kho(text) to authenticated;

-- Kiểm tra: các mảnh đăng ký đã có
select key, updated_at from public.app_state where key like 'ql-dang-ky-ldtl%' order by key;
