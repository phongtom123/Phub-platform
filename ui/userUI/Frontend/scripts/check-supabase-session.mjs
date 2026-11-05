// Read-only checks on actual Supabase. Supports automatic identity or local cookie.
// Never submits an order, consumes a voucher or modifies database rows.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = await import(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const backend = "http://127.0.0.1:8001";
const ui = "http://127.0.0.1:3001";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(45000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const artifacts = path.resolve(".next/supabase-session-check");
await mkdir(artifacts, { recursive: true });
try {
  const schema = await (await context.request.get(backend + "/openapi.json")).json();
  assert.match(schema.info.title, /LOCAL Supabase testing \(real database\)/);
  const initialIdentity = await context.request.get(backend + "/api/customer/me");
  const automatic = initialIdentity.headers()["x-phub-test-identity"] === "automatic";
  assert.equal(initialIdentity.status(), automatic ? 200 : 401);
  await page.goto(backend + "/__supabase_test");
  const expectedCustomer = await page.locator("strong").innerText();
  if (automatic) {
    await page.goto(ui + "/");
  } else {
    await page.getByRole("button", { name: "Mở UI với khách test", exact: true }).click();
  }
  await page.waitForURL(ui + "/");
  const profileResponse = await context.request.get(ui + "/api/customer/me");
  assert.equal(profileResponse.status(), 200);
  const profile = await profileResponse.json();
  assert.equal(profile.customer_id, expectedCustomer);
  const cookie = (await context.cookies()).find(c => c.name === "phub-supabase-test-session");
  if (automatic) assert.equal(cookie, undefined);
  else assert(cookie?.httpOnly && cookie.sameSite === "Strict");
  console.log("PASS: server-selected customer -> " + (automatic ? "UI directly without login/cookie" : "HttpOnly session") + " -> real Supabase profile");

  const catalog = await (await context.request.get(ui + "/api/catalog/products?page_size=1")).json();
  assert(catalog.pagination.total > 0 && catalog.items.length === 1);
  const product = catalog.items[0];
  await page.goto(ui + "/main/product/" + encodeURIComponent(product.id));
  await page.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  await page.getByRole("button", { name: "Giỏ hàng, 1 sản phẩm", exact: true }).waitFor();
  await page.goto(ui + "/cart");
  await page.getByRole("heading", { name: "Giỏ hàng", exact: true }).waitFor();
  const quoteResponse = await context.request.post(ui + "/api/customer/checkout/quote", {
    headers: { Origin: ui }, data: { items: [{ sku: product.sku, quantity: 1 }] },
  });
  const quote = await quoteResponse.json();
  const missingRpc = quoteResponse.status() === 503 && quote.error?.code === "CHECKOUT_DATABASE_NOT_READY";
  if (!missingRpc) {
    assert([200, 404, 409].includes(quoteResponse.status()), "Unexpected real database quote failure");
  } else {
    await page.getByRole("alert").filter({ hasText: "Chức năng mua hàng hiện chưa sẵn sàng" }).waitFor();
  }
  console.log("PASS: real catalog -> product -> cart; quote status " + quoteResponse.status());
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(artifacts, `cart-${width}.png`), fullPage: true });
  }
  if (automatic) {
    await page.reload();
    assert.equal((await context.request.get(ui + "/api/customer/me")).status(), 200);
    assert(!(await page.locator("main").innerText()).includes("Vui lòng đăng nhập để tiếp tục."));
  } else {
    await page.goto(backend + "/__supabase_test");
    await page.getByRole("button", { name: "Kết thúc phiên test", exact: true }).click();
    await page.waitForURL(ui + "/");
    assert.equal((await context.request.get(ui + "/api/customer/me")).status(), 401);
  }
  assert.deepEqual(errors, []);
  const report = { mode: "real Supabase; local test identity; database read-only", customerId: expectedCustomer,
    catalogTotal: catalog.pagination.total, quoteStatus: quoteResponse.status(), missingRpc,
    identityMode: automatic ? "automatic-no-login" : "cookie", completeCheckoutVerified: false, databaseWrites: 0, errors };
  await writeFile(path.join(artifacts, "report.json"), JSON.stringify(report, null, 2));
  console.log("PASS: desktop/mobile and " + (automatic ? "reload without login" : "logout") + "; no database writes; full checkout still requires RPC verification");
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
