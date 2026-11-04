import { completePortalSession } from "../../../../shared/portal-session";

export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return completePortalSession(request, {
    role: "NHAN_VIEN",
    loginUrl: process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000",
  });
}
