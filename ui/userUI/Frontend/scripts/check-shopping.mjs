// Local fixture E2E only. Real login authentication must be certified separately
// after the other member's auth module is merged. No shared Supabase access.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = await import(
  process.env.PHUB_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.PHUB_UI_URL || "http://127.0.0.1:13001";
const backend = process.env.PHUB_E2E_BACKEND_URL || "http://127.0.0.1:18001";
const key = process.env.PHUB_E2E_CONTROL_KEY;
for (const url of [base, backend])
  assert.equal(
    new URL(url).hostname,
    "127.0.0.1",
    "Only loopback fixture servers are allowed",
  );
assert(key && key.length >= 32, "Set the fixture control key");
const artifacts = path.resolve(".next/shopping-check");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const checks = [];
const pass = (name) => {
  checks.push(name);
  console.log("PASS:", name);
};
async function poll(read, test) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const value = await read();
    if (test(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for assertion");
}
async function control(body) {
  const response = await context.request.post(`${backend}/__e2e/control`, {
    headers: { "x-e2e-key": key },
    data: body,
  });
  assert.equal(response.status(), 200);
}
async function session(customer) {
  const response = await context.request.post(`${backend}/__e2e/session`, {
    headers: { "x-e2e-key": key },
    data: { customer },
  });
  assert.equal(response.status(), 200);
}
async function state() {
  const response = await context.request.get(`${backend}/__e2e/state`, {
    headers: { "x-e2e-key": key },
  });
  assert.equal(response.status(), 200);
  return response.json();
}
async function api(path, options) {
  const response = await context.request.get(base + path, options);
  return {
    status: response.status(),
    headers: response.headers(),
    body: await response.json(),
  };
}
async function overflow() {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Horizontal overflow",
  );
}
try {
  const schema = await (
    await context.request.get(backend + "/openapi.json")
  ).json();
  assert.match(schema.info.title, /Isolated shopping fixtures/);
  await control({ reset: true });
  await session(null);
  const catalog = await api("/api/catalog/products");
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.items[0].sku, "SKU-A");
  await page.goto(base + "/main/product/P-A");
  await page
    .getByRole("heading", { name: "Laptop thử nghiệm", exact: true })
    .waitFor();
  assert(
    (await page.locator("main").innerText()).includes("Mô tả từ API fixture"),
  );
  await page.goto(base + "/cart");
  await page
    .getByText("Vui lòng đăng nhập để tiếp tục.", { exact: true })
    .waitFor();
  await page.goto(base + "/checkout");
  await page
    .getByText("Vui lòng đăng nhập để tiếp tục.", { exact: true })
    .waitFor();
  const forged = await api("/api/customer/me", {
    headers: { Authorization: "Bearer forged", "X-Customer-Id": "KH-A" },
  });
  assert.equal(forged.status, 401);
  assert.equal(forged.headers["cache-control"], "no-store");
  pass(
    "Public catalog/detail work; guest checkout/cart and forged identity are blocked",
  );
  const cross = await context.request.post(
    base + "/api/customer/checkout/quote",
    {
      headers: { Origin: "https://foreign.invalid" },
      data: { items: [{ sku: "SKU-A", quantity: 1 }] },
    },
  );
  assert.equal(cross.status(), 403);
  const invalid = await context.request.post(
    base + "/api/customer/checkout/quote",
    { headers: { "Content-Type": "application/json" }, data: Buffer.from("{") },
  );
  assert.equal(invalid.status(), 422);
  const large = await context.request.post(
    base + "/api/customer/checkout/quote",
    {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ note: "X".repeat(70000) }),
    },
  );
  assert.equal(large.status(), 413);
  pass(
    "Proxy rejects cross-site writes, malformed JSON and oversized requests",
  );
  await page.goto(base + "/auth/login");
  await session("KH-A");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(/\/main\/landing/);
  assert.equal((await api("/api/customer/me")).body.customer_id, "KH-A");
  pass(
    "Login screen handoff works with an isolated simulated session (not password verification)",
  );
  await page.goto(base + "/main/product/P-A");
  await page.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  await page
    .getByRole("button", { name: "Giỏ hàng, 1 sản phẩm", exact: true })
    .waitFor();
  await page.goto(base + "/cart");
  const qty = page.getByRole("spinbutton", { name: "Số lượng SKU-A" });
  await qty.fill("2");
  await page.getByLabel("Mã voucher").fill("INVALID");
  await page
    .getByRole("button", { name: "Áp dụng voucher", exact: true })
    .click();
  await page
    .getByText("Mã giảm giá không khả dụng hoặc đã hết hạn.", { exact: true })
    .waitFor();
  await page.getByLabel("Mã voucher").fill("save10");
  await page
    .getByRole("button", { name: "Áp dụng voucher", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Thanh toán", exact: true })
    .waitFor();
  const quoteResponse = await context.request.post(
    base + "/api/customer/checkout/quote",
    {
      data: { items: [{ sku: "SKU-A", quantity: 2 }], voucher_code: "SAVE10" },
    },
  );
  assert.equal(quoteResponse.status(), 200);
  const quote = await quoteResponse.json();
  assert.equal(quote.total, "180000.18");
  assert.equal(quote.discount_total, "20000.02");
  assert.equal(quote.tax_total, "0.00");
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("phub-cart-v1:KH-A")),
  );
  assert.deepEqual(Object.keys(persisted[0]).sort(), [
    "product_id",
    "quantity",
    "selected",
    "sku",
  ]);
  await page.reload();
  await poll(
    () => qty.inputValue(),
    (value) => value === "2",
  );
  await page
    .getByRole("button", { name: "Giỏ hàng, 2 sản phẩm", exact: true })
    .waitFor();
  pass(
    "Global cart, exact quote, valid/invalid voucher and minimal per-customer persistence work",
  );
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow();
    await page.screenshot({
      path: path.join(artifacts, `cart-${width}.png`),
      fullPage: true,
    });
  }
  pass("Cart renders at mobile and desktop widths without page overflow");
  await page.goto(base + "/checkout?voucher=SAVE10");
  await page.setViewportSize({ width: 375, height: 900 });
  await page
    .getByRole("button", { name: "Đặt đơn", exact: true })
    .waitFor();
  await poll(
    () =>
      page
        .getByRole("button", { name: "Đặt đơn", exact: true })
        .isEnabled(),
    Boolean,
  );
  assert.match(page.url(), /\/checkout\/confirm\?voucher=SAVE10/);
  await overflow();
  await page.screenshot({
    path: path.join(artifacts, "checkout-mobile.png"),
    fullPage: true,
  });
  await control({ price: "110000.10" });
  await page.getByRole("button", { name: "Đặt đơn", exact: true }).click();
  await page
    .getByText("Giá sản phẩm đã thay đổi. Vui lòng kiểm tra và xác nhận lại.", {
      exact: true,
    })
    .waitFor();
  assert.equal((await state()).orders, 0);
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem("phub-checkout-attempt-v1:KH-A"),
    ),
    null,
  );
  await control({ price: "100000.10" });
  await page.reload();
  await poll(
    () =>
      page
        .getByRole("button", { name: "Đặt đơn", exact: true })
        .isEnabled(),
    Boolean,
  );
  assert.match(page.url(), /\/checkout\/confirm\?voucher=SAVE10/);
  pass(
    "Mobile checkout stays within the viewport and a price change requires fresh confirmation without a committed order",
  );
  await control({ fail_after_commit: true });
  await page.getByRole("button", { name: "Đặt đơn", exact: true }).dblclick();
  await page
    .getByRole("button", { name: "Thử lại lần đặt này", exact: true })
    .waitFor();
  const uncertain = await state();
  assert.equal(uncertain.orders, 1);
  assert.equal(uncertain.calls.length, 2);
  assert.equal(uncertain.physical_stock, 5);
  await page.reload();
  await page
    .getByRole("button", { name: "Thử lại lần đặt này", exact: true })
    .waitFor();
  await control({ price: "110000.10" });
  await page
    .getByRole("button", { name: "Thử lại lần đặt này", exact: true })
    .click();
  await page.waitForURL(/\/main\/orders\/E2E-ORDER-1/);
  await page
    .getByRole("heading", { name: "Đơn E2E-ORDER-1", exact: true })
    .waitFor();
  const completed = await state();
  assert.equal(completed.orders, 1);
  assert.equal(completed.calls.length, 3);
  assert.deepEqual(completed.calls[1], completed.calls[2]);
  assert.equal(completed.physical_stock, 5);
  assert.equal(completed.calls[1].body.expected_total, "180000.18");
  assert.equal(completed.calls[1].body.voucher_code, "SAVE10");
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem("phub-checkout-attempt-v1:KH-A"),
    ),
    null,
  );
  await page
    .getByRole("button", { name: "Giỏ hàng, 0 sản phẩm", exact: true })
    .waitFor();
  await page
    .getByText("Chưa có giao dịch. Đơn đang chờ ghi nhận thanh toán.", {
      exact: true,
    })
    .waitFor();
  pass(
    "Checkout snapshots recipient/price; double click and response-loss retry across reload create one order",
  );
  pass(
    "Retry reuses identical key/body after price changes; order does not deduct physical stock",
  );
  const detail = await api("/api/customer/orders/E2E-ORDER-1");
  assert.equal(detail.status, 200);
  assert.equal(detail.body.items[0].unit_price, "100000.10");
  assert.equal(detail.body.recipient.name, "Khách thử A");
  assert.equal(detail.body.items[0].tax_amount, "0.00");
  await control({ payments: "pending", order_id: "E2E-ORDER-1" });
  await page
    .getByRole("button", { name: "Cập nhật thanh toán", exact: true })
    .click();
  await page.getByText("Đang chờ xử lý", { exact: true }).first().waitFor();
  await page
    .locator("#payments")
    .getByRole("button", { name: "Trang sau", exact: true })
    .click();
  await page
    .locator("#payments")
    .getByText("Trang 2 / 2", { exact: true })
    .waitFor();
  await control({ payments: "refund", order_id: "E2E-ORDER-1" });
  await page
    .getByRole("button", { name: "Cập nhật thanh toán", exact: true })
    .click();
  await page
    .locator("#payments")
    .getByText(/Khoản hoàn tiền đã được ghi nhận thành công/)
    .first()
    .waitFor();
  const payments = await api("/api/customer/orders/E2E-ORDER-1/payments");
  const transactions = await api(
    "/api/customer/orders/E2E-ORDER-1/transactions?page_size=10",
  );
  assert.equal(payments.body.latest_transaction.type, "refund");
  assert.equal(transactions.body.pagination.total, 11);
  assert(!JSON.stringify([payments, transactions]).includes("PRIVATE-"));
  pass(
    "Order detail/payment display exact amounts, pending/refund state and transaction pagination without sensitive references",
  );
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow();
    await page.screenshot({
      path: path.join(artifacts, `order-${width}.png`),
      fullPage: true,
    });
  }
  pass(
    "Order and payment screens render at mobile/desktop widths without page overflow",
  );
  await page.goto(base + "/main/profile");
  await page
    .getByRole("link", { name: "Đơn E2E-ORDER-1", exact: true })
    .waitFor();
  assert(
    (await page.locator("main").first().innerText()).includes("Khách thử A"),
  );
  await session("KH-B");
  await page.reload();
  await page
    .getByRole("heading", { name: "Khách thử B", exact: true })
    .waitFor();
  await page
    .getByText("Chưa có đơn hàng trong trang này.", { exact: true })
    .waitFor();
  assert(
    !(await page
      .getByRole("link", { name: "Đơn E2E-ORDER-1", exact: true })
      .count()),
  );
  for (const suffix of ["", "/payments", "/transactions"]) {
    const denied = await api(`/api/customer/orders/E2E-ORDER-1${suffix}`);
    assert.equal(denied.status, 404);
    assert.equal(denied.body.error.code, "ORDER_NOT_FOUND");
  }
  await page.goto(base + "/cart");
  await page
    .locator("main")
    .getByText("Giỏ hàng đang trống.", { exact: true })
    .first()
    .waitFor();
  pass(
    "Verified profile/order history and another customer's cart/order/payment isolation work",
  );
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(base + "/main/product");
  await page.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  await page
    .getByRole("button", { name: "Giỏ hàng, 1 sản phẩm", exact: true })
    .waitFor();
  await page.goto(base + "/main/product/P-A");
  await page.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  await page
    .getByRole("button", { name: "Giỏ hàng, 2 sản phẩm", exact: true })
    .waitFor();
  await page.goto(base + "/cart");
  await page.getByRole("button", { name: "Xóa SKU-A", exact: true }).click();
  await page
    .getByRole("button", { name: "Giỏ hàng, 0 sản phẩm", exact: true })
    .waitFor();
  pass(
    "Mobile catalog and product detail share the same cart as the header and checkout",
  );
  await session("KH-A");
  await page.goto(base + "/main/product/P-A");
  await page.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  await page
    .getByRole("button", { name: "Giỏ hàng, 1 sản phẩm", exact: true })
    .waitFor();
  await control({ products_available: false });
  await page.goto(base + "/cart");
  await page.reload();
  await page
    .getByText("Sản phẩm chưa thể tải. Hãy tải lại trang hoặc xóa khỏi giỏ.", {
      exact: true,
    })
    .waitFor();
  assert(await page.getByRole("button", { name: "Thanh toán", exact: true }).isDisabled());
  await page.getByRole("button", { name: "Xóa SKU-A", exact: true }).click();
  await page
    .locator("main")
    .getByText("Giỏ hàng đang trống.", { exact: true })
    .first()
    .waitFor();
  pass(
    "Unavailable restored products remain removable and block checkout rather than displaying fabricated prices",
  );
  await control({ products_available: true });
  await page.route("**/api/customer/me", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "AUTH_INTEGRATION_REQUIRED",
          message: "Unconnected fixture auth",
          details: [],
        },
      }),
    }),
  );
  await page.goto(base + "/checkout");
  await page
    .getByText("Chức năng mua hàng hiện chưa sẵn sàng. Vui lòng thử lại sau.", {
      exact: true,
    })
    .waitFor();
  assert(
    !(await page.getByRole("button", { name: "Đặt đơn", exact: true }).count()),
  );
  await page.goto(base + "/main/product");
  await page
    .getByRole("heading", { name: "Sản phẩm (1)", exact: true })
    .waitFor();
  await page.unroute("**/api/customer/me");
  pass(
    "Unconnected authentication shows an explicit unavailable state and does not prevent public browsing",
  );
  assert.deepEqual(errors, []);
  pass("No browser runtime errors during the fixture shopping flow");
  await writeFile(
    path.join(artifacts, "report.json"),
    JSON.stringify(
      {
        mode: "isolated simulated-auth/API fixtures; SQL tested separately; real-login E2E pending",
        checks,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(`${checks.length} shopping browser checks passed`);
} catch (error) {
  await page.screenshot({
    path: path.join(artifacts, "failure.png"),
    fullPage: true,
  });
  console.error(
    "Fixture UI at failure:",
    await page.locator("main").first().innerText(),
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
}
