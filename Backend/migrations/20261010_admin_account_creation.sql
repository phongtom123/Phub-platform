-- Additive migration for existing DBML-compatible databases. No table/data deletion.
-- New employee/customer + account creation is a single atomic transaction.
-- Only the server-side service_role may execute this function.
begin;

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
drop function if exists public.admin_create_account_v1(text,text,text,text,text,text,text,text,integer);

create or replace function public.admin_create_account_v1(
    p_actor_account_id text,
    p_username text,
    p_email text,
    p_password_hash text,
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

    if p_role is null or p_role not in ('ADMIN', 'THU_KHO', 'KHACH_HANG')
       or ((p_role = 'THU_KHO') <> (p_warehouse_id is not null))
       or p_name is null or length(btrim(p_name)) not between 1 and 200
       or p_owner_id is null or p_owner_id !~ '^[A-Za-z0-9_.-]{1,100}$'
       or p_username is null or p_username !~ '^[A-Za-z0-9_.-]{3,80}$'
       or p_password_hash is null or p_password_hash not like '$argon2%' then
        raise exception using errcode = '23514', message = 'INVALID_ACCOUNT_INPUT';
    end if;

    if p_role = 'THU_KHO' then
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
        when 'THU_KHO' then
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
    insert into public."TAI_KHOAN" (ma_tk, ten_tai_khoan, email, mat_khau_hash, ma_nhan_vien, ma_kh, trang_thai)
        values (v_account_id, p_username, p_email, p_password_hash,
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

revoke all on function public.admin_create_account_v1(text,text,text,text,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.admin_create_account_v1(text,text,text,text,text,text,text,integer) to service_role;
notify pgrst, 'reload schema';
commit;
