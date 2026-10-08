export class AccountApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function accountApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/admin/${path}`, { ...options, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail)
      ? detail.map((issue: { loc?: (string | number)[]; msg: string }) => `${issue.loc?.slice(1).join(".") || "Dữ liệu"}: ${issue.msg}`).join("; ")
      : response.status === 404 ? "API tài khoản chưa có trên server. Kiểm tra bản deploy backend." : "Không xử lý được yêu cầu tài khoản.";
    throw new AccountApiError(message, response.status);
  }
  return body as T;
}

export const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Không kết nối được API.";
