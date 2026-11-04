-- Opt-in demo payments. No real money, invoices, or physical stock movements.
begin;

create schema payment_demo;
revoke all on schema payment_demo from public, anon, authenticated;
grant usage on schema payment_demo to service_role;

create table payment_demo.attempts (
  customer_id varchar not null references public."KHACH_HANG"(ma_kh),
  request_key uuid not null,
  order_id varchar not null references public."DON_HANG"(ma_donhang),
  method text not null check (method in ('cash','bank_transfer','card','e_wallet')),
  amount numeric(18,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  line_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(customer_id, request_key)
);
create index payment_demo_order_idx on payment_demo.attempts(order_id, created_at desc, request_key);
create unique index payment_demo_active_idx on payment_demo.attempts(order_id)
  where status in ('pending','succeeded');
alter table payment_demo.attempts enable row level security;
revoke all on payment_demo.attempts from public, anon, authenticated;
grant select, insert, update on payment_demo.attempts to service_role;

create function payment_demo.transaction_json(p payment_demo.attempts)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('type','collection','method',p.method,'amount',p.amount::text,
   'status',p.status,'occurred_at',p.updated_at,
   'message',case p.status
     when 'succeeded' then 'Mô phỏng thanh toán thành công; không thu tiền thật. Đơn được chuyển sang Đang chuẩn bị hàng.'
     when 'failed' then 'Mô phỏng thanh toán thất bại; không thu tiền và không chuyển trạng thái đơn.'
     else 'Thanh toán giả lập đang chờ xử lý; chưa thu tiền thật.' end)
$$;

create function payment_demo.overview(p_order_id text, p_customer_id text, p_key uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('order_id',a.order_id,'currency','VND',
   'latest_transaction',payment_demo.transaction_json(a),
   'message',payment_demo.transaction_json(a)->>'message',
   'demo',jsonb_build_object('request_key',a.request_key,'order_status',d.trang_thai))
 from payment_demo.attempts a join public."DON_HANG" d on d.ma_donhang=a.order_id
 where a.order_id=p_order_id and a.customer_id=p_customer_id
   and (p_key is null or a.request_key=p_key)
 order by a.created_at desc,a.request_key desc limit 1
$$;

create function public.customer_demo_payment_v1(
  p_customer_id text, p_order_id text, p_action text, p_key uuid default null,
  p_method text default null,
  p_page int default 1, p_page_size int default 20
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  ord public."DON_HANG"%rowtype;
  attempt payment_demo.attempts%rowtype;
  snapshot jsonb;
  total numeric;
  items jsonb;
  item_count int;
begin
  if p_action is null or p_action not in ('request','read','history') or
     p_page is null or p_page<1 or p_page>1000000 or p_page_size is null or p_page_size not between 1 and 100 then
    return jsonb_build_object('error','VALIDATION_ERROR');
  end if;
  -- All writers, including the Admin order workflow, lock this same parent row.
  if p_action='request' then
    select * into ord from public."DON_HANG"
      where ma_donhang=p_order_id and ma_kh=p_customer_id for update;
  else
    select * into ord from public."DON_HANG" where ma_donhang=p_order_id and ma_kh=p_customer_id;
  end if;
  if not found then return jsonb_build_object('error','ORDER_NOT_FOUND'); end if;

  if p_action='read' then
    return jsonb_build_object('overview',payment_demo.overview(p_order_id,p_customer_id));
  elsif p_action='history' then
    select count(*) into item_count from payment_demo.attempts where order_id=p_order_id and customer_id=p_customer_id;
    if item_count=0 then return jsonb_build_object('history',null); end if;
    select coalesce(jsonb_agg(payment_demo.transaction_json(a) order by a.created_at desc,a.request_key desc),'[]') into items
    from (select * from payment_demo.attempts where order_id=p_order_id and customer_id=p_customer_id
      order by created_at desc,request_key desc limit p_page_size offset (p_page-1)*p_page_size) a;
    return jsonb_build_object('history',jsonb_build_object('order_id',p_order_id,'currency','VND','items',items,
      'pagination',jsonb_build_object('page',p_page,'page_size',p_page_size,'total',item_count,
        'total_pages',(item_count+p_page_size-1)/p_page_size)));
  end if;

  if p_key is null then return jsonb_build_object('error','VALIDATION_ERROR'); end if;
  -- Serialize reuse of the same key even when it targets a different order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer_id||':'||p_key::text,0));
  select * into attempt from payment_demo.attempts where customer_id=p_customer_id and request_key=p_key;
  if p_action='request' then
    if p_method is null or p_method not in ('cash','bank_transfer','card','e_wallet') then
      return jsonb_build_object('error','VALIDATION_ERROR');
    end if;
    if attempt.request_key is not null then
      if attempt.order_id<>p_order_id or attempt.method<>p_method then
        return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');
      end if;
      return jsonb_build_object('overview',payment_demo.overview(p_order_id,p_customer_id,p_key),'replayed',true);
    end if;
    if exists(select 1 from payment_demo.attempts where order_id=p_order_id and status='succeeded') then
      return jsonb_build_object('error','ORDER_ALREADY_PAID');
    end if;
    if exists(select 1 from payment_demo.attempts where order_id=p_order_id and status='pending') then
      return jsonb_build_object('error','PAYMENT_ALREADY_PENDING');
    end if;
    if ord.trang_thai<>'MOI' or ord.kenh_ban<>'ONLINE'
      or exists(select 1 from public."HOA_DON" where ma_donhang=p_order_id)
      or exists(select 1 from public."THANH_TOAN" where ma_donhang=p_order_id) then
      return jsonb_build_object('error','ORDER_NOT_PAYABLE');
    end if;
    perform 1 from public."CT_DON_HANG" where ma_donhang=p_order_id order by ma_ct_donhang for share;
    select jsonb_agg(to_jsonb(c) order by c.ma_ct_donhang),
      sum(so_luong*don_gia-giam_gia-giam_gia_voucher+
          round((so_luong*don_gia-giam_gia-giam_gia_voucher)*thue_suat/100,2))
      into snapshot,total from public."CT_DON_HANG" c where ma_donhang=p_order_id;
    if snapshot is null or total is null or total<=0 then return jsonb_build_object('error','ORDER_NOT_PAYABLE'); end if;
    insert into payment_demo.attempts(customer_id,request_key,order_id,method,amount,line_snapshot,status)
      values(p_customer_id,p_key,p_order_id,p_method,total,snapshot,'succeeded');
    update public."DON_HANG" set trang_thai='DANG_CHUAN_BI' where ma_donhang=p_order_id;
    return jsonb_build_object('overview',payment_demo.overview(p_order_id,p_customer_id,p_key),'replayed',false);
  end if;
end $$;

-- Simulated money cannot subsequently become a real invoice/payment or stock dispatch.
-- Parent-row locks also serialize first marking an order as demo with Admin writes.
create function payment_demo.guard_real_workflow()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_order_id text := new.ma_donhang;
begin
  perform 1 from public."DON_HANG" where ma_donhang=v_order_id for update;
  if exists(select 1 from payment_demo.attempts a where a.order_id=v_order_id) then
    if tg_table_name<>'DON_HANG' then
      raise exception 'PAYMENT_DEMO_ORDER' using errcode='P0001';
    elsif new.trang_thai in ('DA_XUAT_KHO','HOAN_THANH') or new.ma_kh is distinct from old.ma_kh then
      raise exception 'PAYMENT_DEMO_ORDER' using errcode='P0001';
    end if;
  end if;
  return new;
end $$;
create trigger payment_demo_no_invoice before insert or update on public."HOA_DON"
  for each row execute function payment_demo.guard_real_workflow();
create trigger payment_demo_no_real_payment before insert or update on public."THANH_TOAN"
  for each row execute function payment_demo.guard_real_workflow();
create trigger payment_demo_no_dispatch before update on public."DON_HANG"
  for each row execute function payment_demo.guard_real_workflow();

revoke all on all functions in schema payment_demo from public, anon, authenticated;
grant execute on all functions in schema payment_demo to service_role;
revoke all on function public.customer_demo_payment_v1(text,text,text,uuid,text,int,int) from public, anon, authenticated;
grant execute on function public.customer_demo_payment_v1(text,text,text,uuid,text,int,int) to service_role;
notify pgrst,'reload schema';
commit;
