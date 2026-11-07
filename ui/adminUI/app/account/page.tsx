import AdminApp from "@internal/components/admin/admin-app";

export default function MyAccountPage() {
  return <AdminApp accountsPage={{ mode: "self" }} />;
}
