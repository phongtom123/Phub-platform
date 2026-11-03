-- Remove the arbitrary 1,000-unit checkout cap. A sold line still uses PostgreSQL
-- integer quantity; real stock and the existing atomic allocation checks decide
-- whether a request can be fulfilled. No orders, stock or invoices are rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $upgrade$
declare
  definition text;
  digit_check text := $anchor$coalesce(v_item->>'quantity','') !~ '^[0-9]{1,4}$'$anchor$;
  range_check text := $anchor$(v_item->>'quantity')::integer NOT BETWEEN 1 AND 1000$anchor$;
begin
  select pg_get_functiondef(
    'public.customer_checkout_v2(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)'::regprocedure
  ) into definition;
  if strpos(definition,digit_check)=0 or strpos(definition,range_check)=0 then
    raise exception 'Unexpected checkout quantity validation; no changes applied';
  end if;
  definition := replace(definition,digit_check,
    $replacement$coalesce(v_item->>'quantity','') !~ '^[0-9]{1,10}$'$replacement$);
  definition := replace(definition,range_check,
    $replacement$(v_item->>'quantity')::numeric NOT BETWEEN 1 AND 2147483647$replacement$);
  execute definition;
end $upgrade$;
notify pgrst,'reload schema';
commit;
