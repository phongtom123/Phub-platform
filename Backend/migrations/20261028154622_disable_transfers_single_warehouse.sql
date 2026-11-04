-- Single-warehouse operation: retain historical transfer documents, reject new mutations.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  definition text;
  anchor text := ' employee:=admin_ops.actor(p_actor);';
  guard text := ' if p_resource=''transfers'' then raise exception ''TRANSFER_DISABLED''; end if;';
begin
  select pg_get_functiondef('public.admin_operation_v1(text,text,text,uuid,text,jsonb)'::regprocedure)
    into definition;
  if strpos(definition, guard) = 0 then
    if strpos(definition, anchor) = 0 then
      raise exception 'Unexpected admin_operation_v1 definition; transfer guard was not applied';
    end if;
    execute replace(definition, anchor, anchor || E'\n' || guard);
  end if;
end
$migration$;

notify pgrst, 'reload schema';
commit;
