-- Explicit storage change requested by the project. NOT safe for production passwords.
-- Verified known passwords are preserved via an ephemeral local input table.
-- Only passwords not supplied by the operator get a different random value.
-- Backup first; coordinate deployment of the new backend and this migration.
-- Existing account IDs, statuses, owners and business rows remain unchanged.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local standard_conforming_strings = on;
lock table public."TAI_KHOAN" in access exclusive mode;
create temporary table phub_password_preservation (
    ma_tk text primary key, mat_khau text not null, expected_hash text not null
) on commit drop;
create temporary table phub_password_source_snapshot (
    ma_tk text primary key, expected_account jsonb not null
) on commit drop;
-- PHUB_LOCAL_PASSWORD_INPUT: generated locally; never commit real credentials.
do $preflight$
begin
    if exists (select 1 from public."TAI_KHOAN")
       and current_setting('phub.allow_plaintext_password_reset', true) is distinct from 'RESET_UNKNOWN_ACCOUNT_PASSWORDS' then
        raise exception 'Explicit confirmation required: SET phub.allow_plaintext_password_reset = ''RESET_UNKNOWN_ACCOUNT_PASSWORDS''; unknown passwords will change.';
    end if;
    if exists (select 1 from public."TAI_KHOAN") and not exists (select 1 from pg_temp.phub_password_preservation) then
        raise exception 'Verified password preservation input required; prepare the local cutover artifact first.';
    end if;
    if exists (select 1 from pg_temp.phub_password_source_snapshot) and (
        (select count(*) from pg_temp.phub_password_source_snapshot) <> (select count(*) from public."TAI_KHOAN")
        or exists (select 1 from pg_temp.phub_password_source_snapshot s
            left join public."TAI_KHOAN" a on a.ma_tk = s.ma_tk
            where to_jsonb(a) is distinct from s.expected_account)
    ) then
        raise exception 'Account snapshot changed; prepare a fresh backup and preservation plan.';
    end if;
    if exists (select 1 from pg_temp.phub_password_preservation p
        left join public."TAI_KHOAN" a on a.ma_tk = p.ma_tk
        where a.ma_tk is null or p.expected_hash is distinct from a.mat_khau_hash
          or length(p.mat_khau) not between 10 and 128) then
        raise exception 'Invalid or stale password preservation input.';
    end if;
end;
$preflight$;

alter table public."TAI_KHOAN" add column mat_khau varchar(128);
alter table public."TAI_KHOAN" add column phien_ban_mat_khau uuid not null default gen_random_uuid();
update public."TAI_KHOAN" a set mat_khau = coalesce(
    (select p.mat_khau from pg_temp.phub_password_preservation p where p.ma_tk = a.ma_tk),
    'Reset-' || replace(gen_random_uuid()::text, '-', '')
);
alter table public."TAI_KHOAN" alter column mat_khau set not null;
alter table public."TAI_KHOAN" add constraint "TAI_KHOAN_mat_khau_length" check (length(mat_khau) between 10 and 128);

-- Old RPCs are removed explicitly, without CASCADE or modifying migration history.
drop function if exists public.admin_create_account_v1(text,text,text,text,text,text,text,integer);
drop function if exists public.customer_register_v1(text,text,text,text,text,text);
alter table public."TAI_KHOAN" drop column mat_khau_hash restrict;

create function public.phub_account_password_revision() returns trigger
language plpgsql security invoker set search_path = '' as $revision$
begin
    new.phien_ban_mat_khau = gen_random_uuid();
    return new;
end;
$revision$;
revoke all on function public.phub_account_password_revision() from public,anon,authenticated;
create trigger phub_account_password_revision before update of mat_khau on public."TAI_KHOAN"
for each row execute function public.phub_account_password_revision();

create schema if not exists admin_account_private;
revoke all on schema admin_account_private from public, anon, authenticated;
grant usage on schema admin_account_private to service_role;
create sequence if not exists admin_account_private.admin_account_ids;
create sequence if not exists admin_account_private.warehouse_account_ids;
create sequence if not exists admin_account_private.customer_account_ids;
revoke all on sequence admin_account_private.admin_account_ids,
    admin_account_private.warehouse_account_ids,
    admin_account_private.customer_account_ids from public, anon, authenticated;
grant usage, select on sequence admin_account_private.admin_account_ids,
    admin_account_private.warehouse_account_ids,
    admin_account_private.customer_account_ids to service_role;

-- Remove only the earlier development overload that accepted a manual code.
-- No rows, existing account IDs or tables are changed.
drop function if exists public.admin_create_account_v2(text,text,text,text,text,text,text,text,integer);

create or replace function public.admin_create_account_v2(
    p_actor_account_id text,
    p_username text,
    p_email text,
    p_password text,
    p_owner_id text,
    p_name text,
    p_role text,
    p_warehouse_id integer default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_account_id text;
    v_prefix text;
    v_number bigint;
    v_sequence regclass;
begin
    -- Recheck the actor inside the transaction and prevent concurrent demotion
    -- or deactivation until both records have been created.
    perform 1 from public."TAI_KHOAN" as a
        join public."NHAN_VIEN" as n on n.ma_nhan_vien = a.ma_nhan_vien
        where a.ma_tk = p_actor_account_id and a.trang_thai = 1
          and n.trang_thai = 1 and n.loai_nhan_vien = 'ADMIN'
        for share of a, n;
    if not found then
        raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
    end if;

    if p_role is null or p_role not in ('ADMIN', 'NHAN_VIEN_KHO', 'KHACH_HANG')
       or ((p_role = 'NHAN_VIEN_KHO') <> (p_warehouse_id is not null))
       or p_name is null or length(btrim(p_name)) not between 1 and 200
       or p_owner_id is null or p_owner_id !~ '^[A-Za-z0-9_.-]{1,100}$'
       or p_username is null or p_username !~ '^[A-Za-z0-9_.-]{3,80}$'
       or p_password is null or length(p_password) not between 10 and 128 then
        raise exception using errcode = '23514', message = 'INVALID_ACCOUNT_INPUT';
    end if;

    if p_role = 'NHAN_VIEN_KHO' then
        perform 1 from public."KHO"
            where ma_kho = p_warehouse_id and trang_thai = 1 for share;
        if not found then
            raise exception using errcode = '23514', message = 'ACTIVE_WAREHOUSE_REQUIRED';
        end if;
    end if;

    -- nextval is concurrency-safe. Separate role sequences never use MAX(id)+1.
    -- Preserve existing manually assigned codes and skip any that already exist.
    case p_role
        when 'ADMIN' then
            v_prefix := 'AD'; v_sequence := 'admin_account_private.admin_account_ids'::regclass;
        when 'NHAN_VIEN_KHO' then
            v_prefix := 'KHO'; v_sequence := 'admin_account_private.warehouse_account_ids'::regclass;
        else
            v_prefix := 'KH'; v_sequence := 'admin_account_private.customer_account_ids'::regclass;
    end case;
    loop
        v_number := nextval(v_sequence);
        v_account_id := v_prefix || lpad(v_number::text, greatest(6, length(v_number::text)), '0');
        exit when not exists (select 1 from public."TAI_KHOAN" where ma_tk = v_account_id);
    end loop;

    if p_role = 'KHACH_HANG' then
        insert into public."KHACH_HANG" (ma_kh, ten_kh)
            values (p_owner_id, btrim(p_name));
    else
        insert into public."NHAN_VIEN" (ma_nhan_vien, ho_ten, loai_nhan_vien, ma_kho, email, trang_thai)
            values (p_owner_id, btrim(p_name), p_role, p_warehouse_id, p_email, 1);
    end if;

    -- Any unique/FK/check failure here rolls back the person insert as well.
    insert into public."TAI_KHOAN" (ma_tk, ten_tai_khoan, email, mat_khau, ma_nhan_vien, ma_kh, trang_thai)
        values (v_account_id, p_username, p_email, p_password,
                case when p_role <> 'KHACH_HANG' then p_owner_id else null end,
                case when p_role = 'KHACH_HANG' then p_owner_id else null end, 1);

    return jsonb_build_object(
        'ma_tk', v_account_id, 'ten_tai_khoan', p_username, 'email', p_email,
        'ma_nhan_vien', case when p_role <> 'KHACH_HANG' then p_owner_id else null end,
        'ma_kh', case when p_role = 'KHACH_HANG' then p_owner_id else null end,
        'trang_thai', 1, 'role', p_role, 'ho_ten', btrim(p_name),
        'ma_kho', p_warehouse_id, 'owner_active', true, 'is_self', false
    );
end;
$$;

revoke all on function public.admin_create_account_v2(text,text,text,text,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.admin_create_account_v2(text,text,text,text,text,text,text,integer) to service_role;

create schema if not exists admin_account_private;
revoke all on schema admin_account_private from public, anon, authenticated;
grant usage on schema admin_account_private to service_role;

-- Share the customer account sequence with the admin account-creation migration.
create sequence if not exists admin_account_private.customer_account_ids;
revoke all on sequence admin_account_private.customer_account_ids from public, anon, authenticated;
grant usage, select on sequence admin_account_private.customer_account_ids to service_role;

create or replace function public.customer_register_v2(
    p_username text,
    p_email text,
    p_password text,
    p_customer_id text,
    p_name text,
    p_phone text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_account_id text;
    v_number bigint;
begin
    if p_username is null or p_username !~ '^[A-Za-z0-9_.-]{3,80}$'
       or p_email is null or length(p_email) > 254
       or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       or p_password is null or length(p_password) not between 10 and 128
       or p_customer_id is null or p_customer_id !~ '^[A-Za-z0-9_.-]{1,100}$'
       or p_name is null or length(btrim(p_name)) not between 2 and 200
       or (p_phone is not null and length(p_phone) > 20) then
        raise exception using errcode = '23514', message = 'INVALID_CUSTOMER_REGISTRATION';
    end if;

    -- nextval is concurrency-safe. Existing manually assigned IDs are skipped.
    loop
        v_number := nextval('admin_account_private.customer_account_ids'::regclass);
        v_account_id := 'KH' || lpad(v_number::text, greatest(6, length(v_number::text)), '0');
        exit when not exists (select 1 from public."TAI_KHOAN" where ma_tk = v_account_id);
    end loop;

    insert into public."KHACH_HANG" (ma_kh, ten_kh, sdt)
        values (p_customer_id, btrim(p_name), nullif(btrim(p_phone), ''));

    insert into public."TAI_KHOAN" (
        ma_tk, ten_tai_khoan, email, mat_khau, ma_nhan_vien, ma_kh, trang_thai
    ) values (
        v_account_id, p_username, lower(p_email), p_password, null, p_customer_id, 1
    );

    return jsonb_build_object(
        'account_id', v_account_id,
        'username', p_username,
        'role', 'KHACH_HANG',
        'name', btrim(p_name),
        'customer_id', p_customer_id,
        'employee_id', null,
        'warehouse_id', null,
        'credential_version', (select phien_ban_mat_khau from public."TAI_KHOAN" where ma_tk = v_account_id)
    );
end;
$$;

revoke all on function public.customer_register_v2(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.customer_register_v2(text,text,text,text,text,text) to service_role;


-- Conditional replacement keeps credentials in the request body, not URL filters.
create function public.set_account_password_v2(
    p_account_id text, p_password text, p_expected_password text default null,
    p_expected_version uuid default null
) returns jsonb language plpgsql security invoker set search_path = ''
as $password$
declare v_id text;
begin
    if p_password is null or length(p_password) not between 10 and 128 then
        raise exception 'INVALID_PASSWORD' using errcode = '23514';
    end if;
    update public."TAI_KHOAN" set mat_khau = p_password
      where ma_tk = p_account_id
        and (p_expected_password is null or mat_khau = p_expected_password)
        and (p_expected_version is null or phien_ban_mat_khau = p_expected_version)
      returning ma_tk into v_id;
    if not found then return '[]'::jsonb; end if;
    return jsonb_build_array(jsonb_build_object('ma_tk', v_id));
end;
$password$;
revoke all on function public.set_account_password_v2(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.set_account_password_v2(text,text,text,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
