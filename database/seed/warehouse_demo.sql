-- Demo data for local warehouse workflow testing.
-- Run after migrations 001, 002 and 003.
-- This file is intentionally separate from production migrations.

begin;

insert into public."KHO" ("ten_kho", "dia_chi", "trang_thai")
select 'Kho Demo Ha Noi', '01 Demo Street, Ha Noi', 1
where not exists (
  select 1 from public."KHO" where "ten_kho" = 'Kho Demo Ha Noi'
);

insert into public."KHO" ("ten_kho", "dia_chi", "trang_thai")
select 'Kho Demo Da Nang', '02 Demo Street, Da Nang', 1
where not exists (
  select 1 from public."KHO" where "ten_kho" = 'Kho Demo Da Nang'
);

insert into public."NHAN_VIEN"
  ("ma_nhan_vien", "ma_kho", "loai_nhan_vien", "ho_ten", "email", "trang_thai")
select 'NV-DEMO-HN', "ma_kho", 'THU_KHO', 'Thu kho Demo Ha Noi', 'warehouse.hn@example.local', 1
from public."KHO"
where "ten_kho" = 'Kho Demo Ha Noi'
  and not exists (select 1 from public."NHAN_VIEN" where "ma_nhan_vien" = 'NV-DEMO-HN');

insert into public."NHAN_VIEN"
  ("ma_nhan_vien", "ma_kho", "loai_nhan_vien", "ho_ten", "email", "trang_thai")
select 'NV-DEMO-DN', "ma_kho", 'THU_KHO', 'Thu kho Demo Da Nang', 'warehouse.dn@example.local', 1
from public."KHO"
where "ten_kho" = 'Kho Demo Da Nang'
  and not exists (select 1 from public."NHAN_VIEN" where "ma_nhan_vien" = 'NV-DEMO-DN');

insert into public."LOAI_SP" ("ma_loai_sp", "ten_loai_sp", "trang_thai")
values ('CAT-DEMO', 'Loai san pham Demo', 1)
on conflict ("ma_loai_sp") do nothing;

insert into public."SAN_PHAM"
  ("ma_sp", "sku", "ten_sp", "ma_loai_sp", "gia_ban_hien_tai", "don_vi", "trang_thai")
values ('SP-DEMO-001', 'SKU-DEMO-001', 'San pham Demo 001', 'CAT-DEMO', 100000, 'Cai', 1)
on conflict ("ma_sp") do nothing;

insert into public."NHA_CUNG_CAP" ("ten_ncc", "sdt", "email", "dia_chi", "trang_thai")
select 'Nha cung cap Demo', '0900000000', 'supplier@example.local', 'Demo address', 1
where not exists (
  select 1 from public."NHA_CUNG_CAP" where "ten_ncc" = 'Nha cung cap Demo'
);

insert into public."PHIEU_NHAP"
  ("ma_phieu_code", "ma_ncc", "ma_kho", "ngay_tao", "trang_thai", "nguoi_tao", "ghi_chu")
select
  'PN-DEMO-001',
  ncc."ma_ncc",
  kho."ma_kho",
  now(),
  'NHAP',
  'NV-DEMO-HN',
  'Phieu nhap demo cho test transaction'
from public."NHA_CUNG_CAP" ncc
cross join public."KHO" kho
where ncc."ten_ncc" = 'Nha cung cap Demo'
  and kho."ten_kho" = 'Kho Demo Ha Noi'
  and not exists (
    select 1 from public."PHIEU_NHAP" where "ma_phieu_code" = 'PN-DEMO-001'
  );

insert into public."CT_PHIEU_NHAP" ("ma_phieu_nhap", "sku", "so_luong_nhap", "gia_nhap")
select pn."ma_phieu_nhap", 'SKU-DEMO-001', 100, 70000
from public."PHIEU_NHAP" pn
where pn."ma_phieu_code" = 'PN-DEMO-001'
  and not exists (
    select 1 from public."CT_PHIEU_NHAP" ct
    where ct."ma_phieu_nhap" = pn."ma_phieu_nhap" and ct."sku" = 'SKU-DEMO-001'
  );

commit;

select 'Seed completed' as result,
       (select count(*) from public."KHO" where "ten_kho" like 'Kho Demo%') as demo_warehouses,
       (select count(*) from public."PHIEU_NHAP" where "ma_phieu_code" = 'PN-DEMO-001') as demo_receipts;
