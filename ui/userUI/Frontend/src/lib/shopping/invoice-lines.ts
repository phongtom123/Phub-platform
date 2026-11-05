import { cents, decimal } from "./money";
import type { StoredLine } from "./types";

type InvoiceLine = Omit<StoredLine, "warehouse_id">;

export function groupInvoiceLines(items: InvoiceLine[]): InvoiceLine[] {
  const grouped = new Map<string, InvoiceLine>();
  for (const item of items) {
    // Preserve different sale prices/units on older orders. Warehouse allocations
    // with the same SKU and price are one product on the customer's invoice.
    const key = JSON.stringify([item.sku, item.unit, cents(item.unit_price).toString()]);
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.discount = decimal(cents(existing.discount) + cents(item.discount));
      existing.tax_amount = decimal(cents(existing.tax_amount) + cents(item.tax_amount));
      existing.line_total = decimal(cents(existing.line_total) + cents(item.line_total));
    } else {
      grouped.set(key, {
        sku: item.sku, name: item.name, unit: item.unit, quantity: item.quantity,
        unit_price: item.unit_price, discount: item.discount,
        tax_amount: item.tax_amount, line_total: item.line_total,
      });
    }
  }
  return [...grouped.values()];
}
