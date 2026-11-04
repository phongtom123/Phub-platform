-- A new RPC keeps older deployed checkout/read contracts unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public."DON_HANG" add column phuong_thuc_nhan varchar
 check (phuong_thuc_nhan in ('GIAO_HANG','TAI_CUA_HANG'));
comment on column public."DON_HANG".phuong_thuc_nhan is
 'Fulfillment method for new online checkout; NULL for historical/other channels. Independent of kenh_ban and warehouse allocation.';

do $upgrade$
declare definition text; anchor text;
begin
 select replace(pg_get_functiondef('public.customer_checkout_multi_warehouse_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)'::regprocedure),E'\r\n',E'\n') into definition;
 if strpos(definition,'automatic_checkout_invoice:')=0 or strpos(definition,'stock_committed')=0 then
  raise exception 'Apply pooled-stock invoice commitment migrations first';
 end if;
 definition := replace(definition,'FUNCTION public.customer_checkout_multi_warehouse_v1(', 'FUNCTION public.customer_checkout_fulfillment_v1(');
 definition := replace(definition,'    v_item jsonb;', '    v_method text;'||chr(10)||'    v_item jsonb;');
 anchor := '    IF p_create THEN';
 if strpos(definition,anchor)=0 then raise exception 'Missing checkout validation anchor'; end if;
 -- Initialize the method before any recipient validation. Quotes still accept
 -- only items/voucher; no new flags are accepted on the quote contract.
 definition := overlay(definition placing $method$    IF p_create THEN
        v_method := coalesce(p_request->>'fulfillment_method','GIAO_HANG');
        IF v_method NOT IN ('GIAO_HANG','TAI_CUA_HANG') OR
          (p_request ? 'fulfillment_method' AND jsonb_typeof(p_request->'fulfillment_method') IS DISTINCT FROM 'string') THEN
          RAISE EXCEPTION 'VALIDATION_ERROR';
        END IF;$method$ from strpos(definition,anchor) for length(anchor));
 anchor := $keys$ARRAY['items','recipient','note','voucher_code','expected_discount','expected_total']$keys$;
 if strpos(definition,anchor)=0 then raise exception 'Missing allowed-field anchor'; end if;
 definition := replace(definition,anchor,$keys$ARRAY['items','recipient','note','voucher_code','expected_discount','expected_total','fulfillment_method']$keys$);
 anchor := $keys$ARRAY['name','phone','address_line','province','ward']$keys$;
 if strpos(definition,anchor)=0 then raise exception 'Missing recipient validation anchor'; end if;
 definition := replace(definition,anchor,$keys$(CASE WHEN v_method='TAI_CUA_HANG' THEN ARRAY['name','phone'] ELSE ARRAY['name','phone','address_line','province','ward'] END)$keys$);
 anchor := '        -- Owner is part of the hash:';
 if strpos(definition,anchor)=0 then raise exception 'Missing idempotency anchor'; end if;
 definition := replace(definition,anchor,$canonical$        -- Shipping keeps its legacy hash; pickup is a distinct request and
        -- never hashes a fabricated shipping address or mutable store settings.
        IF v_method='TAI_CUA_HANG' THEN
          v_request := v_request || jsonb_build_object('fulfillment_method',v_method);
        END IF;
$canonical$||anchor);
 anchor := 'xa_phuong,ghi_chu)';
 if strpos(definition,anchor)=0 then raise exception 'Missing order columns anchor'; end if;
 definition := replace(definition,anchor,'xa_phuong,ghi_chu,phuong_thuc_nhan)');
 anchor := $values$v_recipient->>'ward',v_request->>'note');$values$;
 if strpos(definition,anchor)=0 then raise exception 'Missing order values anchor'; end if;
 definition := replace(definition,anchor,$values$v_recipient->>'ward',v_request->>'note',v_method);$values$);
 anchor := '    UPDATE customer_order_private.idempotency SET order_id=v_order_id,receipt=v_receipt';
 if strpos(definition,anchor)=0 then raise exception 'Missing receipt anchor'; end if;
 definition := replace(definition,anchor,
  '    v_receipt := v_receipt || jsonb_build_object(''fulfillment_method'',v_method);'||chr(10)||anchor);
 execute definition;
end $upgrade$;

create function public.customer_read_orders_v4(p_customer_id text,p_order_id text default null,
 p_page int default 1,p_page_size int default 20,p_currency text default 'VND')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare result jsonb;
begin
 result := public.customer_read_orders_v3(p_customer_id,p_order_id,p_page,p_page_size,p_currency);
 if result ? 'order' then
  result := jsonb_set(result,'{order}',(result->'order') || jsonb_build_object('fulfillment_method',
   (select phuong_thuc_nhan from public."DON_HANG" where ma_donhang=result->'order'->>'id' and ma_kh=p_customer_id)));
 elsif result ? 'items' then
  result := jsonb_set(result,'{items}',coalesce((select jsonb_agg(item || jsonb_build_object('fulfillment_method',
   (select phuong_thuc_nhan from public."DON_HANG" where ma_donhang=item->>'id' and ma_kh=p_customer_id)) order by position)
   from jsonb_array_elements(result->'items') with ordinality as rows(item,position)),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.customer_checkout_fulfillment_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text),
 public.customer_read_orders_v4(text,text,integer,integer,text) from public,anon,authenticated;
grant execute on function public.customer_checkout_fulfillment_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text),
 public.customer_read_orders_v4(text,text,integer,integer,text) to service_role;
notify pgrst,'reload schema';
commit;
