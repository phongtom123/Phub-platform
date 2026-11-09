-- Add account soft deletion without deleting accounts, owners or business history.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public."TAI_KHOAN"
  add column luu_tru_luc timestamptz,
  add column luu_tru_boi varchar references public."TAI_KHOAN"(ma_tk) on delete restrict,
  add constraint phub_account_archive_state check (
    (luu_tru_luc is null and luu_tru_boi is null)
    or (luu_tru_luc is not null and luu_tru_boi is not null
        and luu_tru_boi <> ma_tk and trang_thai = 0)
  );
create index phub_account_archive_actor on public."TAI_KHOAN"(luu_tru_boi)
  where luu_tru_boi is not null;

create function public.phub_account_soft_delete_guard()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $function$
begin
  if tg_op = 'UPDATE' then
    if old.luu_tru_luc is not null then
      -- Archived identities cannot be edited even by an older API version.
      -- Session revision rotation is still permitted when a customer is archived.
      if row(new.ten_tai_khoan,new.email,new.ma_kh,new.ma_nhan_vien,new.mat_khau,new.ma_media_anh_dai_dien)
        is distinct from row(old.ten_tai_khoan,old.email,old.ma_kh,old.ma_nhan_vien,old.mat_khau,old.ma_media_anh_dai_dien)
        or new.trang_thai <> 0 then
        raise exception 'Restore the account before editing or enabling it.' using errcode='23514';
      end if;
      if new.luu_tru_luc is null then
        new.phien_ban_mat_khau := old.phien_ban_mat_khau;
      end if;
    elsif new.luu_tru_luc is not null then
      new.trang_thai := 0;
      new.phien_ban_mat_khau := gen_random_uuid();
    end if;
  elsif new.luu_tru_luc is not null then
    raise exception 'Create an account before archiving it.' using errcode='23514';
  end if;
  return new;
end;
$function$;
revoke all on function public.phub_account_soft_delete_guard() from public, anon, authenticated;
grant execute on function public.phub_account_soft_delete_guard() to service_role;
create trigger phub_account_soft_delete_guard before insert or update on public."TAI_KHOAN"
for each row execute function public.phub_account_soft_delete_guard();

create function public.admin_archive_account_v1(
  p_account_id text, p_actor_account_id text, p_archived boolean
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $function$
declare v_account public."TAI_KHOAN"%rowtype;
begin
  if p_archived is null then
    raise exception 'Archive state is required.' using errcode='23514';
  end if;
  -- Lock actor and target in a stable order: concurrent admins cannot delete
  -- each other after both pass an obsolete authorization check.
  perform 1 from public."TAI_KHOAN"
    where ma_tk in (p_actor_account_id,p_account_id) order by ma_tk for update;
  perform 1 from public."TAI_KHOAN" a
    join public."NHAN_VIEN" n on n.ma_nhan_vien=a.ma_nhan_vien
    where a.ma_tk=p_actor_account_id and a.trang_thai=1 and a.luu_tru_luc is null
      and n.loai_nhan_vien='ADMIN' and n.trang_thai=1 for share of n;
  if not found then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_account_id = p_actor_account_id then
    raise exception 'Cannot archive the current account.' using errcode='23514';
  end if;
  select * into v_account from public."TAI_KHOAN" where ma_tk=p_account_id;
  if not found then raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002'; end if;
  if (v_account.luu_tru_luc is not null) is distinct from p_archived then
    update public."TAI_KHOAN" set
      luu_tru_luc=case when p_archived then statement_timestamp() else null end,
      luu_tru_boi=case when p_archived then p_actor_account_id else null end,
      trang_thai=0
      where ma_tk=p_account_id returning * into v_account;
  end if;
  -- Never expose a password or session revision through this RPC.
  return jsonb_build_object('ma_tk',v_account.ma_tk,'luu_tru_luc',v_account.luu_tru_luc,
    'luu_tru_boi',v_account.luu_tru_boi);
end;
$function$;
revoke all on function public.admin_archive_account_v1(text,text,boolean) from public, anon, authenticated;
grant execute on function public.admin_archive_account_v1(text,text,boolean) to service_role;
comment on column public."TAI_KHOAN".luu_tru_luc is
  'Soft deletion; account and business history retained. Restore leaves status hidden and never revives old sessions.';
notify pgrst, 'reload schema';
commit;
