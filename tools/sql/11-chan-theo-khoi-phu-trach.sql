-- ============================================================
--  PHÂN QUYỀN THEO KHỐI PHỤ TRÁCH (tài khoản cấp phường)
--  CHỈ CHẠY SAU KHI: đã chạy 08, 09 và BẢN PHẦN MỀM MỚI (có ô "Khối phụ trách" ở trang Tài khoản) đã lên mạng.
--  Chạy trong: Supabase → SQL Editor → New query → dán toàn bộ → Run. An toàn để chạy lại.
--
--  Tài khoản Cán bộ VHXH, Lãnh đạo Phòng VHXH có thể được giao một hoặc vài khối (Trường học / Cơ quan UBND
--  phường / Đơn vị sự nghiệp) - trường khoiPhuTrach trong danh sách tài khoản (ql-users). Sau khi chạy:
--   - Tài khoản được giao khối chỉ đọc, ghi hồ sơ, lương, phiếu đề xuất, bảng truy lĩnh của đơn vị thuộc khối đó
--     (mảnh '<kho>::<mã đơn vị>'); phần chung '_goc' vẫn đọc được.
--   - Không giao khối (bỏ trống) thì như cũ: toàn phường. Quản trị và tài khoản đơn vị không đổi.
--   - Chỉ quản trị viên đổi được khối phụ trách (thêm vào phần "quyền" mà trigger của 08 bảo vệ).
--  Khối của đơn vị suy từ loại đơn vị trong danh mục (ql-danh-muc): PHONG_CM → Cơ quan, DVSN → ĐVSN, còn lại → Trường học
--  (giống hàm khoiCuaLoai trong phần mềm).
-- ============================================================

-- 1. Khối phụ trách là một phần của "quyền" tài khoản: người không phải quản trị không tự sửa được
create or replace function public.phan_quyen_tai_khoan(p_value jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u -> 'id', 'username', u -> 'username', 'role', u -> 'role',
           'donViId', u -> 'donViId', 'active', u -> 'active', 'quyenRieng', u -> 'quyenRieng',
           'khoiPhuTrach', u -> 'khoiPhuTrach')
         order by u ->> 'id'), '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_value -> 'state' -> 'users', '[]'::jsonb)) u
$$;

-- 2. Khối phụ trách của phiên hiện tại (mảng rỗng = không giới hạn)
create or replace function public.khoi_phu_trach_phien()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array(select jsonb_array_elements_text(coalesce(u -> 'khoiPhuTrach', '[]'::jsonb))), '{}')
    from app_state a, jsonb_array_elements(a.value -> 'state' -> 'users') u
   where a.key = 'ql-users'
     and coalesce((u ->> 'active')::boolean, true)
     and public.email_dang_nhap(u ->> 'username') = coalesce(auth.jwt() ->> 'email', '')
   limit 1
$$;
revoke all on function public.khoi_phu_trach_phien() from public, anon;
grant execute on function public.khoi_phu_trach_phien() to authenticated;

-- 3. Khối của một đơn vị theo danh mục
create or replace function public.khoi_cua_don_vi(p_don_vi text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case d ->> 'loai' when 'PHONG_CM' then 'CO_QUAN' when 'DVSN' then 'DVSN' else 'TRUONG_HOC' end
    from app_state a, jsonb_array_elements(a.value -> 'state' -> 'donVis') d
   where a.key = 'ql-danh-muc' and d ->> 'id' = p_don_vi
   limit 1
$$;
revoke all on function public.khoi_cua_don_vi(text) from public, anon;
grant execute on function public.khoi_cua_don_vi(text) to authenticated;

-- 4. Quyền đọc / ghi ô dữ liệu: bổ sung kiểm tra khối cho tài khoản cấp phường được giao khối
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

-- Kiểm tra: tài khoản cấp phường và khối phụ trách
select u ->> 'username' as tai_khoan, u ->> 'fullName' as ho_ten, u ->> 'role' as vai_tro,
       coalesce(u -> 'khoiPhuTrach', '[]'::jsonb) as khoi_phu_trach
  from public.app_state a, jsonb_array_elements(a.value -> 'state' -> 'users') u
 where a.key = 'ql-users' and u ->> 'role' in ('CB_VH_XH', 'LANH_DAO');
