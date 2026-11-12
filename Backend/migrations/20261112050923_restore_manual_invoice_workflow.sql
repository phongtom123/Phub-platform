-- Restore missing manual-invoice RPCs without editing an already versioned migration.
-- Reuses the existing workflow, fixes the ambiguous result assignment, and rejects
-- inactive warehouses. No historical documents or stock are rewritten by this migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public."HOA_DON"
  add column if not exists email_nguoi_mua varchar(254);

create or replace function public.warehouse_manual_invoice_options_v1(p_actor text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  who jsonb;
  warehouse integer;
  products jsonb;
begin
  who := admin_ops.warehouse_actor(p_actor);
  warehouse := nullif(who->>'warehouse', '')::integer;
  if warehouse is null then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
  perform 1 from public."KHO" where ma_kho = warehouse and trang_thai = 1 for share;
  if not found then raise exception 'WAREHOUSE_FORBIDDEN'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sku', p.sku, 'name', p.ten_sp, 'unit', p.don_vi,
    'unit_price', p.gia_ban_hien_tai,
    'available', admin_ops.available(warehouse, p.sku)
  ) order by p.ten_sp, p.sku), '[]'::jsonb)
  into products
  from public."SAN_PHAM" p
  where p.trang_thai = 1 and admin_ops.available(warehouse, p.sku) > 0;

  return jsonb_build_object('data', products, 'warehouse_id', warehouse);
end;
$$;

create or replace function public.warehouse_invoice_customer_search_v1(p_actor text, p_query text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  who jsonb;
  warehouse integer;
  term text := lower(btrim(coalesce(p_query, '')));
  customers jsonb;
begin
  who := admin_ops.warehouse_actor(p_actor);
  warehouse := nullif(who->>'warehouse', '')::integer;
  if warehouse is null then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
  perform 1 from public."KHO" where ma_kho = warehouse and trang_thai = 1 for share;
  if not found then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
  if length(term) > 100 then raise exception 'VALIDATION_ERROR'; end if;
  if length(term) < 2 then return jsonb_build_object('customers', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(to_jsonb(matches)), '[]'::jsonb)
  into customers
  from (
    select k.ma_kh, k.ten_kh, k.sdt, k.dia_chi_chi_tiet_md, a.email
    from public."TAI_KHOAN" a
    join public."KHACH_HANG" k using (ma_kh)
    where a.trang_thai = 1 and a.ma_nhan_vien is null
      and a.luu_tru_luc is null and k.luu_tru_luc is null
      and position(term in lower(coalesce(a.email, ''))) > 0
    order by lower(a.email), k.ma_kh
    limit 10
  ) matches;

  return jsonb_build_object('customers', customers);
end;
$$;

create or replace function public.warehouse_manual_invoice_v1(
  p_actor text, p_key uuid, p_warehouse integer, p_body jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set timezone = 'UTC'
as $$
declare
  who jsonb;
  employee text;
  req_hash text;
  prior admin_ops.requests%rowtype;
  inserted integer;
  created timestamptz := statement_timestamp();
  order_id text := 'MAN-' || replace(gen_random_uuid()::text, '-', '');
  invoice_id text := 'HD-' || replace(gen_random_uuid()::text, '-', '');
  item jsonb;
  line record;
  product record;
  quantity integer;
  unit_price numeric;
  discount numeric;
  stock integer;
  tax numeric;
  line_total numeric;
  subtotal numeric := 0;
  total_discount numeric := 0;
  total_tax numeric := 0;
  total numeric := 0;
  email text := lower(btrim(coalesce(p_body->>'email', '')));
  buyer text := btrim(coalesce(p_body->>'buyer', ''));
  v_result jsonb;
begin
  who := admin_ops.warehouse_actor(p_actor);
  employee := who->>'employee';
  if p_warehouse is null or nullif(who->>'warehouse', '')::integer is distinct from p_warehouse then
    raise exception 'WAREHOUSE_FORBIDDEN';
  end if;
  if p_key is null or p_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(p_body) is distinct from 'object'
    or length(buyer) not between 1 and 200
    or length(email) > 254
    or email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or jsonb_typeof(p_body->'lines') is distinct from 'array'
    or (case when jsonb_typeof(p_body->'lines') = 'array'
      then jsonb_array_length(p_body->'lines') else 0 end) not between 1 and 100 then
    raise exception 'VALIDATION_ERROR';
  end if;

  req_hash := encode(sha256(convert_to(jsonb_build_array(
    p_warehouse, p_body
  )::text, 'UTF8')), 'hex');
  insert into admin_ops.requests(actor, key, hash, resource, action, record_id)
  values (p_actor, p_key, req_hash, 'manual-invoices', 'create', null)
  on conflict (actor, key) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    select * into strict prior from admin_ops.requests where actor = p_actor and key = p_key;
    if prior.hash <> req_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    if prior.result is null then raise exception 'IDEMPOTENCY_PENDING'; end if;
    return prior.result || jsonb_build_object('replayed', true);
  end if;

  perform 1 from public."KHO" where ma_kho = p_warehouse and trang_thai = 1 for share;
  if not found then raise exception 'WAREHOUSE_FORBIDDEN'; end if;

  for item in select value from jsonb_array_elements(p_body->'lines') loop
    if nullif(btrim(item->>'sku'), '') is null
      or coalesce(item->>'quantity', '') !~ '^[1-9][0-9]{0,6}$'
      or coalesce(item->>'unit_price', '') !~ '^[0-9]+([.][0-9]{1,2})?$'
      or coalesce(item->>'discount', '0') !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'VALIDATION_ERROR';
    end if;
    quantity := (item->>'quantity')::integer;
    unit_price := (item->>'unit_price')::numeric;
    discount := coalesce((item->>'discount')::numeric, 0);
    if quantity > 1000000 or unit_price < 0 or discount < 0
      or discount > quantity * unit_price then
      raise exception 'INVALID_DISCOUNT';
    end if;
  end loop;

  perform set_config('phub.actor', p_actor, true);
  perform set_config('phub.reason', 'invoices:manual', true);
  perform set_config('phub.reference', invoice_id, true);

  for line in
    select btrim(value->>'sku') as sku, sum((value->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_body->'lines')
    group by btrim(value->>'sku')
    order by btrim(value->>'sku')
  loop
    select * into product from public."SAN_PHAM"
    where sku = line.sku and trang_thai = 1;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

    select so_luong_ton into stock from public."TON_KHO"
    where ma_kho = p_warehouse and sku = line.sku
    for update;
    if not found or coalesce(admin_ops.available(p_warehouse, line.sku), 0) < line.quantity then
      raise exception 'INSUFFICIENT_STOCK';
    end if;
    update public."TON_KHO"
    set so_luong_ton = so_luong_ton - line.quantity, cap_nhat_luc = created
    where ma_kho = p_warehouse and sku = line.sku;
  end loop;

  insert into public."DON_HANG"(
    ma_donhang, kenh_ban, trang_thai, thoi_gian_dat, thoi_gian_xuat_kho,
    ten_nguoi_nhan, dia_chi_chi_tiet, ma_nhan_vien
  )
  values (
    order_id, 'TAI_QUAY', 'DA_XUAT_KHO', created, created,
    buyer, nullif(btrim(p_body->>'address'), ''), employee
  );

  for item in select value from jsonb_array_elements(p_body->'lines') loop
    select * into product from public."SAN_PHAM"
    where sku = btrim(item->>'sku') and trang_thai = 1;
    quantity := (item->>'quantity')::integer;
    unit_price := (item->>'unit_price')::numeric;
    discount := coalesce((item->>'discount')::numeric, 0);
    tax := round((quantity * unit_price - discount) * 0.10, 2);
    line_total := quantity * unit_price - discount + tax;
    subtotal := subtotal + quantity * unit_price - discount;
    total_discount := total_discount + discount;
    total_tax := total_tax + tax;
    total := total + line_total;

    insert into public."CT_DON_HANG"(
      ma_donhang, sku, ma_kho_xuat, ten_sp_luc_ban, don_vi_luc_ban, so_luong,
      don_gia, giam_gia, giam_gia_voucher, thue_suat, tien_thue, thanh_tien
    )
    values (
      order_id, product.sku, p_warehouse, product.ten_sp, product.don_vi, quantity,
      unit_price, discount, 0, 10, tax, line_total
    );
  end loop;

  insert into public."HOA_DON"(
    ma_hoadon, ma_donhang, thoi_gian_lap, ten_nguoi_mua, email_nguoi_mua,
    ma_so_thue, dia_chi_nguoi_mua, tong_tien_giam, tong_tien_truoc_thue,
    tong_tien_thue, tong_tien_sau_thue, nguoi_lap
  )
  values (
    invoice_id, order_id, created, buyer, email,
    nullif(btrim(p_body->>'tax_id'), ''), nullif(btrim(p_body->>'address'), ''),
    total_discount, subtotal, total_tax, total, employee
  );

  v_result := jsonb_build_object('data', jsonb_build_array(jsonb_build_object(
    'id', invoice_id, 'recordId', order_id, 'order', order_id,
    'buyer', buyer, 'employeeCode', employee, 'total', total,
    'created', created, 'status', 'Hoàn tất'
  )), 'replayed', false);
  update admin_ops.requests set result = v_result where actor = p_actor and key = p_key;
  return v_result;
end;
$$;

revoke all on function public.warehouse_manual_invoice_options_v1(text) from public, anon, authenticated;
revoke all on function public.warehouse_invoice_customer_search_v1(text, text) from public, anon, authenticated;
revoke all on function public.warehouse_manual_invoice_v1(text, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.warehouse_manual_invoice_options_v1(text) to service_role;
grant execute on function public.warehouse_invoice_customer_search_v1(text, text) to service_role;
grant execute on function public.warehouse_manual_invoice_v1(text, uuid, integer, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
