-- Compatibility repair for deployments whose API already selects invoice buyer email.
-- This adds only the missing nullable field; it does not install the manual-invoice
-- workflow, overwrite historical buyer details, issue invoices or change inventory.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public."HOA_DON"
  add column if not exists email_nguoi_mua varchar(254);

-- Automatic linking was deployed before the optional invoice-email column.
-- Enable its existing trigger now that the column is available. On a fresh
-- database the automatic-link migration installs this trigger later.
do $$
begin
  if to_regprocedure('public.crm_link_invoice_order_trg()') is not null
     and not exists (
       select 1 from pg_trigger
       where tgrelid = 'public."HOA_DON"'::regclass
         and tgname = 'crm_link_invoice_order' and not tgisinternal
     ) then
    create trigger crm_link_invoice_order
      after insert or update of email_nguoi_mua on public."HOA_DON"
      for each row execute function public.crm_link_invoice_order_trg();
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
