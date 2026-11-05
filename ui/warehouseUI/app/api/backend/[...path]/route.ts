type Context = { params: Promise<{ path: string[] }> };

const resources = new Set([
  "resources", "warehouses", "employees", "accounts", "customers", "categories", "products",
  "inventory", "stock-movements", "suppliers", "receipts", "receipt-lines", "transfers", "transfer-lines", "orders",
  "order-lines", "invoices", "payments", "promotions", "vouchers", "voucher-uses",
]);

function allowed(path: string[], method: string) {
  const base = path[0] === "warehouse";
  if (path.length === 2) return (path[0] === "auth" && ["login", "me", "logout"].includes(path[1])) || (path[0] === "data" && resources.has(path[1])) || (base && ["options", "dispatches", "invoices"].includes(path[1]) && method === "GET");
  if (path.length === 3 && path[0] === "auth" && path[1] === "me" && path[2] === "password") return method === "POST";
  if (path.length === 3 && base && path[2] === "draft") return method === "POST" && ["receipts", "transfers", "dispatches"].includes(path[1]);
  if (path.length === 3 && base && path[1] === "invoices" && path[2] === "customer-search") return method === "GET";
  if (path.length === 3 && base && path[1] === "invoices") return method === "GET";
  if (path.length === 4 && base && path[1] === "dispatches" && path[3] === "draft") return method === "GET" || method === "PUT";
  if (path.length === 4 && base && path[1] === "receipts" && path[3] === "draft") return method === "PUT";
  if (path.length === 4 && base && path[1] === "transfers" && path[3] === "draft") return method === "PUT";
  if (path.length === 4 && base && method === "POST") return (path[1] === "receipts" && ["confirm", "cancel"].includes(path[3])) || (path[1] === "transfers" && ["dispatch", "receive", "cancel"].includes(path[3])) || (path[1] === "dispatches" && ["dispatch", "confirm"].includes(path[3]));
  return false;
}

async function proxyBackend(request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;
  if (!allowed(path, request.method)) return Response.json({ detail: "Endpoint không tồn tại." }, { status: 404 });
  try {
    const base = new URL(process.env.PHUB_API_BASE_URL || "http://127.0.0.1:8000");
    if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid backend URL");
    const url = new URL(`${base.pathname.replace(/\/$/, "")}/api/${path.join("/")}`, base.origin);
    url.search = new URL(request.url).search;
    const headers = new Headers({ Accept: "application/json" });
    const cookie = request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith("phub_session="));
    if (cookie) headers.set("Cookie", cookie);
    const origin = request.headers.get("origin");
    if (origin) headers.set("Origin", origin);
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    const write = request.method !== "GET" && request.method !== "HEAD";
    const body = write ? await request.text() : undefined;
    if (body && new TextEncoder().encode(body).length > 1_048_576) return Response.json({ detail: "Dữ liệu quá lớn." }, { status: 413 });
    if (write) headers.set("Content-Type", "application/json");
    const upstream = await fetch(url, { method: request.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
    const outputHeaders = new Headers({ "Cache-Control": "no-store" });
    if (upstream.headers.get("content-type")) outputHeaders.set("Content-Type", upstream.headers.get("content-type")!);
    for (const value of upstream.headers.getSetCookie()) outputHeaders.append("Set-Cookie", value);
    return new Response(upstream.status === 204 ? null : await upstream.text(), { status: upstream.status, headers: outputHeaders });
  } catch {
    return Response.json({ detail: "Không kết nối được API. Kiểm tra PHUB_API_BASE_URL và trạng thái backend." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = proxyBackend;
export const POST = proxyBackend;
export const PUT = proxyBackend;
export const PATCH = proxyBackend;
