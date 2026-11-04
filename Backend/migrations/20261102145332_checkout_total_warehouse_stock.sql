-- Allocate a cart SKU across active warehouses; preserve checkout locks, vouchers and invoices.
BEGIN;
DO $migration$
DECLARE source text;
 old_block text := $old$            IF v_candidate.available >= v_qty THEN v_warehouse:=v_candidate.ma_kho; EXIT; END IF;
        END LOOP;
        IF v_warehouse IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
        v_line_total := v_product.gia_ban_hien_tai * v_qty;
        v_subtotal := v_subtotal + v_line_total;
        IF v_line_total NOT BETWEEN 0 AND 9999999999999999.99 OR v_subtotal NOT BETWEEN 0 AND 9999999999999999.99 THEN
            RAISE EXCEPTION 'AMOUNT_OUT_OF_RANGE';
        END IF;
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('sku',v_sku,'warehouse_id',v_warehouse,
            'name',v_product.ten_sp,'unit',v_product.don_vi,'quantity',v_qty,
            'unit_price',v_product.gia_ban_hien_tai::numeric(18,2)::text,'gross_total',v_line_total::numeric(18,2)::text));$old$;
 new_block text := $new$            IF v_candidate.available <= 0 THEN CONTINUE; END IF;
            IF p_create AND v_candidate.available < v_qty THEN CONTINUE; END IF;
            v_allocated := least(v_qty::bigint, v_candidate.available)::integer;
            v_line_total := v_product.gia_ban_hien_tai * v_allocated;
            v_subtotal := v_subtotal + v_line_total;
            IF v_line_total NOT BETWEEN 0 AND 9999999999999999.99 OR v_subtotal NOT BETWEEN 0 AND 9999999999999999.99 THEN
                RAISE EXCEPTION 'AMOUNT_OUT_OF_RANGE';
            END IF;
            v_lines := v_lines || jsonb_build_array(jsonb_build_object('sku',v_sku,'warehouse_id',v_candidate.ma_kho,
                'name',v_product.ten_sp,'unit',v_product.don_vi,'quantity',v_allocated,
                'unit_price',v_product.gia_ban_hien_tai::numeric(18,2)::text,'gross_total',v_line_total::numeric(18,2)::text));
            IF jsonb_array_length(v_lines) > 1000 THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
            v_qty := v_qty - v_allocated;
            EXIT WHEN v_qty = 0;
        END LOOP;
        IF v_qty > 0 THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;$new$;
BEGIN
 SELECT replace(pg_get_functiondef('public.customer_checkout_v2(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)'::regprocedure), chr(13), '') INTO source;
 IF position('v_allocated integer;' IN source) > 0 THEN RETURN; END IF;
 IF position(old_block IN source) = 0 THEN RAISE EXCEPTION 'Checkout allocation source changed: review migration'; END IF;
 source := replace(source, old_block, new_block);
 -- Keep existing successful single-warehouse quotes stable. Split only when no
 -- warehouse can fulfill the entire quantity; otherwise choose the first fit.
 source := replace(source, 'FOR v_candidate IN' || chr(10) || '            SELECT t.ma_kho,',
   'FOR v_candidate IN' || chr(10) || '            WITH candidates AS (SELECT t.ma_kho,');
 source := replace(source, '              ORDER BY t.ma_kho' || chr(10) || '        LOOP',
   '            ) SELECT * FROM candidates ORDER BY (available >= v_qty) DESC, ma_kho' || chr(10) || '        LOOP');
 source := replace(source, 'v_product record; v_candidate record; v_voucher record;', 'v_product record; v_candidate record; v_voucher record; v_allocated integer;');
 source := replace(source, 'jsonb_array_length(p_request->''items'') NOT BETWEEN 1 AND 100 THEN', 'jsonb_array_length(p_request->''items'') NOT BETWEEN 1 AND (CASE WHEN p_create THEN 1000 ELSE 100 END) THEN');
 source := replace(source, '''^[0-9]{1,4}$''', '''^[0-9]{1,10}$''');
 source := replace(source, '(v_item->>''quantity'')::integer NOT BETWEEN 1 AND 1000', '(v_item->>''quantity'')::numeric NOT BETWEEN 1 AND 2147483647');
 EXECUTE source;
END $migration$;
NOTIFY pgrst, 'reload schema';
COMMIT;
