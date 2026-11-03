// Isolated browser fixtures: only localStorage carts change; no live writes.
const assert = require("node:assert/strict");
const path = require("node:path"), os = require("node:os");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3001";
const products = [
  ["ACTIVE", "PC đang bán", true], ["EMPTY", "PC hết hàng", true], ["PAUSED", "PC tạm ngừng", false],
].map(([id, name, active]) => ({ id, sku: id, name, is_active: active, price: "5000000.00", currency: "VND", category: { id: "PC", name: "Máy tính để bàn" }, subcategory: { id: "CUSTOM", name: "PC Custom" }, brand: "PHUB", description: null, unit: "Cái", warranty_months: 12, images: [], specifications: [], specifications_text: null }));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined, args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 940 } });
      const page = await context.newPage();
      let paused = true, empty = true, failed = false, shouldFailAdd = false;
      const errors = [], writes = [], requested = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/api/**", async route => {
        const req = route.request(), url = new URL(req.url()), endpoint = url.pathname;
        if (req.method() !== "GET") writes.push(endpoint);
        assert.equal(req.method(), "GET");
        if (endpoint.endsWith("/me")) return route.fulfill({ status: 401, json: { error: { message: "Guest" } } });
        if (endpoint.match(/\/products\/[^/]+\/availability$/)) {
          const id = endpoint.split("/").at(-2), quantity = Number(url.searchParams.get("quantity"));
          requested.push([id, quantity]);
          if (failed && id === "ACTIVE") return route.fulfill({ status: 503, json: { error: { message: "Fixture offline" } } });
          return route.fulfill({ json: { id, sku: id, quantity, available: id === "PAUSED" ? !paused : id === "EMPTY" ? !empty : !(shouldFailAdd && quantity > 1), is_active: id !== "PAUSED" || !paused } });
        }
        if (endpoint === "/api/catalog/availability") return route.fulfill({ json: { items: products.map(p => ({ sku: p.sku, available_quantity: 10 })), currency: "VND", tax_rate: "0.10" } });
        if (endpoint === "/api/catalog/products") {
          assert.equal(url.searchParams.get("include_inactive"), "true");
          return route.fulfill({ json: { items: products, pagination: { page: 1, page_size: 20, total: 3, total_pages: 1 } } });
        }
        if (endpoint.startsWith("/api/catalog/products/")) return route.fulfill({ json: products.find(p => p.id === endpoint.split("/").at(-1)) });
        if (endpoint.endsWith("/categories")) return route.fulfill({ json: { items: [{ id: "PC", name: "Máy tính để bàn", children: [{ id: "CUSTOM", name: "PC Custom" }] }] } });
        if (endpoint.endsWith("/facets")) return route.fulfill({ json: { specs: [], brands: [], total: 3 } });
        return route.fulfill({ json: { items: [] } });
      });
      await page.goto(base + "/main/product");
      const results = page.locator(width < 760 ? "#homepage2-results" : "#catalog-results");
      const card = name => results.getByRole("article").filter({ has: page.getByRole("link", { name, exact: true }) });
      const active = card("PC đang bán"), out = card("PC hết hàng"), stopped = card("PC tạm ngừng");
      const buy = active.getByRole("button", { name: "Mua ngay", exact: true });
      const add = active.getByRole("button", { name: "Thêm vào giỏ", exact: true });
      await out.getByRole("status").getByText("Hết hàng", { exact: true }).waitFor();
      await stopped.getByRole("status").getByText("Tạm ngừng bán", { exact: true }).waitFor();
      assert.equal(await out.getByRole("button").count(), 0);
      assert.equal(await stopped.getByRole("button").count(), 0);
      await add.click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("phub-cart-guest-v1") || "[]")[0]?.quantity === 1);
      assert.equal(new URL(page.url()).pathname, "/main/product");
      shouldFailAdd = true;
      await buy.click();
      await page.getByRole("status").filter({ hasText: "Không đủ hàng trong kho" }).waitFor();
      assert.equal(new URL(page.url()).pathname, "/main/product");
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("phub-cart-guest-v1"))[0].quantity), 1);
      shouldFailAdd = false;
      failed = true;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await active.getByRole("alert").waitFor();
      assert.equal(await active.getByRole("status").count(), 0, "Network error is not sold out");
      failed = false;
      await active.getByRole("button", { name: "Thử lại", exact: true }).click();
      empty = false; paused = false;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await out.getByRole("button", { name: "Mua ngay", exact: true }).waitFor();
      await stopped.getByRole("button", { name: "Mua ngay", exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(os.tmpdir(), `phub-product-actions-${width}.png`), fullPage: false });
      await buy.click();
      await page.waitForURL(url => url.pathname === "/cart");
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("phub-cart-guest-v1"))[0].quantity), 2);
      assert.ok(requested.some(([id, quantity]) => id === "ACTIVE" && quantity === 2), "Existing cart quantity is rechecked");
      assert.deepEqual(errors, []); assert.deepEqual(writes, []);
      console.log(`PASS ${width}px: icon/cart, buy-now navigation, sold-out/paused states, restock/reactivation, retry and quantity race checks; no server writes`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
