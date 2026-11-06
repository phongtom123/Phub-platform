-- Explicit demo data, requested by the owner, for existing active customer accounts.
-- Only completed orders and their actual products qualify. Never create orders,
-- change stock/payments/order status or overwrite reviews. Samples stay labelled
-- and follow the current immediate-publication policy (HIEN_THI).
-- Re-running skips every customer/product that already has a review.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $seed$
declare item record;
begin
  for item in
    select distinct on(k.ma_kh,p.ma_sp) a.ma_tk, k.ma_kh, d.ma_donhang, p.ma_sp
    from public."TAI_KHOAN" a
    join public."KHACH_HANG" k on k.ma_kh = a.ma_kh
    join public."DON_HANG" d on d.ma_kh = k.ma_kh
    join public."CT_DON_HANG" l on l.ma_donhang = d.ma_donhang
    join public."SAN_PHAM" p on p.sku = l.sku
    where a.trang_thai = 1 and k.luu_tru_luc is null
      and d.trang_thai = 'HOAN_THANH'
      and not exists (
        select 1 from public."DANH_GIA_SAN_PHAM" r
        where r.ma_kh = k.ma_kh and r.ma_sp = p.ma_sp
      )
    order by k.ma_kh, p.ma_sp, d.thoi_gian_dat desc nulls last, d.ma_donhang, a.ma_tk
  loop
    perform public.crm_review_write_v1(
      item.ma_tk, item.ma_sp, item.ma_donhang, 4,
      '[DỮ LIỆU MẪU] Dùng để kiểm tra chức năng đánh giá sau mua; không phải nhận xét thực tế của khách hàng.',
      null
    );
  end loop;
end;
$seed$;
commit;
