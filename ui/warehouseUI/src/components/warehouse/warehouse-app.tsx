"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import WarehouseFrame from "@warehouse/src/components/warehouse/warehouse-frame";
import Dashboard from "@warehouse/src/features/dashboard/dashboard";
import ModuleView from "@warehouse/src/features/modules/module-view";
import AccountSettings from "@warehouse/src/features/settings/account-settings";
import { modules } from "@warehouse/src/data/warehouse-data";
import type { ModuleKey } from "@warehouse/src/types/warehouse";

export default function WarehouseApp() {
  const pathname = usePathname(); const router = useRouter(); const [toast, setToast] = useState("");
  const section = pathname.split("/")[1] as ModuleKey | undefined; const definition = section ? modules[section] : undefined;
  function addRecord() { router.push(`/${section}/new`); }
  return <><WarehouseFrame>{pathname === "/" ? <Dashboard/> : section === "account" || section === "settings" ? <AccountSettings section={section}/> : definition ? <ModuleView definition={definition} section={section!} onAdd={addRecord}/> : <Dashboard/>}</WarehouseFrame>{toast && <div className="toast" role="status">{toast}</div>}</>;
}
