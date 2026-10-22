// Exercise the manual test entry point through UI actions, on isolated local fixtures only.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = await import(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const backend = process.env.PHUB_E2E_BACKEND_URL || "http://127.0.0.1:18001";
const ui = process.env.PHUB_UI_URL || "http://127.0.0.1:13001";
for (const url of [backend, ui]) {
  assert.equal(new URL(url).hostname, "127.0.0.1", "Only isolated loopback servers are allowed");
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const artifacts = path.resolve(".next/manual-shopping-check");
await mkdir(artifacts, { recursive: true });
try {
  const schema = await (await context.request.get(backend + "/openapi.json")).json();
  assert.match(schema.info.title, /Isolated shopping fixtures/);
  await page.goto(backend + "/__manual");
  await page.getByRole("button", { name: "Reset dữ liệu thử", exact: true }).click();
  await page.getByRole("link", { name: "Mở giao diện với khách A", exact: true }).click();
  await page.waitForURL(ui + "/main/product");
  const profile = await (await context.request.get(ui + "/api/customer/me")).json();
  assert.equal(profile.customer_id, "KH-A");
  await page.goto(ui + "/main/product/P-A");
  await page.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  await page.getByRole("button", { name: "Giỏ hàng, 1 sản phẩm", exact: true }).waitFor();
  await page.goto(ui + "/cart");
  await page.getByLabel("Mã voucher").fill("SAVE10");
  await page.getByRole("button", { name: "Áp dụng voucher", exact: true }).click();
  await page.getByText("Giảm giá (SAVE10)", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
  await page.waitForURL(ui + "/checkout/confirm?voucher=SAVE10");
  await page.getByRole("button", { name: "Đặt đơn", exact: true }).click();
  await page.waitForURL(/\/main\/orders\/E2E-ORDER-1/);
  const orderUrl = page.url();
  const detail = await (await context.request.get(ui + "/api/customer/orders/E2E-ORDER-1")).json();
  assert.equal(detail.total, "90000.09");
  await page.getByText("Chưa có giao dịch. Đơn đang chờ ghi nhận thanh toán.", { exact: true }).waitFor();
  console.log("PASS: manual customer session -> product -> cart -> voucher -> checkout -> order through UI");
  for (const scenario of [
    { button: "Giao dịch đang chờ", status: "Đang chờ xử lý" },
    { button: "Giao dịch thành công", status: "Thành công" },
    { button: "Giao dịch hoàn tiền", status: "Thành công", refund: true },
  ]) {
    await page.goto(backend + "/__manual");
    await page.getByRole("button", { name: scenario.button, exact: true }).click();
    await page.goto(orderUrl);
    await page.locator("#payments").getByText(scenario.status, { exact: true }).first().waitFor();
    if (scenario.refund) {
      await page.locator("#payments").getByText(/Khoản hoàn tiền đã được ghi nhận thành công/).first().waitFor();
    }
    assert(!(await page.locator("main").innerText()).includes("PRIVATE-MANUAL"));
    console.log("PASS: " + scenario.button + " displayed in the customer order UI");
  }
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(artifacts, `order-${width}.png`), fullPage: true });
  }
  await page.goto(backend + "/__manual");
  await page.getByRole("link", { name: "Mở với khách B để kiểm tra quyền xem đơn", exact: true }).click();
  assert.equal((await context.request.get(ui + "/api/customer/orders/E2E-ORDER-1")).status(), 404);
  await page.goto(backend + "/__manual");
  await page.getByRole("button", { name: "Reset dữ liệu thử", exact: true }).click();
  assert.deepEqual(errors, []);
  await writeFile(path.join(artifacts, "report.json"), JSON.stringify({ mode: "isolated manual fixture UI, simulated authentication", checks: 5, errors }, null, 2));
  console.log("5 manual UI checks passed; fixtures reset for the user");
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
