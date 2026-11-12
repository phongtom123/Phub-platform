/** Shared browser client for the backend-owned JWT session. */
export type UserRole = "ADMIN" | "NHAN_VIEN" | "KHACH_HANG";

export type SessionUser = {
  account_id: string;
  username: string;
  role: UserRole;
  name: string;
  customer_id: string | null;
  employee_id: string | null;
  warehouse_id: number | null;
};

export type CustomerRegistration = {
  name: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
};

export const AUTH_SESSION_EVENT = "phub-auth-session";

function announceSession(user: SessionUser | null): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SessionUser | null>(AUTH_SESSION_EVENT, { detail: user }));
  }
}

export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthRequestError";
  }
}

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return typeof user.account_id === "string" && typeof user.username === "string" &&
    typeof user.name === "string" && ["ADMIN", "NHAN_VIEN", "KHACH_HANG"].includes(String(user.role));
}

async function responseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return response.json();
}

/** Vietnamese text for FastAPI field errors that carry no message of our own. */
const FIELD_MESSAGES: Record<string, string> = {
  name: "Vui lòng nhập họ và tên (ít nhất 2 ký tự).",
  username: "Tên tài khoản cần ít nhất 3 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.",
  email: "Email không đúng định dạng.",
  phone: "Số điện thoại không đúng định dạng.",
  password: "Mật khẩu cần ít nhất 10 ký tự.",
};
const VALUE_ERROR = "Value error, ";

function validationMessages(detail: unknown): string[] {
  if (!Array.isArray(detail)) return [];
  const messages = detail.map(item => {
    if (!item || typeof item !== "object") return "";
    const { loc, msg } = item as { loc?: unknown; msg?: unknown };
    if (typeof msg === "string" && msg.startsWith(VALUE_ERROR)) return msg.slice(VALUE_ERROR.length);
    const field = Array.isArray(loc) && loc.length ? String(loc[loc.length - 1]) : "";
    return FIELD_MESSAGES[field] ?? "";
  }).filter(Boolean);
  return Array.from(new Set(messages));
}

function errorMessage(body: unknown, fallback: string): string {
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
  if (typeof detail === "string") return detail;
  const messages = validationMessages(detail);
  return messages.length ? messages.join(" ") : fallback;
}

async function sessionRequest(url: string, init?: RequestInit,
  fallback = "Không xác thực được phiên đăng nhập."): Promise<SessionUser> {
  const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin" });
  const body = await responseBody(response);
  if (!response.ok) {
    throw new AuthRequestError(errorMessage(body, fallback), response.status);
  }
  if (!isSessionUser(body)) throw new AuthRequestError("Phản hồi phiên đăng nhập không hợp lệ.", 502);
  return body;
}

export function getSession(signal?: AbortSignal): Promise<SessionUser> {
  return sessionRequest("/api/backend/auth/me", { signal });
}

export async function loginSession(username: string, password: string): Promise<SessionUser> {
  const user = await sessionRequest("/api/backend/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  announceSession(user);
  return user;
}

/** linked_orders: walk-in counter orders with the same email attached during registration. */
export type RegisteredCustomer = SessionUser & { linked_orders: number };

export async function registerCustomer(input: CustomerRegistration): Promise<RegisteredCustomer> {
  const user = await sessionRequest("/api/backend/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name.trim(),
      username: input.username.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      password: input.password,
    }),
  }, "Không tạo được tài khoản. Kiểm tra lại thông tin và thử lại.");
  announceSession(user);
  const linked = (user as { linked_orders?: unknown }).linked_orders;
  return { ...user, linked_orders: typeof linked === "number" && Number.isInteger(linked) && linked > 0 ? linked : 0 };
}

export async function logoutSession(): Promise<void> {
  const response = await fetch("/api/backend/auth/logout", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = await responseBody(response);
    throw new AuthRequestError(errorMessage(body, "Không đăng xuất được."), response.status);
  }
  announceSession(null);
}
