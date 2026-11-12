// Browser fixtures only: never change a real order or payment.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_STAFF_TEST_URL || "http://localhost:3002";
const orderId = "FIXTURE-ROW-UPDATE";
const column = name => ({ name, type: "varchar", required: false, generated: false, immutable: true, choices: null, system: false, default: null });
const order = { ma_donhang: orderId, trang_thai: "MOI", ma_kh: "KH1", ma_nhan_vien: "NV1", kenh_ban: "ONLINE", thoi_gian_dat: "2026-11-11T08:00:00Z", ten_nguoi_nhan: "Khách thử" };
const other = { ...order, ma_donhang: "FIXTURE-UNCHANGED", thoi_gian_dat: "2026-11-10T08:00:00Z" };
const resources = [
  { name: "orders", title: "Đơn hàng", keys: ["ma_donhang"], writable: false, columns: Object.keys(order).map(column) },
  ...[["customers", "ma_kh"], ["employees", "ma_nhan_vien"]].map(([name, key]) => ({ name, title: name, keys: [key], writable: false, columns: [column(key)] })),
];

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [], writes = [], reads = { list: 0, metadata: 0, people: 0, detail: 0 };
    let failWrite = false, failDetail = false, releaseDetail;
    page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", dialog => dialog.accept());
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const reply = (body, status = 200) => route.fulfill({ status, json: body });
      if (url.pathname.endsWith("/auth/me")) return reply({ account_id: "STAFF", username: "fixture", name: "Staff", role: "NHAN_VIEN", employee_id: "NV1", warehouse_id: 1 });
      if (url.pathname.endsWith("/data/resources")) { reads.metadata++; return reply(resources); }
      if (url.pathname.endsWith("/data/orders")) {
        reads.list++;
        const filters = JSON.parse(url.searchParams.get("filters") || "{}");
        const data = [order, other].filter(row => !filters.trang_thai || row.trang_thai === filters.trang_thai);
        return reply({ data, total: data.length, page: 1, page_size: 20, filters });
      }
      if (url.pathname.endsWith("/data/customers") || url.pathname.endsWith("/data/employees")) {
        reads.people++;
        return reply({ data: [{ ma_kh: "KH1", ten_kh: "Khách thử", ma_nhan_vien: "NV1", ho_ten: "Nhân viên thử" }], total: 1 });
      }
      if (url.pathname === `/api/backend/admin/orders/${orderId}/detail`) {
        reads.detail++;
        if (releaseDetail) await new Promise(resolve => { releaseDetail = resolve; });
        if (failDetail) return reply({ detail: "Không tải được chi tiết mới (fixture)." }, 503);
        return reply({ order_id: orderId, order, customer: { ma_kh: "KH1", ten_kh: "Khách thử" }, employee: { ma_nhan_vien: "NV1", ho_ten: "Nhân viên thử" },
          lines: [], invoice: null, payments: [], voucher_uses: [], history: [],
          financial: { invoice_id: null, invoice_status: "CHUA_LAP", payment_status: "CHUA_CO_HOA_DON", total: null, collected: "0.00", refunded: "0.00", paid: "0.00", remaining: null } });
      }
      if (url.pathname === "/api/backend/admin/operations/orders") {
        assert.equal(request.method(), "POST");
        const body = request.postDataJSON(); writes.push({ body, key: request.headers()["idempotency-key"] });
        assert.equal(body.record_id, orderId);
        if (failWrite) return reply({ detail: "Thao tác chưa thành công (fixture)." }, 503);
        assert.equal(body.expected_status, order.trang_thai);
        order.trang_thai = { confirm: "XAC_NHAN", prepare: "DANG_CHUAN_BI", dispatch: "DA_XUAT_KHO" }[body.action];
        return reply({ data: [order], replayed: false });
      }
      assert.fail(`Unexpected API ${request.method()} ${url.pathname}`);
    });

    await page.goto(base + "/?module=orders");
    const table = page.locator(".live-data table").first();
    const row = table.locator("tbody tr").filter({ has: page.getByRole("button", { name: orderId, exact: true }) });
    await row.getByText("Mới", { exact: true }).waitFor();
    await table.getByText("Nhân viên thử", { exact: true }).first().waitFor();
    await page.evaluate(() => {
      window.fixtureTable = document.querySelector(".live-data table");
      window.fixtureOther = window.fixtureTable.querySelectorAll("tbody tr")[1];
    });
    await row.getByRole("button", { name: "Chi tiết", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: orderId });
    await dialog.getByRole("button", { name: "Xác nhận đơn", exact: true }).waitFor();
    const baseline = { ...reads };
    const unchanged = async () => {
      assert.equal(reads.list, baseline.list, "must not reload order list");
      assert.equal(reads.metadata, baseline.metadata, "must not reload metadata");
      assert.equal(reads.people, baseline.people, "must not reload people");
      assert.ok(await page.evaluate(() => window.fixtureTable.isConnected && window.fixtureOther.isConnected), "table and unrelated row stay mounted");
    };
    await dialog.getByRole("button", { name: "Xác nhận đơn", exact: true }).click();
    await row.getByText("Đã xác nhận", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Chuẩn bị hàng", exact: true }).waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.querySelector('[role="dialog"] fieldset').disabled);
    await unchanged();

    // A successful write must update the outside row even if detail revalidation fails.
    failDetail = true;
    await dialog.getByRole("button", { name: "Chuẩn bị hàng", exact: true }).click();
    await row.getByText("Đang chuẩn bị", { exact: true }).waitFor();
    await dialog.getByRole("alert").getByText("Không tải được chi tiết mới (fixture).", { exact: true }).waitFor();
    await unchanged();
    failDetail = false;
    await dialog.getByRole("button", { name: "Thử lại", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[role="dialog"] fieldset').disabled);

    failWrite = true;
    await dialog.getByRole("button", { name: "Xác nhận xuất kho", exact: true }).click();
    await dialog.getByText("Thao tác chưa thành công (fixture).", { exact: false }).waitFor();
    assert.equal(await row.getByText("Đang chuẩn bị", { exact: true }).count(), 1, "failed write must not change the row");
    await unchanged();
    failWrite = false;
    releaseDetail = true;
    await dialog.getByRole("button", { name: "Thử lại cùng yêu cầu", exact: true }).click();
    await row.getByText("Đã xuất kho", { exact: true }).waitFor();
    assert.equal(writes.at(-1).key, writes.at(-2).key, "retry preserves idempotency");
    await dialog.getByRole("button", { name: "Đóng chi tiết đơn hàng", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    if (typeof releaseDetail === "function") releaseDetail();
    releaseDetail = null;
    await row.getByText("Đã xuất kho", { exact: true }).waitFor();
    await unchanged();

    // A status filter removes only the changed order and corrects the count.
    order.trang_thai = "MOI";
    await page.goto(base + "/?module=orders&filters=" + encodeURIComponent(JSON.stringify({ trang_thai: "MOI" })));
    await row.getByText("Mới", { exact: true }).waitFor();
    await row.getByRole("button", { name: "Chi tiết", exact: true }).click();
    await dialog.getByRole("button", { name: "Xác nhận đơn", exact: true }).waitFor();
    const listReads = reads.list;
    await dialog.getByRole("button", { name: "Xác nhận đơn", exact: true }).click();
    await row.waitFor({ state: "detached" });
    await dialog.getByRole("button", { name: "Đóng chi tiết đơn hàng", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await table.locator("tbody tr").count(), 1);
    await page.getByText("1 kết quả · Trang 1", { exact: true }).waitFor();
    assert.equal(reads.list, listReads);
    assert.deepEqual(errors, []);
    console.log("PASS: status updates patch one order without list/metadata/people reload or table remount; detail errors, failed writes, idempotent retry, early close and filtered counts stay correct.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
