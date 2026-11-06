-- One editable review per customer/product, regardless of repeat purchases.
-- Version matches the applied migration on Supabase Phub.
-- Keep the original review id, purchase proof, moderation and content intact.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Refuse an ambiguous upgrade rather than silently deleting historical reviews.
lock table public."DANH_GIA_SAN_PHAM" in access exclusive mode;
do $duplicates$
begin
  if exists(select 1 from public."DANH_GIA_SAN_PHAM" group by ma_kh,ma_sp having count(*)>1) then
    raise exception 'Có đánh giá trùng khách/sản phẩm. Cần đối chiếu lịch sử trước khi nâng cấp.';
  end if;
end;
$duplicates$;
alter table public."DANH_GIA_SAN_PHAM"
  add constraint "DANH_GIA_SAN_PHAM_ma_kh_ma_sp_key" unique(ma_kh,ma_sp);
alter table public."DANH_GIA_SAN_PHAM"
  drop constraint "DANH_GIA_SAN_PHAM_ma_kh_ma_donhang_ma_sp_key";

create or replace function public.crm_review_write_v1(p_actor text,p_product text,p_order text,p_stars int,p_text text,p_version uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $f$
declare k text; r public."DANH_GIA_SAN_PHAM"%rowtype;
begin
  k:=public.crm_actor_v1(p_actor,false);
  if p_stars is null or p_stars not between 1 and 5 or coalesce(length(btrim(p_text)),0) not between 1 and 4000 then
    raise exception 'Nhận xét và điểm 1–5 sao không hợp lệ.' using errcode='23514'; end if;
  perform 1 from public."DON_HANG" where ma_donhang=p_order and ma_kh=k and trang_thai='HOAN_THANH' for share;
  if not found then raise exception 'Chỉ đánh giá sản phẩm trong đơn đã hoàn thành của bạn.' using errcode='42501'; end if;
  perform 1 from public."CT_DON_HANG" l join public."SAN_PHAM" p on p.sku=l.sku where l.ma_donhang=p_order and p.ma_sp=p_product;
  if not found then raise exception 'Sản phẩm không thuộc đơn hàng này.' using errcode='23514'; end if;
  select * into r from public."DANH_GIA_SAN_PHAM" where ma_kh=k and ma_sp=p_product for update;
  if found then
    if r.so_sao=p_stars and r.noi_dung=btrim(p_text) then return to_jsonb(r); end if;
    if p_version is null or r.phien_ban<>p_version then raise exception 'Đánh giá đã thay đổi. Tải lại trước khi sửa.' using errcode='40001'; end if;
    update public."DANH_GIA_SAN_PHAM" set so_sao=p_stars,noi_dung=btrim(p_text),trang_thai='CHO_DUYET',
      nguoi_duyet=null,ngay_duyet=null,duyet_tu_phien_ban=null,phien_ban=gen_random_uuid(),cap_nhat_luc=statement_timestamp()
      where ma_danh_gia=r.ma_danh_gia returning * into r;
  else
    if p_version is not null then raise exception 'Đánh giá không còn tồn tại. Tải lại danh sách.' using errcode='40001'; end if;
    insert into public."DANH_GIA_SAN_PHAM"(ma_kh,ma_sp,ma_donhang,so_sao,noi_dung) values(k,p_product,p_order,p_stars,btrim(p_text))
      on conflict(ma_kh,ma_sp) do nothing returning * into r;
    if not found then raise exception 'Đánh giá vừa được tạo. Tải lại trước khi sửa.' using errcode='40001'; end if;
  end if;
  return to_jsonb(r);
end; $f$;

create or replace function public.crm_review_read_v1(p_actor text,p_kind text,p_product text default null,p_status text default null,p_page int default 1)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $f$
declare k text; result jsonb;
begin
  if p_page not between 1 and 10000 then raise exception 'Trang không hợp lệ.' using errcode='23514'; end if;
  if p_kind='public' then
    perform 1 from public."SAN_PHAM" where ma_sp=p_product and trang_thai<>0;
    if not found then raise exception 'Không tìm thấy sản phẩm.' using errcode='P0002'; end if;
    with selected as (select r.so_sao,r.noi_dung,r.ngay_tao,c.ten_kh as author from public."DANH_GIA_SAN_PHAM" r join public."KHACH_HANG" c on c.ma_kh=r.ma_kh
      where r.ma_sp=p_product and r.trang_thai='HIEN_THI' order by r.ngay_tao desc,r.ma_danh_gia offset (p_page-1)*20 limit 20)
    select jsonb_build_object('data',coalesce((select jsonb_agg(to_jsonb(selected)) from selected),'[]'::jsonb),
      'total',(select count(*) from public."DANH_GIA_SAN_PHAM" where ma_sp=p_product and trang_thai='HIEN_THI'),
      'average',(select round(avg(so_sao),2) from public."DANH_GIA_SAN_PHAM" where ma_sp=p_product and trang_thai='HIEN_THI'),
      'stars',(select jsonb_agg(jsonb_build_object('stars',points,'count',(select count(*) from public."DANH_GIA_SAN_PHAM" where ma_sp=p_product and trang_thai='HIEN_THI' and so_sao=points))) from generate_series(1,5) points),
      'page',p_page,'page_size',20) into result;
    return result;
  elsif p_kind='eligible' then
    k:=public.crm_actor_v1(p_actor,false);
    -- Select one qualifying purchase per product. If a review exists, keep
    -- its original order as immutable purchase proof, even after buying again.
    with purchases as (
      select distinct on(p.ma_sp) d.ma_donhang,d.thoi_gian_dat,p.ma_sp,p.ten_sp,p.sku
      from public."DON_HANG" d join public."CT_DON_HANG" l on l.ma_donhang=d.ma_donhang join public."SAN_PHAM" p on p.sku=l.sku
      where d.ma_kh=k and d.trang_thai='HOAN_THANH'
      order by p.ma_sp,d.thoi_gian_dat desc nulls last,d.ma_donhang
    ), selected as (
      select coalesce(r.ma_donhang,p.ma_donhang) as ma_donhang,
        case when r.ma_danh_gia is null then p.thoi_gian_dat else source.thoi_gian_dat end as thoi_gian_dat,
        p.ma_sp,p.ten_sp,p.sku,r.ma_danh_gia,r.so_sao,r.noi_dung,r.trang_thai,r.phien_ban
      from purchases p left join public."DANH_GIA_SAN_PHAM" r on r.ma_kh=k and r.ma_sp=p.ma_sp
      left join public."DON_HANG" source on source.ma_donhang=r.ma_donhang
    ), items as (select * from selected order by thoi_gian_dat desc nulls last,ma_sp offset (p_page-1)*20 limit 20)
    select jsonb_build_object('data',coalesce((select jsonb_agg(to_jsonb(items) order by thoi_gian_dat desc nulls last,ma_sp) from items),'[]'::jsonb),
      'total',(select count(*) from selected),'page',p_page,'page_size',20) into result;
    return result;
  elsif p_kind='admin' then
    perform public.crm_actor_v1(p_actor,true);
    if p_status is not null and p_status not in ('CHO_DUYET','HIEN_THI','AN') then raise exception 'Bộ lọc trạng thái không hợp lệ.' using errcode='23514'; end if;
    with selected as (select r.*,c.ten_kh,p.ten_sp from public."DANH_GIA_SAN_PHAM" r join public."KHACH_HANG" c on c.ma_kh=r.ma_kh join public."SAN_PHAM" p on p.ma_sp=r.ma_sp
      where (p_status is null or r.trang_thai=p_status) and (p_product is null or r.ma_sp=p_product)),
    items as (select * from selected order by ngay_tao desc,ma_danh_gia offset (p_page-1)*20 limit 20)
    select jsonb_build_object('data',coalesce((select jsonb_agg(to_jsonb(items)) from items),'[]'::jsonb),'total',(select count(*) from selected),'page',p_page,'page_size',20) into result;
    return result;
  end if;
  raise exception 'Thao tác không hợp lệ.' using errcode='23514';
end; $f$;

revoke all on function public.crm_review_write_v1(text,text,text,int,text,uuid),public.crm_review_read_v1(text,text,text,text,int) from public,anon,authenticated;
grant execute on function public.crm_review_write_v1(text,text,text,int,text,uuid),public.crm_review_read_v1(text,text,text,text,int) to service_role;
notify pgrst,'reload schema';
commit;
