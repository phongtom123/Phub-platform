/** Browser smoke: real Next pages, mocked HTTP only. Never contacts live Supabase. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const browserErrors = [];
    page.on("pageerror", error => browserErrors.push(error.message));
    page.on("dialog", dialog => dialog.accept());
    let loggedIn = true;
    const records = [
      { ma_tk: "TK1", ten_tai_khoan: "Admin.One", email: "admin@example.test", ma_nhan_vien: "NV1", ma_kh: null, trang_thai: 1, role: "ADMIN", ho_ten: "Admin Test", ma_kho: null, owner_active: true, is_self: true },
      { ma_tk: "TK2", ten_tai_khoan: "warehouse", email: null, ma_nhan_vien: "NV2", ma_kh: null, trang_thai: 1, role: "THU_KHO", ho_ten: "Warehouse Test", ma_kho: 7, owner_active: true, is_self: false },
    ];
    const mutations = [];
    const accountNumbers = { ADMIN: 0, THU_KHO: 0, KHACH_HANG: 0 };
    await page.route("**/api/backend/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace("/api/backend/", "");
      const method = request.method();
      const body = request.postDataJSON();
      const respond = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      const actor = records[0];
      if (path === "auth/me") return loggedIn
        ? respond({ account_id: actor.ma_tk, username: actor.ten_tai_khoan, role: actor.role, name: actor.ho_ten })
        : respond({ detail: "Vui lòng đăng nhập." }, 401);
      if (path === "auth/login") { loggedIn = true; return respond({ username: actor.ten_tai_khoan, role: actor.role }); }
      if (path === "auth/logout") { loggedIn = false; return route.fulfill({ status: 204 }); }
      if (path === "data/warehouses") return respond({ data: [{ ma_kho: 7, ten_kho: "Kho test", trang_thai: 1 }, { ma_kho: -900003, ten_kho: "Kho mã âm", trang_thai: 1 }, { ma_kho: 8, ten_kho: "Kho ngừng hoạt động", trang_thai: 0 }], total: 3, page: 1, page_size: 100 });
      if (path === "admin/account-owners") throw new Error("New account form must not select an old owner");
      if (path === "admin/accounts" && method === "GET") {
        let data = records.filter(row => !url.searchParams.get("role") || row.role === url.searchParams.get("role"));
        if (url.searchParams.has("status")) data = data.filter(row => row.trang_thai === Number(url.searchParams.get("status")));
        if (url.searchParams.get("q")) data = data.filter(row => (row.ma_tk + row.ten_tai_khoan).includes(url.searchParams.get("q")));
        return respond({ data, total: data.length, page: 1, page_size: 20 });
      }
      if (path === "admin/accounts" && method === "POST") {
        mutations.push({ path, method, body });
        assert(body.new_owner, "Create must include a new person, not an old owner ID");
        assert.equal("ma_nhan_vien" in body, false);
        assert.equal("ma_kh" in body, false);
        assert.equal("ma_tk" in body, false, "Account code must be assigned by the backend");
        const customer = body.new_owner.role === "KHACH_HANG";
        const prefix = { ADMIN: "AD", THU_KHO: "KHO", KHACH_HANG: "KH" }[body.new_owner.role];
        const id = prefix + String(++accountNumbers[body.new_owner.role]).padStart(6, "0");
        const row = { ...actor, ...body, ma_tk: id, ho_ten: body.new_owner.ho_ten, role: body.new_owner.role,
          ma_kho: body.new_owner.ma_kho, ma_nhan_vien: customer ? null : "NV_" + id,
          ma_kh: customer ? "KH_" + id : null, is_self: false, trang_thai: 1 };
        delete row.password;
        delete row.new_owner;
        records.push(row);
        return respond(row, 201);
      }
      const parts = path.split("/");
      const row = parts[1] === "me" ? actor : records.find(row => row.ma_tk === parts[2]);
      if (parts[0] === "admin" && row) {
        if (method === "GET") return respond(row);
        mutations.push({ path, method, body });
        if (parts.at(-1) === "password") {
          if (parts[1] === "me") loggedIn = false;
        } else {
          Object.assign(row, body);
        }
        return respond(row);
      }
      throw new Error("Unexpected mock request: " + method + " " + path);
    });

    const area = page.locator(".accounts-page");
    await page.goto(base + "/accounts");
    await area.getByRole("link", { name: "TK2", exact: true }).waitFor();
    assert.equal(await area.locator("tbody tr").count(), 2);
    await area.getByLabel("Vai trò", { exact: true }).selectOption("THU_KHO");
    await area.getByRole("link", { name: "TK2", exact: true }).waitFor();
    assert.equal(await area.locator("tbody tr").count(), 1);
    await area.getByLabel("Vai trò", { exact: true }).selectOption("");
    await area.getByRole("link", { name: "+ Thêm tài khoản", exact: true }).click();
    await page.waitForURL("**/accounts/new");
    assert.equal(await area.getByLabel(/^Mã tài khoản/).count(), 0);
    await area.getByLabel(/^Tên đăng nhập/).fill("new.user");
    await area.getByLabel(/^Email/).fill("new@example.test");
    assert.equal(await area.getByRole("button", { name: "Tìm hồ sơ" }).count(), 0);
    assert.equal(await area.getByLabel(/^Chủ tài khoản/).count(), 0);
    await area.getByLabel(/^Họ tên/).fill("New Admin");
    await area.getByLabel(/^Loại tài khoản/).selectOption("ADMIN");
    await area.getByLabel(/^Mật khẩu \*/).fill("test-new-password");
    await area.getByLabel(/^Nhập lại mật khẩu/).fill("test-new-password");
    await area.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    await page.waitForURL("**/accounts/AD000001");
    await area.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    await page.waitForURL("**/accounts/AD000001/edit");
    await area.getByLabel(/^Tên đăng nhập/).fill("updated.user");
    await area.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await page.waitForURL("**/accounts/AD000001");
    await area.locator(".live-field").filter({ hasText: "Tên đăng nhập" }).filter({ hasText: "updated.user" }).waitFor();
    await area.getByRole("button", { name: "Tạm khóa", exact: true }).click();
    await area.getByRole("button", { name: "Mở khóa / hiện lại", exact: true }).waitFor();
    await area.getByRole("button", { name: "Mở khóa / hiện lại", exact: true }).click();
    await area.getByRole("button", { name: "Tạm khóa", exact: true }).waitFor();
    await area.getByRole("button", { name: "Ẩn tài khoản", exact: true }).click();
    await area.getByRole("button", { name: "Mở khóa / hiện lại", exact: true }).waitFor();
    await area.getByRole("button", { name: "Mở khóa / hiện lại", exact: true }).click();
    await area.getByRole("button", { name: "Ẩn tài khoản", exact: true }).waitFor();
    await area.getByLabel(/^Vai trò/).selectOption("THU_KHO");
    await area.getByLabel(/^Kho phụ trách/).selectOption("7");
    await area.getByRole("button", { name: "Lưu phân quyền", exact: true }).click();
    await area.getByRole("status").waitFor();
    await area.getByLabel(/^Mật khẩu mới/).fill("test-reset-password");
    await area.getByLabel(/^Nhập lại mật khẩu/).fill("test-reset-password");
    await area.getByRole("button", { name: "Cấp lại mật khẩu", exact: true }).click();
    await area.getByText("Đã cấp lại mật khẩu. Các phiên cũ không còn hợp lệ.").waitFor();

    for (const [id, role] of [["KH000001", "KHACH_HANG"], ["KHO000001", "THU_KHO"]]) {
      await page.goto(base + "/accounts/new");
      assert.equal(await area.getByLabel(/^Mã tài khoản/).count(), 0);
      await area.getByLabel(/^Tên đăng nhập/).fill("user." + role.toLowerCase());
      await area.getByLabel(/^Họ tên/).fill("New " + role);
      await area.getByLabel(/^Loại tài khoản/).selectOption(role);
      if (role === "THU_KHO") {
        const select = area.getByLabel(/^Kho phụ trách/);
        await select.selectOption("-900003");
        assert.equal(await select.locator('option[value="8"]').count(), 0);
      } else assert.equal(await area.getByLabel(/^Kho phụ trách/).count(), 0);
      await area.getByLabel(/^Mật khẩu \*/).fill("test-new-password");
      await area.getByLabel(/^Nhập lại mật khẩu/).fill("test-new-password");
      await area.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
      await page.waitForURL("**/accounts/" + id);
      const created = records.find(row => row.ma_tk === id);
      assert.equal(created.role, role);
      assert.equal(created.ma_kho, role === "THU_KHO" ? -900003 : null);
    }

    await page.locator("button.user").click();
    await page.getByRole("button", { name: /Tài khoản của tôi/ }).click();
    await page.waitForURL("**/account");
    await area.getByLabel(/^Tên đăng nhập/).fill("Profile.Admin");
    await area.getByRole("button", { name: "Lưu thông tin", exact: true }).click();
    await area.getByText("Đã lưu thông tin đăng nhập.").waitFor();
    await area.getByLabel(/^Mật khẩu hiện tại/).fill("test-old-password");
    await area.getByLabel(/^Mật khẩu mới/).fill("test-profile-password");
    await area.getByLabel(/^Nhập lại mật khẩu mới/).fill("test-profile-password");
    await area.getByRole("button", { name: "Đổi mật khẩu", exact: true }).click();
    await page.waitForURL("**/?passwordChanged=1");
    await page.getByText("Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.").waitFor();

    // Reload a legacy detail URL: redirect and all breadcrumbs remain links.
    loggedIn = true;
    await page.goto(base + "/data/accounts?key=%5B%22TK2%22%5D&edit=1");
    await page.waitForURL("**/accounts/TK2/edit");
    await area.getByLabel(/^Tên đăng nhập/).waitFor();
    assert.equal(await area.locator("nav a").count(), 4);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".main")).paddingLeft === "0px");
    assert.equal(await area.getByRole("button", { name: "Lưu thay đổi", exact: true }).isVisible(), true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, "mobile page should not overflow horizontally");

    assert(mutations.some(call => call.method === "PUT" && call.path.endsWith("/role")));
    assert(mutations.some(call => call.path === "admin/me/password"));
    assert.equal(records.find(row => row.ma_tk === "AD000001").ten_tai_khoan, "updated.user");
    assert.deepEqual(browserErrors, []);
    console.log("PASS: create NEW admin/customer/warehouse person without owner picker; list/filter/detail/edit/status/role/reset/profile/password/logout/legacy/mobile");
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
