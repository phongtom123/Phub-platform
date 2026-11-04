// Browser regressions on the real local Supabase UI. No database writes.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = await import(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = "http://127.0.0.1:3001";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const artifacts = path.resolve(".next/customer-review-check");
await mkdir(artifacts, { recursive: true });
const checks = [];
function pass(message) { checks.push(message); console.log("PASS: " + message); }
async function ready() { await page.locator('[aria-busy="false"]').waitFor(); }
async function api(query = "") {
  const response = await context.request.get(base + "/api/catalog/products" + query);
  assert.equal(response.status(), 200);
  return response.json();
}
function quoteFor(skus) {
  const wanted = [...skus].sort().join(",");
  return page.waitForResponse(response => {
    if (!response.url().endsWith("/api/customer/checkout/quote") || response.request().method() !== "POST") return false;
    return response.request().postDataJSON().items.map(item => item.sku).sort().join(",") === wanted;
  });
}
try {
  const schema = await (await context.request.get("http://127.0.0.1:8001/openapi.json")).json();
  assert.match(schema.info.title, /LOCAL Supabase testing/);
  assert.equal((await context.request.get(base + "/api/customer/me")).status(), 200);
  const reference = await api("?page_size=100");
  assert(reference.items.length >= 2);
  const [first, second] = reference.items;
  const prices = [...new Set(reference.items.map(p => Number(p.price)))].sort((a, b) => a - b);
  const min = String(prices[0]), max = String(prices[Math.min(2, prices.length - 1)]);
  await page.goto(base + "/main/product?page=2");
  await ready();
  const sidebar = page.getByRole("complementary", { name: "Bộ lọc sản phẩm", exact: true });
  await sidebar.getByText("Khoảng giá", { exact: true }).click();
  await sidebar.getByLabel("Giá từ (₫)", { exact: true }).fill(min);
  await sidebar.getByLabel("Giá đến (₫)", { exact: true }).fill(max);
  await sidebar.getByRole("button", { name: /^Áp dụng/ }).click();
  await page.waitForURL(url => url.searchParams.get("min_price") === min && url.searchParams.get("page") === "1");
  await ready();
  const range = await api(`?min_price=${min}&max_price=${max}&page_size=100`);
  assert.equal(range.pagination.total, reference.items.filter(p => Number(p.price) >= Number(min) && Number(p.price) <= Number(max)).length);
  assert.equal(await page.locator('[aria-busy] article').count(), Math.min(20, range.pagination.total));
  await sidebar.getByText("Màu sắc", { exact: true }).click();
  await sidebar.getByRole("button", { name: "Chưa có thông tin màu sắc", exact: true }).click();
  await sidebar.getByText("Tình trạng tồn kho", { exact: true }).click();
  await sidebar.getByRole("button", { name: "Hết hàng", exact: true }).click();
  await sidebar.getByRole("button", { name: /^Áp dụng/ }).click();
  await page.waitForURL(url => url.searchParams.get("stock_status") === "out-of-stock" && url.searchParams.get("color") === "__unspecified__");
  await ready();
  const empty = await api(`?min_price=${min}&max_price=${max}&color=__unspecified__&stock_status=out-of-stock`);
  assert.equal(await page.locator('[aria-busy] article').count(), Math.min(20, empty.pagination.total));
  await page.reload();
  await ready();
  assert.equal(new URL(page.url()).searchParams.get("min_price"), min);
  await sidebar.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await page.waitForURL(url => !url.searchParams.has("stock_status") && !url.searchParams.has("min_price"));
  await ready();
  pass("Desktop price/color/stock filters reach backend, combine, reset page and survive reload");

  await page.goto(base + "/");
  await page.locator("article").getByRole("button", { name: first.name, exact: true }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("link", { name: "Xem chi tiết sản phẩm", exact: true }).waitFor();
  assert.equal(await dialog.getByRole("link", { name: "Xem chi tiết sản phẩm", exact: true }).count(), 1);
  assert.equal(await dialog.getByRole("button", { name: "Tiếp tục xem sản phẩm", exact: true }).count(), 0);
  await dialog.getByRole("button", { name: "Thêm vào giỏ hàng", exact: true }).click();
  await page.getByRole("button", { name: "Giỏ hàng, 1 sản phẩm", exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Đóng cửa sổ", exact: true }).click();
  await page.locator("article").getByRole("button", { name: second.name, exact: true }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("link", { name: "Xem chi tiết sản phẩm", exact: true }).click();
  await page.waitForURL(base + "/main/product/" + encodeURIComponent(second.id));
  await page.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  await page.getByRole("button", { name: "Giỏ hàng, 2 sản phẩm", exact: true }).waitFor();
  pass("Home preview has detail/add buttons, actually adds and opens the matching product");

  await page.goto(base + "/cart");
  const items = page.getByRole("region", { name: "Sản phẩm trong giỏ", exact: true });
  const circles = items.getByRole("checkbox");
  await circles.nth(1).waitFor();
  const actions = page.locator('[class*="cartActions"]');
  assert.equal(await actions.getByRole("button").count(), 2);
  assert.equal(await actions.getByRole("link").count(), 0);
  let quote = quoteFor([second.sku]);
  await circles.nth(0).uncheck();
  await quote;
  await page.reload();
  await circles.nth(1).waitFor();
  assert.equal(await circles.nth(0).isChecked(), false);
  assert.equal(await circles.nth(1).isChecked(), true);
  await circles.nth(1).uncheck();
  assert(await actions.getByRole("button", { name: "Thanh toán", exact: true }).isDisabled());
  quote = quoteFor([first.sku, second.sku]);
  await actions.getByRole("button", { name: "Chọn tất cả", exact: true }).click();
  await quote;
  assert(await circles.nth(0).isChecked() && await circles.nth(1).isChecked());
  quote = quoteFor([second.sku]);
  await circles.nth(0).uncheck();
  await quote;
  const checkoutQuote = quoteFor([second.sku]);
  await actions.getByRole("button", { name: "Thanh toán", exact: true }).click();
  await checkoutQuote;
  const profile = await (await context.request.get(base + "/api/customer/me")).json();
  if ([profile.name, profile.phone, profile.address_line, profile.province, profile.ward].every(value => value?.trim())) {
    await page.waitForURL(base + "/checkout/confirm");
    await page.getByRole("heading", { name: "Xác nhận đơn hàng", exact: true }).waitFor();
  } else {
    await page.waitForURL(base + "/checkout");
    await page.getByRole("heading", { name: "Thông tin người nhận", exact: true }).waitFor();
  }
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem(`phub-cart-v1:${id}`)), profile.customer_id);
  assert.equal(saved.length, 2);
  assert.equal(saved.filter(line => line.selected).length, 1);
  pass("Cart has exactly two footer buttons; selection persists; quote/checkout only include selected SKU");

  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/cart");
    await circles.nth(1).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(artifacts, `cart-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(base + "/main/product");
  await ready();
  await page.getByRole("button", { name: "Lọc", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Bộ lọc sản phẩm", exact: true });
  await dialog.getByRole("button", { name: "Giá", exact: true }).click();
  await dialog.getByLabel("Giá từ (₫)", { exact: true }).fill(min);
  await dialog.getByLabel("Giá đến (₫)", { exact: true }).fill(max);
  await dialog.getByRole("button", { name: "Chưa có thông tin màu sắc", exact: true }).click();
  await dialog.getByRole("button", { name: "Tình trạng tồn kho", exact: true }).click();
  await dialog.getByRole("button", { name: "Còn hàng", exact: true }).click();
  await dialog.getByRole("button", { name: /^Áp dụng bộ lọc/ }).click();
  await page.waitForURL(url => url.searchParams.get("stock_status") === "in-stock" && url.searchParams.get("max_price") === max);
  await ready();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(artifacts, "mobile-filter-results.png"), fullPage: true });
  pass("Mobile filters and round cart selections fit 320/375px and desktop");
  assert.deepEqual(errors, []);
  await writeFile(path.join(artifacts, "report.json"), JSON.stringify({ mode: "real Supabase read-only; automatic local customer", checks, errors, databaseWrites: 0 }, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
