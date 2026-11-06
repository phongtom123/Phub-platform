-- Publish on submission/edit. An explicit moderation hide survives customer edits.
-- Version matches the applied migration on Supabase Phub.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
update public."DANH_GIA_SAN_PHAM" set trang_thai='HIEN_THI',phien_ban=gen_random_uuid(),
  cap_nhat_luc=statement_timestamp(),nguoi_duyet=null,ngay_duyet=null,duyet_tu_phien_ban=null
  where trang_thai='CHO_DUYET';
alter table public."DANH_GIA_SAN_PHAM" alter column trang_thai set default 'HIEN_THI';
alter table public."DANH_GIA_SAN_PHAM" drop constraint "DANH_GIA_SAN_PHAM_trang_thai_check";
alter table public."DANH_GIA_SAN_PHAM" add constraint "DANH_GIA_SAN_PHAM_trang_thai_check" check(trang_thai in ('HIEN_THI','AN'));

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
    update public."DANH_GIA_SAN_PHAM" set so_sao=p_stars,noi_dung=btrim(p_text),
      trang_thai=case when r.trang_thai='AN' then 'AN' else 'HIEN_THI' end,
      nguoi_duyet=case when r.trang_thai='AN' then r.nguoi_duyet else null end,
      ngay_duyet=case when r.trang_thai='AN' then r.ngay_duyet else null end,
      duyet_tu_phien_ban=null,phien_ban=gen_random_uuid(),cap_nhat_luc=statement_timestamp()
      where ma_danh_gia=r.ma_danh_gia returning * into r;
  else
    if p_version is not null then raise exception 'Đánh giá không còn tồn tại. Tải lại danh sách.' using errcode='40001'; end if;
    insert into public."DANH_GIA_SAN_PHAM"(ma_kh,ma_sp,ma_donhang,so_sao,noi_dung,trang_thai)
      values(k,p_product,p_order,p_stars,btrim(p_text),'HIEN_THI')
      on conflict(ma_kh,ma_sp) do nothing returning * into r;
    if not found then raise exception 'Đánh giá vừa được tạo. Tải lại trước khi sửa.' using errcode='40001'; end if;
  end if;
  return to_jsonb(r);
end; $f$;
revoke all on function public.crm_review_write_v1(text,text,text,int,text,uuid) from public,anon,authenticated;
grant execute on function public.crm_review_write_v1(text,text,text,int,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
