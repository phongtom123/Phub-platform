-- Checkout is exposed only through the trusted backend, which uses service_role.
-- Browser roles must not call the order/checkout RPCs directly.
begin;

revoke all on function public.customer_create_order_v1(
    uuid, jsonb, text, text, numeric, text, integer, text
) from public, anon, authenticated;

revoke all on function public.customer_checkout_v2(
    text, jsonb, uuid, boolean, text, text, numeric, text, integer, text, text
) from public, anon, authenticated;

revoke all on function public.customer_read_orders_v2(
    text, text, integer, integer, text
) from public, anon, authenticated;

grant execute on function public.customer_create_order_v1(
    uuid, jsonb, text, text, numeric, text, integer, text
) to service_role;

grant execute on function public.customer_checkout_v2(
    text, jsonb, uuid, boolean, text, text, numeric, text, integer, text, text
) to service_role;

grant execute on function public.customer_read_orders_v2(
    text, text, integer, integer, text
) to service_role;

notify pgrst, 'reload schema';
commit;
