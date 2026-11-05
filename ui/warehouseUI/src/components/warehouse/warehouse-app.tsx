"use client";

import { usePathname, useRouter } from "next/navigation";
import WarehouseFrame from "@/src/components/warehouse/warehouse-frame";
import ModuleView from "@/src/features/modules/module-view";
import FormView from "@/src/features/forms/form-view";
import AccountSettings from "@/src/features/settings/account-settings";
import ReceiptList from "@/src/features/receipts/receipt-list";
import SupplierView from "@/src/features/suppliers/supplier-view";
import { modules } from "@/src/data/warehouse-data";
import type { ModuleKey } from "@/src/types/warehouse";

export default function WarehouseApp() {
  const pathname = usePathname();
  const router = useRouter();
  const section = pathname.split("/")[1] as ModuleKey | undefined;
  const allowedSections = new Set(["inventory", "receipts", "dispatches", "invoices", "suppliers", "history", "account", "settings"]);
  const safeSection = section && allowedSections.has(section) ? section : undefined;
  const definition = safeSection ? modules[safeSection] : undefined;

  function addRecord() { router.push(`/${section}/new`); }

  let content: React.ReactNode;
  if (pathname === "/" || safeSection === "receipts") content = <ReceiptList />;
  else if (pathname.endsWith("/new")) content = <FormView section={safeSection ?? "receipts"} />;
  else if (safeSection === "account" || safeSection === "settings") content = <AccountSettings section={safeSection} />;
  else if (safeSection === "suppliers") content = <SupplierView />;
  else if (definition) content = <ModuleView definition={definition} section={safeSection!} onAdd={addRecord} />;
  else content = <ReceiptList />;

  return <WarehouseFrame>{content}</WarehouseFrame>;
}
