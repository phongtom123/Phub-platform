-- Staff may read warehouse data across all warehouses; write/workflow guards remain assigned-warehouse scoped.
begin;

create or replace function public.warehouse_read_v1(p_actor text,p_kind text,p_query jsonb) returns jsonb
language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare who jsonb; result jsonb; skip int; size int; term text;
begin
 who:=admin_ops.warehouse_actor(p_actor);
 size:=coalesce((p_query->>'page_size')::int,20); skip:=(coalesce((p_query->>'page')::int,1)-1)*size;
 if size not between 1 and 100 or skip<0 or skip>1000000 then raise exception 'VALIDATION_ERROR'; end if;
 term:=lower(coalesce(p_query->>'q',''));
 if p_kind='receipt' then
  perform 1 from public."PHIEU_NHAP" where ma_phieu_nhap=(p_query->>'id')::int;
  if not found then raise exception 'NOT_FOUND'; end if;
  return admin_ops.receipt_snapshot((p_query->>'id')::int);
 elsif p_kind='receipts' then
  with matched as materialized (
   select p.*,s.ten_ncc as supplier_name,n.ho_ten as creator_name,
    (select count(*) from public."CT_PHIEU_NHAP" l where l.ma_phieu_nhap=p.ma_phieu_nhap) as line_count
   from public."PHIEU_NHAP" p join public."NHA_CUNG_CAP" s using(ma_ncc)
   left join public."NHAN_VIEN" n on n.ma_nhan_vien=p.nguoi_tao
   where (nullif(p_query->>'status','') is null or p.trang_thai=p_query->>'status')
   and strpos(lower(p.ma_phieu_code||' '||s.ten_ncc),term)>0
  ) select jsonb_build_object('data',coalesce((select jsonb_agg(x order by ma_phieu_nhap desc) from
    (select * from matched order by ma_phieu_nhap desc limit size offset skip)x),'[]'::jsonb),'total',(select count(*) from matched)) into result;
 elsif p_kind='history' then
  with matched as materialized (
   select e.*,sp.ten_sp as product_name,n.ho_ten as actor_name from admin_ops.stock_events e
   left join public."SAN_PHAM" sp using(sku) left join public."TAI_KHOAN" a on a.ma_tk=e.actor
   left join public."NHAN_VIEN" n using(ma_nhan_vien)
   where strpos(lower(e.sku||' '||coalesce(sp.ten_sp,'')||' '||coalesce(e.reference,'')),term)>0
   and (nullif(p_query->>'start','') is null or e.created_at>=(p_query->>'start')::timestamptz)
   and (nullif(p_query->>'end','') is null or e.created_at<(p_query->>'end')::timestamptz)
  ) select jsonb_build_object('data',coalesce((select jsonb_agg(x order by created_at desc,id desc) from
    (select * from matched order by created_at desc,id desc limit size offset skip)x),'[]'::jsonb),'total',(select count(*) from matched)) into result;
 else raise exception 'VALIDATION_ERROR'; end if;
 return result||jsonb_build_object('page',skip/size+1,'page_size',size,'warehouse_id',null);
end $$;

commit;
