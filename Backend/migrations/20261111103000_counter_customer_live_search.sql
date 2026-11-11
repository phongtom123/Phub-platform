-- Live counter customer search by customer code, name, username, email or phone.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.staff_counter_catalog_v1(
  p_actor text, p_kind text, p_query text default ''
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog as $$
declare employee text; wh int; r jsonb; q text;
begin
 employee:=admin_ops.counter_actor(p_actor); p_query:=btrim(coalesce(p_query,''));
 if length(p_query)>100 then raise exception 'Từ khóa quá dài.' using errcode='23514'; end if;
 q:='%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%';
 select ma_kho into wh from public."NHAN_VIEN" where ma_nhan_vien=employee;
 if p_kind='customers' then
   select coalesce(jsonb_agg(x.row),'[]') into r from (
    select jsonb_build_object(
      'ma_kh',k.ma_kh,'ten_kh',k.ten_kh,'sdt',k.sdt,
      'email',a.email,'ten_tai_khoan',a.ten_tai_khoan
    ) row
    from public."KHACH_HANG" k join public."TAI_KHOAN" a using(ma_kh)
    where k.luu_tru_luc is null and a.luu_tru_luc is null
      and a.trang_thai=1 and a.ma_nhan_vien is null and
      (k.ma_kh ilike q escape '\' or k.ten_kh ilike q escape '\'
       or coalesce(k.sdt,'') ilike q escape '\' or a.ten_tai_khoan ilike q escape '\'
       or coalesce(a.email,'') ilike q escape '\')
    order by k.ten_kh,k.ma_kh limit 20
   ) x;
 elsif p_kind='products' then
   select coalesce(jsonb_agg(x.row),'[]') into r from (
    select jsonb_build_object('sku',p.sku,'ten_sp',p.ten_sp,
      'unit_price',p.gia_ban_hien_tai::text,'warehouse_id',t.ma_kho,
      'available',greatest(0,admin_ops.available(t.ma_kho,p.sku))) row
    from public."SAN_PHAM" p join public."TON_KHO" t using(sku)
      join public."KHO" k using(ma_kho)
      join public."LOAI_SP" c using(ma_loai_sp)
      join public."LOAI_SP_CON" sc using(ma_loai_sp,ma_loai_sp_con)
    where p.trang_thai=1 and c.trang_thai=1 and sc.trang_thai=1 and k.trang_thai=1
      and (wh is null or t.ma_kho=wh)
      and (p.sku ilike q escape '\' or p.ten_sp ilike q escape '\')
    order by p.ten_sp,p.sku,t.ma_kho limit 30
   ) x;
 else raise exception 'Loại tra cứu không hợp lệ.' using errcode='23514'; end if;
 return jsonb_build_object('data',r);
end $$;

revoke all on function public.staff_counter_catalog_v1(text,text,text) from public,anon,authenticated;
grant execute on function public.staff_counter_catalog_v1(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
