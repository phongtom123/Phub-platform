const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");

const base = process.env.PHUB_STAFF_TEST_URL || "http://localhost:3002";
const orderId = "ORDER-DRAWER-1";
const column = (name, type = "varchar") => ({ name, type, required: false, generated: false, immutable: true, choices: null, system: false, default: null });
const orderColumns = ["ma_donhang", "ma_kh", "ma_nhan_vien", "kenh_ban", "trang_thai", "thoi_gian_dat", "ten_nguoi_nhan", "sdt_nguoi_nhan", "dia_chi_chi_tiet", "tinh_thanh", "xa_phuong", "ghi_chu"].map(name => column(name));
const resources = [
  { name: "orders", title: "Đơn hàng", keys: ["ma_donhang"], writable: false, columns: orderColumns },
  { name: "customers", title: "Khách hàng", keys: ["ma_kh"], writable: false, columns: [column("ma_kh"), column("ten_kh")] },
  { name: "employees", title: "Nhân viên", keys: ["ma_nhan_vien"], writable: false, columns: [column("ma_nhan_vien"), column("ho_ten")] },
];
const order = {
  ma_donhang: orderId, ma_kh: "KH-1", ma_nhan_vien: "NV-1", kenh_ban: "ONLINE", trang_thai: "HOAN_THANH",
  thoi_gian_dat: "2026-11-09T08:00:00Z", ten_nguoi_nhan: "Khách nhận hàng", sdt_nguoi_nhan: "0900000000",
  dia_chi_chi_tiet: "1 Đường thử nghiệm", tinh_thanh: "TP.HCM", xa_phuong: "Phường 1", ghi_chu: "Giao giờ hành chính",
};
const detail = {
  order_id: orderId, order,
  customer: { ma_kh: "KH-1", ten_kh: "Nguyễn Khách Hàng" },
  employee: { ma_nhan_vien: "NV-1", ho_ten: "Trần Nhân Viên" },
  lines: ["1790000.00", "32990000.00", "10980000.00", "700000.00"].map((amount, index) => ({
    ma_ct_donhang: index + 1, ten_sp_luc_ban: `Sản phẩm ${index + 1}`, sku: `SKU-${index + 1}`,
    ma_kho_xuat: 1, so_luong: 1, don_vi_luc_ban: "Cái", don_gia: amount,
    giam_gia: "0.00", giam_gia_voucher: "0.00", tien_thue: "0.00", thue_suat: "10.00", thanh_tien: amount,
  })), invoice: null, payments: [], voucher_uses: [], history: [],
  financial: { invoice_id: null, invoice_status: "CHUA_LAP", payment_status: "CHUA_CO_HOA_DON", total: null, collected: "0.00", refunded: "0.00", paid: "0.00", remaining: null },
};

// Browser fixtures only; the real database never receives a request.
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1000 } });
    const second = { ...order, ma_donhang: "ORDER-SECOND", thoi_gian_dat: "2026-11-08T08:00:00Z", ghi_chu: "Đơn thứ hai" };
    const extraRows = Array.from({ length: 18 }, (_, index) => ({ ...second, ma_donhang: `ORDER-EXTRA-${index}`, thoi_gian_dat: "2026-11-07T08:00:00Z" }));
    let currentDetail = detail, holdDetail = null, detailReads = 0, empty = false;
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const reply = body => route.fulfill({ status: 200, json: body });
      if (url.pathname.endsWith("/auth/me")) return reply({ account_id: "NV-1", username: "staff", name: "Nhân viên", role: "NHAN_VIEN", warehouse_id: 1 });
      if (url.pathname.endsWith("/data/resources")) return reply(resources);
      if (url.pathname.endsWith("/data/orders")) return reply({ data: empty ? [] : [order, second, ...extraRows], total: empty ? 0 : 20, page: 1, page_size: 20, filters: {} });
      if (url.pathname.endsWith("/data/customers")) return reply({ data: [{ ma_kh: "KH-1", ten_kh: "Nguyễn Khách Hàng" }], total: 1, page: 1, page_size: 20 });
      if (url.pathname.endsWith("/data/employees")) return reply({ data: [{ ma_nhan_vien: "NV-1", ho_ten: "Trần Nhân Viên" }], total: 1, page: 1, page_size: 20 });
      if (url.pathname === `/api/backend/admin/orders/${orderId}/detail`) {
        detailReads++;
        if (holdDetail) await holdDetail;
        return reply(currentDetail);
      }
      if (url.pathname === "/api/backend/admin/orders/ORDER-SECOND/detail") return reply({ ...detail, order_id: second.ma_donhang, order: second });
      assert.fail(`Unexpected API ${route.request().method()} ${url.pathname}`);
    });

    await page.goto(`${base}/data/orders`);
    const panel = page.getByRole("region", { name: orderId, exact: true });
    const list = page.getByRole("region", { name: "Danh sách đơn hàng", exact: true });
    const separator = page.getByRole("separator", { name: "Điều chỉnh độ rộng chi tiết đơn hàng" });
    await panel.getByRole("heading", { name: "Khách hàng & giao nhận", exact: true }).waitFor();
    assert.ok(detailReads >= 1, "first order is loaded without a click");
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
    assert.equal(await page.getByRole("dialog").count(), 0, "detail is a persistent region, not a modal");
    const initial = await panel.boundingBox(), listBox = await list.boundingBox();
    assert.ok(listBox.x + listBox.width < initial.x, "detail stays to the right of the list");
    assert.ok(initial.width > listBox.width * 1.7, "detail is the main content area");
    assert.equal(await list.locator('tr[aria-selected="true"]').count(), 1);
    assert.equal(await list.locator("table").evaluate(element => getComputedStyle(element).display), "table");
    assert.equal(await list.getByRole("columnheader", { name: "Mã đơn hàng", exact: true }).isVisible(), true);
    assert.equal(await list.getByRole("columnheader", { name: "Trạng thái", exact: true }).isVisible(), true);
    for (const name of ["Sản phẩm", "Kênh / nhận hàng", "Khách hàng / nhân viên", "Thao tác"]) {
      assert.equal(await list.getByRole("columnheader", { name, exact: true }).count(), 0);
    }
    const invoiceBox = await panel.getByRole("heading", { name: "Hóa đơn", exact: true }).boundingBox();
    const paymentBox = await panel.getByRole("heading", { name: "Thanh toán", exact: true }).boundingBox();
    assert.ok(invoiceBox.y < paymentBox.y, "invoice precedes payment information");
    const lines = panel.getByRole("table", { name: "Sản phẩm trong đơn", exact: true });
    assert.equal(await lines.locator("tbody tr").count(), 4);
    assert.match(await lines.locator("tfoot").innerText(), /Tổng tiền\s+46\.460\.000/);
    assert.equal(await panel.locator(".order-invoice-block > dl").count(), 0, "remove the separate four summary boxes");

    // Both axes scroll inside the table viewport. The separate top rail must
    // remain above the header/rows even after vertical scrolling and resizing.
    const rail = list.locator("[data-table-scrollbar]");
    const viewport = list.locator("[data-table-scroll-viewport]");
    await rail.waitFor({ state: "visible" });
    const railBefore = await rail.boundingBox(), viewportBefore = await viewport.boundingBox();
    assert.ok(railBefore.y + railBefore.height <= viewportBefore.y + 1, "rail has its own lane above the table");
    await viewport.evaluate(element => { element.scrollTop = 240; });
    assert.ok(Math.abs((await rail.boundingBox()).y - railBefore.y) < 1, "vertical scrolling must not move the top rail over data");
    await rail.evaluate(element => { element.scrollLeft = 180; });
    await page.waitForFunction(() => document.querySelector('[aria-label="Danh sách đơn hàng"] [data-table-scroll-viewport]').scrollLeft >= 179);
    await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await page.waitForFunction(() => {
      const root = document.querySelector('[aria-label="Danh sách đơn hàng"]');
      return Math.abs(root.querySelector('[data-table-scrollbar]').scrollLeft - root.querySelector('[data-table-scroll-viewport]').scrollLeft) < 1;
    });
    await viewport.evaluate(element => { element.scrollTop = 0; element.scrollLeft = 0; });

    // Pointer resize, keyboard resize, reset and persistence across navigation.
    const handle = await separator.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 80);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 150, handle.y + 80, { steps: 8 });
    await page.mouse.up();
    assert.ok((await panel.boundingBox()).width > initial.width + 100);
    const grown = Number(await separator.getAttribute("aria-valuenow"));
    await separator.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(Number(await separator.getAttribute("aria-valuenow")), grown - 2);
    assert.ok(await page.evaluate(() => Number(localStorage.getItem("phub-order-detail-right-width-v1")) > 70));
    await separator.dblclick();
    assert.equal(await separator.getAttribute("aria-valuenow"), "70");

    const heightSeparator = page.getByRole("separator", { name: "Điều chỉnh chiều cao khung đơn hàng" });
    const originalHeight = (await panel.boundingBox()).height;
    const heightHandle = await heightSeparator.boundingBox();
    await page.mouse.move(heightHandle.x + heightHandle.width / 2, heightHandle.y + heightHandle.height / 2);
    await page.mouse.down();
    await page.mouse.move(heightHandle.x + heightHandle.width / 2, heightHandle.y - 100, { steps: 8 });
    await page.mouse.up();
    assert.ok((await panel.boundingBox()).height < originalHeight - 80, "bottom handle resizes both panes vertically");
    const shorterHeight = Number(await heightSeparator.getAttribute("aria-valuenow"));
    await heightSeparator.focus(); await page.keyboard.press("ArrowDown");
    assert.equal(Number(await heightSeparator.getAttribute("aria-valuenow")), shorterHeight + 40);
    assert.ok(await page.evaluate(() => Number(localStorage.getItem("phub-order-workspace-height-v1")) >= 320));
    await heightSeparator.dblclick();
    assert.equal(await page.evaluate(() => localStorage.getItem("phub-order-workspace-height-v1")), null);

    const firstButton = list.getByRole("button", { name: orderId, exact: true });
    const secondButton = list.getByRole("button", { name: second.ma_donhang, exact: true });
    await secondButton.click();
    await page.getByRole("region", { name: second.ma_donhang, exact: true }).getByText("Đơn thứ hai", { exact: true }).waitFor();
    await page.waitForTimeout(1_100);
    let releaseDetail;
    holdDetail = new Promise(resolve => { releaseDetail = resolve; });
    const checking = page.waitForRequest(request => new URL(request.url()).pathname === `/api/backend/admin/orders/${orderId}/detail`);
    await firstButton.click();
    await panel.getByRole("heading", { name: "Khách hàng & giao nhận", exact: true }).waitFor({ timeout: 2_000 });
    await checking;
    currentDetail = { ...detail, order: { ...order, ghi_chu: "Cập nhật từ thiết bị khác" } };
    holdDetail = null; releaseDetail();
    await panel.getByText("Cập nhật từ thiết bị khác", { exact: true }).waitFor();
    currentDetail = { ...detail, order: { ...order, ghi_chu: "Cập nhật qua polling" } };
    await panel.getByText("Cập nhật qua polling", { exact: true }).waitFor({ timeout: 15_000 });
    currentDetail = { ...detail, order: { ...order, ghi_chu: "Cập nhật theo yêu cầu" } };
    await panel.getByRole("button", { name: "Cập nhật thanh toán", exact: true }).click();
    await panel.getByText("Cập nhật theo yêu cầu", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await panel.waitFor();

    if (process.env.PHUB_LAYOUT_SCREENSHOTS) await page.screenshot({ path: `${process.env.PHUB_LAYOUT_SCREENSHOTS}/orders-split-desktop.png`, animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.waitFor();
    // The shell animates its sidebar/main padding when crossing the breakpoint.
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1 &&
      document.querySelector("[data-order-detail-panel]")?.getBoundingClientRect().width >= 340);
    assert.equal(await separator.isVisible(), false);
    if (process.env.PHUB_LAYOUT_SCREENSHOTS) await page.screenshot({ path: `${process.env.PHUB_LAYOUT_SCREENSHOTS}/orders-split-mobile.png`, animations: "disabled" });
    const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 2)
        .slice(0, 12).map(el => [el.tagName, el.className, el.getBoundingClientRect().width]) }));
    assert.ok(overflow.scroll <= overflow.width + 1, `mobile must not overflow: ${JSON.stringify(overflow)}`);
    assert.ok((await panel.boundingBox()).width >= 340, "mobile detail must fill the available screen");

    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`${base}/data/orders?key=${encodeURIComponent(JSON.stringify([second.ma_donhang]))}`);
    await page.getByRole("region", { name: second.ma_donhang, exact: true }).getByText("Đơn thứ hai", { exact: true }).waitFor();
    await firstButton.click();
    await panel.waitFor();
    await page.waitForURL(url => !url.searchParams.has("key"));

    empty = true;
    await page.reload();
    await page.getByRole("region", { name: "Chưa có đơn hàng", exact: true }).waitFor();
    assert.equal(await separator.isVisible(), true, "the panel remains present for an empty list");
    assert.deepEqual(errors, []);
    console.log("PASS: right detail with invoice first, column table, first-row selection, resize, cache/polling, deep links, empty list and mobile layout.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
