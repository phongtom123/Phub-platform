-- Run with psql -v ON_ERROR_STOP=1 after migration, in the disposable test DB.
BEGIN;
DO $$
BEGIN
  ASSERT (SELECT ma_loai_cha IS NULL FROM public."LOAI_SP" WHERE ma_loai_sp = 'EXISTING');
  INSERT INTO public."LOAI_SP" (ma_loai_sp, ten_loai_sp, ma_loai_cha) VALUES
    ('PC', 'Components', NULL), ('CPU', 'Processors', 'PC'), ('INTEL', 'Intel CPUs', 'CPU');
  BEGIN
    INSERT INTO public."LOAI_SP" (ma_loai_sp, ten_loai_sp, ma_loai_cha) VALUES ('BAD', 'Bad', 'MISSING');
    RAISE EXCEPTION 'Missing parent accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    UPDATE public."LOAI_SP" SET ma_loai_cha = 'CPU' WHERE ma_loai_sp = 'CPU';
    RAISE EXCEPTION 'Self cycle accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public."LOAI_SP" SET ma_loai_cha = 'INTEL' WHERE ma_loai_sp = 'PC';
    RAISE EXCEPTION 'Ancestor cycle accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public."LOAI_SP" (ma_loai_sp, ten_loai_sp, ma_loai_cha) VALUES ('A', 'A', 'B'), ('B', 'B', 'A');
    RAISE EXCEPTION 'Multirow cycle accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM public."LOAI_SP" WHERE ma_loai_sp = 'PC';
    RAISE EXCEPTION 'Deleting parent accepted';
  EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN NULL;
  END;
  UPDATE public."LOAI_SP" SET ma_loai_cha = NULL WHERE ma_loai_sp = 'INTEL';
  ASSERT (SELECT ma_loai_cha IS NULL FROM public."LOAI_SP" WHERE ma_loai_sp = 'INTEL');
  ASSERT NOT EXISTS (SELECT FROM pg_proc WHERE proname IN ('lock_category_hierarchy', 'check_category_hierarchy') AND prosecdef);
END;
$$;
ROLLBACK;
SELECT 'PASS: preserves data, supports nesting/reparenting, rejects missing parents and cycles' AS result;
