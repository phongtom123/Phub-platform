begin;

-- A manual invoice represents a counter sale, so it must reserve and deduct
-- stock atomically with the invoice creation.
create or replace function public.create_manual_invoice(
  p_actor text, p_warehouse integer, p_buyer varchar, p_email varchar,
  p_tax_id varchar, p_address varchar, p_lines jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  who jsonb; employee varchar; created timestamptz := now();
  order_id varchar := 'MAN-' || replace(gen_random_uuid()::text, '-', '');
  invoice_id varchar := 'HD-' || replace(gen_random_uuid()::text, '-', '');
  item jsonb; product record; quantity integer; unit_price numeric; discount numeric;
  stock integer; tax numeric; line_total numeric; subtotal numeric := 0;
  total_discount numeric := 0; total_tax numeric := 0; total numeric := 0;
begin
  who := admin_ops.warehouse_actor(p_actor); employee := who->>'employee';
  if (who->>'warehouse')::integer <> p_warehouse then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
  if nullif(btrim(p_buyer), '') is null or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'VALIDATION_ERROR'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'VALIDATION_ERROR'; end if;

  -- Lock and deduct each stock row before writing the document. If any line
  -- fails, the whole function rolls back and no invoice is created.
  for item in select value from jsonb_array_elements(p_lines) loop
    select * into product from public."SAN_PHAM" where "sku" = btrim(item->>'sku') and "trang_thai" = 1;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    quantity := (item->>'quantity')::integer; unit_price := (item->>'unit_price')::numeric; discount := coalesce((item->>'discount')::numeric, 0);
    if quantity <= 0 or unit_price < 0 or discount < 0 or discount > quantity * unit_price then raise exception 'INVALID_DISCOUNT'; end if;
    select "so_luong_ton" into stock from public."TON_KHO" where "ma_kho" = p_warehouse and "sku" = product."sku" for update;
    if stock is null or stock < quantity then raise exception 'INSUFFICIENT_STOCK'; end if;
    update public."TON_KHO" set "so_luong_ton" = "so_luong_ton" - quantity, "cap_nhat_luc" = created where "ma_kho" = p_warehouse and "sku" = product."sku";
  end loop;

  insert into public."DON_HANG"("ma_donhang","kenh_ban","trang_thai","thoi_gian_dat","thoi_gian_xuat_kho","ten_nguoi_nhan","dia_chi_chi_tiet","ma_nhan_vien")
  values(order_id,'TAI_QUAY','DA_XUAT_KHO',created,created,btrim(p_buyer),nullif(btrim(p_address),''),employee);

  for item in select value from jsonb_array_elements(p_lines) loop
    select * into product from public."SAN_PHAM" where "sku" = btrim(item->>'sku') and "trang_thai" = 1;
    quantity := (item->>'quantity')::integer; unit_price := (item->>'unit_price')::numeric; discount := coalesce((item->>'discount')::numeric, 0);
    tax := round((quantity * unit_price - discount) * 0.10, 2); line_total := quantity * unit_price - discount + tax;
    subtotal := subtotal + quantity * unit_price - discount; total_discount := total_discount + discount; total_tax := total_tax + tax; total := total + line_total;
    insert into public."CT_DON_HANG"("ma_donhang","sku","ma_kho_xuat","ten_sp_luc_ban","don_vi_luc_ban","so_luong","don_gia","giam_gia","giam_gia_voucher","thue_suat","tien_thue","thanh_tien")
    values(order_id,product."sku",p_warehouse,product."ten_sp",product."don_vi",quantity,unit_price,discount,0,10,tax,line_total);
  end loop;

  insert into public."HOA_DON"("ma_hoadon","ma_donhang","thoi_gian_lap","ten_nguoi_mua","email_nguoi_mua","ma_so_thue","dia_chi_nguoi_mua","tong_tien_giam","tong_tien_truoc_thue","tong_tien_thue","tong_tien_sau_thue","nguoi_lap")
  values(invoice_id,order_id,created,btrim(p_buyer),lower(btrim(p_email)),nullif(btrim(p_tax_id),''),nullif(btrim(p_address),''),total_discount,subtotal,total_tax,total,employee);
  return jsonb_build_object('id',invoice_id,'recordId',order_id,'order',order_id,'buyer',btrim(p_buyer),'employeeCode',employee,'total',total,'created',created,'status','Hoàn tất');
end;
$$;

revoke all on function public.create_manual_invoice(text,integer,varchar,varchar,varchar,varchar,jsonb) from public,anon,authenticated;
grant execute on function public.create_manual_invoice(text,integer,varchar,varchar,varchar,varchar,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
