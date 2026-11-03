// Browser fixtures; all API traffic is read-only and intercepted.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3001";
const product = { id: "P", sku: "CPU", name: "CPU kiểm thử", price: "2000000.00", currency: "VND", category: { id: "COMP", name: "Linh kiện" }, subcategory: { id: "CPU", name: "Vi xử lý" }, brand: "Intel", description: null, unit: "Cái", warranty_months: 12, images: [], specifications: [], specifications_text: null };
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined, args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], writes = [], facetRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      const req = route.request(), url = new URL(req.url()), endpoint = url.pathname;
      if (req.method() !== "GET") writes.push(endpoint);
      if (endpoint.endsWith("/auth/me") || endpoint.endsWith("/customer/me")) return route.fulfill({ status: 401, json: { error: { message: "Guest" } } });
      let json;
      if (endpoint.endsWith("/categories")) json = { items: [
        { id: "COMP", name: "Linh kiện", children: [{ id: "CPU", name: "Vi xử lý" }] },
        { id: "SCREEN", name: "Màn hình", children: [{ id: "IPS", name: "Màn hình IPS" }] },
      ] };
      else if (endpoint.endsWith("/facets")) {
        const category = url.searchParams.get("category_id"); facetRequests.push(category);
        json = category === "COMP"
          ? { total: 1, brands: [{ value: "Intel", label: "Intel", count: 1 }], specs: [{ key: "socket", label: "Socket", options: [{ value: "LGA1700", label: "LGA1700", count: 1 }] }] }
          : { total: 1, brands: [{ value: "Dell", label: "Dell", count: 1 }], specs: [{ key: "screen_size", label: "Kích thước", options: [{ value: "27 inch", label: "27 inch", count: 1 }] }] };
      } else if (endpoint.endsWith("/products")) json = { items: [product], pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 } };
      else json = { items: [] };
      return route.fulfill({ json });
    });
    const header = page.getByRole("banner");
    const menu = header.getByRole("navigation", { name: "Danh mục sản phẩm", exact: true });
    async function open() { await header.getByRole("button", { name: "Mở danh mục", exact: true }).click(); await menu.waitFor(); }
    await page.goto(base + "/main/profile");
    await open();
    const processor = menu.getByRole("link", { name: "LGA1700", exact: true });
    await processor.waitFor();
    await page.mouse.move(900, 150);
    await page.waitForTimeout(250);
    assert.ok(await processor.isVisible(), "Right panel remains open while pointer leaves the category row");
    await processor.click();
    await page.waitForURL(url => url.searchParams.has("spec"));
    let url = new URL(page.url());
    assert.equal(url.searchParams.get("category_id"), "COMP");
    assert.deepEqual(JSON.parse(url.searchParams.get("spec")), ["socket", "LGA1700"]);
    assert.equal(await menu.count(), 0);
    await open();
    await menu.getByRole("link", { name: "Màn hình", exact: true }).hover();
    await menu.getByRole("link", { name: "Dell", exact: true }).waitFor();
    assert.equal(await menu.getByRole("link", { name: "LGA1700", exact: true }).count(), 0);
    await menu.getByRole("link", { name: "Dell", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("brand") === "Dell");
    assert.equal(new URL(page.url()).searchParams.get("category_id"), "SCREEN");
    await open();
    await menu.getByRole("link", { name: "Linh kiện", exact: true }).focus();
    await menu.getByRole("link", { name: "5 – 10 triệu", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("min_price") === "5000000");
    url = new URL(page.url());
    assert.equal(url.searchParams.get("max_price"), "9999999");
    assert.equal(url.searchParams.get("category_id"), "COMP");
    assert.equal(url.searchParams.has("brand"), false);
    await open(); await page.keyboard.press("Escape");
    assert.equal(await menu.count(), 0);
    assert.ok(await header.getByRole("button", { name: "Mở danh mục", exact: true }).evaluate(el => el === document.activeElement));
    await open(); await page.mouse.click(20, 800);
    assert.equal(await menu.count(), 0, "Backdrop closes menu");
    await page.setViewportSize({ width: 1100, height: 800 }); await open();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 }); await openMobile();
    async function openMobile() {
      await header.getByRole("button", { name: "Mở danh mục", exact: true }).click();
      await page.getByRole("dialog", { name: "Danh mục sản phẩm", exact: true }).waitFor();
      assert.equal(await menu.count(), 0);
    }
    assert.ok(facetRequests.includes("COMP") && facetRequests.includes("SCREEN"));
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    console.log("PASS: two panels, scoped brand/spec/price links, hover and keyboard navigation, overlay dismissal, responsive layout and mobile drawer");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
