-- Canonical two-level catalog hierarchy: LOAI_SP -> LOAI_SP_CON -> SAN_PHAM.
-- This migration is safe to run after the earlier LOAI_SP_CON table migration.

create table if not exists public."LOAI_SP_CON" (
  ma_loai_sp_con varchar primary key,
  ten_loai_sp_con varchar not null,
  ma_loai_sp varchar not null references public."LOAI_SP" (ma_loai_sp),
  trang_thai smallint not null default 1,
  unique (ma_loai_sp, ten_loai_sp_con)
);

alter table public."SAN_PHAM"
  add column if not exists ma_loai_sp_con varchar;

insert into public."LOAI_SP_CON" (ma_loai_sp_con, ten_loai_sp_con, ma_loai_sp, trang_thai)
values
  ('DESKTOP_CUSTOM', 'PC Custom', 'L_DESKTOP', 1),
  ('DESKTOP_GAMING', 'PC Gaming', 'L_DESKTOP', 1),
  ('DESKTOP_WORKSTATION', 'PC Workstation', 'L_DESKTOP', 1),
  ('COMPONENT_CPU', 'Bộ vi xử lý (CPU)', 'L_LINHKIEN', 1),
  ('COMPONENT_GPU', 'Card màn hình (GPU)', 'L_LINHKIEN', 1),
  ('COMPONENT_MAINBOARD', 'Bo mạch chủ', 'L_LINHKIEN', 1),
  ('COMPONENT_PSU', 'Nguồn máy tính', 'L_LINHKIEN', 1),
  ('COMPONENT_RAM', 'Bộ nhớ RAM', 'L_LINHKIEN', 1),
  ('COMPONENT_STORAGE', 'Ổ cứng SSD', 'L_LINHKIEN', 1),
  ('PHONE_ANDROID', 'Điện thoại Android', 'SEED_L001', 1),
  ('PHONE_IOS', 'Điện thoại iOS', 'SEED_L001', 1),
  ('PHONE_OTHER', 'Điện thoại khác', 'SEED_L001', 1),
  ('LAPTOP_BUSINESS', 'Laptop doanh nhân', 'SEED_L002', 1),
  ('LAPTOP_GAMING', 'Laptop Gaming', 'SEED_L002', 1),
  ('LAPTOP_GENERAL', 'Laptop phổ thông', 'SEED_L002', 1),
  ('LAPTOP_MACBOOK', 'MacBook', 'SEED_L002', 1),
  ('MONITOR_GAMING', 'Màn hình Gaming', 'SEED_L003', 1),
  ('MONITOR_GRAPHICS', 'Màn hình đồ họa', 'SEED_L003', 1),
  ('MONITOR_STANDARD', 'Màn hình phổ thông', 'SEED_L003', 1),
  ('ACCESSORY_CHARGER', 'Sạc và cáp', 'SEED_L004', 1),
  ('ACCESSORY_HEADPHONE', 'Tai nghe', 'SEED_L004', 1),
  ('ACCESSORY_KEYBOARD', 'Bàn phím', 'SEED_L004', 1),
  ('ACCESSORY_MOUSE', 'Chuột', 'SEED_L004', 1)
on conflict (ma_loai_sp_con) do update
set ten_loai_sp_con = excluded.ten_loai_sp_con,
    ma_loai_sp = excluded.ma_loai_sp,
    trang_thai = excluded.trang_thai;

with mapping(ma_sp, ma_loai_sp_con) as (
  values
    ('SP038', 'DESKTOP_CUSTOM'), ('SP041', 'DESKTOP_CUSTOM'),
    ('SP034', 'DESKTOP_GAMING'), ('SP035', 'DESKTOP_GAMING'),
    ('SP036', 'DESKTOP_GAMING'), ('SP037', 'DESKTOP_GAMING'),
    ('SP039', 'DESKTOP_GAMING'), ('SP042', 'DESKTOP_GAMING'),
    ('SP040', 'DESKTOP_WORKSTATION'),
    ('SP046', 'COMPONENT_CPU'), ('SP047', 'COMPONENT_CPU'), ('SP048', 'COMPONENT_CPU'),
    ('SP043', 'COMPONENT_GPU'), ('SP044', 'COMPONENT_GPU'), ('SP045', 'COMPONENT_GPU'),
    ('SP053', 'COMPONENT_MAINBOARD'), ('SP054', 'COMPONENT_MAINBOARD'),
    ('SP055', 'COMPONENT_PSU'),
    ('SP049', 'COMPONENT_RAM'), ('SP050', 'COMPONENT_RAM'),
    ('SP051', 'COMPONENT_STORAGE'), ('SP052', 'COMPONENT_STORAGE'),
    ('SP014', 'PHONE_ANDROID'), ('SP015', 'PHONE_ANDROID'), ('SP017', 'PHONE_ANDROID'),
    ('SP013', 'PHONE_IOS'), ('SP016', 'PHONE_IOS'),
    ('SEED_SP001', 'PHONE_OTHER'), ('SEED_SP002', 'PHONE_OTHER'), ('SEED_SP003', 'PHONE_OTHER'),
    ('SP021', 'LAPTOP_BUSINESS'), ('SP062', 'LAPTOP_BUSINESS'),
    ('SP019', 'LAPTOP_GAMING'), ('SP022', 'LAPTOP_GAMING'),
    ('SP023', 'LAPTOP_GAMING'), ('SP061', 'LAPTOP_GAMING'),
    ('SEED_SP004', 'LAPTOP_GENERAL'), ('SEED_SP005', 'LAPTOP_GENERAL'),
    ('SEED_SP006', 'LAPTOP_GENERAL'), ('SP020', 'LAPTOP_GENERAL'),
    ('SP018', 'LAPTOP_MACBOOK'),
    ('SP024', 'MONITOR_GAMING'), ('SP026', 'MONITOR_GAMING'),
    ('SP027', 'MONITOR_GAMING'), ('SP056', 'MONITOR_GAMING'), ('SP057', 'MONITOR_GAMING'),
    ('SP025', 'MONITOR_GRAPHICS'),
    ('SEED_SP007', 'MONITOR_STANDARD'), ('SEED_SP008', 'MONITOR_STANDARD'),
    ('SEED_SP009', 'MONITOR_STANDARD'),
    ('SP032', 'ACCESSORY_CHARGER'),
    ('SEED_SP012', 'ACCESSORY_HEADPHONE'), ('SP031', 'ACCESSORY_HEADPHONE'),
    ('SP033', 'ACCESSORY_HEADPHONE'), ('SP060', 'ACCESSORY_HEADPHONE'),
    ('SEED_SP011', 'ACCESSORY_KEYBOARD'), ('SP030', 'ACCESSORY_KEYBOARD'),
    ('SP059', 'ACCESSORY_KEYBOARD'),
    ('SEED_SP010', 'ACCESSORY_MOUSE'), ('SP028', 'ACCESSORY_MOUSE'),
    ('SP029', 'ACCESSORY_MOUSE'), ('SP058', 'ACCESSORY_MOUSE')
)
update public."SAN_PHAM" product
set ma_loai_sp_con = mapping.ma_loai_sp_con
from mapping
where product.ma_sp = mapping.ma_sp;

update public."LOAI_SP"
set ten_loai_sp = 'Máy tính để bàn & PC Gaming'
where ma_loai_sp = 'L_DESKTOP';

do $$
begin
  if exists (select 1 from public."SAN_PHAM" where ma_loai_sp_con is null) then
    raise exception 'Cannot enforce SAN_PHAM.ma_loai_sp_con: unclassified products remain';
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'LOAI_SP_CON_parent_child_key'
  ) then
    alter table public."LOAI_SP_CON"
      add constraint "LOAI_SP_CON_parent_child_key"
      unique (ma_loai_sp, ma_loai_sp_con);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'SAN_PHAM_loai_sp_con_fkey'
  ) then
    alter table public."SAN_PHAM"
      add constraint "SAN_PHAM_loai_sp_con_fkey"
      foreign key (ma_loai_sp, ma_loai_sp_con)
      references public."LOAI_SP_CON" (ma_loai_sp, ma_loai_sp_con);
  end if;
end
$$;

alter table public."SAN_PHAM"
  alter column ma_loai_sp_con set not null;

create index if not exists "SAN_PHAM_loai_sp_subcategory_idx"
  on public."SAN_PHAM" (ma_loai_sp, ma_loai_sp_con);

alter table public."LOAI_SP_CON" enable row level security;
revoke all on table public."LOAI_SP_CON" from anon, authenticated;
grant all on table public."LOAI_SP_CON" to service_role;

notify pgrst, 'reload schema';
