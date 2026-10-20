"use client";

import BackendDataView from "@warehouse/src/components/backend-data-view";
import type { ModuleDefinition } from "@warehouse/src/types/warehouse";
import StocktakeView from "@warehouse/src/features/modules/stocktake-view";

const resources: Record<string, string> = { inventory: "inventory", receipts: "receipts", transfers: "transfers", products: "products" };

export default function ModuleView({ definition, section, onAdd }: { definition: ModuleDefinition; section: string; onAdd: () => void }) {
  if (section === "stocktake") return <StocktakeView />;
  return resources[section] ? <><div className="page-heading"><div><h1>{definition.title}</h1><p>{definition.description}</p></div>{definition.addLabel && <button className="button primary" type="button" onClick={onAdd}>{definition.addLabel}</button>}</div><BackendDataView key={section} resource={resources[section]} /></> : <p>Kiểm kê/lịch sử chưa có bảng và API trong schema hiện tại; không thể lưu giao dịch thật.</p>;
}
