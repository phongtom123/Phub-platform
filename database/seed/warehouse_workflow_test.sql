-- Non-destructive workflow test.
-- It confirms a receipt, dispatches a transfer and receives it, then rolls back.
-- Run after warehouse_demo.sql and migration 004.

\set ON_ERROR_STOP on
begin;

do $$
declare
  receipt_id integer;
  supplier_id integer;
  source_warehouse integer;
  destination_warehouse integer;
  transfer_id integer;
begin
  select "ma_ncc" into supplier_id
  from public."NHA_CUNG_CAP" where "ten_ncc" = 'Nha cung cap Demo';
  select "ma_kho" into source_warehouse
  from public."KHO" where "ten_kho" = 'Kho Demo Ha Noi';
  select "ma_kho" into destination_warehouse
  from public."KHO"
  where "ten_kho" = 'Kho Demo Da Nang';

  select (public.create_receipt_draft(
    supplier_id,
    source_warehouse,
    'NV-DEMO-HN',
    'Receipt draft transaction test',
    jsonb_build_array(jsonb_build_object('sku', 'SKU-DEMO-001', 'quantity', 100, 'unit_price', 70000))
  )->>'ma_phieu_nhap')::integer into receipt_id;

  perform public.confirm_receipt(receipt_id, 'NV-DEMO-HN', source_warehouse);

  select (public.create_transfer_draft(
    source_warehouse,
    destination_warehouse,
    'NV-DEMO-HN',
    'Transfer draft transaction test',
    jsonb_build_array(jsonb_build_object('sku', 'SKU-DEMO-001', 'quantity', 10))
  )->>'ma_phieu_chuyen')::integer into transfer_id;

  perform public.dispatch_transfer(transfer_id, 'NV-DEMO-HN', source_warehouse);
  perform public.receive_transfer(transfer_id, 'NV-DEMO-DN', destination_warehouse);

  raise notice 'Workflow test passed: receipt %, transfer %', receipt_id, transfer_id;
end;
$$;

rollback;

select 'Workflow test passed and rolled back' as result;
