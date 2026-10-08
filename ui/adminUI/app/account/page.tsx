import AdminApp from "@/src/components/admin/admin-app";

export default function MyAccountPage() {
  return <AdminApp accountsPage={{ mode: "self" }} />;
}
