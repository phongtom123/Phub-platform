import AdminApp from "@/src/components/admin/admin-app";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminApp accountsPage={{ mode: "detail", id }} />;
}
