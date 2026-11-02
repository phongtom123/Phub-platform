"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import WarehouseFrame from "@/src/components/warehouse/warehouse-frame";
import Dashboard from "@/src/features/dashboard/dashboard";
import ModuleView from "@/src/features/modules/module-view";
import FormView from "@/src/features/forms/form-view";
import AccountSettings from "@/src/features/settings/account-settings";
import SupplierView from "@/src/features/suppliers/supplier-view";
import { modules } from "@/src/data/warehouse-data";
import type { ModuleKey } from "@/src/types/warehouse";

export default function WarehouseApp() {
  const pathname = usePathname(); const router = useRouter(); const [toast, setToast] = useState("");
  const section = pathname.split("/")[1] as ModuleKey | undefined; const definition = section ? modules[section] : undefined;
  function addRecord() { router.push(`/${section}/new`); }
  return <><WarehouseFrame>{pathname === "/" ? <ModuleView definition={modules.receipts!} section="receipts" onAdd={() => router.push("/receipts/new")}/> : pathname.endsWith("/new") ? <FormView section={section ?? "receipts"}/> : section === "account" || section === "settings" ? <AccountSettings section={section}/> : section === "suppliers" ? <SupplierView/> : definition ? <ModuleView definition={definition} section={section!} onAdd={addRecord}/> : <ModuleView definition={modules.receipts!} section="receipts" onAdd={() => router.push("/receipts/new")}/>}</WarehouseFrame>{toast && <div className="toast" role="status">{toast}</div>}</>;
}
