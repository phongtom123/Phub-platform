import { notFound } from "next/navigation";
import WarehouseFrame from "@/src/components/warehouse/warehouse-frame";
import ReceiptForm from "@/src/features/receipts/receipt-form";

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^-?(0|[1-9]\d*)$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < -(2 ** 31) || Number(id) > 2 ** 31 - 1) notFound();
  return <WarehouseFrame><ReceiptForm key={id} id={Number(id)} /></WarehouseFrame>;
}
