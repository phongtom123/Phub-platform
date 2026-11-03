-- Carts and uninvoiced/unpaid drafts do not reserve stock. Inventory is still
-- physically decremented only by dispatch. Do not rewrite historical records.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION customer_order_private.stock_committed(p_order_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public."HOA_DON" WHERE ma_donhang=p_order_id)
 OR EXISTS(SELECT 1 FROM public."THANH_TOAN" WHERE ma_donhang=p_order_id
           AND trang_thai='THANH_CONG' AND loai_giao_dich='THU')
$$;

CREATE OR REPLACE FUNCTION customer_order_private.lock_stock_commitment(p_order_id text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE ord record; line record; stock bigint; reserved bigint;
BEGIN
 SELECT trang_thai INTO ord FROM public."DON_HANG" WHERE ma_donhang=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF ord.trang_thai NOT IN ('MOI','XAC_NHAN','DANG_CHUAN_BI') THEN RETURN; END IF;
 -- An invoice and a payment for the same order represent one reservation.
 IF customer_order_private.stock_committed(p_order_id) THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."CT_DON_HANG" WHERE ma_donhang=p_order_id) THEN
   RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
 PERFORM 1 FROM public."CT_DON_HANG" WHERE ma_donhang=p_order_id ORDER BY ma_ct_donhang FOR UPDATE;
 -- Same deterministic lock order as checkout/dispatch, across all order lines.
 PERFORM 1 FROM public."TON_KHO" t JOIN public."KHO" k USING(ma_kho)
  WHERE (t.ma_kho,t.sku) IN(SELECT ma_kho_xuat,sku FROM public."CT_DON_HANG" WHERE ma_donhang=p_order_id)
  ORDER BY t.ma_kho,t.sku FOR UPDATE OF t FOR SHARE OF k;
 FOR line IN SELECT ma_kho_xuat,sku,sum(so_luong)::bigint AS quantity FROM public."CT_DON_HANG"
  WHERE ma_donhang=p_order_id GROUP BY ma_kho_xuat,sku ORDER BY ma_kho_xuat,sku LOOP
   IF NOT EXISTS(SELECT 1 FROM public."KHO" WHERE ma_kho=line.ma_kho_xuat AND trang_thai=1) THEN
     RAISE EXCEPTION 'WAREHOUSE_NOT_AVAILABLE'; END IF;
   SELECT so_luong_ton INTO stock FROM public."TON_KHO" WHERE ma_kho=line.ma_kho_xuat AND sku=line.sku;
   SELECT coalesce(sum(c.so_luong),0) INTO reserved FROM public."CT_DON_HANG" c
    JOIN public."DON_HANG" d USING(ma_donhang)
    WHERE c.sku=line.sku AND c.ma_kho_xuat=line.ma_kho_xuat AND d.ma_donhang<>p_order_id
     AND d.trang_thai IN('MOI','XAC_NHAN','DANG_CHUAN_BI')
     AND customer_order_private.stock_committed(d.ma_donhang);
   IF stock IS NULL OR stock-reserved<line.quantity THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION customer_order_private.commit_stock_from_finance()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF TG_TABLE_NAME='THANH_TOAN' THEN
   IF NEW.trang_thai<>'THANH_CONG' OR NEW.loai_giao_dich<>'THU' THEN RETURN NEW; END IF;
 END IF;
 PERFORM customer_order_private.lock_stock_commitment(NEW.ma_donhang);
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reserve_stock_on_invoice ON public."HOA_DON";
CREATE TRIGGER reserve_stock_on_invoice BEFORE INSERT ON public."HOA_DON"
 FOR EACH ROW EXECUTE FUNCTION customer_order_private.commit_stock_from_finance();
DROP TRIGGER IF EXISTS reserve_stock_on_payment ON public."THANH_TOAN";
CREATE TRIGGER reserve_stock_on_payment BEFORE INSERT OR UPDATE ON public."THANH_TOAN"
 FOR EACH ROW EXECUTE FUNCTION customer_order_private.commit_stock_from_finance();

-- Update every supported stock checker together, without replacing unrelated
-- voucher, pricing, idempotency, allocation or invoice business logic.
DO $upgrade$
DECLARE fn record; source text; updated text;
 pattern text := $pattern$(d\.trang_thai\s+IN\s*\('MOI',\s*'XAC_NHAN',\s*'DANG_CHUAN_BI'\))$pattern$;
BEGIN
 FOR fn IN SELECT p.oid,p.proname,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prokind='f' AND ((n.nspname='public' AND p.proname IN
   ('customer_checkout_v2','customer_checkout_multi_warehouse_v1','customer_create_order_v1'))
   OR (n.nspname='admin_ops' AND p.proname='available')) LOOP
   source:=pg_get_functiondef(fn.oid);
   IF position('customer_order_private.stock_committed(d.ma_donhang)' IN source)>0 THEN CONTINUE; END IF;
   updated:=regexp_replace(source,pattern,
     E'\\1 AND customer_order_private.stock_committed(d.ma_donhang)','gi');
   IF updated=source THEN RAISE EXCEPTION 'Reservation predicate not found in %.%',fn.nspname,fn.proname; END IF;
   EXECUTE updated;
 END LOOP;
 -- Uncommitted staff drafts must be invoiced/paid before physical dispatch.
 IF to_regprocedure('public.admin_operation_v1(text,text,text,uuid,text,jsonb)') IS NOT NULL THEN
   SELECT pg_get_functiondef('public.admin_operation_v1(text,text,text,uuid,text,jsonb)'::regprocedure) INTO source;
   IF position('stock_committed(order_id)' IN source)=0 THEN
     updated:=replace(source, 'elsif p_action=''dispatch'' then',
       'elsif p_action=''dispatch'' then
    if not customer_order_private.stock_committed(order_id) then raise exception ''INVOICE_REQUIRED''; end if;');
     IF updated=source THEN RAISE EXCEPTION 'Order dispatch guard not found'; END IF;
     EXECUTE updated;
   END IF;
 END IF;
END $upgrade$;

REVOKE ALL ON FUNCTION customer_order_private.stock_committed(text),
 customer_order_private.lock_stock_commitment(text),customer_order_private.commit_stock_from_finance()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION customer_order_private.stock_committed(text),
 customer_order_private.lock_stock_commitment(text),customer_order_private.commit_stock_from_finance() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
