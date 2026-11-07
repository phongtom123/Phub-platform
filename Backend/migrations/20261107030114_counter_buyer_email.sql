-- Store the buyer email on each new counter order, including walk-in orders.
-- Historical orders stay nullable; do not invent email addresses or link by email alone.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public."DON_HANG" add column if not exists email_nguoi_mua varchar(254);

create or replace function public.staff_counter_customer_email_v1(p_actor text,p_email text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; normalized_email text:=lower(btrim(coalesce(p_email,'')));
begin
 perform admin_ops.staff_actor(p_actor);
 if length(normalized_email)>254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
  raise exception 'BUYER_EMAIL_INVALID'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
  select k.ma_kh,k.ten_kh,k.sdt,a.ten_tai_khoan,a.email
  from public."TAI_KHOAN" a join public."KHACH_HANG" k using(ma_kh)
  where lower(a.email)=normalized_email and a.trang_thai=1 and a.ma_nhan_vien is null and k.luu_tru_luc is null
  order by a.ma_tk limit 2
 ) x;
 if jsonb_array_length(result)>1 then raise exception 'BUYER_EMAIL_AMBIGUOUS'; end if;
 return jsonb_build_object('data',result);
end $$;
revoke all on function public.staff_counter_customer_email_v1(text,text) from public,anon,authenticated;
grant execute on function public.staff_counter_customer_email_v1(text,text) to service_role;

do $upgrade$
declare source text; old_guard text; old_insert text; new_guard text; new_insert text;
begin
 source:=replace(pg_get_functiondef('public.admin_operation_v1(text,text,text,uuid,text,jsonb)'::regprocedure),E'\r\n',E'\n');
 old_guard:=$old$elsif p_resource='orders' then
  if p_action='create' then$old$;
 new_guard:=$new$elsif p_resource='orders' then
  if p_action='create' then
   if length(coalesce(body->>'buyer_email',''))>254 or lower(btrim(coalesce(body->>'buyer_email',''))) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'BUYER_EMAIL_INVALID'; end if;
   if body->>'customer_id' is not null then
    perform 1 from public."TAI_KHOAN" a join public."KHACH_HANG" k using(ma_kh)
     where k.ma_kh=body->>'customer_id' and lower(a.email)=lower(btrim(body->>'buyer_email'))
       and a.trang_thai=1 and a.ma_nhan_vien is null and k.luu_tru_luc is null for share of a,k;
    if not found then raise exception 'BUYER_EMAIL_MISMATCH'; end if;
   end if;$new$;
 old_insert:=$old$insert into public."DON_HANG"(ma_donhang,ma_kh,ma_nhan_vien,kenh_ban,trang_thai,thoi_gian_dat,ten_nguoi_nhan,sdt_nguoi_nhan,ghi_chu)
   values(order_id,body->>'customer_id',employee,'TAI_QUAY','MOI',created,body->>'recipient',body->>'phone',body->>'note');$old$;
 new_insert:=$new$insert into public."DON_HANG"(ma_donhang,ma_kh,ma_nhan_vien,kenh_ban,trang_thai,thoi_gian_dat,ten_nguoi_nhan,sdt_nguoi_nhan,email_nguoi_mua,ghi_chu)
   values(order_id,body->>'customer_id',employee,'TAI_QUAY','MOI',created,body->>'recipient',body->>'phone',lower(btrim(body->>'buyer_email')),body->>'note');$new$;
 if strpos(source,old_guard)=0 or strpos(source,old_insert)=0 then
  raise exception 'Unexpected counter order implementation; no changes were applied'; end if;
 execute replace(replace(source,old_guard,new_guard),old_insert,new_insert);
end $upgrade$;

-- New clients call this entrypoint so an old database cannot silently drop email.
create or replace function public.staff_counter_order_email_v1(p_actor text,p_key uuid,p_body jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform admin_ops.staff_actor(p_actor);
 result:=public.admin_operation_v1(p_actor,'orders','create',p_key,null,p_body);
 if result#>>'{data,0,email_nguoi_mua}' is distinct from lower(btrim(p_body->>'buyer_email'))
   or nullif(result#>>'{data,0,email_nguoi_mua}','') is null then
  raise exception 'BUYER_EMAIL_NOT_SAVED'; end if;
 return result;
end $$;
revoke all on function public.staff_counter_order_email_v1(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.staff_counter_order_email_v1(text,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
