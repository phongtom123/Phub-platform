-- Multiple products may intentionally reference the same Supabase Storage object.
-- Keep lookup performance without enforcing one MEDIA row per physical object.
begin;

alter table public."MEDIA"
    drop constraint "MEDIA_storage_object_unique";

create index "MEDIA_storage_object_idx"
    on public."MEDIA" ("storage_bucket", "storage_path")
    where "storage_bucket" is not null;

commit;
