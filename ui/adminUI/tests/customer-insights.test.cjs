const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(fetch = () => { throw new Error("No live requests allowed"); }) {
  const transport = { exports: {}, fetch, DOMException };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/admin-fetch.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, transport);

  const sandbox = {
    exports: {},
    Date,
    Intl,
    URLSearchParams,
    Blob: class { constructor(parts) { this.parts = parts; } },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL: () => {} },
    document: {
      createElement: () => ({ set href(val) {}, set download(val) {}, click() {} }),
    },
    require: name => {
      if (name === "@/src/lib/admin-fetch" || name === "@internal/lib/admin-fetch") return transport.exports;
      return {};
    },
  };

  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/features/customer-insights/customer-insights-data.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, sandbox);
  return sandbox.exports;
}

test("formatVND formats numbers and currency strings properly", () => {
  const { formatVND, formatNumber } = load();
  assert.equal(formatVND(15000000), "15.000.000 đ");
  assert.equal(formatVND("2500000.00"), "2.500.000 đ");
  assert.equal(formatVND("invalid"), "0 đ");
  assert.equal(formatNumber(1250), "1.250");
});

test("fetchCustomerInsights sends correct query parameters and parses result", async () => {
  let requestedUrl = "";
  const mockReport = {
    summary: { total_customers: 10, active_buyers: 5, total_orders: 8, total_revenue: "50000000.00", aov: "6250000.00", arpu: "10000000.00" },
    demographics: { gender: [], age_groups: [], interests: [] },
    spending_trends: { period_type: "quarter", timeline: [], customer_segments: [] },
    product_insights: { top_categories: [], top_products: [] },
    strategic_recommendations: [],
  };

  const { fetchCustomerInsights } = load(async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => mockReport,
    };
  });

  const res = await fetchCustomerInsights("quarter", undefined, "2026-01-01", "2026-06-30");
  assert.ok(requestedUrl.includes("period=quarter"));
  assert.ok(requestedUrl.includes("start=2026-01-01"));
  assert.ok(requestedUrl.includes("end=2026-06-30"));
  assert.equal(res.summary.total_customers, 10);
});

test("fetchCustomerInsights throws formatted error on failure", async () => {
  const { fetchCustomerInsights } = load(async () => {
    return {
      ok: false,
      json: async () => ({ detail: "Chỉ quản trị viên mới có quyền xem thống kê CRM." }),
    };
  });

  await assert.rejects(
    () => fetchCustomerInsights("month"),
    /Chỉ quản trị viên mới có quyền xem thống kê CRM/
  );
});

test("exportInsightsCSV runs without crashing and generates valid structure", () => {
  const { exportInsightsCSV } = load();
  const mockReport = {
    summary: { total_customers: 2, active_buyers: 1, total_orders: 1, total_revenue: "10000000.00", aov: "10000000.00", arpu: "10000000.00" },
    demographics: {
      gender: [{ label: "Nam", value: 1, percentage: 50.0 }],
      age_groups: [{ group: "18 - 24", value: 1, percentage: 50.0 }],
      interests: [{ category: "Gaming", count: 1, percentage: 100.0 }],
    },
    spending_trends: {
      period_type: "month",
      timeline: [{ period: "2026-05", label: "Tháng 05/2026", order_count: 1, revenue: "10000000.00", avg_spending: "10000000.00" }],
      customer_segments: [{ segment: "VIP", count: 1, percentage: 100.0, revenue: "10000000.00" }],
    },
    product_insights: {
      top_categories: [{ category_id: "VGA", category_name: "Card", quantity_sold: 1, revenue: "10000000.00", percentage: 100.0 }],
      top_products: [{ sku: "SKU1", name: "Card 4070", category_name: "Card", quantity_sold: 1, revenue: "10000000.00" }],
    },
    strategic_recommendations: [{ type: "VIP", title: "VIP Focus", content: "Chăm sóc khách VIP" }],
  };

  assert.doesNotThrow(() => exportInsightsCSV(mockReport));
});
