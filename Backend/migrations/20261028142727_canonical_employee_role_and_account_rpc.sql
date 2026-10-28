-- Canonical employee role; deploy the matching backend/UI from PR #86.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public."NHAN_VIEN" in share row exclusive mode;

alter table public."NHAN_VIEN" drop constraint if exists "NHAN_VIEN_check";
alter table public."NHAN_VIEN" drop constraint if exists "NHAN_VIEN_loai_nhan_vien_check";
alter table public."NHAN_VIEN" drop constraint if exists nhan_vien_role_check;
alter table public."NHAN_VIEN" drop constraint if exists nhan_vien_warehouse_assignment_check;

update public."NHAN_VIEN" set loai_nhan_vien = 'NHAN_VIEN'
where loai_nhan_vien in ('THU_KHO', 'NHAN_VIEN_KHO');

alter table public."NHAN_VIEN" add constraint nhan_vien_role_check
check (loai_nhan_vien in ('ADMIN', 'NHAN_VIEN'));
alter table public."NHAN_VIEN" add constraint nhan_vien_warehouse_assignment_check
check ((loai_nhan_vien = 'ADMIN' and ma_kho is null)
    or (loai_nhan_vien = 'NHAN_VIEN' and ma_kho is not null));

-- Replacing the existing signature preserves its owner and EXECUTE grants.
CREATE OR REPLACE FUNCTION public.admin_create_account_v2(p_actor_account_id text, p_username text, p_email text, p_password text, p_owner_id text, p_name text, p_role text, p_warehouse_id integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

    if p_role is null or p_role not in ('ADMIN', 'NHAN_VIEN', 'KHACH_HANG')
       or ((p_role = 'NHAN_VIEN') <> (p_warehouse_id is not null))
       or p_name is null or length(btrim(p_name)) not between 1 and 200
       or p_owner_id is null or p_owner_id !~ '^[A-Za-z0-9_.-]{1,100}$'
       or p_username is null or p_username !~ '^[A-Za-z0-9_.-]{3,80}$'
       or p_password is null or length(p_password) not between 10 and 128 then
        raise exception using errcode = '23514', message = 'INVALID_ACCOUNT_INPUT';
    end if;

    if p_role = 'NHAN_VIEN' then
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
        when 'NHAN_VIEN' then
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
$function$
;

notify pgrst, 'reload schema';
commit;

