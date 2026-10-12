-- Customer self-registration. Both customer and account rows are created atomically.
-- The browser cannot call this RPC: only the backend service_role has EXECUTE.
begin;

create schema if not exists admin_account_private;
revoke all on schema admin_account_private from public, anon, authenticated;
grant usage on schema admin_account_private to service_role;

-- Share the customer account sequence with the admin account-creation migration.
create sequence if not exists admin_account_private.customer_account_ids;
revoke all on sequence admin_account_private.customer_account_ids from public, anon, authenticated;
grant usage, select on sequence admin_account_private.customer_account_ids to service_role;

create or replace function public.customer_register_v1(
    p_username text,
    p_email text,
    p_password_hash text,
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
       or p_password_hash is null or p_password_hash not like '$argon2%'
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
        ma_tk, ten_tai_khoan, email, mat_khau_hash, ma_nhan_vien, ma_kh, trang_thai
    ) values (
        v_account_id, p_username, lower(p_email), p_password_hash, null, p_customer_id, 1
    );

    return jsonb_build_object(
        'account_id', v_account_id,
        'username', p_username,
        'role', 'KHACH_HANG',
        'name', btrim(p_name),
        'customer_id', p_customer_id,
        'employee_id', null,
        'warehouse_id', null
    );
end;
$$;

revoke all on function public.customer_register_v1(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.customer_register_v1(text,text,text,text,text,text) to service_role;

notify pgrst, 'reload schema';
commit;
