-- Remove only the customer-interest feature. Backup both tables before applying.
-- Old deployed profile APIs still reading interests must be redeployed afterward.
-- Keep customer profiles, birthday/timestamps, account links, support and warehouses.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create function public.admin_update_customer_profile_v2(
  p_customer_id text, p_actor_account_id text, p_changes jsonb
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $function$
declare v_profile public."KHACH_HANG"%rowtype; v_account jsonb;
begin
  perform 1 from public."TAI_KHOAN" a
  join public."NHAN_VIEN" n on n.ma_nhan_vien=a.ma_nhan_vien
  where a.ma_tk=p_actor_account_id and a.trang_thai=1
    and n.loai_nhan_vien='ADMIN' and n.trang_thai=1
  for share of a,n;
  if not found then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then
    raise exception 'EMPTY_OR_INVALID_PATCH' using errcode='23514';
  end if;
  if exists (select 1 from jsonb_object_keys(p_changes) k(field)
    where field not in ('ten_kh','sdt','dia_chi_chi_tiet_md','tinh_thanh_md','xa_phuong_md','ngay_sinh')) then
    raise exception 'READ_ONLY_OR_UNKNOWN_FIELD' using errcode='23514';
  end if;
  if p_changes ? 'ten_kh' and coalesce(length(btrim(p_changes->>'ten_kh')),0)=0 then
    raise exception 'CUSTOMER_NAME_REQUIRED' using errcode='23514';
  end if;
  if p_changes ? 'ngay_sinh' and (p_changes->>'ngay_sinh')::date >
    (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'FUTURE_BIRTHDAY' using errcode='23514';
  end if;
  select * into v_profile from public."KHACH_HANG" where ma_kh=p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002'; end if;
  update public."KHACH_HANG" set
    ten_kh=case when p_changes ? 'ten_kh' then btrim(p_changes->>'ten_kh') else ten_kh end,
    sdt=case when p_changes ? 'sdt' then p_changes->>'sdt' else sdt end,
    dia_chi_chi_tiet_md=case when p_changes ? 'dia_chi_chi_tiet_md' then p_changes->>'dia_chi_chi_tiet_md' else dia_chi_chi_tiet_md end,
    tinh_thanh_md=case when p_changes ? 'tinh_thanh_md' then p_changes->>'tinh_thanh_md' else tinh_thanh_md end,
    xa_phuong_md=case when p_changes ? 'xa_phuong_md' then p_changes->>'xa_phuong_md' else xa_phuong_md end,
    ngay_sinh=case when p_changes ? 'ngay_sinh' then (p_changes->>'ngay_sinh')::date else ngay_sinh end,
    cap_nhat_luc=statement_timestamp()
  where ma_kh=p_customer_id returning * into v_profile;
  select jsonb_build_object('ma_tk',ma_tk,'ten_tai_khoan',ten_tai_khoan,'email',email,'trang_thai',trang_thai)
    into v_account from public."TAI_KHOAN" where ma_kh=p_customer_id;
  return jsonb_build_object('profile',to_jsonb(v_profile),'account',v_account);
end;
$function$;
revoke all on function public.admin_update_customer_profile_v2(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_update_customer_profile_v2(text,text,jsonb) to service_role;

drop function if exists public.admin_update_customer_crm_v1(text,text,jsonb,text[]) restrict;
drop table public."KHACH_HANG_SO_THICH" restrict;
drop table public."SO_THICH" restrict;
drop function if exists public.phub_crm_interest_stamp() restrict;
notify pgrst, 'reload schema';
commit;
