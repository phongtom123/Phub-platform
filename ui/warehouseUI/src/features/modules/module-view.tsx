"use client";

import BackendDataView from "@/src/components/backend-data-view";
import type { ModuleDefinition } from "@/src/types/warehouse";

const resources: Record<string, string> = { inventory: "inventory", receipts: "receipts", transfers: "transfers", products: "products" };

export default function ModuleView({ section }: { definition: ModuleDefinition; section: string; onAdd: () => void }) {
  return resources[section] ? <BackendDataView key={section} resource={resources[section]} /> : <p>Kiểm kê/lịch sử chưa có bảng và API trong schema hiện tại; không thể lưu giao dịch thật.</p>;
}
