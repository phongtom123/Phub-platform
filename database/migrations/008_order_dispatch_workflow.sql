-- Dispatch an order from the warehouse atomically.
-- Apply after migration 007.

create or replace function public.dispatch_order(
  p_ma_donhang varchar,
  p_nguoi_xuat varchar,
  p_ma_kho_duoc_phep integer default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare order_row record; line_row record; stock_quantity integer;
begin
  select * into order_row from public."DON_HANG" where "ma_donhang" = p_ma_donhang for update;
  if not found then raise exception using errcode = 'P0060', message = 'ORDER_NOT_FOUND'; end if;
  if order_row."trang_thai" not in ('MOI', 'XAC_NHAN', 'DANG_CHUAN_BI') then
    raise exception using errcode = 'P0061', message = 'ORDER_NOT_DISPATCHABLE';
  end if;
  if not exists (select 1 from public."CT_DON_HANG" where "ma_donhang" = p_ma_donhang) then
    raise exception using errcode = 'P0062', message = 'ORDER_HAS_NO_LINES';
  end if;
  if not exists (select 1 from public."NHAN_VIEN" where "ma_nhan_vien" = p_nguoi_xuat and "trang_thai" = 1) then
    raise exception using errcode = 'P0063', message = 'DISPATCHER_NOT_FOUND';
  end if;
  perform set_config('phub.stock_operation', 'XUAT_DON_HANG', true);
  perform set_config('phub.stock_reference', p_ma_donhang, true);
  perform set_config('phub.stock_actor', p_nguoi_xuat, true);
  for line_row in select "sku", "ma_kho_xuat", "so_luong" from public."CT_DON_HANG" where "ma_donhang" = p_ma_donhang order by "sku", "ma_kho_xuat" loop
    if p_ma_kho_duoc_phep is not null and line_row."ma_kho_xuat" <> p_ma_kho_duoc_phep then
      raise exception using errcode = 'P0064', message = 'WAREHOUSE_ACCESS_DENIED';
    end if;
    select "so_luong_ton" into stock_quantity from public."TON_KHO"
    where "ma_kho" = line_row."ma_kho_xuat" and "sku" = line_row."sku" for update;
    if not found or stock_quantity < line_row."so_luong" then
      raise exception using errcode = 'P0065', message = 'INSUFFICIENT_STOCK';
    end if;
    update public."TON_KHO" set "so_luong_ton" = stock_quantity - line_row."so_luong", "cap_nhat_luc" = now()
    where "ma_kho" = line_row."ma_kho_xuat" and "sku" = line_row."sku";
  end loop;
  update public."DON_HANG" set "trang_thai" = 'DA_XUAT_KHO', "thoi_gian_xuat_kho" = coalesce("thoi_gian_xuat_kho", now())
  where "ma_donhang" = p_ma_donhang;
  return jsonb_build_object('ma_donhang', p_ma_donhang, 'trang_thai', 'DA_XUAT_KHO', 'nguoi_xuat', p_nguoi_xuat);
end; $$;

revoke all on function public.dispatch_order(varchar, varchar, integer) from public, anon, authenticated;
grant execute on function public.dispatch_order(varchar, varchar, integer) to service_role;
