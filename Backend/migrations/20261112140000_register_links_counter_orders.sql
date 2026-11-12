-- Demo behaviour: walk-in counter orders are attached to the customer account with the same
-- buyer email automatically, so the customer does not need to file an invoice-link request:
--   1. Counter sale (or manual warehouse invoice) whose buyer email belongs to an active customer
--      account: linked when the order / invoice is written (triggers below).
--   2. Customer self-registers later with that email: linked during registration
--      (customer_register_v2, returns linked_orders).
--   3. Existing unowned walk-in orders: linked once when this migration runs (backfill).
--
-- LIMITATION (demo only): the email is NOT verified (no OTP). Anyone registering with someone
-- else's email receives that person's walk-in order history. Verify the email before linking
-- in production. Orders without a stored buyer email still use the invoice-link request.
--
-- Matched orders: kenh_ban = 'TAI_QUAY', no owner yet, not cancelled, and the buyer email on the
-- order (DON_HANG.email_nguoi_mua, counter sales) or on its invoice (HOA_DON.email_nguoi_mua,
-- manual warehouse invoices) equals the account email, case-insensitively. Only active customer
-- accounts (trang_thai = 1, profile not deleted) receive orders. Each email column is used only
-- if installed, so registration keeps working on databases without those migrations.
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

-- Active customer that owns an account with this email (null when none).
create or replace function public.crm_active_customer_by_email(p_email text) returns text
language plpgsql stable security invoker set search_path = '' as $$
declare v_customer text;
begin
    if nullif(btrim(p_email), '') is null then return null; end if;
    select k.ma_kh into v_customer
      from public."TAI_KHOAN" a join public."KHACH_HANG" k on k.ma_kh = a.ma_kh
     where lower(a.email) = lower(btrim(p_email)) and a.trang_thai = 1
       and a.ma_nhan_vien is null and k.luu_tru_luc is null
     order by k.ma_kh limit 1;
    return v_customer;
end $$;
revoke all on function public.crm_active_customer_by_email(text) from public, anon, authenticated;
grant execute on function public.crm_active_customer_by_email(text) to service_role;

-- 1a. Counter sale: the buyer email is on the order row.
create or replace function public.crm_link_counter_order_trg() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
    if new.ma_kh is null and new.kenh_ban = 'TAI_QUAY' and new.trang_thai <> 'HUY' then
        new.ma_kh := public.crm_active_customer_by_email(new.email_nguoi_mua);
    end if;
    return new;
end $$;

-- 1b. Manual warehouse invoice: the buyer email is on the invoice row.
create or replace function public.crm_link_invoice_order_trg() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_customer text;
begin
    v_customer := public.crm_active_customer_by_email(new.email_nguoi_mua);
    if v_customer is not null then
        update public."DON_HANG" set ma_kh = v_customer
         where ma_donhang = new.ma_donhang and ma_kh is null and kenh_ban = 'TAI_QUAY' and trang_thai <> 'HUY';
    end if;
    return null;
end $$;
revoke all on function public.crm_link_counter_order_trg(), public.crm_link_invoice_order_trg() from public, anon, authenticated;

do $$
declare v_order_email boolean; v_invoice_email boolean; v_linked integer := 0; v_more integer;
begin
    select exists (select 1 from information_schema.columns where table_schema = 'public'
                   and table_name = 'DON_HANG' and column_name = 'email_nguoi_mua') into v_order_email;
    select exists (select 1 from information_schema.columns where table_schema = 'public'
                   and table_name = 'HOA_DON' and column_name = 'email_nguoi_mua') into v_invoice_email;
    drop trigger if exists crm_link_counter_order on public."DON_HANG";
    drop trigger if exists crm_link_invoice_order on public."HOA_DON";
    if v_order_email then
        create trigger crm_link_counter_order before insert or update of email_nguoi_mua on public."DON_HANG"
            for each row execute function public.crm_link_counter_order_trg();
        -- 3. Backfill existing walk-in orders (order email).
        update public."DON_HANG" d set ma_kh = public.crm_active_customer_by_email(d.email_nguoi_mua)
         where d.ma_kh is null and d.kenh_ban = 'TAI_QUAY' and d.trang_thai <> 'HUY'
           and public.crm_active_customer_by_email(d.email_nguoi_mua) is not null;
        get diagnostics v_linked = row_count;
    end if;
    if v_invoice_email then
        create trigger crm_link_invoice_order after insert or update of email_nguoi_mua on public."HOA_DON"
            for each row execute function public.crm_link_invoice_order_trg();
        -- 3. Backfill existing walk-in orders (invoice email).
        execute 'update public."DON_HANG" d set ma_kh = public.crm_active_customer_by_email(i.email_nguoi_mua)
                   from public."HOA_DON" i
                  where i.ma_donhang = d.ma_donhang and d.ma_kh is null and d.kenh_ban = ''TAI_QUAY''
                    and d.trang_thai <> ''HUY'' and public.crm_active_customer_by_email(i.email_nguoi_mua) is not null';
        get diagnostics v_more = row_count;
        v_linked := v_linked + v_more;
    end if;
    raise notice 'Linked % existing walk-in order(s) to customer accounts by email.', v_linked;
end $$;

commit;
