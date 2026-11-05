import type { ModuleKey } from "@/src/types/admin";

export const moduleResources: Partial<Record<ModuleKey, string>> = {
  orders: "orders", billing: "invoices", customers: "customers", products: "products",
  categories: "categories", inventory: "inventory", receipts: "receipts", transfers: "transfers",
  suppliers: "suppliers", branches: "warehouses", employees: "employees", accounts: "accounts",
  promotions: "promotions", vouchers: "vouchers",
};

export function resourceModule(resource: string): ModuleKey {
  const primary = Object.entries(moduleResources).find(([, value]) => value === resource)?.[0];
  if (primary) return primary as ModuleKey;
  if (resource === "payments") return "billing";
  if (resource === "order-lines") return "orders";
  if (resource === "receipt-lines") return "receipts";
  if (resource === "transfer-lines") return "transfers";
  if (resource === "voucher-uses") return "vouchers";
  return "dashboard";
}
