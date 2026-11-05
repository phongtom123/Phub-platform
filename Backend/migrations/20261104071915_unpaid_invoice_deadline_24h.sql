-- KAN-61: new ONLINE customer invoices only; historical invoices remain NULL.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public."HOA_DON"
 add column han_thanh_toan timestamptz,
 add column huy_qua_han_luc timestamptz;
alter table public."HOA_DON" add constraint invoice_expiration_has_deadline
 check (huy_qua_han_luc is null or (han_thanh_toan is not null and huy_qua_han_luc >= han_thanh_toan));
create index invoice_unpaid_deadline_idx on public."HOA_DON"(han_thanh_toan,ma_donhang)
 where han_thanh_toan is not null and huy_qua_han_luc is null;

create function customer_order_private.set_payment_deadline()
returns trigger language plpgsql security invoker set search_path='' set timezone='UTC' as $$
begin
 new.huy_qua_han_luc := null;
 new.han_thanh_toan := null;
 if new.tong_tien_sau_thue > 0 and exists(select 1 from public."DON_HANG" d
  where d.ma_donhang=new.ma_donhang and d.kenh_ban='ONLINE' and d.ma_kh is not null
  and d.trang_thai in ('MOI','XAC_NHAN','DANG_CHUAN_BI')) then
  -- Invoice datetime is historically UTC without a time zone. Explicit UTC
  -- also keeps this conversion correct on installations using timestamptz.
  new.han_thanh_toan := new.thoi_gian_lap::timestamptz + interval '24 hours';
 end if;
 return new;
end $$;
create trigger invoice_payment_deadline before insert on public."HOA_DON"
 for each row execute function customer_order_private.set_payment_deadline();

create function customer_order_private.assert_payment_window(p_order_id text)
returns void language plpgsql volatile security invoker set search_path='' as $$
declare state text; due timestamptz; expired timestamptz;
begin
 -- All finance/dispatch paths serialize on this same order row. Check time
 -- AFTER taking the lock, not transaction-start now() before a possible wait.
 select trang_thai into state from public."DON_HANG" where ma_donhang=p_order_id for update;
 select han_thanh_toan,huy_qua_han_luc into due,expired from public."HOA_DON" where ma_donhang=p_order_id;
 if expired is not null then raise exception 'PAYMENT_DEADLINE_EXPIRED'; end if;
 if due is not null and due <= clock_timestamp() and state in ('MOI','XAC_NHAN','DANG_CHUAN_BI')
 and not exists(select 1 from public."THANH_TOAN" where ma_donhang=p_order_id
  and trang_thai='THANH_CONG' and loai_giao_dich='THU' and so_tien>0) then
  raise exception 'PAYMENT_DEADLINE_EXPIRED';
 end if;
end $$;

create function customer_order_private.guard_deadline_payment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.trang_thai='THANH_CONG' and new.loai_giao_dich='THU' then
  perform customer_order_private.assert_payment_window(new.ma_donhang);
 end if;
 return new;
end $$;
create trigger payment_deadline_guard before insert or update on public."THANH_TOAN"
 for each row execute function customer_order_private.guard_deadline_payment();

create function customer_order_private.guard_deadline_progress()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.trang_thai <> old.trang_thai and new.trang_thai in ('XAC_NHAN','DANG_CHUAN_BI','DA_XUAT_KHO','HOAN_THANH') then
  perform customer_order_private.assert_payment_window(old.ma_donhang);
 end if;
 return new;
end $$;
create trigger order_deadline_progress_guard before update of trang_thai on public."DON_HANG"
 for each row execute function customer_order_private.guard_deadline_progress();

create function customer_order_private.payment_deadline(p_order_id text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare inv record; state text; result_state text; observed timestamptz := clock_timestamp();
begin
 select han_thanh_toan,huy_qua_han_luc,tong_tien_sau_thue into inv from public."HOA_DON" where ma_donhang=p_order_id;
 if not found or inv.han_thanh_toan is null then return null; end if;
 select trang_thai into state from public."DON_HANG" where ma_donhang=p_order_id;
 result_state := case
  when inv.huy_qua_han_luc is not null then 'expired'
  when state not in ('MOI','XAC_NHAN','DANG_CHUAN_BI') then 'closed'
  when inv.tong_tien_sau_thue<=0 or exists(select 1 from public."THANH_TOAN" where ma_donhang=p_order_id
    and trang_thai='THANH_CONG' and loai_giao_dich='THU' and so_tien>0) then 'payment_received'
  when inv.han_thanh_toan<=observed then 'processing_expiry'
  else 'awaiting_payment' end;
 return jsonb_build_object('expires_at',inv.han_thanh_toan,'expired_at',inv.huy_qua_han_luc,
  'server_now',observed,'status',result_state);
end $$;

create function public.customer_payment_deadline_v1(p_customer_id text,p_order_id text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
begin
 if not exists(select 1 from public."DON_HANG" where ma_donhang=p_order_id and ma_kh=p_customer_id) then
  raise exception 'ORDER_NOT_FOUND';
 end if;
 return customer_order_private.payment_deadline(p_order_id);
end $$;

-- Preserve the existing ownership, pagination and receipt contract. Add only
-- deadline metadata, in one database call, for both order history and details.
alter function public.customer_read_orders_v2(text,text,integer,integer,text) rename to customer_read_orders_v2_before_deadline;
create function public.customer_read_orders_v2(p_customer_id text,p_order_id text default null,
 p_page int default 1,p_page_size int default 20,p_currency text default 'VND')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare result jsonb;
begin
 result := public.customer_read_orders_v2_before_deadline(p_customer_id,p_order_id,p_page,p_page_size,p_currency);
 if result ? 'order' then
  result := jsonb_set(result,'{order}',(result->'order') || jsonb_build_object('payment_deadline',
   customer_order_private.payment_deadline(result->'order'->>'id')));
 elsif result ? 'items' then
  result := jsonb_set(result,'{items}',coalesce((select jsonb_agg(item || jsonb_build_object('payment_deadline',
   customer_order_private.payment_deadline(item->>'id')) order by position)
   from jsonb_array_elements(result->'items') with ordinality as rows(item,position)),'[]'::jsonb));
 end if;
 return result;
end $$;

create function customer_order_private.expire_unpaid_orders(p_limit int default 200)
returns integer language plpgsql volatile security invoker set search_path='' as $$
declare candidate record; due timestamptz; state text; changed int := 0; observed timestamptz;
begin
 if p_limit is null or p_limit not between 1 and 1000 then raise exception 'INVALID_EXPIRATION_LIMIT'; end if;
 for candidate in select d.ma_donhang from public."DON_HANG" d join public."HOA_DON" h using(ma_donhang)
  where h.han_thanh_toan<=clock_timestamp() and h.huy_qua_han_luc is null and h.tong_tien_sau_thue>0
   and d.kenh_ban='ONLINE' and d.ma_kh is not null and d.trang_thai in ('MOI','XAC_NHAN','DANG_CHUAN_BI')
   and not exists(select 1 from public."THANH_TOAN" p where p.ma_donhang=d.ma_donhang
    and p.trang_thai='THANH_CONG' and p.loai_giao_dich='THU' and p.so_tien>0)
  order by h.han_thanh_toan,d.ma_donhang limit p_limit for update of d skip locked
 loop
  -- Re-read after the lock, including payment updates that committed while the
  -- scan was being evaluated. Never rely on the candidate query alone.
  observed := clock_timestamp();
  select trang_thai into state from public."DON_HANG" where ma_donhang=candidate.ma_donhang;
  select han_thanh_toan into due from public."HOA_DON" where ma_donhang=candidate.ma_donhang and huy_qua_han_luc is null;
  if due is null or due>observed or state not in ('MOI','XAC_NHAN','DANG_CHUAN_BI') or exists(
   select 1 from public."THANH_TOAN" where ma_donhang=candidate.ma_donhang
    and trang_thai='THANH_CONG' and loai_giao_dich='THU' and so_tien>0) then continue; end if;
  update public."THANH_TOAN" set trang_thai='THAT_BAI' where ma_thanh_toan in (
   select ma_thanh_toan from public."THANH_TOAN" where ma_donhang=candidate.ma_donhang and trang_thai='CHO_XU_LY' for update skip locked);
  update payment_demo.attempts set status='failed',updated_at=observed where order_id=candidate.ma_donhang and status='pending';
  update public."SU_DUNG_VOUCHER" set trang_thai='DA_HUY',thoi_gian_huy=observed
   where ma_donhang=candidate.ma_donhang and trang_thai='DA_AP_DUNG';
  update public."DON_HANG" set trang_thai='HUY' where ma_donhang=candidate.ma_donhang;
  -- Persist the system source/reason through this dedicated timestamp rather
  -- than overwrite customer notes or attribute cancellation to an arbitrary admin.
  update public."HOA_DON" set huy_qua_han_luc=observed where ma_donhang=candidate.ma_donhang;
  changed := changed+1;
 end loop;
 -- Cancellation releases computed reservations. Never update TON_KHO here.
 return changed;
end $$;

revoke all on function customer_order_private.set_payment_deadline(),customer_order_private.assert_payment_window(text),
 customer_order_private.guard_deadline_payment(),customer_order_private.guard_deadline_progress(),
 customer_order_private.payment_deadline(text),customer_order_private.expire_unpaid_orders(integer),
 public.customer_payment_deadline_v1(text,text),public.customer_read_orders_v2(text,text,integer,integer,text)
 from public,anon,authenticated;
grant execute on function customer_order_private.set_payment_deadline(),customer_order_private.assert_payment_window(text),
 customer_order_private.guard_deadline_payment(),customer_order_private.guard_deadline_progress(),
 customer_order_private.payment_deadline(text),customer_order_private.expire_unpaid_orders(integer),
 public.customer_payment_deadline_v1(text,text),public.customer_read_orders_v2(text,text,integer,integer,text) to service_role;
notify pgrst,'reload schema';
commit;
