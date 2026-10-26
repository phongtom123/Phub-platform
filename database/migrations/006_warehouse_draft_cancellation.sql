-- Cancel draft warehouse documents without changing stock.
-- Apply after migration 005.

create or replace function public.cancel_receipt_draft(
  p_ma_phieu_nhap integer,
  p_nguoi_huy varchar,
  p_ma_kho_duoc_phep integer default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare receipt_row record;
begin
  select * into receipt_row from public."PHIEU_NHAP"
  where "ma_phieu_nhap" = p_ma_phieu_nhap for update;
  if not found then raise exception using errcode = 'P0030', message = 'RECEIPT_NOT_FOUND'; end if;
  if p_ma_kho_duoc_phep is not null and receipt_row."ma_kho" <> p_ma_kho_duoc_phep then
    raise exception using errcode = 'P0031', message = 'WAREHOUSE_ACCESS_DENIED';
  end if;
  if receipt_row."trang_thai" <> 'NHAP' then
    raise exception using errcode = 'P0032', message = 'RECEIPT_NOT_CANCELLABLE';
  end if;
  if not exists (select 1 from public."NHAN_VIEN" where "ma_nhan_vien" = p_nguoi_huy and "trang_thai" = 1) then
    raise exception using errcode = 'P0033', message = 'CANCELLING_EMPLOYEE_NOT_FOUND';
  end if;
  update public."PHIEU_NHAP" set "trang_thai" = 'HUY', "nguoi_cap_nhat" = p_nguoi_huy
  where "ma_phieu_nhap" = p_ma_phieu_nhap;
  return jsonb_build_object('ma_phieu_nhap', p_ma_phieu_nhap, 'ma_phieu_code', receipt_row."ma_phieu_code", 'ma_kho', receipt_row."ma_kho", 'trang_thai', 'HUY', 'nguoi_thuc_hien', p_nguoi_huy);
end; $$;

create or replace function public.cancel_transfer_draft(
  p_ma_phieu_chuyen integer,
  p_nguoi_huy varchar,
  p_ma_kho_duoc_phep integer default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare transfer_row record;
begin
  select * into transfer_row from public."PHIEU_CHUYEN_KHO"
  where "ma_phieu_chuyen" = p_ma_phieu_chuyen for update;
  if not found then raise exception using errcode = 'P0034', message = 'TRANSFER_NOT_FOUND'; end if;
  if p_ma_kho_duoc_phep is not null and transfer_row."ma_kho_xuat" <> p_ma_kho_duoc_phep then
    raise exception using errcode = 'P0031', message = 'WAREHOUSE_ACCESS_DENIED';
  end if;
  if transfer_row."trang_thai" <> 'NHAP' then
    raise exception using errcode = 'P0035', message = 'TRANSFER_NOT_CANCELLABLE';
  end if;
  if not exists (select 1 from public."NHAN_VIEN" where "ma_nhan_vien" = p_nguoi_huy and "trang_thai" = 1) then
    raise exception using errcode = 'P0036', message = 'CANCELLING_EMPLOYEE_NOT_FOUND';
  end if;
  update public."PHIEU_CHUYEN_KHO" set "trang_thai" = 'HUY', "ghi_chu" = concat_ws(' | ', nullif("ghi_chu", ''), 'Hủy bởi ' || p_nguoi_huy)
  where "ma_phieu_chuyen" = p_ma_phieu_chuyen;
  return jsonb_build_object('ma_phieu_chuyen', p_ma_phieu_chuyen, 'trang_thai', 'HUY', 'nguoi_thuc_hien', p_nguoi_huy);
end; $$;

revoke all on function public.cancel_receipt_draft(integer, varchar, integer) from public, anon, authenticated;
revoke all on function public.cancel_transfer_draft(integer, varchar, integer) from public, anon, authenticated;
grant execute on function public.cancel_receipt_draft(integer, varchar, integer) to service_role;
grant execute on function public.cancel_transfer_draft(integer, varchar, integer) to service_role;
