export class WarehouseApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function warehouseApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, { ...options, credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    throw new WarehouseApiError(typeof detail === "string" ? detail : Array.isArray(detail)
      ? detail.map((issue: { msg: string }) => issue.msg).join("; ") : "Không xử lý được yêu cầu. Vui lòng thử lại.", response.status);
  }
  return body as T;
}

export const receiptStatus: Record<string, string> = { NHAP: "Nháp", DA_NHAP: "Đã nhập", HUY: "Đã hủy" };
export function displayDate(value?: string | null) {
  if (!value) return "—";
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(normalized));
}
export function cents(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole || "0") * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}
export function displayMoney(value: bigint) {
  const sign = value < BigInt(0) ? "-" : "";
  const positive = value < BigInt(0) ? -value : value;
  return `${sign}${(positive / BigInt(100)).toLocaleString("vi-VN")}${positive % BigInt(100) ? `,${String(positive % BigInt(100)).padStart(2, "0")}` : ""} ₫`;
}

/** Preserve the same key when a user retries a request with an unknown outcome. */
export function operationKey(previous: { body: string; key: string } | null, body: string) {
  return previous?.body === body ? previous : { body, key: crypto.randomUUID() };
}
