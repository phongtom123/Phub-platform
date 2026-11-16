-- Read-performance indexes only: no table, column, row or permission changes.
--
-- 1. Catalog search filters SAN_PHAM with PostgREST `imatch` (case-insensitive
--    regex `~*`) on ten_sp and sku. Without a trigram index every search scans
--    the whole table; pg_trgm GIN indexes support `~*` for patterns of 3+ chars.
-- 2. Stock availability filters TON_KHO by sku across all warehouses. The
--    primary key (ma_kho, sku) cannot serve a lookup on sku alone.
--
-- Safe to re-run. Building an index briefly blocks writes to that table; run
-- outside peak hours if the tables are large.

create extension if not exists pg_trgm with schema extensions;

create index if not exists "SAN_PHAM_ten_sp_trgm_idx"
  on public."SAN_PHAM" using gin ("ten_sp" extensions.gin_trgm_ops);

create index if not exists "SAN_PHAM_sku_trgm_idx"
  on public."SAN_PHAM" using gin ("sku" extensions.gin_trgm_ops);

create index if not exists "TON_KHO_sku_idx"
  on public."TON_KHO" ("sku");

analyze public."SAN_PHAM";
analyze public."TON_KHO";
