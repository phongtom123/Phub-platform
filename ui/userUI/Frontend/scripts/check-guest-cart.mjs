import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const localPlaywright = pathToFileURL(path.join(
  process.env.TEMP || process.env.TMPDIR || ".",
  "phub-catalog-tools/node_modules/playwright/index.mjs",
)).href;
const { chromium } = await import(
  process.env.PHUB_PLAYWRIGHT_MODULE || localPlaywright
);

const ui = process.env.PHUB_UI_URL || "http://127.0.0.1:13001";
const backend = process.env.PHUB_E2E_BACKEND_URL || "http://127.0.0.1:8000";
const key = process.env.PHUB_E2E_CONTROL_KEY || "guest-cart-ui-isolated-fixture-20261029";
for (const url of [ui, backend]) {
  assert.equal(new URL(url).hostname, "127.0.0.1", "Only loopback fixtures are allowed");
}
assert(key && key.length >= 32, "Set PHUB_E2E_CONTROL_KEY for the isolated fixture");

const artifacts = path.resolve(".next/guest-cart-check");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

async function fixture(pathname, body) {
  const response = await context.request.post(`${backend}${pathname}`, {
    headers: { "x-e2e-key": key },
    data: body,
  });
  assert.equal(response.status(), 200, `Fixture request failed: ${pathname}`);
}

try {
  await fixture("/__e2e/control", { reset: true });
  await fixture("/__e2e/session", { customer: null });

  await page.goto(`${ui}/main/product/P-A`);
  await page.getByRole("heading", { name: "Laptop thử nghiệm", exact: true }).waitFor();
  const addButton = page.getByRole("button", { name: "Thêm vào giỏ", exact: true });
  await addButton.waitFor();
  assert.equal(await addButton.locator("svg").count(), 1, "Add button must include a cart icon");
  await addButton.screenshot({ path: path.join(artifacts, "add-button-desktop.png") });

  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  const quantityButton = page.getByRole("button", { name: "Thêm vào giỏ, số lượng 3", exact: true });
  await quantityButton.click();
  await page.getByRole("button", { name: "Đã thêm vào giỏ, số lượng 3", exact: true }).waitFor();

  const guestCart = await page.evaluate(() => JSON.parse(localStorage.getItem("phub-cart-guest-v1")));
  assert.deepEqual(guestCart, [{ product_id: "P-A", sku: "SKU-A", quantity: 3, selected: true }]);

  await page.reload();
  const headerCartButton = page.getByRole("button", { name: "Giỏ hàng, 3 sản phẩm", exact: true });
  await headerCartButton.waitFor();
  await headerCartButton.click();
  const miniCart = page.locator('[class*="cartPanel"][data-open="true"]');
  await miniCart.waitFor();
  assert.equal(await miniCart.locator("img").count(), 1, "Mini cart must show a product thumbnail");
  assert.equal(await miniCart.getByRole("button", { name: /Xóa .* khỏi giỏ hàng/ }).count(), 1, "Mini cart must expose a remove action");
  await miniCart.getByText("Tạm tính", { exact: true }).waitFor();
  const miniCartCheckout = miniCart.getByRole("link", { name: /Đăng nhập để thanh toán/ });
  assert.equal(await miniCartCheckout.getAttribute("href"), "/auth/login?redirect=/checkout");
  await miniCart.screenshot({ path: path.join(artifacts, "mini-cart-desktop.png") });
  await page.goto(`${ui}/cart`);
  await page.getByText("SKU: SKU-A", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Đăng nhập để thanh toán (1)", exact: true }).click();
  await page.waitForURL(`${ui}/auth/login?redirect=%2Fcheckout`);

  await fixture("/__e2e/session", { customer: "KH-A" });
  await page.goto(`${ui}/cart`);
  await page.getByText("SKU: SKU-A", { exact: true }).waitFor();
  const storage = await page.evaluate(() => ({
    guest: localStorage.getItem("phub-cart-guest-v1"),
    customer: JSON.parse(localStorage.getItem("phub-cart-v1:KH-A")),
  }));
  assert.equal(storage.guest, null, "Guest cart must be removed after account merge");
  assert.deepEqual(storage.customer, [{ product_id: "P-A", sku: "SKU-A", quantity: 3, selected: true }]);

  await page.getByRole("button", { name: "Tiến hành đặt hàng (1)", exact: true }).click();
  await page.waitForURL(`${ui}/checkout`);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${ui}/main/product/P-A`);
  const mobileAddButton = page.getByRole("button", { name: "Thêm vào giỏ", exact: true });
  await mobileAddButton.waitFor();
  await mobileAddButton.screenshot({ path: path.join(artifacts, "add-button-mobile.png") });

  assert.deepEqual(pageErrors, []);
  console.log("PASS: guest add UI, persistence, login merge and checkout handoff");
} finally {
  await browser.close();
}
