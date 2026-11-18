// Run: node --test ui/adminUI/tests/product-insights.test.cjs (fixtures only, no live requests).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const transpile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function load(fetch = () => { throw new Error("No live requests allowed"); }) {
  const transport = { exports: {}, fetch, DOMException };
  vm.runInNewContext(transpile("../src/lib/admin-fetch.ts"), transport);
  const dashboard = { exports: {}, Intl, Date, require: () => transport.exports };
  vm.runInNewContext(transpile("../src/features/dashboard/dashboard-data.ts"), dashboard);
  const sandbox = {
    exports: {}, Date, Intl, URLSearchParams, Number, Math,
    require: name => name === "@internal/lib/admin-fetch" ? transport.exports : name === "../dashboard/dashboard-data" ? dashboard.exports : {},
  };
  vm.runInNewContext(transpile("../src/features/product-insights/product-insights-data.ts"), sandbox);
  return sandbox.exports;
}

function report(range = { start: null, end: null, period_type: "month" }) {
  const breakdown = (key, count, amount) => ({ key, label: key, count, amount, percentage: 50, amount_percentage: 50 });
  const product = { sku: "VGA", name: "VGA", category_name: "Card", brand: null, price: "25000000.00", quantity_sold: 1, revenue: "25000000.00", available_units: 4, held_units: 1 };
  return {
    range,
    product_summary: { total_products: 4, active_products: 3, paused_products: 1, hidden_products: 1, total_categories: 3, physical_units: 26, held_units: 2,
      available_units: 24, out_of_stock_products: 1, low_stock_products: 1, low_stock_threshold: 5, inventory_value: "118000000.00" },
    invoice_summary: { total_invoices: 4, valid_invoices: 3, cancelled_invoices: 1, total_amount: "36740000.00", pre_tax_amount: "33400000.00", tax_amount: "3340000.00",
      discount_amount: "500000.00", avg_invoice_value: "12246666.67", collected_amount: "30500000.00", outstanding_amount: "6240000.00",
      paid_invoices: 1, partial_invoices: 1, unpaid_invoices: 1, items_sold: 5 },
    invoice_status: [breakdown("PAID", 1, "27500000.00"), breakdown("CANCELLED", 1, "8800000.00")],
    payment_methods: [breakdown("=CMD", 1, "1.00")],
    sales_channels: [], invoice_sources: [],
    timeline: [{ period: "2026-05", label: "Tháng 05/2026", invoice_count: 2, pre_tax: "1.00", tax: "0.10", total: "1.10", collected: "0.00", items_sold: 4 }],
    categories: [{ category_id: "GPU", category_name: "Card \"VGA\"", product_count: 1, available_units: 4, inventory_value: "1.00", quantity_sold: 1, revenue: "1.00", revenue_percentage: 74.9 }],
    top_products: [product], slow_products: [], low_stock_products: [product],
    price_ranges: [{ key: "LT_1M", label: "Dưới 1 triệu", count: 1, percentage: 33.3, categories: [{ category_id: "GPU", category_name: "Card", product_count: 1, available_units: 4, inventory_value: "1.00", quantity_sold: 1, revenue: "1.00", revenue_percentage: 100 }] }],
    top_brands: [{ brand: "ASUS", product_count: 1, quantity_sold: 1, revenue: "1.00", revenue_percentage: 74.9, categories: [{ category_id: "GPU", category_name: "Card", product_count: 1, available_units: 4, inventory_value: "1.00", quantity_sold: 1, revenue: "1.00", revenue_percentage: 100 }] }],
  };
}

test("presetRange uses Vietnam calendar days and inclusive length", () => {
  const { presetRange } = load();
  const now = new Date("2026-11-17T18:30:00Z"); // 2026-11-18 01:30 in Vietnam
  assert.deepEqual({ ...presetRange("all", now) }, { start: null, end: null });
  assert.deepEqual({ ...presetRange("30d", now) }, { start: "2026-10-20", end: "2026-11-18" });
  assert.deepEqual({ ...presetRange("365d", now) }, { start: "2025-11-19", end: "2026-11-18" });
});

test("fetch sends period and range, accepts a matching report", async () => {
  let url = "";
  const { fetchProductInsights } = load(async requested => { url = String(requested); return Response.json(report({ start: "2026-05-01", end: "2026-05-31", period_type: "quarter" })); });
  const result = await fetchProductInsights("quarter", { start: "2026-05-01", end: "2026-05-31" });
  assert.match(url, /\/api\/backend\/crm\/analytics\/product-invoice-insights\?/);
  assert.match(url, /period=quarter/);
  assert.match(url, /start=2026-05-01/);
  assert.match(url, /end=2026-05-31/);
  assert.equal(result.invoice_summary.total_invoices, 4);
});

test("fetch omits dates for all-time range", async () => {
  let url = "";
  const { fetchProductInsights } = load(async requested => { url = String(requested); return Response.json(report()); });
  await fetchProductInsights("month", { start: null, end: null });
  assert.doesNotMatch(url, /start=|end=/);
});

for (const [name, mutate] of [
  ["period mismatch", r => { r.range.period_type = "year"; }],
  ["range mismatch", r => { r.range.start = "2026-01-01"; r.range.end = "2026-01-31"; }],
  ["stock units do not add up", r => { r.product_summary.held_units = 3; }],
  ["invoice counts do not add up", r => { r.invoice_summary.paid_invoices = 3; }],
  ["money is not a decimal string", r => { r.invoice_summary.total_amount = 36740000; }],
  ["bad product row", r => { r.top_products[0].available_units = -1; }],
  ["missing section", r => { delete r.timeline; }],
  ["price range breakdown does not add up", r => { r.price_ranges[0].categories[0].product_count = 2; }],
  ["brand breakdown does not add up", r => { r.top_brands[0].categories = []; }],
  ["price range without key", r => { delete r.price_ranges[0].key; }],
]) {
  test(`fetch rejects invalid report: ${name}`, async () => {
    const body = report();
    mutate(body);
    const { fetchProductInsights } = load(async () => Response.json(body));
    await assert.rejects(() => fetchProductInsights("month", { start: null, end: null }), /không khớp kỳ đã chọn hoặc số liệu không hợp lệ/);
  });
}

test("fetch surfaces backend error detail and missing endpoint", async () => {
  let { fetchProductInsights } = load(async () => Response.json({ detail: "Chỉ quản trị viên mới có quyền xem thống kê sản phẩm và hóa đơn." }, { status: 403 }));
  await assert.rejects(() => fetchProductInsights("month", { start: null, end: null }), /Chỉ quản trị viên/);
  ({ fetchProductInsights } = load(async () => new Response("not found", { status: 404 })));
  await assert.rejects(() => fetchProductInsights("month", { start: null, end: null }), /Backend chưa có API thống kê/);
});

test("Excel export: one sheet per topic, full numbers (no 2.01E+11), real percentages, filters and frozen headers", async () => {
  const Excel = require("exceljs");
  // Same realm as ExcelJS (a vm context would give arrays that fail its `instanceof Array` checks).
  const exported = {};
  vm.runInThisContext(`(function (exports, require) {${transpile("../src/features/product-insights/product-insights-xlsx.ts")}
})`)(exported, () => ({}));
  const { buildProductInsightsWorkbook, productInsightsFileName } = exported;
  const data = report();
  data.product_summary.inventory_value = "201072865000.00";
  const products = Array.from({ length: 130 }, (_, i) => ({
    sku: i === 0 ? "=CMD" : `SKU-${i}`, name: `Sản phẩm ${i}`, category_id: "GPU", category_name: "Card", brand: i % 2 ? null : "ASUS",
    price: "25000000.00", status: i === 129 ? 0 : 1, physical_units: i % 7, held_units: 0, available_units: i % 7,
    inventory_value: String((i % 7) * 25000000) + ".00", value_percentage: 0, quantity_sold: i, revenue: String(i * 1000) + ".00",
  }));
  const book = buildProductInsightsWorkbook(Excel, data, products, new Date("2026-11-18T06:16:51Z"));
  const read = new Excel.Workbook();
  await read.xlsx.load(await book.xlsx.writeBuffer());
  assert.deepEqual(read.worksheets.map(sheet => sheet.name), ["Tổng quan", "Hóa đơn theo kỳ", "Phân tích hóa đơn", "Loại sản phẩm", "Sản phẩm"]);

  const overview = read.getWorksheet("Tổng quan");
  const find = label => { let found; overview.eachRow(row => { if (row.getCell(1).value === label) found = row.getCell(2); }); return found; };
  assert.equal(find("Kỳ lập hóa đơn").value, "Toàn thời gian");
  assert.equal(find("Giá trị tồn khả dụng (giá bán)").value, 201072865000);
  assert.equal(find("Giá trị tồn khả dụng (giá bán)").numFmt, '#,##0 "đ"');
  assert.equal(find("Tồn khả dụng").value, 24);

  const trend = read.getWorksheet("Hóa đơn theo kỳ");
  assert.deepEqual(trend.getRow(2).values.slice(1), ["Tháng 05/2026", "2026-05", 2, 4, 1, 0.1, 1.1, 0, 1.1, 0]);
  assert.equal(trend.getCell("G2").numFmt, '#,##0 "đ"');
  assert.equal(trend.getCell("J2").numFmt, "0.0%");
  assert.equal(trend.views[0].state, "frozen");
  assert.ok(trend.autoFilter);

  const analysis = read.getWorksheet("Phân tích hóa đơn");
  assert.deepEqual(analysis.getRow(2).values.slice(1, 5), ["Trạng thái thanh toán", "PAID", 1, 0.5]);

  const categories = read.getWorksheet("Loại sản phẩm");
  const scopes = new Set(); categories.eachRow((row, n) => { if (n > 1) scopes.add(row.getCell(1).value); });
  assert.deepEqual([...scopes], ["Tất cả", "Khoảng giá: Dưới 1 triệu", "Thương hiệu: ASUS"]);
  assert.equal(categories.getCell("B2").value, 'Card "VGA"');

  const list = read.getWorksheet("Sản phẩm");
  assert.equal(list.rowCount, 1 + 130, "every product, not only the top rows on screen");
  assert.equal(list.getCell("A2").value, "=CMD", "text that looks like a formula stays plain text");
  assert.equal(list.getCell("A2").formula, undefined);
  assert.deepEqual([list.getCell("E131").value, list.getCell("M2").value, list.getCell("M3").value], ["Đã ẩn", "Hết hàng", "Sắp hết"]);
  assert.equal(list.getCell("F2").numFmt, '#,##0 "đ"');
  assert.equal(productInsightsFileName(data, "2026-11-18"), "phub-san-pham-hoa-don-toan-bo-2026-11-18.xlsx");
});

function productSales(sku = "VGA", range = { start: null, end: null, period_type: "month" }) {
  return {
    sku, name: "VGA", category_name: "Card", brand: null, price: "25000000.00", status: 1, range,
    summary: { quantity_sold: 3, revenue: "73000000.00", invoice_count: 2, avg_unit_price: "24333333.33", physical_units: 5, held_units: 1, available_units: 4 },
    timeline: [{ period: "2026-05", label: "Tháng 05/2026", quantity: 0, revenue: "0.00", invoice_count: 0 }],
    channels: [{ key: "ONLINE", label: "Trực tuyến", quantity: 3, revenue: "73000000.00" }],
    warehouses: [{ warehouse_id: 1, name: "Kho 1", physical_units: 5, held_units: 1, available_units: 4, quantity_sold: 3 }],
  };
}

test("fetchProductSales sends sku, period and range and accepts a matching product", async () => {
  let url = "";
  const { fetchProductSales } = load(async requested => { url = String(requested); return Response.json(productSales("A&B/1", { start: "2026-05-01", end: "2026-05-31", period_type: "quarter" })); });
  const result = await fetchProductSales("A&B/1", "quarter", { start: "2026-05-01", end: "2026-05-31" });
  const params = new URL(url, "http://x").searchParams;
  assert.match(url, /\/api\/backend\/crm\/analytics\/product-sales\?/);
  assert.deepEqual([params.get("sku"), params.get("period"), params.get("start"), params.get("end")], ["A&B/1", "quarter", "2026-05-01", "2026-05-31"]);
  assert.equal(result.summary.available_units, 4);
});

for (const [name, mutate] of [
  ["other product", r => { r.sku = "OTHER"; }],
  ["other period", r => { r.range.period_type = "year"; }],
  ["stock does not add up", r => { r.summary.held_units = 2; }],
  ["bad timeline", r => { r.timeline[0].quantity = -1; }],
  ["bad warehouse", r => { r.warehouses[0].warehouse_id = "1"; }],
]) {
  test(`fetchProductSales rejects invalid report: ${name}`, async () => {
    const body = productSales();
    mutate(body);
    const { fetchProductSales } = load(async () => Response.json(body));
    await assert.rejects(() => fetchProductSales("VGA", "month", { start: null, end: null }), /không khớp hoặc không hợp lệ/);
  });
}

test("fetchProductSales surfaces backend detail", async () => {
  const { fetchProductSales } = load(async () => Response.json({ detail: "Không tìm thấy sản phẩm." }, { status: 404 }));
  await assert.rejects(() => fetchProductSales("X", "month", { start: null, end: null }), /Không tìm thấy sản phẩm/);
});

test("axis label helpers", () => {
  const { shortPeriod, compactVND } = load();
  assert.equal(shortPeriod("2026-09"), "T9/26");
  assert.equal(shortPeriod("2026-Q3"), "Q3/26");
  assert.equal(shortPeriod("2026"), "2026");
  assert.equal(compactVND(1250000000), "1,25 tỷ");
  assert.equal(compactVND(45000000), "45 tr");
  assert.equal(compactVND(2500), "2,5 k");
  assert.equal(compactVND(0), "0");
});

function stockList(overrides = {}) {
  return {
    view: "low", status: "ACTIVE", category: "GPU", q: "vga", start: null, end: null, page: 2, page_size: 20, total: 21, low_stock_threshold: 5,
    totals: { products: 21, physical_units: 5, held_units: 1, available_units: 4, inventory_value: "100.00" },
    warehouses: [{ warehouse_id: 1, name: "Kho 1", physical_units: 5, held_units: 1, available_units: 4 }],
    categories: [{ category_id: "GPU", category_name: "Card" }],
    items: [{ sku: "VGA", name: "VGA", category_id: "GPU", category_name: "Card", brand: null, price: "25.00", status: 1, physical_units: 5,
      held_units: 1, available_units: 4, inventory_value: "100.00", value_percentage: 100, quantity_sold: 3, revenue: "75.00" }],
    ...overrides,
  };
}
const stockQuery = { view: "low", status: "ACTIVE", category: "GPU", q: "vga", page: 2, pageSize: 20 };

test("fetchStockList sends every filter and accepts the matching page", async () => {
  let url = "";
  const { fetchStockList } = load(async requested => { url = String(requested); return Response.json(stockList()); });
  const result = await fetchStockList(stockQuery, { start: null, end: null });
  const params = new URL(url, "http://x").searchParams;
  assert.match(url, /\/api\/backend\/crm\/analytics\/product-stock\?/);
  assert.deepEqual(Object.fromEntries(params), { view: "low", status: "ACTIVE", page: "2", page_size: "20", category: "GPU", q: "vga" });
  assert.equal(result.items[0].revenue, "75.00");
});

for (const [name, overrides] of [
  ["stale page", { page: 1 }],
  ["other filter", { category: null }],
  ["other search", { q: "cpu" }],
  ["totals disagree with total", { total: 22 }],
  ["bad item stock", { items: [{ ...stockList().items[0], held_units: 2 }] }],
  ["missing revenue", { items: [{ ...stockList().items[0], revenue: undefined }] }],
]) {
  test(`fetchStockList rejects ${name}`, async () => {
    const { fetchStockList } = load(async () => Response.json(stockList(overrides)));
    await assert.rejects(() => fetchStockList(stockQuery, { start: null, end: null }), /không khớp bộ lọc hoặc số liệu không hợp lệ/);
  });
}

test("each tile opens the filter that reproduces its number", () => {
  const { STOCK_VIEW_DEFAULT_STATUS } = load();
  assert.deepEqual({ ...STOCK_VIEW_DEFAULT_STATUS }, { products: "ACTIVE", stock: "ALL", low: "ACTIVE", value: "ACTIVE", sales: "ALL" });
});
