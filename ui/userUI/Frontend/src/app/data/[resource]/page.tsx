import BackendDataView from "@/components/BackendDataView";

export default async function DataPage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  return <main className="mx-auto max-w-7xl px-6 py-10"><BackendDataView resource={resource} /></main>;
}
