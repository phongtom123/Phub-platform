-- Upgrade only: existing customer birthday/archive columns are retained.
-- No customer is archived while applying this migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create function public.phub_customer_archive_guard()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $function$
begin
  if old.luu_tru_luc is not null and new.luu_tru_luc is not null then
    raise exception 'Restore the customer profile before editing it.' using errcode='23514';
  end if;
  return new;
end;
$function$;
revoke all on function public.phub_customer_archive_guard() from public, anon, authenticated;
grant execute on function public.phub_customer_archive_guard() to service_role;
create trigger phub_customer_archive_guard before update on public."KHACH_HANG"
for each row execute function public.phub_customer_archive_guard();

-- This also protects older backend versions and account creation against
-- reactivating an archived profile. Row locking serializes archive/status races;
-- PostgreSQL can abort a deadlock contender, leaving the invariant intact.
create function public.phub_archived_customer_account_guard()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $function$
declare v_archived timestamptz;
begin
  if new.ma_kh is not null and new.trang_thai <> 0 then
    select luu_tru_luc into v_archived from public."KHACH_HANG"
      where ma_kh=new.ma_kh for share;
    if v_archived is not null then
      raise exception 'Restore the customer profile before enabling its account.' using errcode='23514';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function public.phub_archived_customer_account_guard() from public, anon, authenticated;
grant execute on function public.phub_archived_customer_account_guard() to service_role;
create trigger phub_archived_customer_account_guard
before insert or update of trang_thai, ma_kh on public."TAI_KHOAN"
for each row execute function public.phub_archived_customer_account_guard();

create function public.admin_archive_customer_v1(
  p_customer_id text, p_actor_account_id text, p_archived boolean
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $function$
declare v_profile public."KHACH_HANG"%rowtype; v_account jsonb;
begin
  if p_archived is null then
    raise exception 'Archive state is required.' using errcode='23514';
  end if;
  perform 1 from public."TAI_KHOAN" a
    join public."NHAN_VIEN" n on n.ma_nhan_vien=a.ma_nhan_vien
    where a.ma_tk=p_actor_account_id and a.trang_thai=1
      and n.loai_nhan_vien='ADMIN' and n.trang_thai=1
    for share of a,n;
  if not found then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_profile from public."KHACH_HANG" where ma_kh=p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002'; end if;
  if (v_profile.luu_tru_luc is not null) is distinct from p_archived then
    update public."KHACH_HANG" set
      luu_tru_luc=case when p_archived then statement_timestamp() else null end,
      cap_nhat_luc=statement_timestamp()
      where ma_kh=p_customer_id returning * into v_profile;
    if p_archived then
      update public."TAI_KHOAN" set trang_thai=0, phien_ban_mat_khau=gen_random_uuid()
        where ma_kh=p_customer_id;
    end if;
  end if;
  select jsonb_build_object('ma_tk',ma_tk,'ten_tai_khoan',ten_tai_khoan,'email',email,'trang_thai',trang_thai)
    into v_account from public."TAI_KHOAN" where ma_kh=p_customer_id;
  return jsonb_build_object('profile',to_jsonb(v_profile),'account',v_account);
end;
$function$;
revoke all on function public.admin_archive_customer_v1(text,text,boolean) from public, anon, authenticated;
grant execute on function public.admin_archive_customer_v1(text,text,boolean) to service_role;
comment on column public."KHACH_HANG".luu_tru_luc is
  'Soft delete: archive RPC hides linked account and revokes old sessions; restore never enables the account automatically.';
notify pgrst, 'reload schema';
commit;
