// Identity comes from the backend session, never a customer ID supplied by this client.
export type Recipient = { name: string; phone: string; address_line: string; province: string; ward: string };
export type CustomerProfile = { customer_id: string; name: string; phone: string | null; address_line: string | null; province: string | null; ward: string | null };
export type Pagination = { page: number; page_size: number; total: number; total_pages: number };
export type OrderSummary = { id: string; status: string; created_at: string; currency: string; total: string };
export type OrderPage = { items: OrderSummary[]; pagination: Pagination };
export type OrderLine = { sku: string; name: string; unit: string; quantity: number; unit_price: string; discount: string; tax_amount: string; line_total: string };
export type OrderDetail = OrderSummary & { recipient: { [K in keyof Recipient]: string | null }; note: string | null; items: OrderLine[] };
export type InvoiceOverview = { order_id: string; currency: string; invoice: { issued_at: string; discount_total: string; subtotal: string; tax_total: string; total: string } | null; items: OrderLine[] };
export type Transaction = { type: string; method: string; amount: string; status: string; occurred_at: string | null; message: string };
export type PaymentOverview = { order_id: string; currency: string; latest_transaction: Transaction | null; message: string };
export type TransactionPage = { order_id: string; currency: string; items: Transaction[]; pagination: Pagination };

export class AccountApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function accountRequest<T>(path: string, parse: (value: unknown) => T, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, { ...options, cache: "no-store", credentials: "same-origin" });
  let body;
  try { body = await response.json(); }
  catch { throw new AccountApiError("API trả về dữ liệu không hợp lệ. Vui lòng thử lại.", response.ok ? 502 : response.status); }
  if (!response.ok) {
    const message = response.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : response.status === 403 ? "Tài khoản không có quyền truy cập dữ liệu khách hàng này."
      : typeof body?.error?.message === "string" ? body.error.message
      : typeof body?.detail === "string" ? body.detail
      : response.status === 422 ? "Thông tin chưa hợp lệ. Kiểm tra lại các trường và thử lại."
      : "Không thể tải dữ liệu. Vui lòng thử lại.";
    throw new AccountApiError(message, response.status);
  }
  try { return parse(body); }
  catch { throw new AccountApiError("Dữ liệu API không đúng định dạng. Vui lòng thử lại.", 502); }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
  return value as Record<string, unknown>;
}
function check(condition: boolean) { if (!condition) throw new Error("Invalid response"); }
const text = (value: unknown) => typeof value === "string";
const nullableText = (value: unknown) => value === null || text(value);
const money = (value: unknown) => typeof value === "string" && /^\d+(\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value));
const currency = (value: unknown) => typeof value === "string" && /^[A-Z]{3}$/.test(value);
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
function pagination(value: unknown) {
  const p = object(value);
  check([p.page, p.page_size, p.total, p.total_pages].every(Number.isInteger) && Number(p.page) > 0 && Number(p.page_size) > 0 && Number(p.total) >= 0 && Number(p.total_pages) >= 0);
}
function order(value: unknown) {
  const o = object(value);
  check(text(o.id) && text(o.status) && date(o.created_at) && currency(o.currency) && money(o.total));
}
function lines(value: unknown) {
  check(Array.isArray(value));
  for (const item of value as unknown[]) {
    const line = object(item);
    check([line.sku, line.name, line.unit].every(text) && Number.isInteger(line.quantity) && Number(line.quantity) > 0
      && [line.unit_price, line.discount, line.tax_amount, line.line_total].every(money));
  }
}
function transaction(value: unknown) {
  const t = object(value);
  check([t.type, t.method, t.status, t.message].every(text) && money(t.amount) && (t.occurred_at === null || date(t.occurred_at)));
}
export function parseProfile(value: unknown): CustomerProfile {
  const p = object(value);
  check(text(p.customer_id) && text(p.name) && [p.phone, p.address_line, p.province, p.ward].every(nullableText));
  return value as CustomerProfile;
}
export function parseOrders(value: unknown): OrderPage {
  const p = object(value); pagination(p.pagination); check(Array.isArray(p.items));
  (p.items as unknown[]).forEach(order);
  return value as OrderPage;
}
export function parseOrder(value: unknown): OrderDetail {
  order(value); const o = object(value); lines(o.items); const r = object(o.recipient);
  check([r.name, r.phone, r.address_line, r.province, r.ward, o.note].every(nullableText));
  return value as OrderDetail;
}
export function parseInvoice(value: unknown): InvoiceOverview {
  const p = object(value); check(text(p.order_id) && currency(p.currency)); lines(p.items);
  if (p.invoice !== null) {
    const i = object(p.invoice);
    check(date(i.issued_at) && [i.discount_total, i.subtotal, i.tax_total, i.total].every(money));
  }
  return value as InvoiceOverview;
}
export function parsePayment(value: unknown): PaymentOverview {
  const p = object(value); check(text(p.order_id) && currency(p.currency) && text(p.message));
  if (p.latest_transaction !== null) transaction(p.latest_transaction);
  return value as PaymentOverview;
}
export function parseTransactions(value: unknown): TransactionPage {
  const p = object(value); check(text(p.order_id) && currency(p.currency)); pagination(p.pagination);
  check(Array.isArray(p.items)); (p.items as unknown[]).forEach(transaction);
  return value as TransactionPage;
}
export const orderStatus: Record<string, string> = { MOI: "Mới đặt", XAC_NHAN: "Đã xác nhận", DANG_CHUAN_BI: "Đang chuẩn bị", DA_XUAT_KHO: "Đã xuất kho", HOAN_THANH: "Hoàn thành", HUY: "Đã hủy", UNKNOWN: "Chưa xác định" };
export const paymentStatus: Record<string, string> = { pending: "Chờ xử lý", succeeded: "Thành công", failed: "Thất bại", unknown: "Chưa xác định" };
export const paymentMethod: Record<string, string> = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", card: "Thẻ", e_wallet: "Ví điện tử", unknown: "Chưa xác định" };
export function formatMoney(value: string, unit: string) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: unit }).format(Number(value)); }
export function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "Chưa có thông tin"; }
