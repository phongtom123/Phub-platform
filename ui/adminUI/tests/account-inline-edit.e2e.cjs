/** Account autosave regression. All HTTP writes mocked; no live account changes. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, hasTouch: true });
    const errors = [], patches = [];
    const reads = { documents: 0, rsc: 0, session: 0, list: 0, detail: 0 };
    const records = [
      { ma_tk: "AD000001", ten_tai_khoan: "admin", email: "admin@example.test", role: "ADMIN", is_self: true, ma_nhan_vien: "NV1", ma_kh: null },
      { ma_tk: "AD000002", ten_tai_khoan: "other.admin", email: "other@example.test", role: "ADMIN", is_self: false, ma_nhan_vien: "NV2", ma_kh: null },
      { ma_tk: "KH000003", ten_tai_khoan: "customer", email: null, role: "KHACH_HANG", is_self: false, ma_nhan_vien: null, ma_kh: "KH3" },
    ].map(row => ({ ...row, ho_ten: "Tên chủ tài khoản", ma_kho: null, trang_thai: 1, owner_active: true }));
    let failNext = false, holdNext = false, resolveHeld;
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) reads.documents++;
      if (new URL(request.url()).searchParams.has("_rsc")) reads.rsc++;
    });
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const respond = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      if (url.pathname === "/api/backend/data/resources") return respond([]);
      if (url.pathname.endsWith("/auth/me")) { reads.session++; return respond({ account_id: "AD000001", username: records[0].ten_tai_khoan, name: "Admin Test", role: "ADMIN" }); }
      if (url.pathname === "/api/backend/admin/accounts" && request.method() === "GET") {
        reads.list++;
        const q = url.searchParams.get("q") || "";
        const data = records.filter(row => (row.ma_tk + row.ten_tai_khoan + row.email).includes(q));
        return respond({ data, total: q ? data.length : 42, page: 1, page_size: 20 });
      }
      const record = records.find(row => url.pathname === "/api/backend/admin/accounts/" + row.ma_tk);
      assert.ok(record, "Unexpected request: " + request.method() + " " + url.pathname);
      if (request.method() === "GET") { reads.detail++; return respond(record); }
      assert.equal(request.method(), "PATCH");
      const body = request.postDataJSON();
      assert.ok(Object.keys(body).length);
      assert.ok(Object.keys(body).every(key => ["ten_tai_khoan", "email"].includes(key)), "Never patch IDs, owner, role, status or passwords inline");
      patches.push({ id: record.ma_tk, body });
      if (holdNext) { holdNext = false; resolveHeld(async () => { Object.assign(record, body); await respond(record); }); return; }
      if (failNext) { failNext = false; return respond({ detail: "Tên đăng nhập đã tồn tại." }, 409); }
      Object.assign(record, body); return respond(record);
    });
    const area = page.locator(".accounts-page");
    const row = id => area.locator(`tr[data-account-id="${id}"]`);
    const username = id => area.getByLabel(`Tên đăng nhập ${id}`, { exact: true });
    const email = id => area.getByLabel(`Email ${id}`, { exact: true });
    const outside = () => area.locator("thead th").last().click();
    async function open(id, field = "username") {
      await row(id).locator(`[data-field="${field}"]`).dblclick();
      await username(id).waitFor();
      assert.equal(await area.locator("tbody button").count(), 0, "No Sửa/Lưu/Hủy buttons, even while editing");
    }
    async function saved(id, baseline, stable) {
      await area.getByText(`Đã cập nhật tài khoản ${id}.`, { exact: true }).waitFor();
      assert.equal(await username(id).count(), 0);
      assert.deepEqual(reads, baseline, "Autosave must not reload documents/RSC/session/list/detail");
      assert.equal(await stable.evaluate(node => node.isConnected), true, "Other rows keep their DOM");
      assert.equal(new URL(page.url()).pathname, "/accounts");
    }
    await page.goto(base + "/accounts");
    await row("AD000002").waitFor();
    assert.equal(await area.locator("tbody button").count(), 0);
    assert.deepEqual(await area.locator("tbody td:last-child").allTextContents(), ["Chi tiết", "Chi tiết", "Chi tiết"]);
    await row("AD000002").locator('[data-field="email"]').click();
    assert.equal(await email("AD000002").count(), 0, "Single click does not open editor");
    await open("AD000002", "email");
    assert.equal(await email("AD000002").evaluate(node => node === document.activeElement), true);
    const unchanged = { ...reads };
    await outside();
    assert.equal(await area.locator("tbody input").count(), 0);
    assert.equal(patches.length, 0, "Unchanged editor closes without a PATCH");
    assert.deepEqual(reads, unchanged);
    await open("AD000002");
    const stable = await row("KH000003").elementHandle();
    await username("AD000002").fill("updated.user");
    await email("AD000002").fill("UPDATED@EXAMPLE.TEST");
    await row("AD000002").locator("td").nth(2).click();
    assert.equal(await username("AD000002").inputValue(), "updated.user");
    assert.equal(patches.length, 0, "Typing and moving inside the row never save prematurely");
    const baseline = { ...reads };
    await outside(); await saved("AD000002", baseline, stable);
    assert.deepEqual(patches.at(-1), { id: "AD000002", body: { ten_tai_khoan: "updated.user", email: "updated@example.test" } });
    // Keyboard remains available without any action buttons.
    await row("AD000002").focus(); await row("AD000002").press("F2");
    await username("AD000002").fill("discard.this");
    const beforeEscape = patches.length;
    await username("AD000002").press("Escape");
    assert.equal(await username("AD000002").count(), 0);
    assert.equal(patches.length, beforeEscape);
    assert.equal(await row("AD000002").evaluate(node => node === document.activeElement), true);
    await open("AD000002"); await username("AD000002").fill("enter.saved");
    const enterBaseline = { ...reads };
    await username("AD000002").press("Enter"); await saved("AD000002", enterBaseline, stable);
    // Invalid values and backend errors must never disappear or navigate away.
    await open("AD000002"); await username("AD000002").fill("x");
    const beforeInvalid = patches.length;
    await outside();
    await area.getByRole("alert").filter({ hasText: "Tên đăng nhập phải có" }).waitFor();
    assert.equal(await username("AD000002").inputValue(), "x");
    assert.equal(patches.length, beforeInvalid);
    await username("AD000002").fill("valid.user"); await email("AD000002").fill("invalid@domain");
    await outside(); await area.getByRole("alert").filter({ hasText: "Email không đúng" }).waitFor();
    assert.equal(patches.length, beforeInvalid);
    await email("AD000002").fill("updated@example.test"); await username("AD000002").fill("duplicate.user");
    failNext = true;
    await row("AD000002").getByRole("link", { name: "Chi tiết", exact: true }).click();
    await area.getByRole("alert").filter({ hasText: "Tên đăng nhập đã tồn tại." }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/accounts");
    assert.equal(await username("AD000002").inputValue(), "duplicate.user");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(patches.length, beforeInvalid + 1, "Pointerdown/click must not duplicate a failed save or auto-retry it");
    await username("AD000002").fill("unique.user");
    const retryBaseline = { ...reads };
    await outside(); await saved("AD000002", retryBaseline, stable);
    assert.deepEqual(patches.at(-1).body, { ten_tai_khoan: "unique.user" });
    await open("AD000002"); await email("AD000002").fill("");
    const clearBaseline = { ...reads };
    await outside(); await saved("AD000002", clearBaseline, stable);
    assert.deepEqual(patches.at(-1).body, { email: null });
    // Self save refreshes session/header intentionally once, not the list.
    await open("AD000001"); await username("AD000001").fill("self.updated");
    const beforeSelf = { ...reads };
    const sessionCheck = page.waitForResponse(response => new URL(response.url()).pathname === "/api/backend/auth/me");
    await outside(); await sessionCheck;
    await area.getByText("Đã cập nhật tài khoản AD000001.", { exact: true }).waitFor();
    assert.deepEqual(reads, { ...beforeSelf, session: beforeSelf.session + 1 });
    // Old URL and detail edit link still enter the table, not a separate edit page.
    await page.goto(base + "/accounts/AD000002/edit"); await username("AD000002").waitFor();
    assert.equal(new URL(page.url()).pathname, "/accounts");
    assert.equal(new URL(page.url()).searchParams.has("edit"), false);
    await outside();
    await row("AD000002").getByRole("link", { name: "Chi tiết", exact: true }).click();
    await page.waitForURL("**/accounts/AD000002"); await area.locator(".account-password-card").waitFor();
    assert.equal(await area.locator(".account-detail-card, .account-role-card, .account-password-card").count(), 3);
    await area.getByRole("link", { name: "Chỉnh sửa", exact: true }).click(); await username("AD000002").waitFor();
    // Multiple outside clicks and Enter while saving coalesce into one write.
    await username("AD000002").fill("pending.saved");
    holdNext = true;
    const heldPromise = new Promise(resolve => { resolveHeld = resolve; });
    const beforeHeld = patches.length;
    await outside(); const release = await heldPromise;
    assert.equal(await username("AD000002").isDisabled(), true);
    await outside(); await outside();
    assert.equal(patches.length, beforeHeld + 1);
    await row("AD000002").getByRole("link", { name: "Chi tiết", exact: true }).click();
    assert.equal(new URL(page.url()).pathname, "/accounts", "Navigation waits for the pending save");
    await release();
    await page.waitForURL("**/accounts/AD000002"); await area.locator(".account-detail-card").waitFor();
    assert.ok((await area.locator(".account-detail-card").innerText()).includes("pending.saved"));
    assert.equal(patches.length, beforeHeld + 1);
    // Touch outside saves on mobile as well; no action buttons appear.
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + "/accounts");
    await open("KH000003"); await username("KH000003").fill("touch.saved");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-account-autosave-mobile.png"), fullPage: true });
    const touchBaseline = { ...reads };
    const touchStable = await row("AD000002").elementHandle();
    await area.locator("thead th").last().tap();
    await saved("KH000003", touchBaseline, touchStable);
    await page.setViewportSize({ width: 1440, height: 960 });
    await open("AD000002", "email");
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-account-autosave-desktop.png"), fullPage: true });
    assert.deepEqual(errors, []);
    console.log("PASS: no edit/save/cancel buttons; outside mouse/touch autosave, unchanged closes without writes, Enter/Esc, same-row editing, validation/error drafts, explicit retry, null email, self refresh, no list/document/RSC refetch; deduped writes; detail navigation waits for success; legacy/detail/mobile preserved; no live writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
