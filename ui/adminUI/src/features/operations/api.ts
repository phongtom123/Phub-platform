import { adminFetch } from "../../lib/admin-fetch";

export async function operationRead<T>(
  kind: string,
  query: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const response = await adminFetch(
    `/api/backend/admin/operations/read/${kind}?${new URLSearchParams(query)}`,
    { cache: "no-store", signal },
  );
  return unwrap<T>(response);
}

export class OperationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function unwrap<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new OperationError(
      typeof body?.detail === "string"
        ? body.detail
        : Array.isArray(body?.detail)
          ? body.detail.map((v: { msg: string }) => v.msg).join("; ")
          : "Không xử lý được yêu cầu.",
      response.status,
    );
  return body as T;
}

/** Keep this request object on failure: a timed-out write may already be committed. */
export function pendingCommand(
  resource: string,
  action: string,
  recordId: string | null,
  data: Record<string, unknown>,
  status?: string,
) {
  return {
    resource,
    key: crypto.randomUUID(),
    body: JSON.stringify({
      action,
      record_id: recordId,
      expected_status: status ?? null,
      data,
    }),
  };
}
export type PendingCommand = ReturnType<typeof pendingCommand>;
export async function sendCommand<
  T = { data: Record<string, unknown>[]; replayed: boolean },
>(command: PendingCommand): Promise<T> {
  const result = await unwrap<{
    data: Record<string, unknown>[];
    replayed: boolean;
  }>(
    await adminFetch(`/api/backend/admin/operations/${command.resource}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": command.key,
      },
      body: command.body,
    }),
  );
  if (
    !result ||
    !Array.isArray(result.data) ||
    result.data.length !== 1 ||
    !result.data[0] ||
    typeof result.data[0] !== "object" ||
    typeof result.replayed !== "boolean"
  )
    throw new Error(
      "API chưa xác nhận đúng kết quả. Thử lại cùng yêu cầu để tránh ghi lặp.",
    );
  return result as T;
}
