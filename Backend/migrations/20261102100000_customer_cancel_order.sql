-- PHUB: Khach hang huy don hang (cho ca don chua thanh toan va da thanh toan).
-- Chi ap dung khi don chua xuat kho (MOI, XAC_NHAN, DANG_CHUAN_BI).
-- Don da thanh toan: tu dong ghi nhan khoan HOAN_TIEN vao THANH_TOAN.
-- Ton kho kha dung tu dong duoc giai phong; voucher duoc danh dau DA_HUY.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- 1. Cap nhat helper format thong bao giao dich cua payment_demo de hien thi ro rang khoan hoan tien
create or replace function payment_demo.business_transaction_json(p public."THANH_TOAN")
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
   'type',case p.loai_giao_dich when 'THU' then 'collection' when 'HOAN_TIEN' then 'refund' else 'unknown' end,
   'method',case p.phuong_thuc when 'TIEN_MAT' then 'cash' when 'CHUYEN_KHOAN' then 'bank_transfer' when 'THE' then 'card' when 'VI_DIEN_TU' then 'e_wallet' else 'unknown' end,
   'amount',p.so_tien::text,
   'status',case p.trang_thai when 'THANH_CONG' then 'succeeded' when 'CHO_XU_LY' then 'pending' when 'THAT_BAI' then 'failed' else 'unknown' end,
   'occurred_at',p.thoi_gian,
   'message',case
     when p.loai_giao_dich = 'HOAN_TIEN' and p.trang_thai = 'THANH_CONG'
       then 'Khoản hoàn tiền đã được ghi nhận thành công do hủy đơn hàng.'
     when p.loai_giao_dich = 'HOAN_TIEN' and p.trang_thai = 'CHO_XU_LY'
       then 'Khoản hoàn tiền đang được xử lý.'
     when p.la_bypass then 'Thanh toán bypass đã được ghi vào hệ thống; không qua cổng thanh toán.'
     when p.trang_thai = 'THANH_CONG' then 'Giao dịch đã được ghi nhận thành công.'
     when p.trang_thai = 'CHO_XU_LY' then 'Giao dịch đang chờ xử lý.'
     else 'Giao dịch chưa được xác nhận thành công.' end)
$$;

revoke all on function payment_demo.business_transaction_json(public."THANH_TOAN") from public, anon, authenticated;
grant execute on function payment_demo.business_transaction_json(public."THANH_TOAN") to service_role;

-- 2. Tao RPC customer_cancel_order_v1
create or replace function public.customer_cancel_order_v1(
  p_customer_id text,
  p_order_id text,
  p_reason text default null
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_order public."DON_HANG"%rowtype;
  v_paid numeric := 0;
  v_last_payment public."THANH_TOAN"%rowtype;
  v_account_id varchar;
  v_created timestamptz := clock_timestamp();
  v_currency text := 'VND';
  v_detail jsonb;
begin
  if p_customer_id is null or length(btrim(p_customer_id)) not between 1 and 100
     or p_order_id is null or length(btrim(p_order_id)) not between 1 and 100 then
    return jsonb_build_object('error', jsonb_build_object('code', 'VALIDATION_ERROR'));
  end if;

  if p_reason is not null and (length(btrim(p_reason)) > 500 or p_reason ~ '[[:cntrl:]]') then
    return jsonb_build_object('error', jsonb_build_object('code', 'VALIDATION_ERROR'));
  end if;

  -- Khoa don hang cua dung khach hang de xu ly tuan tu, chong race-condition
  select * into v_order from public."DON_HANG"
   where ma_donhang = p_order_id and ma_kh = p_customer_id
     for update;
  if not found then
    return jsonb_build_object('error', jsonb_build_object('code', 'ORDER_NOT_FOUND'));
  end if;

  if v_order.trang_thai = 'HUY' then
    return jsonb_build_object('error', jsonb_build_object('code', 'ORDER_ALREADY_CANCELLED'));
  end if;

  if v_order.trang_thai in ('DA_XUAT_KHO', 'HOAN_THANH') then
    return jsonb_build_object('error', jsonb_build_object('code', 'ORDER_NOT_CANCELABLE'));
  end if;

  if v_order.trang_thai not in ('MOI', 'XAC_NHAN', 'DANG_CHUAN_BI') then
    return jsonb_build_object('error', jsonb_build_object('code', 'ORDER_NOT_CANCELABLE'));
  end if;

  -- Tinh so tien thuc te da thu ma chua hoan (loai bo giao dich that bai)
  select coalesce(sum(case when loai_giao_dich = 'THU' then so_tien else -so_tien end), 0)
    into v_paid
    from public."THANH_TOAN"
   where ma_donhang = p_order_id and trang_thai = 'THANH_CONG';

  -- Neu don da thanh toan (v_paid > 0), ghi nhan giao dich HOAN_TIEN
  if v_paid > 0 then
    select * into v_last_payment
      from public."THANH_TOAN"
     where ma_donhang = p_order_id and trang_thai = 'THANH_CONG' and loai_giao_dich = 'THU'
     order by thoi_gian desc, ma_thanh_toan desc limit 1;

    select ma_tk into v_account_id
      from public."TAI_KHOAN"
     where ma_kh = p_customer_id and trang_thai = 1
     limit 1;

    insert into public."THANH_TOAN"(
      ma_donhang, so_tien, loai_giao_dich, phuong_thuc, trang_thai,
      ma_giao_dich, thoi_gian, la_bypass, ma_tk_ghi_nhan
    ) values (
      p_order_id,
      v_paid,
      'HOAN_TIEN',
      coalesce(v_last_payment.phuong_thuc, 'CHUYEN_KHOAN'),
      'THANH_CONG',
      'REFUND-' || gen_random_uuid()::text,
      v_created,
      coalesce(v_last_payment.la_bypass, false),
      case when coalesce(v_last_payment.la_bypass, false)
           then coalesce(v_last_payment.ma_tk_ghi_nhan, v_account_id)
           else null end
    );
  end if;

  -- Huy bat ky attempt dang pending nao trong payment_demo neu co
  if to_regclass('payment_demo.attempts') is not null then
    update payment_demo.attempts
       set status = 'failed', updated_at = v_created
     where order_id = p_order_id and customer_id = p_customer_id and status = 'pending';
  end if;

  -- Hoan lai trang thai su dung voucher neu don co dung voucher
  update public."SU_DUNG_VOUCHER"
     set trang_thai = 'DA_HUY', thoi_gian_huy = statement_timestamp()
   where ma_donhang = p_order_id and trang_thai = 'DA_AP_DUNG';

  -- Chuyen trang thai don sang HUY (ton kho kha dung tu dong duoc giai phong vi khong con trong MOI/XAC_NHAN/DANG_CHUAN_BI)
  update public."DON_HANG"
     set trang_thai = 'HUY'
   where ma_donhang = p_order_id;

  -- Tra ve chi tiet don hang da cap nhat
  select public.customer_read_orders_v2(p_customer_id, p_order_id, 1, 1, v_currency) -> 'order'
    into v_detail;

  return jsonb_build_object('order', v_detail);
end;
$$;

revoke all on function public.customer_cancel_order_v1(text, text, text) from public, anon, authenticated;
grant execute on function public.customer_cancel_order_v1(text, text, text) to service_role;

notify pgrst, 'reload schema';
commit;

