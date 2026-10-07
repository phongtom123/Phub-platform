// Entire flow runs against isolated fixture servers; no real payment or Supabase writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = await import(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const ui = process.env.PHUB_UI_URL || "http://127.0.0.1:13001";
const backend = process.env.PHUB_E2E_BACKEND_URL || "http://127.0.0.1:18001";
const key = process.env.PHUB_E2E_CONTROL_KEY;
for (const url of [ui, backend]) assert.equal(new URL(url).hostname, "127.0.0.1");
assert(key?.length >= 32);
const browser = await chromium.launch({ channel:"chrome", headless:true });
const context = await browser.newContext({ viewport:{ width:1280, height:900 } });
const page = await context.newPage(); page.setDefaultTimeout(30000);
const checks = [], errors = [];
page.on("pageerror", error => errors.push(error.message));
const artifacts = path.resolve(".next/payment-ui-check"); await mkdir(artifacts, { recursive:true });
const pass = name => { checks.push(name); console.log("PASS:", name); };
async function control(body) {
  assert.equal((await context.request.post(backend + "/__e2e/control", { headers:{"x-e2e-key":key}, data:body })).status(), 200);
}
async function session(customer) {
  assert.equal((await context.request.post(backend + "/__e2e/session", { headers:{"x-e2e-key":key}, data:{customer} })).status(), 200);
}
async function apiPayment(orderId, method, idempotencyKey) {
  return context.request.post(`${ui}/api/customer/orders/${orderId}/payment-request`, {
    headers:{"Idempotency-Key":idempotencyKey}, data:{method},
  });
}
try {
  assert.match((await (await context.request.get(backend + "/openapi.json")).json()).info.title, /Isolated shopping fixtures/);
  await control({reset:true}); await session("KH-A");
  await page.goto(ui + "/main/product/P-A");
  await page.getByRole("button", { name:"Thêm vào giỏ", exact:true }).click();
  await page.getByRole("button", { name:"Giỏ hàng, 1 sản phẩm", exact:true }).waitFor();
  await page.goto(ui + "/cart");
  await page.getByRole("button", { name:"Thanh toán", exact:true }).click();
  await page.waitForURL(ui + "/checkout/confirm");
  await page.getByRole("combobox", {name:"Phương thức thanh toán", exact:true}).selectOption("cash");
  const invoicePreview = page.getByRole("region", {name:"Hóa đơn", exact:true});
  await invoicePreview.getByRole("columnheader", {name:"Đơn giá", exact:true}).waitFor();
  await invoicePreview.getByText(/100\.000,10/).first().waitFor();
  await page.getByRole("button", { name:"Đặt đơn", exact:true }).click();
  await page.waitForURL(/\/main\/orders\/E2E-ORDER-1/);
  const orderId = "E2E-ORDER-1";
  const payment = page.locator("#payments");
  await page.getByText(/Chế độ thử nghiệm: đơn hàng và thanh toán là dữ liệu giả lập/).waitFor();
  await page.getByText("Đơn chưa có hóa đơn được lập.", {exact:true}).waitFor();
  assert.equal(await payment.getByRole("combobox", {name:"Phương thức thanh toán", exact:true}).inputValue(), "cash");
  const accepted = page.waitForResponse(response => response.url().endsWith("/payment-request"));
  await payment.getByRole("button", {name:"Yêu cầu thanh toán", exact:true}).click();
  const response = await accepted;
  assert.equal(response.status(), 200);
  const transaction = (await response.json()).latest_transaction;
  assert.equal(transaction.amount, "110000.11"); assert.equal(transaction.method,"cash"); assert.equal(transaction.status,"pending");
  assert.deepEqual(Object.keys(response.request().postDataJSON()), ["method"]);
  const invoice = page.getByRole("region", {name:"Hóa đơn của đơn hàng", exact:true});
  await invoice.getByText(/110\.000,11/).waitFor();
  await payment.getByText("Đang chờ xử lý", {exact:true}).first().waitFor();
  await payment.getByText(/chưa được xác nhận thành công/).first().waitFor();
  pass("Checkout shows unit/line prices; method flows to payment; invoice applies 10% only in fixture; payment starts pending");

  const sentKey = response.request().headers()["idempotency-key"];
  const replay = await apiPayment(orderId,"cash",sentKey);
  assert.equal(replay.headers()["idempotency-replayed"], "true");
  assert.equal((await apiPayment(orderId,"card",sentKey)).status(),409);
  let history = await (await context.request.get(ui + `/api/customer/orders/${orderId}/transactions`)).json();
  assert.equal(history.pagination.total,1);
  assert(!JSON.stringify(history).includes("PRIVATE"));
  await session("KH-B");
  assert.equal((await apiPayment(orderId,"cash",randomUUID())).status(),404);
  assert.equal((await context.request.get(ui + `/api/customer/orders/${orderId}/invoice`)).status(),404);
  assert.equal((await context.request.get(ui + `/api/customer/orders/${orderId}/payments`)).status(),404);
  await session("KH-A");
  pass("Payment replay creates no duplicate; changed payload conflicts; other customer cannot read invoice/payments or request payment");

  await payment.getByRole("button", {name:"Mô phỏng Thất bại", exact:true}).click();
  await payment.getByText("Thất bại", {exact:true}).first().waitFor();
  let drop = true;
  await page.route("**/payment-request", async route => {
    if (drop) { drop=false; await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await payment.getByRole("button", {name:"Yêu cầu thanh toán", exact:true}).click();
  await payment.getByRole("button", {name:"Thử lại yêu cầu thanh toán", exact:true}).waitFor();
  const pendingBefore = await page.evaluate(() => sessionStorage.getItem("phub-payment-attempt-v1:KH-A:E2E-ORDER-1"));
  assert(pendingBefore);
  await page.reload();
  const retried = page.waitForResponse(response => response.url().endsWith("/payment-request"));
  await payment.getByRole("button", {name:"Thử lại yêu cầu thanh toán", exact:true}).click();
  const retry = await retried;
  assert.equal(retry.headers()["idempotency-replayed"], "true");
  assert.equal(retry.request().headers()["idempotency-key"], JSON.parse(pendingBefore).key);
  history = await (await context.request.get(ui + `/api/customer/orders/${orderId}/transactions`)).json();
  assert.equal(history.pagination.total,2);
  await page.unroute("**/payment-request");
  await payment.getByRole("button", {name:"Mô phỏng Thành công", exact:true}).click();
  await payment.getByText("Thành công", {exact:true}).first().waitFor();
  assert.equal((await apiPayment(orderId,"cash",randomUUID())).status(),409);
  await payment.getByRole("button", {name:"Mô phỏng Hoàn tiền", exact:true}).click();
  await payment.getByText(/Hoàn tiền · Tiền mặt/).waitFor();
  await payment.getByText("Hoàn tiền", {exact:true}).first().waitFor();
  pass("Lost response/reload retry reuses payment key; failed, succeeded and refund states/history are explicit");

  for (const width of [320,375,1280]) {
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1));
    await page.screenshot({path:path.join(artifacts,`order-payment-${width}.png`),fullPage:true});
  }
  assert(!/PRIVATE-|ma_giao_dich|ma_thanh_toan|bank_account|CVV/.test(await page.locator("main").innerText()));
  await page.goto(ui + "/main/profile");
  await page.getByRole("link", {name:/E2E-ORDER-1/}).waitFor();
  assert.deepEqual(errors,[]);
  pass("Invoice/payment/history fit mobile and desktop, expose no sensitive references, and order remains in customer history");
  await writeFile(path.join(artifacts,"report.json"),JSON.stringify({checks,errors,mode:"isolated fixtures",realPayments:0,supabaseWrites:0},null,2));
  await control({reset:true});
} catch(error) {
  await page.screenshot({path:path.join(artifacts,"failure.png"),fullPage:true}); throw error;
} finally { await context.close(); await browser.close(); }
