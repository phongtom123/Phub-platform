"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import WarehouseFrame from "@/src/components/warehouse/warehouse-frame";
import ModuleView from "@/src/features/modules/module-view";
import FormView from "@/src/features/forms/form-view";
import AccountSettings from "@/src/features/settings/account-settings";
import ReceiptList from "@/src/features/receipts/receipt-list";
import SupplierView from "@/src/features/suppliers/supplier-view";
import StockHistory from "@/src/features/history/stock-history";
import { modules } from "@/src/data/warehouse-data";
import type { ModuleKey } from "@/src/types/warehouse";

export default function WarehouseApp() {
  const pathname = usePathname(); const router = useRouter(); const [toast, setToast] = useState("");
  const section = pathname.split("/")[1] as ModuleKey | undefined; const allowedSections = new Set(["inventory", "receipts", "dispatches", "invoices", "suppliers", "history", "account", "settings"]); const safeSection = section && allowedSections.has(section) ? section : undefined; const definition = safeSection ? modules[safeSection] : undefined;
  function addRecord() { router.push(`/${section}/new`); }
  return <><WarehouseFrame>{pathname === "/" ? <ReceiptList/> : pathname.endsWith("/new") ? <FormView section={safeSection ?? "receipts"}/> : safeSection === "receipts" ? <ReceiptList/> : safeSection === "history" ? <StockHistory/> : safeSection === "account" || safeSection === "settings" ? <AccountSettings section={safeSection}/> : safeSection === "suppliers" ? <SupplierView/> : definition ? <ModuleView definition={definition} section={safeSection!} onAdd={addRecord}/> : <ReceiptList/>}</WarehouseFrame>{toast && <div className="toast" role="status">{toast}</div>}</>;
}
