import { backendBaseUrl } from "@/lib/server/backend";

const MAX_BODY = 65536;
function error(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message, details: [] } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function forward(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (
    !path.every(
      (part) =>
        part &&
        part.length <= 100 &&
        part !== "." &&
        part !== ".." &&
        !/[\\/\x00-\x1f\x7f]/.test(part),
    )
  )
    return error(404, "NOT_FOUND", "Không tìm thấy tài nguyên.");
  const joined = path.join("/");
  const validGet =
    joined === "me" ||
    joined === "addresses" ||
    joined === "orders" ||
    (path[0] === "orders" && path.length === 2) ||
    (path[0] === "orders" &&
      path.length === 3 &&
      ["payments", "transactions", "invoice"].includes(path[2]));
  const isAddressItem = path[0] === "addresses" && path.length === 2;
  // Address deletion uses POST .../delete because the public API forbids HTTP DELETE.
  const isAddressDelete = path[0] === "addresses" && path.length === 3 && path[2] === "delete";
  const isOrderCancel = path[0] === "orders" && path.length === 3 && path[2] === "cancel";
  const validPost = joined === "checkout/quote" || joined === "orders" || joined === "addresses" || isAddressDelete || isOrderCancel ||
    (path[0] === "orders" && path.length === 3 && ["payment-request", "demo-payment-state"].includes(path[2]));
  if (
    (request.method === "GET" && !validGet) ||
    (request.method === "POST" && !validPost) ||
    (request.method === "PUT" && joined !== "me" && !isAddressItem)
  )
    return error(404, "NOT_FOUND", "Không tìm thấy tài nguyên.");
  const headers = new Headers();
  for (const name of ["authorization", "cookie", "idempotency-key"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let body: string | undefined;
  if (request.method === "POST" || request.method === "PUT") {
    const origin = request.headers.get("origin");
    // Next may construct request.url with an internal host. Match the public
    // Host instead; deployments behind a proxy can pin PHUB_UI_ORIGIN.
    const expectedOrigin =
      process.env.PHUB_UI_ORIGIN ||
      `${new URL(request.url).protocol}//${request.headers.get("host")}`;
    if (
      (origin && origin !== expectedOrigin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return error(403, "ACCESS_DENIED", "Yêu cầu mua hàng không hợp lệ.");
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return error(422, "VALIDATION_ERROR", "Nội dung yêu cầu phải là JSON.");
    const reader = request.body?.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    textLoop: {
      body = "";
      if (!reader) break textLoop;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > MAX_BODY) {
            await reader.cancel();
            return error(
              413,
              "PAYLOAD_TOO_LARGE",
              "Yêu cầu vượt kích thước cho phép.",
            );
          }
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
        JSON.parse(body);
      } catch {
        return error(422, "VALIDATION_ERROR", "Nội dung JSON không hợp lệ.");
      }
    }
    headers.set("Content-Type", "application/json");
    headers.set("Origin", origin || expectedOrigin);
  }
  try {
    const base = backendBaseUrl();
    const route =
      path[0] === "orders" && path.length === 3 && !["invoice", "cancel"].includes(path[2])
        ? `/api/orders/${encodeURIComponent(path[1])}/${path[2]}`
        : `/api/customer/${path.map(encodeURIComponent).join("/")}`;
    const url = new URL(base.pathname.replace(/\/$/, "") + route, base.origin);
    url.search = new URL(request.url).search;
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    const value = await upstream.json();
    if (
      !upstream.ok &&
      (!value?.error ||
        typeof value.error.code !== "string" ||
        typeof value.error.message !== "string")
    )
      return error(502, "INVALID_RESPONSE", "Không thể đọc phản hồi mua hàng.");
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    const replayed = upstream.headers.get("Idempotency-Replayed");
    if (replayed) responseHeaders.set("Idempotency-Replayed", replayed);
    if (upstream.headers.get("X-Shopping-Test-Mode") === "fixtures")
      responseHeaders.set("X-Shopping-Test-Mode", "fixtures");
    return Response.json(value, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (reason) {
    const failure = reason as { name?: string; cause?: { code?: string } };
    const code = failure?.cause?.code || failure?.name || "UNKNOWN";
    // Diagnostic only: never log cookies, authorization, request bodies or customer IDs.
    console.error("[customer-api] upstream unavailable", { method: request.method, resource: path[0], code });
    const detail = ["ENOTFOUND", "EAI_AGAIN"].includes(code)
      ? "Không phân giải được địa chỉ API mua hàng. Kiểm tra kết nối mạng hoặc DNS."
      : ["TimeoutError", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(code)
        ? "API mua hàng phản hồi quá chậm. Vui lòng thử lại."
        : "Không thể kết nối dịch vụ mua hàng. Vui lòng thử lại.";
    return error(
      503,
      "DATA_SERVICE_UNAVAILABLE",
      detail + (request.method === "POST" && path[0] === "orders"
        ? " Nếu đã gửi yêu cầu, hãy thử lại cùng lần này để tránh tạo trùng."
        : ""),
    );
  }
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
