import DetailView from "@/src/features/details/detail-view";
import WarehouseFrame from "@/src/components/warehouse/warehouse-frame";

export default async function EditRecordPage({ params }: { params: Promise<{ section: string; id: string }> }) {
  const { section, id } = await params;
  return <WarehouseFrame><DetailView section={section} id={id} edit/></WarehouseFrame>;
}
