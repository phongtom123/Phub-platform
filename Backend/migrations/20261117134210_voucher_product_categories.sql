-- One optional parent category: NULL = all products; existing vouchers stay global.
-- Preserve the installed checkout/stock/invoice/idempotency rules while replacing
-- only the voucher base and allocation. No historical order amounts are rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public."VOUCHER" add column if not exists ma_loai_sp_ap_dung varchar
  references public."LOAI_SP"(ma_loai_sp);
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public."VOUCHER"'::regclass
      and conname='voucher_supported_category') then
    alter table public."VOUCHER" add constraint voucher_supported_category
      check(ma_loai_sp_ap_dung is null or ma_loai_sp_ap_dung in ('L_LINHKIEN','L_DESKTOP'));
  end if;
end $$;
comment on column public."VOUCHER".ma_loai_sp_ap_dung is
  'NULL: all products; L_LINHKIEN: components; L_DESKTOP: desktop PCs. Minimum and discount use eligible merchandise before VAT.';

create or replace function customer_order_private.voucher_category_scope_v1(p_lines jsonb, p_voucher integer)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  voucher public."VOUCHER"%rowtype; item record; eligible numeric; discount numeric:=0;
  cumulative numeric:=0; assigned numeric:=0; next_discount numeric; items jsonb:='[]';
begin
  if p_voucher is not null then
    select * into voucher from public."VOUCHER" where ma_voucher=p_voucher;
    if not found then raise exception 'VOUCHER_NOT_AVAILABLE'; end if;
  end if;
  select coalesce(sum((l.value->>'gross_total')::numeric) filter (
    where voucher.ma_loai_sp_ap_dung is null or p.ma_loai_sp=voucher.ma_loai_sp_ap_dung),0)
    into eligible
    from jsonb_array_elements(p_lines) l(value) join public."SAN_PHAM" p on p.sku=l.value->>'sku';
  if p_voucher is not null then
    if eligible<=0 or eligible<voucher.gia_tri_don_toi_thieu then
      raise exception 'VOUCHER_MINIMUM_NOT_MET';
    end if;
    discount:=case voucher.loai_giam when 'PHAN_TRAM'
      then round(eligible*voucher.gia_tri_giam/100,2) else round(voucher.gia_tri_giam,2) end;
    if voucher.loai_giam='PHAN_TRAM' and voucher.giam_toi_da is not null then
      discount:=least(discount,voucher.giam_toi_da);
    end if;
    discount:=least(discount,eligible);
  end if;
  for item in select l.value,p.ma_loai_sp from jsonb_array_elements(p_lines)
      with ordinality l(value,ordinal) join public."SAN_PHAM" p on p.sku=l.value->>'sku'
      order by l.ordinal loop
    if voucher.ma_loai_sp_ap_dung is null or item.ma_loai_sp=voucher.ma_loai_sp_ap_dung then
      cumulative:=cumulative+(item.value->>'gross_total')::numeric;
    end if;
    next_discount:=case when eligible=0 then 0 else round(discount*cumulative/eligible,2) end;
    items:=items||jsonb_build_array(item.value||jsonb_build_object(
      'category_id',item.ma_loai_sp,
      'discount',(next_discount-assigned)::numeric(18,2)::text,
      'tax_rate','10.00','tax_amount','0.00',
      'line_total',((item.value->>'gross_total')::numeric-next_discount+assigned)::numeric(18,2)::text));
    assigned:=next_discount;
  end loop;
  return jsonb_build_object('discount',discount::numeric(18,2)::text,'items',items);
end $$;
revoke all on function customer_order_private.voucher_category_scope_v1(jsonb,integer) from public,anon,authenticated;
grant execute on function customer_order_private.voucher_category_scope_v1(jsonb,integer) to service_role;

-- Checked transformations preserve fixes from the installed migration chain.
do $upgrade$
declare
  signature text; source text; start_at integer; end_at integer; old_block text;
  allocation_start text := '    IF v_code IS NOT NULL THEN' || chr(10) || '        IF v_subtotal < v_voucher.gia_tri_don_toi_thieu';
  replacement text := $replacement$    v_scope_result := customer_order_private.voucher_category_scope_v1(v_lines,v_voucher_id);
    v_discount := (v_scope_result->>'discount')::numeric;
    v_final_lines := v_scope_result->'items';
    IF p_create AND ((p_request->>'expected_discount')::numeric <> v_discount
       OR (p_request->>'expected_total')::numeric <> v_subtotal-v_discount) THEN RAISE EXCEPTION 'CHECKOUT_CHANGED'; END IF;
$replacement$;
begin
  foreach signature in array array[
    'public.customer_checkout_v2(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)',
    'public.customer_checkout_multi_warehouse_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)'
  ] loop
    source:=replace(pg_get_functiondef(signature::regprocedure),E'\r\n',E'\n');
    if strpos(source,'voucher_category_scope_v1')>0 then continue; end if;
    start_at:=strpos(source,allocation_start);
    end_at:=strpos(source,'    v_quote := jsonb_build_object(');
    if start_at=0 or end_at<=start_at then raise exception 'Unexpected voucher allocation in %',signature; end if;
    source:=overlay(source placing replacement from start_at for end_at-start_at);
    if strpos(source,E'DECLARE\n')=0 then raise exception 'Missing checkout declarations'; end if;
    source:=replace(source,E'DECLARE\n',E'DECLARE\n    v_scope_result jsonb;\n');
    execute source;
  end loop;

  signature:='public.admin_operation_v1(text,text,text,uuid,text,jsonb)';
  source:=replace(pg_get_functiondef(signature::regprocedure),E'\r\n',E'\n');
  if strpos(source,'voucher_category_scope_v1')=0 then
    start_at:=strpos(source,E'   if voucher_id is not null then\n    if subtotal<voucher.gia_tri_don_toi_thieu');
    end_at:=strpos(source,E'   order_id:=''DH-''||p_key;');
    if start_at=0 or end_at<=start_at then raise exception 'Unexpected counter voucher allocation'; end if;
    source:=overlay(source placing $counter$   select jsonb_agg(jsonb_build_object('sku',i.value->>'sku',
      'warehouse_id',(i.value->>'warehouse_id')::int,
      'gross_total',((i.value->>'quantity')::int*(i.value->>'unit_price')::numeric)::text)
      order by (i.value->>'warehouse_id')::int,i.value->>'sku')
      into scope_lines from jsonb_array_elements(lines) i(value);
   begin
     scope_result:=customer_order_private.voucher_category_scope_v1(scope_lines,voucher_id);
   exception when raise_exception then
     if sqlerrm in ('VOUCHER_MINIMUM_NOT_MET','VOUCHER_NOT_AVAILABLE') then raise exception 'VOUCHER_UNAVAILABLE'; end if;
     raise;
   end;
   discount:=(scope_result->>'discount')::numeric;
$counter$ from start_at for end_at-start_at);
    old_block:='next_discount:=case when subtotal=0 then 0 else round(discount*cumulative/subtotal,2) end;';
    if strpos(source,old_block)=0 or strpos(source,E'declare\n')=0 then raise exception 'Unexpected counter declarations'; end if;
    source:=replace(source,old_block,$counter$select assigned+(s.value->>'discount')::numeric into next_discount
      from jsonb_array_elements(scope_result->'items') s(value)
      where s.value->>'sku'=item->>'sku' and (s.value->>'warehouse_id')::int=(item->>'warehouse_id')::int;$counter$);
    source:=replace(source,E'declare\n',E'declare\n scope_lines jsonb; scope_result jsonb;\n');
    execute source;
  end if;

  signature:='public.customer_voucher_choices_v1(text,text)';
  source:=replace(pg_get_functiondef(signature::regprocedure),E'\r\n',E'\n');
  if strpos(source,'v.ma_loai_sp_ap_dung as category_id')=0 then
    old_block:='select v.ma_code as code, v.loai_giam as discount_type,';
    if strpos(source,old_block)=0 then raise exception 'Unexpected voucher choices definition'; end if;
    source:=replace(source,old_block,'select v.ma_code as code, v.ma_loai_sp_ap_dung as category_id, v.loai_giam as discount_type,');
    execute source;
  end if;
end $upgrade$;
notify pgrst,'reload schema';
commit;
