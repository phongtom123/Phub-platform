-- Read-only reconstruction. No tables, columns, stock or documents are changed.
begin;
set local lock_timeout='5s';
create or replace function public.admin_business_report_v1(p_actor text,p_start date,p_end date)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare
 from_time timestamptz; until_time timestamptz; e record; s jsonb; key text;
 bad jsonb; balances jsonb:='{}'; costs jsonb:='{}'; products jsonb:='{}'; days jsonb:='{}';
 product jsonb; day_item jsonb; day_key text; qty numeric; value numeric; line_cost numeric; known boolean;
 net numeric:=0; tax numeric:=0; discounts numeric:=0; known_cost numeric:=0; line_net numeric;
 receipts numeric:=0; refunds numeric:=0; related_refunds numeric:=0; complete boolean;
 total_lines int:=0; priced_lines int:=0; total_quantity bigint:=0; order_count int; events int:=0;
 rows_json jsonb; days_json jsonb; warnings jsonb:='[]';
begin
 if not exists(select 1 from public."TAI_KHOAN" a join public."NHAN_VIEN" n using(ma_nhan_vien)
   where a.ma_tk=p_actor and a.trang_thai=1 and n.trang_thai=1 and n.loai_nhan_vien='ADMIN')
 then raise exception 'ADMIN_FORBIDDEN'; end if;
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>=366 or p_end='9999-12-31'::date
 then raise exception 'VALIDATION_ERROR'; end if;
 from_time:=p_start::timestamp at time zone 'Asia/Ho_Chi_Minh';
 until_time:=(p_end+1)::timestamp at time zone 'Asia/Ho_Chi_Minh';

 -- Reconcile all recorded movements with present stock. An unknown opening
 -- balance/manual movement must not silently receive the price of a later purchase.
 with movements as (
   select l.sku,p.ma_kho as warehouse,sum(l.so_luong_nhap)::bigint as change
   from public."CT_PHIEU_NHAP" l join public."PHIEU_NHAP" p using(ma_phieu_nhap)
   where p.trang_thai='DA_NHAP' group by l.sku,p.ma_kho
   union all
   select l.sku,l.ma_kho_xuat,-sum(l.so_luong)::bigint
   from public."CT_DON_HANG" l join public."DON_HANG" d using(ma_donhang)
   where d.trang_thai in('DA_XUAT_KHO','HOAN_THANH') group by l.sku,l.ma_kho_xuat
 ), totals as (select sku,warehouse,sum(change) as quantity from movements group by sku,warehouse),
 uncertain as (
   select coalesce(t.sku,i.sku) as sku,coalesce(t.warehouse,i.ma_kho) as warehouse
   from totals t full join public."TON_KHO" i on i.sku=t.sku and i.ma_kho=t.warehouse
   where coalesce(t.quantity,0)<>coalesce(i.so_luong_ton,0)
   union
   select sku,warehouse_id from admin_ops.stock_events
   where created_at<until_time and before_quantity<>after_quantity and reason not in('receipts:confirm','orders:dispatch')
   union
   select l.sku,p.ma_kho from public."CT_PHIEU_NHAP" l join public."PHIEU_NHAP" p using(ma_phieu_nhap)
   where p.trang_thai='DA_NHAP' and p.ngay_nhap is null
   union
   select l.sku,l.ma_kho_xuat from public."CT_DON_HANG" l join public."DON_HANG" d using(ma_donhang)
   where d.trang_thai in('DA_XUAT_KHO','HOAN_THANH') and d.thoi_gian_xuat_kho is null
 ) select coalesce(jsonb_object_agg(jsonb_build_array(warehouse,sku)::text,true),'{}') into bad from uncertain;

 -- Process every receipt/dispatch before period end, including older periods
 -- and dispatched-but-not-completed orders. Never average future purchases.
 for e in
   select * from (
     select p.ngay_nhap::timestamptz as at_time,0 as kind,p.ma_phieu_nhap::text as document,l.sku,
       p.ma_kho as warehouse,l.so_luong_nhap as quantity,l.gia_nhap as price,null::int as line_id,false as recognized
     from public."CT_PHIEU_NHAP" l join public."PHIEU_NHAP" p using(ma_phieu_nhap)
     where p.trang_thai='DA_NHAP' and p.ngay_nhap::timestamptz<until_time
     union all
     select d.thoi_gian_xuat_kho::timestamptz,1,d.ma_donhang,l.sku,l.ma_kho_xuat,l.so_luong,null::numeric,l.ma_ct_donhang,
       d.trang_thai='HOAN_THANH' and d.thoi_gian_hoan_thanh::timestamptz>=from_time
       and d.thoi_gian_hoan_thanh::timestamptz<until_time
       and d.thoi_gian_xuat_kho<=d.thoi_gian_hoan_thanh
     from public."CT_DON_HANG" l join public."DON_HANG" d using(ma_donhang)
     where d.trang_thai in('DA_XUAT_KHO','HOAN_THANH') and d.thoi_gian_xuat_kho::timestamptz<until_time
   ) ledger order by at_time,kind,document,sku,line_id limit 20001
 loop
   events:=events+1;
   if events>20000 then raise exception 'REPORT_TOO_LARGE'; end if;
   key:=jsonb_build_array(e.warehouse,e.sku)::text;
   s:=coalesce(balances->key,jsonb_build_object('quantity',0,'value',0,'known',not(bad ? key)));
   qty:=(s->>'quantity')::numeric; value:=(s->>'value')::numeric; known:=(s->>'known')::boolean;
   if e.kind=0 then
     qty:=qty+e.quantity; value:=value+e.quantity*e.price;
   else
     known:=known and qty>=e.quantity and qty>0;
     line_cost:=case when known then round(value*e.quantity/qty,2) else null end;
     if e.recognized then costs:=jsonb_set(costs,array[e.line_id::text],coalesce(to_jsonb(line_cost),'null')); end if;
     qty:=qty-e.quantity; value:=case when known then value-line_cost else 0 end;
   end if;
   balances:=jsonb_set(balances,array[key],jsonb_build_object('quantity',qty,'value',value,'known',known));
 end loop;

 -- Recognize sales and their costs in the SAME period: completion date, not
 -- invoice date for revenue and dispatch date for cost as two separate sets.
 for e in
   select l.*,d.thoi_gian_hoan_thanh from public."CT_DON_HANG" l join public."DON_HANG" d using(ma_donhang)
   where d.trang_thai='HOAN_THANH' and d.thoi_gian_hoan_thanh::timestamptz>=from_time
     and d.thoi_gian_hoan_thanh::timestamptz<until_time order by l.ma_ct_donhang limit 20001
 loop
   total_lines:=total_lines+1;
   if total_lines>20000 then raise exception 'REPORT_TOO_LARGE'; end if;
   line_net:=e.so_luong*e.don_gia-e.giam_gia-e.giam_gia_voucher;
   line_cost:=(costs->>e.ma_ct_donhang::text)::numeric;
   net:=net+line_net; tax:=tax+e.tien_thue; discounts:=discounts+e.giam_gia+e.giam_gia_voucher;
   total_quantity:=total_quantity+e.so_luong;
   if line_cost is not null then priced_lines:=priced_lines+1; known_cost:=known_cost+line_cost; end if;
   product:=coalesce(products->e.sku,jsonb_build_object('sku',e.sku,'name',e.ten_sp_luc_ban,'quantity',0,'net',0,'cost',0,'missing',0));
   products:=jsonb_set(products,array[e.sku],product||jsonb_build_object(
     'quantity',(product->>'quantity')::bigint+e.so_luong,'net',(product->>'net')::numeric+line_net,
     'cost',(product->>'cost')::numeric+coalesce(line_cost,0),'missing',(product->>'missing')::int+case when line_cost is null then 1 else 0 end));
   day_key:=timezone('Asia/Ho_Chi_Minh',e.thoi_gian_hoan_thanh::timestamptz)::date::text;
   day_item:=coalesce(days->day_key,jsonb_build_object('net',0,'cost',0,'missing',0));
   days:=jsonb_set(days,array[day_key],jsonb_build_object('net',(day_item->>'net')::numeric+line_net,
     'cost',(day_item->>'cost')::numeric+coalesce(line_cost,0),'missing',(day_item->>'missing')::int+case when line_cost is null then 1 else 0 end));
 end loop;
 select count(*) into order_count from public."DON_HANG" where trang_thai='HOAN_THANH'
   and thoi_gian_hoan_thanh::timestamptz>=from_time and thoi_gian_hoan_thanh::timestamptz<until_time;
 select coalesce(sum(so_tien) filter(where loai_giao_dich='THU'),0),
   coalesce(sum(so_tien) filter(where loai_giao_dich='HOAN_TIEN'),0) into receipts,refunds
 from public."THANH_TOAN" where trang_thai='THANH_CONG' and thoi_gian::timestamptz>=from_time and thoi_gian::timestamptz<until_time;
 select coalesce(sum(t.so_tien),0) into related_refunds from public."THANH_TOAN" t join public."DON_HANG" d using(ma_donhang)
 where t.trang_thai='THANH_CONG' and t.loai_giao_dich='HOAN_TIEN' and t.thoi_gian::timestamptz<until_time
   and d.trang_thai='HOAN_THANH' and d.thoi_gian_hoan_thanh::timestamptz>=from_time and d.thoi_gian_hoan_thanh::timestamptz<until_time;
 complete:=priced_lines=total_lines and refunds=0 and related_refunds=0;
 if priced_lines<total_lines then warnings:=warnings||jsonb_build_array('INCOMPLETE_COST_HISTORY'); end if;
 if refunds>0 or related_refunds>0 then warnings:=warnings||jsonb_build_array('UNALLOCATED_REFUNDS'); end if;

 select coalesce(jsonb_agg(jsonb_build_object('sku',p.key,'name',p.value->>'name','quantity',(p.value->>'quantity')::bigint,
   'net_revenue',round((p.value->>'net')::numeric,2)::text,
   'cost',case when (p.value->>'missing')::int=0 then round((p.value->>'cost')::numeric,2)::text end,
   'gross_profit',case when (p.value->>'missing')::int=0 and refunds=0 and related_refunds=0 then round((p.value->>'net')::numeric-(p.value->>'cost')::numeric,2)::text end,
   'margin',case when (p.value->>'missing')::int=0 and refunds=0 and related_refunds=0 and (p.value->>'net')::numeric<>0
     then round(((p.value->>'net')::numeric-(p.value->>'cost')::numeric)*100/(p.value->>'net')::numeric,2)::text end,
   'unpriced_lines',(p.value->>'missing')::int) order by (p.value->>'net')::numeric desc,p.key),'[]') into rows_json from jsonb_each(products) p;
 select coalesce(jsonb_agg(jsonb_build_object('day',day::date::text,
   'net_revenue',round(coalesce((days->(day::date::text)->>'net')::numeric,0),2)::text,
   'gross_profit',case when coalesce((days->(day::date::text)->>'missing')::int,0)=0 and refunds=0 and related_refunds=0
     then round(coalesce((days->(day::date::text)->>'net')::numeric,0)-coalesce((days->(day::date::text)->>'cost')::numeric,0),2)::text end) order by day),'[]')
 into days_json from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') day;
 return jsonb_build_object('start',p_start,'end',p_end,'method','MOVING_WEIGHTED_AVERAGE','basis','COMPLETED_ORDERS',
   'net_revenue',round(net,2)::text,'tax',round(tax,2)::text,'discounts',round(discounts,2)::text,'gross_revenue',round(net+tax,2)::text,
   'collected',round(receipts-refunds,2)::text,'refunds',round(refunds,2)::text,'order_count',order_count,'quantity',total_quantity,
   'cost',case when priced_lines=total_lines then round(known_cost,2)::text end,'known_cost',round(known_cost,2)::text,
   'gross_profit',case when complete then round(net-known_cost,2)::text end,
   'margin',case when complete and net<>0 then round((net-known_cost)*100/net,2)::text end,
   'costed_lines',priced_lines,'total_lines',total_lines,'warnings',warnings,'products',rows_json,'daily',days_json);
end $$;
revoke all on function public.admin_business_report_v1(text,date,date) from public,anon,authenticated;
grant execute on function public.admin_business_report_v1(text,date,date) to service_role;
notify pgrst,'reload schema';
commit;
