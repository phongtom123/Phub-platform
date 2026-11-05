/** Browser integration using mocked HTTP only. Never forwards API requests to live services. */
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const detailURL = base + '/data/customers?key=%5B%22KH1%22%5D';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], patches = [], orderPages = [], statusWrites = [];
    let reads = 0, listReads = 0, failSave = false, failStatus = false, acceptStatus = true;
    const data = {
      profile: { ma_kh: "KH1", ten_kh: "Khách kiểm thử", sdt: "09001", ngay_sinh: null, ngay_tao: null,
        cap_nhat_luc: null, luu_tru_luc: null, dia_chi_chi_tiet_md: null, tinh_thanh_md: null, xa_phuong_md: null },
      account: { ma_tk: "CUSTOMER-TK1", ten_tai_khoan: "customer.test", email: "customer@example.test", trang_thai: 1 },
    };
    const admin = { ma_tk: "TK1", ten_tai_khoan: "admin.test", email: null, ma_nhan_vien: "NV1", ma_kh: null,
      trang_thai: 1, role: "ADMIN", ho_ten: "Admin Test", ma_kho: null, owner_active: true, is_self: true };
    page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", dialog => acceptStatus ? dialog.accept() : dialog.dismiss());
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname === "/api/backend/admin/accounts/CUSTOMER-TK1/status") {
        assert.equal(request.method(), "POST");
        statusWrites.push(request.postDataJSON());
        if (failStatus) return respond({ detail: "Không thể đổi trạng thái kiểm thử." }, 503);
        data.account.trang_thai = request.postDataJSON().trang_thai;
        return respond({ ...data.account, ma_kh: "KH1", role: "KHACH_HANG" });
      }
      if (url.pathname === "/api/backend/crm/customers/KH1") {
        if (request.method() === "GET") { reads++; return respond(data); }
        assert.equal(request.method(), "PATCH");
        patches.push(request.postDataJSON());
        if (failSave) return respond({ detail: "Chưa có hàm lưu CRM. Cần áp dụng migration bổ sung." }, 503);
        Object.assign(data.profile, request.postDataJSON());
        data.profile.cap_nhat_luc = "2026-10-22T10:00:00Z";
        return respond(data);
      }
      if (url.pathname === "/api/backend/crm/customers/KH1/orders") {
        assert.equal(request.method(), "GET");
        const number = Number(url.searchParams.get("page")); orderPages.push(number);
        return respond({ data: [{ ma_donhang: number === 1 ? "DH1" : "DH11", trang_thai: "HOAN_THANH", kenh_ban: "ONLINE", thoi_gian_dat: "2026-10-20T09:00:00" }], total: 11, page: number, page_size: 10 });
      }
      assert.equal(request.method(), "GET", "Unexpected write must never reach a live API");
      if (url.pathname.endsWith("/auth/me")) return respond({ account_id: "TK1", username: "admin.test", role: "ADMIN", name: "Admin Test" });
      if (url.pathname === "/api/backend/admin/accounts/TK1" || url.pathname === "/api/backend/admin/me") return respond(admin);
      if (url.pathname === "/api/backend/admin/accounts") return respond({ data: [admin], total: 1, page: 1, page_size: 20 });
      if (url.pathname === "/api/backend/data/resources") return respond([{ name: "customers", title: "Khách hàng", keys: ["ma_kh"], writable: true,
        columns: [{ name: "ma_kh", type: "varchar", required: true, generated: true }, { name: "ten_kh", type: "varchar", required: true }] }]);
      if (url.pathname === "/api/backend/data/customers") {
        listReads++;
        return respond({ data: [{ ma_kh: "KH1", ten_kh: data.profile.ten_kh }, { ma_kh: "KH2", ten_kh: "Khách chưa có tài khoản" }],
          customer_accounts: { KH1: { ma_tk: data.account.ma_tk, trang_thai: data.account.trang_thai }, KH2: null }, total: 2, page: 1, page_size: 20 });
      }
      if (url.pathname.startsWith("/api/backend/data/")) return respond({ data: [], total: 0, page: 1, page_size: 20 });
      throw new Error("Unexpected API: " + url.pathname);
    });
    await page.goto(detailURL);
    await page.getByRole("heading", { name: "Thông tin khách hàng" }).waitFor();
    assert.equal(await page.locator(".live-field").filter({ hasText: "customer@example.test" }).count(), 1);
    assert.ok(await page.getByText("Chưa có thông tin").count() > 0);
    assert.equal(orderPages.length, 0, "Orders are lazy-loaded");
    assert.equal(await page.locator('a[href="/accounts/CUSTOMER-TK1"]').count(), 1);
    const status = page.getByLabel("Trạng thái tài khoản khách hàng", { exact: true });
    const beforeStatus = reads;
    await page.evaluate(() => window.__crmDocumentMarker = "same-document");
    await status.selectOption("2");
    await page.getByText("Đã cập nhật trạng thái tài khoản khách hàng: Tạm khóa.", { exact: true }).waitFor();
    assert.equal(await status.inputValue(), "2");
    assert.equal(reads, beforeStatus, "Status updates in place without a CRM refetch");
    acceptStatus = false;
    await status.selectOption("0");
    assert.equal(await status.inputValue(), "2");
    assert.equal(statusWrites.length, 1, "Cancel confirmation does not write");
    acceptStatus = true; failStatus = true;
    await status.selectOption("0");
    await page.getByRole("alert").filter({ hasText: "Không thể đổi trạng thái kiểm thử." }).waitFor();
    assert.equal(await status.inputValue(), "2", "Failed API does not change displayed status");
    assert.equal(await page.getByText("Đã cập nhật trạng thái tài khoản khách hàng: Tạm khóa.", { exact: true }).count(), 0);
    failStatus = false;
    await status.selectOption("1");
    await page.getByText("Đã cập nhật trạng thái tài khoản khách hàng: Hoạt động.", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__crmDocumentMarker), "same-document");
    assert.deepEqual(statusWrites, [{ trang_thai: 2 }, { trang_thai: 0 }, { trang_thai: 1 }]);
    const back = await page.getByRole("button", { name: "← Quay lại", exact: true }).boundingBox();
    const edit = await page.getByRole("link", { name: "Chỉnh sửa", exact: true }).boundingBox();
    assert.ok(edit.x > back.x && Math.abs(edit.y - back.y) < 1);
    await page.evaluate(() => window.__crmDocumentMarker = "same-document");
    await page.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    await page.getByLabel("Ngày sinh", { exact: true }).fill("2000-02-29");
    await status.selectOption("2");
    await page.getByText("Đã cập nhật trạng thái tài khoản khách hàng: Tạm khóa.", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("Ngày sinh", { exact: true }).inputValue(), "2000-02-29", "Saving status preserves the profile draft");
    assert.equal(patches.length, 0, "Status changes do not submit the profile form");
    assert.equal(await page.getByText("Sở thích", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("checkbox").count(), 0);
    const beforeSave = reads;
    await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
    await page.getByText("Đã lưu hồ sơ khách hàng.", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "Thông tin khách hàng" }).waitFor();
    assert.deepEqual(patches[0], { ngay_sinh: "2000-02-29" });
    assert.equal(await page.evaluate(() => window.__crmDocumentMarker), "same-document");
    await page.waitForTimeout(250);
    assert.equal(reads, beforeSave, "Save uses its committed snapshot without a full profile refetch");
    await page.getByRole("button", { name: "Xem đơn hàng", exact: true }).click();
    await page.getByRole("link", { name: "DH1", exact: true }).waitFor();
    await page.getByRole("button", { name: "Sau", exact: true }).click();
    await page.getByRole("link", { name: "DH11", exact: true }).waitFor();
    assert.deepEqual(orderPages, [1, 2]);

    await page.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    await page.getByLabel("Số điện thoại", { exact: true }).fill("09002");
    failSave = true;
    await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Chưa có hàm lưu CRM" }).waitFor();
    assert.equal(await page.getByLabel("Số điện thoại", { exact: true }).inputValue(), "09002");
    failSave = false;
    await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
    await page.getByRole("heading", { name: "Thông tin khách hàng" }).waitFor();
    assert.equal(await page.locator(".live-field").filter({ hasText: "09002" }).count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".main")).paddingLeft === "0px" &&
      document.querySelector(".sidebar").getBoundingClientRect().right <= 1);
    await page.screenshot({ path: path.join(os.tmpdir(), "phub-customer-profile-mobile.png"), fullPage: true, animations: "disabled" });
    const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth,
      profileWidth: document.querySelector(".customer-detail").getBoundingClientRect().width,
      mainPadding: getComputedStyle(document.querySelector(".main")).paddingLeft,
      sidebarTransform: getComputedStyle(document.querySelector(".sidebar")).transform,
      elements: [...document.querySelectorAll(".customer-detail, .customer-detail *")].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(e => ({ tag: e.tagName, class: e.className, width: e.getBoundingClientRect().width })) }));
    assert.ok(overflow.width <= overflow.viewport + 1, JSON.stringify(overflow));
    assert.ok(overflow.profileWidth >= 300, JSON.stringify(overflow));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(os.tmpdir(), "phub-customer-profile-desktop.png"), fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "← Quay lại", exact: true }).click();
    await page.getByRole("columnheader", { name: "Trạng thái tài khoản", exact: true }).waitFor();
    const listStatus = page.getByLabel("Trạng thái tài khoản KH1", { exact: true });
    assert.equal(await listStatus.inputValue(), "2");
    await page.getByText("Chưa có tài khoản", { exact: true }).waitFor();
    const beforeListStatus = listReads;
    await listStatus.selectOption("1");
    await page.getByText("Đã lưu: Hoạt động.", { exact: true }).waitFor();
    assert.equal(await listStatus.inputValue(), "1");
    assert.equal(listReads, beforeListStatus, "List status updates without a list refetch");
    acceptStatus = false;
    const beforeCancel = statusWrites.length;
    await listStatus.selectOption("0");
    assert.equal(statusWrites.length, beforeCancel);
    assert.equal(await listStatus.inputValue(), "1");
    acceptStatus = true; failStatus = true;
    await listStatus.selectOption("2");
    await page.getByRole("alert").filter({ hasText: "Không thể đổi trạng thái kiểm thử." }).waitFor();
    assert.equal(await listStatus.inputValue(), "1");
    assert.equal(await page.getByText("Đã lưu: Hoạt động.", { exact: true }).count(), 0);
    failStatus = false;
    await page.getByRole("cell", { name: data.profile.ten_kh, exact: true }).dblclick();
    assert.equal(await listStatus.isDisabled(), true, "Status is disabled while editing a profile row");
    await page.getByRole("textbox", { name: "Tên khách hàng KH1", exact: true }).press("Escape");
    assert.equal(await listStatus.isEnabled(), true);
    assert.equal(await page.evaluate(() => window.__crmDocumentMarker), "same-document");
    assert.deepEqual(errors, []);
    console.log("PASS: customer status in detail, edit form and list; draft preservation, cancel/error rollback, lazy orders and mobile. Mocked HTTP only.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
