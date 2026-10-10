/** Translate old single-key UI URLs to the schema-backed data pages. */
const integerKeys = new Set(["warehouses", "suppliers", "receipts", "transfers", "payments", "promotions", "vouchers", "order-lines", "voucher-uses"]);
const aliases: Record<string, string> = { branches: "warehouses", billing: "invoices" };
const known = new Set(["warehouses", "employees", "accounts", "customers", "categories", "products", "inventory", "suppliers", "receipts", "receipt-lines", "transfers", "transfer-lines", "orders", "order-lines", "invoices", "payments", "promotions", "vouchers", "voucher-uses"]);

export function recordHref(section: string, id: string, edit = false): string | null {
  const resource = aliases[section] ?? section;
  if (!known.has(resource)) return null;
  if (id === "new") return `/data/${resource}?new=1`;
  // A legacy single-ID URL cannot identify a composite primary key.
  if (["inventory", "receipt-lines", "transfer-lines"].includes(resource)) return `/data/${resource}`;
  const value = integerKeys.has(resource) ? Number(id) : id;
  // Match PostgreSQL's signed integer range, including negative seed IDs.
  if (typeof value === "number" && (!/^-?\d+$/.test(id) || !Number.isSafeInteger(value) || value < -(2 ** 31) || value > 2 ** 31 - 1)) return `/data/${resource}`;
  return `/data/${resource}?key=${encodeURIComponent(JSON.stringify([value]))}${edit ? "&edit=1" : ""}`;
}
