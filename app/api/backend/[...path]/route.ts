type Context = { params: Promise<{ path: string[] }> };

const resources = new Set([
  "resources", "warehouses", "employees", "accounts", "customers", "categories", "products",
  "inventory", "stock-movements", "suppliers", "receipts", "receipt-lines", "transfers", "transfer-lines", "orders",
  "order-lines", "invoices", "payments", "promotions", "vouchers", "voucher-uses",
]);

function allowed(path: string[], method: string) {
  return path.length === 2 && (
    (path[0] === "auth" && ["login", "me", "logout"].includes(path[1])) ||
    (path[0] === "data" && resources.has(path[1])) ||
    (path[0] === "warehouse" && ["options", "dispatches"].includes(path[1]) && method === "GET")
  ) || (path.length === 4 && path[0] === "warehouse" && method === "POST" &&
    ((path[1] === "receipts" && ["confirm", "cancel"].includes(path[3])) ||
     (path[1] === "transfers" && ["dispatch", "receive", "cancel"].includes(path[3])) ||
     (path[1] === "dispatches" && path[3] === "dispatch"))) ||
    (path.length === 4 && path[0] === "warehouse" && method === "PUT" &&
      ((path[1] === "receipts" && path[3] === "draft") || (path[1] === "transfers" && path[3] === "draft"))) ||
    (path.length === 3 && path[0] === "warehouse" && path[2] === "draft" && method === "POST" &&
      ["receipts", "transfers"].includes(path[1]));
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
