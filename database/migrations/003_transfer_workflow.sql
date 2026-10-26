-- Atomic transfer dispatch and receipt confirmation.
-- Apply after 001_initial_schema.sql and review on staging first.
create or replace function public.dispatch_transfer(
  p_ma_phieu_chuyen integer,
  p_nguoi_xuat varchar,
  p_ma_kho_duoc_phep integer default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare transfer_row record; line_row record; stock_quantity integer;
begin
  perform set_config('phub.stock_operation', 'XUAT_CHUYEN_KHO', true);
  perform set_config('phub.stock_reference', p_ma_phieu_chuyen::varchar, true);
  perform set_config('phub.stock_actor', p_nguoi_xuat, true);
  select * into transfer_row from public."PHIEU_CHUYEN_KHO"
  where ma_phieu_chuyen = p_ma_phieu_chuyen for update;
  if not found then raise exception using errcode = 'P0012', message = 'TRANSFER_NOT_FOUND'; end if;
  if p_ma_kho_duoc_phep is not null and transfer_row.ma_kho_xuat <> p_ma_kho_duoc_phep then
    raise exception using errcode = 'P0014', message = 'SOURCE_WAREHOUSE_ACCESS_DENIED';
  end if;
  if transfer_row.trang_thai <> 'NHAP' then
    raise exception using errcode = 'P0013', message = 'TRANSFER_NOT_DISPATCHABLE';
  end if;
  if not exists (select 1 from public."CT_CHUYEN_KHO" where ma_phieu_chuyen = p_ma_phieu_chuyen) then
    raise exception using errcode = 'P0016', message = 'TRANSFER_HAS_NO_LINES';
  end if;
  for line_row in select sku, so_luong from public."CT_CHUYEN_KHO" where ma_phieu_chuyen = p_ma_phieu_chuyen order by sku loop
    if line_row.so_luong <= 0 then raise exception using errcode = 'P0017', message = 'INVALID_TRANSFER_QUANTITY'; end if;
    select so_luong_ton into stock_quantity from public."TON_KHO"
    where ma_kho = transfer_row.ma_kho_xuat and sku = line_row.sku for update;
    if not found or stock_quantity < line_row.so_luong then
      raise exception using errcode = 'P0018', message = 'INSUFFICIENT_STOCK';
    end if;
    update public."TON_KHO" set so_luong_ton = stock_quantity - line_row.so_luong, cap_nhat_luc = now()
    where ma_kho = transfer_row.ma_kho_xuat and sku = line_row.sku;
  end loop;
  update public."PHIEU_CHUYEN_KHO" set trang_thai = 'DANG_CHUYEN', ngay_xuat = coalesce(ngay_xuat, now()), nguoi_xuat = p_nguoi_xuat
  where ma_phieu_chuyen = p_ma_phieu_chuyen;
  return jsonb_build_object('ma_phieu_chuyen', transfer_row.ma_phieu_chuyen, 'trang_thai', 'DANG_CHUYEN', 'nguoi_xuat', p_nguoi_xuat);
end; $$;

create or replace function public.receive_transfer(
  p_ma_phieu_chuyen integer,
  p_nguoi_nhan varchar,
  p_ma_kho_duoc_phep integer default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare transfer_row record; line_row record; stock_quantity integer;
begin
  perform set_config('phub.stock_operation', 'NHAN_CHUYEN_KHO', true);
  perform set_config('phub.stock_reference', p_ma_phieu_chuyen::varchar, true);
  perform set_config('phub.stock_actor', p_nguoi_nhan, true);
  select * into transfer_row from public."PHIEU_CHUYEN_KHO"
  where ma_phieu_chuyen = p_ma_phieu_chuyen for update;
  if not found then raise exception using errcode = 'P0012', message = 'TRANSFER_NOT_FOUND'; end if;
  if p_ma_kho_duoc_phep is not null and transfer_row.ma_kho_nhan <> p_ma_kho_duoc_phep then
    raise exception using errcode = 'P0015', message = 'DESTINATION_WAREHOUSE_ACCESS_DENIED';
  end if;
  if transfer_row.trang_thai <> 'DANG_CHUYEN' then
    raise exception using errcode = 'P0013', message = 'TRANSFER_NOT_RECEIVABLE';
  end if;
  for line_row in select sku, so_luong from public."CT_CHUYEN_KHO" where ma_phieu_chuyen = p_ma_phieu_chuyen order by sku loop
    insert into public."TON_KHO" (ma_kho, sku, so_luong_ton, cap_nhat_luc)
    values (transfer_row.ma_kho_nhan, line_row.sku, 0, now()) on conflict (ma_kho, sku) do nothing;
    select so_luong_ton into stock_quantity from public."TON_KHO"
    where ma_kho = transfer_row.ma_kho_nhan and sku = line_row.sku for update;
    update public."TON_KHO" set so_luong_ton = stock_quantity + line_row.so_luong, cap_nhat_luc = now()
    where ma_kho = transfer_row.ma_kho_nhan and sku = line_row.sku;
  end loop;
  update public."PHIEU_CHUYEN_KHO" set trang_thai = 'DA_NHAN', ngay_nhan = coalesce(ngay_nhan, now()), nguoi_nhan = p_nguoi_nhan
  where ma_phieu_chuyen = p_ma_phieu_chuyen;
  return jsonb_build_object('ma_phieu_chuyen', transfer_row.ma_phieu_chuyen, 'trang_thai', 'DA_NHAN', 'nguoi_nhan', p_nguoi_nhan);
end; $$;

revoke all on function public.dispatch_transfer(integer, varchar, integer) from public, anon, authenticated;
revoke all on function public.receive_transfer(integer, varchar, integer) from public, anon, authenticated;
grant execute on function public.dispatch_transfer(integer, varchar, integer) to service_role;
grant execute on function public.receive_transfer(integer, varchar, integer) to service_role;
