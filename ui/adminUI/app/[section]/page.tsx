import { notFound } from "next/navigation";
import AdminApp from "@/src/components/admin/admin-app";

const warehouseSections = new Set(["inventory", "receipts", "transfers", "stocktake", "products", "history", "settings"]);

export default async function WarehouseSectionRoute({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!warehouseSections.has(section)) notFound();
  return <AdminApp />;
}
