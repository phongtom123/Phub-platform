-- Restore the missing customer cancellation entry point. Applying this migration
-- does not cancel any order or change an existing payment, invoice or stock row.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create or replace function public.customer_cancel_order_v1(
  p_customer_id text, p_order_id text, p_reason text default null
) returns jsonb language plpgsql volatile security invoker set search_path=''
as $function$
declare
  v_order public."DON_HANG"%rowtype;
  v_paid numeric;
  v_real_paid numeric;
  v_payment public."THANH_TOAN"%rowtype;
  v_detail jsonb;
begin
  if p_customer_id is null or length(btrim(p_customer_id)) not between 1 and 100
    or p_order_id is null or length(btrim(p_order_id)) not between 1 and 100
    or (p_reason is not null and (length(btrim(p_reason))>500 or p_reason ~ '[[:cntrl:]]')) then
    return jsonb_build_object('error',jsonb_build_object('code','VALIDATION_ERROR'));
  end if;

  select * into v_order from public."DON_HANG"
    where ma_donhang=p_order_id and ma_kh=p_customer_id for update;
  if not found then
    return jsonb_build_object('error',jsonb_build_object('code','ORDER_NOT_FOUND'));
  end if;
  if v_order.trang_thai not in ('MOI','XAC_NHAN','DANG_CHUAN_BI','HUY') then
    return jsonb_build_object('error',jsonb_build_object('code','ORDER_NOT_CANCELABLE'));
  end if;

  if v_order.trang_thai <> 'HUY' then
    -- Payment writers serialize on the same order row. A refund of real money
    -- must be verified by staff/provider; never manufacture a successful refund.
    select coalesce(sum(case when loai_giao_dich='THU' then so_tien else -so_tien end),0),
      coalesce(sum(case when not la_bypass then
        case when loai_giao_dich='THU' then so_tien else -so_tien end else 0 end),0)
      into v_paid,v_real_paid from public."THANH_TOAN"
      where ma_donhang=p_order_id and trang_thai='THANH_CONG';
    if v_real_paid>0 then
      return jsonb_build_object('error',jsonb_build_object('code','ORDER_REFUND_REQUIRED'));
    end if;
    -- Preserve simulated-payment cancellation for the existing demo workflow.
    if v_paid>0 then
      select * into v_payment from public."THANH_TOAN"
        where ma_donhang=p_order_id and trang_thai='THANH_CONG' and loai_giao_dich='THU' and la_bypass
        order by thoi_gian desc,ma_thanh_toan desc limit 1;
      insert into public."THANH_TOAN"(ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,
        ma_giao_dich,thoi_gian,la_bypass,ma_tk_ghi_nhan)
      values(p_order_id,v_paid,'HOAN_TIEN',v_payment.phuong_thuc,'THANH_CONG',
        'REFUND-DEMO-'||gen_random_uuid()::text,statement_timestamp(),true,v_payment.ma_tk_ghi_nhan);
    end if;
    if to_regclass('payment_demo.attempts') is not null then
      update payment_demo.attempts set status='failed',updated_at=statement_timestamp()
        where order_id=p_order_id and customer_id=p_customer_id and status='pending';
    end if;
    update public."SU_DUNG_VOUCHER" set trang_thai='DA_HUY',thoi_gian_huy=statement_timestamp()
      where ma_donhang=p_order_id and trang_thai='DA_AP_DUNG';
    update public."DON_HANG" set trang_thai='HUY' where ma_donhang=p_order_id;
  end if;

  -- Read inside the same transaction. A failed representation rolls back every
  -- write above. The v2 contract remains valid on older databases as well.
  v_detail:=public.customer_read_orders_v2(p_customer_id,p_order_id,1,1,'VND')->'order';
  if v_detail is null or v_detail->>'id' is distinct from p_order_id or v_detail->>'status' is distinct from 'HUY' then
    raise exception 'Invalid cancelled order snapshot' using errcode='23514';
  end if;
  return jsonb_build_object('order',v_detail);
end;
$function$;
revoke all on function public.customer_cancel_order_v1(text,text,text) from public,anon,authenticated;
grant execute on function public.customer_cancel_order_v1(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
