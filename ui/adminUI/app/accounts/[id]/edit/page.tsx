import { redirect } from "next/navigation";
import { accountHref } from "@/src/features/accounts/types";

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(accountHref(id, true));
}
