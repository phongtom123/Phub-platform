import AdminApp from "@/src/components/admin/admin-app";
import { redirect } from "next/navigation";

export default async function DataPage({ params, searchParams }: { params: Promise<{ resource: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { resource } = await params;
  if (resource === "accounts") {
    const query = await searchParams;
    let target = query.new === "1" ? "/accounts/new" : "/accounts";
    if (typeof query.key === "string") {
      try {
        const keys = JSON.parse(query.key);
        if (Array.isArray(keys) && keys.length === 1 && typeof keys[0] === "string") target = `/accounts/${encodeURIComponent(keys[0])}${query.edit === "1" ? "/edit" : ""}`;
      } catch { /* Invalid legacy key returns to the account list. */ }
    }
    redirect(target);
  }
  return <AdminApp dataResource={resource} />;
}
