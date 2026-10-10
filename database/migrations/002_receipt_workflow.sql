-- Atomic warehouse receipt confirmation.
-- Apply only after 001_initial_schema.sql and review on staging first.
create or replace function public.confirm_receipt(
  p_ma_phieu_nhap integer,
  p_nguoi_xac_nhan varchar,
  p_ma_kho_duoc_phep integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt_row record;
  line_row record;
  actor_exists boolean;
  quantity integer;
begin
  perform set_config('phub.stock_operation', 'NHAP_KHO', true);
  perform set_config('phub.stock_reference', p_ma_phieu_nhap::varchar, true);
  perform set_config('phub.stock_actor', p_nguoi_xac_nhan, true);
  select * into receipt_row
  from public."PHIEU_NHAP"
  where ma_phieu_nhap = p_ma_phieu_nhap
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RECEIPT_NOT_FOUND';
  end if;

  if p_ma_kho_duoc_phep is not null and receipt_row.ma_kho <> p_ma_kho_duoc_phep then
    raise exception using errcode = 'P0004', message = 'WAREHOUSE_ACCESS_DENIED';
  end if;

  if receipt_row.trang_thai <> 'NHAP' then
    raise exception using errcode = 'P0003', message = 'RECEIPT_NOT_CONFIRMABLE';
  end if;

  select exists(
    select 1 from public."NHAN_VIEN"
    where ma_nhan_vien = p_nguoi_xac_nhan and trang_thai = 1
  ) into actor_exists;
  if not actor_exists then
    raise exception using errcode = 'P0005', message = 'CONFIRMING_EMPLOYEE_NOT_FOUND';
  end if;

  if not exists (select 1 from public."CT_PHIEU_NHAP" where ma_phieu_nhap = p_ma_phieu_nhap) then
    raise exception using errcode = 'P0006', message = 'RECEIPT_HAS_NO_LINES';
  end if;

  for line_row in
    select sku, so_luong_nhap
    from public."CT_PHIEU_NHAP"
    where ma_phieu_nhap = p_ma_phieu_nhap
    order by sku
  loop
    if line_row.so_luong_nhap <= 0 then
      raise exception using errcode = 'P0007', message = 'INVALID_RECEIPT_QUANTITY';
    end if;

    -- Create the stock row if needed, then lock the row before incrementing it.
    insert into public."TON_KHO" (ma_kho, sku, so_luong_ton, cap_nhat_luc)
    values (receipt_row.ma_kho, line_row.sku, 0, now())
    on conflict (ma_kho, sku) do nothing;

    select so_luong_ton into quantity
    from public."TON_KHO"
    where ma_kho = receipt_row.ma_kho and sku = line_row.sku
    for update;

    update public."TON_KHO"
    set so_luong_ton = quantity + line_row.so_luong_nhap, cap_nhat_luc = now()
    where ma_kho = receipt_row.ma_kho and sku = line_row.sku;
  end loop;

  update public."PHIEU_NHAP"
  set trang_thai = 'DA_NHAP', ngay_nhap = coalesce(ngay_nhap, now()),
      nguoi_xac_nhan = p_nguoi_xac_nhan, nguoi_cap_nhat = p_nguoi_xac_nhan
  where ma_phieu_nhap = p_ma_phieu_nhap;

  return jsonb_build_object(
    'ma_phieu_nhap', receipt_row.ma_phieu_nhap,
    'ma_phieu_code', receipt_row.ma_phieu_code,
    'ma_kho', receipt_row.ma_kho,
    'trang_thai', 'DA_NHAP',
    'nguoi_xac_nhan', p_nguoi_xac_nhan
  );
end;
$$;

revoke all on function public.confirm_receipt(integer, varchar, integer) from public, anon, authenticated;
grant execute on function public.confirm_receipt(integer, varchar, integer) to service_role;
