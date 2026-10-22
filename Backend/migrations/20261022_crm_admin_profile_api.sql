-- DOT 1B: chay SAU 20261022_crm_customer_profile_interests.sql.
-- Chi them RPC, khong tao lai/doi ten bang va khong chinh sua du lieu cu.
-- Can backup + thu tren DB test. Khong tu dong ap dung production.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public."SO_THICH"') is null
    or to_regclass('public."KHACH_HANG_SO_THICH"') is null
    or (select count(*) from information_schema.columns where table_schema = 'public'
        and table_name = 'KHACH_HANG' and column_name in ('ngay_sinh', 'ngay_tao', 'cap_nhat_luc', 'luu_tru_luc')) <> 4 then
    raise exception 'Can ap dung CRM dot 1 voi bang SO_THICH/KHACH_HANG_SO_THICH truoc.';
  end if;
end;
$preflight$;

create or replace function public.admin_update_customer_crm_v1(
  p_customer_id text, p_actor_account_id text, p_changes jsonb,
  p_interest_ids text[] default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  v_profile public."KHACH_HANG"%rowtype;
  v_account jsonb;
  v_selected jsonb;
  v_catalog jsonb;
begin
  -- Recheck quyen tai thoi diem ghi; khoa tranh role/status doi giua giao dich.
  perform 1 from public."TAI_KHOAN" a
  join public."NHAN_VIEN" n on n.ma_nhan_vien = a.ma_nhan_vien
  where a.ma_tk = p_actor_account_id and a.trang_thai = 1
    and n.loai_nhan_vien = 'ADMIN' and n.trang_thai = 1
  for share of a, n;
  if not found then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'INVALID_PATCH' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_changes) as k(field)
    where field not in ('ten_kh', 'sdt', 'dia_chi_chi_tiet_md', 'tinh_thanh_md', 'xa_phuong_md', 'ngay_sinh')
  ) then
    raise exception 'READ_ONLY_OR_UNKNOWN_FIELD' using errcode = '23514';
  end if;
  if p_changes ? 'ten_kh' and coalesce(length(btrim(p_changes->>'ten_kh')), 0) = 0 then
    raise exception 'CUSTOMER_NAME_REQUIRED' using errcode = '23514';
  end if;

  select * into v_profile from public."KHACH_HANG"
  where ma_kh = p_customer_id for update;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_interest_ids is not null then
    if cardinality(p_interest_ids) > 50
       or exists (select 1 from unnest(p_interest_ids) as x(id) where id is null or length(btrim(id)) = 0)
       or cardinality(p_interest_ids) <> (select count(distinct id) from unnest(p_interest_ids) as x(id)) then
      raise exception 'INVALID_INTERESTS' using errcode = '23514';
    end if;
    perform 1 from public."SO_THICH" where ma_so_thich = any(p_interest_ids) for share;
    if cardinality(p_interest_ids) <> (
      select count(*) from public."SO_THICH" s
      where s.ma_so_thich = any(p_interest_ids) and (s.trang_thai = 1 or exists (
        select 1 from public."KHACH_HANG_SO_THICH" k
        where k.ma_kh = p_customer_id and k.ma_so_thich = s.ma_so_thich
      ))
    ) then
      raise exception 'UNKNOWN_OR_INACTIVE_INTEREST' using errcode = '23514';
    end if;
  end if;

  update public."KHACH_HANG" set
    ten_kh = case when p_changes ? 'ten_kh' then btrim(p_changes->>'ten_kh') else ten_kh end,
    sdt = case when p_changes ? 'sdt' then p_changes->>'sdt' else sdt end,
    dia_chi_chi_tiet_md = case when p_changes ? 'dia_chi_chi_tiet_md' then p_changes->>'dia_chi_chi_tiet_md' else dia_chi_chi_tiet_md end,
    tinh_thanh_md = case when p_changes ? 'tinh_thanh_md' then p_changes->>'tinh_thanh_md' else tinh_thanh_md end,
    xa_phuong_md = case when p_changes ? 'xa_phuong_md' then p_changes->>'xa_phuong_md' else xa_phuong_md end,
    ngay_sinh = case when p_changes ? 'ngay_sinh' then (p_changes->>'ngay_sinh')::date else ngay_sinh end
  where ma_kh = p_customer_id returning * into v_profile;

  if p_interest_ids is not null then
    delete from public."KHACH_HANG_SO_THICH"
    where ma_kh = p_customer_id and not (ma_so_thich = any(p_interest_ids));
    insert into public."KHACH_HANG_SO_THICH" (ma_kh, ma_so_thich)
    select p_customer_id, id from unnest(p_interest_ids) as x(id)
    on conflict (ma_kh, ma_so_thich) do nothing;
  end if;

  select jsonb_build_object('ma_tk', ma_tk, 'ten_tai_khoan', ten_tai_khoan,
    'email', email, 'trang_thai', trang_thai) into v_account
  from public."TAI_KHOAN" where ma_kh = p_customer_id;
  select coalesce(jsonb_agg(ma_so_thich order by ma_so_thich), '[]'::jsonb) into v_selected
  from public."KHACH_HANG_SO_THICH" where ma_kh = p_customer_id;
  select coalesce(jsonb_agg(jsonb_build_object('ma_so_thich', ma_so_thich,
    'ten_so_thich', ten_so_thich, 'trang_thai', trang_thai) order by ten_so_thich), '[]'::jsonb)
  into v_catalog from public."SO_THICH";

  return jsonb_build_object('profile', to_jsonb(v_profile), 'account', v_account,
    'so_thich', v_selected, 'danh_muc_so_thich', v_catalog);
end;
$function$;

revoke all on function public.admin_update_customer_crm_v1(text, text, jsonb, text[])
  from public, anon, authenticated;
grant execute on function public.admin_update_customer_crm_v1(text, text, jsonb, text[])
  to service_role;
notify pgrst, 'reload schema';
commit;
