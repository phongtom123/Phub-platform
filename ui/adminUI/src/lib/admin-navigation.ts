import type { ModuleKey } from "@internal/types/admin";

const moduleKeys: ModuleKey[] = [
  "dashboard",
  "reports",
  "surveys",
  "reviews",
  "crmReport",
  "orders",
  "billing",
  "customers",
  "products",
  "categories",
  "inventory",
  "receipts",
  "dispatches",
  "suppliers",
  "branches",
  "employees",
  "accounts",
  "promotions",
  "vouchers",
  "support",
];

const sectionToModule: Record<string, ModuleKey> = {
  orders: "orders",
  accounts: "accounts",
  products: "products",
  categories: "categories",
  promotions: "promotions",
  vouchers: "vouchers",
  branches: "branches",
  warehouses: "branches",
  employees: "employees",
  customers: "customers",
  suppliers: "suppliers",
  receipts: "receipts",
  dispatches: "dispatches",
  transfers: "transfers",
  payments: "billing",
  invoices: "billing",
  support: "support",
  reports: "reports",
  surveys: "surveys",
  reviews: "reviews",
  "crm-report": "crmReport",
};

export function getModuleHref(moduleKey: ModuleKey) {
  if (moduleKey === "dispatches") return "/dispatches";
  if (moduleKey === "surveys") return "/surveys";
  if (moduleKey === "reviews") return "/reviews";
  if (moduleKey === "crmReport") return "/crm-report";
  if (moduleKey === "accounts") return "/accounts";
  if (moduleKey === "support") return "/support";
  if (moduleKey === "reports") return "/reports";
  return moduleKey === "dashboard" ? "/" : `/?module=${moduleKey}`;
}

export function getModuleFromSearch(search: string): ModuleKey {
  const requestedModule = new URLSearchParams(search).get("module");

  return moduleKeys.includes(requestedModule as ModuleKey)
    ? (requestedModule as ModuleKey)
    : "dashboard";
}

export function getModuleForSection(section: string): ModuleKey | undefined {
  return sectionToModule[section];
}

export function getSectionHref(section: string) {
  return getModuleHref(getModuleForSection(section) ?? "dashboard");
}
