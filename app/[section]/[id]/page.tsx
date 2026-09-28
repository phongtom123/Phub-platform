import DetailView from "@/src/features/details/detail-view";
import WarehouseFrame from "@/src/components/warehouse/warehouse-frame";
import FormView from "@/src/features/forms/form-view";

export default async function RecordPage({ params }: { params: Promise<{ section: string; id: string }> }) {
  const { section, id } = await params;
  if (id === "new") return <WarehouseFrame><FormView section={section}/></WarehouseFrame>;
  return <WarehouseFrame><DetailView section={section} id={id}/></WarehouseFrame>;
}
