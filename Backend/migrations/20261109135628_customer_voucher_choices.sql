begin;

-- Read-only suggestions. Checkout still validates limits under voucher locks;
-- listing/selecting a code never reserves stock or consumes a voucher use.
create or replace function public.customer_voucher_choices_v1(
    p_customer_id text, p_timezone text default 'Asia/Ho_Chi_Minh'
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
        return jsonb_build_object('error',jsonb_build_object('code','ORDER_CONFIGURATION_REQUIRED'));
    end if;
    if not exists(select 1 from public."KHACH_HANG" where ma_kh=p_customer_id and luu_tru_luc is null) then
        return jsonb_build_object('error',jsonb_build_object('code','AUTH_CUSTOMER_UNAVAILABLE'));
    end if;
    with usage as (
        -- Match the authoritative checkout's current usage policy.
        select u.ma_voucher, count(*) as total,
            count(*) filter(where d.ma_kh=p_customer_id) as own
        from public."SU_DUNG_VOUCHER" u join public."DON_HANG" d using(ma_donhang)
        where u.trang_thai='DA_AP_DUNG' group by u.ma_voucher
    ), choices as (
        select v.ma_code as code, v.loai_giam as discount_type,
            v.gia_tri_giam::numeric(18,2)::text as discount_value,
            v.gia_tri_don_toi_thieu::numeric(18,2)::text as minimum_order,
            v.giam_toi_da::numeric(18,2)::text as maximum_discount,
            c.ngay_bat_dau at time zone p_timezone as starts_at,
            c.ngay_ket_thuc at time zone p_timezone as expires_at,
            case
                when timezone(p_timezone,statement_timestamp()) < c.ngay_bat_dau then 'NOT_STARTED'
                when timezone(p_timezone,statement_timestamp()) > c.ngay_ket_thuc then 'EXPIRED'
                when coalesce(u.total,0) >= v.gioi_han_tong_luot then 'LIMIT_REACHED'
                when coalesce(u.own,0) >= v.gioi_han_moi_khach then 'CUSTOMER_LIMIT_REACHED'
                else null
            end as unavailable_reason
        from public."VOUCHER" v join public."CHUONG_TRINH_KHUYEN_MAI" c using(ma_ctkm)
        left join usage u using(ma_voucher)
        where v.trang_thai='HOAT_DONG' and c.trang_thai='HOAT_DONG'
          and c.ngay_bat_dau is not null and c.ngay_ket_thuc >= c.ngay_bat_dau
          and v.gia_tri_giam > 0 and v.gia_tri_don_toi_thieu >= 0
          and (v.giam_toi_da is null or v.giam_toi_da >= 0)
          and (v.gioi_han_tong_luot is null or v.gioi_han_tong_luot >= 0)
          and (v.gioi_han_moi_khach is null or v.gioi_han_moi_khach >= 0)
          and (v.loai_giam='SO_TIEN' or (v.loai_giam='PHAN_TRAM' and v.gia_tri_giam <= 100))
    ), limited as (
        select * from choices order by unavailable_reason is not null, expires_at desc, code limit 50
    )
    select coalesce(jsonb_agg(to_jsonb(limited) order by unavailable_reason is not null, expires_at desc, code),'[]'::jsonb)
        into result from limited;
    return jsonb_build_object('items',result);
end;
$$;
revoke all on function public.customer_voucher_choices_v1(text,text) from public, anon, authenticated;
grant execute on function public.customer_voucher_choices_v1(text,text) to service_role;
notify pgrst, 'reload schema';
commit;
