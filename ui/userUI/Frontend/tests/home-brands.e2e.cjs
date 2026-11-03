// Fixture-only catalog responses. No database or account mutations.
const assert = require("node:assert/strict");
const os = require("node:os"), path = require("node:path");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3001";
const names = ["Acer", "AMD", "Apple", "ASUS", "Corsair", "Dell", "Intel", "Kingston", "Lenovo", "LG", "Samsung", "Sony", "Xiaomi", "Chưa có logo"];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined, args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], writes = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== "GET") writes.push(url.pathname);
      if (url.pathname.endsWith("/me")) return route.fulfill({ status: 401, json: { error: { message: "Guest" } } });
      if (url.pathname.endsWith("/brands")) return route.fulfill({ json: { items: names.map(name => ({ name })) } });
      if (url.pathname.endsWith("/products")) return route.fulfill({ json: { items: [], pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 } } });
      return route.fulfill({ json: { items: [] } });
    });
    await page.goto(base + "/main/landing");
    const section = page.getByRole("region", { name: "Thương hiệu sản phẩm", exact: true });
    await section.scrollIntoViewIfNeeded();
    const acer = section.getByRole("link", { name: "Xem sản phẩm Acer", exact: true });
    await acer.locator("img").waitFor();
    assert.ok(await acer.locator("img").evaluate(async image => { await image.decode(); return image.naturalWidth > 0; }));
    assert.equal(await section.getByRole("link").count(), names.length);
    assert.equal(await section.getByRole("link", { name: "Xem sản phẩm Chưa có logo", exact: true }).locator("img").count(), 0);
    assert.ok(await section.getByRole("button", { name: "Thương hiệu trước", exact: true }).isDisabled());
    const next = section.getByRole("button", { name: "Thương hiệu tiếp theo", exact: true });
    await next.click();
    await section.getByRole("button", { name: "Thương hiệu trước", exact: true }).click();
    await acer.click();
    await page.waitForURL(url => url.pathname === "/main/product" && url.searchParams.get("brand") === "Acer");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/main/landing");
    await section.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(os.tmpdir(), "phub-brands-mobile.png"), fullPage: false });
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    console.log("PASS: real local SVG loads, brand links, image fallback, carousel controls and mobile overflow");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
