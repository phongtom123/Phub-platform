/** Real local Next pages; read-only HTTP fixtures, no live Supabase requests. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const order = "ORDER-1";
const resources = [
  ["orders", "Đơn hàng", "ma_donhang", "varchar"],
  ["order-lines", "Chi tiết đơn hàng", "ma_ct_donhang", "int"],
  ["invoices", "Hóa đơn", "ma_hoadon", "varchar"],
  ["payments", "Thanh toán", "ma_thanh_toan", "int"],
  ["voucher-uses", "Sử dụng voucher", "ma_su_dung", "int"],
  ["products", "Sản phẩm", "ma_sp", "varchar"],
  ["customers", "Khách hàng", "ma_kh", "varchar"],
  ["inventory", "Tồn kho", "ma_kho", "int"],
  ["warehouses", "Kho", "ma_kho", "int"],
].map(([name, title, key, type]) => ({ name, title, keys: [key], writable: false,
  columns: [{ name: key, type, required: true }, ...(name !== "orders" ? [{ name: "ma_donhang", type: "varchar", required: true }] : [])],
}));

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [], filters = [];
    let oldBackend = false;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      assert.equal(request.method(), "GET");
      const respond = body => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname === "/api/backend/auth/me") return respond({ name: "Admin Test", username: "test.admin", role: "ADMIN" });
      if (url.pathname === "/api/backend/data/resources") return respond(resources);
      const name = url.pathname.split("/").pop();
      const meta = resources.find(r => r.name === name);
      assert.ok(meta, "Unexpected endpoint: " + url.pathname);
      const parent = url.searchParams.get("order_id");
      if (parent) { assert.equal(parent, order); filters.push(name); }
      const key = meta.keys[0], id = meta.columns[0].type === "int" ? -5 : name === "orders" ? order : "INV-1";
      const row = { [key]: id, ma_donhang: oldBackend ? "ORDER-OTHER" : order };
      const rows = name === "orders" ? [row, { ma_donhang: "ORDER-10" }] : [row];
      return respond({ data: url.searchParams.has("key") ? [row] : rows, total: rows.length, page: Number(url.searchParams.get("page") || 1), page_size: Number(url.searchParams.get("page_size") || 20), ...(parent && !oldBackend ? { order_id: parent } : {}) });
    });
    await page.goto(base);
    await page.getByRole("heading", { name: "Danh sách đơn hàng" }).waitFor();
    await page.locator(".live-table").getByRole("link", { name: order, exact: true }).waitFor();
    assert.equal(await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 1);
    assert.equal(await page.getByRole("navigation", { name: "Thông tin đơn hàng" }).count(), 0);
    assert.equal(await page.getByRole("navigation", { name: "Bảng liên quan" }).count(), 0);
    await page.getByRole("link", { name: "Xem tất cả đơn hàng" }).click();
    await page.locator(".live-table").getByRole("link", { name: order, exact: true }).waitFor();
    assert.equal(await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 1);
    assert.equal(await page.getByRole("navigation", { name: "Thông tin đơn hàng" }).count(), 0);
    await page.locator(".live-table").getByRole("link", { name: order, exact: true }).click();
    const related = page.getByRole("navigation", { name: "Thông tin đơn hàng" });
    await related.waitFor();
    assert.equal(await related.getByRole("link").count(), 4);
    const detailUrl = page.url();
    for (const resource of resources.slice(1, 5)) {
      await page.goto(detailUrl);
      await page.getByRole("navigation", { name: "Thông tin đơn hàng" }).getByRole("link", { name: resource.title, exact: true }).click();
      await page.locator(".live-table").waitFor();
      assert.equal(new URL(page.url()).searchParams.get("order_id"), order);
      const crumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
      assert.equal(await crumb.count(), 1);
      assert.ok((await crumb.innerText()).includes(order));
      await page.getByRole("button", { name: "Làm mới", exact: true }).click();
      await page.locator(".live-table").waitFor();
      await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
      await page.locator(".live-table").waitFor();
      await page.locator(".live-table").getByRole("link", { name: "Chi tiết", exact: true }).click();
      await page.locator(".live-field").first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get("order_id"), order);
      await page.getByRole("button", { name: "← Quay lại", exact: true }).click();
      await page.locator(".live-table").waitFor();
      assert.equal(new URL(page.url()).searchParams.get("order_id"), order);
      await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).getByRole("link", { name: order, exact: true }).click();
      await page.getByRole("navigation", { name: "Thông tin đơn hàng" }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get("key"), JSON.stringify([order]));
    }
    oldBackend = true;
    await page.goto(base + "/data/payments?order_id=" + order);
    await page.locator('.live-data [role="alert"]').waitFor();
    assert.ok((await page.locator('.live-data [role="alert"]').innerText()).includes("Cần cập nhật backend"));
    assert.equal(await page.locator(".live-table").count(), 0);
    assert.ok(filters.length >= 8);
    assert.deepEqual(errors, []);
    console.log("PASS: single header breadcrumb; no global related links; exact order context across four related pages, detail/back/search/refresh; old backend guard.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
