-- Reopen every warehouse. Warehouse status and employee ownership still apply.
-- No stock, document, employee assignment or warehouse status is rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

drop trigger if exists fixed_warehouse on public."KHO";
drop trigger if exists fixed_warehouse on public."NHAN_VIEN";
drop trigger if exists fixed_warehouse on public."TON_KHO";
drop trigger if exists fixed_warehouse on public."PHIEU_NHAP";
drop trigger if exists fixed_warehouse on public."CT_PHIEU_NHAP";
drop trigger if exists fixed_warehouse on public."DON_HANG";
drop trigger if exists fixed_warehouse on public."CT_DON_HANG";
drop trigger if exists fixed_warehouse on public."HOA_DON";
drop trigger if exists fixed_warehouse on public."THANH_TOAN";

-- Preserve function signatures, ACLs, stock locks and ownership checks. Stop
-- atomically if the prior installation differs from the expected migration.
do $upgrade$
declare definition text; target regprocedure; anchor text;
begin
  foreach target in array array[
    'admin_ops.warehouse_actor(text)'::regprocedure,
    'admin_ops.pricing_actor(text)'::regprocedure
  ] loop
    select pg_get_functiondef(target) into definition;
    anchor := ' and w.ma_kho=admin_ops.operating_warehouse_id()';
    if strpos(definition, anchor) = 0 then
      raise exception 'Unexpected warehouse actor definition: %', target;
    end if;
    execute replace(definition, anchor, '');
  end loop;

  target := 'public.customer_checkout_v2(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)'::regprocedure;
  select pg_get_functiondef(target) into definition;
  anchor := ' AND t.ma_kho=admin_ops.operating_warehouse_id()';
  if strpos(definition, anchor) = 0 then
    raise exception 'Unexpected checkout warehouse allocation';
  end if;
  execute replace(definition, anchor, '');
end $upgrade$;

-- Transfers remain retired by the owner's earlier request. Keep their two
-- existing triggers, with no remaining single-warehouse logic in this helper.
create or replace function admin_ops.single_warehouse_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'TRANSFER_DISABLED';
end $$;

-- operating_warehouse_id() is retained only for the explicitly labelled
-- warehouse-2 business report. It no longer controls inventory or transactions.
notify pgrst, 'reload schema';
commit;
