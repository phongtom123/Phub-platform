-- Demo behaviour: when a customer self-registers, walk-in counter orders that carry the same
-- buyer email are attached to the new account automatically, so the customer does not need to
-- file an invoice-link request for them.
--
-- LIMITATION (demo only): the email is NOT verified (no OTP). Anyone registering with someone
-- else's email receives that person's walk-in order history. Verify the email before linking
-- in production. Orders without a stored buyer email still use the invoice-link request.
--
-- Matched orders: kenh_ban = 'TAI_QUAY', no owner yet, not cancelled, and the buyer email on the
-- order (DON_HANG.email_nguoi_mua, counter sales) or on its invoice (HOA_DON.email_nguoi_mua,
-- manual warehouse invoices) equals the registration email, case-insensitively. Each column is
-- used only if installed, so registration keeps working on databases without those migrations.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

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
    v_email text := lower(btrim(p_email));
    v_order_email boolean;
    v_invoice_email boolean;
    v_linked integer := 0;
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

    -- Attach unowned walk-in orders bought with this email (demo: email not verified).
    select exists (select 1 from information_schema.columns where table_schema = 'public'
                   and table_name = 'DON_HANG' and column_name = 'email_nguoi_mua') into v_order_email;
    select exists (select 1 from information_schema.columns where table_schema = 'public'
                   and table_name = 'HOA_DON' and column_name = 'email_nguoi_mua') into v_invoice_email;
    if v_order_email or v_invoice_email then
        execute format(
            'update public."DON_HANG" d set ma_kh = $1
              where d.ma_kh is null and d.kenh_ban = ''TAI_QUAY'' and d.trang_thai <> ''HUY''
                and (%s or %s)',
            case when v_order_email then 'lower(btrim(d.email_nguoi_mua)) = $2' else 'false' end,
            case when v_invoice_email then 'exists (select 1 from public."HOA_DON" i
                 where i.ma_donhang = d.ma_donhang and lower(btrim(i.email_nguoi_mua)) = $2)' else 'false' end)
        using p_customer_id, v_email;
        get diagnostics v_linked = row_count;
    end if;

    return jsonb_build_object(
        'account_id', v_account_id,
        'username', p_username,
        'role', 'KHACH_HANG',
        'name', btrim(p_name),
        'customer_id', p_customer_id,
        'employee_id', null,
        'warehouse_id', null,
        'credential_version', (select phien_ban_mat_khau from public."TAI_KHOAN" where ma_tk = v_account_id),
        'linked_orders', v_linked
    );
end;
$$;

revoke all on function public.customer_register_v2(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.customer_register_v2(text,text,text,text,text,text) to service_role;

commit;
