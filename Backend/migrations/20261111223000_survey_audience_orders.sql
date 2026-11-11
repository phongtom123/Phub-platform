-- Support order-based survey audiences: DA_CO_DON (at least 1 completed order) and CHUA_CO_DON
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Drop any existing check constraint restricting loai_doi_tuong
alter table public."KHAO_SAT" drop constraint if exists "KHAO_SAT_loai_doi_tuong_check";
alter table public."KHAO_SAT" drop constraint if exists crm_survey_audience_type;

do $$
declare c name;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public."KHAO_SAT"'::regclass
             and contype = 'c'
             and pg_get_constraintdef(oid) like '%loai_doi_tuong%'
             and pg_get_constraintdef(oid) not like '%tuoi_tu%' loop
    execute format('alter table public."KHAO_SAT" drop constraint %I', c);
  end loop;
end $$;

alter table public."KHAO_SAT" add constraint crm_survey_audience_type check (
  loai_doi_tuong in ('TAT_CA', 'DO_TUOI', 'CHUA_NGAY_SINH', 'DA_CO_DON', 'CHUA_CO_DON')
);

create index if not exists phub_order_customer_status_idx on public."DON_HANG"(ma_kh, trang_thai);

create or replace function public.crm_survey_audience_match_v1(
  p_kind text, p_from int, p_to int, p_customer text, p_birth date, p_added text[], p_removed text[], p_today date
) returns boolean language sql stable security invoker set search_path=pg_catalog as $f$
  select not(p_customer = any(p_removed)) and (
    p_customer = any(p_added) or coalesce(
      p_kind = 'TAT_CA'
      or (p_kind = 'CHUA_NGAY_SINH' and p_birth is null)
      or (p_kind = 'DO_TUOI' and public.crm_age_v1(p_birth, p_today) between p_from and p_to)
      or (p_kind = 'DA_CO_DON' and exists(
        select 1 from public."DON_HANG" dh where dh.ma_kh = p_customer and dh.trang_thai = 'HOAN_THANH'
      ))
      or (p_kind = 'CHUA_CO_DON' and not exists(
        select 1 from public."DON_HANG" dh where dh.ma_kh = p_customer and dh.trang_thai = 'HOAN_THANH'
      )),
      false
    )
  );
$f$;

create or replace function public.crm_survey_audience_preview_v1(
  p_actor text, p_config jsonb, p_scope text default 'selected', p_query text default '', p_page integer default 1
) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $f$
declare
  added text[]; removed text[]; kind text := p_config->>'loai_doi_tuong';
  lo int := (p_config->>'tuoi_tu')::int; hi int := (p_config->>'tuoi_den')::int;
  today date := (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date; result jsonb;
begin
  perform admin_ops.staff_actor(p_actor);
  added := public.crm_survey_ids_v1(p_config->'khach_them');
  removed := public.crm_survey_ids_v1(p_config->'khach_loai');
  if kind is null or kind not in ('TAT_CA', 'DO_TUOI', 'CHUA_NGAY_SINH', 'DA_CO_DON', 'CHUA_CO_DON')
    or p_scope is null or p_scope not in ('selected', 'candidates')
    or p_page is null or p_page not between 1 and 10000 or length(coalesce(p_query, '')) > 100 or added && removed
    or (kind = 'DO_TUOI' and (lo is null or hi is null or lo < 0 or hi > 130 or lo > hi))
    or (kind <> 'DO_TUOI' and (lo is not null or hi is not null)) then
    raise exception 'Đối tượng hoặc bộ lọc khách hàng không hợp lệ.' using errcode='23514';
  end if;
  with active as materialized (
    select k.ma_kh, k.ten_kh, public.crm_age_v1(k.ngay_sinh, today) as tuoi,
      public.crm_survey_audience_match_v1(kind, lo, hi, k.ma_kh, k.ngay_sinh, added, removed, today) as selected,
      k.ma_kh = any(added) and not public.crm_survey_audience_match_v1(kind, lo, hi, k.ma_kh, k.ngay_sinh, '{}', '{}', today) as added_manually
    from public."KHACH_HANG" k join public."TAI_KHOAN" a on a.ma_kh = k.ma_kh
    where k.luu_tru_luc is null and a.trang_thai = 1 and a.ma_nhan_vien is null
  ), filtered as materialized (
    select * from active where selected = (p_scope = 'selected') and strpos(lower(concat_ws(' ', ma_kh, ten_kh)), lower(btrim(coalesce(p_query, '')))) > 0
  ), items as (
    select ma_kh, ten_kh, tuoi, added_manually from filtered order by ten_kh, ma_kh offset (p_page - 1) * 20 limit 20
  ) select jsonb_build_object(
    'data', coalesce((select jsonb_agg(to_jsonb(i) order by i.ten_kh, i.ma_kh) from items i), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'selected_total', (select count(*) from active where selected),
    'page', p_page,
    'page_size', 20,
    'unavailable_added_ids', coalesce((select jsonb_agg(id order by id) from unnest(added) id where not exists(select 1 from active a where a.ma_kh = id)), '[]'::jsonb)
  ) into result;
  return result;
end; $f$;

revoke all on function public.crm_survey_audience_match_v1(text, integer, integer, text, date, text[], text[], date) from public, anon, authenticated;
grant execute on function public.crm_survey_audience_match_v1(text, integer, integer, text, date, text[], text[], date) to service_role;

revoke all on function public.crm_survey_audience_preview_v1(text, jsonb, text, text, integer) from public, anon, authenticated;
grant execute on function public.crm_survey_audience_preview_v1(text, jsonb, text, text, integer) to service_role;

notify pgrst, 'reload schema';
commit;
