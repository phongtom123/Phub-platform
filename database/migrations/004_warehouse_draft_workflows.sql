-- Atomic creation of warehouse draft documents and their lines.
-- Apply after 003_transfer_workflow.sql.

create or replace function public.create_receipt_draft(
  p_ma_ncc integer,
  p_ma_kho integer,
  p_nguoi_tao varchar,
  p_ghi_chu text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt_id integer;
  receipt_code varchar;
  line_row record;
begin
  if not exists (select 1 from public."NHA_CUNG_CAP" where "ma_ncc" = p_ma_ncc and "trang_thai" = 1) then
    raise exception using errcode = 'P0020', message = 'SUPPLIER_NOT_FOUND';
  end if;
  if not exists (select 1 from public."KHO" where "ma_kho" = p_ma_kho and "trang_thai" = 1) then
    raise exception using errcode = 'P0021', message = 'WAREHOUSE_NOT_FOUND';
  end if;
  if not exists (select 1 from public."NHAN_VIEN" where "ma_nhan_vien" = p_nguoi_tao and "trang_thai" = 1) then
    raise exception using errcode = 'P0022', message = 'CREATOR_NOT_FOUND';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = 'P0023', message = 'RECEIPT_HAS_NO_LINES';
  end if;

  receipt_code := 'PN-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || floor(random() * 1000)::int;
  insert into public."PHIEU_NHAP"
    ("ma_phieu_code", "ma_ncc", "ma_kho", "ngay_tao", "trang_thai", "nguoi_tao", "ghi_chu")
  values (receipt_code, p_ma_ncc, p_ma_kho, now(), 'NHAP', p_nguoi_tao, p_ghi_chu)
  returning "ma_phieu_nhap" into receipt_id;

  for line_row in select * from jsonb_to_recordset(p_lines) as x(sku varchar, quantity integer, unit_price numeric) loop
    if line_row.quantity is null or line_row.quantity <= 0 or line_row.unit_price is null or line_row.unit_price < 0 then
      raise exception using errcode = 'P0024', message = 'INVALID_RECEIPT_LINE';
    end if;
    insert into public."CT_PHIEU_NHAP" ("ma_phieu_nhap", "sku", "so_luong_nhap", "gia_nhap")
    values (receipt_id, line_row.sku, line_row.quantity, line_row.unit_price);
  end loop;

  return jsonb_build_object('ma_phieu_nhap', receipt_id, 'ma_phieu_code', receipt_code, 'trang_thai', 'NHAP');
end;
$$;

create or replace function public.create_transfer_draft(
  p_ma_kho_xuat integer,
  p_ma_kho_nhan integer,
  p_nguoi_tao varchar,
  p_ghi_chu text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_id integer;
  line_row record;
begin
  if p_ma_kho_xuat = p_ma_kho_nhan then
    raise exception using errcode = 'P0025', message = 'SAME_TRANSFER_WAREHOUSE';
  end if;
  if (select count(*) from public."KHO" where "ma_kho" in (p_ma_kho_xuat, p_ma_kho_nhan) and "trang_thai" = 1) <> 2 then
    raise exception using errcode = 'P0021', message = 'WAREHOUSE_NOT_FOUND';
  end if;
  if not exists (select 1 from public."NHAN_VIEN" where "ma_nhan_vien" = p_nguoi_tao and "trang_thai" = 1) then
    raise exception using errcode = 'P0022', message = 'CREATOR_NOT_FOUND';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = 'P0026', message = 'TRANSFER_HAS_NO_LINES';
  end if;

  insert into public."PHIEU_CHUYEN_KHO"
    ("ma_kho_xuat", "ma_kho_nhan", "ngay_tao", "trang_thai", "nguoi_tao", "ghi_chu")
  values (p_ma_kho_xuat, p_ma_kho_nhan, now(), 'NHAP', p_nguoi_tao, p_ghi_chu)
  returning "ma_phieu_chuyen" into transfer_id;

  for line_row in select * from jsonb_to_recordset(p_lines) as x(sku varchar, quantity integer) loop
    if line_row.quantity is null or line_row.quantity <= 0 then
      raise exception using errcode = 'P0027', message = 'INVALID_TRANSFER_LINE';
    end if;
    insert into public."CT_CHUYEN_KHO" ("ma_phieu_chuyen", "sku", "so_luong")
    values (transfer_id, line_row.sku, line_row.quantity);
  end loop;

  return jsonb_build_object('ma_phieu_chuyen', transfer_id, 'trang_thai', 'NHAP');
end;
$$;

revoke all on function public.create_receipt_draft(integer, integer, varchar, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_transfer_draft(integer, integer, varchar, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_receipt_draft(integer, integer, varchar, text, jsonb) to service_role;
grant execute on function public.create_transfer_draft(integer, integer, varchar, text, jsonb) to service_role;
