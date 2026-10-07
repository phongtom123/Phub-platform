-- REVIEW WITH THE DATABASE / WAREHOUSE TEAM BEFORE APPLYING.
-- New objects only. Existing table definitions and stock values are unchanged.
-- Approved rules: prices exclude VAT, VAT 10% at invoicing, physical stock at dispatch.
BEGIN;

DO $$
BEGIN
    IF pg_get_serial_sequence('public."CT_DON_HANG"', 'ma_ct_donhang') IS NULL THEN
        RAISE EXCEPTION 'CT_DON_HANG.ma_ct_donhang needs the team-owned identity/serial generator; migration does not change it';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        RAISE EXCEPTION 'Supabase service_role is required';
    END IF;
END $$;

CREATE SCHEMA customer_order_private;
REVOKE ALL ON SCHEMA customer_order_private FROM PUBLIC;
GRANT USAGE ON SCHEMA customer_order_private TO service_role;

CREATE TABLE customer_order_private.idempotency (
    key uuid PRIMARY KEY,
    request_hash text NOT NULL CHECK (length(request_hash) = 64),
    order_id varchar REFERENCES public."DON_HANG"(ma_donhang),
    receipt jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((order_id IS NULL AND receipt IS NULL) OR (order_id IS NOT NULL AND receipt IS NOT NULL))
);
ALTER TABLE customer_order_private.idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON customer_order_private.idempotency FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON customer_order_private.idempotency TO service_role;

CREATE FUNCTION public.customer_create_order_v1(
    p_key uuid, p_request jsonb, p_stock_policy text, p_price_tax_mode text,
    p_tax_rate numeric, p_currency text, p_active_status integer, p_tax_application text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_recipient jsonb;
    v_request jsonb;
    v_item jsonb;
    v_items jsonb := '[]'::jsonb;
    v_lines jsonb := '[]'::jsonb;
    v_product record;
    v_field text;
    v_hash text;
    v_existing customer_order_private.idempotency%ROWTYPE;
    v_inserted integer;
    v_sku text;
    v_warehouse integer;
    v_quantity integer;
    v_expected numeric;
    v_stock integer;
    v_reserved bigint;
    v_line_total numeric;
    v_subtotal numeric := 0;
    v_order_id text;
    v_created timestamp without time zone;
    v_receipt jsonb;
    v_error text;
BEGIN
    IF p_key IS NULL OR p_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR';
    END IF;
    IF jsonb_typeof(p_request) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_request->'recipient') IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_request->'items') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR';
    END IF;
    IF jsonb_array_length(p_request->'items') NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR';
    END IF;
    v_recipient := p_request->'recipient';
    FOREACH v_field IN ARRAY ARRAY['name','phone','address_line','province','ward'] LOOP
        IF jsonb_typeof(v_recipient->v_field) IS DISTINCT FROM 'string'
           OR length(btrim(v_recipient->>v_field)) = 0
           OR (v_recipient->>v_field) ~ '[[:cntrl:]]'
           OR length(v_recipient->>v_field) > (CASE v_field WHEN 'address_line' THEN 255 ELSE 100 END) THEN
            RAISE EXCEPTION 'VALIDATION_ERROR';
        END IF;
        v_recipient := jsonb_set(v_recipient, ARRAY[v_field], to_jsonb(btrim(v_recipient->>v_field)));
    END LOOP;
    IF (v_recipient->>'phone') !~ '^\+?[0-9]{8,15}$' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR';
    END IF;
    IF p_request ? 'note' AND p_request->'note' <> 'null'::jsonb THEN
        IF jsonb_typeof(p_request->'note') IS DISTINCT FROM 'string'
           OR length(p_request->>'note') > 2000 OR (p_request->>'note') ~ '[[:cntrl:]]' THEN
            RAISE EXCEPTION 'VALIDATION_ERROR';
        END IF;
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_request->'items') LOOP
        IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
           OR jsonb_typeof(v_item->'sku') IS DISTINCT FROM 'string'
           OR length(btrim(v_item->>'sku')) NOT BETWEEN 1 AND 100
           OR (v_item->>'sku') ~ '[[:cntrl:]]'
           OR jsonb_typeof(v_item->'warehouse_id') IS DISTINCT FROM 'number'
           OR coalesce(v_item->>'warehouse_id', '') !~ '^-?[0-9]{1,10}$'
           OR jsonb_typeof(v_item->'quantity') IS DISTINCT FROM 'number'
           OR coalesce(v_item->>'quantity', '') !~ '^[0-9]{1,4}$'
           OR jsonb_typeof(v_item->'expected_unit_price') IS DISTINCT FROM 'string'
           OR coalesce(v_item->>'expected_unit_price', '') !~ '^[0-9]{1,16}(\.[0-9]{1,2})?$' THEN
            RAISE EXCEPTION 'VALIDATION_ERROR';
        END IF;
        IF (v_item->>'warehouse_id')::numeric NOT BETWEEN -2147483648 AND 2147483647
           OR (v_item->>'quantity')::integer NOT BETWEEN 1 AND 1000 THEN
            RAISE EXCEPTION 'VALIDATION_ERROR';
        END IF;
        v_items := v_items || jsonb_build_array(jsonb_build_object(
            'sku', btrim(v_item->>'sku'), 'warehouse_id', (v_item->>'warehouse_id')::integer,
            'quantity', (v_item->>'quantity')::integer,
            'expected_unit_price', (v_item->>'expected_unit_price')::numeric(18,2)::text
        ));
    END LOOP;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) i
               GROUP BY i->>'sku', i->>'warehouse_id' HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'VALIDATION_ERROR';
    END IF;
    SELECT jsonb_agg(value ORDER BY (value->>'warehouse_id')::integer, value->>'sku')
      INTO v_items FROM jsonb_array_elements(v_items);
    v_request := jsonb_build_object('recipient', v_recipient, 'items', v_items,
                                  'note', nullif(btrim(p_request->>'note'), ''));
    v_hash := encode(sha256(convert_to(v_request::text, 'UTF8')), 'hex');

    -- The unique insert waits for a competing request with this key to commit.
    INSERT INTO customer_order_private.idempotency(key, request_hash)
      VALUES (p_key, v_hash) ON CONFLICT (key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
        SELECT * INTO STRICT v_existing FROM customer_order_private.idempotency WHERE key = p_key;
        IF v_existing.request_hash <> v_hash THEN
            RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';
        END IF;
        IF v_existing.receipt IS NULL THEN
            RAISE EXCEPTION 'ORDER_CONFIGURATION_REQUIRED';
        END IF;
        RETURN jsonb_build_object('replayed', true, 'order', v_existing.receipt);
    END IF;
    IF p_stock_policy IS DISTINCT FROM 'reserve_on_order'
       OR p_price_tax_mode IS DISTINCT FROM 'exclusive'
       OR p_tax_application IS DISTINCT FROM 'invoice'
       OR p_tax_rate IS DISTINCT FROM 10::numeric
       OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' OR p_active_status IS NULL THEN
        RAISE EXCEPTION 'ORDER_CONFIGURATION_REQUIRED';
    END IF;

    -- Stable inventory lock order prevents order-vs-order cyclic lock ordering.
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
        v_sku := v_item->>'sku';
        v_warehouse := (v_item->>'warehouse_id')::integer;
        v_quantity := (v_item->>'quantity')::integer;
        v_expected := (v_item->>'expected_unit_price')::numeric;
        SELECT p.ten_sp, p.don_vi, p.gia_ban_hien_tai INTO v_product
          FROM public."SAN_PHAM" p JOIN public."LOAI_SP" c ON c.ma_loai_sp = p.ma_loai_sp
          WHERE p.sku = v_sku AND p.trang_thai = p_active_status AND c.trang_thai = p_active_status
          FOR SHARE OF p, c;
        IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE'; END IF;
        IF v_product.gia_ban_hien_tai <> v_expected THEN RAISE EXCEPTION 'PRICE_CHANGED'; END IF;
        PERFORM 1 FROM public."KHO" WHERE ma_kho = v_warehouse AND trang_thai = p_active_status FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_AVAILABLE'; END IF;
        SELECT so_luong_ton INTO v_stock FROM public."TON_KHO"
          WHERE ma_kho = v_warehouse AND sku = v_sku FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
        -- Physical stock is changed ONLY by the warehouse dispatch workflow.
        -- Pending order lines provide reservations, including orders from staff.
        SELECT coalesce(sum(ct.so_luong), 0) INTO v_reserved
          FROM public."CT_DON_HANG" ct JOIN public."DON_HANG" d USING (ma_donhang)
          WHERE ct.sku = v_sku AND ct.ma_kho_xuat = v_warehouse
            AND d.trang_thai IN ('MOI', 'XAC_NHAN', 'DANG_CHUAN_BI');
        IF v_stock - v_reserved < v_quantity THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
        v_line_total := v_product.gia_ban_hien_tai * v_quantity;
        v_subtotal := v_subtotal + v_line_total;
        IF v_line_total NOT BETWEEN 0 AND 9999999999999999.99
           OR v_subtotal NOT BETWEEN 0 AND 9999999999999999.99 THEN
            RAISE EXCEPTION 'AMOUNT_OUT_OF_RANGE';
        END IF;
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
            'sku', v_sku, 'warehouse_id', v_warehouse, 'name', v_product.ten_sp,
            'unit', v_product.don_vi, 'quantity', v_quantity,
            'unit_price', v_product.gia_ban_hien_tai::numeric(18,2)::text,
            'tax_rate', '10.00', 'tax_amount', '0.00', 'line_total', v_line_total::numeric(18,2)::text
        ));
    END LOOP;
    v_order_id := gen_random_uuid()::text;
    v_created := timezone('UTC', statement_timestamp());
    INSERT INTO public."DON_HANG" (
        ma_donhang, kenh_ban, trang_thai, thoi_gian_dat,
        ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_chi_tiet, tinh_thanh, xa_phuong, ghi_chu
    ) VALUES (
        v_order_id, 'ONLINE', 'MOI', v_created,
        v_recipient->>'name', v_recipient->>'phone', v_recipient->>'address_line',
        v_recipient->>'province', v_recipient->>'ward', v_request->>'note'
    );
    INSERT INTO public."CT_DON_HANG" (
        ma_donhang, sku, ma_kho_xuat, ten_sp_luc_ban, don_vi_luc_ban, so_luong,
        don_gia, giam_gia, giam_gia_voucher, thue_suat, tien_thue, thanh_tien
    ) SELECT v_order_id, l.sku, l.warehouse_id, l.name, l.unit, l.quantity,
             l.unit_price, 0, 0, 10, 0, l.line_total
        FROM jsonb_to_recordset(v_lines) AS l(
            sku text, warehouse_id integer, name text, unit text, quantity integer,
            unit_price numeric, tax_rate numeric, tax_amount numeric, line_total numeric
        );
    v_receipt := jsonb_build_object(
        'id', v_order_id, 'status', 'MOI', 'sales_channel', 'ONLINE',
        'created_at', to_char(v_created, 'YYYY-MM-DD"T"HH24:MI:SS.US') || 'Z',
        'currency', p_currency, 'tax_application', 'invoice',
        'recipient', v_recipient, 'note', v_request->'note', 'items', v_lines,
        'subtotal', v_subtotal::numeric(18,2)::text, 'tax_total', '0.00', 'total', v_subtotal::numeric(18,2)::text
    );
    UPDATE customer_order_private.idempotency SET order_id = v_order_id, receipt = v_receipt WHERE key = p_key;
    RETURN jsonb_build_object('replayed', false, 'order', v_receipt);
EXCEPTION WHEN raise_exception THEN
    -- Entering this handler rolls back EVERY write above, including the key.
    v_error := SQLERRM;
    IF v_error = ANY(ARRAY['VALIDATION_ERROR','PRODUCT_NOT_AVAILABLE','WAREHOUSE_NOT_AVAILABLE',
                         'PRICE_CHANGED','INSUFFICIENT_STOCK','IDEMPOTENCY_CONFLICT',
                         'AMOUNT_OUT_OF_RANGE','ORDER_CONFIGURATION_REQUIRED']) THEN
        RETURN jsonb_build_object('error', jsonb_build_object('code', v_error));
    END IF;
    RAISE;
END $$;

REVOKE ALL ON FUNCTION public.customer_create_order_v1(uuid,jsonb,text,text,numeric,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_create_order_v1(uuid,jsonb,text,text,numeric,text,integer,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
