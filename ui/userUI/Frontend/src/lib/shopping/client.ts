import { cents } from "./money";
import type {
  CustomerProfile,
  OrderDetail,
  OrderPage,
  OrderRequest,
  Payments,
  Quote,
  Receipt,
  Recipient,
  PaymentMethod,
  InvoiceOverview,
  TransactionPage,
} from "./types";

let authorizationReader: (() => string | null) | null = null;

// Optional bridge for the team's existing bearer session. Cookie sessions work
// with credentials=same-origin. This module never logs or persists credentials.
export function configureShoppingAuthorization(reader: () => string | null) {
  authorizationReader = reader;
  window.dispatchEvent(new Event("phub:session-changed"));
}

export class ShoppingError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

function invalid(): never {
  throw new ShoppingError(
    "Dữ liệu mua hàng không hợp lệ. Vui lòng thử lại.",
    502,
    "INVALID_RESPONSE",
  );
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  return value as Record<string, unknown>;
}
function amount(value: unknown): string {
  if (typeof value !== "string") return invalid();
  try {
    cents(value);
  } catch {
    return invalid();
  }
  return value;
}
function currency(value: unknown) {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) invalid();
}
function pagination(value: unknown) {
  const p = record(value);
  if (
    ![p.page, p.page_size, p.total, p.total_pages].every(
      (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0,
    ) ||
    Number(p.page) < 1 ||
    Number(p.page) > 1000000 ||
    Number(p.page_size) < 1 ||
    Number(p.page_size) > 100 ||
    Number(p.total_pages) !== Math.ceil(Number(p.total) / Number(p.page_size))
  )
    invalid();
}
function recipient(value: unknown, nullable = false) {
  const r = record(value);
  for (const key of ["name", "phone", "address_line", "province", "ward"])
    if (!(nullable && r[key] === null) && typeof r[key] !== "string") invalid();
}

export async function shoppingRequest<T>(
  path: string,
  options: RequestInit = {},
  validate?: (value: unknown) => T,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const authorization = authorizationReader?.();
  if (authorization) {
    if (authorization.length > 10000 || /[\r\n\x00]/.test(authorization))
      invalid();
    headers.set("Authorization", authorization);
  }
  let response: Response;
  try {
    response = await fetch(`/api/customer/${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ShoppingError(
      "Không thể kết nối. Nếu đã gửi đơn, hãy thử lại cùng lần đặt này.",
      503,
      "NETWORK_ERROR",
    );
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    return invalid();
  }
  if (!response.ok) {
    const error = record(record(value).error);
    const code = typeof error.code === "string" ? error.code : "REQUEST_ERROR";
    let message =
      typeof error.message === "string"
        ? error.message
        : "Không thể xử lý yêu cầu. Vui lòng thử lại.";
    if (
      [
        "AUTH_INTEGRATION_REQUIRED",
        "CHECKOUT_DATABASE_NOT_READY",
        "ORDER_DATABASE_NOT_READY",
        "PAYMENT_SCHEMA_NOT_READY",
      ].includes(code)
    )
      message = "Chức năng mua hàng hiện chưa sẵn sàng. Vui lòng thử lại sau.";
    throw new ShoppingError(message, response.status, code);
  }
  if (path === "me" && response.headers.get("X-Shopping-Test-Mode") === "fixtures")
    value = { ...record(value), demo_mode: true };
  return validate ? validate(value) : (value as T);
}

export function validateProfile(value: unknown): CustomerProfile {
  const p = record(value);
  if (
    typeof p.customer_id !== "string" ||
    !p.customer_id ||
    typeof p.name !== "string"
  )
    invalid();
  for (const key of ["phone", "address_line", "province", "ward"])
    if (p[key] !== null && typeof p[key] !== "string") invalid();
  return p as unknown as CustomerProfile;
}

export function validateQuote(value: unknown): Quote {
  const q = record(value);
  currency(q.currency);
  if (
    q.tax_application !== "invoice" ||
    q.shipping_status !== "not_quoted" ||
    !(q.voucher_code === null || typeof q.voucher_code === "string") ||
    !Array.isArray(q.items) ||
    !q.items.length ||
    q.items.length > 100
  )
    invalid();
  let gross = BigInt(0),
    discount = BigInt(0),
    total = BigInt(0);
  const skus = new Set<string>();
  for (const raw of q.items as unknown[]) {
    const line = record(raw);
    if (
      typeof line.sku !== "string" ||
      skus.has(line.sku) ||
      !line.sku ||
      typeof line.name !== "string" ||
      typeof line.unit !== "string" ||
      !Number.isInteger(line.warehouse_id) ||
      !Number.isInteger(line.quantity) ||
      Number(line.quantity) < 1 ||
      Number(line.quantity) > 1000
    )
      invalid();
    skus.add(line.sku as string);
    const lineGross = cents(amount(line.gross_total)),
      lineDiscount = cents(amount(line.discount)),
      lineTotal = cents(amount(line.line_total));
    if (
      cents(amount(line.unit_price)) * BigInt(Number(line.quantity)) !==
        lineGross ||
      lineDiscount > lineGross ||
      lineTotal !== lineGross - lineDiscount ||
      cents(amount(line.tax_amount)) !== BigInt(0) ||
      line.tax_rate !== "10.00"
    )
      invalid();
    gross += lineGross;
    discount += lineDiscount;
    total += lineTotal;
  }
  if (
    cents(amount(q.subtotal)) !== gross ||
    cents(amount(q.discount_total)) !== discount ||
    cents(amount(q.tax_total)) !== BigInt(0) ||
    cents(amount(q.total)) !== total ||
    total !== gross - discount
  )
    invalid();
  return q as unknown as Quote;
}

export function validateReceipt(value: unknown): Receipt {
  validateQuote(value);
  const r = record(value);
  if (
    typeof r.id !== "string" ||
    !r.id ||
    r.status !== "MOI" ||
    r.sales_channel !== "ONLINE" ||
    typeof r.created_at !== "string" ||
    !(r.note === null || typeof r.note === "string")
  )
    invalid();
  recipient(r.recipient);
  return r as unknown as Receipt;
}

function validateSummary(value: unknown) {
  const order = record(value);
  if (
    typeof order.id !== "string" ||
    !order.id ||
    ![
      "MOI",
      "XAC_NHAN",
      "DANG_CHUAN_BI",
      "DA_XUAT_KHO",
      "HOAN_THANH",
      "HUY",
      "UNKNOWN",
    ].includes(String(order.status)) ||
    typeof order.created_at !== "string"
  )
    invalid();
  currency(order.currency);
  amount(order.total);
}
export function validateOrders(value: unknown): OrderPage {
  const p = record(value);
  if (!Array.isArray(p.items)) invalid();
  (p.items as unknown[]).forEach(validateSummary);
  pagination(p.pagination);
  return p as unknown as OrderPage;
}
export function validateOrder(value: unknown): OrderDetail {
  validateSummary(value);
  const o = record(value);
  recipient(o.recipient, true);
  if (
    !Array.isArray(o.items) ||
    !(o.note === null || typeof o.note === "string")
  )
    invalid();
  let total = BigInt(0);
  for (const item of o.items as unknown[]) {
    const line = record(item);
    if (
      typeof line.sku !== "string" ||
      typeof line.name !== "string" ||
      typeof line.unit !== "string" ||
      !Number.isSafeInteger(line.warehouse_id) ||
      !Number.isSafeInteger(line.quantity) ||
      Number(line.quantity) < 1
    )
      invalid();
    amount(line.unit_price);
    amount(line.discount);
    amount(line.tax_amount);
    total += cents(amount(line.line_total));
  }
  if (total !== cents(amount(o.total))) invalid();
  return o as unknown as OrderDetail;
}
function validateTransaction(value: unknown) {
  const t = record(value);
  amount(t.amount);
  if (
    !["collection", "refund", "unknown"].includes(String(t.type)) ||
    !["cash", "bank_transfer", "card", "e_wallet", "unknown"].includes(
      String(t.method),
    ) ||
    !["pending", "succeeded", "failed", "unknown"].includes(String(t.status)) ||
    !(t.occurred_at === null || typeof t.occurred_at === "string") ||
    typeof t.message !== "string"
  )
    invalid();
}
export function validatePayments(value: unknown): Payments {
  const p = record(value);
  currency(p.currency);
  if (typeof p.order_id !== "string" || typeof p.message !== "string")
    invalid();
  if (p.latest_transaction !== null) validateTransaction(p.latest_transaction);
  return p as unknown as Payments;
}
export function validateTransactions(value: unknown): TransactionPage {
  const p = record(value);
  currency(p.currency);
  if (typeof p.order_id !== "string" || !Array.isArray(p.items)) invalid();
  (p.items as unknown[]).forEach(validateTransaction);
  pagination(p.pagination);
  return p as unknown as TransactionPage;
}

export const getProfile = () => shoppingRequest("me", {}, validateProfile);
export const requestPayment = (orderId: string, method: PaymentMethod, key: string) => shoppingRequest(
  `orders/${encodeURIComponent(orderId)}/payment-request`,
  { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ method }) }, validatePayments,
);

export function validateInvoice(value: unknown): InvoiceOverview {
  const result = record(value);
  if (typeof result.order_id !== "string" || !Array.isArray(result.items)) invalid();
  currency(result.currency);
  if (result.invoice !== null) {
    const invoice = record(result.invoice);
    if (typeof invoice.issued_at !== "string") invalid();
    for (const key of ["discount_total", "subtotal", "tax_total", "total"]) amount(invoice[key]);
  }
  for (const item of result.items as unknown[]) {
    const line = record(item);
    if (typeof line.name !== "string" || typeof line.unit !== "string" || typeof line.sku !== "string" ||
        !Number.isSafeInteger(line.quantity) || Number(line.quantity) < 1) invalid();
    for (const key of ["unit_price", "discount", "tax_amount", "line_total"]) amount(line[key]);
  }
  return result as unknown as InvoiceOverview;
}
export const saveProfile = (recipient: Recipient) => shoppingRequest(
  "me", { method: "PUT", body: JSON.stringify(recipient) }, validateProfile,
);
export const getQuote = (
  items: { sku: string; quantity: number }[],
  voucher_code: string | null,
  signal?: AbortSignal,
) =>
  shoppingRequest(
    "checkout/quote",
    { method: "POST", body: JSON.stringify({ items, voucher_code }), signal },
    validateQuote,
  );
export const createOrder = (body: OrderRequest, key: string) =>
  shoppingRequest(
    "orders",
    {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    },
    validateReceipt,
  );
