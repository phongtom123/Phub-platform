import { notFound, redirect } from "next/navigation";
import AdminApp from "@/src/components/admin/admin-app";
import { recordHref } from "../../../../shared/record-navigation";

export default async function DetailRoute({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  if (id === "new" && ["receipts", "transfers"].includes(section)) return <AdminApp />;
  const href = recordHref(section, id);
  if (!href) notFound();
  redirect(href);
}
