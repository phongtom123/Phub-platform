-- Requires 20261025_shared_media.sql. Does not create tables or delete files.
begin;

create or replace function public.admin_product_gallery_v1(
    p_product_id text,
    p_items jsonb,
    p_expected_ids uuid[],
    p_expected_legacy_url text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
    v_legacy text;
    v_name text;
    v_current uuid[];
    v_ids uuid[] := array[]::uuid[];
    v_id uuid;
    v_item jsonb;
    v_url text;
    v_urls text[] := array[]::text[];
    v_index integer;
    v_result jsonb;
begin
    if p_items is null or jsonb_typeof(p_items) <> 'array'
       or jsonb_array_length(p_items) > 20 or p_expected_ids is null then
        raise sqlstate 'PT422' using message = 'Invalid gallery';
    end if;

    -- All writers serialize on the product, including legacy image updates.
    select sp.duong_dan_anh, sp.ten_sp into v_legacy, v_name
    from public."SAN_PHAM" sp where sp.ma_sp = p_product_id for update;
    if not found then
        raise sqlstate 'PT404' using message = 'Product not found';
    end if;

    -- Lock reusable media in a stable order before changing any ownership.
    perform m.ma_media from public."MEDIA" m
    where m.ma_sp = p_product_id
       or m.ma_media in (select (item->>'media_id')::uuid from jsonb_array_elements(p_items) item)
       or (m.ma_sp is null and m.url in (select item->>'url' from jsonb_array_elements(p_items) item))
    order by m.ma_media for update;

    select coalesce(array_agg(m.ma_media order by m.la_anh_chinh desc, m.thu_tu, m.ma_media), array[]::uuid[])
    into v_current from public."MEDIA" m where m.ma_sp = p_product_id;
    if v_current is distinct from p_expected_ids or v_legacy is distinct from p_expected_legacy_url then
        raise sqlstate 'PT409' using message = 'Gallery changed';
    end if;

    for v_item in select value from jsonb_array_elements(p_items) loop
        v_id := null;
        v_url := null;
        if (v_item->>'media_id' is null) = (v_item->>'url' is null) then
            raise sqlstate 'PT422' using message = 'Exactly one image source required';
        end if;
        if v_item->>'media_id' is not null then
            select m.ma_media, m.url into v_id, v_url from public."MEDIA" m
            where m.ma_media = (v_item->>'media_id')::uuid
              and (m.ma_sp is null or m.ma_sp = p_product_id)
              and not exists (select 1 from public."TAI_KHOAN" a where a.ma_media_anh_dai_dien = m.ma_media);
            if not found then
                raise sqlstate 'PT422' using message = 'Media unavailable or owned elsewhere';
            end if;
        else
            v_url := btrim(v_item->>'url');
            if length(v_url) not between 1 and 2000 or v_url ~ '[[:cntrl:]\\]'
               or not (v_url ~ '^https?://[^/[:space:]]+' or v_url ~ '^/[^/]') then
                raise sqlstate 'PT422' using message = 'Invalid image URL';
            end if;
            select m.ma_media into v_id from public."MEDIA" m
            where m.url = v_url and (m.ma_sp is null or m.ma_sp = p_product_id)
              and not exists (select 1 from public."TAI_KHOAN" a where a.ma_media_anh_dai_dien = m.ma_media)
            order by (m.ma_sp is not null) desc, m.ngay_tao desc, m.ma_media limit 1;
            if v_id is null then
                insert into public."MEDIA" (url, alt_text) values (v_url, v_name) returning ma_media into v_id;
            end if;
        end if;
        if v_id = any(v_ids) or v_url = any(v_urls) then
            raise sqlstate 'PT422' using message = 'Duplicate gallery image';
        end if;
        v_ids := array_append(v_ids, v_id);
        v_urls := array_append(v_urls, v_url);
    end loop;

    -- Free all unique positions first. Removed images remain in MEDIA/Storage.
    update public."MEDIA" set ma_sp = null, thu_tu = null, la_anh_chinh = false where ma_sp = p_product_id;
    if cardinality(v_ids) > 0 then
        for v_index in 1..cardinality(v_ids) loop
            update public."MEDIA" set ma_sp = p_product_id, thu_tu = v_index - 1, la_anh_chinh = v_index = 1
            where ma_media = v_ids[v_index];
        end loop;
    end if;
    -- The existing compatibility trigger sees an already consistent primary.
    update public."SAN_PHAM" set duong_dan_anh = v_urls[1] where ma_sp = p_product_id;

    select jsonb_build_object('product_id', p_product_id, 'legacy_url', v_urls[1], 'images',
        coalesce(jsonb_agg(jsonb_build_object(
            'media_id', m.ma_media, 'url', m.url, 'alt_text', m.alt_text,
            'position', m.thu_tu, 'primary', m.la_anh_chinh
        ) order by m.thu_tu, m.ma_media), '[]'::jsonb))
    into v_result from public."MEDIA" m where m.ma_sp = p_product_id;
    return v_result;
end;
$$;

revoke all on function public.admin_product_gallery_v1(text,jsonb,uuid[],text) from public, anon, authenticated;
grant execute on function public.admin_product_gallery_v1(text,jsonb,uuid[],text) to service_role;
notify pgrst, 'reload schema';
commit;
