-- Rename existing warehouse employee roles to the canonical application value.
begin;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'NHAN_VIEN'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%loai_nhan_vien%'
  loop
    execute format('alter table public."NHAN_VIEN" drop constraint %I', constraint_name);
  end loop;
end $$;

update public."NHAN_VIEN"
set "loai_nhan_vien" = 'NHAN_VIEN'
where "loai_nhan_vien" in ('THU_KHO', 'NHAN_VIEN_KHO');

alter table public."NHAN_VIEN"
  add constraint nhan_vien_role_check
  check ("loai_nhan_vien" in ('ADMIN', 'NHAN_VIEN'));

alter table public."NHAN_VIEN"
  add constraint nhan_vien_warehouse_assignment_check
  check (("loai_nhan_vien" = 'ADMIN' and "ma_kho" is null)
      or ("loai_nhan_vien" = 'NHAN_VIEN' and "ma_kho" is not null));

commit;
