import InternalApp from "@internal/components/admin/admin-app";
import ReceiptList from "@/src/features/receipts/receipt-list";
import InventoryTotals from "@/src/features/internal/inventory-totals";
import DispatchOrders from "@/src/features/internal/dispatch-orders";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  if (params.module === "receipts") return <InternalApp moduleHint="receipts"><ReceiptList /></InternalApp>;
  if (params.module === "inventory") return <InternalApp moduleHint="inventory"><InventoryTotals /></InternalApp>;
  if (params.module === "dispatches") return <InternalApp moduleHint="dispatches" pageTitle="Phiếu xuất" pageHref="/dispatches"><DispatchOrders /></InternalApp>;
  return <InternalApp />;
}
