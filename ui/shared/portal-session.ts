/** Server-only callbacks shared by the independent staff portals. */
type PortalOptions = { role: "ADMIN" | "NHAN_VIEN"; loginUrl: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function failure(message: string, loginUrl: string, status: number) {
  const retry = new URL("/auth/logout", loginUrl).href;
  return new Response(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Đăng nhập PHUB</title><body style="font-family:system-ui;max-width:600px;margin:12vh auto;padding:24px"><h1>Chưa chuyển được phiên đăng nhập</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(retry)}">Đăng nhập lại</a></body></html>`, {
    status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function destinationOrigin(request: Request) {
  const url = new URL(request.url);
  // Render terminates TLS before Next. Only the exact, code-bound origin is accepted by the API.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (!/^(https|http)$/.test(protocol) || /[\/\\?#@,\s]/.test(host)) throw new Error("Invalid portal origin");
  return new URL(`${protocol}://${host}`).origin;
}

export async function completePortalSession(request: Request, options: PortalOptions): Promise<Response> {
  const source = request.headers.get("origin");
  if (request.method !== "POST" || source !== new URL(options.loginUrl).origin) {
    return failure("Hãy bắt đầu từ trang đăng nhập chung.", options.loginUrl, 403);
  }
  try {
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
      return failure("Yêu cầu chuyển phiên không hợp lệ.", options.loginUrl, 400);
    }
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 4096) { await reader.cancel(); return failure("Yêu cầu chuyển phiên quá lớn.", options.loginUrl, 413); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const fields = new URLSearchParams(new TextDecoder().decode(bytes));
    const code = fields.get("code");
    if (fields.getAll("code").length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(code ?? "")) {
      return failure("Mã chuyển phiên không hợp lệ.", options.loginUrl, 400);
    }
    const base = new URL(process.env.PHUB_API_BASE_URL || "http://127.0.0.1:8000");
    if (!["https:", "http:"].includes(base.protocol)) throw new Error("Invalid backend");
    const upstream = await fetch(new URL(`${base.pathname.replace(/\/$/, "")}/api/auth/handoff/exchange`, base.origin), {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", Origin: source },
      body: JSON.stringify({ code, target_origin: destinationOrigin(request), role: options.role }),
    });
    const body = await upstream.json().catch(() => null);
    if (!upstream.ok) return failure(typeof body?.detail === "string" ? body.detail : "Không đổi được mã chuyển phiên.", options.loginUrl, upstream.status);
    const cookies = upstream.headers.getSetCookie();
    if (body?.role !== options.role || !cookies.some(cookie => cookie.startsWith("phub_session="))) throw new Error("Invalid handoff response");
    const headers = new Headers({ Location: "/", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    for (const cookie of cookies) headers.append("Set-Cookie", cookie);
    return new Response(null, { status: 303, headers });
  } catch {
    return failure("Không kết nối được API chuyển phiên. Hãy thử đăng nhập lại.", options.loginUrl, 503);
  }
}

export function clearPortalSession(request: Request): Response {
  const secure = (request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.slice(0, -1)) === "https";
  return new Response(null, { status: 303, headers: {
    Location: "/", "Cache-Control": "no-store",
    "Set-Cookie": `phub_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`,
  } });
}
