-- Additive migration: existing categories remain roots; no records are seeded/reclassified.
BEGIN;

ALTER TABLE public."LOAI_SP"
  ADD COLUMN ma_loai_cha varchar,
  ADD CONSTRAINT loai_sp_parent_fk FOREIGN KEY (ma_loai_cha)
    REFERENCES public."LOAI_SP" (ma_loai_sp) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT loai_sp_not_own_parent CHECK (ma_loai_cha IS DISTINCT FROM ma_loai_sp);
CREATE INDEX loai_sp_parent_idx ON public."LOAI_SP" (ma_loai_cha);

-- Serialize hierarchy edits. Concurrent updates may need retry after a deadlock;
-- they must never both commit a cycle. SERIALIZABLE also detects stale snapshots.
CREATE FUNCTION public.lock_category_hierarchy() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_setting('transaction_isolation') = 'repeatable read' THEN
    RAISE EXCEPTION 'Category hierarchy edits require READ COMMITTED or SERIALIZABLE'
      USING ERRCODE = '25000';
  END IF;
  LOCK TABLE public."LOAI_SP" IN SHARE ROW EXCLUSIVE MODE;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.check_category_hierarchy() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.ma_loai_cha IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT ma_loai_sp, ma_loai_cha FROM public."LOAI_SP"
      WHERE ma_loai_sp = NEW.ma_loai_cha
      UNION
      SELECT parent.ma_loai_sp, parent.ma_loai_cha
      FROM public."LOAI_SP" parent JOIN ancestors child
        ON parent.ma_loai_sp = child.ma_loai_cha
    ) SELECT 1 FROM ancestors WHERE ma_loai_sp = NEW.ma_loai_sp
  ) THEN
    RAISE EXCEPTION 'Category hierarchy cannot contain a cycle' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_category_hierarchy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_category_hierarchy() FROM PUBLIC;

CREATE TRIGGER category_hierarchy_lock
  BEFORE INSERT OR UPDATE OF ma_loai_cha, ma_loai_sp ON public."LOAI_SP"
  FOR EACH STATEMENT EXECUTE FUNCTION public.lock_category_hierarchy();
CREATE TRIGGER category_hierarchy_check
  AFTER INSERT OR UPDATE OF ma_loai_cha, ma_loai_sp ON public."LOAI_SP"
  FOR EACH ROW EXECUTE FUNCTION public.check_category_hierarchy();

COMMENT ON COLUMN public."LOAI_SP".ma_loai_cha IS
  'NULL = root; parent in LOAI_SP. Status is independent per category. Cycles are rejected.';
NOTIFY pgrst, 'reload schema';
COMMIT;
