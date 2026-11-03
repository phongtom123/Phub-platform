// Only public product reads use the backend. All availability is browser fixtures;
// no accounts, orders or inventory are changed.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PHUB_CHROMIUM_CHANNEL || "chrome", args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    const reference = await browser.newContext();
    const response = await reference.request.get(base + "/api/catalog/products?page_size=1");
    assert.equal(response.status(), 200);
    const id = process.env.PHUB_PRODUCT_TEST_ID || (await response.json()).items[0]?.id;
    const detail = await reference.request.get(base + `/api/catalog/products/${encodeURIComponent(id)}`);
    assert.equal(detail.status(), 200);
    const product = await detail.json();
    await reference.close();

    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      let stock = 0, failed = false, paused = false;
      const errors = [], requests = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/api/**", async route => {
        const url = new URL(route.request().url()), path = url.pathname;
        assert.equal(route.request().method(), "GET", "Stock display cannot create orders or change inventory");
        if (path.endsWith("/me")) return route.fulfill({ status: 401, json: { error: { message: "Guest" } } });
        if (path === "/api/catalog/availability") return failed
          ? route.fulfill({ status: 503, json: { error: { message: "Stock fixture unavailable" } } })
          : route.fulfill({ json: { items: [{ sku: product.sku, available_quantity: stock }], tax_rate: "10.00", currency: "VND" } });
        if (path.endsWith("/availability")) {
          const quantity = Number(url.searchParams.get("quantity"));
          requests.push(quantity);
          return failed
            ? route.fulfill({ status: 503, json: { error: { message: "Stock fixture unavailable" } } })
            : route.fulfill({ json: { id: product.id, sku: product.sku, quantity, available: !paused && quantity <= stock, is_active: !paused } });
        }
        if (path === `/api/catalog/products/${product.id}`) return route.fulfill({ json: product });
        if (path === "/api/catalog/products") return route.fulfill({ json: { items: [product], pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 } } });
        if (path.startsWith("/api/catalog/")) return route.fulfill({ json: { items: [] } });
        throw new Error(`Unexpected URL: ${path}`);
      });
      const soldOut = page.getByRole("status").filter({ hasText: /^Hết hàng$/ });
      const add = page.locator("button[data-state]");
      const buy = page.getByRole("button", { name: /Mua ngay/ });
      const focus = () => page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.goto(base + `/main/product/${encodeURIComponent(product.id)}`);
      await soldOut.waitFor();
      assert.equal(await page.locator('p[data-state="sold_out"] strong').innerText(), "0");
      assert.equal(await add.count(), 0);
      assert.equal(await buy.count(), 0);
      assert.equal(await page.getByRole("textbox", { name: "Số lượng", exact: true }).count(), 0);

      stock = 1;
      await focus();
      await add.waitFor();
      await page.waitForFunction(() => document.querySelector("button[data-state]")?.disabled === false);
      assert.equal(await page.locator('p[data-state="available"] strong').innerText(), "1");
      assert.ok(await page.locator('p[data-state="available"]').evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize) >= 16));
      assert.equal(await page.locator('p[data-state="available"]').getByText(/SKU:/).count(), 0);
      await page.getByRole("textbox", { name: "Số lượng", exact: true }).fill("2");
      assert.equal(await page.getByRole("textbox", { name: "Số lượng", exact: true }).inputValue(), "1");
      assert.ok(await page.getByRole("button", { name: "Tăng số lượng", exact: true }).isDisabled());
      assert.ok(page.url().includes("/main/product/"));
      assert.equal(await soldOut.count(), 0, "Requesting too many units does not mark a product with remaining stock as sold out");

      stock = 0;
      await focus();
      await soldOut.waitFor();
      assert.equal(await add.count(), 0);
      assert.equal(await buy.count(), 0);

      failed = true;
      await focus();
      await page.getByRole("alert").filter({ hasText: "Không kiểm tra được tồn kho" }).waitFor();
      assert.equal(await soldOut.count(), 0, "An API failure is not reported as sold out");
      assert.equal(await buy.count(), 0);
      failed = false;
      stock = 3;
      await page.getByRole("button", { name: "Kiểm tra lại tồn kho", exact: true }).click();
      await buy.waitFor();
      await page.waitForFunction(() => document.querySelector("button[data-state]")?.disabled === false);
      assert.equal(await soldOut.count(), 0);
      assert.equal(await page.locator('p[data-state="available"] strong').innerText(), "3");
      paused = true;
      await focus();
      await page.getByRole("status").filter({ hasText: /^Tạm ngừng bán$/ }).waitFor();
      assert.ok((await page.locator('p[data-state="inactive"]').innerText()).includes("tạm ngừng"));
      assert.equal(await page.locator('p[data-state="inactive"] strong').count(), 0);
      paused = false;
      await focus();
      await buy.waitFor();
      assert.ok(requests.includes(1) && !requests.includes(2), "Typing above the limit clamps locally without requesting that quantity");

      stock = 0;
      await page.goto(base + "/main/product?view=list");
      const results = page.locator(width < 760 ? "#homepage2-results" : "#catalog-results");
      await results.getByRole("status").filter({ hasText: /^Hết hàng$/ }).waitFor();
      assert.equal(await results.locator("button[data-state]").count(), 0);
      if (width >= 760) {
        await results.getByRole("button", { name: `Ask about ${product.name}`, exact: true }).click();
        const preview = page.getByRole("dialog");
        await preview.getByRole("status").filter({ hasText: /^Hết hàng$/ }).waitFor();
        assert.equal(await preview.locator("button[data-state]").count(), 0);
        await preview.getByRole("button", { name: "Đóng xem nhanh", exact: true }).click();
      }
      stock = 2;
      await focus();
      await results.locator("button[data-state]").waitFor();
      await page.waitForFunction(() => document.querySelector("button[data-state]")?.disabled === false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: sold out hides actions/quantity; restock restores controls; quantity clamps to live stock; API failures remain distinct; focus refresh and retry`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
