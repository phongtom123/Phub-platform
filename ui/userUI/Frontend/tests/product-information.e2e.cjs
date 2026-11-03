// Real public product reads; long copy is a browser DOM fixture, never a DB edit.
const assert = require("node:assert/strict");
const os = require("node:os"), path = require("node:path");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3001";
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined, args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    const reference = await browser.newContext();
    const id = process.env.PHUB_PRODUCT_TEST_ID || "SP037";
    const response = await reference.request.get(`${base}/api/catalog/products/${id}?include_inactive=true`);
    assert.equal(response.status(), 200);
    const product = await response.json();
    await reference.close();
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 980 } });
      const page = await context.newPage();
      const errors = [], writes = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => { if (request.url().includes("/api/") && request.method() !== "GET") writes.push(request.url()); });
      await page.route("**/api/**", route => {
        const endpoint = new URL(route.request().url()).pathname;
        if (endpoint.endsWith("/me")) return route.fulfill({ status: 401, json: { error: { message: "Guest" } } });
        if (endpoint === "/api/catalog/availability") return route.fulfill({ json: { items: [{ sku: product.sku, available_quantity: 10 }], tax_rate: "10.00", currency: "VND" } });
        if (endpoint.endsWith("/availability")) return route.fulfill({ json: { id: product.id, sku: product.sku, quantity: 1, available: true, is_active: true } });
        return route.continue();
      });
      await page.goto(`${base}/main/product/${id}?tab=specs`);
      const description = page.getByRole("region", { name: "Mô tả sản phẩm", exact: true });
      const specs = page.getByRole("region", { name: "Thông số kỹ thuật", exact: true });
      await description.getByRole("heading").waitFor();
      await specs.getByRole("table").waitFor();
      assert.equal(await page.getByRole("tablist").count(), 0);
      assert.equal(await page.locator('a[href*="?tab="]').count(), 0);
      assert.ok((await description.innerText()).includes(product.description || "Chưa có mô tả sản phẩm."));
      assert.ok((await specs.innerText()).includes(product.sku));
      await description.locator("p").evaluate(element => { element.textContent = Array.from({ length: 30 }, (_, i) => `Đoạn nội dung kiểm thử ${i + 1}: mô tả cấu hình sản phẩm. Dữ liệu chỉ thay trong trình duyệt kiểm thử.`).join("\n\n"); });
      const more = description.getByRole("button", { name: "Xem thêm mô tả sản phẩm", exact: true });
      await more.waitFor(); await more.scrollIntoViewIfNeeded();
      const clipped = await description.locator('[id$="-content"]').evaluate(el => el.getBoundingClientRect().height);
      assert.ok(clipped <= 241);
      const previousUrl = page.url();
      await more.click();
      const less = description.getByRole("button", { name: "Thu gọn mô tả sản phẩm", exact: true });
      assert.equal(await less.getAttribute("aria-expanded"), "true");
      assert.ok(await description.locator('[id$="-content"]').evaluate(el => el.getBoundingClientRect().height) > clipped + 100);
      assert.equal(page.url(), previousUrl, "Expanding does not navigate to another tab/route");
      await less.click();
      assert.equal(await more.getAttribute("aria-expanded"), "false");
      assert.ok(await description.locator('[id$="-content"]').evaluate(el => el.getBoundingClientRect().height) <= 241);
      const specMore = specs.getByRole("button", { name: "Xem thêm thông số kỹ thuật", exact: true });
      await specMore.click();
      assert.equal(await specs.getByRole("button", { name: "Thu gọn thông số kỹ thuật", exact: true }).getAttribute("aria-expanded"), "true");
      for (const row of product.specifications) assert.ok((await specs.getByRole("table").innerText()).includes(row.value));
      await specs.getByRole("button", { name: "Thu gọn thông số kỹ thuật", exact: true }).click();
      assert.equal(await more.getAttribute("aria-expanded"), "false", "Sections expand independently");
      // Short text does not receive an unnecessary expand control.
      await description.locator("p").evaluate(el => { el.textContent = "Mô tả ngắn."; });
      await more.waitFor({ state: "detached" });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await specs.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(os.tmpdir(), `phub-product-information-${width}.png`), fullPage: false });
      assert.deepEqual(errors, []); assert.deepEqual(writes, []);
      console.log(`PASS ${width}px: legacy URL shows both sections, independent expand/collapse, short-copy handling, no horizontal overflow or writes`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
