-- Staff receiving uses existing documents, idempotency store and stock audit trigger.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function admin_ops.warehouse_actor(p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('employee',n.ma_nhan_vien,'warehouse',n.ma_kho) into result
 from public."TAI_KHOAN" a join public."NHAN_VIEN" n using(ma_nhan_vien)
 join public."KHO" w on w.ma_kho=n.ma_kho
 where a.ma_tk=p_actor and a.trang_thai=1 and n.trang_thai=1
 and n.loai_nhan_vien='NHAN_VIEN' and w.trang_thai=1 for share of a,n,w;
 if result is null then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
 return result;
end $$;

create function admin_ops.receipt_snapshot(p_id int) returns jsonb
language sql stable security invoker set search_path='' set timezone='UTC' as $$
 select jsonb_build_object('receipt',to_jsonb(p)||jsonb_build_object('supplier_name',s.ten_ncc),
 'lines',coalesce((select jsonb_agg(jsonb_build_object('sku',l.sku,'product_name',sp.ten_sp,
   'quantity',l.so_luong_nhap,'unit_price',l.gia_nhap::text,'unit',sp.don_vi) order by l.sku)
   from public."CT_PHIEU_NHAP" l join public."SAN_PHAM" sp using(sku) where l.ma_phieu_nhap=p_id),'[]'::jsonb),
 'version',encode(sha256(convert_to((to_jsonb(p)||jsonb_build_object('lines',coalesce(
   (select jsonb_agg(to_jsonb(l) order by l.sku) from public."CT_PHIEU_NHAP" l where l.ma_phieu_nhap=p_id),'[]'::jsonb)))::text,'UTF8')),'hex'))
 from public."PHIEU_NHAP" p join public."NHA_CUNG_CAP" s using(ma_ncc) where p.ma_phieu_nhap=p_id
$$;

create function public.warehouse_receipt_v1(p_actor text,p_action text,p_key uuid,p_id int,p_body jsonb)
returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare
 who jsonb; wh int; employee text; document public."PHIEU_NHAP"%rowtype;
 prior admin_ops.requests%rowtype; fingerprint text; inserted int; saved_result jsonb; item jsonb; line record;
 created timestamp:=timezone('UTC',statement_timestamp());
begin
 who:=admin_ops.warehouse_actor(p_actor); wh:=(who->>'warehouse')::int; employee:=who->>'employee';
 if p_action not in('create','update','confirm','cancel') or p_action is null or p_key is null
 or p_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'VALIDATION_ERROR'; end if;
 if p_action<>'create' then
  select * into document from public."PHIEU_NHAP" where ma_phieu_nhap=p_id and ma_kho=wh for update;
  if not found then raise exception 'NOT_FOUND'; end if;
 elsif p_id is not null then raise exception 'VALIDATION_ERROR'; end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(wh,p_action,p_id,p_body)::text,'UTF8')),'hex');
 insert into admin_ops.requests(actor,key,hash,resource,action,record_id)
 values(p_actor,p_key,fingerprint,'warehouse-receipts',p_action,p_id::text) on conflict(actor,key) do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then
  select * into strict prior from admin_ops.requests where actor=p_actor and key=p_key;
  if prior.hash<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return prior.result||jsonb_build_object('replayed',true);
 end if;
 if p_action<>'create' then
  if document.trang_thai<>'NHAP' then raise exception 'STATE_CONFLICT'; end if;
  if p_body->>'expected_version' is distinct from admin_ops.receipt_snapshot(p_id)->>'version'
  then raise exception 'DOCUMENT_CHANGED'; end if;
 end if;
 if p_action in('create','update') then
  if (p_body-array['supplier_id','note','lines','expected_version'])<>'{}'::jsonb
   or (p_body->>'supplier_id') is null or length(coalesce(p_body->>'note',''))>2000
   or jsonb_typeof(p_body->'lines') is distinct from 'array' then raise exception 'VALIDATION_ERROR'; end if;
  if jsonb_array_length(p_body->'lines') not between 1 and 100 or exists(
    select 1 from jsonb_array_elements(p_body->'lines') i group by i->>'sku' having count(*)>1)
  then raise exception 'VALIDATION_ERROR'; end if;
  perform 1 from public."NHA_CUNG_CAP" where ma_ncc=(p_body->>'supplier_id')::int and trang_thai=1 for share;
  if not found then raise exception 'VALIDATION_ERROR'; end if;
  if p_action='create' then
   insert into public."PHIEU_NHAP"(ma_phieu_code,ma_ncc,ma_kho,ngay_tao,nguoi_tao,trang_thai,ghi_chu)
   values('PN-KHO-'||p_key,(p_body->>'supplier_id')::int,wh,created,employee,'NHAP',p_body->>'note')
   returning ma_phieu_nhap into p_id;
  else
   update public."PHIEU_NHAP" set ma_ncc=(p_body->>'supplier_id')::int,ghi_chu=p_body->>'note',nguoi_cap_nhat=employee
   where ma_phieu_nhap=p_id;
   delete from public."CT_PHIEU_NHAP" where ma_phieu_nhap=p_id;
  end if;
  for item in select value from jsonb_array_elements(p_body->'lines') order by value->>'sku' loop
   if jsonb_typeof(item) is distinct from 'object' or (item-array['sku','quantity','unit_price'])<>'{}'::jsonb
    or coalesce(item->>'quantity','') !~ '^[1-9][0-9]{0,6}$' or (item->>'quantity')::int>1000000
    or coalesce(item->>'unit_price','') !~ '^[0-9]{1,16}(\.[0-9]{1,2})?$'
   then raise exception 'VALIDATION_ERROR'; end if;
   perform 1 from public."SAN_PHAM" where sku=item->>'sku' and trang_thai=1 for share;
   if not found then raise exception 'VALIDATION_ERROR'; end if;
   insert into public."CT_PHIEU_NHAP"(ma_phieu_nhap,sku,so_luong_nhap,gia_nhap)
   values(p_id,item->>'sku',(item->>'quantity')::int,(item->>'unit_price')::numeric);
  end loop;
 elsif p_action='confirm' then
  if (p_body-'expected_version')<>'{}'::jsonb or not exists(select 1 from public."CT_PHIEU_NHAP" where ma_phieu_nhap=p_id)
  then raise exception 'VALIDATION_ERROR'; end if;
  perform set_config('phub.actor',p_actor,true);
  perform set_config('phub.reason','receipts:confirm',true);
  perform set_config('phub.reference',p_id::text,true);
  for line in select * from public."CT_PHIEU_NHAP" where ma_phieu_nhap=p_id order by sku loop
   insert into public."TON_KHO"(ma_kho,sku,so_luong_ton,cap_nhat_luc) values(wh,line.sku,line.so_luong_nhap,created)
   on conflict(ma_kho,sku) do update set so_luong_ton=public."TON_KHO".so_luong_ton+excluded.so_luong_ton,cap_nhat_luc=created;
  end loop;
  update public."PHIEU_NHAP" set trang_thai='DA_NHAP',ngay_nhap=created,nguoi_xac_nhan=employee,nguoi_cap_nhat=employee where ma_phieu_nhap=p_id;
 else
  if (p_body-'expected_version')<>'{}'::jsonb then raise exception 'VALIDATION_ERROR'; end if;
  update public."PHIEU_NHAP" set trang_thai='HUY',nguoi_cap_nhat=employee where ma_phieu_nhap=p_id;
 end if;
 saved_result:=admin_ops.receipt_snapshot(p_id)||jsonb_build_object('replayed',false);
 update admin_ops.requests set result=saved_result,record_id=p_id::text where actor=p_actor and key=p_key;
 return saved_result;
end $$;

create function public.warehouse_read_v1(p_actor text,p_kind text,p_query jsonb) returns jsonb
language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare who jsonb; wh int; result jsonb; skip int; size int; term text;
begin
 who:=admin_ops.warehouse_actor(p_actor);wh:=(who->>'warehouse')::int;
 size:=coalesce((p_query->>'page_size')::int,20);skip:=(coalesce((p_query->>'page')::int,1)-1)*size;
 if size not between 1 and 100 or skip<0 or skip>1000000 then raise exception 'VALIDATION_ERROR'; end if;
 term:=lower(coalesce(p_query->>'q',''));
 if p_kind='receipt' then
  perform 1 from public."PHIEU_NHAP" where ma_phieu_nhap=(p_query->>'id')::int and ma_kho=wh;
  if not found then raise exception 'NOT_FOUND'; end if;
  return admin_ops.receipt_snapshot((p_query->>'id')::int);
 elsif p_kind='receipts' then
  with matched as materialized (
   select p.*,s.ten_ncc as supplier_name,n.ho_ten as creator_name,
    (select count(*) from public."CT_PHIEU_NHAP" l where l.ma_phieu_nhap=p.ma_phieu_nhap) as line_count
   from public."PHIEU_NHAP" p join public."NHA_CUNG_CAP" s using(ma_ncc)
   left join public."NHAN_VIEN" n on n.ma_nhan_vien=p.nguoi_tao
   where p.ma_kho=wh and (nullif(p_query->>'status','') is null or p.trang_thai=p_query->>'status')
   and strpos(lower(p.ma_phieu_code||' '||s.ten_ncc),term)>0
  ) select jsonb_build_object('data',coalesce((select jsonb_agg(x order by ma_phieu_nhap desc) from
    (select * from matched order by ma_phieu_nhap desc limit size offset skip)x),'[]'::jsonb),'total',(select count(*) from matched)) into result;
 elsif p_kind='history' then
  with matched as materialized (
   select e.*,sp.ten_sp as product_name,n.ho_ten as actor_name from admin_ops.stock_events e
   left join public."SAN_PHAM" sp using(sku) left join public."TAI_KHOAN" a on a.ma_tk=e.actor
   left join public."NHAN_VIEN" n using(ma_nhan_vien)
   where e.warehouse_id=wh and strpos(lower(e.sku||' '||coalesce(sp.ten_sp,'')||' '||coalesce(e.reference,'')),term)>0
   and (nullif(p_query->>'start','') is null or e.created_at>=(p_query->>'start')::timestamptz)
   and (nullif(p_query->>'end','') is null or e.created_at<(p_query->>'end')::timestamptz)
  ) select jsonb_build_object('data',coalesce((select jsonb_agg(x order by created_at desc,id desc) from
    (select * from matched order by created_at desc,id desc limit size offset skip)x),'[]'::jsonb),'total',(select count(*) from matched)) into result;
 else raise exception 'VALIDATION_ERROR'; end if;
 return result||jsonb_build_object('page',skip/size+1,'page_size',size,'warehouse_id',wh);
end $$;

revoke all on function admin_ops.warehouse_actor(text),admin_ops.receipt_snapshot(int),
 public.warehouse_receipt_v1(text,text,uuid,int,jsonb),public.warehouse_read_v1(text,text,jsonb) from public,anon,authenticated;
grant execute on function admin_ops.warehouse_actor(text),admin_ops.receipt_snapshot(int),
 public.warehouse_receipt_v1(text,text,uuid,int,jsonb),public.warehouse_read_v1(text,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
