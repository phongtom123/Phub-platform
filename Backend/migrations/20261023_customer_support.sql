-- PHUB: tiep nhan ticket ho tro khach hang. Backup va thu DB test truoc khi chay.
-- Migration moi, khong chay lai migration CRM dot 1, khong sua du lieu giao dich cu.
-- Chi chay mot lan; can cac bang KHACH_HANG/TAI_KHOAN/NHAN_VIEN/SAN_PHAM/DON_HANG.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public."PHAN_HOI" (
  ma_phan_hoi uuid primary key default gen_random_uuid(),
  ma_kh varchar not null references public."KHACH_HANG"(ma_kh) on delete restrict,
  tieu_de varchar(200) not null check (length(btrim(tieu_de)) between 1 and 200),
  noi_dung text not null check (length(btrim(noi_dung)) between 1 and 10000),
  ma_sp varchar references public."SAN_PHAM"(ma_sp) on delete restrict,
  ma_donhang varchar references public."DON_HANG"(ma_donhang) on delete restrict,
  trang_thai varchar not null default 'MOI'
    check (trang_thai in ('MOI','DANG_XU_LY','DA_GIAI_QUYET','DA_DONG')),
  muc_do_uu_tien varchar not null default 'BINH_THUONG'
    check (muc_do_uu_tien in ('THAP','BINH_THUONG','CAO','KHAN_CAP')),
  nguoi_xu_ly varchar references public."NHAN_VIEN"(ma_nhan_vien) on delete restrict,
  phan_hoi_quan_ly text check (phan_hoi_quan_ly is null or length(phan_hoi_quan_ly) <= 10000),
  ngay_phan_hoi timestamptz,
  ngay_tao timestamptz not null default statement_timestamp(),
  cap_nhat_luc timestamptz not null default statement_timestamp()
);
create index "PHAN_HOI_trang_thai_ngay_idx" on public."PHAN_HOI"(trang_thai, ngay_tao desc);
create index "PHAN_HOI_khach_ngay_idx" on public."PHAN_HOI"(ma_kh, ngay_tao desc);
alter table public."PHAN_HOI" enable row level security;
revoke all on table public."PHAN_HOI" from public, anon, authenticated;
grant select, insert, update on table public."PHAN_HOI" to service_role;

create function public.customer_create_feedback_v1(p_actor_account_id text, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $fn$
declare v_customer_id varchar; v_row public."PHAN_HOI"%rowtype;
begin
  select a.ma_kh into v_customer_id from public."TAI_KHOAN" a
  where a.ma_tk = p_actor_account_id and a.trang_thai = 1 and a.ma_kh is not null
    and a.ma_nhan_vien is null for share;
  if not found then raise exception 'CUSTOMER_REQUIRED' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_PAYLOAD' using errcode='23514';
  end if;
  if exists (select 1 from jsonb_object_keys(p_payload) k(field)
    where field not in ('tieu_de','noi_dung','ma_sp','ma_donhang')) then
    raise exception 'UNKNOWN_FIELD' using errcode='23514';
  end if;
  if p_payload->>'ma_donhang' is not null then
    perform 1 from public."DON_HANG" where ma_donhang=p_payload->>'ma_donhang'
      and ma_kh=v_customer_id for share;
    if not found then raise exception 'ORDER_NOT_OWNED' using errcode='23514'; end if;
  end if;
  if p_payload->>'ma_sp' is not null and p_payload->>'ma_donhang' is not null
    and not exists (select 1 from public."CT_DON_HANG" c join public."SAN_PHAM" s on s.sku=c.sku
      where c.ma_donhang=p_payload->>'ma_donhang' and s.ma_sp=p_payload->>'ma_sp') then
    raise exception 'PRODUCT_NOT_IN_ORDER' using errcode='23514';
  end if;
  insert into public."PHAN_HOI" (ma_kh,tieu_de,noi_dung,ma_sp,ma_donhang)
  values (v_customer_id,btrim(p_payload->>'tieu_de'),btrim(p_payload->>'noi_dung'),
    p_payload->>'ma_sp',p_payload->>'ma_donhang') returning * into v_row;
  return to_jsonb(v_row);
end;
$fn$;

create function public.admin_update_feedback_v1(p_actor_account_id text, p_feedback_id uuid, p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $fn$
declare v_employee_id varchar; v_row public."PHAN_HOI"%rowtype;
begin
  select n.ma_nhan_vien into v_employee_id from public."TAI_KHOAN" a
  join public."NHAN_VIEN" n on n.ma_nhan_vien=a.ma_nhan_vien
  where a.ma_tk=p_actor_account_id and a.trang_thai=1
    and n.loai_nhan_vien='ADMIN' and n.trang_thai=1 for share of a,n;
  if not found then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then
    raise exception 'EMPTY_OR_INVALID_PATCH' using errcode='23514';
  end if;
  if exists (select 1 from jsonb_object_keys(p_changes) k(field)
    where field not in ('trang_thai','muc_do_uu_tien','phan_hoi_quan_ly','nhan_xu_ly')) then
    raise exception 'READ_ONLY_FIELD' using errcode='23514';
  end if;
  select * into v_row from public."PHAN_HOI" where ma_phan_hoi=p_feedback_id for update;
  if not found then raise exception 'FEEDBACK_NOT_FOUND' using errcode='P0002'; end if;
  update public."PHAN_HOI" set
    trang_thai=case when p_changes ? 'trang_thai' then p_changes->>'trang_thai' else trang_thai end,
    muc_do_uu_tien=case when p_changes ? 'muc_do_uu_tien' then p_changes->>'muc_do_uu_tien' else muc_do_uu_tien end,
    nguoi_xu_ly=case when (p_changes->>'nhan_xu_ly')::boolean is true then v_employee_id else nguoi_xu_ly end,
    phan_hoi_quan_ly=case when p_changes ? 'phan_hoi_quan_ly' then nullif(btrim(p_changes->>'phan_hoi_quan_ly'),'') else phan_hoi_quan_ly end,
    ngay_phan_hoi=case when p_changes ? 'phan_hoi_quan_ly' then
      case when nullif(btrim(p_changes->>'phan_hoi_quan_ly'),'') is null then null else statement_timestamp() end
      else ngay_phan_hoi end,
    cap_nhat_luc=statement_timestamp()
  where ma_phan_hoi=p_feedback_id returning * into v_row;
  return to_jsonb(v_row) || jsonb_build_object(
    'ten_kh',(select ten_kh from public."KHACH_HANG" where ma_kh=v_row.ma_kh),
    'ten_nguoi_xu_ly',(select ho_ten from public."NHAN_VIEN" where ma_nhan_vien=v_row.nguoi_xu_ly));
end;
$fn$;

revoke all on function public.customer_create_feedback_v1(text,jsonb) from public,anon,authenticated;
revoke all on function public.admin_update_feedback_v1(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.customer_create_feedback_v1(text,jsonb) to service_role;
grant execute on function public.admin_update_feedback_v1(text,uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
