// Browser fixtures only: no real orders, payments or inventory writes.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3001";
const customerId = "CART-STOCK-TEST";
const products = ["A", "B", "C"].map(id => ({
  id, sku: `SKU-${id}`, name: `Product ${id}`, price: "100.00", currency: "VND",
  category: { id: "C", name: "Test" }, subcategory: { id: "SC", name: "Test" },
  brand: null, description: null, unit: "unit", warranty_months: 0, images: [], specifications: [],
}));
const entries = products.map((p, i) => ({ product_id: p.id, sku: p.sku, quantity: [165, 2, 9999][i], selected: i < 2 }));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PHUB_CHROMIUM_CHANNEL || "chrome", args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    for (const guest of [false, true]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const cartKey = guest ? "phub-cart-guest-v1" : `phub-cart-v1:${customerId}`;
      await page.addInitScript(({ key, entries }) => localStorage.setItem(key, JSON.stringify(entries)), { key: cartKey, entries });
      let stockB = 1, mode = "normal", release;
      const checks = [], writes = [], errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/api/**", async route => {
        const url = new URL(route.request().url()), path = url.pathname;
        const ok = json => route.fulfill({ json });
        if (route.request().method() !== "GET") writes.push(path);
        if (path.endsWith("/auth/me")) return guest
          ? route.fulfill({ status: 401, json: { error: { message: "Guest" } } })
          : ok({ account_id: "ACCOUNT", username: "test", role: "KHACH_HANG", name: "Test", customer_id: customerId, employee_id: null, warehouse_id: null });
        if (path.endsWith("/customer/me")) return guest
          ? route.fulfill({ status: 401, json: { error: { message: "Guest" } } })
          : ok({ customer_id: customerId, name: "Test", phone: null, address_line: null, province: null, ward: null });
        if (path === "/api/catalog/availability") return ok({ items: products.map(p => ({ sku: p.sku, available_quantity: 200 })), tax_rate: "10.00", currency: "VND" });
        if (path.endsWith("/availability")) {
          const id = path.split("/").at(-2), quantity = Number(url.searchParams.get("quantity"));
          const product = products.find(p => p.id === id);
          checks.push({ id, quantity });
          if (mode === "delay") await new Promise(resolve => { release = resolve; });
          if (mode === "network") return route.fulfill({ status: 503, json: { error: { message: "Không kiểm tra được tồn kho thử nghiệm." } } });
          return ok({ id, sku: product.sku, quantity, available: quantity <= (id === "B" ? stockB : 165) });
        }
        const product = products.find(p => path === `/api/catalog/products/${p.id}`);
        if (product) return ok(product);
        if (path.startsWith("/api/catalog/")) return ok({ items: [] });
        if (path.endsWith("/checkout/quote")) return route.fulfill({ status: 503, json: { error: { message: "Quote fixture unavailable" } } });
        throw new Error(`Unexpected API request: ${path}`);
      });
      await page.goto(base + "/cart");
      const checkout = page.getByRole("button", { name: guest ? /Đăng nhập để thanh toán/ : /Tiến hành đặt hàng/ });
      await checkout.waitFor();
      const saved = () => page.evaluate(key => localStorage.getItem(key), cartKey);
      const before = await saved();
      await checkout.click();
      await page.getByRole("status").filter({ hasText: "Không đủ hàng trong kho cho: Product B (2)" }).waitFor();
      assert.ok(page.url().endsWith("/cart"));
      assert.deepEqual(checks.slice(-2), [{ id: "A", quantity: 165 }, { id: "B", quantity: 2 }]);
      assert.ok(!checks.some(c => c.id === "C"), "Unselected products do not block checkout");
      assert.equal(await saved(), before, "Stock checks preserve the cart");

      stockB = 2;
      mode = "network";
      await checkout.click();
      await page.getByRole("status").filter({ hasText: "Không kiểm tra được tồn kho thử nghiệm." }).waitFor();
      assert.ok(page.url().endsWith("/cart"));

      // Keep only A selected to control one delayed availability response.
      await page.getByRole("checkbox", { name: "Chọn sản phẩm Product B", exact: true }).uncheck();
      mode = "delay";
      await checkout.click();
      await page.getByRole("button", { name: "Đang kiểm tra tồn kho…" }).waitFor();
      await page.waitForFunction(() => document.querySelector('button[aria-busy="true"]')?.disabled);
      while (!release) await new Promise(resolve => setTimeout(resolve, 20));
      const quantityInput = page.getByRole("spinbutton", { name: "Số lượng", exact: true }).nth(0);
      await quantityInput.fill("166");
      mode = "normal";
      release();
      await page.getByRole("status").filter({ hasText: "Giỏ hàng vừa thay đổi" }).waitFor();
      assert.ok(page.url().endsWith("/cart"));
      await checkout.click();
      await page.getByRole("status").filter({ hasText: "Không đủ hàng trong kho cho: Product A (166)" }).waitFor();
      await quantityInput.fill("165");
      await checkout.click();
      await page.waitForURL(guest ? "**/auth/login?redirect=%2Fcheckout" : "**/checkout");
      assert.deepEqual(errors, []);
      assert.ok(!writes.some(path => path.endsWith("/orders")), "Proceeding from cart never creates an order");
      console.log(`PASS ${guest ? "guest" : "authenticated"}: selected stock checked before navigation, insufficient stock/network failures blocked, pending edits rechecked, pooled quantity 165 accepted`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
