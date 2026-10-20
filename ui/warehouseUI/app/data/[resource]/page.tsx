import WarehouseFrame from "@/src/components/warehouse/warehouse-frame";
import BackendDataView from "@/src/components/backend-data-view";

export default async function DataPage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  return <WarehouseFrame><BackendDataView resource={resource} /></WarehouseFrame>;
}
