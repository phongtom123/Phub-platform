import WarehouseFrame from "@/src/components/warehouse/warehouse-frame";
import BackendDataView from "@/src/components/backend-data-view";
import { redirect } from "next/navigation";

export default async function DataPage({ params, searchParams }: { params: Promise<{ resource: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { resource } = await params;
  if (resource === "receipts") {
    const query = await searchParams;
    if (query.new === "1") redirect("/receipts/new");
    let id: number | undefined;
    try {
      const values = JSON.parse(typeof query.key === "string" ? query.key : "null");
      if (Array.isArray(values) && values.length === 1 && Number.isInteger(values[0]) && values[0] >= -(2 ** 31) && values[0] <= 2 ** 31 - 1) id = values[0];
    } catch { /* Invalid legacy keys return to the scoped list. */ }
    redirect(id === undefined ? "/receipts" : `/receipts/${id}${query.edit === "1" ? "/edit" : ""}`);
  }
  return <WarehouseFrame><BackendDataView resource={resource} /></WarehouseFrame>;
}
