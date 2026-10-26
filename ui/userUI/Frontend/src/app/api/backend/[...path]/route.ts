import { proxyBackend } from "../../../../../../../shared/backend-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = proxyBackend;
export const POST = proxyBackend;
export const PATCH = proxyBackend;
