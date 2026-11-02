-- Customer checkout can combine every active warehouse. Keep the legacy explicit
-- warehouse RPC intact, and derive this RPC from its installed version so invoice,
-- idempotency, price/voucher validation and locking upgrades remain present.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $upgrade$
declare
  definition text;
  declaration_anchor text := '    v_item jsonb;';
  allocation_start text := '        v_warehouse := NULL;';
  allocation_end text := '        v_line_total := v_product.gia_ban_hien_tai * v_qty;';
  insert_start text := '    INSERT INTO public."CT_DON_HANG"';
  insert_end text := '    IF v_voucher_id IS NOT NULL THEN';
  line_anchor text := $anchor$'unit_price',v_product.gia_ban_hien_tai::numeric(18,2)::text,'gross_total',v_line_total::numeric(18,2)::text$anchor$;
  start_at int;
  end_at int;
  allocation_sql text := $allocation$
        v_warehouse := NULL;
        v_remaining := v_qty;
        IF p_create AND v_product.gia_ban_hien_tai <> (v_item->>'expected_unit_price')::numeric THEN
            RAISE EXCEPTION 'PRICE_CHANGED';
        END IF;
        -- The complete inventory set is already locked in (warehouse, SKU) order
        -- by the inherited create path. Recalculate availability under these locks.
        FOR v_candidate IN
            SELECT t.ma_kho, greatest(0,t.so_luong_ton-coalesce((
                SELECT sum(ct.so_luong) FROM public."CT_DON_HANG" ct
                JOIN public."DON_HANG" d USING(ma_donhang)
                WHERE ct.sku=t.sku AND ct.ma_kho_xuat=t.ma_kho
                  AND d.trang_thai IN('MOI','XAC_NHAN','DANG_CHUAN_BI')
            ),0)) AS available
            FROM public."TON_KHO" t JOIN public."KHO" k USING(ma_kho)
            WHERE t.sku=v_sku AND k.trang_thai=p_active_status
            ORDER BY t.ma_kho
        LOOP
            v_take := least(v_remaining,v_candidate.available)::integer;
            IF v_take=0 THEN CONTINUE; END IF;
            v_warehouse := coalesce(v_warehouse,v_candidate.ma_kho);
            v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
                'sku',v_sku,'warehouse_id',v_candidate.ma_kho,'quantity',v_take));
            v_remaining := v_remaining-v_take;
            EXIT WHEN v_remaining=0;
        END LOOP;
        IF v_remaining<>0 THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
$allocation$;
  insert_sql text := $insert$
    -- Store one physical order line per allocation. Distribute each product's
    -- voucher discount cumulatively so every cent is retained after splitting.
    WITH allocation AS (
        SELECT a.*,sum(a.quantity) OVER (
            PARTITION BY a.sku ORDER BY a.warehouse_id ROWS UNBOUNDED PRECEDING
        ) AS cumulative_quantity
        FROM jsonb_to_recordset(v_allocations) AS a(sku text,warehouse_id integer,quantity integer)
    ), priced AS (
        SELECT a.*,l.name,l.unit,l.unit_price,l.discount AS product_discount,l.quantity AS product_quantity
        FROM allocation a JOIN jsonb_to_recordset(v_final_lines)
          AS l(sku text,name text,unit text,quantity integer,unit_price numeric,discount numeric) USING(sku)
    ), discounted AS (
        SELECT *,round(product_discount*cumulative_quantity/product_quantity,2)
          -round(product_discount*(cumulative_quantity-quantity)/product_quantity,2) AS allocated_discount
        FROM priced
    )
    INSERT INTO public."CT_DON_HANG"(
        ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,
        so_luong,don_gia,giam_gia,giam_gia_voucher,thue_suat,tien_thue,thanh_tien
    ) SELECT v_order_id,sku,warehouse_id,name,unit,quantity,unit_price,
        0,allocated_discount,10,0,quantity*unit_price-allocated_discount
      FROM discounted ORDER BY warehouse_id,sku;
$insert$;
begin
  select pg_get_functiondef(
    'public.customer_checkout_v2(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)'::regprocedure
  ) into definition;
  if strpos(definition,'automatic_checkout_invoice:')=0
     or strpos(definition,'NOT BETWEEN 1 AND 2147483647')=0
     or strpos(definition,declaration_anchor)=0
     or strpos(definition,line_anchor)=0 then
    raise exception 'Apply automatic invoice and stock-based quantity migrations before multi-warehouse checkout';
  end if;
  definition := replace(definition,'FUNCTION public.customer_checkout_v2(',
      'FUNCTION public.customer_checkout_multi_warehouse_v1(');
  definition := replace(definition,declaration_anchor,
      '    v_allocations jsonb := ''[]''; v_remaining integer; v_take integer;'||chr(10)||declaration_anchor);
  definition := replace(definition,
      $anchor$GROUP BY i->>'sku', CASE WHEN p_create THEN i->>'warehouse_id' ELSE NULL END HAVING count(*)>1$anchor$,
      $replacement$GROUP BY i->>'sku' HAVING count(*)>1$replacement$);
  start_at := strpos(definition,allocation_start);
  end_at := strpos(definition,allocation_end);
  if start_at=0 or end_at<=start_at then raise exception 'Unexpected allocation definition'; end if;
  definition := substr(definition,1,start_at-1)||allocation_sql||substr(definition,end_at);
  definition := replace(definition,line_anchor,line_anchor||$allocations$,
            'allocations',(SELECT jsonb_agg(a.value-'sku' ORDER BY (a.value->>'warehouse_id')::integer)
                FROM jsonb_array_elements(v_allocations) AS a(value) WHERE a.value->>'sku'=v_sku)$allocations$);
  start_at := strpos(definition,insert_start);
  end_at := strpos(definition,insert_end);
  if start_at=0 or end_at<=start_at then raise exception 'Unexpected order-line insertion'; end if;
  definition := substr(definition,1,start_at-1)||insert_sql||substr(definition,end_at);
  execute definition;
end $upgrade$;

revoke all on function public.customer_checkout_multi_warehouse_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.customer_checkout_multi_warehouse_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text) to service_role;
notify pgrst,'reload schema';
commit;
