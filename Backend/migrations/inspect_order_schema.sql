-- Read-only review before deploying. Does not print customer data or credentials.
SELECT table_name, column_name, data_type, character_maximum_length,
       numeric_precision, numeric_scale, column_default, is_identity
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('DON_HANG','CT_DON_HANG','SAN_PHAM','TON_KHO','KHO','LOAI_SP','KHACH_HANG','VOUCHER','SU_DUNG_VOUCHER','CHUONG_TRINH_KHUYEN_MAI')
ORDER BY table_name, ordinal_position;

SELECT c.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('DON_HANG','CT_DON_HANG','TON_KHO','VOUCHER','SU_DUNG_VOUCHER','CHUONG_TRINH_KHUYEN_MAI')
ORDER BY c.relname, con.conname;

SELECT c.relname AS table_name, t.tgname, pg_get_triggerdef(t.oid) AS definition,
       pg_get_functiondef(t.tgfoid) AS trigger_function
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND c.relname IN ('DON_HANG','CT_DON_HANG','TON_KHO','VOUCHER','SU_DUNG_VOUCHER','CHUONG_TRINH_KHUYEN_MAI')
ORDER BY c.relname, t.tgname;
