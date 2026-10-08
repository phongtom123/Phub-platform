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
    joined === "orders" ||
    (path[0] === "orders" && path.length === 2) ||
    (path[0] === "orders" &&
      path.length === 3 &&
      ["payments", "transactions", "invoice"].includes(path[2]));
  const validPost = joined === "checkout/quote" || joined === "orders" ||
    (path[0] === "orders" && path.length === 3 && ["payment-request", "demo-payment-state"].includes(path[2]));
  if (
    (request.method === "GET" && !validGet) ||
    (request.method === "POST" && !validPost) ||
    (request.method === "PUT" && joined !== "me")
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
  }
  try {
    const base = backendBaseUrl();
    const route =
      path.length === 3 && path[2] !== "invoice"
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
  } catch {
    return error(
      503,
      "DATA_SERVICE_UNAVAILABLE",
      "Không thể kết nối dịch vụ mua hàng. Nếu đã gửi đơn, hãy thử lại cùng lần đặt này.",
    );
  }
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
