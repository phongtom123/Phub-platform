-- Keep existing deployed API models working: v2 is unchanged, v3 adds metadata.
begin;
set local lock_timeout='5s';
alter function public.customer_read_orders_v2(text,text,integer,integer,text) rename to customer_read_orders_v3;
alter function public.customer_read_orders_v2_before_deadline(text,text,integer,integer,text) rename to customer_read_orders_v2;
do $$ declare definition text; begin
 select pg_get_functiondef('public.customer_read_orders_v3(text,text,integer,integer,text)'::regprocedure) into definition;
 execute replace(definition,'public.customer_read_orders_v2_before_deadline(', 'public.customer_read_orders_v2(');
end $$;
revoke all on function public.customer_read_orders_v3(text,text,integer,integer,text) from public,anon,authenticated;
grant execute on function public.customer_read_orders_v3(text,text,integer,integer,text) to service_role;
notify pgrst,'reload schema';
commit;
