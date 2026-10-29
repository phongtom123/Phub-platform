/** Cross-domain staff login uses a one-use POST code, never a JWT in a URL. */
export async function enterStaffPortal(targetUrl: string, signal?: AbortSignal): Promise<void> {
  const target = new URL(targetUrl);
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) {
    throw new Error("Địa chỉ cổng nội bộ không hợp lệ.");
  }
  const response = await fetch("/api/backend/auth/handoff", {
    method: "POST", credentials: "same-origin", cache: "no-store", signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_origin: target.origin }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !/^[A-Za-z0-9_-]{43}$/.test(body?.code ?? "")) {
    throw new Error(typeof body?.detail === "string" ? body.detail : "Không chuyển được phiên đăng nhập. Hãy thử lại.");
  }
  if (signal?.aborted) return;
  const form = document.createElement("form");
  form.method = "POST";
  form.action = new URL("/auth/complete", target.origin).href;
  form.hidden = true;
  const code = document.createElement("input");
  code.type = "hidden"; code.name = "code"; code.value = body.code;
  form.appendChild(code);
  document.body.appendChild(form);
  form.submit();
}
