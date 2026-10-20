// HTTP fixtures only: no records are written to a database.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3000";
const categories = [
  { id: "CPU", name: "Linh kiện", children: [{ id: "CPU_PROCESSOR", name: "Bộ vi xử lý" }, { id: "CPU_RAM", name: "Bộ nhớ RAM" }] },
  { id: "PC", name: "Máy Tính Để Bàn", children: [{ id: "PC_GAMING", name: "PC Gaming" }] },
  { id: "MONITOR", name: "Màn Hình", children: [{ id: "MONITOR_GAMING", name: "Màn hình Gaming" }] },
  { id: "ACCESSORY", name: "Phụ kiện", children: [{ id: "ACCESSORY_MOUSE", name: "Chuột" }] },
];

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let mode = "tree";
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/auth/me")) return route.fulfill({ status: 401, json: { detail: "Not signed in" } });
      if (path.endsWith("/categories")) {
        if (mode === "error") return route.fulfill({ status: 503, json: { error: { message: "Catalog unavailable" } } });
        return route.fulfill({ json: { items: mode === "empty" ? [] : categories } });
      }
      if (path.endsWith("/products")) return route.fulfill({ json: { items: [], pagination: { total: 0, total_pages: 0, page: 1, page_size: 20 } } });
      return route.fulfill({ json: { items: [] } });
    });
    await page.goto(base + "/main/product");
    const header = page.locator("header");
    const nav = header.getByRole("navigation", { name: "Danh mục sản phẩm", exact: true });
    const componentsLink = nav.getByRole("link", { name: "Linh kiện", exact: true });
    await componentsLink.waitFor();
    assert.equal(await nav.getByRole("link").count(), categories.length + 1);
    assert.equal(await nav.getByRole("button").count(), 0);
    await componentsLink.hover();
    const megaMenu = header.getByRole("region", { name: "Danh mục Linh kiện" });
    await megaMenu.getByRole("link", { name: "Bộ vi xử lý", exact: true }).waitFor();
    assert.equal(await megaMenu.getByRole("link", { name: "Bộ nhớ RAM", exact: true }).count(), 1);
    await componentsLink.click();
    await page.waitForURL("**/main/product?category_id=CPU");

    await page.setViewportSize({ width: 390, height: 844 });
    await header.getByRole("button", { name: "Mở danh mục", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Danh mục sản phẩm" });
    for (const category of categories) {
      assert.equal(await drawer.getByRole("button", { name: category.name, exact: true }).count(), 1);
    }
    await drawer.getByRole("button", { name: "Bộ nhớ RAM", exact: true }).click();
    await page.waitForURL("**/main/product?subcategory_id=CPU_RAM");
    assert.equal(await drawer.isVisible(), false);
    await header.getByRole("button", { name: "Mở danh mục", exact: true }).click();
    await drawer.getByRole("button", { name: "Tất cả sản phẩm", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/main/product" && !url.search);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await header.getByRole("button", { name: "Mở danh mục", exact: true }).click();
    await page.keyboard.press("Escape");
    assert.equal(await drawer.isVisible(), false);

    mode = "error";
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.reload();
    await nav.getByRole("button", { name: "Thử lại" }).waitFor();
    mode = "tree";
    await nav.getByRole("button", { name: "Thử lại" }).click();
    await nav.getByRole("link", { name: "Linh kiện", exact: true }).waitFor();
    mode = "empty";
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('header [role="status"]'));
    assert.equal(await nav.getByRole("link").count(), 1);
    assert.deepEqual(errors, []);
    console.log("PASS: category tree, desktop mega menu, mobile navigation, Escape, empty/error/retry, no overflow.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
