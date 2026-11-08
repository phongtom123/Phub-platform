const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(fetch = () => { throw new Error("No live requests allowed"); }, artifacts = {}) {
  const transport = { exports: {}, fetch, DOMException };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/admin-fetch.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, transport);

  const sandbox = {
    exports: {},
    Date,
    Intl,
    URLSearchParams,
    Blob: class { constructor(parts) { this.parts = parts; artifacts.csv = parts.join(""); } },
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
    summary: { status_scope: "ACTIVE", total_customers: 10, active_buyers: 5, total_orders: 8, total_revenue: "50000000.00", aov: "6250000.00", arpu: "10000000.00" },
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

for (const body of [
  { summary: { status_scope: "ACTIVE" }, spending_trends: { period_type: "month" } },
  { summary: { status_scope: "COMPLETED" }, spending_trends: { period_type: "year" } },
  {}, null,
]) {
  test(`fetch rejects mismatched or missing report scope/period: ${JSON.stringify(body)}`, async () => {
    const { fetchCustomerInsights } = load(async () => ({ ok: true, json: async () => body }));
    await assert.rejects(() => fetchCustomerInsights("month", undefined, undefined, undefined, "COMPLETED"), /không khớp phạm vi hoặc kỳ/);
  });
}

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
  const artifacts = {};
  const { exportInsightsCSV } = load(undefined, artifacts);
  const mockReport = {
    summary: { status_scope: "ACTIVE", total_customers: 2, active_buyers: 1, total_orders: 1, total_revenue: "10000000.00", aov: "10000000.00", arpu: "10000000.00" },
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
    survey_insights: {
      total_surveys: 1, total_responses: 3, rated_responses: 1, total_ratings: 2,
      avg_overall_score: 4.5, avg_product_score: null, avg_service_score: null,
      rating_breakdown: [{ stars: 5, count: 1, percentage: 50 }, { stars: 4, count: 1, percentage: 50 }],
      recent_feedbacks: [],
    },
  };

  assert.doesNotThrow(() => exportInsightsCSV(mockReport));
  assert.match(artifacts.csv, /Điểm đánh giá chung TB \(\/5\),4\.5/);
  assert.match(artifacts.csv, /Điểm sản phẩm TB \(\/5\),Chưa có/);
  assert.match(artifacts.csv, /Điểm dịch vụ TB \(\/5\),Chưa có/);
  assert.match(artifacts.csv, /Số bài có điểm hài lòng,1/);
  assert.match(artifacts.csv, /Số câu chấm điểm hài lòng,2/);
  assert.match(artifacts.csv, /Phạm vi,Đơn có hiệu lực/);
  assert.match(artifacts.csv, /Số đơn có hiệu lực,1/);
  assert.match(artifacts.csv, /Giá trị đơn có hiệu lực \(chưa thuế\),10000000\.00/);
  assert.doesNotMatch(artifacts.csv, /đơn hoàn thành|Số lượng bán|TOP SẢN PHẨM BÁN CHẠY/);
  assert.doesNotMatch(artifacts.csv, /undefined|null/);

  exportInsightsCSV({ ...mockReport, summary: { ...mockReport.summary, status_scope: "COMPLETED" } });
  assert.match(artifacts.csv, /Phạm vi,Chỉ đơn hoàn thành/);
  assert.match(artifacts.csv, /Số đơn hoàn thành,1/);
  assert.match(artifacts.csv, /Doanh thu đơn hoàn thành \(chưa thuế\),10000000\.00/);
  assert.match(artifacts.csv, /Số lượng bán/);
  assert.doesNotMatch(artifacts.csv, /đơn có hiệu lực/);
  assert.throws(() => exportInsightsCSV({ ...mockReport, summary: { ...mockReport.summary, status_scope: undefined } }), /Chưa xác nhận phạm vi/);
});
