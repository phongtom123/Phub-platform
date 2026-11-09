-- Read-only CRM access for internal staff; do not create or change survey answers.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Preserve the existing survey transaction and customer scope. Only change the
-- report/statistics boundary introduced by staff_operational_workspace.
do $patch$
declare source text; before_text text := 'if p_admin and p_kind in(''report'',''statistics'') then perform admin_ops.actor(p_actor);';
begin
  source := pg_get_functiondef('public.crm_survey_read_v1(text,boolean,text,uuid,integer)'::regprocedure);
  if strpos(source,before_text)=0 then raise exception 'Unexpected CRM survey read guard'; end if;
  execute replace(source,before_text,'if p_admin and p_kind=''report'' then perform admin_ops.actor(p_actor);');
end;
$patch$;

create function public.crm_customer_interests_v1(
  p_actor text, p_survey_id uuid default null, p_query text default '', p_page integer default 1
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog
as $function$
declare result jsonb; today date := (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  perform public.crm_actor_v1(p_actor,true);
  if p_page is null or p_page not between 1 and 10000 or length(coalesce(p_query,''))>100 then
    raise exception 'Invalid interest filters' using errcode='23514';
  end if;
  if p_survey_id is not null and not exists(select 1 from public."KHAO_SAT" where ma_khao_sat=p_survey_id) then
    raise exception 'Survey not found' using errcode='P0002';
  end if;
  with base as materialized (
    select a.ma_tra_loi,g.ma_kh,c.ten_kh,public.crm_age_v1(c.ngay_sinh,today) as tuoi,
      s.ma_khao_sat,s.tieu_de,q.ma_cau_hoi,q.noi_dung as cau_hoi,q.loai_cau_hoi,
      o.noi_dung as lua_chon,a.noi_dung,a.diem,g.hoan_thanh_luc
    from public."TRA_LOI_KHAO_SAT" a
    join public."GUI_KHAO_SAT" g on g.ma_gui=a.ma_gui and g.ma_khao_sat=a.ma_khao_sat
    join public."KHACH_HANG" c on c.ma_kh=g.ma_kh
    join public."KHAO_SAT" s on s.ma_khao_sat=a.ma_khao_sat
    join public."CAU_HOI_KHAO_SAT" q on q.ma_cau_hoi=a.ma_cau_hoi and q.ma_khao_sat=a.ma_khao_sat
    left join public."LUA_CHON_KHAO_SAT" o on o.ma_lua_chon=a.ma_lua_chon and o.ma_cau_hoi=a.ma_cau_hoi
    where q.nhom_noi_dung='SO_THICH' and g.hoan_thanh_luc is not null
      and s.trang_thai in ('DANG_MO','DONG') and c.luu_tru_luc is null
      and (p_survey_id is null or s.ma_khao_sat=p_survey_id)
  ), filtered as materialized (
    select * from base where strpos(lower(concat_ws(' ',ma_kh,ten_kh,tieu_de,cau_hoi,lua_chon,noi_dung)),lower(btrim(coalesce(p_query,''))))>0
  ), page_items as (
    select * from filtered order by hoan_thanh_luc desc,ma_tra_loi offset (p_page-1)*20 limit 20
  ), option_counts as (
    select ma_cau_hoi,coalesce(lua_chon,diem::text||'/5') as label,count(*) as count
    from filtered where lua_chon is not null or diem is not null
    group by ma_cau_hoi,coalesce(lua_chon,diem::text||'/5')
  ), question_counts as (
    select ma_khao_sat,tieu_de,ma_cau_hoi,cau_hoi,loai_cau_hoi,count(*) as answered
    from filtered group by ma_khao_sat,tieu_de,ma_cau_hoi,cau_hoi,loai_cau_hoi
  ), summaries as (
    select qc.*,coalesce((select jsonb_agg(to_jsonb(oc)-'ma_cau_hoi' order by oc.count desc,oc.label)
      from option_counts oc where oc.ma_cau_hoi=qc.ma_cau_hoi),'[]'::jsonb) as options
    from question_counts qc order by qc.answered desc,qc.ma_cau_hoi limit 6
  ), survey_options as (
    select s.ma_khao_sat,s.tieu_de from public."KHAO_SAT" s
    where s.trang_thai in ('DANG_MO','DONG') and exists(
      select 1 from public."CAU_HOI_KHAO_SAT" q where q.ma_khao_sat=s.ma_khao_sat and q.nhom_noi_dung='SO_THICH')
  )
  select jsonb_build_object(
    'data',coalesce((select jsonb_agg(to_jsonb(p) order by p.hoan_thanh_luc desc,p.ma_tra_loi) from page_items p),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',p_page,'page_size',20,
    'customers',(select count(distinct ma_kh) from filtered),
    'survey_count',(select count(distinct ma_khao_sat) from filtered),
    'question_count',(select count(*) from question_counts),
    'summaries',coalesce((select jsonb_agg(to_jsonb(s) order by s.answered desc,s.ma_cau_hoi) from summaries s),'[]'::jsonb),
    'surveys',coalesce((select jsonb_agg(to_jsonb(s) order by s.tieu_de,s.ma_khao_sat) from survey_options s),'[]'::jsonb)
  ) into result;
  return result;
end;
$function$;
revoke all on function public.crm_customer_interests_v1(text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.crm_customer_interests_v1(text,uuid,text,integer) to service_role;
notify pgrst,'reload schema';
commit;
