-- One optional banner per promotion, reusing shared MEDIA metadata.
begin;
set local lock_timeout = '5s';
alter table public."CHUONG_TRINH_KHUYEN_MAI" add column if not exists ma_media_banner uuid;
do $$ begin
    if not exists (select 1 from pg_constraint
        where conrelid = 'public."CHUONG_TRINH_KHUYEN_MAI"'::regclass
          and conname = 'CHUONG_TRINH_KHUYEN_MAI_banner_media_fkey') then
        alter table public."CHUONG_TRINH_KHUYEN_MAI"
            add constraint "CHUONG_TRINH_KHUYEN_MAI_banner_media_fkey"
            foreign key (ma_media_banner) references public."MEDIA" (ma_media) on delete set null;
    end if;
end $$;
create index if not exists "CHUONG_TRINH_KHUYEN_MAI_banner_media_idx"
    on public."CHUONG_TRINH_KHUYEN_MAI" (ma_media_banner) where ma_media_banner is not null;
notify pgrst, 'reload schema';
commit;
