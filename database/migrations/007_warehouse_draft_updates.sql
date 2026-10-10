-- Update draft warehouse documents and replace their lines atomically.
-- Apply after migration 006.

create or replace function public.update_receipt_draft(
  p_ma_phieu_nhap integer,
  p_ma_ncc integer,
  p_ma_kho integer,
  p_nguoi_cap_nhat varchar,
  p_ghi_chu text,
  p_lines jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare receipt_row record; line_row record;
begin
  select * into receipt_row from public."PHIEU_NHAP" where "ma_phieu_nhap" = p_ma_phieu_nhap for update;
  if not found then raise exception using errcode = 'P0040', message = 'RECEIPT_NOT_FOUND'; end if;
  if receipt_row."trang_thai" <> 'NHAP' then raise exception using errcode = 'P0041', message = 'RECEIPT_NOT_EDITABLE'; end if;
  if not exists (select 1 from public."NHA_CUNG_CAP" where "ma_ncc" = p_ma_ncc and "trang_thai" = 1) then raise exception using errcode = 'P0042', message = 'SUPPLIER_NOT_FOUND'; end if;
  if not exists (select 1 from public."KHO" where "ma_kho" = p_ma_kho and "trang_thai" = 1) then raise exception using errcode = 'P0043', message = 'WAREHOUSE_NOT_FOUND'; end if;
  if not exists (select 1 from public."NHAN_VIEN" where "ma_nhan_vien" = p_nguoi_cap_nhat and "trang_thai" = 1) then raise exception using errcode = 'P0044', message = 'EDITOR_NOT_FOUND'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception using errcode = 'P0045', message = 'RECEIPT_HAS_NO_LINES'; end if;
  update public."PHIEU_NHAP" set "ma_ncc" = p_ma_ncc, "ma_kho" = p_ma_kho, "ghi_chu" = p_ghi_chu, "nguoi_cap_nhat" = p_nguoi_cap_nhat where "ma_phieu_nhap" = p_ma_phieu_nhap;
  delete from public."CT_PHIEU_NHAP" where "ma_phieu_nhap" = p_ma_phieu_nhap;
  for line_row in select * from jsonb_to_recordset(p_lines) as x(sku varchar, quantity integer, unit_price numeric) loop
    if line_row.quantity is null or line_row.quantity <= 0 or line_row.unit_price is null or line_row.unit_price < 0 then raise exception using errcode = 'P0046', message = 'INVALID_RECEIPT_LINE'; end if;
    insert into public."CT_PHIEU_NHAP" ("ma_phieu_nhap", "sku", "so_luong_nhap", "gia_nhap") values (p_ma_phieu_nhap, line_row.sku, line_row.quantity, line_row.unit_price);
  end loop;
  return jsonb_build_object('ma_phieu_nhap', p_ma_phieu_nhap, 'ma_phieu_code', receipt_row."ma_phieu_code", 'trang_thai', 'NHAP');
end; $$;

create or replace function public.update_transfer_draft(
  p_ma_phieu_chuyen integer,
  p_ma_kho_xuat integer,
  p_ma_kho_nhan integer,
  p_nguoi_cap_nhat varchar,
  p_ghi_chu text,
  p_lines jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare transfer_row record; line_row record;
begin
  select * into transfer_row from public."PHIEU_CHUYEN_KHO" where "ma_phieu_chuyen" = p_ma_phieu_chuyen for update;
  if not found then raise exception using errcode = 'P0047', message = 'TRANSFER_NOT_FOUND'; end if;
  if transfer_row."trang_thai" <> 'NHAP' then raise exception using errcode = 'P0048', message = 'TRANSFER_NOT_EDITABLE'; end if;
  if p_ma_kho_xuat = p_ma_kho_nhan then raise exception using errcode = 'P0049', message = 'SAME_TRANSFER_WAREHOUSE'; end if;
  if (select count(*) from public."KHO" where "ma_kho" in (p_ma_kho_xuat, p_ma_kho_nhan) and "trang_thai" = 1) <> 2 then raise exception using errcode = 'P0043', message = 'WAREHOUSE_NOT_FOUND'; end if;
  if not exists (select 1 from public."NHAN_VIEN" where "ma_nhan_vien" = p_nguoi_cap_nhat and "trang_thai" = 1) then raise exception using errcode = 'P0044', message = 'EDITOR_NOT_FOUND'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception using errcode = 'P0050', message = 'TRANSFER_HAS_NO_LINES'; end if;
  update public."PHIEU_CHUYEN_KHO" set "ma_kho_xuat" = p_ma_kho_xuat, "ma_kho_nhan" = p_ma_kho_nhan, "ghi_chu" = p_ghi_chu where "ma_phieu_chuyen" = p_ma_phieu_chuyen;
  delete from public."CT_CHUYEN_KHO" where "ma_phieu_chuyen" = p_ma_phieu_chuyen;
  for line_row in select * from jsonb_to_recordset(p_lines) as x(sku varchar, quantity integer) loop
    if line_row.quantity is null or line_row.quantity <= 0 then raise exception using errcode = 'P0051', message = 'INVALID_TRANSFER_LINE'; end if;
    insert into public."CT_CHUYEN_KHO" ("ma_phieu_chuyen", "sku", "so_luong") values (p_ma_phieu_chuyen, line_row.sku, line_row.quantity);
  end loop;
  return jsonb_build_object('ma_phieu_chuyen', p_ma_phieu_chuyen, 'trang_thai', 'NHAP');
end; $$;

revoke all on function public.update_receipt_draft(integer, integer, integer, varchar, text, jsonb) from public, anon, authenticated;
revoke all on function public.update_transfer_draft(integer, integer, integer, varchar, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_receipt_draft(integer, integer, integer, varchar, text, jsonb) to service_role;
grant execute on function public.update_transfer_draft(integer, integer, integer, varchar, text, jsonb) to service_role;
