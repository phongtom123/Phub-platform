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

const ui = process.env.PHUB_UI_URL || "http://127.0.0.1:3000";
assert.equal(new URL(ui).hostname, "127.0.0.1", "Only loopback UI is allowed");

const artifacts = path.resolve(".next/guest-cart-check");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

try {
  await page.goto(`${ui}/main/product/SEED_SP004`);
  const addButton = page.getByRole("button", { name: "Thêm vào giỏ", exact: true });
  await addButton.waitFor();
  await addButton.click();
  await page.getByRole("button", { name: "Đã thêm vào giỏ", exact: true }).waitFor();

  const cartButton = page.getByRole("button", { name: "Giỏ hàng, 1 sản phẩm", exact: true });
  await cartButton.click();
  const miniCart = page.locator('[class*="cartPanel"][data-open="true"]');
  await miniCart.waitFor();

  assert.equal(await miniCart.locator("img").count(), 1, "Product thumbnail is missing");
  assert.equal(await miniCart.getByRole("button", { name: /Xóa .* khỏi giỏ hàng/ }).count(), 1, "Remove action is missing");
  await miniCart.getByText("Tạm tính", { exact: true }).waitFor();
  const checkout = miniCart.getByRole("link", { name: /Đăng nhập để thanh toán/ });
  assert.equal(await checkout.getAttribute("href"), "/auth/login?redirect=/checkout");
  assert.equal(await checkout.locator("svg").count(), 1, "Checkout icon is missing");
  await miniCart.screenshot({ path: path.join(artifacts, "mini-cart-desktop.png") });

  assert.deepEqual(pageErrors, []);
  console.log("PASS: mini cart thumbnail, remove action, subtotal and guest checkout CTA");
} finally {
  await browser.close();
}
