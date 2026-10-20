"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import WarehouseFrame from "@warehouse/src/components/warehouse/warehouse-frame";
import Dashboard from "@warehouse/src/features/dashboard/dashboard";
import ModuleView from "@warehouse/src/features/modules/module-view";
import AccountSettings from "@warehouse/src/features/settings/account-settings";
import { modules } from "@warehouse/src/data/warehouse-data";
import type { ModuleKey } from "@warehouse/src/types/warehouse";
import WarehouseWorkflowForm from "@warehouse/src/features/forms/warehouse-workflow-form";
import BackendDataView from "@warehouse/src/components/backend-data-view";

export default function WarehouseApp() {
  const pathname = usePathname(); const router = useRouter(); const [toast, setToast] = useState("");
  const segments = pathname.split("/"); const section = segments[1] as ModuleKey | undefined; const definition = section ? modules[section] : undefined;
  const dataResource = segments[1] === "data" ? segments[2] : undefined;
  const creating = segments[2] === "new" && (section === "receipts" || section === "transfers");
  const editing = /^\d+$/.test(segments[2] ?? "") && segments[3] === "edit" && (section === "receipts" || section === "transfers");
  function addRecord() { router.push(`/${section}/new`); }
  return <><WarehouseFrame>{creating || editing ? <WarehouseWorkflowForm section={section!} recordId={editing ? Number(segments[2]) : undefined} /> : dataResource ? <BackendDataView resource={dataResource} /> : pathname === "/" ? <Dashboard/> : section === "account" || section === "settings" ? <AccountSettings section={section}/> : definition ? <ModuleView definition={definition} section={section!} onAdd={addRecord}/> : <Dashboard/>}</WarehouseFrame>{toast && <div className="toast" role="status">{toast}</div>}</>;
}
