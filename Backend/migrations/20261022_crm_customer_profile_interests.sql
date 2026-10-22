-- PHUB CRM - DOT 1: HO SO KHACH HANG VA SO THICH
-- Chay bang role postgres trong Supabase SQL Editor SAU KHI backup va thu tren DB test.
-- Chi chay mot lan. Neu cot/bang CRM da ton tai, script dung de tranh ghi de thiet ke khac.
-- Ten bang da chot: SO_THICH va KHACH_HANG_SO_THICH (khong co tien to CRM_).
-- Neu da tao/doi ten bang tren Supabase thi KHONG chay lai migration nay.
-- Khong tao lai DB, khong xoa du lieu, khong thay doi role/tai khoan/giao dich cu.
-- Chua co module phan hoi/khao sat. Chua mo API/UI cho cac truong CRM moi.
-- luu_tru_luc chi la cot du lieu; CHUA tu dong khoa tai khoan hay chan dang nhap.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Preflight: dung neu schema khong dung hoac dot 1 da duoc ap dung.
do $preflight$
begin
  if to_regclass('public."KHACH_HANG"') is null then
    raise exception 'Khong tim thay public."KHACH_HANG". Kiem tra dung project/schema.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'KHACH_HANG'
      and column_name = 'ma_kh' and data_type = 'character varying'
  ) then
    raise exception 'KHACH_HANG.ma_kh khong khop schema da doi chieu (varchar).';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'KHACH_HANG'
      and column_name in ('ngay_sinh', 'ngay_tao', 'cap_nhat_luc', 'luu_tru_luc')
  ) or to_regclass('public."SO_THICH"') is not null
    or to_regclass('public."KHACH_HANG_SO_THICH"') is not null then
    raise exception 'Da co cot/bang CRM dot 1. Khong chay lai; can doi chieu schema truoc.';
  end if;

  if to_regprocedure('public.phub_crm_customer_profile_stamp()') is not null
    or to_regprocedure('public.phub_crm_interest_stamp()') is not null then
    raise exception 'Da co ham CRM cung ten; can doi chieu truoc khi tao migration.';
  end if;
end;
$preflight$;

-- Khach cu giu NULL: khong gan ngay sinh hoac ngay dang ky gia.
alter table public."KHACH_HANG"
  add column ngay_sinh date,
  add column ngay_tao timestamptz,
  add column cap_nhat_luc timestamptz,
  add column luu_tru_luc timestamptz;

-- SET DEFAULT sau ADD COLUMN: chi tac dong INSERT moi, khong backfill ho so cu.
alter table public."KHACH_HANG"
  alter column ngay_tao set default statement_timestamp(),
  alter column cap_nhat_luc set default statement_timestamp();

comment on column public."KHACH_HANG".ngay_sinh
  is 'CRM: ngay sinh tu khai bao; NULL neu chua cung cap. Khong luu tuoi co dinh.';
comment on column public."KHACH_HANG".ngay_tao
  is 'CRM: ngay tao cho ho so moi; NULL voi ho so cu khong biet ngay tao that.';
comment on column public."KHACH_HANG".luu_tru_luc
  is 'CRM: du kien luu tru mem. Cot nay KHONG tu dong khoa tai khoan; can API nghiep vu.';

create table public."SO_THICH" (
  ma_so_thich varchar(50) primary key,
  ten_so_thich varchar(100) not null,
  trang_thai integer not null default 1,
  ngay_tao timestamptz not null default statement_timestamp(),
  cap_nhat_luc timestamptz not null default statement_timestamp(),
  constraint "SO_THICH_ma_nonempty" check (length(btrim(ma_so_thich)) > 0),
  constraint "SO_THICH_ten_nonempty" check (length(btrim(ten_so_thich)) > 0),
  constraint "SO_THICH_trang_thai_check" check (trang_thai in (0, 1))
);

-- Khong cho hai ten chi khac hoa/thuong hoac khoang trang dau/cuoi.
create unique index "SO_THICH_ten_normalized_key"
  on public."SO_THICH" (lower(btrim(ten_so_thich)));

create table public."KHACH_HANG_SO_THICH" (
  ma_kh varchar not null,
  ma_so_thich varchar(50) not null,
  ngay_tao timestamptz not null default statement_timestamp(),
  constraint "KHACH_HANG_SO_THICH_pkey" primary key (ma_kh, ma_so_thich),
  constraint "KHACH_HANG_SO_THICH_khach_fkey"
    foreign key (ma_kh) references public."KHACH_HANG" (ma_kh) on delete restrict,
  constraint "KHACH_HANG_SO_THICH_so_thich_fkey"
    foreign key (ma_so_thich) references public."SO_THICH" (ma_so_thich) on delete restrict
);

create index "KHACH_HANG_SO_THICH_so_thich_idx"
  on public."KHACH_HANG_SO_THICH" (ma_so_thich, ma_kh);

-- Trigger bao ve ngay tao va cap nhat timestamp tren moi duong ghi KHACH_HANG.
-- Chua dong bo cap_nhat_luc cua KHACH_HANG khi bang so thich thay doi:
-- API/cache sau nay phai invalidate ca profile va bang lien ket, khong chi MAX(timestamp).
create function public.phub_crm_customer_profile_stamp()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if new.ngay_sinh is not null
     and new.ngay_sinh > (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'Ngay sinh khong duoc o tuong lai.' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.ngay_tao := statement_timestamp();
  else
    new.ngay_tao := old.ngay_tao;
  end if;
  new.cap_nhat_luc := statement_timestamp();
  return new;
end;
$function$;

create trigger phub_crm_customer_profile_stamp
before insert or update on public."KHACH_HANG"
for each row execute function public.phub_crm_customer_profile_stamp();

create function public.phub_crm_interest_stamp()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'INSERT' then
    new.ngay_tao := statement_timestamp();
  else
    new.ngay_tao := old.ngay_tao;
  end if;
  new.cap_nhat_luc := statement_timestamp();
  return new;
end;
$function$;

create trigger phub_crm_interest_stamp
before insert or update on public."SO_THICH"
for each row execute function public.phub_crm_interest_stamp();

-- Mo hinh hien tai: browser -> FastAPI kiem tra quyen -> service_role -> DB.
-- Khong them policy theo auth.uid(): TAI_KHOAN cua Phub khong phai Supabase Auth.
alter table public."SO_THICH" enable row level security;
alter table public."KHACH_HANG_SO_THICH" enable row level security;

revoke all on table public."SO_THICH", public."KHACH_HANG_SO_THICH"
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public."SO_THICH", public."KHACH_HANG_SO_THICH" to service_role;

revoke all on function public.phub_crm_customer_profile_stamp()
  from public, anon, authenticated;
revoke all on function public.phub_crm_interest_stamp()
  from public, anon, authenticated;
grant execute on function public.phub_crm_customer_profile_stamp() to service_role;
grant execute on function public.phub_crm_interest_stamp() to service_role;

-- Danh muc khoi dau, KHONG gan so thich gia cho bat ky khach nao.
insert into public."SO_THICH" (ma_so_thich, ten_so_thich)
values
  ('GAMING', 'Chơi game'),
  ('VAN_PHONG', 'Học tập và văn phòng'),
  ('DO_HOA', 'Đồ họa và sáng tạo nội dung');

notify pgrst, 'reload schema';
commit;

-- Ket qua doi chieu sau thanh cong: 4 cot CRM, 2 bang moi, 3 so thich.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'KHACH_HANG'
  and column_name in ('ngay_sinh', 'ngay_tao', 'cap_nhat_luc', 'luu_tru_luc')
order by ordinal_position;

select ma_so_thich, ten_so_thich, trang_thai
from public."SO_THICH"
order by ma_so_thich;
