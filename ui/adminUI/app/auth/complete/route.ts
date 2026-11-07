import { completePortalSession } from "../../../../shared/portal-session";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return completePortalSession(request, { role: "ADMIN", loginUrl: process.env.NEXT_PUBLIC_WAREHOUSE_URL ?? "http://localhost:3002" });
}
