import type { PaymentDeadline } from "./types";

export function deadlineRemaining(deadline: PaymentDeadline, elapsedMs = 0): number {
  return Math.max(0, Date.parse(deadline.expires_at) - Date.parse(deadline.server_now) - elapsedMs);
}

export function deadlineBlocksPayment(deadline: PaymentDeadline | null | undefined, remaining: number): boolean {
  return Boolean(deadline && (deadline.status === "expired" || deadline.status === "processing_expiry" ||
    deadline.status === "awaiting_payment" && remaining <= 0));
}

export function validPaymentDeadline(value: unknown): value is PaymentDeadline | null | undefined {
  if (value === null || value === undefined) return true; // Historical invoices / older API fixtures.
  if (typeof value !== "object") return false;
  const d = value as PaymentDeadline;
  const timestamp = (v: unknown) => typeof v === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
  return timestamp(d.expires_at) && timestamp(d.server_now) && (d.expired_at === null || timestamp(d.expired_at)) &&
    ["awaiting_payment", "payment_received", "processing_expiry", "expired", "closed"].includes(d.status) &&
    (d.status !== "expired" || d.expired_at !== null);
}
