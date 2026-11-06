-- Keep the existing purchase/ownership checks; optionally read just one product.
-- Version matches the migration applied on Supabase Phub.
-- This avoids downloading every purchased product to open an inline editor.
begin;
set local lock_timeout='5s';
do $upgrade$
declare source text; needle text := 'where d.ma_kh=k and d.trang_thai=''HOAN_THANH''';
  replacement text := 'where d.ma_kh=k and d.trang_thai=''HOAN_THANH'' and (p_product is null or p.ma_sp=p_product)';
begin
  source:=pg_get_functiondef('public.crm_review_read_v1(text,text,text,text,integer)'::regprocedure);
  if strpos(source,replacement)=0 then
    if strpos(source,needle)=0 then raise exception 'Review eligibility source changed; inspect before applying.'; end if;
    execute replace(source,needle,replacement);
  end if;
end;
$upgrade$;
notify pgrst,'reload schema';
commit;
