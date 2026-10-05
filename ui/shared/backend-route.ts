/** Shared server-only gateway: browser -> Next.js -> Python. No Supabase key here. */
type Context = { params: Promise<{ path: string[] }> };
const resources = new Set([
  "resources", "warehouses", "employees", "accounts", "customers", "categories", "products",
  "inventory", "suppliers", "receipts", "receipt-lines", "transfers", "transfer-lines", "orders",
  "order-lines", "invoices", "payments", "promotions", "vouchers", "voucher-uses",
]);

export async function proxyBackend(request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;
  const valid = path.length === 2 && (
    (path[0] === "auth" && ["login", "me", "logout"].includes(path[1])) ||
    (path[0] === "data" && resources.has(path[1]))
  );
  if (!valid) return Response.json({ detail: "Endpoint không tồn tại." }, { status: 404 });
  try {
    const base = new URL(process.env.PHUB_API_BASE_URL || "http://127.0.0.1:8000");
    if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid backend URL");
    const url = new URL(`${base.pathname.replace(/\/$/, "")}/api/${path.join("/")}`, base.origin);
    url.search = new URL(request.url).search;
    const headers = new Headers({ Accept: "application/json" });
    const cookie = request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith("phub_session="));
    if (cookie) headers.set("Cookie", cookie);
    const origin = request.headers.get("origin");
    if (origin) headers.set("Origin", origin); // Python validates CSRF origins, not the caller's supplied role.
    const write = request.method !== "GET" && request.method !== "HEAD";
    const body = write ? await request.text() : undefined;
    if (body && new TextEncoder().encode(body).length > 1_048_576) {
      return Response.json({ detail: "Dữ liệu quá lớn." }, { status: 413 });
    }
    if (write) headers.set("Content-Type", "application/json");
    const upstream = await fetch(url, {
      method: request.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    });
    const outputHeaders = new Headers({ "Cache-Control": "no-store" });
    if (upstream.headers.get("content-type")) outputHeaders.set("Content-Type", upstream.headers.get("content-type")!);
    for (const value of upstream.headers.getSetCookie()) outputHeaders.append("Set-Cookie", value);
    return new Response(upstream.status === 204 ? null : await upstream.text(), { status: upstream.status, headers: outputHeaders });
  } catch {
    return Response.json({ detail: "Không kết nối được backend Python. Kiểm tra server ở cổng 8000." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
