-- Order creation has its own fulfillment RPC; keep its guards and pickup hash.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $upgrade$
declare
 source text; start_at integer; end_at integer;
 signature text:='public.customer_checkout_fulfillment_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)';
begin
 source:=replace(pg_get_functiondef(signature::regprocedure),E'\r\n',E'\n');
 if strpos(source,'voucher_category_scope_v1')>0 then return; end if;
 start_at:=strpos(source,E'    IF v_code IS NOT NULL THEN\n        IF v_subtotal < v_voucher.gia_tri_don_toi_thieu');
 end_at:=strpos(source,'    v_quote := jsonb_build_object(');
 if start_at=0 or end_at<=start_at or strpos(source,E'DECLARE\n')=0 then
   raise exception 'Unexpected fulfillment voucher allocation';
 end if;
 source:=overlay(source placing $replacement$    v_scope_result := customer_order_private.voucher_category_scope_v1(v_lines,v_voucher_id);
    v_discount := (v_scope_result->>'discount')::numeric;
    v_final_lines := v_scope_result->'items';
    IF p_create AND ((p_request->>'expected_discount')::numeric <> v_discount
       OR (p_request->>'expected_total')::numeric <> v_subtotal-v_discount) THEN RAISE EXCEPTION 'CHECKOUT_CHANGED'; END IF;
$replacement$ from start_at for end_at-start_at);
 source:=replace(source,E'DECLARE\n',E'DECLARE\n    v_scope_result jsonb;\n');
 execute source;
end $upgrade$;

-- Keep the response of deployed API versions unchanged (their models forbid
-- unknown fields). New metadata is opt-in through versioned read RPCs.
do $compat$
declare source text; signature text; anchor text:='    v_quote := jsonb_build_object(';
begin
 if to_regprocedure('public.customer_voucher_choices_v2(text,text)') is null then
   source:=pg_get_functiondef('public.customer_voucher_choices_v1(text,text)'::regprocedure);
   if strpos(source,'v.ma_loai_sp_ap_dung as category_id')=0 then raise exception 'Missing voucher category metadata'; end if;
   execute replace(source,'FUNCTION public.customer_voucher_choices_v1(', 'FUNCTION public.customer_voucher_choices_v2(');
 end if;
 source:=pg_get_functiondef('public.customer_voucher_choices_v1(text,text)'::regprocedure);
 execute replace(source,'v.ma_loai_sp_ap_dung as category_id, ', '');
 foreach signature in array array[
   'public.customer_checkout_v2(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)',
   'public.customer_checkout_multi_warehouse_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)',
   'public.customer_checkout_fulfillment_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)'
 ] loop
   source:=replace(pg_get_functiondef(signature::regprocedure),E'\r\n',E'\n');
   if strpos(source,'voucher_categories_hidden_legacy')>0 then continue; end if;
   if strpos(source,anchor)=0 then raise exception 'Missing quote anchor in %',signature; end if;
   source:=replace(source,anchor,$strip$    -- voucher_categories_hidden_legacy: preserve old CheckoutLine responses.
    select coalesce(jsonb_agg(l.value-'category_id' order by l.ordinal),'[]'::jsonb)
      into v_final_lines from jsonb_array_elements(v_final_lines) with ordinality l(value,ordinal);
$strip$||anchor);
   execute source;
 end loop;
end $compat$;

create or replace function public.customer_quote_categories_v1(
 p_customer_id text,p_request jsonb,p_key uuid,p_create boolean,p_stock_policy text,
 p_price_tax_mode text,p_tax_rate numeric,p_currency text,p_active_status integer,
 p_tax_application text,p_promotion_timezone text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; items jsonb;
begin
 if p_create then raise exception 'VALIDATION_ERROR'; end if;
 result:=public.customer_checkout_multi_warehouse_v1(p_customer_id,p_request,p_key,false,
   p_stock_policy,p_price_tax_mode,p_tax_rate,p_currency,p_active_status,p_tax_application,p_promotion_timezone);
 if result ? 'quote' then
   select coalesce(jsonb_agg(l.value||jsonb_build_object('category_id',p.ma_loai_sp) order by l.ordinal),'[]'::jsonb)
     into items from jsonb_array_elements(result->'quote'->'items') with ordinality l(value,ordinal)
     join public."SAN_PHAM" p on p.sku=l.value->>'sku';
   result:=jsonb_set(result,'{quote,items}',items);
 end if;
 return result;
end $$;
revoke all on function public.customer_quote_categories_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text),
 public.customer_voucher_choices_v2(text,text) from public,anon,authenticated;
grant execute on function public.customer_quote_categories_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text),
 public.customer_voucher_choices_v2(text,text) to service_role;
notify pgrst,'reload schema';
commit;
