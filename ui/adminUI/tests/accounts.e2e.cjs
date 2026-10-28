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
    let selfDetailId = null;
    const records = [
      { ma_tk: "TK1", ten_tai_khoan: "Admin.One", email: "admin@example.test", ma_nhan_vien: "NV1", ma_kh: null, trang_thai: 1, role: "ADMIN", ho_ten: "Admin Test", ma_kho: null, owner_active: true, is_self: true },
      { ma_tk: "TK2", ten_tai_khoan: "warehouse", email: null, ma_nhan_vien: "NV2", ma_kh: null, trang_thai: 1, role: "NHAN_VIEN", ho_ten: "Warehouse Test", ma_kho: 7, owner_active: true, is_self: false },
    ];
    const mutations = [];
    const accountNumbers = { ADMIN: 0, NHAN_VIEN: 0, KHACH_HANG: 0 };
    await page.route("**/api/backend/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace("/api/backend/", "");
      const method = request.method();
      const body = request.postDataJSON();
      const respond = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      const actor = records[0];
      if (path === "data/resources") return respond([]); // This fixture exercises account APIs only.
      if (path === "auth/me") return loggedIn
        ? respond({ account_id: actor.ma_tk, username: actor.ten_tai_khoan, role: actor.role, name: actor.ho_ten })
        : respond({ detail: "Vui lòng đăng nhập." }, 401);
      if (path === "auth/login") { loggedIn = true; return respond({ account_id: actor.ma_tk, username: actor.ten_tai_khoan, role: actor.role, name: actor.ho_ten }); }
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
        const prefix = { ADMIN: "AD", NHAN_VIEN: "KHO", KHACH_HANG: "KH" }[body.new_owner.role];
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
        if (method === "GET") return respond(row.ma_tk === selfDetailId ? { ...row, role: "ADMIN", ma_kho: null, is_self: true } : row);
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
    async function assertBreadcrumb(labels) {
      const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
      assert.equal(await breadcrumb.count(), 1, "Only one breadcrumb must exist");
      assert.equal(await area.getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 0);
      assert.equal(await page.locator(".topbar").getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 1);
      assert.deepEqual(await breadcrumb.locator("a").allTextContents(), labels);
      assert.equal(await breadcrumb.locator('a[aria-current="page"]').innerText(), labels.at(-1));
    }
    async function assertDetailActions() {
      const toolbar = area.locator(".live-page-actions");
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".live-page-actions")).display === "flex");
      await page.evaluate(() => document.fonts.ready);
      const edit = toolbar.getByRole("link", { name: "Chỉnh sửa", exact: true });
      const editBox = await edit.boundingBox();
      const toolbarBox = await toolbar.boundingBox();
      assert.ok(Math.abs(editBox.x + editBox.width - toolbarBox.x - toolbarBox.width) < 1, "Edit stays at the right edge: " + JSON.stringify({ editBox, toolbarBox }));
      for (const name of ["Tạm khóa", "Ẩn tài khoản"]) {
        const button = toolbar.getByRole("button", { name, exact: true });
        assert.equal(await button.count(), 1);
        const box = await button.boundingBox();
        assert.ok(Math.abs(box.y - editBox.y) < 1, "Status actions share the edit row on desktop");
      }
    }
    async function assertCards(columns) {
      const info = area.locator(".account-detail-card");
      const password = area.locator(".account-password-card");
      await info.waitFor(); await password.waitFor();
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".account-detail-card")).display === "grid");
      await page.evaluate(async () => {
        await new Promise(resolve => requestAnimationFrame(resolve));
        await Promise.all(document.querySelector(".main").getAnimations().map(animation => animation.finished.catch(() => {})));
        await document.fonts.ready;
      });
      for (const card of [info, password]) {
        const styles = await card.evaluate(node => {
          const css = getComputedStyle(node);
          return { columns: css.gridTemplateColumns.split(" ").length, background: css.backgroundColor, radius: css.borderRadius };
        });
        assert.equal(styles.columns, columns, "Account cards share the responsive column grid");
        assert.equal(styles.background, "rgb(255, 255, 255)");
        assert.equal(styles.radius, "10px");
      }
      const roleCard = area.locator(".account-role-card");
      if (await roleCard.count()) {
        assert.equal(await roleCard.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length), columns);
        assert.equal(await roleCard.getByRole("heading", { name: "Phân quyền nhân viên", exact: true }).count(), 1);
      }
      assert.equal(await info.locator(".live-field").count(), 8);
      assert.equal(await password.locator('input[type="password"]').count(), 2, "Password fields must not become plain text");
      const fields = info.locator(".live-field");
      const inputs = password.locator("input");
      assert.equal(await inputs.count(), 2);
      for (let index = 0; index < Math.min(columns, 2); index++) {
        const fieldBox = await fields.nth(index).boundingBox();
        const inputBox = await inputs.nth(index).boundingBox();
        assert.ok(Math.abs(fieldBox.x - inputBox.x) < 1, "Password inputs align with the information columns: " + JSON.stringify({ fieldBox, inputBox }));
        assert.ok(Math.abs(fieldBox.width - inputBox.width) < 1, "Password inputs use one column each");
      }
    }
    await page.goto(base + "/accounts");
    await area.getByRole("link", { name: "TK2", exact: true }).waitFor();
    await assertBreadcrumb(["Quản trị", "Tài khoản"]);
    assert.equal(await area.locator("tbody tr").count(), 2);
    await area.getByLabel("Vai trò", { exact: true }).selectOption("NHAN_VIEN");
    await area.getByRole("link", { name: "TK2", exact: true }).waitFor();
    assert.equal(await area.locator("tbody tr").count(), 1);
    await area.getByLabel("Vai trò", { exact: true }).selectOption("");
    await area.getByRole("link", { name: "+ Thêm tài khoản", exact: true }).click();
    await page.waitForURL("**/accounts/new");
    await assertBreadcrumb(["Quản trị", "Tài khoản", "Thêm tài khoản"]);
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
    await area.locator(".live-field").first().waitFor();
    await assertBreadcrumb(["Quản trị", "Tài khoản", "AD000001"]);
    await assertDetailActions();
    await assertCards(5);
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-account-actions-desktop.png"), fullPage: true });
    await area.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    await area.getByLabel("Tên đăng nhập AD000001", { exact: true }).fill("updated.user");
    await assertBreadcrumb(["Quản trị", "Tài khoản"]);
    await area.getByLabel("Tên đăng nhập AD000001", { exact: true }).press("Enter");
    await area.getByText("Đã cập nhật tài khoản AD000001.", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/accounts");
    await area.getByRole("link", { name: "Chi tiết", exact: true }).click();
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
    await area.getByLabel(/^Vai trò/).selectOption("NHAN_VIEN");
    await area.getByLabel(/^Kho phụ trách/).selectOption("7");
    await area.getByRole("button", { name: "Lưu phân quyền", exact: true }).click();
    await area.getByRole("status").waitFor();
    await area.getByLabel(/^Mật khẩu mới/).fill("test-reset-password");
    await area.getByLabel(/^Nhập lại mật khẩu/).fill("test-reset-password");
    await area.getByRole("button", { name: "Cấp lại mật khẩu", exact: true }).click();
    await area.getByText("Đã cấp lại mật khẩu. Các phiên cũ không còn hợp lệ.").waitFor();

    for (const [id, role] of [["KH000001", "KHACH_HANG"], ["KHO000001", "NHAN_VIEN"]]) {
      await page.goto(base + "/accounts/new");
      assert.equal(await area.getByLabel(/^Mã tài khoản/).count(), 0);
      await area.getByLabel(/^Tên đăng nhập/).fill("user." + role.toLowerCase());
      await area.getByLabel(/^Họ tên/).fill("New " + role);
      await area.getByLabel(/^Loại tài khoản/).selectOption(role);
      if (role === "NHAN_VIEN") {
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
      assert.equal(created.ma_kho, role === "NHAN_VIEN" ? -900003 : null);
      if (role === "KHACH_HANG") {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await assertCards(5);
        assert.equal(await area.getByRole("heading", { name: "Phân quyền nhân viên", exact: true }).count(), 1);
        assert.equal(await area.locator(".account-role-card select").first().inputValue(), "KHACH_HANG");
        assert.equal(await area.getByRole("button", { name: "Lưu phân quyền", exact: true }).isDisabled(), true);
        const beforeCustomerSubmit = mutations.length;
        await area.locator(".account-role-card").dispatchEvent("submit");
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        assert.equal(mutations.length, beforeCustomerSubmit, "Customer role card must not send role writes");
        await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-account-cards-desktop.png"), fullPage: true });
        await page.setViewportSize({ width: 1440, height: 960 });
      }
    }

    // The exact requested detail URL must keep its cards even when it is self.
    // All writes remain mocked; submit handlers must reject self-admin actions.
    selfDetailId = "AD000001";
    await page.goto(base + "/accounts/AD000001");
    await assertCards(5);
    await assertBreadcrumb(["Quản trị", "Tài khoản", "AD000001"]);
    assert.equal(await area.locator(".account-role-card select").first().inputValue(), "ADMIN");
    assert.equal(await area.getByRole("button", { name: "Tạm khóa", exact: true }).isDisabled(), true);
    assert.equal(await area.getByRole("button", { name: "Ẩn tài khoản", exact: true }).isDisabled(), true);
    for (const selector of [".account-role-card select", ".account-role-card button", ".account-password-card input", ".account-password-card button"]) {
      for (const control of await area.locator(selector).all()) assert.equal(await control.isDisabled(), true);
    }
    const beforeSelfSubmit = mutations.length;
    await area.locator(".account-role-card").dispatchEvent("submit");
    await area.locator(".account-password-card").dispatchEvent("submit");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(mutations.length, beforeSelfSubmit, "Self-admin forms must not send writes");
    assert.equal(await area.getByRole("link", { name: "Tài khoản của tôi / đổi mật khẩu", exact: true }).getAttribute("href"), "/account");
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-ad000001-self-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await assertCards(1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-ad000001-self-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 960 });
    selfDetailId = null;
    await page.locator("button.user").click();
    await page.getByRole("button", { name: /Tài khoản của tôi/ }).click();
    await page.waitForURL("**/account");
    await assertBreadcrumb(["Quản trị", "Tài khoản", "Tài khoản của tôi"]);
    await area.getByLabel(/^Tên đăng nhập/).fill("Profile.Admin");
    await area.getByRole("button", { name: "Lưu thông tin", exact: true }).click();
    await area.getByText("Đã lưu thông tin đăng nhập.").waitFor();
    await area.getByLabel(/^Mật khẩu hiện tại/).fill("test-old-password");
    await area.getByLabel(/^Mật khẩu mới/).fill("test-profile-password");
    await area.getByLabel(/^Nhập lại mật khẩu mới/).fill("test-profile-password");
    await area.getByRole("button", { name: "Đổi mật khẩu", exact: true }).click();
    await page.waitForURL("**/?passwordChanged=1");
    await page.getByText("Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.").waitFor();

    // Legacy edit links now open the inline editor; details remain separate.
    loggedIn = true;
    await page.goto(base + "/data/accounts?key=%5B%22TK2%22%5D&edit=1");
    await area.getByLabel("Tên đăng nhập TK2", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/accounts");
    await assertBreadcrumb(["Quản trị", "Tài khoản"]);
    await area.getByLabel("Tên đăng nhập TK2", { exact: true }).press("Escape");
    await area.getByRole("link", { name: "TK2", exact: true }).click();
    await page.waitForURL("**/accounts/TK2");
    await area.locator(".live-field").first().waitFor();
    await assertDetailActions();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".main")).paddingLeft === "0px");
    await assertBreadcrumb(["Quản trị", "Tài khoản", "TK2"]);
    await assertCards(1);
    assert.equal(await area.locator(".live-page-actions-group").getByRole("button", { name: "Tạm khóa", exact: true }).isVisible(), true);
    assert.equal(await area.locator(".live-page-actions-group").getByRole("button", { name: "Ẩn tài khoản", exact: true }).isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-account-actions-mobile.png"), fullPage: true });
    await area.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    await area.getByLabel("Tên đăng nhập TK2", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/accounts");
    assert.equal(await area.locator("tbody button").count(), 0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, "mobile page should not overflow horizontally");

    assert(mutations.some(call => call.method === "PUT" && call.path.endsWith("/role")));
    assert(mutations.some(call => call.path === "admin/me/password"));
    assert.equal(records.find(row => row.ma_tk === "AD000001").ten_tai_khoan, "updated.user");
    assert.deepEqual(browserErrors, []);
    console.log("PASS: AD000001 detail cards preserved for self with disabled controls and zero self-admin writes; create NEW admin/customer/warehouse person; list/filter/detail/edit/status/role/reset/profile/password/logout/legacy/mobile");
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
