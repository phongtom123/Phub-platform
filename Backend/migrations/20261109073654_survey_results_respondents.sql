-- Read-only result page: creator, aggregates and completed respondent answers.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function public.crm_survey_results_v1(
  p_actor text, p_id uuid, p_query text default '', p_page integer default 1, p_text_page integer default 1
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog
as $function$
declare result jsonb; statistics jsonb; creator jsonb;
  today date := (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  perform public.crm_actor_v1(p_actor,true);
  if p_id is null or p_page is null or p_page not between 1 and 10000
      or p_text_page is null or p_text_page not between 1 and 10000 or length(coalesce(p_query,''))>100 then
    raise exception 'Invalid survey result filters' using errcode='23514';
  end if;
  statistics:=public.crm_survey_read_v1(p_actor,true,'statistics',p_id,p_text_page);
  select jsonb_build_object('ma_tk',a.ma_tk,'ho_ten',coalesce(n.ho_ten,a.ten_tai_khoan))
    into creator from public."KHAO_SAT" s join public."TAI_KHOAN" a on a.ma_tk=s.nguoi_tao
    left join public."NHAN_VIEN" n on n.ma_nhan_vien=a.ma_nhan_vien where s.ma_khao_sat=p_id;
  with selected as materialized (
    select g.ma_gui,g.ma_kh,c.ten_kh,c.luu_tru_luc,public.crm_age_v1(c.ngay_sinh,today) as tuoi,g.hoan_thanh_luc
    from public."GUI_KHAO_SAT" g join public."KHACH_HANG" c on c.ma_kh=g.ma_kh
    where g.ma_khao_sat=p_id and g.hoan_thanh_luc is not null
      and strpos(lower(concat_ws(' ',g.ma_kh,c.ten_kh)),lower(btrim(coalesce(p_query,''))))>0
  ), page_items as (
    select * from selected order by hoan_thanh_luc desc,ma_gui offset (p_page-1)*20 limit 20
  ), with_answers as (
    select p.*,coalesce((select jsonb_agg(jsonb_build_object(
        'ma_cau_hoi',q.ma_cau_hoi,'cau_hoi',q.noi_dung,'nhom_noi_dung',q.nhom_noi_dung,
        'lua_chon',o.noi_dung,'noi_dung',a.noi_dung,'diem',a.diem) order by q.thu_tu,a.ma_tra_loi)
      from public."TRA_LOI_KHAO_SAT" a
      join public."CAU_HOI_KHAO_SAT" q on q.ma_cau_hoi=a.ma_cau_hoi and q.ma_khao_sat=a.ma_khao_sat
      left join public."LUA_CHON_KHAO_SAT" o on o.ma_lua_chon=a.ma_lua_chon and o.ma_cau_hoi=a.ma_cau_hoi
      where a.ma_gui=p.ma_gui and a.ma_khao_sat=p_id),'[]'::jsonb) as answers
    from page_items p
  )
  select jsonb_build_object('statistics',statistics,'creator',creator,
    'respondents',jsonb_build_object(
      'data',coalesce((select jsonb_agg(to_jsonb(p) order by p.hoan_thanh_luc desc,p.ma_gui) from with_answers p),'[]'::jsonb),
      'total',(select count(*) from selected),'page',p_page,'page_size',20)) into result;
  return result;
end;
$function$;
revoke all on function public.crm_survey_results_v1(text,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.crm_survey_results_v1(text,uuid,text,integer,integer) to service_role;
notify pgrst,'reload schema';
commit;
