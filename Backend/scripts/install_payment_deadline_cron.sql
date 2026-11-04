-- Run after the KAN-61 migration on Supabase/Postgres with pg_cron available.
-- Named scheduling is idempotent. No secret, network request or Render worker.
begin;
create extension if not exists pg_cron;
select cron.schedule('phub-expire-unpaid-invoices-24h', '* * * * *',
 $$select customer_order_private.expire_unpaid_orders(200);$$);
commit;
