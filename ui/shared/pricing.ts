export type TaxRule = { code: string; rate: string };
export type PriceInputs = { markup_rate?: string; taxes?: TaxRule[] };
export type Price = { unit_cost: string; markup_rate: string; profit: string; pre_tax: string; total_tax: string; after_tax: string;
  taxes: (TaxRule & { name: string; amount: string })[]; margin?: string | null; actual_markup?: string | null; changed_by?: string | null; changed_at?: string | null };
export type PricingContext = { sku: string | null; markup_rate: string; taxes: (TaxRule & { name: string })[]; raw_markup_rate: string | null;
  inherited_markup: boolean; inherited_taxes: boolean; current_price: string | null; can_edit: boolean; version: string;
  catalog: (TaxRule & { name: string; active: boolean })[]; history: { actor: string | null; changed_at: string; before_value: unknown; after_value: unknown }[] };
export type PricePreview = Price & { context: PricingContext; current_price: string; price_changed: boolean };
export type ReceiptPriceQuote = { receipt_id: number; status: string; applied?: boolean; version: string; lines: { sku: string; quantity: number; current_price: string; price: Price | null; changed_by?: string | null; changed_at?: string | null }[] };
export async function pricingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/pricing/${path}`, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 404 ? "Backend chưa có API định giá. Cần cập nhật backend/migration." :
    typeof body?.detail === "string" ? body.detail : Array.isArray(body?.detail) ? body.detail.map((e: { msg: string }) => e.msg).join("; ") : "Không xử lý được định giá.");
  if (!body || typeof body !== "object") throw new Error("API định giá trả kết quả không hợp lệ.");
  return body as T;
}
export function pricingMoney(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return "—";
  const fraction = (match[2] ?? "00").padEnd(2, "0");
  return `${BigInt(match[1]).toLocaleString("vi-VN")}${fraction === "00" ? "" : "," + fraction} ₫`;
}
export function confirmationMessage(quote: ReceiptPriceQuote) {
  if (quote.status !== "NHAP" || !quote.lines.length || quote.lines.some(line => !line.price)) throw new Error("Phiếu chưa sẵn sàng để định giá/xác nhận. Hãy làm mới.");
  return "Xác nhận nhập kho và cập nhật giá bán trước thuế?\n\n" + quote.lines.map(line =>
    `${line.sku}: ${pricingMoney(line.current_price)} → ${pricingMoney(line.price!.pre_tax)} (sau thuế: ${pricingMoney(line.price!.after_tax)})`).join("\n") +
    "\n\nGiá mới chỉ áp dụng khi backend xác nhận thành công. Giá sau thuế là giá dự kiến theo snapshot phiếu nhập.";
}
