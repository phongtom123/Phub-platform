# Customer checkout across warehouses

For the complete current customer workflow, UI grouping, sold-out behavior and
handoff guidance for AI agents, see
[USER-COMMERCE-LOGIC.md](../../docs/USER-COMMERCE-LOGIC.md).

Customer availability sums unreserved stock across every active warehouse for a SKU.
`MOI`, `XAC_NHAN` and `DANG_CHUAN_BI` orders reserve their allocated quantities
only after invoice issuance or a successful collection. Cart actions and quotes do not reserve stock.
For example, physical stock 39 + 39 + 60 + 50 = 188, with reservations 21 + 2,
allows buying 165 units. Inactive warehouses do not contribute stock.

Apply `20261102140733_multi_warehouse_customer_checkout.sql` after the automatic
invoice and stock-based quantity migrations, before deploying the updated backend.
Customer checkout calls `customer_checkout_multi_warehouse_v1`; the legacy explicit
warehouse `customer_checkout_v2` remains available to its existing caller. The later
`20261102145332_checkout_total_warehouse_stock.sql` also adds split quote support
to that legacy RPC; the customer repository continues using the pooled RPC.

Apply `20261102151044_reserve_stock_after_invoice_or_payment.sql` last so both
RPCs and admin stock checks use the same invoice/payment commitment policy.

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
