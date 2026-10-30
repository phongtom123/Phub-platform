import { adminFetch } from "@/src/lib/admin-fetch";
import { vietnamDay } from "../dashboard/dashboard-data";
export type ProductProfit = { sku: string; name: string; quantity: number; net_revenue: string; cost: string | null; gross_profit: string | null; margin: string | null; unpriced_lines: number };
export type BusinessReport = {
  warehouse_id: 2; start: string; end: string; method: "MOVING_WEIGHTED_AVERAGE"; basis: "COMPLETED_ORDERS";
  net_revenue: string; tax: string; discounts: string; gross_revenue: string; collected: string; refunds: string;
  cost: string | null; known_cost: string; gross_profit: string | null; margin: string | null;
  order_count: number; quantity: number; costed_lines: number; total_lines: number;
  warnings: ("INCOMPLETE_COST_HISTORY" | "UNALLOCATED_REFUNDS")[]; products: ProductProfit[];
  daily: { day: string; net_revenue: string; gross_profit: string | null }[];
};

export type ReportRange = { start: string; end: string };
const dayMs = 86_400_000;
function dayNumber(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}
export function rangeError(range: ReportRange): string {
  const start = dayNumber(range.start), end = dayNumber(range.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "Vui lòng chọn ngày bắt đầu và kết thúc hợp lệ.";
  if (start > end) return "Ngày bắt đầu không được sau ngày kết thúc.";
  if ((end - start) / dayMs >= 366) return "Mỗi báo cáo tối đa 366 ngày. Hãy chọn khoảng ngắn hơn.";
  return "";
}
export function recentRange(days: number, now = new Date()): ReportRange {
  const end = vietnamDay(now)!;
  return { start: new Date(dayNumber(end) - (days - 1) * dayMs).toISOString().slice(0, 10), end };
}
const money = (value: unknown): value is string => typeof value === "string" && /^-?\d+(?:\.\d{1,2})?$/.test(value);
const optionalMoney = (value: unknown) => value === null || money(value);
export const reportWarnings = {
  INCOMPLETE_COST_HISTORY: "Kho 2 còn dòng hàng chưa xác định được giá vốn: cần đối chiếu tồn đầu kỳ, lịch sử nhập/xuất, điều chỉnh hoặc chứng từ chuyển kho cũ. Không gán giá vốn bằng 0.",
  UNALLOCATED_REFUNDS: "Có hoàn tiền chưa phân bổ về hàng trả lại và thuế. Doanh thu hiển thị là sau giảm giá, trước phân bổ hoàn tiền; chưa xác định lợi nhuận sau hoàn tiền.",
};
export async function readReport(range: ReportRange, signal: AbortSignal): Promise<BusinessReport> {
  const invalid = rangeError(range);
  if (invalid) throw new Error(invalid);
  const response = await adminFetch(`/api/backend/admin/operations/business-report?${new URLSearchParams(range)}`, { signal, cache: "no-store" });
  const result: BusinessReport = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 404 ? "Backend chưa có API báo cáo lợi nhuận. Cần cập nhật backend mới." : typeof (result as unknown as { detail?: string })?.detail === "string" ? (result as unknown as { detail: string }).detail : "Không tải được báo cáo kinh doanh.");
  if (!result || result.warehouse_id !== 2 || result.start !== range.start || result.end !== range.end || result.method !== "MOVING_WEIGHTED_AVERAGE" || result.basis !== "COMPLETED_ORDERS" ||
    ![result.net_revenue, result.tax, result.discounts, result.gross_revenue, result.collected, result.refunds, result.known_cost].every(money) ||
    ![result.cost, result.gross_profit, result.margin].every(optionalMoney) ||
    ![result.order_count, result.quantity, result.costed_lines, result.total_lines].every(value => Number.isSafeInteger(value) && value >= 0) || result.costed_lines > result.total_lines ||
    !Array.isArray(result.warnings) || result.warnings.some(warning => typeof warning !== "string" || !Object.hasOwn(reportWarnings, warning)) ||
    !Array.isArray(result.products) || result.products.some(row => !row || typeof row.sku !== "string" || typeof row.name !== "string" || !money(row.net_revenue) ||
      ![row.cost, row.gross_profit, row.margin].every(optionalMoney) || !Number.isSafeInteger(row.quantity) || row.quantity < 0 || !Number.isSafeInteger(row.unpriced_lines) || row.unpriced_lines < 0) ||
    !Array.isArray(result.daily) || result.daily.length !== (dayNumber(range.end) - dayNumber(range.start)) / dayMs + 1 ||
    result.daily.some((row, index) => row.day !== new Date(dayNumber(range.start) + index * dayMs).toISOString().slice(0, 10) || !money(row.net_revenue) || !optionalMoney(row.gross_profit)) ||
    (result.costed_lines < result.total_lines && result.cost !== null) ||
    (result.warnings.length > 0 && (result.gross_profit !== null || result.margin !== null))) {
    throw new Error("API chưa xác nhận đúng kỳ báo cáo hoặc trả số liệu không hợp lệ. Không hiển thị số liệu thay thế.");
  }
  return result;
}

export function reportCsv(report: BusinessReport): string {
  const rows: unknown[][] = [
    ["Báo cáo kinh doanh", report.start, report.end], ["Kho cố định", report.warehouse_id], ["Phương pháp", "Bình quân gia quyền liên hoàn"], ["Ghi nhận", "Đơn hoàn thành; chưa thuế; sau giảm giá"],
    ["Lưu ý", ...report.warnings.map(warning => reportWarnings[warning])],
    ["Doanh thu sau giảm giá, trước phân bổ hoàn tiền", report.net_revenue], ["Thuế", report.tax], ["Giá trị gồm thuế", report.gross_revenue],
    ["Giá vốn", report.cost ?? "Chưa đủ dữ liệu"], ["Lợi nhuận gộp", report.gross_profit ?? "Chưa đủ dữ liệu"], ["Biên lợi nhuận gộp (%)", report.margin ?? "Không xác định"],
    ["Thu trừ hoàn trong kỳ, đơn chỉ thuộc kho 2", report.collected], ["Hoàn tiền trong kỳ, đơn chỉ thuộc kho 2", report.refunds],
    [], ["SKU", "Sản phẩm", "Số lượng", "Doanh thu chưa thuế", "Giá vốn", "Lợi nhuận gộp", "Biên lợi nhuận (%)", "Dòng chưa đủ giá vốn"],
    ...report.products.map(row => [row.sku, row.name, row.quantity, row.net_revenue, row.cost ?? "Chưa đủ dữ liệu", row.gross_profit ?? "Chưa đủ dữ liệu", row.margin ?? "Không xác định", row.unpriced_lines]),
    [], ["Ngày hoàn thành", "Doanh thu chưa thuế", "Lợi nhuận gộp"], ...report.daily.map(row => [row.day, row.net_revenue, row.gross_profit ?? "Chưa đủ dữ liệu"]),
  ];
  const cell = (value: unknown) => { const text = String(value ?? ""); return '"' + (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"'; };
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
}
