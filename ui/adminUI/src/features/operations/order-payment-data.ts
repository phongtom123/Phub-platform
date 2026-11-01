import { adminFetch } from "../../lib/admin-fetch";

export const paymentMethods = {
  TIEN_MAT: "Tiền mặt", CHUYEN_KHOAN: "Chuyển khoản", THE: "Thẻ", VI_DIEN_TU: "Ví điện tử",
} as const;
export type PaymentMethod = keyof typeof paymentMethods;
type Row = Record<string, unknown>;
type Page = { data: Row[]; total: number; order_id: string };
const hundred = BigInt(100), zero = BigInt(0);

/** Exact decimal arithmetic: never round an invoice balance through Number. */
export function moneyCents(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d{1,16}(?:\.\d{1,2})?$/.test(value)) throw new Error("Số tiền của đơn hàng không hợp lệ. Hãy tải lại thông tin thanh toán.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * hundred + BigInt(fraction.padEnd(2, "0"));
}
export function moneyDecimal(value: bigint) {
  return `${value / hundred}.${String(value % hundred).padStart(2, "0")}`;
}

async function readPage(resource: "invoices" | "payments", orderId: string, page: number, signal: AbortSignal): Promise<Page> {
  const params = new URLSearchParams({ order_id: orderId, page: String(page), page_size: "100" });
  const response = await adminFetch(`/api/backend/data/${resource}?${params}`, { signal, cache: "reload" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được thông tin thanh toán của đơn hàng.");
  if (!body || body.order_id !== orderId || !Array.isArray(body.data) || !Number.isSafeInteger(body.total) || body.total < 0 || body.data.length > 100 ||
    body.data.some((row: Row) => !row || row.ma_donhang !== orderId)) throw new Error("API chưa trả đúng dữ liệu thanh toán của đơn hàng. Hãy tải lại.");
  return body as Page;
}

async function readPayments(orderId: string, signal: AbortSignal) {
  const first = await readPage("payments", orderId, 1, signal);
  if (first.total > 5000) throw new Error("Đơn có quá nhiều giao dịch để tự tính tại biểu mẫu này. Hãy kiểm tra lịch sử thanh toán.");
  const rows = [...first.data];
  for (let page = 2; rows.length < first.total; page++) {
    if (!rows.length) throw new Error("Lịch sử thanh toán chưa đầy đủ. Hãy tải lại.");
    const next = await readPage("payments", orderId, page, signal);
    if (next.total !== first.total || !next.data.length) throw new Error("Lịch sử thanh toán vừa thay đổi. Hãy tải lại để lấy số còn phải thu.");
    rows.push(...next.data);
  }
  const keys = rows.map(row => String(row.ma_thanh_toan ?? ""));
  if (rows.length !== first.total || keys.some(key => !key) || new Set(keys).size !== rows.length) throw new Error("Lịch sử thanh toán chưa đầy đủ hoặc bị trùng. Hãy tải lại.");
  return rows;
}

export type OrderPaymentContext = {
  invoiceId: string | null; total: string | null; collected: string; refunded: string; paid: string;
  remaining: string | null; suggestedMethod: PaymentMethod | null;
};

export async function readOrderPaymentContext(orderId: string, signal: AbortSignal): Promise<OrderPaymentContext> {
  const [invoicePage, payments] = await Promise.all([readPage("invoices", orderId, 1, signal), readPayments(orderId, signal)]);
  if (invoicePage.total > 1 || invoicePage.data.length !== invoicePage.total) throw new Error("Không xác định được hóa đơn duy nhất của đơn hàng.");
  let collected = zero, refunded = zero;
  for (const row of payments) {
    if (!["CHO_XU_LY", "THANH_CONG", "THAT_BAI"].includes(String(row.trang_thai))) throw new Error("Có giao dịch chưa xác định trạng thái. Hãy kiểm tra lịch sử thanh toán.");
    if (row.trang_thai !== "THANH_CONG") continue;
    const amount = moneyCents(row.so_tien);
    if (row.loai_giao_dich === "THU") collected += amount;
    else if (row.loai_giao_dich === "HOAN_TIEN") refunded += amount;
    else throw new Error("Có giao dịch chưa xác định loại thu/hoàn tiền.");
  }
  const paid = collected - refunded;
  if (paid < zero) throw new Error("Tiền đã hoàn vượt số đã thu. Hãy đối chiếu lịch sử thanh toán trước khi thu thêm.");
  // A saved pending choice is a suggestion, never evidence of successful payment.
  const candidates = payments.filter(row => row.loai_giao_dich === "THU" && ["CHO_XU_LY", "THANH_CONG"].includes(String(row.trang_thai)) && Object.hasOwn(paymentMethods, String(row.phuong_thuc)));
  candidates.sort((a, b) => {
    const pending = Number(b.trang_thai === "CHO_XU_LY") - Number(a.trang_thai === "CHO_XU_LY");
    const date = (row: Row) => Date.parse(String(row.thoi_gian ?? "")) || 0;
    return pending || date(b) - date(a) || Number(b.ma_thanh_toan) - Number(a.ma_thanh_toan);
  });
  const invoice = invoicePage.data[0];
  const total = invoice ? moneyCents(invoice.tong_tien_sau_thue) : null;
  if (invoice && (typeof invoice.ma_hoadon !== "string" || !invoice.ma_hoadon)) throw new Error("Hóa đơn không hợp lệ. Hãy tải lại thông tin đơn hàng.");
  return {
    invoiceId: invoice ? String(invoice.ma_hoadon) : null, total: total === null ? null : moneyDecimal(total),
    collected: moneyDecimal(collected), refunded: moneyDecimal(refunded), paid: moneyDecimal(paid),
    remaining: total === null ? null : moneyDecimal(total > paid ? total - paid : zero),
    suggestedMethod: candidates.length ? candidates[0].phuong_thuc as PaymentMethod : null,
  };
}
