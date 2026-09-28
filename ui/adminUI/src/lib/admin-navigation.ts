import type { ModuleKey } from "@/src/types/admin";

const moduleKeys: ModuleKey[] = [
  "dashboard",
  "orders",
  "billing",
  "customers",
  "products",
  "categories",
  "inventory",
  "receipts",
  "transfers",
  "suppliers",
  "branches",
  "employees",
  "accounts",
  "promotions",
  "vouchers",
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
  transfers: "transfers",
  payments: "billing",
  invoices: "billing",
};

export function getModuleHref(moduleKey: ModuleKey) {
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
