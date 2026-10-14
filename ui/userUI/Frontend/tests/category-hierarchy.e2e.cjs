// Local HTTP fixtures only. No accounts, products or categories are written to a live DB.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3101";
const categories = [
  { id: "PARTS", name: "Linh Kiện PC", parent_id: null },
  { id: "CPU", name: "Vi xử lý", parent_id: "PARTS" },
  { id: "INTEL", name: "CPU Intel", parent_id: "CPU" },
  { id: "RAM", name: "Bộ nhớ RAM", parent_id: "PARTS" },
  { id: "PC", name: "Máy Tính Để Bàn", parent_id: null },
  { id: "MONITOR", name: "Màn Hình Gaming", parent_id: null },
  { id: "ACCESSORIES", name: "Phụ Kiện", parent_id: null },
  { id: "MOUSE", name: "Chuột", parent_id: "ACCESSORIES" },
];

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
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
    await nav.getByRole("link", { name: "Linh Kiện PC", exact: true }).waitFor();
    assert.equal(await nav.getByRole("link").count(), 5);
    await nav.getByRole("button", { name: "Danh mục con của Linh Kiện PC" }).click();
    const submenu = header.getByRole("navigation", { name: "Danh mục con của Linh Kiện PC", exact: true });
    await submenu.getByRole("link", { name: "CPU Intel", exact: true }).waitFor();
    assert.equal(await submenu.getByRole("link", { name: "Chuột", exact: true }).count(), 0);
    if (process.env.PHUB_CATEGORY_SCREENSHOT) await page.screenshot({ path: process.env.PHUB_CATEGORY_SCREENSHOT });
    await page.keyboard.press("Escape");
    assert.equal(await submenu.isVisible(), false);
    await nav.getByRole("link", { name: "Linh Kiện PC", exact: true }).click();
    await page.waitForURL("**/main/product?category_id=PARTS");
    await nav.getByRole("button", { name: "Danh mục con của Phụ Kiện" }).click();
    await header.getByRole("navigation", { name: "Danh mục con của Phụ Kiện", exact: true }).getByRole("link", { name: "Chuột", exact: true }).click();
    await page.waitForURL("**/main/product?category_id=MOUSE");

    await page.setViewportSize({ width: 390, height: 844 });
    await header.getByRole("button", { name: "Mở danh mục", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Danh mục sản phẩm" });
    await drawer.getByRole("button", { name: "Linh Kiện PC", exact: true }).click();
    await drawer.getByRole("button", { name: "Vi xử lý", exact: true }).click();
    await drawer.getByRole("button", { name: "CPU Intel", exact: true }).waitFor();
    await drawer.getByRole("button", { name: "← Quay lại" }).click();
    await drawer.getByRole("button", { name: "Bộ nhớ RAM", exact: true }).click();
    await page.waitForURL("**/main/product?category_id=RAM");
    assert.equal(await drawer.isVisible(), false);
    await header.getByRole("button", { name: "Mở danh mục", exact: true }).click();
    await drawer.getByRole("button", { name: "Tất cả sản phẩm", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/main/product" && !url.search);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    mode = "error";
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.reload();
    await nav.getByRole("button", { name: "Thử lại" }).waitFor();
    mode = "tree";
    await nav.getByRole("button", { name: "Thử lại" }).click();
    await nav.getByRole("link", { name: "Linh Kiện PC", exact: true }).waitFor();
    mode = "empty";
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('header [role="status"]'));
    assert.equal(await nav.getByRole("link").count(), 1);
    assert.deepEqual(errors, []);
    console.log("PASS: DB-driven roots, nested dropdowns, parent/child navigation, mobile/back, empty/error/retry, no overflow.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
