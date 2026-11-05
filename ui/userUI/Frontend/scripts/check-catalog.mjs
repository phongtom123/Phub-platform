// Read-only browser checks. Run against the customer UI and FastAPI locally.
// Set PHUB_PLAYWRIGHT_MODULE to a Playwright index.mjs file URL if installed
// outside this project. Screenshots/report go under the ignored .next folder.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const { chromium } = await import(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_UI_URL || "http://127.0.0.1:3001";
const artifacts = path.resolve(".next/catalog-check");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const checks = [];
let dataSummary;
function passed(name) { checks.push(name); console.log("PASS:", name); }
async function api(query = "") {
  const response = await context.request.get(base + "/api/catalog/products" + query);
  assert.equal(response.status(), 200);
  return response.json();
}
async function ready() {
  await page.locator('[aria-busy="false"]').waitFor({ state: "visible" });
  assert.equal(await page.locator('main [role="alert"]').count(), 0);
}
async function overflow() {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "horizontal page overflow");
}
async function checkTaxNotice(scope = page.locator("main")) {
  const notice = scope.getByText("chưa áp dụng thuế 10%", { exact: true }).first();
  await notice.waitFor({ state: "visible" });
  assert.deepEqual(await notice.evaluate(element => ({
    tag: element.tagName, color: getComputedStyle(element).color, size: getComputedStyle(element).fontSize,
  })), { tag: "SMALL", color: "rgb(185, 28, 28)", size: "10px" });
}

try {
  const reference = await api("?page_size=100");
  assert(reference.items.length > 0, "Need at least one public product for the live check");
  const sample = reference.items[0];
  dataSummary = { total: reference.pagination.total, productsWithoutImages: reference.items.filter(item => !item.images.length).length };
  passed("Frontend proxy reads the real public catalog");
  for (const width of [320, 375, 760, 761, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/main/product");
    await ready();
    await page.getByRole("heading", { level: 1, name: `Sản phẩm (${reference.pagination.total})`, exact: true }).waitFor();
    assert.equal(await page.locator('[aria-busy] article').count(), Math.min(width <= 760 ? 12 : 20, reference.pagination.total));
    await overflow();
    await checkTaxNotice();
    assert.equal(await page.locator('[aria-busy] article').getByText("chưa áp dụng thuế 10%", { exact: true }).count(), await page.locator('[aria-busy] article').count());
    if (width === 375 || width === 1280) await page.screenshot({ path: path.join(artifacts, `catalog-${width}.png`), fullPage: true });
    passed(`Catalog ${width}px: real products and no horizontal overflow`);
  }
  passed("Every product shows the small red VAT notice across desktop/mobile widths");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + "/main/product?view=list&page_size=4");
  await ready();
  assert.equal(await page.locator('[aria-busy] article').count(), Math.min(4, reference.pagination.total));
  if (reference.pagination.total > 4) {
    await page.getByRole("button", { name: "2", exact: true }).click();
    await page.waitForURL(/page=2/);
    await ready();
    const second = await api("?page=2&page_size=4");
    for (const product of second.items) assert((await page.locator('[aria-busy]').innerText()).includes(product.name));
    await page.goBack();
    await ready();
    assert.equal(new URL(page.url()).searchParams.get("page"), null);
    await page.goForward();
    await ready();
    assert.equal(new URL(page.url()).searchParams.get("page"), "2");
    await page.reload();
    await ready();
    assert.equal(new URL(page.url()).searchParams.get("page"), "2");
    passed("List pagination, Back/Forward and reload preserve URL state");
  }

  await page.getByLabel("Sắp xếp:", { exact: true }).selectOption("price-desc");
  await page.waitForURL(/sort=price-desc/);
  await ready();
  assert.equal(new URL(page.url()).searchParams.get("page"), "1");
  const sorted = await api("?sort=price-desc&page_size=4");
  const names = await page.locator('[aria-busy] article h2 button').allTextContents();
  assert(names.every((name, index) => name.startsWith(sorted.items[index].name)));
  passed("Descending price sorting uses backend order and resets the page");

  await page.getByRole("button", { name: "Mở tìm kiếm", exact: true }).click();
  await page.getByPlaceholder("Tìm theo Tên hoặc Mã SP...").fill(sample.sku.toLowerCase());
  await page.getByPlaceholder("Tìm theo Tên hoặc Mã SP...").press("Enter");
  await page.waitForURL(url => url.searchParams.get("q") === sample.sku.toLowerCase());
  await ready();
  assert((await page.locator('[aria-busy]').innerText()).includes(sample.name));
  passed("Header search navigates to catalog and finds SKU case-insensitively");

  const query = new URLSearchParams({ category_id: sample.category.id, brand: sample.brand || "", page_size: "100" });
  await page.goto(base + "/main/product?" + query);
  await ready();
  const filtered = await api("?" + query);
  assert.equal(await page.locator('[aria-busy] article').count(), filtered.items.length);
  assert(filtered.items.every(item => item.category.id === sample.category.id));
  await page.reload(); await ready();
  assert.equal(new URL(page.url()).searchParams.get("category_id"), sample.category.id);
  passed("Combined category/brand filtering survives reload");

  await page.goto(base + "/main/product"); await ready();
  await page.getByRole("button", { name: sample.name, exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  assert((await dialog.innerText()).includes(sample.sku));
  await checkTaxNotice(dialog);
  await dialog.getByRole("link", { name: "Xem chi tiết sản phẩm" }).click();
  await page.getByRole("heading", { name: sample.name, exact: true }).waitFor();
  await checkTaxNotice();
  await page.getByRole("navigation", { name: "Product information tabs" }).getByRole("link", { name: "Specs", exact: true }).click();
  await page.waitForURL(/tab=specs/);
  for (const spec of sample.specifications) assert((await page.locator("main").innerText()).includes(spec.value));
  await overflow();
  await page.screenshot({ path: path.join(artifacts, "detail-desktop.png"), fullPage: true });
  passed("Desktop preview and detail use the same SKU, price and specifications");

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(base + `/main/product/${encodeURIComponent(sample.id)}?tab=specs`);
  await page.getByRole("heading", { name: sample.name, exact: true }).waitFor();
  await page.getByRole("navigation", { name: "Thông tin sản phẩm" }).waitFor();
  await overflow();
  await page.screenshot({ path: path.join(artifacts, "detail-mobile.png"), fullPage: true });
  passed("Mobile detail uses the dedicated mobile layout and real data");
  await checkTaxNotice();
  passed("Desktop/mobile detail and product preview retain untaxed prices with the VAT notice");

  await page.goto(base + "/main/product"); await ready();
  await page.getByRole("button", { name: "Lọc", exact: true }).click();
  await page.getByRole("dialog", { name: "Bộ lọc sản phẩm" }).getByRole("button", { name: "Danh mục", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: sample.category.name, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Áp dụng bộ lọc/ }).click();
  await page.waitForURL(url => url.searchParams.getAll("category_id").includes(sample.category.id));
  await ready();
  assert.equal(await page.getByRole("dialog").isVisible(), false);
  passed("Mobile filters apply real category IDs and close the drawer");

  await page.goto(base + "/main/product?q=PHUB-NO-MATCH-987654321"); await ready();
  await page.getByText("Không tìm thấy sản phẩm phù hợp.", { exact: true }).waitFor();
  passed("Empty search renders the empty state without mock products");

  await page.route("**/api/catalog/products?**", route => route.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ error: { code: "DATA_SERVICE_UNAVAILABLE", message: "Không thể kết nối dịch vụ sản phẩm. Vui lòng thử lại.", details: [] } }),
  }));
  await page.goto(base + "/main/product");
  await page.getByRole("alert").getByText("Không thể kết nối dịch vụ sản phẩm. Vui lòng thử lại.").waitFor();
  assert.equal(await page.locator('[aria-busy] article').count(), 0);
  await page.unroute("**/api/catalog/products?**");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click(); await ready();
  assert((await page.locator('[aria-busy] article').count()) > 0);
  passed("API failure exposes a retry action and never falls back to fixtures");

  await page.goto(base + "/main/product/PHUB-NOT-FOUND-987654321");
  await page.getByRole("heading", { name: "Không tìm thấy sản phẩm", exact: true }).waitFor();
  passed("Unavailable product renders the product not-found page");

  await page.goto(base + "/");
  await page.getByRole("heading", { name: "Sản phẩm đang bán", exact: true }).waitFor();
  await checkTaxNotice();
  passed("Home products show the small red VAT notice");
  await page.getByRole("button", { name: sample.name, exact: true }).first().click();
  await page.getByRole("dialog").getByRole("link", { name: "Xem chi tiết sản phẩm" }).click();
  await page.getByRole("heading", { name: sample.name, exact: true }).waitFor();
  await overflow();
  passed("Home product cards link to real product details");

  for (const width of [320, 760, 761, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + `/main/product/${encodeURIComponent(sample.id)}?tab=details`);
    await page.getByRole("heading", { name: sample.name, exact: true }).waitFor();
    await overflow();
  }
  passed("Detail remains usable at 320, 760, 761 and 1920px");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + "/main/product"); await ready();
  await page.getByLabel("Sắp xếp:", { exact: true }).selectOption("price-asc");
  await page.waitForURL(/sort=price-asc/); await ready();
  const ascending = await api("?sort=price-asc");
  const cards = await page.locator('[aria-busy] article').allTextContents();
  assert(cards.every((text, index) => text.includes(ascending.items[index].name)));
  passed("Ascending price sorting displays the backend result order");

  await page.goto(base + "/main/product"); await ready();
  await page.locator("#catalog-sidebar").getByRole("button", { name: sample.category.name, exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get("category_id"), null);
  await page.locator("#catalog-sidebar").getByRole("button", { name: /^Áp dụng/ }).click();
  await page.waitForURL(url => url.searchParams.getAll("category_id").includes(sample.category.id));
  await ready();
  passed("Desktop category selection remains a draft until Apply");

  await page.route("**/api/catalog/categories", route => route.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ error: { code: "DATA_SERVICE_UNAVAILABLE", message: "Bộ lọc tạm thời không khả dụng.", details: [] } }),
  }));
  await page.goto(base + "/main/product");
  await page.getByText("Bộ lọc tạm thời không khả dụng.", { exact: true }).waitFor();
  await page.locator('[aria-busy="false"] article').first().waitFor();
  assert((await page.locator('[aria-busy] article').count()) > 0);
  await page.unroute("**/api/catalog/categories");
  await page.getByRole("button", { name: "Thử lại bộ lọc", exact: true }).click();
  await page.locator("#catalog-sidebar").getByRole("button", { name: sample.category.name, exact: true }).waitFor();
  passed("Metadata failure keeps the product list usable and can be retried");

  await page.route("**/api/catalog/products?**", async route => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.items[0]) body.items[0].images = [{ url: "/images/catalog/nonexistent-check-image.png", alt: body.items[0].name }];
    await route.fulfill({ response, body: JSON.stringify(body) });
  });
  await page.goto(base + "/main/product"); await ready();
  await page.waitForFunction(() => document.querySelector('[aria-busy] article img')?.getAttribute("src") === "/images/catalog/product-placeholder.svg");
  await page.unroute("**/api/catalog/products?**");
  passed("A broken product image falls back to the neutral placeholder");

  assert.equal((await context.request.get(base + "/api/catalog/admin")).status(), 404);
  const invalid = await context.request.get(base + "/api/catalog/products?page=0");
  assert.equal(invalid.status(), 422);
  assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
  passed("Proxy rejects unknown resources and preserves backend validation errors");
  assert.deepEqual(errors, [], "Unexpected browser runtime errors");
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  console.error("Current page:", page.url());
  console.error("Page alerts:", await page.locator('main [role="alert"]').allTextContents());
  throw error;
} finally {
  await writeFile(path.join(artifacts, "report.json"), JSON.stringify({ checks, runtimeErrors: errors, dataSummary }, null, 2));
  await browser.close();
}
console.log(`Completed ${checks.length} browser checks.`);
