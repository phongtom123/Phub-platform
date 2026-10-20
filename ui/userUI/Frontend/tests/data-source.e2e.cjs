// Fixtures here are HTTP test responses only; no live writes or Supabase secrets.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3001";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let mode = "empty";
    await page.route("**/api/catalog/**", async route => {
      if (mode === "error") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "API test unavailable", code: "DATA_SERVICE_UNAVAILABLE", details: [] } }) });
      const products = new URL(route.request().url()).pathname.endsWith("/products");
      const body = products ? { items: [], pagination: { total: 0, total_pages: 0, page: 1, page_size: 20 } } : { items: [] };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(base + "/main/product");
    await page.getByRole("heading", { name: "Không tìm thấy sản phẩm" }).waitFor();
    assert.equal(await page.locator('article').count(), 0);
    await page.goto(base + "/");
    await page.getByText("Hiện chưa có sản phẩm đang bán.").waitFor();
    assert.equal(await page.locator('article:has(picture)').count(), 0);
    mode = "error";
    await page.goto(base + "/main/product");
    await page.locator("#catalog-results").getByText("API test unavailable", { exact: true }).waitFor();
    assert.equal(await page.locator('article').count(), 0);
    await page.goto(base + "/cart");
    await page.getByRole("heading", { name: "Giỏ hàng chưa được kết nối" }).waitFor();
    assert.equal(await page.locator('input[name="voucher"]').count(), 0);
    await page.goto(base + "/checkout");
    await page.getByText(/Chưa kết nối đầy đủ luồng giỏ hàng/i).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: empty/error API never falls back to dummy products; cart/checkout are explicitly unavailable.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
