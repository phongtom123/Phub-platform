"use client";

import BackendDataView from "@/src/components/backend-data-view";
import type { ModuleDefinition, ModuleKey } from "@/src/types/admin";
import { moduleResources } from "@/src/lib/backend-resources";

export function ModuleView({ moduleKey }: {
  moduleKey: ModuleKey; definition: ModuleDefinition; onCreate: () => void; onBack: () => void;
}) {
  const resource = moduleResources[moduleKey];
  return resource ? <BackendDataView key={resource} resource={resource} /> : <p>Chức năng này chưa có API theo schema hiện tại.</p>;
}
