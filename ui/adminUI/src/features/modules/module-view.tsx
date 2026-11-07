"use client";

import BackendDataView from "@internal/components/backend-data-view";
import type { ModuleKey } from "@internal/types/admin";
import { moduleResources } from "@internal/lib/backend-resources";
import AccountsView from "@internal/features/accounts/accounts-view";

export function ModuleView({ moduleKey }: {
  moduleKey: ModuleKey;
}) {
  if (moduleKey === "accounts") return <AccountsView mode="list" />;
  const resource = moduleResources[moduleKey];
  return resource ? <BackendDataView key={resource} resource={resource} /> : <p>Chức năng này chưa có API theo schema hiện tại.</p>;
}
