/** Shared browser client for the backend-owned JWT session. */
export type UserRole = "ADMIN" | "NHAN_VIEN_KHO" | "KHACH_HANG";

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
    typeof user.name === "string" && ["ADMIN", "NHAN_VIEN_KHO", "KHACH_HANG"].includes(String(user.role));
}

async function responseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return response.json();
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && typeof (body as { detail?: unknown }).detail === "string") {
    return (body as { detail: string }).detail;
  }
  return fallback;
}

async function sessionRequest(url: string, init?: RequestInit): Promise<SessionUser> {
  const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin" });
  const body = await responseBody(response);
  if (!response.ok) {
    throw new AuthRequestError(errorMessage(body, "Không xác thực được phiên đăng nhập."), response.status);
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

export async function registerCustomer(input: CustomerRegistration): Promise<SessionUser> {
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
  });
  announceSession(user);
  return user;
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
