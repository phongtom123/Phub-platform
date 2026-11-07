-- Move operational use cases to NHAN_VIEN. Reports and account management remain
-- ADMIN-only. Existing business transactions, customer ownership and ledger are preserved.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create or replace function admin_ops.staff_actor(p_actor text) returns text
language plpgsql security invoker set search_path='' as $$
declare employee text;
begin
 select n.ma_nhan_vien into employee from public."TAI_KHOAN" a
 join public."NHAN_VIEN" n using(ma_nhan_vien)
 where a.ma_tk=p_actor and a.trang_thai=1 and a.ma_kh is null
   and n.trang_thai=1 and n.loai_nhan_vien='NHAN_VIEN' for share of a,n;
 if employee is null then raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
 return employee;
end $$;
revoke all on function admin_ops.staff_actor(text) from public,anon,authenticated;
grant execute on function admin_ops.staff_actor(text) to service_role;

create or replace function admin_ops.warehouse_actor(p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare employee text; warehouse int;
begin
 employee:=admin_ops.staff_actor(p_actor);
 select ma_kho into warehouse from public."NHAN_VIEN" where ma_nhan_vien=employee;
 return jsonb_build_object('employee',employee,'warehouse',warehouse,'role','NHAN_VIEN');
end $$;
create or replace function admin_ops.pricing_actor(actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin return admin_ops.warehouse_actor(actor); end $$;
revoke all on function admin_ops.warehouse_actor(text),admin_ops.pricing_actor(text) from public,anon,authenticated;
grant execute on function admin_ops.warehouse_actor(text),admin_ops.pricing_actor(text) to service_role;

-- Checked source transformations are used by the existing migration chain too.
-- They change authorization without replacing transaction logic from newer migrations.
create function pg_temp.patch_internal(signature text, before_text text, after_text text)
returns void language plpgsql as $$
declare source text;
begin
 source:=pg_get_functiondef(signature::regprocedure);
 if strpos(source,before_text)=0 then raise exception 'Unexpected function definition: %',signature; end if;
 execute replace(source,before_text,after_text);
end $$;
create function pg_temp.guard_internal(signature text, guard_sql text)
returns void language plpgsql as $$
declare source text; changed text;
begin
 source:=pg_get_functiondef(signature::regprocedure);
 changed:=regexp_replace(source,'\mBEGIN\M',E'BEGIN\n '||guard_sql,'i');
 if changed=source then raise exception 'Expected PL/pgSQL function: %',signature; end if;
 execute changed;
end $$;

select pg_temp.patch_internal('public.admin_operation_v1(text,text,text,uuid,text,jsonb)',
 'admin_ops.actor(p_actor)','admin_ops.staff_actor(p_actor)');
select pg_temp.guard_internal('public.admin_operation_v1(text,text,text,uuid,text,jsonb)',
 'perform admin_ops.staff_actor(p_actor);');
select pg_temp.patch_internal('public.admin_operation_v1(text,text,text,uuid,text,jsonb)',
 'loai_nhan_vien=''ADMIN''','loai_nhan_vien=''NHAN_VIEN''');
select pg_temp.patch_internal('public.admin_read_v1(text,text,jsonb)',
 'perform admin_ops.actor(p_actor);',
 'if p_kind=''summary'' then perform admin_ops.actor(p_actor); else perform admin_ops.staff_actor(p_actor); end if;');
select pg_temp.patch_internal('public.admin_order_history_v1(text,text)',
 'admin_ops.actor(p_actor)','admin_ops.staff_actor(p_actor)');

-- Customer profile and support writes retain their existing atomic implementation.
select pg_temp.patch_internal('public.admin_update_customer_profile_v2(text,text,jsonb)',
 'loai_nhan_vien=''ADMIN''','loai_nhan_vien=''NHAN_VIEN''');
select pg_temp.patch_internal('public.admin_archive_customer_v1(text,text,boolean)',
 'loai_nhan_vien=''ADMIN''','loai_nhan_vien=''NHAN_VIEN''');
select pg_temp.patch_internal('public.admin_update_feedback_v1(text,uuid,jsonb)',
 'loai_nhan_vien=''ADMIN''','loai_nhan_vien=''NHAN_VIEN''');
select pg_temp.patch_internal('public.admin_update_feedback_thread_v1(text,uuid,jsonb)',
 'admin_ops.actor(p_actor_account_id)','admin_ops.staff_actor(p_actor_account_id)');
select pg_temp.patch_internal('admin_ops.counter_actor(text)',
 'n.loai_nhan_vien in(''ADMIN'',''NHAN_VIEN'')','n.loai_nhan_vien=''NHAN_VIEN''');

-- CRM read RPCs share a helper, but the report/write entrypoints get separate guards.
select pg_temp.patch_internal('public.crm_actor_v1(text,boolean)',
 'loai_nhan_vien=''ADMIN''','loai_nhan_vien in(''ADMIN'',''NHAN_VIEN'')');
select pg_temp.guard_internal('public.crm_survey_write_v1(text,uuid,text,jsonb,uuid)',
 'perform admin_ops.staff_actor(p_actor);');
select pg_temp.guard_internal('public.crm_review_moderate_v1(text,uuid,text,uuid)',
 'perform admin_ops.staff_actor(p_actor);');
select pg_temp.guard_internal('public.crm_review_read_v1(text,text,text,text,integer)',
 'if p_kind=''admin'' then perform admin_ops.staff_actor(p_actor); end if;');
select pg_temp.guard_internal('public.crm_survey_read_v1(text,boolean,text,uuid,integer)',
 'if p_admin and p_kind in(''report'',''statistics'') then perform admin_ops.actor(p_actor); elsif p_admin and p_kind=''preview'' then perform admin_ops.staff_actor(p_actor); end if;');

-- Receipt price editing moves with the operational portal. ADMIN/WAREHOUSE here
-- are legacy response shapes, not authorization roles.
select pg_temp.patch_internal('public.pricing_context_v1(text,text)',
 'who->>''role''=''ADMIN''','who->>''role''=''NHAN_VIEN''');
select pg_temp.patch_internal('public.receipt_pricing_preview_v1(text,integer)',
 'who->>''role''=''ADMIN''','who->>''role''=''NHAN_VIEN''');
select pg_temp.patch_internal('public.priced_receipt_v1(text,text,text,uuid,integer,jsonb)',
 'p_portal=''ADMIN'' and who->>''role''<>''ADMIN''','p_portal=''ADMIN'' and who->>''role''<>''NHAN_VIEN''');
select pg_temp.patch_internal('public.priced_receipt_v1(text,text,text,uuid,integer,jsonb)',
 '(p_portal=''ADMIN'' or p.ma_kho=(who->>''warehouse'')::int)','(who->>''role''=''NHAN_VIEN'')');
select pg_temp.patch_internal('public.warehouse_receipt_v1(text,text,uuid,integer,jsonb)',
 'wh:=(who->>''warehouse'')::int;',
 'wh:=(who->>''warehouse'')::int; if p_action<>''create'' then select ma_kho into wh from public."PHIEU_NHAP" where ma_phieu_nhap=p_id; end if;');

-- Warehouse reads have no assignment filter. Do not replace employee assignment
-- with a default warehouse and silently restrict receipts/history again.
create or replace function public.warehouse_read_v1(p_actor text,p_kind text,p_query jsonb) returns jsonb
language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare result jsonb; skip int; size int; term text;
begin
 perform admin_ops.staff_actor(p_actor);
 size:=coalesce((p_query->>'page_size')::int,20); skip:=(coalesce((p_query->>'page')::int,1)-1)*size;
 if size not between 1 and 100 or skip<0 or skip>1000000 then raise exception 'VALIDATION_ERROR'; end if;
 term:=lower(coalesce(p_query->>'q',''));
 if p_kind='receipt' then
  perform 1 from public."PHIEU_NHAP" where ma_phieu_nhap=(p_query->>'id')::int;
  if not found then raise exception 'NOT_FOUND'; end if;
  return admin_ops.receipt_snapshot((p_query->>'id')::int);
 elsif p_kind='receipts' then
  with matched as materialized (select p.*,s.ten_ncc as supplier_name,n.ho_ten as creator_name,
    (select count(*) from public."CT_PHIEU_NHAP" l where l.ma_phieu_nhap=p.ma_phieu_nhap) as line_count
   from public."PHIEU_NHAP" p join public."NHA_CUNG_CAP" s using(ma_ncc)
   left join public."NHAN_VIEN" n on n.ma_nhan_vien=p.nguoi_tao
   where (nullif(p_query->>'status','') is null or p.trang_thai=p_query->>'status')
   and strpos(lower(p.ma_phieu_code||' '||s.ten_ncc),term)>0)
  select jsonb_build_object('data',coalesce((select jsonb_agg(x order by ma_phieu_nhap desc) from
    (select * from matched order by ma_phieu_nhap desc limit size offset skip)x),'[]'::jsonb),'total',(select count(*) from matched)) into result;
 elsif p_kind='history' then
  with matched as materialized (select e.*,sp.ten_sp as product_name,n.ho_ten as actor_name from admin_ops.stock_events e
   left join public."SAN_PHAM" sp using(sku) left join public."TAI_KHOAN" a on a.ma_tk=e.actor
   left join public."NHAN_VIEN" n using(ma_nhan_vien)
   where strpos(lower(e.sku||' '||coalesce(sp.ten_sp,'')||' '||coalesce(e.reference,'')),term)>0
   and (nullif(p_query->>'start','') is null or e.created_at>=(p_query->>'start')::timestamptz)
   and (nullif(p_query->>'end','') is null or e.created_at<(p_query->>'end')::timestamptz))
  select jsonb_build_object('data',coalesce((select jsonb_agg(x order by created_at desc,id desc) from
    (select * from matched order by created_at desc,id desc limit size offset skip)x),'[]'::jsonb),'total',(select count(*) from matched)) into result;
 else raise exception 'VALIDATION_ERROR'; end if;
 return result||jsonb_build_object('page',skip/size+1,'page_size',size,'warehouse_id',null);
end $$;
revoke all on function public.warehouse_read_v1(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.warehouse_read_v1(text,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
