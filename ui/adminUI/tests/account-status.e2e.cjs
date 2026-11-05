/** Table status dropdown: mocked HTTP only; never modifies live accounts. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [], writes = [], confirmations = [];
    const reads = { documents: 0, rsc: 0, session: 0, list: 0 };
    const records = [
      { ma_tk: "AD000001", ten_tai_khoan: "admin", role: "ADMIN", is_self: true, ma_nhan_vien: "NV1", ma_kh: null },
      { ma_tk: "KHO000001", ten_tai_khoan: "warehouse", role: "NHAN_VIEN", is_self: false, ma_nhan_vien: "NV2", ma_kh: null },
      { ma_tk: "KH000001", ten_tai_khoan: "customer", role: "KHACH_HANG", is_self: false, ma_nhan_vien: null, ma_kh: "KH1" },
    ].map(row => ({ ...row, email: "test@example.test", ho_ten: "Tên chủ tài khoản", ma_kho: null, trang_thai: 1, owner_active: true }));
    let confirm = true, failNext = false, holdNext = false, resolveHeld;
    page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", dialog => { confirmations.push(dialog.message()); void (confirm ? dialog.accept() : dialog.dismiss()); });
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
      if (url.pathname.endsWith("/auth/me")) { reads.session++; return respond({ account_id: "AD000001", username: "admin", name: "Admin Test", role: "ADMIN" }); }
      if (url.pathname === "/api/backend/admin/accounts") { reads.list++; return respond({ data: records, total: 42, page: 1, page_size: 20 }); }
      const record = records.find(row => url.pathname === `/api/backend/admin/accounts/${row.ma_tk}/status`);
      assert.ok(record, "Unexpected request: " + request.method() + " " + url.pathname);
      assert.equal(request.method(), "POST", "Status uses the dedicated POST endpoint, not the info PATCH");
      const body = request.postDataJSON();
      assert.deepEqual(Object.keys(body), ["trang_thai"]);
      assert.equal(typeof body.trang_thai, "number");
      assert.ok([0, 1, 2].includes(body.trang_thai));
      writes.push({ id: record.ma_tk, body });
      if (holdNext) { holdNext = false; resolveHeld(async () => { Object.assign(record, body); await respond(record); }); return; }
      if (failNext) { failNext = false; return respond({ detail: "Không thể cập nhật trạng thái lúc này." }, 409); }
      Object.assign(record, body); return respond(record);
    });
    const area = page.locator(".accounts-page");
    const row = id => area.locator(`tr[data-account-id="${id}"]`);
    const status = id => area.getByLabel(`Trạng thái tài khoản ${id}`, { exact: true });
    const username = id => area.getByLabel(`Tên đăng nhập ${id}`, { exact: true });
    await page.goto(base + "/accounts");
    await status("KHO000001").waitFor();
    assert.deepEqual(await status("KHO000001").locator("option").allTextContents(), ["Hoạt động", "Tạm khóa", "Đã ẩn"]);
    assert.equal(await status("AD000001").isDisabled(), true);
    await status("AD000001").evaluate(node => { node.value = "0"; node.dispatchEvent(new Event("change", { bubbles: true })); });
    assert.equal(writes.length, 0, "Even a forged change event cannot self-lock/hide");
    assert.equal(await status("AD000001").inputValue(), "1");
    assert.equal(confirmations.length, 0);
    await status("KHO000001").selectOption("1");
    assert.equal(writes.length, 0, "Unchanged status does not POST");
    const stable = await row("KH000001").elementHandle();
    const baseline = { ...reads };
    for (const [value, label] of [["2", "Tạm khóa"], ["0", "Đã ẩn"], ["1", "Hoạt động"]]) {
      await status("KHO000001").selectOption(value);
      await area.getByText(`Đã cập nhật trạng thái tài khoản KHO000001: ${label}.`, { exact: true }).waitFor();
      assert.equal(await status("KHO000001").inputValue(), value);
      assert.ok((await status("KHO000001").getAttribute("class")).includes("status-" + value));
    }
    assert.deepEqual(writes.map(write => write.body.trang_thai), [2, 0, 1]);
    assert.equal(confirmations.length, 2, "Only lock/hide need confirmation");
    assert.equal(await stable.evaluate(node => node.isConnected), true);
    assert.deepEqual(reads, baseline, "Status changes must not refetch session/list/RSC/document");
    confirm = false;
    await status("KHO000001").selectOption("0");
    assert.equal(await status("KHO000001").inputValue(), "1");
    assert.equal(writes.length, 3, "Dismissed confirmation does not write");
    confirm = true;
    failNext = true;
    await status("KHO000001").selectOption("2");
    await row("KHO000001").getByRole("alert").waitFor();
    assert.equal(await status("KHO000001").inputValue(), "1", "API failure keeps the old status");
    assert.equal(await status("KHO000001").isDisabled(), false);
    assert.equal(writes.length, 4, "A failed POST is never retried automatically");
    assert.deepEqual(reads, baseline);
    await status("KHO000001").selectOption("2");
    await area.getByText("Đã cập nhật trạng thái tài khoản KHO000001: Tạm khóa.", { exact: true }).waitFor();
    assert.equal(await row("KHO000001").getByRole("alert").count(), 0);
    // Info edits and status writes cannot overlap or overwrite each other.
    await row("KHO000001").locator('[data-field="username"]').dblclick();
    await username("KHO000001").waitFor();
    assert.equal(await status("KHO000001").isDisabled(), true);
    assert.equal(await status("KH000001").isDisabled(), true);
    await status("KHO000001").evaluate(node => { node.value = "0"; node.dispatchEvent(new Event("change", { bubbles: true })); });
    assert.equal(writes.length, 5, "Status is guarded while info is being edited");
    await username("KHO000001").press("Escape");
    holdNext = true;
    const heldPromise = new Promise(resolve => { resolveHeld = resolve; });
    await status("KH000001").selectOption("0");
    const release = await heldPromise;
    assert.equal(await status("KH000001").inputValue(), "1", "Do not claim success before the API responds");
    assert.equal(await status("KH000001").isDisabled(), true);
    assert.equal(await status("KHO000001").isDisabled(), true);
    assert.equal(await area.getByLabel("Tìm tài khoản", { exact: true }).isDisabled(), true);
    assert.equal(await area.getByRole("button", { name: "Sau", exact: true }).isDisabled(), true);
    await row("KHO000001").locator('[data-field="username"]').dblclick();
    assert.equal(await username("KHO000001").count(), 0, "Do not start an info edit during status save");
    await status("KH000001").evaluate(node => { node.value = "2"; node.dispatchEvent(new Event("change", { bubbles: true })); });
    assert.equal(writes.length, 6, "Pending status cannot be submitted twice");
    await release();
    await area.getByText("Đã cập nhật trạng thái tài khoản KH000001: Đã ẩn.", { exact: true }).waitFor();
    assert.equal(await status("KH000001").inputValue(), "0");
    assert.equal(await area.getByLabel("Tìm tài khoản", { exact: true }).isDisabled(), false);
    assert.deepEqual(reads, baseline);
    assert.equal(await area.locator("tbody button").count(), 0, "Do not reintroduce edit/save/cancel buttons");
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-account-status-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await status("KH000001").selectOption("1");
    await area.getByText("Đã cập nhật trạng thái tài khoản KH000001: Hoạt động.", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-account-status-mobile.png"), fullPage: true });
    assert.deepEqual(errors, []);
    console.log("PASS: table status dropdown, dedicated POST for 0/1/2, confirm/cancel, self protection, unchanged no-op, API rollback/retry, pending dedup and info-edit serialization; stable DOM and no refetch/navigation; mobile; no live writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
