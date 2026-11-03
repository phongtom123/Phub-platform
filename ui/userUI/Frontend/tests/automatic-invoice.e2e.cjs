// Browser fixtures only. Real database atomicity is tested by the PostgreSQL script.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3001";
const recipient = { name: "Invoice Test", phone: "0901234567", address_line: "Test address", ward: "Test ward", province: "Test city" };
const profile = { customer_id: "AUTO-INVOICE-TEST", ...recipient, payment_bypass_enabled: false };
const product = { id: "PRODUCT-TEST", sku: "SKU-TEST", name: "Invoice product", price: "5000000.00", currency: "VND", category: { id: "C", name: "Test" }, subcategory: { id: "SC", name: "Test" }, brand: null, description: null, unit: "Chiếc", warranty_months: 0, images: [], specifications: [] };
const line = { sku: product.sku, name: product.name, unit: product.unit, warehouse_id: 1, quantity: 185, unit_price: product.price, gross_total: "925000000.00", discount: "0.00", tax_rate: "10.00", tax_amount: "0.00", line_total: "925000000.00" };
const quote = { currency: "VND", tax_application: "invoice", shipping_status: "not_quoted", voucher_code: null, items: [line], subtotal: line.gross_total, discount_total: "0.00", tax_total: "0.00", total: line.line_total };
const invoiceLines = [37, 39, 60, 49].map((quantity, i) => ({ ...line, warehouse_id: i + 1, quantity, gross_total: `${quantity * 5000000}.00`, tax_amount: `${quantity * 500000}.00`, line_total: `${quantity * 5500000}.00` }));
const receipt = { ...quote, id: "AUTO-ORDER-TEST", status: "MOI", sales_channel: "ONLINE", created_at: "2026-11-02T08:00:00Z", recipient, note: null };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PHUB_CHROMIUM_CHANNEL || "chrome", args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let posts = 0, invoiceReads = 0, failing = false, present = true;
    await page.addInitScript(({ customerId, productId, sku }) => {
      localStorage.setItem(`phub-cart-v1:${customerId}`, JSON.stringify([{ product_id: productId, sku, quantity: 185, selected: true }]));
    }, { customerId: profile.customer_id, productId: product.id, sku: product.sku });
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const ok = json => route.fulfill({ json });
      if (path.endsWith("/auth/me")) return ok({ account_id: "ACCOUNT-TEST", username: "test", role: "KHACH_HANG", name: profile.name, customer_id: profile.customer_id, employee_id: null, warehouse_id: null });
      if (path === "/api/customer/me" || path === "/api/backend/customer/me") return ok(profile);
      if (path === "/api/customer/addresses") return ok({ items: [{ id: "00000000-0000-4000-8000-000000000001", ...recipient, is_default: true }], item: null });
      if (path === `/api/catalog/products/${product.id}`) return ok(product);
      if (path === "/api/catalog/availability") return ok({ items: [{ sku: product.sku, available_quantity: 185 }], tax_rate: "10.00", currency: "VND" });
      if (path.startsWith("/api/catalog/")) return ok({ items: [] });
      if (path.endsWith("/checkout/quote")) return ok(quote);
      if (path === "/api/customer/orders" && route.request().method() === "POST") { posts++; const body = route.request().postDataJSON(); assert.equal(body.expected_total, "925000000.00"); assert.deepEqual(body.items.map(item => [item.warehouse_id, item.quantity]), [[1, 185]]); return ok(receipt); }
      if (path.endsWith("/invoice")) {
        invoiceReads++;
        if (failing) return route.fulfill({ status: 503, json: { error: { message: "Test temporary failure" } } });
        return ok({ order_id: receipt.id, currency: "VND", invoice: present ? { issued_at: receipt.created_at, subtotal: "925000000.00", discount_total: "0.00", tax_total: "92500000.00", total: "1017500000.00" } : null, items: present ? invoiceLines : [] });
      }
      throw new Error(`Unexpected API request: ${route.request().method()} ${path}`);
    });
    await page.goto(base + "/checkout");
    await page.getByRole("button", { name: "Đặt hàng", exact: true }).click();
    await page.getByRole("heading", { name: /Đặt đơn hàng thành công/ }).waitFor();
    const invoice = page.getByRole("region", { name: "Hóa đơn của đơn hàng" });
    await invoice.getByText(/1\.017\.500\.000/).first().waitFor();
    assert.equal(await invoice.locator("tbody tr").count(), 1, "Four warehouse allocations display as one product");
    await invoice.locator("tbody tr").getByRole("cell", { name: "185", exact: true }).waitFor();
    assert.equal(await invoice.getByText(product.name, { exact: true }).count(), 1);
    assert.equal(posts, 1, "Invoice is displayed after checkout, with no separate issuance POST");
    assert.equal(await page.evaluate(() => localStorage.getItem("phub-cart-v1:AUTO-INVOICE-TEST")), "[]", "Completed quantities are removed from the cart");
    assert.ok(invoiceReads > 0);
    present = false;
    await invoice.getByText("Đơn chưa có hóa đơn được lập.").waitFor({ timeout: 12000 });
    present = true;
    await invoice.getByText(/1\.017\.500\.000/).first().waitFor({ timeout: 12000 });
    assert.equal(await invoice.locator("tbody tr").count(), 1, "Automatic refresh retains one grouped row");
    failing = true;
    await invoice.getByRole("alert").waitFor({ timeout: 12000 });
    assert.ok(await invoice.getByText(/1\.017\.500\.000/).count(), "Keep the last invoice during a temporary refresh failure");
    failing = false;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await invoice.getByRole("alert").waitFor({ state: "detached" });
    assert.deepEqual(errors, []);
    assert.equal(posts, 1);
    console.log("PASS: four warehouse lines become one invoice product with quantity 185 and exact totals; immediate invoice, automatic refresh, error recovery, no duplicate order writes");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
