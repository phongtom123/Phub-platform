/** Shared server-only gateway: browser -> Next.js -> Python. No Supabase key here. */
type Context = { params: Promise<{ path: string[] }> };
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function boundedImageBody(request: Request, limit: number): Promise<ArrayBuffer | null> {
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > limit) return null;
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); return null; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}
const resources = new Set([
  "resources", "warehouses", "employees", "accounts", "customers", "categories", "subcategories", "products",
  "inventory", "suppliers", "receipts", "receipt-lines", "transfers", "transfer-lines", "orders",
  "order-lines", "invoices", "payments", "promotions", "vouchers", "voucher-uses",
]);

function validAdminPath(path: string[], method: string): boolean {
  if (path[0] !== "admin") return false;
  if (path[1] === "operations") {
    if (path.length === 4 && path[2] === "read" && ["summary", "search", "notifications", "settings", "history", "messages"].includes(path[3])) return method === "GET";
    return path.length === 3 && ["orders", "receipts", "inventory", "settings", "notifications", "support"].includes(path[2]) && method === "POST";
  }
  if (path.length === 3 && path[1] === "warehouse-drafts" && path[2] === "receipts") return method === "PATCH";
  if (path.length === 3 && path[1] === "media" && path[2] === "images") return method === "POST";
  if (path.length === 5 && path[1] === "media" && path[2] === "products" && path[4] === "images") {
    return Boolean(path[3] && /^[A-Za-z0-9_.-]{1,200}$/.test(path[3]) && ![".", ".."].includes(path[3])) && ["GET", "PUT"].includes(method);
  }
  if (path.length === 2) {
    return (path[1] === "accounts" && ["GET", "POST"].includes(method)) ||
      (path[1] === "account-owners" && method === "GET") ||
      (path[1] === "me" && ["GET", "PATCH"].includes(method));
  }
  if (path.length === 3 && path[1] === "me") return path[2] === "password" && method === "POST";
  const id = path[2];
  if (path[1] !== "accounts" || !id || !/^[A-Za-z0-9_.-]{1,100}$/.test(id) || [".", ".."].includes(id)) return false;
  if (path.length === 3) return ["GET", "PATCH"].includes(method);
  return path.length === 4 && (
    (["status", "password"].includes(path[3]) && method === "POST") ||
    (path[3] === "role" && method === "PUT")
  );
}

function validIdentifier(value: string | undefined): boolean {
  return Boolean(value && /^[A-Za-z0-9_.-]{1,100}$/.test(value) && ![".", ".."].includes(value));
}

function validCustomerPath(path: string[], method: string): boolean {
  if (path[0] === "customer") {
    if (path[1] === "crm" && path[2] === "feedback") {
      if (path.length === 3) return ["GET", "POST"].includes(method);
      if (path.length === 5 && path[4] === "messages" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(path[3])) return ["GET", "POST"].includes(method);
      return path.length === 4 && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(path[3]) && method === "GET";
    }
    if (path.length === 2 && path[1] === "me") return ["GET", "PUT"].includes(method);
    if (path.length === 3 && path[1] === "me" && path[2] === "avatar") return method === "POST";
    if (path.length === 3 && path[1] === "checkout" && path[2] === "quote") return method === "POST";
    if (path[1] !== "orders") return false;
    if (path.length === 2) return ["GET", "POST"].includes(method);
    if (!validIdentifier(path[2])) return false;
    if (path.length === 3) return method === "GET";
    return path.length === 4 && path[3] === "invoice" && method === "GET";
  }
  if (path[0] !== "orders") return false;
  if (path.length === 1) return method === "POST";
  if (!validIdentifier(path[1]) || path.length !== 3) return false;
  if (["payments", "transactions"].includes(path[2])) return method === "GET";
  return path[2] === "payment-request" && method === "POST";
}

function validAuthPath(path: string[], method: string): boolean {
  if (path.length !== 2 || path[0] !== "auth") return false;
  if (["login", "register", "logout"].includes(path[1])) return method === "POST";
  return path[1] === "me" && method === "GET";
}

function validCrmPath(path: string[], method: string): boolean {
  if (path[0] === "crm" && path[1] === "feedback") {
    if (path.length === 2) return method === "GET";
    return path.length === 3 && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(path[2]) && ["GET", "PATCH"].includes(method);
  }
  if (path[0] !== "crm" || path[1] !== "customers" || !path[2] ||
    !/^[A-Za-z0-9_.-]{1,200}$/.test(path[2]) || [".", ".."].includes(path[2])) return false;
  if (path.length === 3) return ["GET", "PATCH"].includes(method);
  return path.length === 4 && path[3] === "orders" && method === "GET";
}

export async function proxyBackend(request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;
  const valid = validAdminPath(path, request.method) || validCustomerPath(path, request.method) || validCrmPath(path, request.method) ||
    validAuthPath(path, request.method) ||
    (path.length === 2 && path[0] === "data" && resources.has(path[1]));
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
    const operationKey = request.headers.get("Idempotency-Key");
    if (operationKey) headers.set("Idempotency-Key", operationKey);
    const write = request.method !== "GET" && request.method !== "HEAD";
    const imageUpload = path.length === 3 && ["admin/media/images", "customer/me/avatar"].includes(path.join("/"));
    const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (imageUpload && !imageTypes.has(contentType)) {
      return Response.json({ detail: "Chỉ hỗ trợ JPG, PNG hoặc WebP." }, { status: 415 });
    }
    const body = imageUpload ? await boundedImageBody(request, 5 * 1024 * 1024) : write ? await request.text() : undefined;
    if (body === null || (typeof body === "string" && new TextEncoder().encode(body).length > 1_048_576)) {
      return Response.json({ detail: "Dữ liệu quá lớn." }, { status: 413 });
    }
    if (write) headers.set("Content-Type", imageUpload ? contentType : "application/json");
    const upstream = await fetch(url, {
      method: request.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(imageUpload ? 30_000 : 15_000),
    });
    const outputHeaders = new Headers({ "Cache-Control": "no-store" });
    if (upstream.headers.get("content-type")) outputHeaders.set("Content-Type", upstream.headers.get("content-type")!);
    for (const value of upstream.headers.getSetCookie()) outputHeaders.append("Set-Cookie", value);
    return new Response(upstream.status === 204 ? null : await upstream.text(), { status: upstream.status, headers: outputHeaders });
  } catch {
    return Response.json({ detail: "Không kết nối được API. Kiểm tra PHUB_API_BASE_URL và trạng thái backend." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
