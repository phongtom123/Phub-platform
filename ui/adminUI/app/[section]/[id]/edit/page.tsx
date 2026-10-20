import { notFound, redirect } from "next/navigation";
import { recordHref } from "../../../../../shared/record-navigation";
import AdminApp from "@/src/components/admin/admin-app";

export default async function EditRoute({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  if (["receipts", "transfers"].includes(section) && /^\d+$/.test(id)) return <AdminApp />;
  const href = recordHref(section, id, true);
  if (!href) notFound();
  redirect(href);
}
