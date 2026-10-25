-- Shared media metadata for product galleries and account avatars.
-- Product media belongs directly to SAN_PHAM through MEDIA.ma_sp; no link table.
-- Storage objects must still be created/deleted through the Supabase Storage API.
-- Existing SAN_PHAM.duong_dan_anh remains as a compatibility field during rollout.
begin;

create table public."MEDIA" (
    "ma_media" uuid primary key default gen_random_uuid(),
    "ma_sp" varchar,
    "thu_tu" integer check (thu_tu >= 0),
    "la_anh_chinh" boolean not null default false,
    "storage_bucket" varchar,
    "storage_path" varchar,
    "url" varchar not null,
    "mime_type" varchar,
    "alt_text" varchar,
    "kich_thuoc_bytes" integer check (kich_thuoc_bytes >= 0),
    "chieu_rong" integer check (chieu_rong > 0),
    "chieu_cao" integer check (chieu_cao > 0),
    "ngay_tao" timestamptz not null default now(),
    constraint "MEDIA_product_fkey" foreign key ("ma_sp")
        references public."SAN_PHAM" ("ma_sp") on delete cascade,
    constraint "MEDIA_product_position_key" unique ("ma_sp", "thu_tu"),
    constraint "MEDIA_product_url_key" unique ("ma_sp", "url"),
    constraint "MEDIA_storage_pair_check"
        check ((storage_bucket is null) = (storage_path is null)),
    constraint "MEDIA_product_fields_check"
        check (
            (ma_sp is null and thu_tu is null and la_anh_chinh = false)
            or (ma_sp is not null and thu_tu is not null)
        )
);

create unique index "MEDIA_one_primary_per_product_idx"
    on public."MEDIA" ("ma_sp")
    where "ma_sp" is not null and "la_anh_chinh";

create index "MEDIA_storage_object_idx"
    on public."MEDIA" ("storage_bucket", "storage_path")
    where "storage_bucket" is not null;

alter table public."TAI_KHOAN"
    add column "ma_media_anh_dai_dien" uuid;

alter table public."TAI_KHOAN"
    add constraint "TAI_KHOAN_avatar_media_fkey"
    foreign key ("ma_media_anh_dai_dien")
    references public."MEDIA" ("ma_media") on delete set null;

create index "TAI_KHOAN_avatar_media_idx"
    on public."TAI_KHOAN" ("ma_media_anh_dai_dien")
    where "ma_media_anh_dai_dien" is not null;

-- Preserve every current product image as position 0/main for that product.
insert into public."MEDIA" ("ma_sp", "thu_tu", "la_anh_chinh", "url", "alt_text")
select sp."ma_sp", 0, true, btrim(sp."duong_dan_anh"), sp."ten_sp"
from public."SAN_PHAM" sp
where nullif(btrim(sp."duong_dan_anh"), '') is not null
on conflict ("ma_sp", "url") do nothing;

-- Keep the current single-image admin form working while the gallery editor is
-- rolled out. Writing SAN_PHAM.duong_dan_anh replaces only position 0/main.
create function public.sync_product_primary_media()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    v_media_id uuid;
begin
    if nullif(btrim(new."duong_dan_anh"), '') is null then
        update public."MEDIA"
        set "ma_sp" = null, "thu_tu" = null, "la_anh_chinh" = false
        where "ma_sp" = new."ma_sp" and ("la_anh_chinh" or "thu_tu" = 0);
        return new;
    end if;

    select media."ma_media"
    into v_media_id
    from public."MEDIA" media
    where media."url" = btrim(new."duong_dan_anh")
      and (
          media."ma_sp" = new."ma_sp"
          or (
              media."ma_sp" is null
              and not exists (
                  select 1
                  from public."TAI_KHOAN" account
                  where account."ma_media_anh_dai_dien" = media."ma_media"
              )
          )
      )
    order by (media."ma_sp" is not null) desc, media."ngay_tao" desc, media."ma_media"
    limit 1;

    update public."MEDIA"
    set "ma_sp" = null, "thu_tu" = null, "la_anh_chinh" = false
    where "ma_sp" = new."ma_sp"
      and ("la_anh_chinh" or "thu_tu" = 0)
      and (v_media_id is null or "ma_media" <> v_media_id);

    if v_media_id is null then
        insert into public."MEDIA" ("ma_sp", "thu_tu", "la_anh_chinh", "url", "alt_text")
        values (new."ma_sp", 0, true, btrim(new."duong_dan_anh"), new."ten_sp");
    else
        update public."MEDIA"
        set "ma_sp" = new."ma_sp",
            "thu_tu" = 0,
            "la_anh_chinh" = true,
            "alt_text" = coalesce("alt_text", new."ten_sp")
        where "ma_media" = v_media_id;
    end if;

    return new;
end;
$$;

create trigger "SAN_PHAM_sync_primary_media"
after insert or update of "duong_dan_anh" on public."SAN_PHAM"
for each row execute function public.sync_product_primary_media();

revoke all on function public.sync_product_primary_media() from public, anon, authenticated;
grant execute on function public.sync_product_primary_media() to service_role;

alter table public."MEDIA" enable row level security;
revoke all on table public."MEDIA" from public, anon, authenticated;
grant all on table public."MEDIA" to service_role;

commit;
