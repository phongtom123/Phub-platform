-- Only for an isolated disposable database, before the category_hierarchy migration.
CREATE TABLE public."LOAI_SP" (
  ma_loai_sp varchar PRIMARY KEY,
  ten_loai_sp varchar NOT NULL UNIQUE,
  trang_thai integer NOT NULL DEFAULT 1
);
INSERT INTO public."LOAI_SP" VALUES ('EXISTING', 'Existing category', 1);
