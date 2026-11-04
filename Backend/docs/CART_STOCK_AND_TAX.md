# Cart stock and invoice totals

- `GET /api/catalog/availability?sku=A&sku=B` is public. It only projects active public products and returns their total available quantity across active warehouses. Availability subtracts reservations in `MOI`, `XAC_NHAN`, and `DANG_CHUAN_BI` orders **only if an invoice exists or a successful collection has been recorded**, separately for each warehouse. Inactive warehouses cannot supply orders.
- `Mua ngay`, adding to cart, editing quantities, and quoting never create orders, invoices, collections or reservations. The current explicit `Đặt hàng` action creates an invoice atomically with the order, so its stock is reserved at that point.
- Apply `20261102151044_reserve_stock_after_invoice_or_payment.sql` to enforce that same rule in catalog, checkout and admin. Invoice/payment activation acquires ordered inventory locks, rechecks availability, and rolls back if stock is insufficient. Invoice plus payment for one order reserves only once. Pending/failed/refund transactions do not establish a reservation; cancellation releases it. Physical stock changes only at dispatch, which requires an invoice or successful collection. Historical records are not rewritten.
- The cart loads this snapshot once per SKU set, refreshes while visible every 60 seconds and on focus/reconnect, and calculates quantity changes in memory. Typing does not query the API. Missing stock or an API failure blocks checkout; stale quantities have an explicit correction button.
- Cart quantity supports the PostgreSQL integer range, bounded by available stock. A cart contains at most 100 SKUs. Checkout can allocate those SKUs into at most 1,000 distinct `(SKU, warehouse)` lines.
- Apply `20261102145332_checkout_total_warehouse_stock.sql` before using the updated backend. It changes only the checkout function, preserving stock locks, idempotency, voucher rules and automatic invoices. Existing single-warehouse fulfillment is preferred; larger quantities are split across warehouses. No historical orders, inventory rows, or table columns are rewritten.
- Quote `total` and `expected_total` remain **before VAT** for compatibility. UI totals include VAT using the invoice rule: round each discounted allocation's net amount times its tax rate to two decimal places, then sum. Current configured VAT is 10%. Shipping is confirmed separately.
- Real availability is advisory. Creating an order checks and reserves stock again atomically. Cart totals are estimates until the backend confirms prices, vouchers and allocation.

Verification:

```powershell
# From Backend
.\.venv\Scripts\python.exe -m pytest tests/test_cart_availability.py tests/test_catalog.py tests/test_commerce.py tests/test_orders.py tests/test_openapi.py -q
# PHUB_PGLITE_MODULE may point to an existing local @electric-sql/pglite installation.
node scripts/test_checkout_total_stock.cjs
node scripts/test_stock_commitment.cjs

# From ui/userUI/Frontend, with the development server running on 3001
node --test tests/cart-money.test.cjs tests/guest-cart.test.mjs
# PHUB_PLAYWRIGHT_MODULE and PHUB_CHROMIUM_PATH may specify existing installations.
node tests/cart-stock.e2e.cjs
```

The SQL and browser fixtures create no real orders or payments on Supabase.
