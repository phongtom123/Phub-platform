-- Bypass skips the payment gateway, not persistence or the normal order workflow.
begin;

-- Reuse the automatic-invoice convention already present on the live database.
alter table public."HOA_DON" add column if not exists nguon_lap varchar not null default 'QUAN_TRI';
alter table public."HOA_DON" alter column nguon_lap set default 'QUAN_TRI';
alter table public."HOA_DON" alter column nguoi_lap drop not null;
alter table public."HOA_DON" add column ma_tk_lap varchar references public."TAI_KHOAN"(ma_tk);
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public."HOA_DON"'::regclass and conname='invoice_issuer_source') then
    alter table public."HOA_DON" add constraint invoice_issuer_source check (
      (nguon_lap='QUAN_TRI' and nguoi_lap is not null) or (nguon_lap='TU_DONG' and nguoi_lap is null));
  end if;
end $$;
alter table public."THANH_TOAN" add column la_bypass boolean not null default false;
alter table public."THANH_TOAN" add column ma_tk_ghi_nhan varchar references public."TAI_KHOAN"(ma_tk);
alter table public."THANH_TOAN" add constraint payment_bypass_actor check (not la_bypass or ma_tk_ghi_nhan is not null);
create index invoice_creator_account_idx on public."HOA_DON"(ma_tk_lap) where ma_tk_lap is not null;
create index payment_creator_account_idx on public."THANH_TOAN"(ma_tk_ghi_nhan) where ma_tk_ghi_nhan is not null;

-- The private record is now an idempotency/audit record linked to real business rows.
alter table payment_demo.attempts add column payment_id int references public."THANH_TOAN"(ma_thanh_toan);
drop index payment_demo.payment_demo_active_idx;
create unique index payment_demo_posted_payment_idx on payment_demo.attempts(payment_id) where payment_id is not null;
drop trigger payment_demo_no_invoice on public."HOA_DON";
drop trigger payment_demo_no_real_payment on public."THANH_TOAN";
drop trigger payment_demo_no_dispatch on public."DON_HANG";
drop function payment_demo.guard_real_workflow();

create function payment_demo.business_transaction_json(p public."THANH_TOAN")
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
   'type',case p.loai_giao_dich when 'THU' then 'collection' when 'HOAN_TIEN' then 'refund' else 'unknown' end,
   'method',case p.phuong_thuc when 'TIEN_MAT' then 'cash' when 'CHUYEN_KHOAN' then 'bank_transfer' when 'THE' then 'card' when 'VI_DIEN_TU' then 'e_wallet' else 'unknown' end,
   'amount',p.so_tien::text,
   'status',case p.trang_thai when 'THANH_CONG' then 'succeeded' when 'CHO_XU_LY' then 'pending' when 'THAT_BAI' then 'failed' else 'unknown' end,
   'occurred_at',p.thoi_gian,
   'message',case when p.la_bypass then 'Thanh toán bypass đã được ghi vào hệ thống; không qua cổng thanh toán.'
     when p.trang_thai='THANH_CONG' then 'Giao dịch đã được ghi nhận thành công.'
     when p.trang_thai='CHO_XU_LY' then 'Giao dịch đang chờ xử lý.' else 'Giao dịch chưa được xác nhận thành công.' end)
$$;

create or replace function payment_demo.overview(p_order_id text,p_customer_id text,p_key uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('order_id',d.ma_donhang,'currency','VND',
   'latest_transaction',case when p.ma_thanh_toan is not null then payment_demo.business_transaction_json(p) else null end,
   'message',case when p.ma_thanh_toan is not null then payment_demo.business_transaction_json(p)->>'message'
     else 'Đơn chưa có giao dịch thanh toán được ghi nhận.' end)
   || case when p.la_bypass and a.request_key is not null then jsonb_build_object(
     'demo',jsonb_build_object('request_key',a.request_key,'order_status',d.trang_thai)) else '{}'::jsonb end
 from public."DON_HANG" d
 left join lateral (select t.* from public."THANH_TOAN" t where t.ma_donhang=d.ma_donhang
   order by t.thoi_gian desc,t.ma_thanh_toan desc limit 1) p on true
 left join payment_demo.attempts a on a.payment_id=p.ma_thanh_toan
 where d.ma_donhang=p_order_id and d.ma_kh=p_customer_id
$$;

create or replace function public.customer_demo_payment_v1(
  p_customer_id text,p_order_id text,p_action text,p_key uuid default null,
  p_method text default null,p_page int default 1,p_page_size int default 20
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  ord public."DON_HANG"%rowtype;
  invoice public."HOA_DON"%rowtype;
  attempt payment_demo.attempts%rowtype;
  account_id text;
  line_snapshot jsonb;
  subtotal numeric;
  taxes numeric;
  discount numeric;
  total numeric;
  paid numeric;
  due numeric;
  payment_id int;
  items jsonb;
  item_count int;
  created timestamptz := clock_timestamp();
begin
  if p_action is null or p_action not in ('request','read','history') or p_page is null or p_page not between 1 and 1000000
    or p_page_size is null or p_page_size not between 1 and 100 then return jsonb_build_object('error','VALIDATION_ERROR'); end if;
  if p_action='request' then
    select * into ord from public."DON_HANG" where ma_donhang=p_order_id and ma_kh=p_customer_id for update;
  else
    select * into ord from public."DON_HANG" where ma_donhang=p_order_id and ma_kh=p_customer_id;
  end if;
  if not found then return jsonb_build_object('error','ORDER_NOT_FOUND'); end if;
  if p_action='read' then return jsonb_build_object('overview',payment_demo.overview(p_order_id,p_customer_id)); end if;
  if p_action='history' then
    select count(*) into item_count from public."THANH_TOAN" where ma_donhang=p_order_id;
    select coalesce(jsonb_agg(payment_demo.business_transaction_json(p) order by p.thoi_gian desc,p.ma_thanh_toan desc),'[]') into items
      from (select * from public."THANH_TOAN" where ma_donhang=p_order_id order by thoi_gian desc,ma_thanh_toan desc
        limit p_page_size offset (p_page-1)*p_page_size) p;
    return jsonb_build_object('history',jsonb_build_object('order_id',p_order_id,'currency','VND','items',items,
      'pagination',jsonb_build_object('page',p_page,'page_size',p_page_size,'total',item_count,'total_pages',(item_count+p_page_size-1)/p_page_size)));
  end if;
  if p_key is null or p_method is null or p_method not in ('cash','bank_transfer','card','e_wallet') then
    return jsonb_build_object('error','VALIDATION_ERROR'); end if;
  select ma_tk into account_id from public."TAI_KHOAN" where ma_kh=p_customer_id and trang_thai=1 for share;
  if not found then return jsonb_build_object('error','AUTH_CUSTOMER_UNAVAILABLE'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer_id||':'||p_key::text,0));
  select * into attempt from payment_demo.attempts where customer_id=p_customer_id and request_key=p_key for update;
  if attempt.request_key is not null then
    if attempt.order_id<>p_order_id or attempt.method<>p_method then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT'); end if;
    if attempt.payment_id is not null then
      return jsonb_build_object('overview',payment_demo.overview(p_order_id,p_customer_id),'replayed',true);
    end if;
  end if;
  if ord.kenh_ban<>'ONLINE' or ord.trang_thai not in ('MOI','XAC_NHAN','DANG_CHUAN_BI') then
    return jsonb_build_object('error','ORDER_NOT_PAYABLE'); end if;
  if exists(select 1 from public."THANH_TOAN" where ma_donhang=p_order_id and trang_thai='CHO_XU_LY') then
    return jsonb_build_object('error','PAYMENT_ALREADY_PENDING'); end if;
  perform 1 from public."CT_DON_HANG" where ma_donhang=p_order_id order by ma_ct_donhang for update;
  select sum(so_luong*don_gia-giam_gia-giam_gia_voucher),sum(giam_gia+giam_gia_voucher),
    sum(round((so_luong*don_gia-giam_gia-giam_gia_voucher)*thue_suat/100,2))
    into subtotal,discount,taxes from public."CT_DON_HANG" where ma_donhang=p_order_id;
  if subtotal is null or subtotal<0 or taxes is null or taxes<0 then return jsonb_build_object('error','ORDER_NOT_PAYABLE'); end if;
  total:=subtotal+taxes;
  select * into invoice from public."HOA_DON" where ma_donhang=p_order_id for update;
  if found then
    if invoice.tong_tien_truoc_thue<>subtotal or invoice.tong_tien_thue<>taxes or invoice.tong_tien_sau_thue<>total then
      return jsonb_build_object('error','INVOICE_TOTAL_MISMATCH'); end if;
  end if;
  select coalesce(sum(case when loai_giao_dich='THU' then so_tien else -so_tien end),0)
    into paid from public."THANH_TOAN" where ma_donhang=p_order_id and trang_thai='THANH_CONG';
  due:=total-paid;
  if due<=0 then return jsonb_build_object('error','ORDER_ALREADY_PAID'); end if;
  if paid<0 or due>=10000000000000000 then return jsonb_build_object('error','ORDER_NOT_PAYABLE'); end if;

  -- Every check above precedes writes. Any later failure rolls back invoice, payment and state together.
  if invoice.ma_hoadon is null then
    update public."CT_DON_HANG" set tien_thue=round((so_luong*don_gia-giam_gia-giam_gia_voucher)*thue_suat/100,2),
      thanh_tien=so_luong*don_gia-giam_gia-giam_gia_voucher+round((so_luong*don_gia-giam_gia-giam_gia_voucher)*thue_suat/100,2)
      where ma_donhang=p_order_id;
    insert into public."HOA_DON"(ma_hoadon,ma_donhang,thoi_gian_lap,ten_nguoi_mua,dia_chi_nguoi_mua,
      tong_tien_giam,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap,nguon_lap,ma_tk_lap)
      values('HD-'||p_order_id,p_order_id,created,ord.ten_nguoi_nhan,
        concat_ws(', ',ord.dia_chi_chi_tiet,ord.xa_phuong,ord.tinh_thanh),discount,subtotal,taxes,total,null,'TU_DONG',account_id);
  end if;
  insert into public."THANH_TOAN"(ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,ma_giao_dich,thoi_gian,la_bypass,ma_tk_ghi_nhan)
    values(p_order_id,due,'THU',case p_method when 'cash' then 'TIEN_MAT' when 'bank_transfer' then 'CHUYEN_KHOAN'
      when 'card' then 'THE' else 'VI_DIEN_TU' end,'THANH_CONG','BYPASS-'||md5(p_customer_id||':'||p_key::text),created,true,account_id)
    returning ma_thanh_toan into payment_id;
  select jsonb_agg(to_jsonb(c) order by c.ma_ct_donhang) into line_snapshot from public."CT_DON_HANG" c where ma_donhang=p_order_id;
  insert into payment_demo.attempts(customer_id,request_key,order_id,method,amount,status,line_snapshot,payment_id,created_at,updated_at)
    values(p_customer_id,p_key,p_order_id,p_method,due,'succeeded',line_snapshot,payment_id,created,created)
    on conflict(customer_id,request_key) do update set amount=excluded.amount,status=excluded.status,
      line_snapshot=excluded.line_snapshot,payment_id=excluded.payment_id,updated_at=excluded.updated_at;
  update public."DON_HANG" set trang_thai='DANG_CHUAN_BI' where ma_donhang=p_order_id;
  return jsonb_build_object('overview',payment_demo.overview(p_order_id,p_customer_id),'replayed',false);
end $$;

revoke all on function payment_demo.business_transaction_json(public."THANH_TOAN") from public,anon,authenticated;
grant execute on function payment_demo.business_transaction_json(public."THANH_TOAN") to service_role;
revoke all on function public.customer_demo_payment_v1(text,text,text,uuid,text,int,int) from public,anon,authenticated;
grant execute on function public.customer_demo_payment_v1(text,text,text,uuid,text,int,int) to service_role;

-- Repair successful legacy bypasses that never created business records. No new orders.
-- Canceled orders and orders with existing financial records are deliberately excluded.
do $$ declare legacy record; result jsonb; begin
  for legacy in select a.* from payment_demo.attempts a join public."DON_HANG" d on d.ma_donhang=a.order_id and d.ma_kh=a.customer_id
    where a.status='succeeded' and a.payment_id is null and d.trang_thai='DANG_CHUAN_BI'
      and exists(select 1 from public."TAI_KHOAN" t where t.ma_kh=a.customer_id and t.trang_thai=1)
      and not exists(select 1 from public."HOA_DON" where ma_donhang=a.order_id)
      and not exists(select 1 from public."THANH_TOAN" where ma_donhang=a.order_id)
  loop
    if legacy.amount is distinct from (select sum(so_luong*don_gia-giam_gia-giam_gia_voucher+
      round((so_luong*don_gia-giam_gia-giam_gia_voucher)*thue_suat/100,2))
      from public."CT_DON_HANG" where ma_donhang=legacy.order_id) then
      raise exception 'BYPASS_BACKFILL_PRICE_CHANGED';
    end if;
    result:=public.customer_demo_payment_v1(legacy.customer_id,legacy.order_id,'request',legacy.request_key,legacy.method);
    if result ? 'error' then raise exception 'BYPASS_BACKFILL_FAILED: %',result->>'error'; end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
