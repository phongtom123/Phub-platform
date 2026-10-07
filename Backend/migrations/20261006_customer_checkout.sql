-- REVIEW WITH THE DATABASE / PROMOTION / WAREHOUSE TEAM BEFORE APPLYING.
-- Apply 20261004_customer_orders.sql first. New functions only; no shared columns,
-- generators, triggers or physical stock are changed. Never apply test fixtures.
BEGIN;
DO $$
BEGIN
    IF to_regclass('customer_order_private.idempotency') IS NULL THEN
        RAISE EXCEPTION 'Apply the reviewed customer orders migration first';
    END IF;
    IF pg_get_serial_sequence('public."CT_DON_HANG"', 'ma_ct_donhang') IS NULL
       OR pg_get_serial_sequence('public."SU_DUNG_VOUCHER"', 'ma_su_dung') IS NULL THEN
        RAISE EXCEPTION 'Team-owned detail/voucher-use identity generators are required';
    END IF;
END $$;

CREATE FUNCTION public.customer_checkout_v2(
    p_customer_id text, p_request jsonb, p_key uuid, p_create boolean,
    p_stock_policy text, p_price_tax_mode text, p_tax_rate numeric,
    p_currency text, p_active_status integer, p_tax_application text, p_promotion_timezone text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_item jsonb; v_items jsonb := '[]'; v_lines jsonb := '[]'; v_final_lines jsonb := '[]';
    v_recipient jsonb; v_request jsonb; v_hash text; v_existing customer_order_private.idempotency%ROWTYPE;
    v_inserted integer; v_field text; v_sku text; v_qty integer; v_warehouse integer;
    v_product record; v_candidate record; v_voucher record;
    v_code text; v_voucher_id integer; v_uses bigint; v_customer_uses bigint;
    v_subtotal numeric := 0; v_discount numeric := 0; v_line_total numeric;
    v_cumulative_gross numeric := 0; v_cumulative_discount numeric := 0; v_next_discount numeric;
    v_order_id text; v_created timestamp; v_promotion_now timestamp;
    v_quote jsonb; v_receipt jsonb; v_error text;
BEGIN
    IF p_create IS NULL OR p_customer_id IS NULL OR length(btrim(p_customer_id)) NOT BETWEEN 1 AND 100
       OR p_customer_id ~ '[[:cntrl:]]' OR jsonb_typeof(p_request) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_request->'items') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR';
    END IF;
    IF jsonb_array_length(p_request->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
    IF p_create THEN
        IF p_key IS NULL OR p_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           OR jsonb_typeof(p_request->'recipient') IS DISTINCT FROM 'object'
           OR (p_request - ARRAY['items','recipient','note','voucher_code','expected_discount','expected_total']) <> '{}'::jsonb THEN
            RAISE EXCEPTION 'VALIDATION_ERROR';
        END IF;
        v_recipient := p_request->'recipient';
        FOREACH v_field IN ARRAY ARRAY['name','phone','address_line','province','ward'] LOOP
            IF jsonb_typeof(v_recipient->v_field) IS DISTINCT FROM 'string'
               OR length(btrim(v_recipient->>v_field)) = 0 OR (v_recipient->>v_field) ~ '[[:cntrl:]]'
               OR length(v_recipient->>v_field) > (CASE v_field WHEN 'address_line' THEN 255 ELSE 100 END) THEN
                RAISE EXCEPTION 'VALIDATION_ERROR';
            END IF;
            v_recipient := jsonb_set(v_recipient, ARRAY[v_field], to_jsonb(btrim(v_recipient->>v_field)));
        END LOOP;
        IF (v_recipient - ARRAY['name','phone','address_line','province','ward']) <> '{}'::jsonb
           OR (v_recipient->>'phone') !~ '^\+?[0-9]{8,15}$' THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
        FOREACH v_field IN ARRAY ARRAY['expected_discount','expected_total'] LOOP
            IF jsonb_typeof(p_request->v_field) IS DISTINCT FROM 'string'
               OR (p_request->>v_field) !~ '^[0-9]{1,16}(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
        END LOOP;
        IF p_request ? 'note' AND p_request->'note' <> 'null'::jsonb AND
           (jsonb_typeof(p_request->'note') IS DISTINCT FROM 'string' OR length(p_request->>'note') > 2000
            OR (p_request->>'note') ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
    ELSIF (p_request - ARRAY['items','voucher_code']) <> '{}'::jsonb OR p_key IS NOT NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR';
    END IF;
    IF p_request ? 'voucher_code' AND p_request->'voucher_code' <> 'null'::jsonb THEN
        IF jsonb_typeof(p_request->'voucher_code') IS DISTINCT FROM 'string'
           OR length(p_request->>'voucher_code') > 100 OR (p_request->>'voucher_code') ~ '[[:cntrl:]]' THEN
            RAISE EXCEPTION 'VALIDATION_ERROR';
        END IF;
        v_code := nullif(upper(btrim(p_request->>'voucher_code')), '');
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_request->'items') LOOP
        IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
           OR jsonb_typeof(v_item->'sku') IS DISTINCT FROM 'string'
           OR length(btrim(v_item->>'sku')) NOT BETWEEN 1 AND 100 OR (v_item->>'sku') ~ '[[:cntrl:]]'
           OR jsonb_typeof(v_item->'quantity') IS DISTINCT FROM 'number'
           OR coalesce(v_item->>'quantity','') !~ '^[0-9]{1,4}$'
           OR (v_item->>'quantity')::integer NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
        v_item := jsonb_set(v_item, '{sku}', to_jsonb(btrim(v_item->>'sku')));
        IF p_create THEN
            IF (v_item - ARRAY['sku','quantity','warehouse_id','expected_unit_price']) <> '{}'::jsonb
               OR jsonb_typeof(v_item->'warehouse_id') IS DISTINCT FROM 'number'
               OR coalesce(v_item->>'warehouse_id','') !~ '^-?[0-9]{1,10}$'
               OR (v_item->>'warehouse_id')::numeric NOT BETWEEN -2147483648 AND 2147483647
               OR jsonb_typeof(v_item->'expected_unit_price') IS DISTINCT FROM 'string'
               OR coalesce(v_item->>'expected_unit_price','') !~ '^[0-9]{1,16}(\.[0-9]{1,2})?$' THEN
                RAISE EXCEPTION 'VALIDATION_ERROR';
            END IF;
            v_item := jsonb_set(v_item, '{expected_unit_price}', to_jsonb((v_item->>'expected_unit_price')::numeric(18,2)::text));
        ELSIF (v_item - ARRAY['sku','quantity']) <> '{}'::jsonb THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
        v_items := v_items || jsonb_build_array(v_item);
    END LOOP;
    -- Customer checkout HTTP accepts one line per SKU; the existing /api/orders
    -- body still permits explicit allocations of that SKU to different warehouses.
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_items) i
              GROUP BY i->>'sku', CASE WHEN p_create THEN i->>'warehouse_id' ELSE NULL END HAVING count(*)>1) THEN
        RAISE EXCEPTION 'VALIDATION_ERROR';
    END IF;
    SELECT jsonb_agg(value ORDER BY value->>'sku', (value->>'warehouse_id')::integer) INTO v_items FROM jsonb_array_elements(v_items);
    IF p_create THEN
        v_request := jsonb_build_object('items',v_items,'recipient',v_recipient,'note',nullif(btrim(p_request->>'note'),''),
            'voucher_code',v_code,'expected_discount',(p_request->>'expected_discount')::numeric(18,2)::text,
            'expected_total',(p_request->>'expected_total')::numeric(18,2)::text);
        -- Owner is part of the hash: a key cannot replay another customer's receipt.
        v_hash := encode(sha256(convert_to(jsonb_build_object('version',2,'customer_id',p_customer_id,'request',v_request)::text,'UTF8')),'hex');
        INSERT INTO customer_order_private.idempotency(key,request_hash) VALUES(p_key,v_hash) ON CONFLICT(key) DO NOTHING;
        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        IF v_inserted=0 THEN
            SELECT * INTO STRICT v_existing FROM customer_order_private.idempotency WHERE key=p_key;
            IF v_existing.request_hash <> v_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
            IF v_existing.receipt IS NULL THEN RAISE EXCEPTION 'ORDER_CONFIGURATION_REQUIRED'; END IF;
            RETURN jsonb_build_object('replayed',true,'order',v_existing.receipt);
        END IF;
    END IF;
    IF p_stock_policy IS DISTINCT FROM 'reserve_on_order' OR p_price_tax_mode IS DISTINCT FROM 'exclusive'
       OR p_tax_application IS DISTINCT FROM 'invoice' OR p_tax_rate IS DISTINCT FROM 10::numeric
       OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' OR p_active_status IS NULL
       OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_promotion_timezone) THEN
        RAISE EXCEPTION 'ORDER_CONFIGURATION_REQUIRED';
    END IF;
    PERFORM 1 FROM public."KHACH_HANG" WHERE ma_kh=p_customer_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'AUTH_CUSTOMER_UNAVAILABLE'; END IF;
    v_created := timezone('UTC', statement_timestamp());
    v_promotion_now := timezone(p_promotion_timezone, statement_timestamp());
    IF v_code IS NOT NULL THEN
        -- Serialize global and per-customer voucher limits before inventory locks.
        SELECT v.*,c.ngay_bat_dau,c.ngay_ket_thuc,c.trang_thai AS program_status INTO v_voucher
          FROM public."VOUCHER" v JOIN public."CHUONG_TRINH_KHUYEN_MAI" c USING(ma_ctkm)
          WHERE v.ma_code=v_code FOR UPDATE OF v FOR SHARE OF c;
        IF NOT FOUND OR v_voucher.trang_thai IS DISTINCT FROM 'HOAT_DONG' OR v_voucher.program_status IS DISTINCT FROM 'HOAT_DONG'
           OR v_voucher.ngay_bat_dau IS NULL OR v_voucher.ngay_ket_thuc IS NULL
           OR v_promotion_now < v_voucher.ngay_bat_dau OR v_promotion_now > v_voucher.ngay_ket_thuc THEN
            RAISE EXCEPTION 'VOUCHER_NOT_AVAILABLE';
        END IF;
        v_voucher_id := v_voucher.ma_voucher;
        SELECT count(*), count(*) FILTER(WHERE d.ma_kh=p_customer_id) INTO v_uses,v_customer_uses
          FROM public."SU_DUNG_VOUCHER" u JOIN public."DON_HANG" d USING(ma_donhang)
          WHERE u.ma_voucher=v_voucher_id AND u.trang_thai='DA_AP_DUNG';
        IF (v_voucher.gioi_han_tong_luot IS NOT NULL AND v_uses >= v_voucher.gioi_han_tong_luot)
           OR (v_voucher.gioi_han_moi_khach IS NOT NULL AND v_customer_uses >= v_voucher.gioi_han_moi_khach) THEN
            RAISE EXCEPTION 'VOUCHER_LIMIT_REACHED';
        END IF;
        IF v_voucher.gia_tri_giam IS NULL OR v_voucher.gia_tri_giam < 0
           OR v_voucher.gia_tri_don_toi_thieu IS NULL OR v_voucher.gia_tri_don_toi_thieu < 0
           OR v_voucher.giam_toi_da < 0 OR v_voucher.gioi_han_tong_luot < 0 OR v_voucher.gioi_han_moi_khach < 0
           OR v_voucher.loai_giam IS NULL OR v_voucher.loai_giam NOT IN ('PHAN_TRAM','SO_TIEN')
           OR (v_voucher.loai_giam='PHAN_TRAM' AND v_voucher.gia_tri_giam > 100) THEN
            RAISE EXCEPTION 'ORDER_CONFIGURATION_REQUIRED';
        END IF;
    END IF;
    IF p_create THEN
        PERFORM 1 FROM public."SAN_PHAM" p JOIN public."LOAI_SP" c USING(ma_loai_sp)
          WHERE p.sku IN(SELECT value->>'sku' FROM jsonb_array_elements(v_items)) ORDER BY p.sku FOR SHARE OF p,c;
        -- Same inventory lock order as v1, including all eligible candidates.
        PERFORM 1 FROM public."TON_KHO" t JOIN public."KHO" k USING(ma_kho)
          WHERE t.sku IN(SELECT value->>'sku' FROM jsonb_array_elements(v_items)) AND k.trang_thai=p_active_status
          ORDER BY t.ma_kho,t.sku FOR UPDATE OF t FOR SHARE OF k;
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
        v_sku := v_item->>'sku'; v_qty := (v_item->>'quantity')::integer;
        SELECT p.ten_sp,p.don_vi,p.gia_ban_hien_tai INTO v_product
          FROM public."SAN_PHAM" p JOIN public."LOAI_SP" c USING(ma_loai_sp)
          WHERE p.sku=v_sku AND p.trang_thai=p_active_status AND c.trang_thai=p_active_status;
        IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE'; END IF;
        IF v_product.gia_ban_hien_tai IS NULL OR v_product.gia_ban_hien_tai NOT BETWEEN 0 AND 9999999999999999.99
           OR v_product.ten_sp IS NULL OR length(btrim(v_product.ten_sp))=0
           OR v_product.don_vi IS NULL OR length(btrim(v_product.don_vi))=0 THEN RAISE EXCEPTION 'ORDER_CONFIGURATION_REQUIRED'; END IF;
        v_warehouse := NULL;
        IF p_create THEN
            PERFORM 1 FROM public."KHO" WHERE ma_kho=(v_item->>'warehouse_id')::integer AND trang_thai=p_active_status;
            IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_AVAILABLE'; END IF;
            IF v_product.gia_ban_hien_tai <> (v_item->>'expected_unit_price')::numeric THEN RAISE EXCEPTION 'PRICE_CHANGED'; END IF;
        END IF;
        FOR v_candidate IN
            SELECT t.ma_kho, t.so_luong_ton - coalesce((SELECT sum(ct.so_luong)
               FROM public."CT_DON_HANG" ct JOIN public."DON_HANG" d USING(ma_donhang)
               WHERE ct.sku=t.sku AND ct.ma_kho_xuat=t.ma_kho AND d.trang_thai IN('MOI','XAC_NHAN','DANG_CHUAN_BI')),0) AS available
              FROM public."TON_KHO" t JOIN public."KHO" k USING(ma_kho)
              WHERE t.sku=v_sku AND k.trang_thai=p_active_status
                AND (NOT p_create OR t.ma_kho=(v_item->>'warehouse_id')::integer)
              ORDER BY t.ma_kho
        LOOP
            IF v_candidate.available >= v_qty THEN v_warehouse:=v_candidate.ma_kho; EXIT; END IF;
        END LOOP;
        IF v_warehouse IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
        v_line_total := v_product.gia_ban_hien_tai * v_qty;
        v_subtotal := v_subtotal + v_line_total;
        IF v_line_total NOT BETWEEN 0 AND 9999999999999999.99 OR v_subtotal NOT BETWEEN 0 AND 9999999999999999.99 THEN
            RAISE EXCEPTION 'AMOUNT_OUT_OF_RANGE';
        END IF;
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('sku',v_sku,'warehouse_id',v_warehouse,
            'name',v_product.ten_sp,'unit',v_product.don_vi,'quantity',v_qty,
            'unit_price',v_product.gia_ban_hien_tai::numeric(18,2)::text,'gross_total',v_line_total::numeric(18,2)::text));
    END LOOP;
    IF v_code IS NOT NULL THEN
        IF v_subtotal < v_voucher.gia_tri_don_toi_thieu THEN RAISE EXCEPTION 'VOUCHER_MINIMUM_NOT_MET'; END IF;
        v_discount := CASE v_voucher.loai_giam WHEN 'PHAN_TRAM' THEN round(v_subtotal*v_voucher.gia_tri_giam/100,2) ELSE round(v_voucher.gia_tri_giam,2) END;
        IF v_voucher.loai_giam='PHAN_TRAM' AND v_voucher.giam_toi_da IS NOT NULL THEN v_discount:=least(v_discount,v_voucher.giam_toi_da); END IF;
        v_discount := least(v_discount,v_subtotal);
    END IF;
    IF p_create AND ((p_request->>'expected_discount')::numeric <> v_discount
       OR (p_request->>'expected_total')::numeric <> v_subtotal-v_discount) THEN RAISE EXCEPTION 'CHECKOUT_CHANGED'; END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
        v_cumulative_gross := v_cumulative_gross+(v_item->>'gross_total')::numeric;
        -- Cumulative rounding distributes every cent, without exceeding a line's gross.
        v_next_discount := CASE WHEN v_subtotal=0 THEN 0 ELSE round(v_discount*v_cumulative_gross/v_subtotal,2) END;
        v_final_lines := v_final_lines || jsonb_build_array(v_item || jsonb_build_object(
            'discount',(v_next_discount-v_cumulative_discount)::numeric(18,2)::text,
            'tax_rate','10.00','tax_amount','0.00',
            'line_total',((v_item->>'gross_total')::numeric-v_next_discount+v_cumulative_discount)::numeric(18,2)::text));
        v_cumulative_discount := v_next_discount;
    END LOOP;
    v_quote := jsonb_build_object('items',v_final_lines,'voucher_code',v_code,'currency',p_currency,
        'tax_application','invoice','shipping_status','not_quoted','subtotal',v_subtotal::numeric(18,2)::text,
        'discount_total',v_discount::numeric(18,2)::text,'tax_total','0.00','total',(v_subtotal-v_discount)::numeric(18,2)::text);
    IF NOT p_create THEN RETURN jsonb_build_object('quote',v_quote); END IF;
    v_order_id := gen_random_uuid()::text;
    INSERT INTO public."DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat,ten_nguoi_nhan,sdt_nguoi_nhan,dia_chi_chi_tiet,tinh_thanh,xa_phuong,ghi_chu)
      VALUES(v_order_id,p_customer_id,'ONLINE','MOI',v_created,v_recipient->>'name',v_recipient->>'phone',
             v_recipient->>'address_line',v_recipient->>'province',v_recipient->>'ward',v_request->>'note');
    INSERT INTO public."CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher,thue_suat,tien_thue,thanh_tien)
      SELECT v_order_id,l.sku,l.warehouse_id,l.name,l.unit,l.quantity,l.unit_price,0,l.discount,10,0,l.line_total
        FROM jsonb_to_recordset(v_final_lines) AS l(sku text,warehouse_id integer,name text,unit text,quantity integer,unit_price numeric,discount numeric,line_total numeric);
    IF v_voucher_id IS NOT NULL THEN
        INSERT INTO public."SU_DUNG_VOUCHER"(ma_voucher,ma_donhang,so_tien_giam,thoi_gian_ap_dung,trang_thai)
          VALUES(v_voucher_id,v_order_id,v_discount,v_created,'DA_AP_DUNG');
    END IF;
    v_receipt := v_quote || jsonb_build_object('id',v_order_id,'status','MOI','sales_channel','ONLINE',
        'created_at',to_char(v_created,'YYYY-MM-DD"T"HH24:MI:SS.US')||'Z','recipient',v_recipient,'note',v_request->'note');
    UPDATE customer_order_private.idempotency SET order_id=v_order_id,receipt=v_receipt WHERE key=p_key;
    RETURN jsonb_build_object('replayed',false,'order',v_receipt);
EXCEPTION WHEN raise_exception THEN
    -- Roll back the order, every line, voucher use and idempotency key together.
    v_error:=SQLERRM;
    IF v_error=ANY(ARRAY['VALIDATION_ERROR','AUTH_CUSTOMER_UNAVAILABLE','PRODUCT_NOT_AVAILABLE','WAREHOUSE_NOT_AVAILABLE',
       'PRICE_CHANGED','INSUFFICIENT_STOCK','VOUCHER_NOT_AVAILABLE','VOUCHER_MINIMUM_NOT_MET','VOUCHER_LIMIT_REACHED',
       'CHECKOUT_CHANGED','AMOUNT_OUT_OF_RANGE','ORDER_CONFIGURATION_REQUIRED','IDEMPOTENCY_CONFLICT']) THEN
        RETURN jsonb_build_object('error',jsonb_build_object('code',v_error));
    END IF;
    RAISE;
END $$;

CREATE FUNCTION public.customer_read_orders_v2(p_customer_id text,p_order_id text,p_page integer,p_page_size integer,p_currency text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_result jsonb; v_total bigint;
BEGIN
    IF p_customer_id IS NULL OR length(btrim(p_customer_id)) NOT BETWEEN 1 AND 100
       OR p_page IS NULL OR p_page NOT BETWEEN 1 AND 1000000 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 100
       OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
        RETURN jsonb_build_object('error',jsonb_build_object('code','VALIDATION_ERROR'));
    END IF;
    IF p_order_id IS NOT NULL THEN
        SELECT jsonb_build_object('id',d.ma_donhang,'status',CASE WHEN d.trang_thai IN('MOI','XAC_NHAN','DANG_CHUAN_BI','DA_XUAT_KHO','HOAN_THANH','HUY') THEN d.trang_thai ELSE 'UNKNOWN' END,
           'created_at',to_char(d.thoi_gian_dat,'YYYY-MM-DD"T"HH24:MI:SS.US'),'currency',p_currency,
           'total',coalesce((SELECT sum(ct.thanh_tien)::numeric(18,2)::text FROM public."CT_DON_HANG" ct WHERE ct.ma_donhang=d.ma_donhang),'0.00'),
           'recipient',jsonb_build_object('name',d.ten_nguoi_nhan,'phone',d.sdt_nguoi_nhan,'address_line',d.dia_chi_chi_tiet,'province',d.tinh_thanh,'ward',d.xa_phuong),
           'note',d.ghi_chu,'items',coalesce((SELECT jsonb_agg(jsonb_build_object('sku',ct.sku,'warehouse_id',ct.ma_kho_xuat,
                'name',ct.ten_sp_luc_ban,'unit',ct.don_vi_luc_ban,'quantity',ct.so_luong,'unit_price',ct.don_gia::numeric(18,2)::text,
                'discount',(ct.giam_gia+ct.giam_gia_voucher)::numeric(18,2)::text,'tax_amount',ct.tien_thue::numeric(18,2)::text,
                'line_total',ct.thanh_tien::numeric(18,2)::text) ORDER BY ct.ma_ct_donhang) FROM public."CT_DON_HANG" ct WHERE ct.ma_donhang=d.ma_donhang),'[]'::jsonb))
          INTO v_result FROM public."DON_HANG" d WHERE d.ma_donhang=p_order_id AND d.ma_kh=p_customer_id;
        IF NOT FOUND THEN RETURN jsonb_build_object('error',jsonb_build_object('code','ORDER_NOT_FOUND')); END IF;
        RETURN jsonb_build_object('order',v_result);
    END IF;
    SELECT count(*) INTO v_total FROM public."DON_HANG" WHERE ma_kh=p_customer_id;
    SELECT coalesce(jsonb_agg(row ORDER BY created DESC,id DESC),'[]'::jsonb) INTO v_result FROM (
        SELECT d.ma_donhang AS id,d.thoi_gian_dat AS created,jsonb_build_object('id',d.ma_donhang,
           'status',CASE WHEN d.trang_thai IN('MOI','XAC_NHAN','DANG_CHUAN_BI','DA_XUAT_KHO','HOAN_THANH','HUY') THEN d.trang_thai ELSE 'UNKNOWN' END,
           'created_at',to_char(d.thoi_gian_dat,'YYYY-MM-DD"T"HH24:MI:SS.US'),'currency',p_currency,
           'total',coalesce((SELECT sum(ct.thanh_tien)::numeric(18,2)::text FROM public."CT_DON_HANG" ct WHERE ct.ma_donhang=d.ma_donhang),'0.00')) AS row
          FROM public."DON_HANG" d WHERE d.ma_kh=p_customer_id ORDER BY d.thoi_gian_dat DESC,d.ma_donhang DESC
          LIMIT p_page_size OFFSET (p_page-1)*p_page_size
    ) page;
    RETURN jsonb_build_object('items',v_result,'pagination',jsonb_build_object('page',p_page,'page_size',p_page_size,'total',v_total,
        'total_pages',(v_total+p_page_size-1)/p_page_size));
END $$;

REVOKE ALL ON FUNCTION public.customer_checkout_v2(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_checkout_v2(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.customer_read_orders_v2(text,text,integer,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_read_orders_v2(text,text,integer,integer,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
