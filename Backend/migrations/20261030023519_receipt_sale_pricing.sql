-- Upgrade only. Existing selling prices and confirmed receipt history are not backfilled.
begin;
set local lock_timeout='5s';
create table public."THUE" (
 ma_thue text primary key check(ma_thue ~ '^[A-Z][A-Z0-9_]{0,29}$'), ten_thue text not null check(length(btrim(ten_thue)) between 1 and 100),
 ty_le numeric(7,4) not null check(ty_le between 0 and 100), trang_thai boolean not null default true,
 sua_boi text references public."TAI_KHOAN"(ma_tk) on delete set null, sua_luc timestamptz not null default now()
);
create index "THUE_sua_boi_idx" on public."THUE"(sua_boi);
insert into public."THUE"(ma_thue,ten_thue,ty_le) values('VAT','VAT',10);
alter table public."SAN_PHAM" add column ty_le_loi_nhuan_mac_dinh numeric(12,4) check(ty_le_loi_nhuan_mac_dinh>=0 and ty_le_loi_nhuan_mac_dinh<1e8),
 add column dung_thue_mac_dinh boolean not null default true;
create table public."SAN_PHAM_THUE" (
 sku varchar not null references public."SAN_PHAM"(sku) on delete cascade,
 ma_thue text not null references public."THUE"(ma_thue), ty_le numeric(7,4) not null check(ty_le between 0 and 100), primary key(sku,ma_thue)
);
create index "SAN_PHAM_THUE_tax_idx" on public."SAN_PHAM_THUE"(ma_thue);
create table admin_ops.pricing_defaults (
 id boolean primary key default true check(id), markup_rate numeric(12,4) not null check(markup_rate>=0 and markup_rate<1e8), taxes jsonb not null check(jsonb_typeof(taxes)='array'),
 changed_by text references public."TAI_KHOAN"(ma_tk) on delete set null, changed_at timestamptz not null default now()
);
create index pricing_defaults_actor_idx on admin_ops.pricing_defaults(changed_by);
insert into admin_ops.pricing_defaults(markup_rate,taxes) values(20,'[{"code":"VAT","rate":"10"}]');
create table admin_ops.pricing_audit (
 id bigint generated always as identity primary key, scope text not null, reference text not null,
 actor text references public."TAI_KHOAN"(ma_tk) on delete set null, before_value jsonb, after_value jsonb, changed_at timestamptz not null default now()
);
create index pricing_audit_ref_idx on admin_ops.pricing_audit(scope,reference,changed_at desc);
create index pricing_audit_actor_idx on admin_ops.pricing_audit(actor);
alter table public."THUE" enable row level security;
alter table public."SAN_PHAM_THUE" enable row level security;
alter table admin_ops.pricing_defaults enable row level security;
alter table admin_ops.pricing_audit enable row level security;
revoke all on public."THUE",public."SAN_PHAM_THUE",admin_ops.pricing_defaults,admin_ops.pricing_audit from public,anon,authenticated;
grant select,insert,update on public."THUE",admin_ops.pricing_defaults to service_role;
grant select,insert,update,delete on public."SAN_PHAM_THUE" to service_role;
grant select,insert on admin_ops.pricing_audit to service_role;
grant usage,select on sequence admin_ops.pricing_audit_id_seq to service_role;

-- Private numeric reference implementation: VND HALF_UP at each displayed step.
create function admin_ops.pricing_formula(g numeric,r numeric,taxes jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare profit numeric; pre numeric; total numeric:=0; item jsonb; result jsonb:='[]'; amount numeric;
begin
 if g is null or r is null or g::text in('NaN','Infinity','-Infinity') or r::text in('NaN','Infinity','-Infinity')
  or g<0 or g>=1e16 or r<0 or r>=1e8 or g<>round(g,2) or r<>round(r,4)
  or jsonb_typeof(taxes) is distinct from 'array' then raise exception 'PRICING_INVALID'; end if;
 if jsonb_array_length(taxes)>20 or exists(select 1 from jsonb_array_elements(taxes) x group by x->>'code' having count(*)>1) then raise exception 'PRICING_INVALID'; end if;
 profit:=round(g*r/100,0); pre:=round(g+profit,0);
 for item in select value from jsonb_array_elements(taxes) order by value->>'code' loop
  if coalesce(item->>'code','') !~ '^[A-Z][A-Z0-9_]{0,29}$' or coalesce(item->>'name','')='' or (item->>'rate') is null
   or (item->>'rate')::numeric not between 0 and 100 or (item->>'rate')::numeric<>round((item->>'rate')::numeric,4)
  then raise exception 'PRICING_INVALID'; end if;
  amount:=round(pre*(item->>'rate')::numeric/100,0);total:=total+amount;
  result:=result||jsonb_build_array(jsonb_build_object('code',item->>'code','name',item->>'name','rate',(item->>'rate')::numeric::text,'amount',amount::text));
 end loop;
 if greatest(profit,pre,pre+total)>=1e16 then raise exception 'PRICING_INVALID'; end if;
 return jsonb_build_object('unit_cost',g::text,'markup_rate',r::text,'profit',profit::text,'pre_tax',pre::text,'taxes',result,'total_tax',total::text,'after_tax',(pre+total)::text,
  'actual_markup',case when g>0 then round((pre-g)*100/g,4)::text end,'margin',case when pre>0 then round((pre-g)*100/pre,4)::text end);
end $$;

create function admin_ops.pricing_actor(actor text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('role',n.loai_nhan_vien,'warehouse',n.ma_kho) into result
 from public."TAI_KHOAN" a join public."NHAN_VIEN" n using(ma_nhan_vien) left join public."KHO" w on w.ma_kho=n.ma_kho
 where a.ma_tk=actor and a.trang_thai=1 and n.trang_thai=1 and (n.loai_nhan_vien='ADMIN' or (n.loai_nhan_vien='NHAN_VIEN' and w.trang_thai=1));
 if result is null then raise exception 'PRICING_FORBIDDEN'; end if;return result;
end $$;
create function admin_ops.pricing_taxes(rules jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if jsonb_typeof(rules) is distinct from 'array' or jsonb_array_length(rules)>20 then raise exception 'PRICING_INVALID'; end if;
 if exists(select 1 from jsonb_array_elements(rules) x group by x->>'code' having count(*)>1) then raise exception 'PRICING_INVALID'; end if;
 if exists(select 1 from jsonb_array_elements(rules) x left join public."THUE" t on t.ma_thue=x->>'code' and t.trang_thai
  where t.ma_thue is null or (x->>'rate') is null or (x->>'rate')::numeric not between 0 and 100
  or (x->>'rate')::numeric<>round((x->>'rate')::numeric,4)) then raise exception 'PRICING_INVALID'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('code',t.ma_thue,'name',t.ten_thue,'rate',(x->>'rate')::numeric::text) order by t.ma_thue),'[]') into result
 from jsonb_array_elements(rules) x join public."THUE" t on t.ma_thue=x->>'code';return result;
end $$;

create function public.pricing_context_v1(p_actor text,p_sku text default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare who jsonb; cfg admin_ops.pricing_defaults%rowtype; sp public."SAN_PHAM"%rowtype; rules jsonb; result jsonb; history jsonb;
begin
 who:=admin_ops.pricing_actor(p_actor);select * into strict cfg from admin_ops.pricing_defaults where id;
 if p_sku is not null then
  select * into sp from public."SAN_PHAM" where sku=p_sku;
  if not found then raise exception 'NOT_FOUND'; end if;
 end if;
 rules:=case when p_sku is null or sp.dung_thue_mac_dinh then cfg.taxes else
  coalesce((select jsonb_agg(jsonb_build_object('code',ma_thue,'rate',ty_le::text) order by ma_thue) from public."SAN_PHAM_THUE" where sku=p_sku),'[]') end;
 select coalesce(jsonb_agg(x),'[]') into history from (select actor,before_value,after_value,changed_at from admin_ops.pricing_audit
  where scope=case when p_sku is null then 'SYSTEM' else 'PRODUCT' end and reference=coalesce(p_sku,'SYSTEM') order by changed_at desc,id desc limit 20)x;
 result:=jsonb_build_object('sku',p_sku,'markup_rate',coalesce(sp.ty_le_loi_nhuan_mac_dinh,cfg.markup_rate)::text,
  'raw_markup_rate',sp.ty_le_loi_nhuan_mac_dinh::text,'inherited_markup',p_sku is not null and sp.ty_le_loi_nhuan_mac_dinh is null,
  'inherited_taxes',p_sku is not null and sp.dung_thue_mac_dinh,'taxes',admin_ops.pricing_taxes(rules),'current_price',sp.gia_ban_hien_tai::text,
  'can_edit',who->>'role'='ADMIN','catalog',coalesce((select jsonb_agg(jsonb_build_object('code',ma_thue,'name',ten_thue,'rate',ty_le::text,'active',trang_thai) order by ma_thue) from public."THUE"),'[]'));
 return result||jsonb_build_object('version',encode(sha256(convert_to(result::text,'UTF8')),'hex'),'history',history);
end $$;
create function public.pricing_config_v1(p_actor text,p_sku text,p_body jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare before_value jsonb; rules jsonb; item jsonb; r numeric;
begin
 if admin_ops.pricing_actor(p_actor)->>'role'<>'ADMIN' then raise exception 'PRICING_FORBIDDEN'; end if;
 perform 1 from admin_ops.pricing_defaults where id for update;
 if p_sku is not null then perform 1 from public."SAN_PHAM" where sku=p_sku for update; end if;
 before_value:=public.pricing_context_v1(p_actor,p_sku);
 if p_body->>'expected_version' is distinct from before_value->>'version' then raise exception 'PRICING_CHANGED'; end if;
 r:=(p_body->>'markup_rate')::numeric;
 if r is not null and (r<0 or r>=1e8 or r<>round(r,4) or r::text='NaN') then raise exception 'PRICING_INVALID'; end if;
 if p_sku is null and (r is null or jsonb_typeof(p_body->'taxes') is distinct from 'array') then raise exception 'PRICING_INVALID'; end if;
 if jsonb_typeof(p_body->'taxes')='array' then rules:=admin_ops.pricing_taxes(p_body->'taxes'); end if;
 if p_sku is null then
  update admin_ops.pricing_defaults set markup_rate=r,taxes=rules,changed_by=p_actor,changed_at=statement_timestamp() where id;
 else
  update public."SAN_PHAM" set ty_le_loi_nhuan_mac_dinh=r,dung_thue_mac_dinh=(rules is null) where sku=p_sku;
  delete from public."SAN_PHAM_THUE" where sku=p_sku;
  for item in select value from jsonb_array_elements(coalesce(rules,'[]')) loop
   insert into public."SAN_PHAM_THUE" values(p_sku,item->>'code',(item->>'rate')::numeric);
  end loop;
 end if;
 insert into admin_ops.pricing_audit(scope,reference,actor,before_value,after_value) values(case when p_sku is null then 'SYSTEM' else 'PRODUCT' end,coalesce(p_sku,'SYSTEM'),p_actor,before_value-'history',public.pricing_context_v1(p_actor,p_sku)-'history');
 return public.pricing_context_v1(p_actor,p_sku);
end $$;
create function public.pricing_tax_v1(p_actor text,p_code text,p_name text,p_rate numeric,p_create boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare old_value jsonb; new_value jsonb;
begin
 if admin_ops.pricing_actor(p_actor)->>'role'<>'ADMIN' then raise exception 'PRICING_FORBIDDEN'; end if;
 select to_jsonb(t) into old_value from public."THUE" t where ma_thue=p_code for update;
 if p_create and old_value is not null then raise exception 'PRICING_TAX_EXISTS'; end if;
 if not p_create and old_value is null then raise exception 'NOT_FOUND'; end if;
 if p_rate is null or p_rate::text in('NaN','Infinity','-Infinity') or p_rate<>round(p_rate,4) then raise exception 'PRICING_INVALID'; end if;
 insert into public."THUE"(ma_thue,ten_thue,ty_le,sua_boi) values(p_code,p_name,p_rate,p_actor)
 on conflict(ma_thue) do update set ten_thue=excluded.ten_thue,ty_le=excluded.ty_le,sua_boi=p_actor,sua_luc=statement_timestamp();
 select to_jsonb(t) into new_value from public."THUE" t where ma_thue=p_code;
 insert into admin_ops.pricing_audit(scope,reference,actor,before_value,after_value) values('TAX',p_code,p_actor,old_value,new_value);
 return new_value;
end $$;

alter table public."CT_PHIEU_NHAP" add column ty_le_loi_nhuan numeric(12,4) check(ty_le_loi_nhuan>=0 and ty_le_loi_nhuan<1e8),
 add column thue_snapshot jsonb check(thue_snapshot is null or jsonb_typeof(thue_snapshot)='array'),
 add column tien_loi_nhuan numeric(18,2) check(tien_loi_nhuan>=0), add column gia_ban_truoc_thue numeric(18,2) check(gia_ban_truoc_thue>=0),
 add column tong_tien_thue numeric(18,2) check(tong_tien_thue>=0), add column gia_ban_sau_thue numeric(18,2) check(gia_ban_sau_thue>=0),
 add column dinh_gia_sua_boi text references public."TAI_KHOAN"(ma_tk) on delete set null, add column dinh_gia_sua_luc timestamptz;
create index "CT_PHIEU_NHAP_pricing_actor_idx" on public."CT_PHIEU_NHAP"(dinh_gia_sua_boi);
alter table public."PHIEU_NHAP" add column dinh_gia_da_ap_dung boolean not null default false;
alter table public."CT_PHIEU_NHAP" add constraint receipt_pricing_consistent check (
 (ty_le_loi_nhuan is null and thue_snapshot is null and tien_loi_nhuan is null and gia_ban_truoc_thue is null and tong_tien_thue is null and gia_ban_sau_thue is null)
 or (ty_le_loi_nhuan is not null and thue_snapshot is not null and tien_loi_nhuan is not null and gia_ban_truoc_thue is not null and tong_tien_thue is not null and gia_ban_sau_thue is not null
 and gia_ban_sau_thue=gia_ban_truoc_thue+tong_tien_thue
 and tien_loi_nhuan=(admin_ops.pricing_formula(gia_nhap,ty_le_loi_nhuan,thue_snapshot)->>'profit')::numeric
 and gia_ban_truoc_thue=(admin_ops.pricing_formula(gia_nhap,ty_le_loi_nhuan,thue_snapshot)->>'pre_tax')::numeric
 and tong_tien_thue=(admin_ops.pricing_formula(gia_nhap,ty_le_loi_nhuan,thue_snapshot)->>'total_tax')::numeric));

create function admin_ops.price_receipt_line() returns trigger language plpgsql security invoker set search_path='' as $$
declare state text; cfg jsonb; price jsonb; actor text; old_value jsonb;
begin
 select trang_thai into state from public."PHIEU_NHAP" where ma_phieu_nhap=coalesce(new.ma_phieu_nhap,old.ma_phieu_nhap);
 if state<>'NHAP' then raise exception 'PRICING_FROZEN'; end if;
 if TG_OP='DELETE' then return old; end if;
 actor:=coalesce(nullif(current_setting('phub.pricing_actor',true),''),nullif(current_setting('phub.actor',true),''));
 -- The trigger is also safe for old application versions during deployment.
 select jsonb_build_object('rate',coalesce(s.ty_le_loi_nhuan_mac_dinh,c.markup_rate),'taxes',case when s.dung_thue_mac_dinh then c.taxes else coalesce((select jsonb_agg(jsonb_build_object('code',t.ma_thue,'rate',t.ty_le::text)) from public."SAN_PHAM_THUE" t where t.sku=new.sku),'[]') end)
 into cfg from public."SAN_PHAM" s cross join admin_ops.pricing_defaults c where s.sku=new.sku and c.id;
 if cfg is null then raise exception 'PRICING_INVALID'; end if;
 new.ty_le_loi_nhuan:=coalesce(new.ty_le_loi_nhuan,(cfg->>'rate')::numeric);
 price:=admin_ops.pricing_formula(new.gia_nhap,new.ty_le_loi_nhuan,admin_ops.pricing_taxes(coalesce(new.thue_snapshot,cfg->'taxes')));
 new.thue_snapshot:=price->'taxes';new.tien_loi_nhuan:=(price->>'profit')::numeric;
 new.gia_ban_truoc_thue:=(price->>'pre_tax')::numeric;new.tong_tien_thue:=(price->>'total_tax')::numeric;new.gia_ban_sau_thue:=(price->>'after_tax')::numeric;
 old_value:=case when TG_OP='UPDATE' then to_jsonb(old) else null end;
 if TG_OP='INSERT' or old.gia_nhap is distinct from new.gia_nhap or old.ty_le_loi_nhuan is distinct from new.ty_le_loi_nhuan or old.thue_snapshot is distinct from new.thue_snapshot then
  new.dinh_gia_sua_boi:=actor;new.dinh_gia_sua_luc:=statement_timestamp();
  insert into admin_ops.pricing_audit(scope,reference,actor,before_value,after_value) values('RECEIPT',new.ma_phieu_nhap::text,actor,old_value,to_jsonb(new));
 end if;
 return new;
end $$;
create trigger receipt_line_pricing before insert or update or delete on public."CT_PHIEU_NHAP" for each row execute function admin_ops.price_receipt_line();

create function public.receipt_pricing_preview_v1(p_actor text,p_id int) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare who jsonb; header jsonb; lines jsonb; data jsonb;
begin
 who:=admin_ops.pricing_actor(p_actor);
 select to_jsonb(p) into header from public."PHIEU_NHAP" p where ma_phieu_nhap=p_id and (who->>'role'='ADMIN' or p.ma_kho=(who->>'warehouse')::int);
 if header is null then raise exception 'NOT_FOUND'; end if;
 -- Resolve legacy draft snapshots without writing them.
 select coalesce(jsonb_agg(jsonb_build_object('sku',c.sku,'quantity',c.so_luong_nhap,'current_price',s.gia_ban_hien_tai::text,'changed_by',c.dinh_gia_sua_boi,'changed_at',c.dinh_gia_sua_luc,
  'price',case when header->>'trang_thai'='NHAP' then admin_ops.pricing_formula(c.gia_nhap,coalesce(c.ty_le_loi_nhuan,(public.pricing_context_v1(p_actor,c.sku)->>'markup_rate')::numeric),admin_ops.pricing_taxes(coalesce(c.thue_snapshot,public.pricing_context_v1(p_actor,c.sku)->'taxes')))
   else case when c.gia_ban_truoc_thue is not null then jsonb_build_object('unit_cost',c.gia_nhap::text,'markup_rate',c.ty_le_loi_nhuan::text,'profit',c.tien_loi_nhuan::text,'pre_tax',c.gia_ban_truoc_thue::text,'taxes',c.thue_snapshot,'total_tax',c.tong_tien_thue::text,'after_tax',c.gia_ban_sau_thue::text) end end) order by c.sku),'[]')
 into lines from public."CT_PHIEU_NHAP" c join public."SAN_PHAM" s using(sku) where c.ma_phieu_nhap=p_id;
 data:=jsonb_build_object('receipt_id',p_id,'status',header->>'trang_thai','applied',(header->>'dinh_gia_da_ap_dung')::boolean,'lines',lines);
 return data||jsonb_build_object('version',encode(sha256(convert_to((data||jsonb_build_object('header',header))::text,'UTF8')),'hex'));
end $$;

create function admin_ops.apply_receipt_prices() returns trigger language plpgsql security invoker set search_path='' as $$
declare item record; actor text;
begin
 if old.trang_thai='NHAP' and new.trang_thai='DA_NHAP' and current_setting('phub.apply_receipt_prices',true)='on' then
  new.dinh_gia_da_ap_dung:=true;
  actor:=nullif(current_setting('phub.pricing_actor',true),'');
  perform 1 from public."SAN_PHAM" s where s.sku in(select c.sku from public."CT_PHIEU_NHAP" c where c.ma_phieu_nhap=new.ma_phieu_nhap) order by s.sku for update;
  update public."CT_PHIEU_NHAP" set gia_nhap=gia_nhap where ma_phieu_nhap=new.ma_phieu_nhap;
  for item in select c.*,s.gia_ban_hien_tai from public."CT_PHIEU_NHAP" c join public."SAN_PHAM" s using(sku) where c.ma_phieu_nhap=new.ma_phieu_nhap order by c.sku loop
   update public."SAN_PHAM" set gia_ban_hien_tai=item.gia_ban_truoc_thue where sku=item.sku;
   insert into admin_ops.pricing_audit(scope,reference,actor,before_value,after_value) values('SALE_PRICE',item.sku,actor,jsonb_build_object('price',item.gia_ban_hien_tai),jsonb_build_object('receipt_id',new.ma_phieu_nhap,'pre_tax',item.gia_ban_truoc_thue,'after_tax',item.gia_ban_sau_thue));
  end loop;
 end if;return new;
end $$;
create trigger confirm_receipt_prices before update of trang_thai on public."PHIEU_NHAP" for each row execute function admin_ops.apply_receipt_prices();

-- One outer idempotency record covers stock, custom inputs, price updates and audit.
-- Inner legacy commands use a private one-time key inside the same transaction.
create function public.priced_receipt_v1(p_actor text,p_portal text,p_action text,p_key uuid,p_id int,p_body jsonb) returns jsonb
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
 perform 1 from admin_ops.pricing_defaults where id for share;
 if p_id is not null then
  perform 1 from public."PHIEU_NHAP" p where p.ma_phieu_nhap=p_id and (p_portal='ADMIN' or p.ma_kho=(who->>'warehouse')::int) for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_object_agg(sku,jsonb_build_object('markup_rate',ty_le_loi_nhuan,'taxes',thue_snapshot)),'{}') into keep from public."CT_PHIEU_NHAP" where ma_phieu_nhap=p_id;
 end if;
 perform 1 from public."SAN_PHAM" s where s.sku in(select x->>'sku' from jsonb_array_elements(coalesce(p_body->'lines','[]')) x union select c.sku from public."CT_PHIEU_NHAP" c where c.ma_phieu_nhap=p_id) order by s.sku for update;
 -- Do not let catalog edits race the preview/confirm decision.
 perform 1 from public."THUE" order by ma_thue for share;
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
   old_inputs:=case when p_portal='WAREHOUSE' then keep->(item->>'sku') else item end;
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

-- Include the immutable pricing snapshot in the warehouse detail response.
create or replace function admin_ops.receipt_snapshot(p_id int) returns jsonb language sql stable security invoker set search_path='' set timezone='UTC' as $$
 select jsonb_build_object('receipt',to_jsonb(p)||jsonb_build_object('supplier_name',s.ten_ncc),
 'lines',coalesce((select jsonb_agg(jsonb_build_object('sku',l.sku,'product_name',sp.ten_sp,'quantity',l.so_luong_nhap,'unit_price',l.gia_nhap::text,'unit',sp.don_vi,
  'pricing',case when l.gia_ban_truoc_thue is null then null else jsonb_build_object('unit_cost',l.gia_nhap::text,'markup_rate',l.ty_le_loi_nhuan::text,'taxes',l.thue_snapshot,'profit',l.tien_loi_nhuan::text,'pre_tax',l.gia_ban_truoc_thue::text,'total_tax',l.tong_tien_thue::text,'after_tax',l.gia_ban_sau_thue::text,'changed_by',l.dinh_gia_sua_boi,'changed_at',l.dinh_gia_sua_luc) end) order by l.sku)
  from public."CT_PHIEU_NHAP" l join public."SAN_PHAM" sp using(sku) where l.ma_phieu_nhap=p_id),'[]'),
 'version',encode(sha256(convert_to((to_jsonb(p)||jsonb_build_object('lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.sku) from public."CT_PHIEU_NHAP" l where l.ma_phieu_nhap=p_id),'[]')))::text,'UTF8')),'hex'))
 from public."PHIEU_NHAP" p join public."NHA_CUNG_CAP" s using(ma_ncc) where p.ma_phieu_nhap=p_id
$$;
revoke all on function admin_ops.pricing_formula(numeric,numeric,jsonb),admin_ops.pricing_actor(text),admin_ops.pricing_taxes(jsonb),admin_ops.price_receipt_line(),admin_ops.apply_receipt_prices(),
 public.pricing_context_v1(text,text),public.pricing_config_v1(text,text,jsonb),public.pricing_tax_v1(text,text,text,numeric,boolean),public.receipt_pricing_preview_v1(text,int),public.priced_receipt_v1(text,text,text,uuid,int,jsonb) from public,anon,authenticated;
grant execute on function admin_ops.pricing_formula(numeric,numeric,jsonb),admin_ops.pricing_actor(text),admin_ops.pricing_taxes(jsonb),admin_ops.price_receipt_line(),admin_ops.apply_receipt_prices(),
 public.pricing_context_v1(text,text),public.pricing_config_v1(text,text,jsonb),public.pricing_tax_v1(text,text,text,numeric,boolean),public.receipt_pricing_preview_v1(text,int),public.priced_receipt_v1(text,text,text,uuid,int,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
