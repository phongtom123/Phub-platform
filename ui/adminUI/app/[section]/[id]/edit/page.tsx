import EditView from "@/src/features/details/edit-view";

export default async function EditRoute({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  return <EditView section={section} id={decodeURIComponent(id)} />;
}
