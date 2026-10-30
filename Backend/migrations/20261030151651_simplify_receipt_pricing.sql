-- Receipt-only pricing. Keep source inputs; calculate all amounts when reading.
-- No CASCADE: unexpected database dependencies must stop the upgrade.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public."CT_PHIEU_NHAP", public."PHIEU_NHAP", public."SAN_PHAM" in share row exclusive mode;

create or replace function admin_ops.pricing_taxes(rules jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb; result jsonb:='[]'; rate numeric; tax_name text;
begin
 if jsonb_typeof(rules) is distinct from 'array' or jsonb_array_length(rules)>20 then raise exception 'PRICING_INVALID'; end if;
 if exists(select 1 from jsonb_array_elements(rules) x group by x->>'code' having count(*)>1) then raise exception 'PRICING_INVALID'; end if;
 for item in select value from jsonb_array_elements(rules) order by value->>'code' loop
  rate:=(item->>'rate')::numeric;
  tax_name:=coalesce(nullif(btrim(item->>'name'),''),item->>'code');
  if jsonb_typeof(item) is distinct from 'object' or coalesce(item->>'code','') !~ '^[A-Z][A-Z0-9_]{0,29}$'
   or rate is null or rate::text in('NaN','Infinity','-Infinity') or rate not between 0 and 100 or rate<>round(rate,4)
   or length(tax_name) not between 1 and 100 then raise exception 'PRICING_INVALID'; end if;
  result:=result||jsonb_build_array(jsonb_build_object('code',item->>'code','name',tax_name,'rate',rate::text));
 end loop;
 return result;
end $$;

-- Legacy API response shape stays readable during deployment, without a catalog.
create or replace function public.pricing_context_v1(p_actor text,p_sku text default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare who jsonb; current_price numeric; data jsonb;
begin
 who:=admin_ops.pricing_actor(p_actor);
 if p_sku is not null then
  select gia_ban_hien_tai into current_price from public."SAN_PHAM" where sku=p_sku;
  if not found then raise exception 'NOT_FOUND'; end if;
 end if;
 data:=jsonb_build_object('sku',p_sku,'markup_rate','0','raw_markup_rate',null,'inherited_markup',false,
  'inherited_taxes',false,'taxes','[]'::jsonb,'current_price',current_price::text,'can_edit',who->>'role'='ADMIN',
  'catalog','[]'::jsonb,'history','[]'::jsonb,'storage','receipt');
 return data||jsonb_build_object('version',encode(sha256(convert_to(data::text,'UTF8')),'hex'));
end $$;

-- Fail explicitly for old clients rather than silently pretending to save settings.
create or replace function public.pricing_config_v1(p_actor text,p_sku text,p_body jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin perform admin_ops.pricing_actor(p_actor); raise exception 'PRICING_RECEIPT_ONLY'; end $$;
create or replace function public.pricing_tax_v1(p_actor text,p_code text,p_name text,p_rate numeric,p_create boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin perform admin_ops.pricing_actor(p_actor); raise exception 'PRICING_RECEIPT_ONLY'; end $$;

-- Preserve existing input rates/names, remove duplicated tax amounts, including on
-- historical receipts. Business values, quantities, dates and prices are unchanged.
drop trigger receipt_line_pricing on public."CT_PHIEU_NHAP";
alter table public."CT_PHIEU_NHAP" drop constraint receipt_pricing_consistent;
-- Scope this data normalization to tax JSON only; fixed-warehouse guards otherwise
-- reject historical rows outside the operating warehouse. All other guards remain.
alter table public."CT_PHIEU_NHAP" disable trigger fixed_warehouse;
update public."CT_PHIEU_NHAP" set thue_snapshot=admin_ops.pricing_taxes(thue_snapshot) where thue_snapshot is not null;
alter table public."CT_PHIEU_NHAP" enable trigger fixed_warehouse;
alter table public."CT_PHIEU_NHAP"
 drop column tien_loi_nhuan, drop column gia_ban_truoc_thue,
 drop column tong_tien_thue, drop column gia_ban_sau_thue,
 drop column dinh_gia_sua_boi, drop column dinh_gia_sua_luc;
alter table public."CT_PHIEU_NHAP" add constraint receipt_pricing_inputs check (
 (ty_le_loi_nhuan is null and thue_snapshot is null) or
 (ty_le_loi_nhuan is not null and thue_snapshot is not null and thue_snapshot=admin_ops.pricing_taxes(thue_snapshot)));

create or replace function admin_ops.price_receipt_line() returns trigger
language plpgsql security invoker set search_path='' as $$
declare state text;
begin
 select trang_thai into state from public."PHIEU_NHAP" where ma_phieu_nhap=coalesce(new.ma_phieu_nhap,old.ma_phieu_nhap) for share;
 if state is distinct from 'NHAP' then raise exception 'PRICING_FROZEN'; end if;
 if TG_OP='DELETE' then return old; end if;
 new.ty_le_loi_nhuan:=coalesce(new.ty_le_loi_nhuan,0);
 new.thue_snapshot:=admin_ops.pricing_taxes(coalesce(new.thue_snapshot,'[]'));
 perform admin_ops.pricing_formula(new.gia_nhap,new.ty_le_loi_nhuan,new.thue_snapshot);
 return new;
end $$;
create trigger receipt_line_pricing before insert or update or delete on public."CT_PHIEU_NHAP"
 for each row execute function admin_ops.price_receipt_line();

create function admin_ops.receipt_line_price(cost numeric,markup numeric,taxes jsonb,state text) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select case when markup is not null and taxes is not null then admin_ops.pricing_formula(cost,markup,taxes)
  when state='NHAP' then admin_ops.pricing_formula(cost,coalesce(markup,0),coalesce(taxes,'[]')) else null end
$$;

create or replace function public.receipt_pricing_preview_v1(p_actor text,p_id int) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare who jsonb; header jsonb; lines jsonb; data jsonb;
begin
 who:=admin_ops.pricing_actor(p_actor);
 select to_jsonb(p) into header from public."PHIEU_NHAP" p
 where ma_phieu_nhap=p_id and (who->>'role'='ADMIN' or p.ma_kho=(who->>'warehouse')::int);
 if header is null then raise exception 'NOT_FOUND'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('sku',c.sku,'quantity',c.so_luong_nhap,'current_price',s.gia_ban_hien_tai::text,
  'price',admin_ops.receipt_line_price(c.gia_nhap,c.ty_le_loi_nhuan,c.thue_snapshot,header->>'trang_thai')) order by c.sku),'[]')
 into lines from public."CT_PHIEU_NHAP" c join public."SAN_PHAM" s using(sku) where c.ma_phieu_nhap=p_id;
 data:=jsonb_build_object('receipt_id',p_id,'status',header->>'trang_thai','applied',(header->>'dinh_gia_da_ap_dung')::boolean,'lines',lines);
 return data||jsonb_build_object('version',encode(sha256(convert_to((data||jsonb_build_object('header',header))::text,'UTF8')),'hex'));
end $$;

create or replace function admin_ops.apply_receipt_prices() returns trigger
language plpgsql security invoker set search_path='' as $$
declare item record; price jsonb;
begin
 if old.trang_thai='NHAP' and new.trang_thai='DA_NHAP' and current_setting('phub.apply_receipt_prices',true)='on' then
  new.dinh_gia_da_ap_dung:=true;
  perform 1 from public."SAN_PHAM" s where s.sku in(select c.sku from public."CT_PHIEU_NHAP" c where c.ma_phieu_nhap=new.ma_phieu_nhap) order by s.sku for update;
  update public."CT_PHIEU_NHAP" set gia_nhap=gia_nhap where ma_phieu_nhap=new.ma_phieu_nhap;
  for item in select * from public."CT_PHIEU_NHAP" where ma_phieu_nhap=new.ma_phieu_nhap order by sku loop
   price:=admin_ops.pricing_formula(item.gia_nhap,item.ty_le_loi_nhuan,item.thue_snapshot);
   update public."SAN_PHAM" set gia_ban_hien_tai=(price->>'pre_tax')::numeric where sku=item.sku;
  end loop;
 end if;
 return new;
end $$;

create or replace function admin_ops.receipt_snapshot(p_id int) returns jsonb
language sql stable security invoker set search_path='' set timezone='UTC' as $$
 select jsonb_build_object('receipt',to_jsonb(p)||jsonb_build_object('supplier_name',s.ten_ncc),
 'lines',coalesce((select jsonb_agg(jsonb_build_object('sku',l.sku,'product_name',sp.ten_sp,'quantity',l.so_luong_nhap,
  'unit_price',l.gia_nhap::text,'unit',sp.don_vi,'pricing',admin_ops.receipt_line_price(l.gia_nhap,l.ty_le_loi_nhuan,l.thue_snapshot,p.trang_thai)) order by l.sku)
 from public."CT_PHIEU_NHAP" l join public."SAN_PHAM" sp using(sku) where l.ma_phieu_nhap=p_id),'[]'),
 'version',encode(sha256(convert_to((to_jsonb(p)||jsonb_build_object('lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.sku)
 from public."CT_PHIEU_NHAP" l where l.ma_phieu_nhap=p_id),'[]')))::text,'UTF8')),'hex'))
 from public."PHIEU_NHAP" p join public."NHA_CUNG_CAP" s using(ma_ncc) where p.ma_phieu_nhap=p_id
$$;

create or replace function public.priced_receipt_v1(p_actor text,p_portal text,p_action text,p_key uuid,p_id int,p_body jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
<<pricing_command>>
declare who jsonb; prior admin_ops.requests%rowtype; fingerprint text; inserted int; result jsonb; inner_key uuid:=gen_random_uuid();
 clean_body jsonb; item jsonb; keep jsonb:='{}'; receipt_id int; saved jsonb; old_inputs jsonb;
begin
 who:=admin_ops.pricing_actor(p_actor);
 if p_portal not in('ADMIN','WAREHOUSE') or p_portal is null or (p_portal='ADMIN' and who->>'role'<>'ADMIN') or (p_portal='WAREHOUSE' and who->>'role'<>'NHAN_VIEN') then raise exception 'PRICING_FORBIDDEN'; end if;
 if p_action not in('create','lines','update','confirm','cancel') or p_action is null or p_key is null or p_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'PRICING_INVALID'; end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_portal,p_action,p_id,p_body)::text,'UTF8')),'hex');
 insert into admin_ops.requests(actor,key,hash,resource,action,record_id) values(p_actor,p_key,fingerprint,'priced-receipts',p_action,p_id::text) on conflict(actor,key) do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then
  select * into strict prior from admin_ops.requests where actor=p_actor and key=p_key;
  if prior.hash<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;return prior.result||jsonb_build_object('replayed',true);
 end if;
 perform set_config('phub.pricing_actor',p_actor,true);
 if p_id is not null then
  perform 1 from public."PHIEU_NHAP" p where p.ma_phieu_nhap=p_id and (p_portal='ADMIN' or p.ma_kho=(who->>'warehouse')::int) for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_object_agg(sku,jsonb_build_object('markup_rate',ty_le_loi_nhuan,'taxes',thue_snapshot)),'{}') into keep from public."CT_PHIEU_NHAP" where ma_phieu_nhap=p_id;
 end if;
 perform 1 from public."SAN_PHAM" s where s.sku in(select x->>'sku' from jsonb_array_elements(coalesce(p_body->'lines','[]')) x union select c.sku from public."CT_PHIEU_NHAP" c where c.ma_phieu_nhap=p_id) order by s.sku for update;
 if p_action='confirm' then
  if p_body->>'pricing_version' is distinct from public.receipt_pricing_preview_v1(p_actor,p_id)->>'version' then raise exception 'PRICING_CHANGED'; end if;
  perform set_config('phub.apply_receipt_prices','on',true);
 end if;
 clean_body:=p_body-'pricing_version';
 if p_body ? 'lines' then
  for item in select value from jsonb_array_elements(p_body->'lines') loop
   if (item-array['sku','quantity','unit_price','warehouse_id','markup_rate','taxes'])<>'{}'::jsonb then raise exception 'PRICING_INVALID'; end if;
   if p_portal='WAREHOUSE' and (item ? 'markup_rate' or item ? 'taxes') then raise exception 'PRICING_FORBIDDEN'; end if;
  end loop;
  select jsonb_set(clean_body,'{lines}',coalesce(jsonb_agg(x-array['markup_rate','taxes']),'[]')) into clean_body from jsonb_array_elements(p_body->'lines') x;
 end if;
 if p_portal='ADMIN' then
  result:=public.admin_operation_v1(p_actor,'receipts',p_action,inner_key,p_id::text,clean_body);
  receipt_id:=(result->'data'->0->>'ma_phieu_nhap')::int;
  -- Legacy RPC returns a row, not an envelope.
  receipt_id:=coalesce(receipt_id,(result->>'ma_phieu_nhap')::int);
 else
  result:=public.warehouse_receipt_v1(p_actor,p_action,inner_key,p_id,clean_body);
  receipt_id:=(result->'receipt'->>'ma_phieu_nhap')::int;
 end if;
 if p_action in('create','lines','update') then
  for item in select value from jsonb_array_elements(p_body->'lines') loop
   old_inputs:=case when p_portal='WAREHOUSE' then keep->(item->>'sku') else coalesce(keep->(item->>'sku'),'{}')||jsonb_strip_nulls(item) end;
   if old_inputs is not null then
    update public."CT_PHIEU_NHAP" set ty_le_loi_nhuan=coalesce((old_inputs->>'markup_rate')::numeric,ty_le_loi_nhuan),
      thue_snapshot=case when jsonb_typeof(old_inputs->'taxes')='array' then old_inputs->'taxes' else thue_snapshot end
    where ma_phieu_nhap=receipt_id and sku=item->>'sku';
   end if;
  end loop;
 end if;
 if p_portal='ADMIN' then select jsonb_build_object('data',jsonb_build_array(to_jsonb(p)),'replayed',false) into result from public."PHIEU_NHAP" p where ma_phieu_nhap=receipt_id;
 else result:=admin_ops.receipt_snapshot(receipt_id); end if;
 update admin_ops.requests set result=pricing_command.result,record_id=receipt_id::text where actor=p_actor and key=p_key;
 return result||jsonb_build_object('replayed',false);
end $$;

-- All callers now use receipt inputs, so the separate catalogs can be removed.
alter table public."SAN_PHAM" drop column ty_le_loi_nhuan_mac_dinh, drop column dung_thue_mac_dinh;
drop table public."SAN_PHAM_THUE";
drop table public."THUE";
drop table admin_ops.pricing_defaults;
drop table admin_ops.pricing_audit;
revoke all on function admin_ops.receipt_line_price(numeric,numeric,jsonb,text) from public,anon,authenticated;
grant execute on function admin_ops.receipt_line_price(numeric,numeric,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
