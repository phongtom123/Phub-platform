-- Local-reviewed upgrade; apply once after the existing PHUB migrations.
-- No credentials, seed records, hard-deletion API or changes to existing balances.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create schema admin_ops;
create index if not exists phub_order_reservation_idx on public."CT_DON_HANG"(ma_kho_xuat,sku,ma_donhang);
create index if not exists phub_order_status_idx on public."DON_HANG"(trang_thai,thoi_gian_dat);
create index if not exists phub_invoice_date_idx on public."HOA_DON"(thoi_gian_lap);
create index if not exists phub_payment_order_status_idx on public."THANH_TOAN"(ma_donhang,trang_thai);
revoke all on schema admin_ops from public, anon, authenticated;
grant usage on schema admin_ops to service_role;

create table admin_ops.requests (
 actor text not null, key uuid not null, hash text not null, result jsonb,
 resource text not null, action text not null, record_id text,
 created_at timestamptz not null default now(), primary key(actor,key)
);
create index on admin_ops.requests(resource, record_id, created_at desc);
create table admin_ops.stock_events (
 id bigint generated always as identity primary key, warehouse_id int not null, sku text not null,
 before_quantity int not null, after_quantity int not null, actor text,
 reason text not null, reference text, created_at timestamptz not null default now()
);
create index on admin_ops.stock_events(warehouse_id,sku,created_at desc);
create table admin_ops.preferences (
 id boolean primary key default true check(id), value jsonb not null, updated_at timestamptz not null default now()
);
create table admin_ops.notification_reads (
 actor text not null, id text not null, read_at timestamptz not null default now(), primary key(actor,id)
);
create table admin_ops.messages (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public."PHAN_HOI"(ma_phan_hoi),
 actor text not null references public."TAI_KHOAN"(ma_tk), content text not null check(length(btrim(content)) between 1 and 10000),
 created_at timestamptz not null default now()
);
create index on admin_ops.messages(ticket_id,created_at,id);
alter table admin_ops.requests enable row level security;
alter table admin_ops.stock_events enable row level security;
alter table admin_ops.preferences enable row level security;
alter table admin_ops.notification_reads enable row level security;
alter table admin_ops.messages enable row level security;
revoke all on all tables in schema admin_ops from public, anon, authenticated;
grant select,insert,update on all tables in schema admin_ops to service_role;
grant usage,select on all sequences in schema admin_ops to service_role;

create function admin_ops.actor(p_actor text) returns text language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare employee text;
begin
 select n.ma_nhan_vien into employee from public."TAI_KHOAN" a join public."NHAN_VIEN" n using(ma_nhan_vien)
 where a.ma_tk=p_actor and a.trang_thai=1 and n.trang_thai=1 and n.loai_nhan_vien='ADMIN'
 for share of a,n;
 if employee is null then raise exception 'ADMIN_FORBIDDEN'; end if;
 return employee;
end $$;

create function admin_ops.stock_audit() returns trigger language plpgsql security invoker set search_path='' set timezone='UTC' as $$
begin
 if TG_OP='INSERT' or new.so_luong_ton is distinct from old.so_luong_ton then
  insert into admin_ops.stock_events(warehouse_id,sku,before_quantity,after_quantity,actor,reason,reference)
  values(new.ma_kho,new.sku,case when TG_OP='INSERT' then 0 else old.so_luong_ton end,new.so_luong_ton,
   nullif(current_setting('phub.actor',true),''),coalesce(nullif(current_setting('phub.reason',true),''),'Cập nhật tồn kho'),
   nullif(current_setting('phub.reference',true),''));
 end if;
 return new;
end $$;
create trigger phub_stock_audit after insert or update of so_luong_ton on public."TON_KHO"
for each row execute function admin_ops.stock_audit();

create function admin_ops.available(p_warehouse int,p_sku text) returns bigint language sql stable security invoker set search_path='' set timezone='UTC' as $$
 select coalesce((select so_luong_ton from public."TON_KHO" where ma_kho=p_warehouse and sku=p_sku),0)
 -coalesce((select sum(c.so_luong) from public."CT_DON_HANG" c join public."DON_HANG" d using(ma_donhang)
 where c.ma_kho_xuat=p_warehouse and c.sku=p_sku and d.trang_thai in('MOI','XAC_NHAN','DANG_CHUAN_BI')),0)
$$;

create function public.admin_operation_v1(p_actor text,p_resource text,p_action text,p_key uuid,p_id text,p_body jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
<<operation>>
declare
 employee text; req_hash text; prior admin_ops.requests%rowtype; inserted int;
 r record; l record; product record; voucher record; order_row public."DON_HANG"%rowtype;
 receipt_row public."PHIEU_NHAP"%rowtype; transfer_row public."PHIEU_CHUYEN_KHO"%rowtype;
 result jsonb; item jsonb; body jsonb:=p_body-'_expected_status'; lines jsonb:=p_body->'lines';
 doc_id int; order_id text; wh int; dest int; qty int; stock int; net numeric; paid numeric; total numeric;
 subtotal numeric:=0; discount numeric:=0; cumulative numeric:=0; assigned numeric:=0; next_discount numeric;
 amount numeric; created timestamp:=timezone('UTC',statement_timestamp()); code text; voucher_id int;
begin
 employee:=admin_ops.actor(p_actor);
 if p_key is null or p_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'VALIDATION_ERROR'; end if;
 req_hash:=encode(sha256(convert_to(jsonb_build_array(p_resource,p_action,p_id,p_body)::text,'UTF8')),'hex');
 insert into admin_ops.requests(actor,key,hash,resource,action,record_id) values(p_actor,p_key,req_hash,p_resource,p_action,p_id)
 on conflict(actor,key) do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then
  select * into strict prior from admin_ops.requests where actor=p_actor and key=p_key;
  if prior.hash<>req_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return prior.result || jsonb_build_object('replayed',true);
 end if;
 perform set_config('phub.actor',p_actor,true);
 perform set_config('phub.reason',p_resource||':'||p_action,true);
 perform set_config('phub.reference',coalesce(p_id,p_key::text),true);

 if p_resource in('receipts','transfers') then
  if p_action='create' then
   wh:=(body->>'warehouse_id')::int; dest:=(body->>'destination_id')::int;
   perform 1 from public."KHO" where ma_kho=wh and trang_thai=1 for share;
   if not found then raise exception 'VALIDATION_ERROR'; end if;
   if p_resource='receipts' then
    perform 1 from public."NHA_CUNG_CAP" where ma_ncc=(body->>'supplier_id')::int and trang_thai=1 for share;
    if not found then raise exception 'VALIDATION_ERROR'; end if;
    insert into public."PHIEU_NHAP"(ma_phieu_code,ma_ncc,ma_kho,ngay_tao,nguoi_tao,trang_thai,ghi_chu)
    values('PN-'||p_key, (body->>'supplier_id')::int,wh,created,employee,'NHAP',body->>'note') returning ma_phieu_nhap into doc_id;
   else
    perform 1 from public."KHO" where ma_kho=dest and trang_thai=1 for share;
    if not found or dest=wh then raise exception 'VALIDATION_ERROR'; end if;
    insert into public."PHIEU_CHUYEN_KHO"(ma_kho_xuat,ma_kho_nhan,ngay_tao,nguoi_tao,trang_thai,ghi_chu)
    values(wh,dest,created,employee,'NHAP',body->>'note') returning ma_phieu_chuyen into doc_id;
   end if;
  else
   doc_id:=p_id::int;
   if p_resource='receipts' then
    select * into receipt_row from public."PHIEU_NHAP" where ma_phieu_nhap=doc_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    wh:=receipt_row.ma_kho;
    if p_body->>'_expected_status' is not null and receipt_row.trang_thai<>p_body->>'_expected_status' then raise exception 'STATE_CONFLICT'; end if;
    if receipt_row.trang_thai<>'NHAP' then raise exception 'STATE_CONFLICT'; end if;
   else
    select * into transfer_row from public."PHIEU_CHUYEN_KHO" where ma_phieu_chuyen=doc_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    wh:=transfer_row.ma_kho_xuat;dest:=transfer_row.ma_kho_nhan;
    if p_body->>'_expected_status' is not null and transfer_row.trang_thai<>p_body->>'_expected_status' then raise exception 'STATE_CONFLICT'; end if;
    if not ((p_action='receive' and transfer_row.trang_thai='DANG_CHUYEN') or
     (p_action in('lines','dispatch','cancel') and transfer_row.trang_thai='NHAP')) then raise exception 'STATE_CONFLICT'; end if;
   end if;
  end if;
  if p_action in('create','lines') then
   if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 100
    or exists(select 1 from jsonb_array_elements(lines) i group by i->>'sku' having count(*)>1) then raise exception 'VALIDATION_ERROR'; end if;
   if p_resource='receipts' then
    delete from public."CT_PHIEU_NHAP" where ma_phieu_nhap=doc_id;
   else delete from public."CT_CHUYEN_KHO" where ma_phieu_chuyen=doc_id; end if;
   for item in select value from jsonb_array_elements(lines) loop
    perform 1 from public."SAN_PHAM" where sku=item->>'sku' and trang_thai=1 for share;
    if not found or (item->>'quantity')::int not between 1 and 1000000 then raise exception 'VALIDATION_ERROR'; end if;
    if p_resource='receipts' then
     if (item->>'unit_price')::numeric<0 or item->>'unit_price' is null then raise exception 'VALIDATION_ERROR'; end if;
     insert into public."CT_PHIEU_NHAP" values(doc_id,item->>'sku',(item->>'quantity')::int,(item->>'unit_price')::numeric);
    else insert into public."CT_CHUYEN_KHO" values(doc_id,item->>'sku',(item->>'quantity')::int); end if;
   end loop;
  elsif p_action<>'cancel' then
   perform 1 from public."KHO" where ma_kho=wh and trang_thai=1 for share;
   if not found then raise exception 'VALIDATION_ERROR'; end if;
   if p_resource='receipts' and p_action='confirm' then
    if not exists(select 1 from public."CT_PHIEU_NHAP" where ma_phieu_nhap=doc_id) then raise exception 'VALIDATION_ERROR'; end if;
    for l in select * from public."CT_PHIEU_NHAP" where ma_phieu_nhap=doc_id order by sku loop
     insert into public."TON_KHO"(ma_kho,sku,so_luong_ton,cap_nhat_luc) values(wh,l.sku,l.so_luong_nhap,created)
     on conflict(ma_kho,sku) do update set so_luong_ton=public."TON_KHO".so_luong_ton+excluded.so_luong_ton,cap_nhat_luc=created;
    end loop;
    update public."PHIEU_NHAP" set trang_thai='DA_NHAP',ngay_nhap=created,nguoi_xac_nhan=employee where ma_phieu_nhap=doc_id;
   elsif p_resource='transfers' and p_action in('dispatch','receive') then
    perform 1 from public."KHO" where ma_kho=dest and trang_thai=1 for share;
    if not found or not exists(select 1 from public."CT_CHUYEN_KHO" where ma_phieu_chuyen=doc_id) then raise exception 'VALIDATION_ERROR'; end if;
    -- All transfers and order checkouts acquire inventory in (warehouse, SKU) order.
    for l in select w as warehouse,ct.sku from unnest(array[wh,dest]) w cross join public."CT_CHUYEN_KHO" ct where ct.ma_phieu_chuyen=doc_id order by w,ct.sku loop
     insert into public."TON_KHO"(ma_kho,sku,so_luong_ton) values(l.warehouse,l.sku,0) on conflict do nothing;
    end loop;
    perform 1 from public."TON_KHO" where ma_kho in(wh,dest) and sku in(select sku from public."CT_CHUYEN_KHO" where ma_phieu_chuyen=doc_id) order by ma_kho,sku for update;
    for l in select * from public."CT_CHUYEN_KHO" where ma_phieu_chuyen=doc_id order by sku loop
     if p_action='dispatch' then
      if admin_ops.available(wh,l.sku)<l.so_luong then raise exception 'INSUFFICIENT_STOCK'; end if;
      update public."TON_KHO" set so_luong_ton=so_luong_ton-l.so_luong,cap_nhat_luc=created where ma_kho=wh and sku=l.sku;
     else update public."TON_KHO" set so_luong_ton=so_luong_ton+l.so_luong,cap_nhat_luc=created where ma_kho=dest and sku=l.sku; end if;
    end loop;
    if p_action='dispatch' then update public."PHIEU_CHUYEN_KHO" set trang_thai='DANG_CHUYEN',ngay_xuat=created,nguoi_xuat=employee where ma_phieu_chuyen=doc_id;
    else update public."PHIEU_CHUYEN_KHO" set trang_thai='DA_NHAN',ngay_nhan=created,nguoi_nhan=employee where ma_phieu_chuyen=doc_id; end if;
   else raise exception 'VALIDATION_ERROR'; end if;
  end if;
  if p_action='cancel' then
   if p_resource='receipts' then update public."PHIEU_NHAP" set trang_thai='HUY',nguoi_cap_nhat=employee where ma_phieu_nhap=doc_id;
   else update public."PHIEU_CHUYEN_KHO" set trang_thai='HUY' where ma_phieu_chuyen=doc_id; end if;
  end if;
  if p_resource='receipts' then select to_jsonb(p) into result from public."PHIEU_NHAP" p where ma_phieu_nhap=doc_id;
  else select to_jsonb(p) into result from public."PHIEU_CHUYEN_KHO" p where ma_phieu_chuyen=doc_id; end if;

 elsif p_resource='orders' then
  if p_action='create' then
   if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 100
    or exists(select 1 from jsonb_array_elements(lines) i group by i->>'sku',i->>'warehouse_id' having count(*)>1)
    or length(btrim(body->>'recipient')) not between 1 and 200 then raise exception 'VALIDATION_ERROR'; end if;
   if body->>'customer_id' is not null then
    perform 1 from public."KHACH_HANG" where ma_kh=body->>'customer_id' for share;
    if not found then raise exception 'VALIDATION_ERROR'; end if;
   end if;
   code:=nullif(upper(btrim(body->>'voucher_code')),'');
   if code is not null then
    select v.*,p.ngay_bat_dau,p.ngay_ket_thuc,p.trang_thai as program_status into voucher
    from public."VOUCHER" v join public."CHUONG_TRINH_KHUYEN_MAI" p using(ma_ctkm) where ma_code=code for update of v for share of p;
    if not found or body->>'customer_id' is null or voucher.trang_thai<>'HOAT_DONG' or voucher.program_status<>'HOAT_DONG'
     or timezone('Asia/Ho_Chi_Minh',statement_timestamp()) not between voucher.ngay_bat_dau and voucher.ngay_ket_thuc then raise exception 'VOUCHER_UNAVAILABLE'; end if;
    -- Canceled orders continue consuming a voucher use; there is no automatic reuse.
    if (voucher.gioi_han_tong_luot is not null and (select count(*) from public."SU_DUNG_VOUCHER" where ma_voucher=voucher.ma_voucher)>=voucher.gioi_han_tong_luot)
     or (select count(*) from public."SU_DUNG_VOUCHER" u join public."DON_HANG" d using(ma_donhang) where u.ma_voucher=voucher.ma_voucher and d.ma_kh=body->>'customer_id')>=voucher.gioi_han_moi_khach then raise exception 'VOUCHER_UNAVAILABLE'; end if;
    voucher_id:=voucher.ma_voucher;
   end if;
   perform 1 from public."SAN_PHAM" p where p.sku in(select value->>'sku' from jsonb_array_elements(lines)) order by p.sku for share;
   for item in select value from jsonb_array_elements(lines) order by (value->>'warehouse_id')::int,value->>'sku' loop
    wh:=(item->>'warehouse_id')::int;qty:=(item->>'quantity')::int;
    select p.* into product from public."SAN_PHAM" p join public."LOAI_SP" c using(ma_loai_sp)
     join public."LOAI_SP_CON" sc using(ma_loai_sp,ma_loai_sp_con) where p.sku=item->>'sku' and p.trang_thai=1 and c.trang_thai=1 and sc.trang_thai=1;
    if not found or qty not between 1 and 1000000 then raise exception 'VALIDATION_ERROR'; end if;
    if product.gia_ban_hien_tai<>(item->>'unit_price')::numeric then raise exception 'PRICE_CHANGED'; end if;
    perform 1 from public."KHO" where ma_kho=wh and trang_thai=1 for share;
    if not found then raise exception 'VALIDATION_ERROR'; end if;
    perform 1 from public."TON_KHO" where ma_kho=wh and sku=product.sku for update;
    if not found or admin_ops.available(wh,product.sku)<qty then raise exception 'INSUFFICIENT_STOCK'; end if;
    subtotal:=subtotal+qty*product.gia_ban_hien_tai;
   end loop;
   if voucher_id is not null then
    if subtotal<voucher.gia_tri_don_toi_thieu then raise exception 'VOUCHER_UNAVAILABLE'; end if;
    discount:=case when voucher.loai_giam='PHAN_TRAM' then least(round(subtotal*voucher.gia_tri_giam/100,2),coalesce(voucher.giam_toi_da,subtotal)) else voucher.gia_tri_giam end;
    discount:=least(discount,subtotal);
   end if;
   order_id:='DH-'||p_key;
   insert into public."DON_HANG"(ma_donhang,ma_kh,ma_nhan_vien,kenh_ban,trang_thai,thoi_gian_dat,ten_nguoi_nhan,sdt_nguoi_nhan,ghi_chu)
   values(order_id,body->>'customer_id',employee,'TAI_QUAY','MOI',created,body->>'recipient',body->>'phone',body->>'note');
   for item in select value from jsonb_array_elements(lines) order by (value->>'warehouse_id')::int,value->>'sku' loop
    select * into product from public."SAN_PHAM" where sku=item->>'sku';
    net:=(item->>'quantity')::int*product.gia_ban_hien_tai;cumulative:=cumulative+net;
    next_discount:=case when subtotal=0 then 0 else round(discount*cumulative/subtotal,2) end;
    insert into public."CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher,thue_suat,tien_thue,thanh_tien)
    values(order_id,product.sku,(item->>'warehouse_id')::int,product.ten_sp,product.don_vi,(item->>'quantity')::int,product.gia_ban_hien_tai,0,next_discount-assigned,10,0,net-next_discount+assigned);
    assigned:=next_discount;
   end loop;
   if voucher_id is not null and discount>0 then
    insert into public."SU_DUNG_VOUCHER"(ma_voucher,ma_donhang,so_tien_giam,thoi_gian_ap_dung,trang_thai) values(voucher_id,order_id,discount,created,'DA_AP_DUNG');
   end if;
  else
   order_id:=p_id;
   select * into order_row from public."DON_HANG" where ma_donhang=order_id for update;
   if not found then raise exception 'NOT_FOUND'; end if;
   if p_body->>'_expected_status' is not null and order_row.trang_thai<>p_body->>'_expected_status' then raise exception 'STATE_CONFLICT'; end if;
   if p_action='assign' then
    if order_row.trang_thai in('HUY','HOAN_THANH') then raise exception 'STATE_CONFLICT'; end if;
    perform 1 from public."NHAN_VIEN" where ma_nhan_vien=body->>'employee_id' and loai_nhan_vien='ADMIN' and trang_thai=1 for share;
    if not found then raise exception 'VALIDATION_ERROR'; end if;
    update public."DON_HANG" set ma_nhan_vien=body->>'employee_id' where ma_donhang=order_id;
   elsif p_action in('confirm','prepare') then
    if (p_action='confirm' and order_row.trang_thai<>'MOI') or (p_action='prepare' and order_row.trang_thai<>'XAC_NHAN') then raise exception 'STATE_CONFLICT'; end if;
    update public."DON_HANG" set trang_thai=case p_action when 'confirm' then 'XAC_NHAN' else 'DANG_CHUAN_BI' end,ma_nhan_vien=coalesce(ma_nhan_vien,employee) where ma_donhang=order_id;
   elsif p_action='dispatch' then
    if order_row.trang_thai<>'DANG_CHUAN_BI' or not exists(select 1 from public."CT_DON_HANG" where ma_donhang=order_id) then raise exception 'STATE_CONFLICT'; end if;
    perform 1 from public."TON_KHO" t where (t.ma_kho,t.sku) in(select c.ma_kho_xuat,c.sku from public."CT_DON_HANG" c where c.ma_donhang=order_id) order by t.ma_kho,t.sku for update;
    for l in select ma_kho_xuat,sku,sum(so_luong)::int as quantity from public."CT_DON_HANG" where ma_donhang=order_id group by ma_kho_xuat,sku order by ma_kho_xuat,sku loop
     select so_luong_ton into stock from public."TON_KHO" where ma_kho=l.ma_kho_xuat and sku=l.sku;
     if stock is null or stock<l.quantity or admin_ops.available(l.ma_kho_xuat,l.sku)<0 then raise exception 'INSUFFICIENT_STOCK'; end if;
     update public."TON_KHO" set so_luong_ton=so_luong_ton-l.quantity,cap_nhat_luc=created where ma_kho=l.ma_kho_xuat and sku=l.sku;
    end loop;
    update public."DON_HANG" set trang_thai='DA_XUAT_KHO',thoi_gian_xuat_kho=created where ma_donhang=order_id;
   elsif p_action='invoice' then
    if order_row.trang_thai not in('XAC_NHAN','DANG_CHUAN_BI','DA_XUAT_KHO','HOAN_THANH') then raise exception 'STATE_CONFLICT'; end if;
    if not exists(select 1 from public."HOA_DON" where ma_donhang=order_id) then
     if not exists(select 1 from public."CT_DON_HANG" where ma_donhang=order_id) then raise exception 'VALIDATION_ERROR'; end if;
     update public."CT_DON_HANG" set tien_thue=round((so_luong*don_gia-giam_gia-giam_gia_voucher)*thue_suat/100,2),
      thanh_tien=so_luong*don_gia-giam_gia-giam_gia_voucher+round((so_luong*don_gia-giam_gia-giam_gia_voucher)*thue_suat/100,2) where ma_donhang=order_id;
     insert into public."HOA_DON"(ma_hoadon,ma_donhang,thoi_gian_lap,ten_nguoi_mua,dia_chi_nguoi_mua,tong_tien_giam,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap)
     select 'HD-'||order_id,order_id,created,order_row.ten_nguoi_nhan,order_row.dia_chi_chi_tiet,sum(giam_gia+giam_gia_voucher),sum(so_luong*don_gia-giam_gia-giam_gia_voucher),sum(tien_thue),sum(thanh_tien),employee from public."CT_DON_HANG" where ma_donhang=order_id;
    end if;
   elsif p_action in('payment','refund','complete','cancel') then
    select coalesce(sum(case when loai_giao_dich='THU' then so_tien else -so_tien end),0) into paid from public."THANH_TOAN" where ma_donhang=order_id and trang_thai='THANH_CONG';
    select tong_tien_sau_thue into total from public."HOA_DON" where ma_donhang=order_id;
    if p_action='complete' then
     if order_row.trang_thai<>'DA_XUAT_KHO' then raise exception 'STATE_CONFLICT'; end if;
     if total is null or paid<total then raise exception 'PAYMENT_REQUIRED'; end if;
     update public."DON_HANG" set trang_thai='HOAN_THANH',thoi_gian_hoan_thanh=created where ma_donhang=order_id;
    elsif p_action='cancel' then
     if order_row.trang_thai not in('MOI','XAC_NHAN','DANG_CHUAN_BI') or paid<>0 then raise exception 'STATE_CONFLICT'; end if;
     update public."DON_HANG" set trang_thai='HUY' where ma_donhang=order_id;
    else
     amount:=(body->>'amount')::numeric;
     if amount<=0 or total is null or order_row.trang_thai='HUY' or body->>'method' not in('TIEN_MAT','CHUYEN_KHOAN','THE','VI_DIEN_TU')
      or (body->>'method'<>'TIEN_MAT' and nullif(btrim(body->>'reference'),'') is null) then raise exception 'VALIDATION_ERROR'; end if;
     if (p_action='payment' and amount>total-paid) or (p_action='refund' and amount>paid) then raise exception 'PAYMENT_LIMIT'; end if;
     insert into public."THANH_TOAN"(ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,ma_giao_dich,thoi_gian)
     values(order_id,amount,case p_action when 'payment' then 'THU' else 'HOAN_TIEN' end,body->>'method','THANH_CONG',nullif(btrim(body->>'reference'),''),created);
    end if;
   else raise exception 'VALIDATION_ERROR'; end if;
  end if;
  select to_jsonb(d) into result from public."DON_HANG" d where ma_donhang=order_id;

 elsif p_resource='inventory' and p_action='adjust' then
  wh:=(body->>'warehouse_id')::int;qty:=(body->>'quantity')::int;
  perform 1 from public."KHO" where ma_kho=wh and trang_thai=1 for share;
  if not found or qty<0 or length(btrim(body->>'reason'))<5 then raise exception 'VALIDATION_ERROR'; end if;
  perform 1 from public."SAN_PHAM" where sku=body->>'sku';
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public."TON_KHO"(ma_kho,sku,so_luong_ton) values(wh,body->>'sku',0) on conflict do nothing;
  select so_luong_ton into stock from public."TON_KHO" where ma_kho=wh and sku=body->>'sku' for update;
  if stock<>(body->>'expected_quantity')::int then raise exception 'STOCK_CHANGED'; end if;
  if qty<stock-admin_ops.available(wh,body->>'sku') then raise exception 'INSUFFICIENT_STOCK'; end if;
  perform set_config('phub.reason',body->>'reason',true);
  update public."TON_KHO" set so_luong_ton=qty,cap_nhat_luc=created where ma_kho=wh and sku=body->>'sku' returning to_jsonb("TON_KHO".*) into result;

 elsif p_resource='settings' and p_action='save' then
  if length(btrim(body->>'store_name')) not between 1 and 200 or (body->>'low_stock_threshold')::int not between 0 and 1000000 then raise exception 'VALIDATION_ERROR'; end if;
  insert into admin_ops.preferences(id,value) values(true,body) on conflict(id) do update set value=excluded.value,updated_at=now();result:=body;
 elsif p_resource='notifications' and p_action='read' then
  if jsonb_typeof(body->'ids') is distinct from 'array' or jsonb_array_length(body->'ids')>100 then raise exception 'VALIDATION_ERROR'; end if;
  insert into admin_ops.notification_reads(actor,id) select p_actor,value from jsonb_array_elements_text(body->'ids') on conflict do nothing;result:=jsonb_build_object('ok',true);
 elsif p_resource='support' and p_action='message' then
  perform 1 from public."PHAN_HOI" where ma_phan_hoi=p_id::uuid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into admin_ops.messages(ticket_id,actor,content) values(p_id::uuid,p_actor,body->>'text') returning to_jsonb(messages.*) into result;
  update public."PHAN_HOI" set phan_hoi_quan_ly=body->>'text',ngay_phan_hoi=now(),cap_nhat_luc=now(),nguoi_xu_ly=coalesce(nguoi_xu_ly,employee) where ma_phan_hoi=p_id::uuid;
 else raise exception 'VALIDATION_ERROR'; end if;
 result:=jsonb_build_object('data',jsonb_build_array(result),'replayed',false);
 update admin_ops.requests set result=operation.result,record_id=coalesce(p_id,order_id,doc_id::text) where actor=p_actor and key=p_key;
 return result;
end $$;

create function public.admin_read_v1(p_actor text,p_kind text,p_query jsonb) returns jsonb
language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare result jsonb; query text:=coalesce(p_query->>'q',''); threshold int; offset_rows int:=greatest(0,coalesce((p_query->>'page')::int,1)-1)*20;
 start_day date:=coalesce((p_query->>'start')::date,(timezone('Asia/Ho_Chi_Minh',now())::date-29));
 end_day date:=coalesce((p_query->>'end')::date,timezone('Asia/Ho_Chi_Minh',now())::date);
begin
 perform admin_ops.actor(p_actor);
 select coalesce((value->>'low_stock_threshold')::int,5) into threshold from admin_ops.preferences where id;
 threshold:=coalesce(threshold,5);
 if p_kind='settings' then
  select value into result from admin_ops.preferences where id;
  return coalesce(result,jsonb_build_object('store_name','PHUB','store_address','','store_phone','','low_stock_threshold',5));
 elsif p_kind='summary' then
  if end_day<start_day or end_day-start_day>366 then raise exception 'VALIDATION_ERROR'; end if;
  -- Bounded aggregates, never downloading entire tables to a browser.
  select jsonb_build_object('counts',jsonb_build_object('orders',(select count(*) from public."DON_HANG"),'products',(select count(*) from public."SAN_PHAM"),'customers',(select count(*) from public."KHACH_HANG"),'inventory',(select count(*) from public."TON_KHO")),
   'orders',coalesce((select jsonb_agg(x) from(select timezone('Asia/Ho_Chi_Minh',d.thoi_gian_dat::timestamptz)::date as day,count(*) as value from public."DON_HANG" d where timezone('Asia/Ho_Chi_Minh',d.thoi_gian_dat::timestamptz)::date between start_day and end_day group by 1 order by 1)x),'[]'::jsonb),
   'statuses',coalesce((select jsonb_agg(x) from(select trang_thai as label,count(*) as value from public."DON_HANG" group by 1)x),'[]'::jsonb),
   'channels',coalesce((select jsonb_agg(x) from(select kenh_ban as label,count(*) as value from public."DON_HANG" group by 1)x),'[]'::jsonb),
   'inventory',coalesce((select jsonb_agg(x) from(select k.ten_kho as label,sum(t.so_luong_ton) as value from public."TON_KHO" t join public."KHO" k using(ma_kho) group by k.ma_kho order by value desc)x),'[]'::jsonb),
   'revenue',coalesce((select sum(h.tong_tien_sau_thue)::text from public."HOA_DON" h join public."DON_HANG" d using(ma_donhang) where d.trang_thai<>'HUY' and timezone('Asia/Ho_Chi_Minh',h.thoi_gian_lap::timestamptz)::date between start_day and end_day),'0'),
   'collected',coalesce((select sum(case when loai_giao_dich='THU' then so_tien else -so_tien end)::text from public."THANH_TOAN" where trang_thai='THANH_CONG' and timezone('Asia/Ho_Chi_Minh',thoi_gian::timestamptz)::date between start_day and end_day),'0'),
   'top_products',coalesce((select jsonb_agg(x) from(select c.sku,max(c.ten_sp_luc_ban) as name,sum(c.so_luong) as quantity,sum(c.thanh_tien)::text as total from public."CT_DON_HANG" c join public."DON_HANG" d using(ma_donhang) where d.trang_thai='HOAN_THANH' and timezone('Asia/Ho_Chi_Minh',d.thoi_gian_hoan_thanh::timestamptz)::date between start_day and end_day group by c.sku order by quantity desc,c.sku limit 10)x),'[]'::jsonb),
   'start',start_day,'end',end_day) into result;
  return result;
 elsif p_kind='search' then
  if length(btrim(query))<2 then return '[]'; end if;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
   (select 'orders' as resource,ma_donhang as id,coalesce(ten_nguoi_nhan,ma_donhang) as title from public."DON_HANG" where strpos(lower(ma_donhang||' '||coalesce(ten_nguoi_nhan,'')),lower(query))>0 order by thoi_gian_dat desc limit 5)
   union all (select 'products',ma_sp,ten_sp from public."SAN_PHAM" where strpos(lower(ma_sp||' '||sku||' '||ten_sp),lower(query))>0 order by ma_sp limit 5)
   union all (select 'customers',ma_kh,ten_kh from public."KHACH_HANG" where strpos(lower(ma_kh||' '||ten_kh||' '||coalesce(sdt,'')),lower(query))>0 order by ma_kh limit 5)
  )x;return result;
 elsif p_kind='notifications' then
  with notifications as (
   (select 'order:'||ma_donhang as id,'Đơn hàng mới: '||coalesce(ten_nguoi_nhan,ma_donhang) as title,'orders' as resource,to_jsonb(array[ma_donhang]) as key,thoi_gian_dat::timestamptz as created_at from public."DON_HANG" where trang_thai='MOI' order by thoi_gian_dat desc limit 30)
   union all (select 'stock:'||t.ma_kho||':'||t.sku,'Sắp hết hàng: '||t.sku||' · '||k.ten_kho,'inventory',jsonb_build_array(t.ma_kho,t.sku),coalesce(t.cap_nhat_luc::timestamptz,now()) from public."TON_KHO" t join public."KHO" k using(ma_kho) where t.so_luong_ton<=threshold order by t.so_luong_ton,t.ma_kho,t.sku limit 30)
   union all (select 'ticket:'||ma_phan_hoi,'Hỗ trợ: '||tieu_de,'support',jsonb_build_array(ma_phan_hoi),ngay_tao from public."PHAN_HOI" where trang_thai='MOI' order by ngay_tao desc limit 30)
  ) select coalesce(jsonb_agg(x order by created_at desc),'[]'::jsonb) into result from(select n.*,exists(select 1 from admin_ops.notification_reads r where r.actor=p_actor and r.id=n.id) as read from notifications n)x;
  return result;
 elsif p_kind='history' then
  select jsonb_build_object('data',coalesce((select jsonb_agg(x) from(select e.* from admin_ops.stock_events e
   where (p_query->>'record_id' is null or e.sku=p_query->>'record_id') order by e.created_at desc,e.id desc offset offset_rows limit 20)x),'[]'::jsonb),
   'total',(select count(*) from admin_ops.stock_events e where p_query->>'record_id' is null or e.sku=p_query->>'record_id')) into result;return result;
 elsif p_kind='messages' then
  select jsonb_build_object('data',coalesce((select jsonb_agg(x) from(select m.id,m.content,m.created_at,a.ten_tai_khoan as author from admin_ops.messages m join public."TAI_KHOAN" a on a.ma_tk=m.actor where m.ticket_id=(p_query->>'record_id')::uuid order by m.created_at,m.id offset offset_rows limit 20)x),'[]'::jsonb),
   'total',(select count(*) from admin_ops.messages where ticket_id=(p_query->>'record_id')::uuid)) into result;return result;
 end if;
 raise exception 'VALIDATION_ERROR';
end $$;

-- Preserve every reply made through the existing ticket update endpoint.
create function public.admin_update_feedback_thread_v1(p_actor_account_id text,p_feedback_id uuid,p_changes jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare result jsonb; previous text;
begin
 perform admin_ops.actor(p_actor_account_id);
 select phan_hoi_quan_ly into previous from public."PHAN_HOI" where ma_phan_hoi=p_feedback_id for update;
 result:=public.admin_update_feedback_v1(p_actor_account_id,p_feedback_id,p_changes);
 if p_changes ? 'phan_hoi_quan_ly' and nullif(btrim(p_changes->>'phan_hoi_quan_ly'),'') is not null
  and previous is distinct from p_changes->>'phan_hoi_quan_ly' then
  insert into admin_ops.messages(ticket_id,actor,content) values(p_feedback_id,p_actor_account_id,p_changes->>'phan_hoi_quan_ly');
 end if;
 return result;
end $$;

create function public.customer_feedback_messages_v1(p_actor text,p_ticket uuid,p_page int,p_text text,p_key uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
<<conversation>>
declare customer text; ticket public."PHAN_HOI"%rowtype; result jsonb; prior admin_ops.requests%rowtype; inserted int; req_hash text;
begin
 select a.ma_kh into customer from public."TAI_KHOAN" a join public."KHACH_HANG" k using(ma_kh) where a.ma_tk=p_actor and a.trang_thai=1 and a.ma_nhan_vien is null for share of a,k;
 if customer is null then raise exception 'ADMIN_FORBIDDEN'; end if;
 select * into ticket from public."PHAN_HOI" where ma_phan_hoi=p_ticket and ma_kh=customer;
 if not found then raise exception 'NOT_FOUND'; end if;
 if p_text is not null then
  if p_key is null or p_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or length(btrim(p_text)) not between 1 and 10000 then raise exception 'VALIDATION_ERROR'; end if;
  req_hash:=md5(jsonb_build_array(p_ticket,p_text)::text);
  insert into admin_ops.requests(actor,key,hash,resource,action,record_id) values(p_actor,p_key,req_hash,'support','customer_message',p_ticket::text) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then
   select * into strict prior from admin_ops.requests where actor=p_actor and key=p_key;
   if prior.hash<>req_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return prior.result;
  end if;
  select * into ticket from public."PHAN_HOI" where ma_phan_hoi=p_ticket and ma_kh=customer for update;
  if ticket.trang_thai='DA_DONG' then raise exception 'STATE_CONFLICT'; end if;
  insert into admin_ops.messages(ticket_id,actor,content) values(p_ticket,p_actor,btrim(p_text)) returning jsonb_build_object('id',id,'content',content,'created_at',created_at) into result;
  update public."PHAN_HOI" set cap_nhat_luc=now() where ma_phan_hoi=p_ticket;
  update admin_ops.requests r set result=conversation.result where actor=p_actor and key=p_key;
  return result;
 end if;
 return jsonb_build_object('data',coalesce((select jsonb_agg(x) from(select m.id,m.content,m.created_at,
  case when m.actor=p_actor then 'Bạn' else 'Quản trị viên' end as author from admin_ops.messages m where m.ticket_id=p_ticket order by m.created_at,m.id offset greatest(0,p_page-1)*20 limit 20)x),'[]'::jsonb),
  'total',(select count(*) from admin_ops.messages where ticket_id=p_ticket));
end $$;

revoke all on function public.admin_update_feedback_thread_v1(text,uuid,jsonb),public.customer_feedback_messages_v1(text,uuid,int,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_update_feedback_thread_v1(text,uuid,jsonb),public.customer_feedback_messages_v1(text,uuid,int,text,uuid) to service_role;
revoke all on all functions in schema admin_ops from public,anon,authenticated;
grant execute on all functions in schema admin_ops to service_role;
revoke all on function public.admin_operation_v1(text,text,text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.admin_read_v1(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_operation_v1(text,text,text,uuid,text,jsonb),public.admin_read_v1(text,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
