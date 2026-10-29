"use client";

import BackendDataView from "@/src/components/backend-data-view";
import type { ModuleDefinition } from "@/src/types/warehouse";
import ReceiptList from "@/src/features/receipts/receipt-list";
import StockHistory from "@/src/features/history/stock-history";

const resources: Record<string, string> = { inventory: "inventory", transfers: "transfers", products: "products", suppliers: "suppliers" };

export default function ModuleView({ section }: { definition: ModuleDefinition; section: string; onAdd: () => void }) {
  if (section === "receipts") return <ReceiptList />;
  if (section === "history") return <StockHistory />;
  return resources[section] ? <BackendDataView key={section} resource={resources[section]} /> : <p>Chức năng kiểm kê chưa được triển khai.</p>;
}
