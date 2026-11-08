/** The two internal portals use one UI; permissions are also enforced by Python/SQL. */
export type InternalPortal = "admin" | "staff";
export const adminModules = new Set(["dashboard", "reports", "customer-insights", "crmReport", "surveys", "accounts", "employees"]);
export const staffModules = new Set([
  "orders", "billing", "customers", "products", "categories", "inventory", "receipts", "dispatches",
  "suppliers", "branches", "promotions", "vouchers", "support", "surveys", "reviews",
  "counter", "invoiceClaims", "history",
]);
export function canOpenModule(portal: InternalPortal, module: string) {
  return (portal === "admin" ? adminModules : staffModules).has(module);
}
export const portalHome = (portal: InternalPortal) => portal === "admin" ? "/" : "/?module=orders";
export const portalRole = (portal: InternalPortal) => portal === "admin" ? "ADMIN" : "NHAN_VIEN";
