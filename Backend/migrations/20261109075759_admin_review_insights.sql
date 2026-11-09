-- Aggregate existing visible reviews by product. No new table or review mutation.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function public.crm_review_insights_v1(
  p_actor text, p_query text default '', p_from date default null, p_to date default null,
  p_min_reviews integer default 1, p_sort text default 'LOW_RATING', p_page integer default 1,
  p_product text default null, p_review_page integer default 1, p_low_only boolean default false
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog
as $function$
declare result jsonb;
begin
  perform admin_ops.actor(p_actor);
  if p_page is null or p_page not between 1 and 10000 or p_review_page is null or p_review_page not between 1 and 10000
    or p_min_reviews is null or p_min_reviews not between 1 and 100000 or p_low_only is null
    or p_sort is null or p_sort not in ('LOW_RATING','LOWEST_SCORE','MOST_REVIEWS','NEWEST')
    or length(coalesce(p_query,''))>100 or length(coalesce(p_product,''))>200
    or (p_from is not null and p_to is not null and p_from>p_to) then
    raise exception 'Invalid review report filters' using errcode='23514';
  end if;
  with base as materialized (
    select r.ma_danh_gia,r.ma_sp,r.so_sao,r.ngay_tao,p.sku,p.ten_sp
    from public."DANH_GIA_SAN_PHAM" r join public."SAN_PHAM" p on p.ma_sp=r.ma_sp
    where r.trang_thai='HIEN_THI'
      and (p_from is null or r.ngay_tao >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (p_to is null or r.ngay_tao < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and strpos(lower(concat_ws(' ',p.ma_sp,p.sku,p.ten_sp)),lower(btrim(coalesce(p_query,''))))>0
  ), products as materialized (
    select ma_sp,sku,ten_sp,count(*) as review_count,round(avg(so_sao),2) as average,
      count(*) filter(where so_sao<=2) as low_count,
      round(100.0*count(*) filter(where so_sao<=2)/count(*),2) as low_rate,max(ngay_tao) as latest_at
    from base group by ma_sp,sku,ten_sp having count(*)>=p_min_reviews
  ), matching_reviews as materialized (
    select b.* from base b join products p on p.ma_sp=b.ma_sp
  ), ordered_products as (
    select products.*,row_number() over(order by
      case when p_sort='LOW_RATING' then low_count end desc,
      case when p_sort='LOW_RATING' then low_rate end desc,
      case when p_sort='LOWEST_SCORE' then average end asc,
      case when p_sort in ('MOST_REVIEWS','LOWEST_SCORE','LOW_RATING') then review_count end desc,
      case when p_sort='MOST_REVIEWS' then average end asc,
      case when p_sort='NEWEST' then latest_at end desc,ma_sp) as ordinal from products
  ), product_page as (
    select * from ordered_products order by ordinal
    offset (p_page-1)*20 limit 20
  ), detail_matches as (
    select * from matching_reviews where ma_sp=p_product and (not p_low_only or so_sao<=2)
  ), review_page as (
    select * from detail_matches order by ngay_tao desc,ma_danh_gia offset (p_review_page-1)*10 limit 10
  ), detail_items as (
    select p.ma_danh_gia,p.so_sao,p.ngay_tao,r.cap_nhat_luc,r.noi_dung,coalesce(c.ten_kh,'Khách hàng') as author
    from review_page p join public."DANH_GIA_SAN_PHAM" r on r.ma_danh_gia=p.ma_danh_gia
    left join public."KHACH_HANG" c on c.ma_kh=r.ma_kh
  )
  select jsonb_build_object(
    'data',coalesce((select jsonb_agg(to_jsonb(p)-'ordinal' order by p.ordinal) from product_page p),'[]'::jsonb),
    'total',(select count(*) from products),'page',p_page,'page_size',20,
    'summary',(select jsonb_build_object('products',(select count(*) from products),'reviews',count(*),
      'average',round(avg(so_sao),2),'low_count',count(*) filter(where so_sao<=2),
      'low_rate',coalesce(round(100.0*count(*) filter(where so_sao<=2)/nullif(count(*),0),2),0)) from matching_reviews),
    'details',case when p_product is null then null else jsonb_build_object(
      'product',(select to_jsonb(p) from products p where p.ma_sp=p_product),
      'data',coalesce((select jsonb_agg(to_jsonb(r) order by r.ngay_tao desc,r.ma_danh_gia) from detail_items r),'[]'::jsonb),
      'total',(select count(*) from detail_matches),'page',p_review_page,'page_size',10,'low_only',p_low_only) end
  ) into result;
  if p_product is not null and result->'details'->'product'='null'::jsonb then
    raise exception 'Product is outside the selected report filters' using errcode='P0002';
  end if;
  return result;
end;
$function$;
revoke all on function public.crm_review_insights_v1(text,text,date,date,integer,text,integer,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.crm_review_insights_v1(text,text,date,date,integer,text,integer,text,integer,boolean) to service_role;
notify pgrst,'reload schema';
commit;
