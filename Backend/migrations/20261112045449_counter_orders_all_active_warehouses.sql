-- Staff counter sales may use stock in any active warehouse.
-- Preserve staff-only authorization, buyer/email validation, stock checks,
-- row locks, pricing, invoice rules and idempotent transactions.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $upgrade$
declare
  definition text;
  old_guard text := $guard$ if exists(select 1 from public."NHAN_VIEN" where ma_nhan_vien=employee and loai_nhan_vien='NHAN_VIEN') and
   exists(select 1 from jsonb_array_elements(lines) x where (x->>'warehouse_id')::int is distinct from
     (select ma_kho from public."NHAN_VIEN" where ma_nhan_vien=employee)) then
   raise exception 'Chỉ được bán hàng từ kho được phân công.' using errcode='42501'; end if;$guard$;
begin
  definition := replace(pg_get_functiondef('public.admin_operation_v1(text,text,text,uuid,text,jsonb)'::regprocedure), E'\r\n', E'\n');
  if strpos(definition, 'Chỉ được bán hàng từ kho được phân công.') > 0 then
    if strpos(definition, old_guard) = 0 then
      raise exception 'Unexpected counter warehouse guard; no changes applied';
    end if;
    execute replace(definition, old_guard, '');
  elsif strpos(definition, 'employee:=admin_ops.counter_actor(p_actor);') = 0 then
    raise exception 'Unexpected counter actor guard; no changes applied';
  end if;
end $upgrade$;

-- The dedicated counter screen must offer the same warehouse scope as writes.
do $catalog$
declare
  definition text;
  old_filter text := 'and (wh is null or t.ma_kho=wh)';
begin
  definition := pg_get_functiondef('public.staff_counter_catalog_v1(text,text,text)'::regprocedure);
  if strpos(definition, old_filter) > 0 then
    execute replace(definition, old_filter, '');
  elsif strpos(definition, 'k.trang_thai=1') = 0 then
    raise exception 'Unexpected counter catalog warehouse filter; no changes applied';
  end if;
end $catalog$;

notify pgrst, 'reload schema';
commit;
