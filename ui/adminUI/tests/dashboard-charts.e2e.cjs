/** Local UI only; read-only browser HTTP fixtures, no cloud credentials. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const orders = Array.from({ length: 105 }, (_, i) => ({ ma_donhang: "ORDER-" + String(i).padStart(3, "0"), thoi_gian_dat: today + "T10:00:00+07:00", trang_thai: i < 60 ? "HOAN_THANH" : i < 95 ? "MOI" : "HUY", kenh_ban: i < 70 ? "ONLINE" : "TAI_QUAY" }));
const warehouseRows = [{ ma_kho: -900003, ten_kho: "Kho chính" }, { ma_kho: 1, ten_kho: "Kho phụ" }];
const inventoryRows = [{ ma_kho: -900003, sku: "SKU1", so_luong_ton: 20 }, { ma_kho: -900003, sku: "SKU2", so_luong_ton: 30 }, { ma_kho: 1, sku: "SKU3", so_luong_ton: 4 }];
const metadata = [{ name: "orders", title: "Đơn hàng", keys: ["ma_donhang"], writable: false, columns: [{ name: "ma_donhang", type: "varchar", required: true }] }];

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    let mode = "success";
    const calls = [], errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      assert.equal(request.method(), "GET", "Charts must never write data");
      calls.push(url.pathname + url.search);
      const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname === "/api/backend/auth/me") return respond({ role: "ADMIN", username: "test.admin", name: "Admin Test" });
      if (url.pathname === "/api/backend/data/resources") return respond(metadata);
      if (mode === "error") return respond({ detail: "Không kết nối được API thống kê." }, 503);
      const resource = url.pathname.split("/").pop();
      const rows = mode === "empty" ? [] : ({ orders, inventory: inventoryRows, warehouses: warehouseRows, products: [{ ma_sp: "SP1" }], customers: [{ ma_kh: "KH1" }] })[resource];
      assert.ok(rows, "Unexpected API endpoint: " + url.pathname);
      const pageNo = Number(url.searchParams.get("page") || 1), size = Number(url.searchParams.get("page_size") || 20);
      return respond({ data: rows.slice((pageNo - 1) * size, pageNo * size), total: rows.length, page: pageNo, page_size: size });
    });
    await page.goto(base);
    const chart = title => page.locator(".dashboard-chart-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await chart("Trạng thái đơn hàng").getByText("105", { exact: true }).waitFor();
    assert.equal(await page.locator(".dashboard-chart-card").count(), 4);
    assert.equal(await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 1);
    assert.ok(calls.some(call => call.includes("/data/orders?page=2&page_size=100")));
    assert.ok((await chart("Tồn kho theo kho").innerText()).includes("50"));
    assert.ok((await chart("Đơn hàng theo kênh bán").innerText()).includes("70"));
    if (process.env.PHUB_CHART_SCREENSHOT) await page.screenshot({ path: process.env.PHUB_CHART_SCREENSHOT, fullPage: true });
    await page.getByLabel("Khoảng thời gian").selectOption("7");
    await chart("Đơn hàng theo ngày").locator(".dashboard-trend-total strong").waitFor();
    assert.equal(await chart("Đơn hàng theo ngày").locator(".dashboard-trend-total strong").innerText(), "105");
    await chart("Đơn hàng theo ngày").getByText("Xem số liệu", { exact: true }).click();
    assert.equal(await chart("Đơn hàng theo ngày").locator("tbody tr").count(), 7);
    await page.getByLabel("Khoảng thời gian").selectOption("90");
    assert.equal(await chart("Đơn hàng theo ngày").locator("tbody tr").count(), 90);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.main')).paddingLeft === '0px');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), "Dashboard must not overflow mobile viewport");
    assert.equal(await page.locator(".dashboard-chart-card").count(), 4);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.getByRole("button", { name: "Mở danh sách tồn kho", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("module") === "inventory");
    // Return to dashboard without retaining an old chart selection/session state.
    await page.goto(base);
    await chart("Trạng thái đơn hàng").getByText("105", { exact: true }).waitFor();
    mode = "error";
    await page.getByRole("button", { name: "Làm mới thống kê" }).click();
    await chart("Trạng thái đơn hàng").getByRole("alert").waitFor();
    assert.equal(await page.locator(".dashboard-chart-card [role=alert]").count(), 4);
    assert.equal(await page.locator(".dashboard-donut").count(), 0);
    mode = "empty";
    await page.getByRole("button", { name: "Làm mới thống kê" }).click();
    await chart("Trạng thái đơn hàng").getByText("Chưa có dữ liệu để thống kê.").waitFor();
    assert.equal(await page.locator(".dashboard-chart-card [role=alert]").count(), 0);
    assert.ok((await chart("Đơn hàng theo ngày").innerText()).includes("Không có đơn trong khoảng đã chọn"));
    assert.deepEqual(errors, []);
    console.log("PASS: four real-data charts, full pagination, period selector, exact totals, mobile layout, navigation, refresh, errors and empty states; no live writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
