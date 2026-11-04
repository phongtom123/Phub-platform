import { OrderView } from "@/components/shopping/OrderView";
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderView id={id} />;
}
