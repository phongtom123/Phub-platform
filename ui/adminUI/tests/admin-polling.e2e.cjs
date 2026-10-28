/** Polling uses browser clocks and HTTP fixtures only: never writes live data. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const column = (name, immutable = false) => ({ name, type: "varchar", required: true, immutable, generated: false });

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.clock.install();
    const calls = [], errors = [];
    let name = "Tên ban đầu", fail = false, deny = false, documents = 0, hold = null, held = null;
    let account = { ma_tk: "TK1", ten_tai_khoan: "other", email: "other@example.test", ho_ten: "Tên chủ", role: "ADMIN", ma_nhan_vien: "NV1", ma_kh: null, ma_kho: null, trang_thai: 1, owner_active: true, is_self: false };
    let orderCount = 1;
    const resources = [{ name: "customers", title: "Khách hàng", keys: ["ma_kh"], writable: true, columns: [column("ma_kh", true), column("ten_kh")] },
      { name: "orders", title: "Đơn hàng", keys: ["ma_donhang"], writable: false, columns: [column("ma_donhang", true)] }];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      calls.push(request.method() + " " + url.pathname + url.search);
      const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname.endsWith("/auth/me")) return respond({ account_id: "AD1", username: "admin", role: "ADMIN", name: "Admin test" });
      if (url.pathname.endsWith("/data/resources")) return respond(resources);
      if (deny) return respond({ detail: "Hết phiên" }, 401);
      if (fail) return respond({ detail: "Test server offline" }, 503);
      if (url.pathname === "/api/backend/admin/accounts") return respond({ data: [account], total: 1, page: 1, page_size: 20 });
      if (url.pathname === "/api/backend/admin/accounts/TK1") return respond(account);
      if (request.method() === "PATCH") {
        name = request.postDataJSON().ten_kh;
        return respond({ data: [{ ma_kh: "KH1", ten_kh: name }] });
      }
      assert.equal(request.method(), "GET");
      const resource = url.pathname.split("/").pop();
      const rows = ({ customers: [{ ma_kh: "KH1", ten_kh: name }], products: [{ ma_sp: "SP1" }],
        orders: Array.from({ length: orderCount }, (_, i) => ({ ma_donhang: "DH" + i, thoi_gian_dat: new Date().toISOString(), trang_thai: "MOI", kenh_ban: "ONLINE" })),
        inventory: [{ ma_kho: 1, sku: "SKU1", so_luong_ton: 4 }], warehouses: [{ ma_kho: 1, ten_kho: "Kho 1" }] })[resource];
      assert.ok(rows, "Unexpected endpoint: " + url.pathname);
      const payload = { data: rows, total: rows.length, page: 1, page_size: Number(url.searchParams.get("page_size") || 20) };
      if (hold && resource === "customers") { const resolve = hold; hold = null; held = () => respond(payload); resolve(); return; }
      return respond(payload);
    });
    const reads = resource => calls.filter(call => call.startsWith("GET /api/backend/" + resource)).length;
    const row = () => page.locator("tbody tr").filter({ has: page.getByRole("link", { name: "KH1", exact: true }) });
    const tick = async () => { await page.clock.runFor(10_100); };
    await page.goto(base + "/data/customers"); await row().getByText(name, { exact: true }).waitFor();
    const stableRow = await row().elementHandle(), initial = reads("data/customers"), metadata = reads("data/resources");
    name = "Dữ liệu từ bên ngoài";
    await page.clock.runFor(9_000); assert.equal(reads("data/customers"), initial);
    await page.clock.runFor(1_100); await row().getByText(name, { exact: true }).waitFor();
    assert.equal(reads("data/customers"), initial + 1); assert.equal(reads("data/resources"), metadata);
    assert.equal(await stableRow.evaluate(node => node.isConnected), true, "Background refresh never unmounts the table");
    assert.equal(documents, 1); assert.equal(reads("auth/me"), 1);

    // Response started before an editor opens must not replace its row/draft.
    const waiting = new Promise(resolve => { hold = resolve; });
    name = "Response cũ"; await tick(); await waiting;
    await row().locator('[data-field="ten_kh"]').dblclick();
    const input = page.getByLabel("Tên khách hàng KH1", { exact: true }); await input.fill("Bản nháp của tôi");
    await held(); await page.clock.runFor(100);
    assert.equal(await input.inputValue(), "Bản nháp của tôi");
    const paused = reads("data/customers"); await tick(); assert.equal(reads("data/customers"), paused);
    await input.press("Escape"); name = "Sau hủy bản nháp"; await tick(); await row().getByText(name, { exact: true }).waitFor();

    // A slow read cannot overlap another cycle, and errors keep the last good DOM.
    const slow = new Promise(resolve => { hold = resolve; }); await tick(); await slow;
    const slowReads = reads("data/customers"); await page.clock.runFor(30_000); assert.equal(reads("data/customers"), slowReads);
    await held(); await page.clock.runFor(100);
    fail = true; await tick(); await page.getByRole("alert").filter({ hasText: "Tự cập nhật tạm lỗi" }).waitFor();
    await row().getByText(name, { exact: true }).waitFor();
    fail = false; name = "Phục hồi"; await tick(); await row().getByText(name, { exact: true }).waitFor();
    await page.getByRole("alert").filter({ hasText: "Tự cập nhật tạm lỗi" }).waitFor({ state: "hidden" });

    await page.evaluate(() => Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }));
    const hidden = reads("data/customers"); await tick(); assert.equal(reads("data/customers"), hidden);
    await page.evaluate(() => Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }));
    name = "Tab hiện lại"; await tick(); await row().getByText(name, { exact: true }).waitFor();

    await page.evaluate(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: false }));
    const offline = reads("data/customers"); await tick(); assert.equal(reads("data/customers"), offline);
    await page.evaluate(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: true }));
    await page.getByLabel("Tìm kiếm", { exact: true }).focus();
    await tick(); assert.equal(reads("data/customers"), offline, "Focused filter must not be interrupted");
    await page.locator("thead").click();

    await row().getByRole("link", { name: "KH1", exact: true }).click();
    await page.locator(".live-field").filter({ hasText: name }).waitFor();
    name = "Chi tiết mới"; await tick(); await page.locator(".live-field").filter({ hasText: name }).waitFor();
    for (const query of ["?new=1", "?key=" + encodeURIComponent('["KH1"]') + "&edit=1"]) {
      await page.goto(base + "/data/customers" + query);
      const draft = page.getByLabel("Tên khách hàng", { exact: false }); await draft.waitFor(); await draft.fill("Giữ form đang nhập");
      await page.locator(".live-page-actions").click();
      const formReads = reads("data/customers"); await page.clock.runFor(20_100);
      assert.equal(reads("data/customers"), formReads); assert.equal(await draft.inputValue(), "Giữ form đang nhập");
    }

    // Detail retains forms when refreshed, and pauses for drafts even after blur.
    await page.goto(base + "/accounts/TK1"); await page.locator(".live-field").filter({ hasText: account.email }).waitFor();
    account = { ...account, email: "new@example.test" }; await tick(); await page.locator(".live-field").filter({ hasText: account.email }).waitFor();
    await page.getByLabel("Mật khẩu mới *", { exact: true }).fill("test-only-draft"); await page.getByRole("heading", { name: "Phân quyền nhân viên" }).click();
    const detailPaused = reads("admin/accounts/TK1"); await tick(); assert.equal(reads("admin/accounts/TK1"), detailPaused);
    assert.equal(await page.getByLabel("Mật khẩu mới *", { exact: true }).inputValue(), "test-only-draft");

    await page.goto(base + "/accounts"); await page.getByText(account.email, { exact: true }).waitFor();
    account = { ...account, email: "list-new@example.test" }; await tick(); await page.getByText(account.email, { exact: true }).waitFor();

    await page.goto(base); await page.locator(".metric").first().locator("strong").getByText("1", { exact: true }).waitFor();
    orderCount = 2; await tick(); await page.locator(".metric").first().locator("strong").getByText("2", { exact: true }).waitFor();
    assert.equal(await page.locator(".live-table tbody tr").count(), 2, "Embedded list also updates");
    const meBeforeExpiry = reads("auth/me"); deny = true; await tick(); await page.locator('input[name="username"]').waitFor();
    assert.equal(reads("auth/me"), meBeforeExpiry, "Polling never checks session endpoint");
    const afterLogout = calls.length; await tick(); assert.equal(calls.length, afterLogout, "All polling stops when auth is invalidated");
    assert.ok(!calls.some(call => /^(POST|PUT|DELETE) /.test(call)), "Polling never writes");
    assert.deepEqual(errors, []);
    console.log("PASS: 10s fresh GET, stable DOM, scoped cache, draft/race protection, slow-read dedup, 503 recovery, hidden-tab pause, account list/detail, dashboard, 401 cleanup; no live writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
