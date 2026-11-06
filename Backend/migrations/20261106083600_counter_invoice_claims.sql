-- Link verified counter invoices to registered customers through existing support tickets.
-- No historical orders, invoice amounts, stock or payments are changed by this upgrade.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public."PHAN_HOI"
  add column loai_yeu_cau text not null default 'HO_TRO' check(loai_yeu_cau in('HO_TRO','LIEN_KET_HOA_DON')),
  add column ma_hoa_don_yeu_cau text check(length(btrim(ma_hoa_don_yeu_cau)) between 1 and 100),
  add column ket_qua_lien_ket text check(ket_qua_lien_ket in('DA_LIEN_KET','TU_CHOI')),
  add column phien_ban_lien_ket uuid not null default gen_random_uuid(),
  add column xac_minh_luc timestamptz,
  add column tai_khoan_xac_minh varchar references public."TAI_KHOAN"(ma_tk),
  add column ghi_chu_xac_minh text check(length(btrim(ghi_chu_xac_minh)) between 10 and 2000),
  add constraint phan_hoi_claim_shape check(
    (loai_yeu_cau='HO_TRO' and ma_hoa_don_yeu_cau is null and ket_qua_lien_ket is null and xac_minh_luc is null and tai_khoan_xac_minh is null and ghi_chu_xac_minh is null)
    or (loai_yeu_cau='LIEN_KET_HOA_DON' and ma_hoa_don_yeu_cau is not null and
      ((ket_qua_lien_ket is null and xac_minh_luc is null and tai_khoan_xac_minh is null and ghi_chu_xac_minh is null and ma_donhang is null)
       or (ket_qua_lien_ket is not null and xac_minh_luc is not null and tai_khoan_xac_minh is not null and ghi_chu_xac_minh is not null
         and (ket_qua_lien_ket<>'DA_LIEN_KET' or ma_donhang is not null))))) ;
create unique index phan_hoi_pending_invoice_claim on public."PHAN_HOI"(ma_kh,ma_hoa_don_yeu_cau)
  where loai_yeu_cau='LIEN_KET_HOA_DON' and ket_qua_lien_ket is null and trang_thai in('MOI','DANG_XU_LY');
create index phan_hoi_claim_inbox on public."PHAN_HOI"(ngay_tao desc,ma_phan_hoi)
  where loai_yeu_cau='LIEN_KET_HOA_DON';
create index phan_hoi_claim_verifier on public."PHAN_HOI"(tai_khoan_xac_minh);

create function admin_ops.counter_actor(p_actor text) returns text
language plpgsql security invoker set search_path=pg_catalog as $$
declare employee text;
begin
 select n.ma_nhan_vien into employee from public."TAI_KHOAN" a join public."NHAN_VIEN" n using(ma_nhan_vien)
 where a.ma_tk=p_actor and a.trang_thai=1 and a.ma_kh is null and n.trang_thai=1
   and n.loai_nhan_vien in('ADMIN','NHAN_VIEN') for share of a,n;
 if not found then raise exception 'Chỉ nhân viên hoặc quản trị viên được xác minh.' using errcode='42501'; end if;
 return employee;
end $$;

create function admin_ops.claim_once(p_actor text,p_key uuid,p_action text,p_id text,p_body jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare h text; n int; r admin_ops.requests%rowtype;
begin
 if p_key is null or p_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
   raise exception 'Mã yêu cầu không hợp lệ.' using errcode='23514'; end if;
 h:=encode(sha256(convert_to(jsonb_build_array('invoice-claims',p_action,p_id,p_body)::text,'UTF8')),'hex');
 insert into admin_ops.requests(actor,key,hash,resource,action,record_id) values(p_actor,p_key,h,'invoice-claims',p_action,p_id)
 on conflict(actor,key) do nothing;
 get diagnostics n=row_count;
 if n=0 then
   select * into strict r from admin_ops.requests where actor=p_actor and key=p_key;
   if r.hash<>h then raise exception 'Mã gửi lại đã được dùng cho nội dung khác.' using errcode='40001'; end if;
   return r.result;
 end if;
 return null;
end $$;

create function public.customer_invoice_claim_v1(p_actor text,p_key uuid,p_invoice text,p_evidence text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare k text; r jsonb; t public."PHAN_HOI"%rowtype;
begin
 k:=public.crm_actor_v1(p_actor,false);
 p_invoice:=btrim(p_invoice); p_evidence:=btrim(p_evidence);
 if p_invoice is null or length(p_invoice) not between 1 and 100 or p_evidence is null or length(p_evidence) not between 10 and 2000 then
   raise exception 'Nhập mã hóa đơn và thông tin mua hàng để nhân viên xác minh (10–2000 ký tự).' using errcode='23514'; end if;
 r:=admin_ops.claim_once(p_actor,p_key,'create',null,jsonb_build_array(p_invoice,p_evidence));
 if r is not null then return r; end if;
 -- Deliberately do not look up the invoice: customers cannot probe someone else's purchase.
 insert into public."PHAN_HOI"(ma_phan_hoi,ma_kh,tieu_de,noi_dung,loai_yeu_cau,ma_hoa_don_yeu_cau)
 values(p_key,k,'Yêu cầu liên kết hóa đơn '||p_invoice,p_evidence,'LIEN_KET_HOA_DON',p_invoice) returning * into t;
 r:=to_jsonb(t)-array['ghi_chu_xac_minh','tai_khoan_xac_minh'];
 update admin_ops.requests set result=r where actor=p_actor and key=p_key;
 return r;
end $$;

create function public.staff_invoice_claim_read_v1(p_actor text,p_ticket uuid default null,p_page int default 1) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare t public."PHAN_HOI"%rowtype; i public."HOA_DON"%rowtype; d public."DON_HANG"%rowtype;
 result jsonb; active_customer boolean;
begin
 perform admin_ops.counter_actor(p_actor);
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Trang không hợp lệ.' using errcode='23514'; end if;
 if p_ticket is null then
   return jsonb_build_object('data',coalesce((select jsonb_agg(x.row) from (
     select to_jsonb(f)||jsonb_build_object('ten_kh',k.ten_kh) as row from public."PHAN_HOI" f join public."KHACH_HANG" k using(ma_kh)
     where f.loai_yeu_cau='LIEN_KET_HOA_DON' order by f.ngay_tao desc,f.ma_phan_hoi limit 20 offset (p_page-1)*20) x),'[]'),
     'total',(select count(*) from public."PHAN_HOI" where loai_yeu_cau='LIEN_KET_HOA_DON'),'page',p_page,'page_size',20);
 end if;
 select * into t from public."PHAN_HOI" where ma_phan_hoi=p_ticket and loai_yeu_cau='LIEN_KET_HOA_DON';
 if not found then raise exception 'Không tìm thấy yêu cầu.' using errcode='P0002'; end if;
 result:=jsonb_build_object('ticket',to_jsonb(t)||jsonb_build_object('ten_kh',(select ten_kh from public."KHACH_HANG" where ma_kh=t.ma_kh)),
   'customer',(select jsonb_build_object('ma_kh',k.ma_kh,'ten_kh',k.ten_kh,'sdt',k.sdt,
      'tai_khoan',(select a.ten_tai_khoan from public."TAI_KHOAN" a where a.ma_kh=k.ma_kh and a.trang_thai=1 limit 1)) from public."KHACH_HANG" k where k.ma_kh=t.ma_kh));
 select * into i from public."HOA_DON" where ma_hoadon=t.ma_hoa_don_yeu_cau;
 if not found then return result||jsonb_build_object('invoice',null,'can_link',false,'reason','Không tìm thấy hóa đơn. Đối chiếu mã trên chứng từ.'); end if;
 select * into d from public."DON_HANG" where ma_donhang=i.ma_donhang;
 active_customer:=exists(select 1 from public."KHACH_HANG" k join public."TAI_KHOAN" a using(ma_kh)
   where k.ma_kh=t.ma_kh and k.luu_tru_luc is null and a.trang_thai=1 and a.ma_nhan_vien is null);
 return result||jsonb_build_object('invoice',jsonb_build_object('ma_hoadon',i.ma_hoadon,'ma_donhang',i.ma_donhang,
   'ten_nguoi_mua',i.ten_nguoi_mua,'thoi_gian_lap',i.thoi_gian_lap,'tong_tien_sau_thue',i.tong_tien_sau_thue,
   'sdt_nguoi_nhan',d.sdt_nguoi_nhan,'trang_thai',d.trang_thai,'kenh_ban',d.kenh_ban),
   'invoice_version',encode(sha256(convert_to((to_jsonb(i)||jsonb_build_object('order',to_jsonb(d)))::text,'UTF8')),'hex'),
   'can_link',t.ket_qua_lien_ket is null and t.trang_thai in('MOI','DANG_XU_LY') and d.ma_kh is null and d.kenh_ban='TAI_QUAY' and d.trang_thai<>'HUY' and active_customer,
   'reason',case when t.ket_qua_lien_ket is not null then 'Yêu cầu đã được xử lý.' when t.trang_thai not in('MOI','DANG_XU_LY') then 'Ticket đã đóng.'
     when not active_customer then 'Tài khoản khách không còn hoạt động.' when d.ma_kh is not null then 'Đơn đã gắn khách hàng; không được chuyển quyền sở hữu.'
     when d.kenh_ban<>'TAI_QUAY' then 'Chỉ liên kết hóa đơn mua tại cửa hàng.' when d.trang_thai='HUY' then 'Đơn đã hủy.' else null end);
end $$;

create function public.staff_invoice_claim_decide_v1(p_actor text,p_ticket uuid,p_key uuid,p_version uuid,p_action text,p_note text,p_verified boolean,p_invoice_version text default null) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare employee text; t public."PHAN_HOI"%rowtype; i public."HOA_DON"%rowtype; d public."DON_HANG"%rowtype; r jsonb; customer_reply text;
begin
 employee:=admin_ops.counter_actor(p_actor); p_note:=btrim(p_note);
 if p_action is null or p_action not in('approve','reject') or p_note is null or length(p_note) not between 10 and 2000 or p_version is null then
   raise exception 'Nhập kết quả xác minh (10–2000 ký tự).' using errcode='23514'; end if;
 if p_action='approve' and p_verified is distinct from true then raise exception 'Phải xác minh chứng từ với khách trước khi liên kết.' using errcode='23514'; end if;
 r:=admin_ops.claim_once(p_actor,p_key,p_action,p_ticket::text,jsonb_build_array(p_version,p_note,p_verified,p_invoice_version));
 if r is not null then return r; end if;
 select * into t from public."PHAN_HOI" where ma_phan_hoi=p_ticket and loai_yeu_cau='LIEN_KET_HOA_DON' for update;
 if not found then raise exception 'Không tìm thấy yêu cầu.' using errcode='P0002'; end if;
 if t.phien_ban_lien_ket<>p_version or t.ket_qua_lien_ket is not null or t.trang_thai not in('MOI','DANG_XU_LY') then
   raise exception 'Yêu cầu đã thay đổi hoặc đã được xử lý. Hãy làm mới.' using errcode='40001'; end if;
 if p_action='approve' then
   -- Account/profile locks prevent linking to a customer concurrently archived or disabled.
   perform 1 from public."TAI_KHOAN" a join public."KHACH_HANG" k using(ma_kh)
     where k.ma_kh=t.ma_kh and k.luu_tru_luc is null and a.trang_thai=1 and a.ma_nhan_vien is null for share of a,k;
   if not found then raise exception 'Tài khoản khách không còn hoạt động.' using errcode='42501'; end if;
   -- Same order lock as order processing; concurrent claims cannot both acquire ownership.
   select d0.* into d from public."DON_HANG" d0 join public."HOA_DON" i0 using(ma_donhang)
     where i0.ma_hoadon=t.ma_hoa_don_yeu_cau for update of d0;
   if not found then raise exception 'Không tìm thấy hóa đơn.' using errcode='P0002'; end if;
   select * into i from public."HOA_DON" where ma_hoadon=t.ma_hoa_don_yeu_cau for share;
   if i.ma_donhang is distinct from d.ma_donhang or p_invoice_version is distinct from
      encode(sha256(convert_to((to_jsonb(i)||jsonb_build_object('order',to_jsonb(d)))::text,'UTF8')),'hex') then
     raise exception 'Hóa đơn hoặc đơn hàng đã thay đổi. Hãy kiểm tra lại.' using errcode='40001'; end if;
   if d.ma_kh is not null or d.kenh_ban<>'TAI_QUAY' or d.trang_thai='HUY' then
     raise exception 'Đơn không đủ điều kiện liên kết hoặc đã thuộc khách khác.' using errcode='40001'; end if;
   update public."DON_HANG" set ma_kh=t.ma_kh where ma_donhang=d.ma_donhang and ma_kh is null;
   customer_reply:='Đã xác minh và liên kết hóa đơn '||t.ma_hoa_don_yeu_cau||' vào tài khoản của bạn. Bạn có thể đánh giá sản phẩm khi đơn hoàn thành.';
 else customer_reply:='Yêu cầu liên kết hóa đơn chưa được chấp nhận. Vui lòng liên hệ cửa hàng và cung cấp thêm chứng từ nếu cần.';
 end if;
 update public."PHAN_HOI" set ket_qua_lien_ket=case p_action when 'approve' then 'DA_LIEN_KET' else 'TU_CHOI' end,
   ma_donhang=case p_action when 'approve' then d.ma_donhang else null end,
   phien_ban_lien_ket=gen_random_uuid(),xac_minh_luc=statement_timestamp(),tai_khoan_xac_minh=p_actor,ghi_chu_xac_minh=p_note,
   trang_thai='DA_GIAI_QUYET',nguoi_xu_ly=employee,phan_hoi_quan_ly=customer_reply,ngay_phan_hoi=statement_timestamp(),cap_nhat_luc=statement_timestamp()
 where ma_phan_hoi=p_ticket;
 insert into admin_ops.messages(ticket_id,actor,content) values(p_ticket,p_actor,customer_reply);
 r:=public.staff_invoice_claim_read_v1(p_actor,p_ticket,1);
 update admin_ops.requests set result=r where actor=p_actor and key=p_key;
 return r;
end $$;

-- Staff counter sales reuse the existing transaction. Only create orders is delegated;
-- other operations retain the ADMIN guard. Staff may sell only from their assigned warehouse.
do $upgrade$
declare d text; old_guard text:='employee:=admin_ops.actor(p_actor);'; old_customer text;
begin
 select pg_get_functiondef('public.admin_operation_v1(text,text,text,uuid,text,jsonb)'::regprocedure) into d;
 if position(old_guard in d)=0 then raise exception 'Unexpected admin_operation_v1 actor guard'; end if;
 d:=replace(d,old_guard,$guard$if p_resource='orders' and p_action='create' then
 employee:=admin_ops.counter_actor(p_actor);
 if exists(select 1 from public."NHAN_VIEN" where ma_nhan_vien=employee and loai_nhan_vien='NHAN_VIEN') and
   exists(select 1 from jsonb_array_elements(lines) x where (x->>'warehouse_id')::int is distinct from
     (select ma_kho from public."NHAN_VIEN" where ma_nhan_vien=employee)) then
   raise exception 'Chỉ được bán hàng từ kho được phân công.' using errcode='42501'; end if;
else employee:=admin_ops.actor(p_actor); end if;$guard$);
 old_customer:=$old$perform 1 from public."KHACH_HANG" where ma_kh=body->>'customer_id' for share;$old$;
 if position(old_customer in d)=0 then raise exception 'Unexpected counter-sale customer guard'; end if;
 d:=replace(d,old_customer,$guard$perform 1 from public."KHACH_HANG" k join public."TAI_KHOAN" a using(ma_kh)
 where k.ma_kh=body->>'customer_id' and k.luu_tru_luc is null and a.trang_thai=1 and a.ma_nhan_vien is null for share of k,a;$guard$);
 execute d;
end $upgrade$;

create function public.staff_counter_catalog_v1(p_actor text,p_kind text,p_query text default '') returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare employee text; wh int; r jsonb; q text;
begin
 employee:=admin_ops.counter_actor(p_actor); p_query:=btrim(coalesce(p_query,''));
 if length(p_query)>100 then raise exception 'Từ khóa quá dài.' using errcode='23514'; end if;
 q:='%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%';
 select ma_kho into wh from public."NHAN_VIEN" where ma_nhan_vien=employee;
 if p_kind='customers' then
   select coalesce(jsonb_agg(x.row),'[]') into r from (select jsonb_build_object('ma_kh',k.ma_kh,'ten_kh',k.ten_kh,'sdt',k.sdt,'ten_tai_khoan',a.ten_tai_khoan) row
   from public."KHACH_HANG" k join public."TAI_KHOAN" a using(ma_kh)
   where k.luu_tru_luc is null and a.trang_thai=1 and a.ma_nhan_vien is null and
     (k.ma_kh ilike q or k.ten_kh ilike q or k.sdt ilike q or a.ten_tai_khoan ilike q)
   order by k.ten_kh,k.ma_kh limit 20) x;
 elsif p_kind='products' then
   select coalesce(jsonb_agg(x.row),'[]') into r from (select jsonb_build_object('sku',p.sku,'ten_sp',p.ten_sp,
    'unit_price',p.gia_ban_hien_tai::text,'warehouse_id',t.ma_kho,'available',greatest(0,admin_ops.available(t.ma_kho,p.sku))) row
   from public."SAN_PHAM" p join public."TON_KHO" t using(sku) join public."KHO" k using(ma_kho)
    join public."LOAI_SP" c using(ma_loai_sp) join public."LOAI_SP_CON" sc using(ma_loai_sp,ma_loai_sp_con)
   where p.trang_thai=1 and c.trang_thai=1 and sc.trang_thai=1 and k.trang_thai=1
    and (wh is null or t.ma_kho=wh) and (p.sku ilike q or p.ten_sp ilike q)
   order by p.ten_sp,p.sku,t.ma_kho limit 30) x;
 else raise exception 'Loại tra cứu không hợp lệ.' using errcode='23514'; end if;
 return jsonb_build_object('data',r);
end $$;

revoke all on function admin_ops.counter_actor(text),admin_ops.claim_once(text,uuid,text,text,jsonb),
 public.customer_invoice_claim_v1(text,uuid,text,text),public.staff_invoice_claim_read_v1(text,uuid,int),
 public.staff_invoice_claim_decide_v1(text,uuid,uuid,uuid,text,text,boolean,text),public.staff_counter_catalog_v1(text,text,text) from public,anon,authenticated;
grant execute on function admin_ops.counter_actor(text),admin_ops.claim_once(text,uuid,text,text,jsonb),
 public.customer_invoice_claim_v1(text,uuid,text,text),public.staff_invoice_claim_read_v1(text,uuid,int),
 public.staff_invoice_claim_decide_v1(text,uuid,uuid,uuid,text,text,boolean,text),public.staff_counter_catalog_v1(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
