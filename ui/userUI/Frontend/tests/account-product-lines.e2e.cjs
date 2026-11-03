// Browser fixtures only: no live order, invoice, stock or payment writes.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3001";
const id = "POOL-ORDER-TEST";
const profile = { customer_id: "POOL-CUSTOMER", name: "Pool Test", phone: null, address_line: null, province: null, ward: null };
const lines = [37, 39, 60, 49].map((quantity, i) => ({ sku: "SEED_SKU001", warehouse_id: i + 1, name: "Điện thoại Demo A", unit: "Cái", quantity, unit_price: "5000000.00", discount: "0.00", tax_amount: `${quantity * 500000}.00`, line_total: `${quantity * 5500000}.00` }));
const order = { id, status: "MOI", created_at: "2026-11-02T14:57:46Z", currency: "VND", total: "1017500000.00", recipient: profile, note: null, items: lines };
const invoice = { order_id: id, currency: "VND", invoice: { issued_at: order.created_at, subtotal: "925000000.00", discount_total: "0.00", tax_total: "92500000.00", total: "1017500000.00" }, items: lines };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PHUB_CHROMIUM_CHANNEL || "chrome", args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors = [], writes = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/api/**", async route => {
        const path = new URL(route.request().url()).pathname;
        const ok = json => route.fulfill({ json });
        if (route.request().method() !== "GET") writes.push(path);
        if (path.endsWith("/auth/me")) return ok({ account_id: "POOL-ACCOUNT", username: "pool.test", role: "KHACH_HANG", name: profile.name, customer_id: profile.customer_id, employee_id: null, warehouse_id: null });
        if (path.endsWith("/customer/me")) return ok(profile);
        if (path.endsWith("/customer/addresses")) return ok({ items: [], item: null });
        if (path.startsWith("/api/catalog/")) return ok({ items: [] });
        if (path.endsWith("/customer/orders")) return ok({ items: [order], pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 } });
        if (path.endsWith(`/customer/orders/${id}`)) return ok(order);
        if (path.endsWith("/invoice")) return ok(invoice);
        if (path.endsWith("/payments")) return ok({ order_id: id, currency: "VND", latest_transaction: null, message: "No payment" });
        if (path.endsWith("/transactions")) return ok({ order_id: id, currency: "VND", items: [], pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 } });
        throw new Error(`Unexpected API request: ${path}`);
      });
      async function grouped(table) {
        await table.getByRole("cell", { name: /185/ }).waitFor();
        assert.equal(await table.locator("tbody tr").count(), 1);
        assert.equal(await table.getByRole("cell", { name: /Điện thoại Demo A/ }).count(), 1);
        await table.getByRole("cell", { name: /1\.017\.500\.000/ }).waitFor();
      }
      await page.goto(base + "/main/profile");
      await page.getByRole("navigation", { name: "Quản lý tài khoản" }).getByRole("button", { name: "Đơn hàng của tôi", exact: true }).click();
      await page.getByRole("link", { name: "Xem chi tiết", exact: true }).click();
      await page.waitForURL(`**/main/orders/${id}`);
      await page.goto(base + `/main/orders/${id}`);
      await grouped(page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Sản phẩm lúc bán", exact: true }) }));
      await grouped(page.getByRole("region", { name: "Hóa đơn của đơn hàng", exact: true }).getByRole("table"));
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      console.log(`PASS ${width}px: profile navigation, direct order and invoice each show one product / 185 units, correct totals, refresh preserves grouping`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
