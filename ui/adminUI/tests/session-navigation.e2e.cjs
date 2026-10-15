/** Real Next navigation with mocked HTTP only; no live API/database writes. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.addCookies([{ name: "phub_session", value: "test-only", url: base, httpOnly: true }]);
    await context.addInitScript(() => {
      const now = Date.now.bind(Date);
      window.testTimeOffset = 0;
      Date.now = () => now() + window.testTimeOffset;
    });
    const page = await context.newPage();
    const errors = [], calls = [];
    let documentLoads = 0, hold = false, heldRoute, sessionStatus = 200, dataStatus = 200;
    const user = { account_id: "TK1", username: "admin.test", name: "Admin Test", role: "ADMIN" };
    const columns = [
      { name: "ma_sp", type: "varchar", required: true, generated: false, immutable: true, choices: null, default: null },
      { name: "ten_sp", type: "varchar", required: true, generated: false, immutable: false, choices: null, default: null },
    ];
    const records = [{ ma_sp: "SP1", ten_sp: "Sản phẩm test" }];
    const respond = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentLoads++; });
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      calls.push({ path: url.pathname, method: request.method() });
      if (url.pathname === "/api/backend/auth/me") {
        if (hold) { heldRoute = route; return; }
        return respond(route, sessionStatus === 200 ? user : { detail: "Session unavailable" }, sessionStatus);
      }
      if (url.pathname === "/api/backend/auth/logout") return route.fulfill({ status: 204 });
      if (url.pathname === "/api/backend/data/resources") return respond(route, [
        { name: "products", title: "Sản phẩm", keys: ["ma_sp"], writable: true, columns },
        { name: "orders", title: "Đơn hàng", keys: ["ma_donhang"], writable: false, columns: [] },
      ]);
      if (url.pathname === "/api/backend/data/products") {
        if (dataStatus !== 200) return respond(route, { detail: "Không được phép truy cập" }, dataStatus);
        if (request.method() === "POST") {
          const saved = request.postDataJSON(); records.push(saved);
          return respond(route, { data: [saved] });
        }
        const key = url.searchParams.get("key");
        const data = key ? records.filter(row => row.ma_sp === JSON.parse(key)[0]) : records;
        return respond(route, { data, total: data.length, page: 1, page_size: Number(url.searchParams.get("page_size") || 20) });
      }
      assert.equal(request.method(), "GET", "Unexpected mutation");
      return respond(route, { data: [], total: 0, page: 1, page_size: Number(url.searchParams.get("page_size") || 20) });
    });
    const meCount = () => calls.filter(call => call.path === "/api/backend/auth/me").length;
    const table = () => page.locator(".live-table");
    const retry = () => page.getByRole("button", { name: "Thử lại", exact: true });
    const waitForHeld = async () => {
      for (let attempt = 0; !heldRoute && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
      assert.ok(heldRoute, "Expected a held /me request");
    };

    await page.goto(base + "/data/products");
    await table().waitFor();
    const initialChecks = meCount();
    await page.evaluate(() => { window.documentMarker = "same-document"; });
    await page.getByRole("link", { name: "Chi tiết", exact: true }).first().click();
    await page.locator(".live-field").first().waitFor();
    await page.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    await page.getByRole("button", { name: "Lưu dữ liệu", exact: true }).waitFor();
    assert.equal(await page.locator(".live-form input").first().inputValue(), "Sản phẩm test");
    await page.getByRole("link", { name: "Hủy", exact: true }).click();
    await page.locator(".live-field").first().waitFor();
    await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).getByRole("link", { name: "Sản phẩm", exact: true }).click();
    await table().waitFor();
    await page.getByRole("link", { name: "+ Thêm sản phẩm", exact: true }).click();
    await page.getByRole("button", { name: "Lưu dữ liệu", exact: true }).waitFor();
    const inputs = page.locator(".live-form input");
    await inputs.nth(0).fill("SP2"); await inputs.nth(1).fill("Sản phẩm mới");
    await page.getByRole("button", { name: "Lưu dữ liệu", exact: true }).click();
    await page.locator(".live-field").first().waitFor();
    assert.ok((await page.locator(".live-data").innerText()).includes("SP2"));
    await page.locator("aside").getByRole("button", { name: "TỔ CHỨC", exact: true }).click();
    await page.locator("aside").getByRole("button", { name: "Tài khoản", exact: true }).click();
    await table().waitFor();
    await page.getByRole("link", { name: "+ Thêm tài khoản", exact: true }).click();
    await page.getByRole("heading", { name: "Thêm tài khoản", exact: true }).waitFor();
    await page.getByRole("link", { name: "Hủy", exact: true }).click();
    await table().waitFor();
    await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).getByRole("link", { name: "Quản trị", exact: true }).first().click();
    await page.getByRole("heading", { name: "Thống kê hoạt động" }).waitFor();
    await page.getByRole("button", { name: "Mở Sản phẩm", exact: true }).click();
    // Dashboard also has a table: wait for the destination, not its outgoing table.
    await page.waitForURL("**/?module=products");
    await table().getByText("SP1", { exact: true }).waitFor();
    assert.equal(meCount(), initialChecks, "Internal navigation must not revalidate /me");
    assert.equal(documentLoads, 1, "No full-page reload for internal navigation/save");
    assert.equal(await page.evaluate(() => window.documentMarker), "same-document");

    // Returning to a fresh tab does not revalidate. Stale focus events share one request.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    assert.equal(meCount(), initialChecks);
    hold = true; heldRoute = undefined;
    await page.evaluate(() => {
      window.testTimeOffset += 61_000;
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await waitForHeld();
    assert.equal(meCount(), initialChecks + 1);
    assert.equal(await table().count(), 1, "Background check must not block verified UI");
    assert.ok(heldRoute);
    await respond(heldRoute, { detail: "Temporarily offline" }, 503); hold = false;
    await page.locator(".session-warning").waitFor();
    assert.equal(await table().count(), 1);
    assert.ok((await context.cookies()).some(cookie => cookie.name === "phub_session"));
    await page.getByRole("button", { name: "Thử kết nối lại", exact: true }).click();
    await page.locator(".session-warning").waitFor({ state: "hidden" });

    // Resource 403 stays on the page; 401 invalidates verified UI without another /me.
    dataStatus = 403;
    await page.getByRole("button", { name: "Làm mới", exact: true }).click();
    await retry().waitFor();
    assert.equal(await page.locator('input[name="username"]').count(), 0);
    dataStatus = 200; await retry().click(); await table().waitFor();
    // An in-flight /me success must not resurrect a session invalidated by a data 401.
    hold = true; heldRoute = undefined;
    await page.evaluate(() => window.dispatchEvent(new Event("phub-account-updated")));
    await waitForHeld();
    const checksBefore401 = meCount();
    dataStatus = 401;
    await page.getByRole("button", { name: "Làm mới", exact: true }).click();
    await page.locator('input[name="username"]').waitFor();
    await respond(heldRoute, user).catch(() => {}); hold = false;
    assert.equal(await page.locator(".shell").count(), 0);
    assert.equal(meCount(), checksBefore401);
    // Explicit reload re-verifies; successful logout drops the shared UI state.
    dataStatus = 200;
    await page.reload(); await table().waitFor();
    assert.ok(meCount() > checksBefore401);
    const checksBeforeLogout = meCount();
    await page.locator("aside").getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.locator('input[name="username"]').waitFor();
    assert.equal(await page.locator(".shell").count(), 0);
    assert.equal(meCount(), checksBeforeLogout, "Logout must not immediately re-open the old session");
    assert.equal(calls.filter(call => call.path === "/api/backend/auth/logout").length, 1);
    assert.deepEqual(errors, []);
    console.log(`PASS: ${initialChecks} initial /me; none on internal navigation; 1 document load; query/create/save/breadcrumb/sidebar work; stale-focus dedup; 503/403 preserved; 401 invalidates; stale /me cannot restore access.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
