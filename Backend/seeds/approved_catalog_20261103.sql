-- Four real product models and before-VAT prices approved on 03/11/2026.
-- Data only: no schema changes, stock adjustment, receipt or order is created.
-- Re-running inserts only missing SKUs; it never overwrites existing products.
-- Official manufacturer images copied through MediaService to the media bucket.
begin;

do $approved_catalog$
declare
  previous_operations jsonb;
  current_operations jsonb;
  product_number bigint;
begin
  -- Serialize ID allocation against concurrent product creation.
  lock table public."SAN_PHAM" in share row exclusive mode;
  select jsonb_build_object(
    'inventory', (select md5(coalesce(string_agg(to_jsonb(t)::text, '' order by ma_kho, sku), '')) from public."TON_KHO" t),
    'receipts', (select md5(coalesce(string_agg(to_jsonb(t)::text, '' order by ma_phieu_nhap), '')) from public."PHIEU_NHAP" t),
    'receipt_lines', (select md5(coalesce(string_agg(to_jsonb(t)::text, '' order by ma_phieu_nhap, sku), '')) from public."CT_PHIEU_NHAP" t)
  ) into previous_operations;

  if not exists (select 1 from public."LOAI_SP" where ma_loai_sp = 'L_LINHKIEN' and trang_thai = 1)
  then raise exception 'Active component category is missing'; end if;

  insert into public."LOAI_SP_CON" (ma_loai_sp_con, ten_loai_sp_con, ma_loai_sp, trang_thai)
  values
    ('COMPONENT_CASE', 'Vỏ máy tính', 'L_LINHKIEN', 1),
    ('COMPONENT_COOLING_AIR', 'Tản nhiệt khí', 'L_LINHKIEN', 1)
  on conflict (ma_loai_sp_con) do nothing;

  if (select count(*) from public."LOAI_SP_CON"
      where ma_loai_sp = 'L_LINHKIEN' and trang_thai = 1
        and ma_loai_sp_con in ('COMPONENT_RAM', 'COMPONENT_STORAGE', 'COMPONENT_CASE', 'COMPONENT_COOLING_AIR')) <> 4
  then raise exception 'Expected active component subcategories are missing or assigned elsewhere'; end if;

  select coalesce(max(substring(ma_sp from '^SP([0-9]+)$')::bigint), 0)
  into product_number from public."SAN_PHAM" where ma_sp ~ '^SP[0-9]+$';

  with approved(sku, ten_sp, ma_loai_sp_con, thuong_hieu, price, description, specs, unit, warranty, image_url, status) as (
    values
      ('COR-RAM-LPX-16G-D4-3200', 'RAM Corsair Vengeance LPX 16GB (2x8GB) DDR4 3200MHz C16',
       'COMPONENT_RAM', 'Corsair', 890000,
       'Bộ nhớ DDR4 gồm hai thanh 8GB, tản nhiệt nhôm thấp, hỗ trợ Intel XMP 2.0.',
       E'Mã hãng: CMK16GX4M2B3200C16\nDung lượng RAM: 16GB (2x8GB)\nLoại RAM: DDR4\nTốc độ RAM: 3200MHz\nĐộ trễ: CL16\nMàu sắc: Đen',
       'Bộ', 0,
       'https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/e5b4b859aabc4d1bb1cf47b28f51a6a9.webp', 1),
      ('KIN-SSD-NV3-1TB', 'Ổ cứng SSD Kingston NV3 1TB PCIe 4.0 NVMe M.2 2280',
       'COMPONENT_STORAGE', 'Kingston', 1490000,
       'SSD NVMe PCIe 4.0 dung lượng 1TB cho máy tính có khe M.2 2280 tương thích; tốc độ đọc tối đa 6000MB/s và ghi tối đa 4000MB/s.',
       E'Mã hãng: SNV3S/1000G\nDung lượng SSD: 1TB\nGiao tiếp: PCIe 4.0 x4 NVMe\nKích thước: M.2 2280\nTốc độ đọc: 6000MB/s\nTốc độ ghi: 4000MB/s\nĐộ bền ghi: 320TBW',
       'Cái', 60,
       'https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/711dc8a6f4004035adea6cd6e4d47e24.webp', 1),
      ('COR-CASE-4000D-AIRFLOW-BLK', 'Vỏ máy Corsair 4000D Airflow Mid-Tower màu đen',
       'COMPONENT_CASE', 'Corsair', 2190000,
       'Vỏ máy Mid-Tower với mặt trước tối ưu luồng gió, hông kính cường lực và hai quạt AirGuide 120mm đi kèm.',
       E'Mã hãng: CC-9011200-WW\nLoại case: Mid-Tower\nMàu sắc: Đen\nHông case: Kính cường lực\nQuạt đi kèm: 2 quạt 120mm\nQuản lý cáp: Corsair RapidRoute',
       'Cái', 0,
       'https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/75940f0219ef46ed89d4badbb08bf22b.webp', 0),
      ('TR-COOLER-PA120-SE', 'Tản nhiệt khí CPU Thermalright Peerless Assassin 120 SE',
       'COMPONENT_COOLING_AIR', 'Thermalright', 890000,
       'Tản nhiệt khí hai tháp với sáu ống dẫn nhiệt và quạt PWM 120mm, dành cho các socket CPU tương thích.',
       E'Loại tản nhiệt: Tản nhiệt khí hai tháp\nChiều cao: 155mm\nỐng dẫn nhiệt: 6 ống 6mm\nQuạt: TL-C12C 120mm PWM\nTốc độ quạt: Tối đa 1550RPM\nSocket Intel: LGA115X, LGA1200, LGA1700, LGA1851\nSocket AMD: AM4, AM5',
       'Cái', 0,
       'https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/5df0f8e2f48d4b2e92e825c4463dd96d.webp', 0)
  ), missing as (
    select a.*, row_number() over (order by sku) as ordinal
    from approved a where not exists (select 1 from public."SAN_PHAM" p where p.sku = a.sku)
  )
  insert into public."SAN_PHAM"
    (ma_sp, sku, ten_sp, ma_loai_sp, ma_loai_sp_con, thuong_hieu, gia_ban_hien_tai,
     mo_ta, thong_so_ky_thuat, don_vi, bao_hanh_thang, duong_dan_anh, trang_thai)
  select 'SP' || lpad((product_number + ordinal)::text, greatest(3, length((product_number + ordinal)::text)), '0'),
    sku, ten_sp, 'L_LINHKIEN', ma_loai_sp_con, thuong_hieu, price,
    description, specs, unit, warranty, image_url, status
  from missing;
  -- The existing SAN_PHAM_sync_primary_media trigger creates the main MEDIA row.

  select jsonb_build_object(
    'inventory', (select md5(coalesce(string_agg(to_jsonb(t)::text, '' order by ma_kho, sku), '')) from public."TON_KHO" t),
    'receipts', (select md5(coalesce(string_agg(to_jsonb(t)::text, '' order by ma_phieu_nhap), '')) from public."PHIEU_NHAP" t),
    'receipt_lines', (select md5(coalesce(string_agg(to_jsonb(t)::text, '' order by ma_phieu_nhap, sku), '')) from public."CT_PHIEU_NHAP" t)
  ) into current_operations;
  if previous_operations <> current_operations
  then raise exception 'Catalog import unexpectedly changed receiving or inventory; rolling back'; end if;
end;
$approved_catalog$;

commit;
