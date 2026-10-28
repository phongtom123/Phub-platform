// Only isolated localhost fixtures. Never writes the shared Supabase database.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = await import(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const ui = process.env.PHUB_UI_URL || "http://127.0.0.1:13001";
const backend = process.env.PHUB_E2E_BACKEND_URL || "http://127.0.0.1:18001";
const key = process.env.PHUB_E2E_CONTROL_KEY;
for (const url of [ui, backend]) assert.equal(new URL(url).hostname, "127.0.0.1");
assert(key?.length >= 32);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const checks = [], errors = [];
page.on("pageerror", error => errors.push(error.message));
const artifacts = path.resolve(".next/checkout-review-check");
await mkdir(artifacts, { recursive: true });
const pass = name => { checks.push(name); console.log("PASS:", name); };
const control = async body => {
  const result = await context.request.post(backend + "/__e2e/control", { headers: { "x-e2e-key": key }, data: body });
  assert.equal(result.status(), 200);
};
try {
  const spec = await (await context.request.get(backend + "/openapi.json")).json();
  assert.match(spec.info.title, /Isolated shopping fixtures/);
  await control({ reset: true, missing_address: true });
  assert.equal((await context.request.post(backend + "/__e2e/session", {
    headers: { "x-e2e-key": key }, data: { customer: "KH-A" },
  })).status(), 200);
  await page.goto(ui + "/main/product/P-A");
  await page.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  await page.getByRole("button", { name: "Giỏ hàng, 1 sản phẩm", exact: true }).waitFor();
  await page.goto(ui + "/cart");
  await page.getByLabel("Số lượng SKU-A", { exact: true }).fill("3");
  const total = page.locator('p[class*="selectedTotal"]');
  await total.getByText(/300\.000,30/).waitFor();
  assert(await total.evaluate(element => {
    const checkout = document.querySelector('[class*="cartActions"] button:last-child');
    return element.getBoundingClientRect().bottom <= checkout.getBoundingClientRect().top;
  }));
  await page.getByRole("checkbox").uncheck();
  await total.getByText(/^0,00/).waitFor();
  assert(await page.getByRole("button", { name: "Thanh toán", exact: true }).isDisabled());
  await page.getByRole("button", { name: "Chọn tất cả", exact: true }).click();
  await total.getByText(/300\.000,30/).waitFor();
  pass("Selected total is exact, sits above checkout and updates on selection/quantity");

  await page.route("**/api/customer/checkout/quote", route => route.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ error: { code: "CHECKOUT_DATABASE_NOT_READY", message: "Not ready", details: [] } }),
  }));
  await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
  await page.waitForURL(ui + "/checkout");
  const save = page.getByRole("button", { name: "Lưu", exact: true });
  await save.waitFor();
  assert(await save.isEnabled());
  await page.getByLabel("Địa chỉ chi tiết", { exact: true }).fill("456 Đường thử lưu");
  await page.getByLabel("Tỉnh / thành phố", { exact: true }).fill("TP Hồ Chí Minh");
  await page.getByLabel("Xã / phường", { exact: true }).fill("Phường thử lưu");
  const saved = page.waitForResponse(response => response.url().endsWith("/api/customer/me") && response.request().method() === "PUT");
  await save.click();
  assert.equal((await saved).status(), 200);
  await page.waitForURL(ui + "/checkout/confirm");
  await page.getByRole("heading", { name: "Địa chỉ nhận hàng", exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Họ tên", exact: true }).count(), 0);
  assert((await (await context.request.get(ui + "/api/customer/me")).json()).address_line === "456 Đường thử lưu");
  await page.getByText("456 Đường thử lưu, Phường thử lưu, TP Hồ Chí Minh", { exact: true }).waitFor();
  await page.locator("main").getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("Giá cuối cùng", { exact: true }).innerText(), "");
  assert.equal(await page.getByRole("combobox", { name: "Phương thức thanh toán", exact: true }).inputValue(), "bank_transfer");
  const invoicePreview = page.getByRole("region", { name: "Hóa đơn", exact: true });
  await invoicePreview.getByRole("columnheader", { name: "Đơn giá", exact: true }).waitFor();
  await invoicePreview.getByRole("columnheader", { name: "Thành tiền trước thuế", exact: true }).waitFor();
  assert(await page.getByRole("button", { name: "Đặt đơn", exact: true }).isDisabled());
  pass("Save works independently of quote; confirmation shows line prices and method; final quote remains blank when unavailable");
  await page.screenshot({ path: path.join(artifacts, "confirmation-missing-services.png"), fullPage: true });

  await page.unroute("**/api/customer/checkout/quote");
  await page.reload();
  await page.getByLabel("Giá cuối cùng", { exact: true }).filter({ hasText: /300\.000,30/ }).waitFor();
  await page.goto(ui + "/cart");
  await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
  await page.waitForURL(ui + "/checkout/confirm");
  await page.getByRole("link", { name: "Sửa thông tin nhận hàng", exact: true }).click();
  await page.getByRole("button", { name: "Lưu", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Địa chỉ chi tiết", { exact: true }).inputValue(), "456 Đường thử lưu");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.waitForURL(ui + "/checkout/confirm");
  await page.getByLabel("Mã voucher", { exact: true }).fill("SAVE10");
  await page.getByRole("button", { name: "Áp dụng voucher", exact: true }).click();
  await page.getByLabel("Giá cuối cùng", { exact: true }).filter({ hasText: /270\.000,27/ }).waitFor();
  pass("Existing profile skips form, edit is optional, voucher and final price use backend quote");

  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(artifacts, `confirmation-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Đặt đơn", exact: true }).click();
  await page.waitForURL(/\/main\/orders\/E2E-ORDER-1/);
  const order = await (await context.request.get(ui + "/api/customer/orders/E2E-ORDER-1")).json();
  assert.equal(order.recipient.address_line, "456 Đường thử lưu");
  assert.equal(order.total, "270000.27");
  const payments = await (await context.request.get(ui + "/api/customer/orders/E2E-ORDER-1/payments")).json();
  assert.equal(payments.latest_transaction, null);
  assert(!/PRIVATE-REFERENCE|PRIVATE-PAYMENT-ID|ma_giao_dich/.test(await page.locator("main").innerText()));
  assert.deepEqual(errors, []);
  pass("Confirmation fits desktop/mobile and creates fixture order with saved address, without claiming payment/invoice");
  await writeFile(path.join(artifacts, "report.json"), JSON.stringify({ checks, errors, sharedDatabaseWrites: 0 }, null, 2));
  await control({ reset: true });
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true });
  throw error;
} finally { await context.close(); await browser.close(); }
