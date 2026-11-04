-- Shared staff login across independent admin/warehouse domains.
-- Only hashes of short-lived one-use codes are persisted; no raw codes or JWTs.
begin;
set local lock_timeout = '5s';
create schema if not exists portal_auth;
revoke all on schema portal_auth from public, anon, authenticated;
grant usage on schema portal_auth to service_role;

create table portal_auth.handoffs (
  code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
  account_id text not null references public."TAI_KHOAN"(ma_tk) on delete cascade,
  credential_version text not null check (credential_version ~ '^[a-f0-9]{64}$'),
  role text not null check (role in ('ADMIN', 'NHAN_VIEN')),
  source_origin text not null,
  target_origin text not null,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default statement_timestamp() + interval '60 seconds'
);
create index handoffs_expiry_idx on portal_auth.handoffs(expires_at);
alter table portal_auth.handoffs enable row level security;
revoke all on portal_auth.handoffs from public, anon, authenticated;
grant select, insert, delete on portal_auth.handoffs to service_role;

create function public.auth_create_portal_handoff_v1(
  p_account_id text, p_code_hash text, p_credential_version text,
  p_source_origin text, p_target_origin text, p_role text
) returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public."TAI_KHOAN" a join public."NHAN_VIEN" n using(ma_nhan_vien)
    where a.ma_tk=p_account_id and a.trang_thai=1 and n.trang_thai=1
      and n.loai_nhan_vien=p_role and p_role in ('ADMIN','NHAN_VIEN')
      and (p_role='ADMIN' or n.ma_kho is not null) for share of a,n;
  if not found then raise sqlstate 'PT401' using message='Account changed'; end if;
  delete from portal_auth.handoffs where expires_at <= statement_timestamp();
  insert into portal_auth.handoffs(code_hash,account_id,credential_version,source_origin,target_origin,role)
    values(p_code_hash,p_account_id,p_credential_version,p_source_origin,p_target_origin,p_role);
  return true;
end $$;

create function public.auth_consume_portal_handoff_v1(
  p_code_hash text, p_source_origin text, p_target_origin text, p_role text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  -- DELETE ... RETURNING consumes atomically, including across workers/instances.
  delete from portal_auth.handoffs h where h.code_hash=p_code_hash
    and h.source_origin=p_source_origin and h.target_origin=p_target_origin
    and h.role=p_role and h.expires_at > statement_timestamp()
    returning jsonb_build_object('account_id',h.account_id,'credential_version',h.credential_version) into result;
  return result;
end $$;

revoke all on function public.auth_create_portal_handoff_v1(text,text,text,text,text,text),
  public.auth_consume_portal_handoff_v1(text,text,text,text) from public, anon, authenticated;
grant execute on function public.auth_create_portal_handoff_v1(text,text,text,text,text,text),
  public.auth_consume_portal_handoff_v1(text,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
