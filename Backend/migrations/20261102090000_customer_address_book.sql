-- PHUB: so dia chi nhan hang cua khach (1 khach - nhieu dia chi).
-- Backup va thu tren DB test truoc khi chay. Chi chay mot lan, bang role postgres.
--
-- Nguyen tac:
--   * KHONG xoa/doi ten cot dia chi mac dinh cua KHACH_HANG (dia_chi_chi_tiet_md,
--     tinh_thanh_md, xa_phuong_md): Admin CRM, API /api/customer/me va bao cao van doc cot nay.
--   * Moi khach co toi da MOT dia chi mac dinh (unique partial index) va dia chi mac dinh
--     duoc dong bo hai chieu voi KHACH_HANG bang trigger:
--       - sua dia chi mac dinh trong so dia chi  -> cap nhat 3 cot dia chi cua KHACH_HANG
--       - sua ten/sdt/dia chi o KHACH_HANG (PUT /me, Admin CRM) -> cap nhat dia chi mac dinh
--   * DON_HANG van luu SNAPSHOT nguoi nhan/dia chi luc dat (khong tro khoa ngoai sang bang nay)
--     de sua/xoa dia chi sau nay khong lam doi lich su don hang.
--   * Ghi chu giao hang KHONG nam o day: ghi chu thuoc tung don (DON_HANG.ghi_chu).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public."KHACH_HANG"') is null then
    raise exception 'Khong tim thay public."KHACH_HANG". Kiem tra dung project/schema.';
  end if;
  if to_regclass('public."DIA_CHI_KHACH_HANG"') is not null then
    raise exception 'public."DIA_CHI_KHACH_HANG" da ton tai. Khong chay lai migration nay.';
  end if;
end;
$preflight$;

create table public."DIA_CHI_KHACH_HANG" (
  ma_dia_chi uuid primary key default gen_random_uuid(),
  ma_kh varchar not null references public."KHACH_HANG"(ma_kh) on delete cascade,
  ten_nguoi_nhan varchar(100) not null check (length(btrim(ten_nguoi_nhan)) between 1 and 100),
  sdt_nguoi_nhan varchar(20) not null check (length(btrim(sdt_nguoi_nhan)) between 1 and 20),
  dia_chi_chi_tiet varchar(255) not null check (length(btrim(dia_chi_chi_tiet)) between 1 and 255),
  tinh_thanh varchar(100) not null check (length(btrim(tinh_thanh)) between 1 and 100),
  xa_phuong varchar(100) not null check (length(btrim(xa_phuong)) between 1 and 100),
  la_mac_dinh boolean not null default false,
  ngay_tao timestamptz not null default statement_timestamp(),
  cap_nhat_luc timestamptz not null default statement_timestamp()
);

create index "DIA_CHI_KHACH_HANG_khach_idx"
  on public."DIA_CHI_KHACH_HANG"(ma_kh, la_mac_dinh desc, cap_nhat_luc desc);
-- Toi da mot dia chi mac dinh cho moi khach.
create unique index "DIA_CHI_KHACH_HANG_mot_mac_dinh_key"
  on public."DIA_CHI_KHACH_HANG"(ma_kh) where la_mac_dinh;

comment on table public."DIA_CHI_KHACH_HANG"
  is 'So dia chi nhan hang cua khach. Don hang luu snapshot, khong tro khoa ngoai sang bang nay.';
comment on column public."DIA_CHI_KHACH_HANG".la_mac_dinh
  is 'Toi da mot dong true cho moi khach; dong bo voi cac cot *_md cua KHACH_HANG.';

alter table public."DIA_CHI_KHACH_HANG" enable row level security;
revoke all on table public."DIA_CHI_KHACH_HANG" from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public."DIA_CHI_KHACH_HANG" to service_role;

-- Khach cu da co day du ten/sdt/dia chi: chuyen thanh dia chi mac dinh dau tien.
-- Chay TRUOC khi tao trigger. SDT duoc chuan hoa nhu API (bo khoang trang, (), -);
-- dong khong hop le duoc bo qua, khong sua KHACH_HANG.
insert into public."DIA_CHI_KHACH_HANG"
  (ma_kh, ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_chi_tiet, tinh_thanh, xa_phuong, la_mac_dinh)
select k.ma_kh, btrim(k.ten_kh), regexp_replace(k.sdt, '[ ()-]', '', 'g'),
       btrim(k.dia_chi_chi_tiet_md), btrim(k.tinh_thanh_md), btrim(k.xa_phuong_md), true
from public."KHACH_HANG" k
where length(btrim(coalesce(k.ten_kh, ''))) between 1 and 100
  and regexp_replace(coalesce(k.sdt, ''), '[ ()-]', '', 'g') ~ '^\+?[0-9]{8,15}$'
  and length(btrim(coalesce(k.dia_chi_chi_tiet_md, ''))) between 1 and 255
  and length(btrim(coalesce(k.tinh_thanh_md, ''))) between 1 and 100
  and length(btrim(coalesce(k.xa_phuong_md, ''))) between 1 and 100;

-- Dia chi mac dinh trong so dia chi -> 3 cot dia chi cua KHACH_HANG.
-- Ten/SDT nguoi nhan khong ghi nguoc vao ten/sdt tai khoan.
-- pg_trigger_depth() > 1 nghia la thay doi den tu trigger dong bo kia: bo qua de khong lap vo han.
create function public.phub_sync_default_address_to_customer()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  if pg_catalog.pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'DELETE' then
    if old.la_mac_dinh then
      update public."KHACH_HANG"
         set dia_chi_chi_tiet_md = null, tinh_thanh_md = null, xa_phuong_md = null
       where ma_kh = old.ma_kh;
    end if;
  elsif new.la_mac_dinh then
    update public."KHACH_HANG"
       set dia_chi_chi_tiet_md = new.dia_chi_chi_tiet, tinh_thanh_md = new.tinh_thanh,
           xa_phuong_md = new.xa_phuong
     where ma_kh = new.ma_kh
       and (dia_chi_chi_tiet_md, tinh_thanh_md, xa_phuong_md)
           is distinct from (new.dia_chi_chi_tiet, new.tinh_thanh, new.xa_phuong);
  end if;
  return null;
end;
$fn$;

-- Ten/SDT/dia chi o KHACH_HANG (PUT /api/customer/me, Admin CRM) -> dia chi mac dinh.
-- Thong tin chua day du hoac khong hop le thi giu nguyen so dia chi, khong xoa gi.
create function public.phub_sync_customer_to_default_address()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare
  v_name text := btrim(coalesce(new.ten_kh, ''));
  v_phone text := regexp_replace(coalesce(new.sdt, ''), '[ ()-]', '', 'g');
  v_line text := btrim(coalesce(new.dia_chi_chi_tiet_md, ''));
  v_province text := btrim(coalesce(new.tinh_thanh_md, ''));
  v_ward text := btrim(coalesce(new.xa_phuong_md, ''));
begin
  if pg_catalog.pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and (old.ten_kh, old.sdt, old.dia_chi_chi_tiet_md, old.tinh_thanh_md, old.xa_phuong_md)
         is not distinct from (new.ten_kh, new.sdt, new.dia_chi_chi_tiet_md, new.tinh_thanh_md, new.xa_phuong_md) then
    return null;
  end if;
  if length(v_name) not between 1 and 100 or v_phone !~ '^\+?[0-9]{8,15}$'
     or length(v_line) not between 1 and 255 or length(v_province) not between 1 and 100
     or length(v_ward) not between 1 and 100 then
    return null;
  end if;
  if exists (select 1 from public."DIA_CHI_KHACH_HANG" where ma_kh = new.ma_kh and la_mac_dinh) then
    update public."DIA_CHI_KHACH_HANG"
       set ten_nguoi_nhan = v_name, sdt_nguoi_nhan = v_phone, dia_chi_chi_tiet = v_line,
           tinh_thanh = v_province, xa_phuong = v_ward, cap_nhat_luc = statement_timestamp()
     where ma_kh = new.ma_kh and la_mac_dinh
       and (ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_chi_tiet, tinh_thanh, xa_phuong)
           is distinct from (v_name, v_phone, v_line, v_province, v_ward);
  else
    insert into public."DIA_CHI_KHACH_HANG"
      (ma_kh, ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_chi_tiet, tinh_thanh, xa_phuong, la_mac_dinh)
    values (new.ma_kh, v_name, v_phone, v_line, v_province, v_ward, true);
  end if;
  return null;
end;
$fn$;

revoke all on function public.phub_sync_default_address_to_customer() from public, anon, authenticated;
revoke all on function public.phub_sync_customer_to_default_address() from public, anon, authenticated;

create trigger phub_address_sync_customer
after insert or update or delete on public."DIA_CHI_KHACH_HANG"
for each row execute function public.phub_sync_default_address_to_customer();

create trigger phub_customer_sync_address
after insert or update of ten_kh, sdt, dia_chi_chi_tiet_md, tinh_thanh_md, xa_phuong_md
on public."KHACH_HANG"
for each row execute function public.phub_sync_customer_to_default_address();

create function public.customer_address_json(a public."DIA_CHI_KHACH_HANG")
returns jsonb language sql stable security invoker set search_path = ''
as $fn$
  select jsonb_build_object('id', a.ma_dia_chi, 'name', a.ten_nguoi_nhan, 'phone', a.sdt_nguoi_nhan,
    'address_line', a.dia_chi_chi_tiet, 'province', a.tinh_thanh, 'ward', a.xa_phuong,
    'is_default', a.la_mac_dinh)
$fn$;

-- Moi thao tac la mot transaction; khoa dong KHACH_HANG de tuan tu hoa theo khach.
-- Khach luon do server xac dinh (p_customer_id), khong nhan ma_kh trong payload.
-- Luon tra {items: [...day du so dia chi...], item: dia chi vua tao/sua | null}.
create function public.customer_address_v1(
  p_customer_id text, p_action text, p_address_id uuid default null, p_payload jsonb default null
) returns jsonb language plpgsql volatile security invoker set search_path = ''
as $fn$
declare
  c_max constant integer := 10;
  v_row public."DIA_CHI_KHACH_HANG"%rowtype;
  v_values jsonb := '{}'::jsonb;
  v_field text;
  v_phone text;
  v_default boolean := false;
  v_count integer;
begin
  if p_customer_id is null or length(btrim(p_customer_id)) not between 1 and 100
     or p_action is null or p_action not in ('list', 'create', 'update', 'delete') then
    return jsonb_build_object('error', jsonb_build_object('code', 'VALIDATION_ERROR'));
  end if;

  if p_action in ('create', 'update') then
    if jsonb_typeof(p_payload) is distinct from 'object'
       or (p_payload - array['name', 'phone', 'address_line', 'province', 'ward', 'is_default']) <> '{}'::jsonb then
      return jsonb_build_object('error', jsonb_build_object('code', 'VALIDATION_ERROR'));
    end if;
    foreach v_field in array array['name', 'phone', 'address_line', 'province', 'ward'] loop
      if jsonb_typeof(p_payload -> v_field) is distinct from 'string'
         or length(btrim(p_payload ->> v_field)) = 0
         or (p_payload ->> v_field) ~ '[[:cntrl:]]'
         or length(btrim(p_payload ->> v_field)) > (case v_field when 'address_line' then 255 else 100 end) then
        return jsonb_build_object('error', jsonb_build_object('code', 'VALIDATION_ERROR'));
      end if;
      v_values := jsonb_set(v_values, array[v_field], to_jsonb(btrim(p_payload ->> v_field)));
    end loop;
    v_phone := regexp_replace(v_values ->> 'phone', '[ ()-]', '', 'g');
    if v_phone !~ '^\+?[0-9]{8,15}$' then
      return jsonb_build_object('error', jsonb_build_object('code', 'VALIDATION_ERROR'));
    end if;
    if p_payload ? 'is_default' then
      if jsonb_typeof(p_payload -> 'is_default') is distinct from 'boolean' then
        return jsonb_build_object('error', jsonb_build_object('code', 'VALIDATION_ERROR'));
      end if;
      v_default := (p_payload ->> 'is_default')::boolean;
    end if;
  end if;

  if p_action = 'list' then
    perform 1 from public."KHACH_HANG" where ma_kh = p_customer_id;
  else
    perform 1 from public."KHACH_HANG" where ma_kh = p_customer_id for update;
  end if;
  if not found then
    return jsonb_build_object('error', jsonb_build_object('code', 'AUTH_CUSTOMER_UNAVAILABLE'));
  end if;

  if p_action = 'create' then
    select count(*) into v_count from public."DIA_CHI_KHACH_HANG" where ma_kh = p_customer_id;
    if v_count >= c_max then
      return jsonb_build_object('error', jsonb_build_object('code', 'ADDRESS_LIMIT_REACHED'));
    end if;
    -- Dia chi dau tien luon la mac dinh.
    v_default := v_default or v_count = 0;
    if v_default then
      update public."DIA_CHI_KHACH_HANG" set la_mac_dinh = false, cap_nhat_luc = statement_timestamp()
       where ma_kh = p_customer_id and la_mac_dinh;
    end if;
    insert into public."DIA_CHI_KHACH_HANG"
      (ma_kh, ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_chi_tiet, tinh_thanh, xa_phuong, la_mac_dinh)
    values (p_customer_id, v_values ->> 'name', v_phone, v_values ->> 'address_line',
            v_values ->> 'province', v_values ->> 'ward', v_default)
    returning * into v_row;
  elsif p_action = 'update' then
    select * into v_row from public."DIA_CHI_KHACH_HANG"
     where ma_dia_chi = p_address_id and ma_kh = p_customer_id for update;
    if not found then
      return jsonb_build_object('error', jsonb_build_object('code', 'ADDRESS_NOT_FOUND'));
    end if;
    -- Khong the bo mac dinh truc tiep: hay dat dia chi khac lam mac dinh.
    v_default := v_default or v_row.la_mac_dinh;
    if v_default and not v_row.la_mac_dinh then
      update public."DIA_CHI_KHACH_HANG" set la_mac_dinh = false, cap_nhat_luc = statement_timestamp()
       where ma_kh = p_customer_id and la_mac_dinh;
    end if;
    update public."DIA_CHI_KHACH_HANG"
       set ten_nguoi_nhan = v_values ->> 'name', sdt_nguoi_nhan = v_phone,
           dia_chi_chi_tiet = v_values ->> 'address_line', tinh_thanh = v_values ->> 'province',
           xa_phuong = v_values ->> 'ward', la_mac_dinh = v_default, cap_nhat_luc = statement_timestamp()
     where ma_dia_chi = p_address_id
    returning * into v_row;
  elsif p_action = 'delete' then
    select * into v_row from public."DIA_CHI_KHACH_HANG"
     where ma_dia_chi = p_address_id and ma_kh = p_customer_id for update;
    if not found then
      return jsonb_build_object('error', jsonb_build_object('code', 'ADDRESS_NOT_FOUND'));
    end if;
    delete from public."DIA_CHI_KHACH_HANG" where ma_dia_chi = p_address_id;
    if v_row.la_mac_dinh then
      -- Xoa dia chi mac dinh: chuyen mac dinh sang dia chi cap nhat gan nhat con lai.
      update public."DIA_CHI_KHACH_HANG" set la_mac_dinh = true, cap_nhat_luc = statement_timestamp()
       where ma_dia_chi = (select ma_dia_chi from public."DIA_CHI_KHACH_HANG"
                            where ma_kh = p_customer_id order by cap_nhat_luc desc, ma_dia_chi desc limit 1);
    end if;
  end if;

  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(public.customer_address_json(a)
                                        order by a.la_mac_dinh desc, a.cap_nhat_luc desc, a.ma_dia_chi)
                         from public."DIA_CHI_KHACH_HANG" a where a.ma_kh = p_customer_id), '[]'::jsonb),
    'item', case when p_action in ('create', 'update') then public.customer_address_json(v_row) else null end);
end;
$fn$;

revoke all on function public.customer_address_json(public."DIA_CHI_KHACH_HANG") from public, anon, authenticated;
grant execute on function public.customer_address_json(public."DIA_CHI_KHACH_HANG") to service_role;
revoke all on function public.customer_address_v1(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.customer_address_v1(text, text, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
