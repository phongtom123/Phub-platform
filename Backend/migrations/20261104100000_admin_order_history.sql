-- Read-only, service-only projection of successful Admin order commands.
-- Existing command results remain private; the UI receives only timeline fields.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.admin_order_history_v1(p_actor text, p_order_id text)
returns jsonb
language plpgsql volatile security invoker
set search_path = ''
set timezone = 'UTC'
as $$
declare
  item_count bigint;
  result jsonb;
begin
  perform admin_ops.actor(p_actor);
  if p_order_id is null or btrim(p_order_id) = '' then
    raise exception 'VALIDATION_ERROR';
  end if;

  select count(*) into item_count
  from admin_ops.requests r
  where r.resource = 'orders' and r.record_id = p_order_id and r.result is not null;
  if item_count > 100000 then
    raise exception 'TOO_MANY_RESULTS';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', r.key::text,
    'actor_id', r.actor,
    'actor_name', coalesce(nullif(btrim(n.ho_ten), ''), nullif(btrim(a.ten_tai_khoan), ''), r.actor),
    'occurred_at', r.created_at,
    'action', r.action,
    'to_status', r.result #>> '{data,0,trang_thai}'
  ) order by r.created_at, r.key), '[]'::jsonb) into result
  from admin_ops.requests r
  left join public."TAI_KHOAN" a on a.ma_tk = r.actor
  left join public."NHAN_VIEN" n on n.ma_nhan_vien = a.ma_nhan_vien
  where r.resource = 'orders' and r.record_id = p_order_id and r.result is not null;

  return result;
end
$$;

revoke all on function public.admin_order_history_v1(text, text) from public, anon, authenticated;
grant execute on function public.admin_order_history_v1(text, text) to service_role;
commit;
