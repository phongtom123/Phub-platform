// Browser-only HTTP fixtures: no live accounts, orders, payments or DB writes.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3000";
const session = { account_id: "ACCOUNT-TEST", username: "customer.test", role: "KHACH_HANG", name: "Khách kiểm thử", customer_id: "CUSTOMER-TEST", employee_id: null, warehouse_id: null };
const initialProfile = { customer_id: session.customer_id, name: session.name, phone: "0901234567", address_line: "123 Đường thử nghiệm", province: "TP Hồ Chí Minh", ward: "Phường thử nghiệm" };
const firstOrder = { id: "ORDER-TEST-1", status: "XAC_NHAN", created_at: "2026-10-14T01:00:00Z", currency: "VND", total: "1000000.00" };
const secondOrder = { ...firstOrder, id: "ORDER-TEST-2", status: "HUY" };
const lines = [{ sku: "SKU-TEST", warehouse_id: 1, name: "Sản phẩm kiểm thử", unit: "Chiếc", quantity: 1, unit_price: "1200000.00", discount: "200000.00", tax_amount: "0.00", line_total: "1000000.00" }];
const transaction = { type: "refund", method: "bank_transfer", amount: "200000.00", status: "pending", occurred_at: "2026-10-14T02:00:00Z", message: "Hoàn tiền đang chờ xác nhận." };
const pagination = (page, total = 11) => ({ page, page_size: 10, total, total_pages: Math.ceil(total / 10) });

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1638, height: 1000 } });
    const errors = [];
    const requests = [];
    page.on("pageerror", error => errors.push(error.message));
    let mode = "ready", profile = { ...initialProfile }, saves = 0, loggedOut = false;
    await page.route("**/api/**", async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      requests.push({ method: request.method(), path, search: url.search });
      const ok = body => route.fulfill({ json: body });
      const fail = (status, message) => route.fulfill({ status, json: { error: { message } } });
      if (path === "/api/backend/auth/me") {
        if (mode === "guest" || loggedOut) return route.fulfill({ status: 401, json: { detail: "Cần đăng nhập." } });
        return ok({ ...session, role: mode === "admin" ? "ADMIN" : session.role });
      }
      if (path === "/api/backend/auth/logout") { loggedOut = true; return ok({ message: "OK" }); }
      if (path.includes("/api/catalog/")) return ok({ items: [] });
      if (mode === "expired") return fail(401, "Expired");
      if (mode === "forbidden") return fail(403, "Forbidden");
      if (path === "/api/backend/customer/me") {
        if (request.method() === "PUT") {
          saves++;
          const body = request.postDataJSON();
          assert.deepEqual(Object.keys(body).sort(), ["name", "phone", "address_line", "province", "ward"].sort());
          if (mode === "invalid-save") return fail(422, "Số điện thoại chưa hợp lệ.");
          profile = { ...profile, ...body }; return ok(profile);
        }
        if (mode === "profile-error") return fail(503, "Không tải được hồ sơ thử nghiệm.");
        if (mode === "malformed") return ok({ name: "Bad response" });
        return ok(profile);
      }
      if (path === "/api/backend/customer/orders") {
        if (mode === "orders-error") return fail(503, "Không tải được đơn thử nghiệm.");
        const current = Number(url.searchParams.get("page"));
        return ok({ items: mode === "empty" ? [] : [current === 1 ? firstOrder : secondOrder], pagination: pagination(current, mode === "empty" ? 0 : 11) });
      }
      if (/\/customer\/orders\/[^/]+$/.test(path)) return ok({ ...(path.endsWith(secondOrder.id) ? secondOrder : firstOrder), recipient: initialProfile, note: "Gọi trước khi giao", items: lines });
      if (path.endsWith("/invoice")) {
        if (mode === "invoice-error") return fail(503, "Không tải được hóa đơn thử nghiệm.");
        return ok({ order_id: firstOrder.id, currency: "VND", invoice: mode === "no-invoice" ? null : { issued_at: firstOrder.created_at, subtotal: "1000000.00", discount_total: "200000.00", tax_total: "100000.00", total: "1100000.00" }, items: mode === "no-invoice" ? [] : lines });
      }
      if (path.endsWith("/payments")) return ok({ order_id: firstOrder.id, currency: "VND", latest_transaction: mode === "no-payment" ? null : transaction, message: "Tra cứu giao dịch mới nhất." });
      if (path.endsWith("/transactions")) {
        const current = Number(url.searchParams.get("page"));
        return ok({ order_id: firstOrder.id, currency: "VND", items: mode === "no-payment" ? [] : [{ ...transaction, type: current === 1 ? "refund" : "collection", status: current === 1 ? "pending" : "succeeded" }], pagination: pagination(current, mode === "no-payment" ? 0 : 11) });
      }
      throw new Error(`Unexpected API request: ${request.method()} ${path}`);
    });
    const nav = page.getByRole("navigation", { name: "Quản lý tài khoản" });
    async function open() { await page.goto(base + "/main/profile"); await page.getByRole("region", { name: "Contact Information", exact: true }).getByText(profile.name, { exact: true }).waitFor(); }
    await open();
    await page.getByRole("heading", { name: "My Dashboard", exact: true }).waitFor();
    assert.equal(await nav.getByRole("button").count(), 10);
    assert.equal(await nav.getByRole("button", { name: "Account Dashboard", exact: true }).getAttribute("aria-current"), "page");
    const info = page.getByRole("region", { name: "Account Information", exact: true });
    const address = page.getByRole("region", { name: "Address Book", exact: true });
    const navBox = await nav.boundingBox(), infoBox = await info.boundingBox();
    assert.ok(Math.abs(navBox.width - 327) < 1);
    assert.ok(Math.abs(infoBox.x - navBox.x - navBox.width - 80) < 1);
    assert.ok(Math.abs(infoBox.y - navBox.y) < 1, "Reference layout aligns sidebar and content tops");
    assert.ok((await address.boundingBox()).y > infoBox.y + infoBox.height);
    await page.getByRole("region", { name: "Compare Products", exact: true }).waitFor();
    await page.getByRole("region", { name: "My Wish List", exact: true }).waitFor();
    assert.equal(await page.getByText("Tổng đơn hàng", { exact: true }).count(), 0);
    assert.equal(requests.some(r => r.path === "/api/backend/customer/orders"), false, "Overview only loads profile; orders stay in My Orders");
    if (process.env.PHUB_ACCOUNT_DESKTOP_SCREENSHOT) await page.screenshot({ path: process.env.PHUB_ACCOUNT_DESKTOP_SCREENSHOT, fullPage: true });
    await page.getByRole("button", { name: "Change Password", exact: true }).click();
    await page.getByRole("status").getByText("Chưa có API đổi mật khẩu cho khách hàng.").waitFor();
    await nav.getByRole("button", { name: "Newsletter Subscriptions", exact: true }).click();
    await page.getByText("Chưa có API đăng ký bản tin; chưa thể xác định trạng thái đăng ký.", { exact: true }).waitFor();
    await nav.getByRole("button", { name: "Account Dashboard", exact: true }).click();
    assert.equal(requests.some(r => r.path.includes("/data/")), false);
    assert.equal(requests.some(r => r.path.endsWith("/invoice") || r.path.endsWith("/payments")), false, "No per-order fanout on dashboard load");
    await page.getByRole("button", { name: "Sửa thông tin nhận hàng" }).click();
    const dialog = page.getByRole("dialog", { name: "Thông tin nhận hàng" });
    await dialog.getByLabel("Họ và tên").fill("Khách đã cập nhật");
    await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
    assert.equal(saves, 0);
    await page.getByRole("button", { name: "Sửa thông tin nhận hàng" }).click();
    await dialog.getByLabel("Họ và tên").fill("Khách đã cập nhật");
    mode = "invalid-save";
    await dialog.getByRole("button", { name: "Lưu thông tin" }).click();
    await dialog.getByRole("alert").getByText("Số điện thoại chưa hợp lệ.").waitFor();
    mode = "ready";
    await dialog.getByRole("button", { name: "Lưu thông tin" }).click();
    await page.getByRole("status").getByText("Đã lưu thông tin nhận hàng vào hồ sơ.").waitFor();
    await open(); // Saved API response survives remount; not local-only state.
    await nav.getByRole("button", { name: "My Orders", exact: true }).click();
    await page.getByText("Tổng số đơn hàng: 11", { exact: true }).waitFor();
    await page.getByRole("article", { name: `Đơn ${firstOrder.id}` }).getByRole("button", { name: "Chi tiết đơn" }).click();
    await page.getByRole("region", { name: `Chi tiết đơn ${firstOrder.id}`, exact: true }).getByRole("cell", { name: /Sản phẩm kiểm thử/ }).waitFor();
    await page.getByRole("button", { name: "Hóa đơn", exact: true }).last().click();
    const invoice = page.getByRole("region", { name: `Hóa đơn của ${firstOrder.id}`, exact: true });
    await invoice.getByText(/1\.100\.000/).waitFor();
    mode = "no-invoice";
    await invoice.getByRole("button", { name: "Làm mới hóa đơn" }).click();
    await invoice.getByText("Đơn này chưa được lập hóa đơn.").waitFor();
    mode = "invoice-error";
    await invoice.getByRole("button", { name: "Làm mới hóa đơn" }).click();
    await invoice.getByRole("alert").waitFor();
    mode = "ready";
    await invoice.getByRole("button", { name: "Thử lại" }).click();
    await invoice.getByText(/1\.100\.000/).waitFor();
    await page.getByRole("button", { name: "Thanh toán", exact: true }).last().click();
    const payment = page.getByRole("region", { name: `Thanh toán của ${firstOrder.id}`, exact: true });
    await payment.getByText("Hoàn tiền", { exact: true }).waitFor();
    await payment.getByText("Chờ xử lý", { exact: true }).waitFor();
    const history = page.getByRole("region", { name: "Lịch sử thu / hoàn tiền", exact: true });
    await history.getByRole("button", { name: "Trang sau" }).click();
    await history.getByText("Thu tiền", { exact: true }).waitFor();
    await history.getByText("Thành công", { exact: true }).waitFor();
    mode = "no-payment";
    await payment.getByRole("button", { name: "Làm mới thanh toán" }).click();
    await payment.getByText("Chưa có giao dịch thanh toán.").waitFor();
    mode = "ready";
    await nav.getByRole("button", { name: "My Orders", exact: true }).click();
    await page.getByRole("button", { name: "Trang sau" }).click();
    await page.getByRole("article", { name: `Đơn ${secondOrder.id}` }).waitFor();
    await page.getByRole("button", { name: "Chi tiết đơn", exact: true }).click();
    await page.getByRole("region", { name: `Chi tiết đơn ${secondOrder.id}`, exact: true }).getByText("Đã hủy", { exact: true }).waitFor();

    await page.setViewportSize({ width: 390, height: 844 });
    await open();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.PHUB_ACCOUNT_SCREENSHOT) await page.screenshot({ path: process.env.PHUB_ACCOUNT_SCREENSHOT, fullPage: true });
    await nav.getByRole("button", { name: "My Orders", exact: true }).click();
    await page.getByRole("button", { name: "Chi tiết đơn", exact: true }).click();
    await page.getByRole("cell", { name: /Sản phẩm kiểm thử/ }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const testMode of ["profile-error", "orders-error", "malformed"]) {
      mode = testMode; await page.goto(base + "/main/profile");
      if (testMode === "orders-error") await nav.getByRole("button", { name: "My Orders", exact: true }).click();
      const panel = page.getByRole("region", { name: testMode === "orders-error" ? "My Orders" : "Contact Information", exact: true });
      await panel.getByRole("alert").waitFor();
      mode = "ready"; await panel.getByRole("button", { name: "Thử lại" }).click();
      await panel.getByText(testMode === "orders-error" ? firstOrder.id : profile.name, { exact: true }).waitFor();
    }
    mode = "empty"; await open();
    await nav.getByRole("button", { name: "My Orders", exact: true }).click();
    await page.getByText("Bạn chưa có đơn hàng nào.").waitFor();
    mode = "ready"; await open(); mode = "expired";
    await page.getByRole("button", { name: "Làm mới", exact: true }).click();
    await page.getByRole("region", { name: "Truy cập tài khoản" }).getByRole("alert").waitFor();
    assert.equal(await nav.count(), 0, "Expired session clears all private dashboard data");
    for (const testMode of ["guest", "admin", "forbidden"]) {
      mode = testMode; const before = requests.length; await page.goto(base + "/main/profile");
      await page.getByRole("region", { name: "Truy cập tài khoản" }).getByRole("alert").waitFor();
      assert.equal(await nav.count(), 0);
      if (testMode !== "forbidden") assert.equal(requests.slice(before).some(r => r.path.includes("/customer/")), false);
    }
    mode = "ready"; await open();
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.waitForURL("**/auth/login");
    assert.equal(loggedOut, true);
    assert.deepEqual(errors, []);
    console.log("PASS: profile save/cancel/errors, owned orders and pagination, detail/invoice/payment/history, empty/error/retry, expired/forbidden sessions, logout and mobile.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
