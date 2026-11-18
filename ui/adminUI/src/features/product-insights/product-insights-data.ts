import { adminFetch } from "@internal/lib/admin-fetch";
import { vietnamDay } from "../dashboard/dashboard-data";

export type InsightsPeriod = "month" | "quarter" | "year";
export type RangePreset = "all" | "30d" | "90d" | "365d";
export type InsightsRange = { start: string | null; end: string | null };

export type ProductSummary = {
  total_products: number;
  active_products: number;
  paused_products: number;
  hidden_products: number;
  total_categories: number;
  physical_units: number;
  held_units: number;
  available_units: number;
  out_of_stock_products: number;
  low_stock_products: number;
  low_stock_threshold: number;
  inventory_value: string;
};

export type InvoiceSummary = {
  total_invoices: number;
  valid_invoices: number;
  cancelled_invoices: number;
  total_amount: string;
  pre_tax_amount: string;
  tax_amount: string;
  discount_amount: string;
  avg_invoice_value: string;
  collected_amount: string;
  outstanding_amount: string;
  paid_invoices: number;
  partial_invoices: number;
  unpaid_invoices: number;
  items_sold: number;
};

export type BreakdownItem = { key: string; label: string; count: number; amount: string; percentage: number; amount_percentage: number };
export type InvoiceTimelinePoint = { period: string; label: string; invoice_count: number; pre_tax: string; tax: string; total: string; collected: string; items_sold: number };
export type CategoryStat = { category_id: string; category_name: string; product_count: number; available_units: number; inventory_value: string; quantity_sold: number; revenue: string; revenue_percentage: number };
export type ProductSalesItem = { sku: string; name: string; category_name: string; brand: string | null; price: string; quantity_sold: number; revenue: string; available_units: number; held_units: number };
export type PriceRangeItem = { key: string; label: string; count: number; percentage: number; categories: CategoryStat[] };
export type BrandStat = { brand: string; product_count: number; quantity_sold: number; revenue: string; revenue_percentage: number; categories: CategoryStat[] };

export type ProductInvoiceReport = {
  range: { start: string | null; end: string | null; period_type: InsightsPeriod };
  product_summary: ProductSummary;
  invoice_summary: InvoiceSummary;
  invoice_status: BreakdownItem[];
  payment_methods: BreakdownItem[];
  sales_channels: BreakdownItem[];
  invoice_sources: BreakdownItem[];
  timeline: InvoiceTimelinePoint[];
  categories: CategoryStat[];
  top_products: ProductSalesItem[];
  slow_products: ProductSalesItem[];
  low_stock_products: ProductSalesItem[];
  price_ranges: PriceRangeItem[];
  top_brands: BrandStat[];
};

export const PRESET_LABELS: Record<RangePreset, string> = { all: "Toàn thời gian", "30d": "30 ngày", "90d": "90 ngày", "365d": "12 tháng" };
const PRESET_DAYS: Record<Exclude<RangePreset, "all">, number> = { "30d": 30, "90d": 90, "365d": 365 };

export function presetRange(preset: RangePreset, now = new Date()): InsightsRange {
  if (preset === "all") return { start: null, end: null };
  const end = vietnamDay(now)!;
  const start = new Date(Date.parse(end + "T00:00:00Z") - (PRESET_DAYS[preset] - 1) * 86_400_000).toISOString().slice(0, 10);
  return { start, end };
}

export function formatVND(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0 đ";
  return Math.round(num).toLocaleString("vi-VN") + " đ";
}

export function formatNumber(value: number): string {
  return value.toLocaleString("vi-VN");
}

const money = (value: unknown): value is string => typeof value === "string" && /^-?\d+(?:\.\d{1,2})?$/.test(value);
const count = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const share = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
const list = (value: unknown, valid: (row: Record<string, unknown>) => boolean) =>
  Array.isArray(value) && value.every(row => row !== null && typeof row === "object" && valid(row as Record<string, unknown>));
const breakdownRow = (row: Record<string, unknown>) => typeof row.key === "string" && typeof row.label === "string" && count(row.count) && money(row.amount) && share(row.percentage) && share(row.amount_percentage);
const categoryRow = (row: Record<string, unknown>) => typeof row.category_id === "string" && typeof row.category_name === "string" &&
  count(row.product_count) && count(row.available_units) && count(row.quantity_sold) && money(row.inventory_value) && money(row.revenue) &&
  share(row.revenue_percentage);
const sumOf = (rows: unknown, key: string) => (rows as Record<string, number>[]).reduce((total, row) => total + row[key], 0);
const productRow = (row: Record<string, unknown>) => typeof row.sku === "string" && typeof row.name === "string" && typeof row.category_name === "string" &&
  money(row.price) && money(row.revenue) && count(row.quantity_sold) && count(row.available_units) && count(row.held_units);

/** Rejects a response that does not describe the requested range/period, so stale or partial data is never shown. */
export function validReport(report: unknown, period: InsightsPeriod, range: InsightsRange): report is ProductInvoiceReport {
  const r = report as ProductInvoiceReport | null;
  if (!r || typeof r !== "object" || !r.range || r.range.period_type !== period || r.range.start !== range.start || r.range.end !== range.end) return false;
  const p = r.product_summary, i = r.invoice_summary;
  if (!p || !i) return false;
  return [p.total_products, p.active_products, p.paused_products, p.hidden_products, p.total_categories, p.physical_units, p.held_units, p.available_units,
    p.out_of_stock_products, p.low_stock_products, p.low_stock_threshold, i.total_invoices, i.valid_invoices, i.cancelled_invoices, i.paid_invoices,
    i.partial_invoices, i.unpaid_invoices, i.items_sold].every(count) &&
    p.available_units + p.held_units === p.physical_units &&
    i.valid_invoices + i.cancelled_invoices === i.total_invoices &&
    i.paid_invoices + i.partial_invoices + i.unpaid_invoices === i.valid_invoices &&
    [p.inventory_value, i.total_amount, i.pre_tax_amount, i.tax_amount, i.discount_amount, i.avg_invoice_value, i.collected_amount, i.outstanding_amount].every(money) &&
    [r.invoice_status, r.payment_methods, r.sales_channels, r.invoice_sources].every(rows => list(rows, breakdownRow)) &&
    list(r.timeline, row => typeof row.period === "string" && typeof row.label === "string" && count(row.invoice_count) && count(row.items_sold) &&
      [row.pre_tax, row.tax, row.total, row.collected].every(money)) &&
    list(r.categories, categoryRow) &&
    [r.top_products, r.slow_products, r.low_stock_products].every(rows => list(rows, productRow)) &&
    // Each segment carries its own category breakdown, which must add up to the segment's row.
    list(r.price_ranges, row => typeof row.key === "string" && typeof row.label === "string" && count(row.count) && share(row.percentage) &&
      list(row.categories, categoryRow) && sumOf(row.categories, "product_count") === row.count) &&
    list(r.top_brands, row => typeof row.brand === "string" && count(row.product_count) && count(row.quantity_sold) && money(row.revenue) &&
      share(row.revenue_percentage) && list(row.categories, categoryRow) && sumOf(row.categories, "quantity_sold") === row.quantity_sold);
}

export async function fetchProductInsights(period: InsightsPeriod, range: InsightsRange, signal?: AbortSignal): Promise<ProductInvoiceReport> {
  const params = new URLSearchParams({ period });
  if (range.start) params.set("start", range.start);
  if (range.end) params.set("end", range.end);
  const response = await adminFetch(`/api/backend/crm/analytics/product-invoice-insights?${params}`, { signal, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(response.status === 404 ? "Backend chưa có API thống kê sản phẩm & hóa đơn. Cần cập nhật backend mới."
      : typeof body?.detail === "string" ? body.detail : "Không thể tải thống kê sản phẩm & hóa đơn.");
  }
  if (!validReport(body, period, range)) throw new Error("API trả về thống kê không khớp kỳ đã chọn hoặc số liệu không hợp lệ. Vui lòng thử lại.");
  return body;
}

export type ProductSalesPoint = { period: string; label: string; quantity: number; revenue: string; invoice_count: number };
export type ProductSalesReport = {
  sku: string;
  name: string;
  category_name: string;
  brand: string | null;
  price: string | null;
  status: number | null;
  range: { start: string | null; end: string | null; period_type: InsightsPeriod };
  summary: { quantity_sold: number; revenue: string; invoice_count: number; avg_unit_price: string; physical_units: number; held_units: number; available_units: number };
  timeline: ProductSalesPoint[];
  channels: { key: string; label: string; quantity: number; revenue: string }[];
  warehouses: { warehouse_id: number; name: string; physical_units: number; held_units: number; available_units: number; quantity_sold: number }[];
};

export function validProductSales(report: unknown, sku: string, period: InsightsPeriod, range: InsightsRange): report is ProductSalesReport {
  const r = report as ProductSalesReport | null;
  if (!r || typeof r !== "object" || r.sku !== sku || !r.range || r.range.period_type !== period || r.range.start !== range.start || r.range.end !== range.end) return false;
  const s = r.summary;
  return typeof r.name === "string" && typeof r.category_name === "string" && (r.brand === null || typeof r.brand === "string") &&
    (r.price === null || money(r.price)) && (r.status === null || Number.isSafeInteger(r.status)) && Boolean(s) &&
    [s.quantity_sold, s.invoice_count, s.physical_units, s.held_units, s.available_units].every(count) &&
    s.available_units + s.held_units === s.physical_units && money(s.revenue) && money(s.avg_unit_price) &&
    list(r.timeline, row => typeof row.period === "string" && typeof row.label === "string" && count(row.quantity) && count(row.invoice_count) && money(row.revenue)) &&
    list(r.channels, row => typeof row.key === "string" && typeof row.label === "string" && count(row.quantity) && money(row.revenue)) &&
    list(r.warehouses, row => Number.isSafeInteger(row.warehouse_id) && typeof row.name === "string" && count(row.physical_units) &&
      count(row.held_units) && count(row.available_units) && count(row.quantity_sold));
}

export async function fetchProductSales(sku: string, period: InsightsPeriod, range: InsightsRange, signal?: AbortSignal): Promise<ProductSalesReport> {
  const params = new URLSearchParams({ sku, period });
  if (range.start) params.set("start", range.start);
  if (range.end) params.set("end", range.end);
  const response = await adminFetch(`/api/backend/crm/analytics/product-sales?${params}`, { signal, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof body?.detail === "string" ? body.detail : response.status === 404 ? "Không tìm thấy sản phẩm." : "Không thể tải biểu đồ sản phẩm.");
  }
  if (!validProductSales(body, sku, period, range)) throw new Error("API trả về dữ liệu sản phẩm không khớp hoặc không hợp lệ. Vui lòng thử lại.");
  return body;
}

/** Short axis label: "2026-09" → "T9/26", "2026-Q3" → "Q3/26", "2026" → "2026". */
export function shortPeriod(period: string): string {
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) return `T${Number(month[2])}/${month[1].slice(2)}`;
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period);
  if (quarter) return `Q${quarter[2]}/${quarter[1].slice(2)}`;
  return period;
}

/** Compact VND for axis ticks: 1.250.000.000 → "1,25 tỷ", 45.000.000 → "45 tr". */
export function compactVND(value: number): string {
  const format = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  if (Math.abs(value) >= 1e9) return `${format(value / 1e9)} tỷ`;
  if (Math.abs(value) >= 1e6) return `${format(value / 1e6)} tr`;
  if (Math.abs(value) >= 1e3) return `${format(value / 1e3)} k`;
  return format(value);
}

export type StockView = "products" | "stock" | "low" | "value" | "sales";
export type StockStatus = "ACTIVE" | "PAUSED" | "HIDDEN" | "ALL";
export type StockQuery = { view: StockView; status: StockStatus; category: string | null; q: string | null; page: number; pageSize: number };
export type StockListItem = {
  sku: string; name: string; category_id: string; category_name: string; brand: string | null; price: string; status: number;
  physical_units: number; held_units: number; available_units: number; inventory_value: string; value_percentage: number; quantity_sold: number; revenue: string;
};
export type ProductStockList = {
  view: StockView; status: StockStatus; category: string | null; q: string | null; start: string | null; end: string | null;
  page: number; page_size: number; total: number; low_stock_threshold: number;
  totals: { products: number; physical_units: number; held_units: number; available_units: number; inventory_value: string };
  warehouses: { warehouse_id: number; name: string; physical_units: number; held_units: number; available_units: number }[];
  categories: { category_id: string; category_name: string }[];
  items: StockListItem[];
};

/** Each summary tile opens its list with the filter that reproduces the tile's number. */
export const STOCK_VIEW_DEFAULT_STATUS: Record<StockView, StockStatus> = { products: "ACTIVE", stock: "ALL", low: "ACTIVE", value: "ACTIVE", sales: "ALL" };

export function validStockList(body: unknown, query: StockQuery, range: InsightsRange): body is ProductStockList {
  const r = body as ProductStockList | null;
  if (!r || typeof r !== "object" || r.view !== query.view || r.status !== query.status || r.category !== query.category ||
    r.q !== query.q || r.page !== query.page || r.page_size !== query.pageSize || r.start !== range.start || r.end !== range.end) return false;
  const t = r.totals;
  return count(r.total) && count(r.low_stock_threshold) && Boolean(t) && t.products === r.total &&
    [t.physical_units, t.held_units, t.available_units].every(count) && t.available_units + t.held_units === t.physical_units && money(t.inventory_value) &&
    list(r.warehouses, w => Number.isSafeInteger(w.warehouse_id) && typeof w.name === "string" && count(w.physical_units) && count(w.held_units) && count(w.available_units)) &&
    list(r.categories, c => typeof c.category_id === "string" && typeof c.category_name === "string") &&
    Array.isArray(r.items) && r.items.length <= r.page_size &&
    list(r.items, i => typeof i.sku === "string" && typeof i.name === "string" && typeof i.category_id === "string" && typeof i.category_name === "string" &&
      (i.brand === null || typeof i.brand === "string") && money(i.price) && Number.isSafeInteger(i.status) && count(i.physical_units) && count(i.held_units) &&
      count(i.available_units) && (i.available_units as number) + (i.held_units as number) === i.physical_units && money(i.inventory_value) &&
      share(i.value_percentage) && count(i.quantity_sold) && money(i.revenue));
}

export async function fetchStockList(query: StockQuery, range: InsightsRange, signal?: AbortSignal): Promise<ProductStockList> {
  const params = new URLSearchParams({ view: query.view, status: query.status, page: String(query.page), page_size: String(query.pageSize) });
  if (query.category) params.set("category", query.category);
  if (query.q) params.set("q", query.q);
  if (range.start) params.set("start", range.start);
  if (range.end) params.set("end", range.end);
  const response = await adminFetch(`/api/backend/crm/analytics/product-stock?${params}`, { signal, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(response.status === 404 ? "Backend chưa có API danh sách tồn kho. Cần cập nhật backend mới."
      : typeof body?.detail === "string" ? body.detail : "Không thể tải danh sách sản phẩm.");
  }
  if (!validStockList(body, query, range)) throw new Error("API trả về danh sách không khớp bộ lọc hoặc số liệu không hợp lệ. Vui lòng thử lại.");
  return body;
}

/** Every product (all statuses) for the export, read page by page from the same list API as the drawers. */
export async function fetchAllProducts(range: InsightsRange, signal?: AbortSignal): Promise<StockListItem[]> {
  const items: StockListItem[] = [];
  for (let page = 1; page <= 1000; page++) {
    const list = await fetchStockList({ view: "products", status: "ALL", category: null, q: null, page, pageSize: 100 }, range, signal);
    items.push(...list.items);
    if (items.length >= list.total || list.items.length === 0) {
      if (items.length !== list.total) throw new Error("Danh sách sản phẩm thay đổi trong lúc xuất file. Vui lòng xuất lại.");
      return items;
    }
  }
  throw new Error("Danh sách sản phẩm quá lớn để xuất một lần.");
}
