import { notFound, redirect } from "next/navigation";
import { recordHref } from "../../../../shared/record-navigation";

export default async function DetailRoute({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  const href = recordHref(section, id);
  if (!href) notFound();
  redirect(href);
}
