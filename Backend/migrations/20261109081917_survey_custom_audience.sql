-- Draft recipient overrides. Existing published recipient snapshots are untouched.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public."KHAO_SAT"
  add column khach_them text[] not null default '{}',
  add column khach_loai text[] not null default '{}',
  add constraint crm_survey_audience_overrides check (
    cardinality(khach_them)<=5000 and cardinality(khach_loai)<=5000
    and array_position(khach_them,null) is null and array_position(khach_loai,null) is null
    and not(khach_them && khach_loai));

create function public.crm_survey_ids_v1(p_value jsonb) returns text[]
language plpgsql immutable security invoker set search_path=pg_catalog as $f$
declare result text[];
begin
  if p_value is null then return '{}'::text[]; end if;
  if jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)>5000 then
    raise exception 'Danh sách khách hàng không hợp lệ.' using errcode='23514';
  end if;
  if exists(select 1 from jsonb_array_elements(p_value) x where jsonb_typeof(x)<>'string'
    or length(btrim(x#>>'{}')) not between 1 and 100) then
    raise exception 'Mã khách hàng không hợp lệ.' using errcode='23514';
  end if;
  select coalesce(array_agg(btrim(value) order by btrim(value)),'{}') into result from jsonb_array_elements_text(p_value);
  if cardinality(result)<>(select count(distinct x) from unnest(result) x) then
    raise exception 'Danh sách khách hàng bị trùng.' using errcode='23514';
  end if;
  return result;
end; $f$;

create function public.crm_survey_audience_match_v1(p_kind text,p_from int,p_to int,p_customer text,p_birth date,p_added text[],p_removed text[],p_today date)
returns boolean language sql immutable security invoker set search_path=pg_catalog as $f$
  select not(p_customer=any(p_removed)) and (p_customer=any(p_added) or coalesce(
    p_kind='TAT_CA' or p_kind='CHUA_NGAY_SINH' and p_birth is null
    or p_kind='DO_TUOI' and public.crm_age_v1(p_birth,p_today) between p_from and p_to,false))
$f$;

create function public.crm_validate_survey_audience_v1(p_id uuid) returns void
language plpgsql security invoker set search_path=pg_catalog as $f$
declare added text[];
begin
  select khach_them into added from public."KHAO_SAT" where ma_khao_sat=p_id;
  perform 1 from public."KHACH_HANG" k join public."TAI_KHOAN" a on a.ma_kh=k.ma_kh
    where k.ma_kh=any(added) order by k.ma_kh for share of k,a;
  if exists(select 1 from unnest(added) id where not exists(
    select 1 from public."KHACH_HANG" k join public."TAI_KHOAN" a on a.ma_kh=k.ma_kh
    where k.ma_kh=id and k.luu_tru_luc is null and a.trang_thai=1 and a.ma_nhan_vien is null)) then
    raise exception 'Khách thêm thủ công không còn hoạt động. Bỏ khách không khả dụng trước khi lưu hoặc phát hành.' using errcode='23514';
  end if;
end; $f$;

-- Keep the existing version checks, idempotency, transactions and row locks.
do $patch$
declare source text; old_condition text; replacement text;
begin
  source:=pg_get_functiondef('public.crm_survey_write_v1(text,uuid,text,jsonb,uuid)'::regprocedure);
  source:=replace(source,E'\r\n',E'\n');
  old_condition:='if jsonb_typeof(p_payload->''questions'')';
  if strpos(source,old_condition)=0 then raise exception 'Unexpected survey write implementation'; end if;
  replacement:=$body$if p_payload ? 'khach_them' or p_payload ? 'khach_loai' then
    update public."KHAO_SAT" set
      khach_them=case when p_payload ? 'khach_them' then public.crm_survey_ids_v1(p_payload->'khach_them') else khach_them end,
      khach_loai=case when p_payload ? 'khach_loai' then public.crm_survey_ids_v1(p_payload->'khach_loai') else khach_loai end
      where ma_khao_sat=p_id;
  end if;
  perform public.crm_validate_survey_audience_v1(p_id);
  if jsonb_typeof(p_payload->'questions')$body$;
  source:=replace(source,old_condition,replacement);
  old_condition:='born:=(statement_timestamp()';
  if strpos(source,old_condition)=0 then raise exception 'Unexpected publish implementation'; end if;
  source:=replace(source,old_condition,'perform public.crm_validate_survey_audience_v1(p_id); born:=(statement_timestamp()');
  old_condition:=$condition$(s.loai_doi_tuong='TAT_CA' or s.loai_doi_tuong='CHUA_NGAY_SINH' and k.ngay_sinh is null
            or s.loai_doi_tuong='DO_TUOI' and public.crm_age_v1(k.ngay_sinh,born) between s.tuoi_tu and s.tuoi_den)$condition$;
  if strpos(source,old_condition)=0 then raise exception 'Unexpected publish audience predicate'; end if;
  execute replace(source,old_condition,'public.crm_survey_audience_match_v1(s.loai_doi_tuong,s.tuoi_tu,s.tuoi_den,k.ma_kh,k.ngay_sinh,s.khach_them,s.khach_loai,born)');

  source:=pg_get_functiondef('public.crm_survey_read_v1(text,boolean,text,uuid,integer)'::regprocedure);
  old_condition:=$condition$(s.loai_doi_tuong='TAT_CA' or s.loai_doi_tuong='CHUA_NGAY_SINH' and c.ngay_sinh is null or s.loai_doi_tuong='DO_TUOI' and public.crm_age_v1(c.ngay_sinh,today) between s.tuoi_tu and s.tuoi_den)$condition$;
  if strpos(source,old_condition)=0 then raise exception 'Unexpected preview audience predicate'; end if;
  execute replace(source,old_condition,'public.crm_survey_audience_match_v1(s.loai_doi_tuong,s.tuoi_tu,s.tuoi_den,c.ma_kh,c.ngay_sinh,s.khach_them,s.khach_loai,today)');

  -- Customer survey responses must not disclose other customers' identifiers.
  source:=pg_get_functiondef('public.crm_survey_detail_v1(uuid,text,boolean)'::regprocedure);
  if strpos(source,'to_jsonb(s)')=0 then raise exception 'Unexpected survey detail implementation'; end if;
  execute replace(source,'to_jsonb(s)', '(to_jsonb(s) - case when p_admin then array[]::text[] else array[''khach_them'',''khach_loai'']::text[] end)');
end; $patch$;

create function public.crm_survey_audience_preview_v1(p_actor text,p_config jsonb,p_scope text default 'selected',p_query text default '',p_page integer default 1)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $f$
declare added text[]; removed text[]; kind text:=p_config->>'loai_doi_tuong';
  lo int:=(p_config->>'tuoi_tu')::int; hi int:=(p_config->>'tuoi_den')::int;
  today date:=(statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date; result jsonb;
begin
  perform admin_ops.staff_actor(p_actor);
  added:=public.crm_survey_ids_v1(p_config->'khach_them');removed:=public.crm_survey_ids_v1(p_config->'khach_loai');
  if kind is null or kind not in('TAT_CA','DO_TUOI','CHUA_NGAY_SINH') or p_scope is null or p_scope not in('selected','candidates')
    or p_page is null or p_page not between 1 and 10000 or length(coalesce(p_query,''))>100 or added && removed
    or kind='DO_TUOI' and (lo is null or hi is null or lo<0 or hi>130 or lo>hi)
    or kind<>'DO_TUOI' and (lo is not null or hi is not null) then
    raise exception 'Đối tượng hoặc bộ lọc khách hàng không hợp lệ.' using errcode='23514';
  end if;
  with active as materialized (
    select k.ma_kh,k.ten_kh,public.crm_age_v1(k.ngay_sinh,today) as tuoi,
      public.crm_survey_audience_match_v1(kind,lo,hi,k.ma_kh,k.ngay_sinh,added,removed,today) as selected,
      k.ma_kh=any(added) and not public.crm_survey_audience_match_v1(kind,lo,hi,k.ma_kh,k.ngay_sinh,'{}','{}',today) as added_manually
    from public."KHACH_HANG" k join public."TAI_KHOAN" a on a.ma_kh=k.ma_kh
    where k.luu_tru_luc is null and a.trang_thai=1 and a.ma_nhan_vien is null
  ), filtered as materialized (
    select * from active where selected=(p_scope='selected') and strpos(lower(concat_ws(' ',ma_kh,ten_kh)),lower(btrim(coalesce(p_query,''))))>0
  ), items as (
    select ma_kh,ten_kh,tuoi,added_manually from filtered order by ten_kh,ma_kh offset (p_page-1)*20 limit 20
  ) select jsonb_build_object('data',coalesce((select jsonb_agg(to_jsonb(i) order by i.ten_kh,i.ma_kh) from items i),'[]'::jsonb),
    'total',(select count(*) from filtered),'selected_total',(select count(*) from active where selected),'page',p_page,'page_size',20,
    'unavailable_added_ids',coalesce((select jsonb_agg(id order by id) from unnest(added) id where not exists(select 1 from active a where a.ma_kh=id)),'[]'::jsonb)) into result;
  return result;
end; $f$;

revoke all on function public.crm_survey_ids_v1(jsonb),public.crm_survey_audience_match_v1(text,integer,integer,text,date,text[],text[],date),public.crm_validate_survey_audience_v1(uuid),public.crm_survey_audience_preview_v1(text,jsonb,text,text,integer) from public,anon,authenticated;
grant execute on function public.crm_survey_ids_v1(jsonb),public.crm_survey_audience_match_v1(text,integer,integer,text,date,text[],text[],date),public.crm_validate_survey_audience_v1(uuid),public.crm_survey_audience_preview_v1(text,jsonb,text,text,integer) to service_role;
notify pgrst,'reload schema';
commit;
