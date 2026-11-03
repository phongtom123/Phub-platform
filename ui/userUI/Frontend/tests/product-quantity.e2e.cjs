// Uses one public product for SSR. Cart/availability/session requests use browser
// fixtures; no account, order, payment or stock is changed in the database.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PHUB_CHROMIUM_CHANNEL || "chrome", args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    const reference = await browser.newContext();
    const list = await reference.request.get(base + "/api/catalog/products?page_size=1");
    assert.equal(list.status(), 200);
    const id = process.env.PHUB_PRODUCT_TEST_ID || (await list.json()).items[0]?.id;
    assert.ok(id, "A public product is needed for the server-rendered detail page");
    const detail = await reference.request.get(base + `/api/catalog/products/${encodeURIComponent(id)}`);
    assert.equal(detail.status(), 200);
    const product = await detail.json();
    await reference.close();

    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      let stock = 2000, unavailable = false;
      const requests = [], errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/api/**", async route => {
        const url = new URL(route.request().url());
        const path = url.pathname;
        assert.equal(route.request().method(), "GET", "Adding to cart must not write database records");
        if (path.endsWith("/me")) return route.fulfill({ status: 401, json: { error: { code: "AUTHENTICATION_REQUIRED", message: "Guest" } } });
        if (path === "/api/catalog/availability") return unavailable
          ? route.fulfill({ status: 503, json: { error: { message: "Không kiểm tra được tồn kho thử nghiệm." } } })
          : route.fulfill({ json: { items: [{ sku: product.sku, available_quantity: stock }], tax_rate: "10.00", currency: "VND" } });
        if (path.endsWith("/availability")) {
          const quantity = Number(url.searchParams.get("quantity"));
          requests.push(quantity);
          return unavailable
            ? route.fulfill({ status: 503, json: { error: { message: "Không kiểm tra được tồn kho thử nghiệm." } } })
            : route.fulfill({ json: { id: product.id, sku: product.sku, quantity, available: quantity <= stock } });
        }
        if (path === `/api/catalog/products/${encodeURIComponent(product.id)}`) return route.fulfill({ json: product });
        if (path.startsWith("/api/catalog/")) return route.fulfill({ json: { items: [] } });
        throw new Error(`Unexpected fixture URL: ${path}`);
      });
      const cart = () => page.evaluate(() => JSON.parse(localStorage.getItem("phub-cart-guest-v1") || "[]"));
      const lastCartCheck = () => requests.filter(quantity => quantity !== 1).at(-1);
      await page.goto(base + `/main/product/${encodeURIComponent(product.id)}`);
      if (width < 760) await page.locator('article[class*="ProductPage1"]').waitFor();
      await page.waitForFunction(() => document.querySelector("button[data-state]")?.disabled === false);
      const input = page.getByRole("textbox", { name: "Số lượng", exact: true });
      await input.waitFor();
      await input.fill("1");
      await input.press("Backspace");
      assert.equal(await input.inputValue(), "");
      await input.press("6");
      assert.equal(await input.inputValue(), "6");
      await input.fill("-6");
      assert.ok(!String(await input.inputValue()).includes("-"), "Negative quantities are rejected");
      await input.fill("99");
      await page.getByRole("button", { name: "Tăng số lượng", exact: true }).click();
      assert.equal(await input.inputValue(), "100");
      assert.equal(await input.getAttribute("max"), "2000");
      const beforeTyping = requests.length;
      await input.fill("99999999999999999999999999999999");
      assert.equal(await input.inputValue(), "2000", "Oversized input immediately clamps to real available stock");
      assert.ok(await page.getByRole("button", { name: "Tăng số lượng", exact: true }).isDisabled());
      assert.equal(requests.length, beforeTyping, "Typing uses the loaded quantity without querying the API");
      await input.fill("0");
      assert.equal(await page.locator("button[data-state]").isDisabled(), true);
      await input.fill("1234");
      await page.locator("button[data-state]").click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("phub-cart-guest-v1") || "[]")[0]?.quantity === 1234);
      assert.equal(lastCartCheck(), 1234);
      await page.waitForFunction(() => document.querySelector('input[aria-label="Số lượng"]')?.max === "766");
      assert.equal(await input.inputValue(), "766", "The remaining add limit subtracts the existing cart");
      await input.fill("99999");
      assert.equal(await input.inputValue(), "766");
      assert.equal((await cart())[0].quantity, 1234);
      await input.fill("6");
      stock = 1239;
      await page.getByRole("button", { name: /Mua ngay/ }).click();
      await page.waitForFunction(() => !document.querySelector('button[data-state]')?.disabled);
      assert.equal(lastCartCheck(), 1240);
      assert.equal((await cart())[0].quantity, 1234);
      assert.ok(page.url().includes("/main/product/"), "Buy now stays on the product when stock is insufficient");
      assert.equal(await input.inputValue(), "5", "A lower stock refresh clamps the current draft");
      unavailable = true;
      await page.locator("button[data-state]").click();
      await page.getByRole("status").filter({ hasText: "Không kiểm tra được tồn kho thử nghiệm." }).waitFor();
      assert.equal((await cart())[0].quantity, 1234, "A failed stock check must not alter the cart");
      unavailable = false;
      stock = 1240;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.waitForFunction(() => document.querySelector('input[aria-label="Số lượng"]')?.max === "6");
      await input.fill("6");
      await page.getByRole("button", { name: /Mua ngay/ }).click();
      await page.waitForURL("**/cart");
      assert.equal((await cart())[0].quantity, 1240);
      await page.reload();
      await page.getByRole("spinbutton", { name: "Số lượng", exact: true }).waitFor();
      assert.equal((await cart())[0].quantity, 1240, "Large quantities survive reload");
      await page.goto(base + `/main/product/${encodeURIComponent(product.id)}`);
      await page.getByRole("status").filter({ hasText: "Giỏ hàng đã đạt tồn khả dụng" }).waitFor();
      await page.locator("button[data-state]").waitFor({ state: "detached" });
      assert.equal(await page.locator("button[data-state]").count(), 0);
      assert.equal(await page.getByRole("button", { name: /Mua ngay/ }).count(), 0);
      assert.equal(await page.getByRole("status").filter({ hasText: /^Hết hàng$/ }).count(), 0, "Full cart is not sold out");
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: immediate max clamp, cart subtraction, no queries on typing, dynamic stock limit, large quantities, no writes on failed checks, Buy now and reload`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
