import FormView from "@/src/features/forms/form-view";
import WarehouseFrame from "@/src/components/warehouse/warehouse-frame";

export default function NewInvoicePage() {
  return (
    <WarehouseFrame>
      <FormView section="invoices" />
    </WarehouseFrame>
  );
}
