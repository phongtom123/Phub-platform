// Browser fixtures only. No real addresses, accounts, orders or database writes.
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3001";
const profile = { customer_id: "ADDRESS-TEST", name: "Chủ tài khoản", phone: "0901234567", address_line: "Địa chỉ hồ sơ", province: "TP Hồ Chí Minh", ward: "Phường 1" };
const initial = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Người nhận tại nhà", phone: "0901111111", address_line: "10 Đường nhà", province: "TP Hồ Chí Minh", ward: "Phường 1", is_default: true },
  { id: "00000000-0000-4000-8000-000000000002", name: "Người nhận tại công ty", phone: "0902222222", address_line: "20 Đường công ty", province: "Hà Nội", ward: "Phường 2", is_default: false },
];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined, args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], writes = [];
    let items = structuredClone(initial), mode = "ready", sequence = 2, release;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname;
      const ok = json => route.fulfill({ json });
      const fail = (status, message) => route.fulfill({ status, json: { error: { message } } });
      if (endpoint.endsWith("/auth/me")) return ok({ account_id: "ACCOUNT", username: "address.test", role: "KHACH_HANG", name: profile.name, customer_id: profile.customer_id, employee_id: null, warehouse_id: null });
      if (endpoint.endsWith("/customer/me")) return ok(profile);
      if (endpoint.startsWith("/api/catalog/")) return ok({ items: [] });
      if (endpoint.startsWith("/api/customer/addresses")) {
        if (mode === "expired") return fail(401, "Phiên đăng nhập đã hết hạn.");
        if (request.method() === "GET") {
          if (mode === "load-error") return fail(503, "Không tải được sổ địa chỉ thử nghiệm.");
          return ok({ items, item: null });
        }
        writes.push({ method: request.method(), endpoint });
        if (mode === "save-error") return fail(422, "Địa chỉ chưa hợp lệ theo API.");
        if (mode === "delay") await new Promise(resolve => { release = resolve; });
        let item = null;
        if (endpoint.endsWith("/delete")) {
          const id = endpoint.split("/").at(-2);
          items = items.filter(address => address.id !== id);
          if (items.length && !items.some(address => address.is_default)) items[0].is_default = true;
        } else {
          const input = request.postDataJSON();
          assert.deepEqual(Object.keys(input).sort(), ["name", "phone", "address_line", "province", "ward", "is_default"].sort());
          assert.ok(!("customer_id" in input));
          if (input.is_default) items.forEach(address => { address.is_default = false; });
          if (request.method() === "POST") {
            item = { id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`, ...input, is_default: !items.length || input.is_default };
            items.push(item);
          } else {
            const id = endpoint.split("/").at(-1);
            item = { id, ...input }; items = items.map(address => address.id === id ? item : address);
          }
        }
        return ok({ items, item });
      }
      throw new Error(`Unexpected API: ${request.method()} ${endpoint}`);
    });
    const nav = page.getByRole("navigation", { name: "Quản lý tài khoản" });
    const panel = page.getByRole("region", { name: "Địa chỉ giao hàng", exact: true });
    const card = name => panel.getByRole("article", { name: `Địa chỉ của ${name}`, exact: true });
    const fits = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    async function open() {
      await page.goto(base + "/main/profile", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Tài khoản của tôi", exact: true }).waitFor();
      await nav.getByRole("button", { name: "Địa chỉ giao hàng", exact: true }).click();
    }
    await page.goto(base + "/main/profile");
    await panel.getByText(initial[0].name, { exact: true }).waitFor();
    await panel.getByText(initial[0].phone, { exact: true }).waitFor();
    await panel.getByRole("button", { name: "Quản lý địa chỉ", exact: true }).click();
    await card(initial[1].name).waitFor();
    assert.equal(await panel.getByRole("article").count(), 2);
    assert.equal(await panel.getByText("Địa chỉ mặc định", { exact: true }).count(), 1);
    await page.screenshot({ path: path.join(os.tmpdir(), "phub-addresses-desktop.png"), fullPage: true });
    await panel.getByRole("button", { name: "+ Thêm địa chỉ", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Thêm địa chỉ giao hàng", exact: true });
    await form.getByLabel("Tên người nhận").fill("Người nhận mới");
    await form.getByRole("button", { name: "Hủy", exact: true }).click();
    assert.equal(writes.length, 0);
    await panel.getByRole("button", { name: "+ Thêm địa chỉ", exact: true }).click();
    await form.getByLabel("Tên người nhận").fill("Người nhận mới");
    await form.getByLabel("Số điện thoại").fill("invalid");
    await form.getByLabel("Địa chỉ chi tiết").fill("30 Đường mới");
    await form.getByLabel("Tỉnh / thành phố").fill("Đà Nẵng");
    await form.getByLabel("Phường / xã").fill("Phường 3");
    await form.getByRole("button", { name: "Lưu địa chỉ", exact: true }).click();
    await form.getByRole("alert").getByText("Số điện thoại phải gồm 8–15 chữ số.", { exact: true }).waitFor();
    assert.equal(writes.length, 0);
    await form.getByLabel("Số điện thoại").fill("090 333 3333");
    mode = "save-error";
    await form.getByRole("button", { name: "Lưu địa chỉ", exact: true }).click();
    await form.getByRole("alert").getByText("Địa chỉ chưa hợp lệ theo API.", { exact: true }).waitFor();
    assert.equal(items.length, 2);
    mode = "delay";
    await form.getByRole("button", { name: "Lưu địa chỉ", exact: true }).click();
    await form.getByRole("button", { name: "Đang lưu…", exact: true }).waitFor();
    assert.ok(await form.getByRole("button", { name: "Hủy", exact: true }).isDisabled());
    while (!release) await new Promise(resolve => setTimeout(resolve, 20));
    release(); mode = "ready";
    await card("Người nhận mới").getByText("0903333333", { exact: true }).waitFor();
    assert.equal(await panel.getByRole("article").count(), 3);
    await card("Người nhận mới").getByRole("button", { name: "Đặt làm mặc định", exact: true }).click();
    await card("Người nhận mới").getByText("Địa chỉ mặc định", { exact: true }).waitFor();
    assert.equal(await panel.getByText("Địa chỉ mặc định", { exact: true }).count(), 1);
    await card("Người nhận mới").getByRole("button", { name: "Sửa địa chỉ của Người nhận mới", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "Chỉnh sửa địa chỉ", exact: true });
    assert.ok(await edit.getByRole("checkbox", { name: "Đặt làm địa chỉ mặc định" }).isDisabled());
    await edit.getByLabel("Địa chỉ chi tiết").fill("31 Đường đã sửa");
    await edit.getByRole("button", { name: "Lưu địa chỉ", exact: true }).click();
    await card("Người nhận mới").getByText(/31 Đường đã sửa/).waitFor();
    await open(); await card("Người nhận mới").getByText(/31 Đường đã sửa/).waitFor();
    await page.setViewportSize({ width: 390, height: 844 }); await fits();
    await page.screenshot({ path: path.join(os.tmpdir(), "phub-addresses-mobile.png"), fullPage: true });
    await card("Người nhận mới").getByRole("button", { name: "Xóa địa chỉ của Người nhận mới", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Xóa địa chỉ giao hàng", exact: true });
    await confirm.getByText(/Một địa chỉ còn lại sẽ được chọn làm mặc định/).waitFor();
    await confirm.getByRole("button", { name: "Hủy", exact: true }).click();
    assert.equal(items.length, 3);
    await card("Người nhận mới").getByRole("button", { name: "Xóa địa chỉ của Người nhận mới", exact: true }).click();
    await confirm.getByRole("button", { name: "Xác nhận xóa", exact: true }).click();
    await card(initial[0].name).getByText("Địa chỉ mặc định", { exact: true }).waitFor();
    assert.equal(items.length, 2);
    mode = "load-error"; await open();
    await panel.getByRole("alert").getByText("Không tải được sổ địa chỉ thử nghiệm.", { exact: true }).waitFor();
    mode = "ready"; await panel.getByRole("button", { name: "Thử lại", exact: true }).click();
    await card(initial[0].name).waitFor();
    items = Array.from({ length: 10 }, (_, index) => ({ ...initial[0], id: String(index), name: `Người nhận ${index}`, is_default: index === 0 }));
    await open(); await card("Người nhận 9").waitFor();
    assert.ok(await panel.getByRole("button", { name: "+ Thêm địa chỉ", exact: true }).isDisabled());
    items = []; await open();
    await panel.getByText("Bạn chưa có địa chỉ giao hàng.", { exact: true }).waitFor();
    await panel.getByRole("button", { name: "+ Thêm địa chỉ", exact: true }).click();
    assert.ok(await form.getByRole("checkbox", { name: "Đặt làm địa chỉ mặc định" }).isChecked());
    assert.ok(await form.getByRole("checkbox", { name: "Đặt làm địa chỉ mặc định" }).isDisabled());
    await fits();
    await form.getByRole("button", { name: "Hủy", exact: true }).click();
    mode = "expired"; await page.goto(base + "/main/profile", { waitUntil: "domcontentloaded" });
    await page.getByRole("region", { name: "Truy cập tài khoản" }).getByRole("alert").waitFor();
    assert.equal(await nav.count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: address list, correct default recipient, create/edit/default/delete, validation and retry, pending actions, persistence, empty/limit/access states and mobile layout");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
