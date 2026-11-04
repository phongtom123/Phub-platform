-- Online checkout creates its invoice in the same transaction as the order.
-- Existing orders/invoices and the pre-tax checkout receipt stay unchanged.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public."HOA_DON"
  add column nguon_lap varchar not null default 'QUAN_TRI',
  alter column nguoi_lap drop not null;
alter table public."HOA_DON" add constraint invoice_issuer_source check (
  (nguon_lap = 'QUAN_TRI' and nguoi_lap is not null)
  or (nguon_lap = 'TU_DONG' and nguoi_lap is null)
);

do $upgrade$
declare
  definition text;
  anchor text := '    v_receipt := v_quote || jsonb_build_object(';
  automatic_invoice text := $invoice$
    -- automatic_checkout_invoice: after lines/voucher, before receipt/commit.
    IF (SELECT sum(so_luong*don_gia-giam_gia-giam_gia_voucher
          +round((so_luong*don_gia-giam_gia-giam_gia_voucher)*thue_suat/100,2))
        FROM public."CT_DON_HANG" WHERE ma_donhang=v_order_id) > 9999999999999999.99 THEN
        RAISE EXCEPTION 'AMOUNT_OUT_OF_RANGE';
    END IF;
    UPDATE public."CT_DON_HANG"
      SET tien_thue=round((so_luong*don_gia-giam_gia-giam_gia_voucher)*thue_suat/100,2),
          thanh_tien=so_luong*don_gia-giam_gia-giam_gia_voucher
            +round((so_luong*don_gia-giam_gia-giam_gia_voucher)*thue_suat/100,2)
      WHERE ma_donhang=v_order_id;
    INSERT INTO public."HOA_DON"(
      ma_hoadon,ma_donhang,thoi_gian_lap,ten_nguoi_mua,dia_chi_nguoi_mua,
      tong_tien_giam,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,
      nguoi_lap,nguon_lap
    ) SELECT 'HD-'||v_order_id,v_order_id,statement_timestamp(),v_recipient->>'name',
      concat_ws(', ',v_recipient->>'address_line',v_recipient->>'ward',v_recipient->>'province'),
      sum(giam_gia+giam_gia_voucher),sum(so_luong*don_gia-giam_gia-giam_gia_voucher),
      sum(tien_thue),sum(thanh_tien),null,'TU_DONG'
      FROM public."CT_DON_HANG" WHERE ma_donhang=v_order_id;
$invoice$;
begin
  select pg_get_functiondef(
    'public.customer_checkout_v2(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)'::regprocedure
  ) into definition;
  if strpos(definition,'automatic_checkout_invoice:') > 0
     or (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then
    raise exception 'Unexpected checkout definition; automatic invoice migration not applied';
  end if;
  -- CREATE OR REPLACE preserves the signature, existing ACLs, row locks,
  -- owner checks, idempotency and all warehouse/pricing changes already installed.
  execute replace(definition,anchor,automatic_invoice||anchor);
end $upgrade$;

notify pgrst, 'reload schema';
commit;
