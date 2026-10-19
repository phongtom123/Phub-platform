/** Real Next UI, mocked APIs only. Never writes production data. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const column = (name, options = {}) => ({ name, type: "varchar", required: false, immutable: false, generated: false, choices: null, default: null, ...options });
const resources = [
  { name: "customers", title: "Khách hàng", keys: ["ma_kh"], writable: true, columns: [column("ma_kh", { immutable: true }), column("ten_kh", { required: true }), column("sdt"), column("dia_chi_chi_tiet_md"), column("tinh_thanh_md"), column("xa_phuong_md")] },
  { name: "warehouses", title: "Kho", keys: ["ma_kho"], writable: true, columns: [column("ma_kho", { type: "int", generated: true, immutable: true }), column("ten_kho", { required: true }), column("dia_chi", { required: true }), column("trang_thai", { type: "int", required: true })] },
  { name: "orders", title: "Đơn hàng", keys: ["ma_donhang"], writable: false, columns: [column("ma_donhang"), column("kenh_ban")] },
];
const data = {
  customers: [{ ma_kh: "KH1", ten_kh: "Khách thứ nhất", sdt: null, dia_chi_chi_tiet_md: null, tinh_thanh_md: "Hà Nội", xa_phuong_md: null }, { ma_kh: "KH2", ten_kh: "Khách thứ hai", sdt: "0123456789", dia_chi_chi_tiet_md: null, tinh_thanh_md: null, xa_phuong_md: null }],
  warehouses: [{ ma_kho: -900001, ten_kho: "Kho một", dia_chi: "Hà Nội", trang_thai: 1 }, { ma_kho: 2, ten_kho: "Kho hai", dia_chi: "Đà Nẵng", trang_thai: 1 }],
  orders: [{ ma_donhang: "DH1", kenh_ban: "ONLINE" }],
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1100 } });
    const errors = [], writes = [], reads = { documents: 0, rsc: 0, session: 0, metadata: 0, data: 0 };
    let failNext = false, holdNext = false, held, readOnly = false;
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) reads.documents++;
      if (new URL(request.url()).searchParams.has("_rsc")) reads.rsc++;
    });
    const respond = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      if (url.pathname.endsWith("/auth/me")) { reads.session++; return respond(route, { account_id: "AD1", username: "admin", name: "Admin Test", role: "ADMIN" }); }
      if (url.pathname.endsWith("/data/resources")) { reads.metadata++; return respond(route, resources.map(resource => ({ ...resource, writable: readOnly ? false : resource.writable }))); }
      const resource = resources.find(item => url.pathname === "/api/backend/data/" + item.name);
      assert.ok(resource, request.url());
      const key = url.searchParams.get("key");
      const rows = key ? data[resource.name].filter(row => JSON.stringify(resource.keys.map(name => row[name])) === key) : data[resource.name];
      if (request.method() === "PATCH") {
        assert.equal(readOnly, false); assert.equal(resource.writable, true);
        const patch = request.postDataJSON();
        assert.ok(resource.keys.every(key => !(key in patch)), "PK must never be sent");
        writes.push({ resource: resource.name, key: JSON.parse(key), patch });
        if (holdNext) { holdNext = false; held = { route, row: rows[0], patch }; return; }
        if (failNext) { failNext = false; return respond(route, { detail: "Lỗi lưu kiểm thử." }, 503); }
        Object.assign(rows[0], patch);
        return respond(route, { data: rows });
      }
      assert.equal(request.method(), "GET"); reads.data++;
      return respond(route, { data: rows, total: 42, page: 1, page_size: 20 });
    });
    const row = id => page.locator("tbody tr").filter({ has: page.getByRole("link", { name: id, exact: true }) });
    const outside = () => page.locator("thead th").last().click();
    const waitSaved = () => page.getByRole("status").filter({ hasText: "Đã lưu thay đổi." }).waitFor();
    const edit = async (id, field) => { await row(id).locator(`[data-field="${field}"]`).dblclick(); };
    const assertNoButtons = async () => {
      assert.equal(await page.locator("tbody button").count(), 0);
      assert.equal(await page.getByRole("link", { name: "Sửa", exact: true }).count(), 0);
    };

    await page.goto(base + "/data/customers"); await row("KH1").waitFor();
    await assertNoButtons();
    assert.equal(await page.getByText(/Nguồn: API Python|Chế độ chỉ xem dữ liệu thật/).count(), 0);
    assert.equal(await page.locator("h2").evaluate(element => element.getBoundingClientRect().width <= 1), true);
    const widthBefore = await page.locator(".live-table").evaluate(element => element.getBoundingClientRect().width);
    await page.getByRole("button", { name: "Đóng mở thanh điều hướng", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".main").getAnimations().every(animation => animation.playState !== "running"));
    const geometry = await page.locator(".live-table").evaluate(element => {
      const bounds = element.getBoundingClientRect(); return { width: bounds.width, rightGap: innerWidth - bounds.right };
    });
    assert.ok(Math.abs(geometry.width - widthBefore - 190) < 2, JSON.stringify({ widthBefore, geometry }));
    assert.ok(geometry.rightGap <= 40, "No unused max-width whitespace on wide screens");
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-customers-collapsed.png"), fullPage: true });

    await edit("KH1", "ten_kh");
    const firstRow = await row("KH1").elementHandle(), otherRow = await row("KH2").elementHandle();
    const name = page.getByLabel("Tên khách hàng KH1", { exact: true });
    const phone = page.getByLabel("Số điện thoại KH1", { exact: true });
    const before = { ...reads };
    await name.fill("Tên khách mới"); await phone.fill("0012345678"); await outside(); await waitSaved();
    assert.deepEqual(writes.at(-1).patch, { ten_kh: "Tên khách mới", sdt: "0012345678" });
    assert.deepEqual(reads, before, "Inline save must not refetch session/list/metadata/document/RSC");
    for (const node of [firstRow, otherRow]) assert.equal(await node.evaluate(node => node.isConnected), true);
    await edit("KH1", "sdt"); await phone.fill(""); await phone.press("Enter"); await waitSaved();
    assert.deepEqual(writes.at(-1).patch, { sdt: null });
    let count = writes.length;
    await edit("KH1", "ten_kh"); await outside(); assert.equal(writes.length, count);
    await edit("KH1", "ten_kh"); await name.fill("Hủy thay đổi"); await name.press("Escape"); assert.equal(writes.length, count);
    await edit("KH1", "ten_kh"); await name.fill(" "); await outside(); await page.locator('.live-error[role="alert"]').waitFor();
    assert.equal(writes.length, count); assert.equal(await name.count(), 1);
    failNext = true; await name.fill("Thử lại tên"); await outside(); await page.getByText("Lỗi lưu kiểm thử.", { exact: true }).waitFor();
    assert.equal(await name.inputValue(), "Thử lại tên"); assert.equal(writes.length, ++count);
    await name.press("Enter"); await waitSaved(); assert.equal(writes.length, ++count);

    // Navigation waits for the pending save and must not replay the write.
    await edit("KH1", "ten_kh"); await name.fill("Lưu trước chi tiết"); holdNext = true; held = null;
    await row("KH1").getByRole("link", { name: "Chi tiết", exact: true }).click();
    for (let i = 0; !held && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(held); assert.equal(new URL(page.url()).searchParams.has("key"), false);
    assert.equal(await page.getByRole("button", { name: "Sau", exact: true }).isDisabled(), true);
    await page.locator("thead th").last().click(); assert.equal(writes.length, ++count);
    Object.assign(held.row, held.patch); await respond(held.route, { data: [held.row] });
    await page.waitForURL(url => url.searchParams.has("key")); await page.locator(".live-field").first().waitFor();
    assert.equal(await page.locator(".live-field").filter({ hasText: "Lưu trước chi tiết" }).count(), 1);

    await page.goto(base + "/data/warehouses"); await row("-900001").waitFor(); await assertNoButtons();
    await edit("-900001", "ten_kho"); await page.getByLabel("Tên kho -900001", { exact: true }).fill("Kho sửa trực tiếp");
    await outside(); await waitSaved(); assert.deepEqual(writes.at(-1).key, [-900001]);
    assert.deepEqual(writes.at(-1).patch, { ten_kho: "Kho sửa trực tiếp" });
    const status = page.getByLabel("Trạng thái -900001", { exact: true });
    page.on("dialog", dialog => dialog.accept());
    const statusReads = { ...reads };
    await status.selectOption("2"); await waitSaved(); assert.equal(await status.inputValue(), "2");
    assert.deepEqual(writes.at(-1).patch, { trang_thai: 2 }); assert.deepEqual(reads, statusReads);
    failNext = true; await status.selectOption("1"); await page.getByText("Lỗi lưu kiểm thử.", { exact: true }).waitFor();
    assert.equal(await status.inputValue(), "2");
    await status.selectOption("1"); await waitSaved(); assert.equal(await status.inputValue(), "1");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector(".main").getAnimations().every(animation => animation.playState !== "running"));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-warehouses-inline-mobile.png"), fullPage: true });
    readOnly = true; await page.reload(); await row("-900001").waitFor();
    await row("-900001").locator("td").nth(1).dblclick();
    assert.equal(await page.locator("tbody input, tbody select").count(), 0);
    await page.goto(base + "/data/orders"); await row("DH1").waitFor();
    assert.equal(await page.getByText(/Nguồn: API Python|Chế độ chỉ xem dữ liệu thật/).count(), 0);
    assert.equal(await page.locator("tbody input, tbody select").count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: sidebar expands content 190px with no max-width gap; redundant copy hidden/removed; customer/warehouse inline autosave, nullable phones, Escape/validation/retry, deduped pending navigation, numeric signed keys, status dropdown/error rollback, read-only protection and mobile; no live writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
