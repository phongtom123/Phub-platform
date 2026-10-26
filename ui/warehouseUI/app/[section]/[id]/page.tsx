import { notFound, redirect } from "next/navigation";
import { recordHref } from "../../../../shared/record-navigation";
import WarehouseApp from "@warehouse/src/components/warehouse/warehouse-app";

export default async function RecordPage({ params }: { params: Promise<{ section: string; id: string }> }) {
  const { section, id } = await params;
  if (id === "new" && (section === "receipts" || section === "transfers")) return <WarehouseApp />;
  const href = recordHref(section, id);
  if (!href) notFound();
  redirect(href);
}
