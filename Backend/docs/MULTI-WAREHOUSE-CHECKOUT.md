# Customer checkout across warehouses

Customer availability sums unreserved stock across every active warehouse for a SKU.
`MOI`, `XAC_NHAN` and `DANG_CHUAN_BI` orders reserve their allocated quantities.
For example, physical stock 39 + 39 + 60 + 50 = 188, with reservations 21 + 2,
allows buying 165 units. Inactive warehouses do not contribute stock.

Apply `20261102140733_multi_warehouse_customer_checkout.sql` after the automatic
invoice and stock-based quantity migrations, before deploying the updated backend.
Customer checkout calls `customer_checkout_multi_warehouse_v1`; the legacy explicit
warehouse `customer_checkout_v2` remains available to its existing caller.

Quotes and receipts keep one item per SKU, with an `allocations` array containing
each warehouse and its quantity. `warehouse_id` is the first allocation for request
compatibility. Creating an order recalculates allocations from current stock under
inventory row locks, in warehouse/SKU order. The client's warehouse hint does not
control allocation. If the combined available stock is insufficient, the complete
transaction rolls back.

`CT_DON_HANG` stores one line per warehouse allocation, so existing reservation and
warehouse fulfillment flows use the actual source warehouses. Voucher discounts
are split using cumulative rounding, preserving every cent. The existing automatic
invoice, idempotent retry, ownership checks and service-only RPC access are retained.
No existing inventory, orders or invoices are rewritten by this migration.

Run `python scripts/test_multi_warehouse_checkout.py` from `Backend` for an isolated
PostgreSQL test covering pooling, inactive warehouses, reservations, reallocation,
discount rounding, invoices, cancellation, rollback, retry and concurrent purchases.
