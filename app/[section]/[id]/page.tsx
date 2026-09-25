import DetailView from "../../detail-view";

export default async function DetailRoute({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  return <DetailView section={section} id={decodeURIComponent(id)} />;
}
