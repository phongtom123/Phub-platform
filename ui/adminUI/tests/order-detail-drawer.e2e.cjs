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
  lines: [], invoice: null, payments: [], voucher_uses: [], history: [],
  financial: { invoice_id: null, invoice_status: "CHUA_LAP", payment_status: "CHUA_CO_HOA_DON", total: null, collected: "0.00", refunded: "0.00", paid: "0.00", remaining: null },
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname.endsWith("/auth/me")) return respond({ account_id: "NV-1", username: "staff", name: "Nhân viên", role: "NHAN_VIEN", warehouse_id: 1 });
      if (url.pathname.endsWith("/data/resources")) return respond(resources);
      if (url.pathname === `/api/backend/admin/orders/${orderId}/detail`) return respond(detail);
      if (url.pathname.endsWith("/data/orders")) return respond({ data: [order], total: 1, page: 1, page_size: 20, filters: {} });
      if (url.pathname.endsWith("/data/customers")) return respond({ data: [{ ma_kh: "KH-1", ten_kh: "Nguyễn Khách Hàng" }], total: 1, page: 1, page_size: 20 });
      if (url.pathname.endsWith("/data/employees")) return respond({ data: [{ ma_nhan_vien: "NV-1", ho_ten: "Trần Nhân Viên" }], total: 1, page: 1, page_size: 20 });
      assert.fail(`Unexpected API: ${request.method()} ${url.pathname}`);
    });

    await page.goto(`${base}/data/orders`);
    const trigger = page.getByRole("button", { name: orderId, exact: true });
    await trigger.waitFor();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: orderId });
    await dialog.waitFor();
    await dialog.getByText("Chi tiết đơn hàng", { exact: true }).waitFor();
    await page.locator("nextjs-portal").evaluateAll(elements => elements.forEach(element => element.remove()));
    assert.equal(new URL(page.url()).searchParams.has("key"), false, "opening a row must not navigate to a detail page");
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    const visual = await dialog.evaluate(element => ({
      drawerAnimation: getComputedStyle(element).animationName,
      backdropFilter: getComputedStyle(element.parentElement).backdropFilter,
    }));
    assert.notEqual(visual.drawerAnimation, "none");
    assert.match(visual.backdropFilter, /blur/);

    await dialog.getByRole("button", { name: "Đóng chi tiết đơn hàng" }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);

    await page.getByRole("button", { name: "Chi tiết", exact: true }).click();
    await dialog.waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });

    await trigger.click();
    await dialog.waitFor();
    await dialog.locator("xpath=..").click({ position: { x: 20, y: 200 } });
    await dialog.waitFor({ state: "detached" });

    await page.goto(`${base}/data/orders?key=${encodeURIComponent(JSON.stringify([orderId]))}`);
    const legacyDialog = page.getByRole("dialog", { name: orderId });
    await legacyDialog.waitFor();
    await page.locator("nextjs-portal").evaluateAll(elements => elements.forEach(element => element.remove()));
    assert.equal(await page.locator("tbody tr").count(), 1, "legacy detail links keep the order list behind the drawer");
    await legacyDialog.getByRole("button", { name: "Đóng chi tiết đơn hàng" }).click();
    await page.waitForURL(url => !url.searchParams.has("key"));
    assert.deepEqual(errors, []);
    console.log("PASS: order detail opens as an animated right drawer and closes by X, Escape, or backdrop.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
