/** Account detail layout matrix. All API calls mocked; no live account writes. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const accounts = [
  { ma_tk: "AD000001", ten_tai_khoan: "self.admin", role: "ADMIN", is_self: true, ma_nhan_vien: "NV1", ma_kh: null, ma_kho: null, trang_thai: 1 },
  { ma_tk: "AD000002", ten_tai_khoan: "other.admin", role: "ADMIN", is_self: false, ma_nhan_vien: "NV2", ma_kh: null, ma_kho: null, trang_thai: 1 },
  { ma_tk: "KHO000001", ten_tai_khoan: "warehouse", role: "THU_KHO", is_self: false, ma_nhan_vien: "NV3", ma_kh: null, ma_kho: 7, trang_thai: 2 },
  { ma_tk: "KH000001", ten_tai_khoan: "customer", role: "KHACH_HANG", is_self: false, ma_nhan_vien: null, ma_kh: "KH_509c1d8c69b2470ea80d41d9bf26b04d", ma_kho: null, trang_thai: 0 },
].map(account => ({ ...account, email: "test@example.test", ho_ten: "Tài khoản kiểm thử", owner_active: true }));

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    let writes = 0;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const respond = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      if (url.pathname === "/api/backend/data/resources") return respond([]);
      if (request.method() !== "GET") { writes++; return respond({ detail: "Test forbids writes." }, 403); }
      if (url.pathname === "/api/backend/auth/me") return respond({ account_id: "AD000001", username: "self.admin", name: "Admin Test", role: "ADMIN" });
      if (url.pathname === "/api/backend/admin/accounts") return respond({ data: accounts, total: accounts.length, page: 1, page_size: 20 });
      if (url.pathname === "/api/backend/data/warehouses") return respond({ data: [{ ma_kho: 7, ten_kho: "Kho test", trang_thai: 1 }], total: 1, page: 1, page_size: 100 });
      const account = accounts.find(item => url.pathname === "/api/backend/admin/accounts/" + item.ma_tk);
      assert.ok(account, "Unexpected API: " + url.pathname);
      return respond(account);
    });
    const area = page.locator(".accounts-page");
    for (const [width, columns] of [[1440, 5], [1100, 3], [820, 2], [390, 1]]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(base + "/accounts");
      for (const account of accounts) {
        await area.getByRole("link", { name: account.ma_tk, exact: true }).click();
        await page.waitForURL(base + "/accounts/" + account.ma_tk);
        await area.locator(".account-password-card").waitFor();
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".account-detail-card")).display === "grid");
        await page.evaluate(async () => {
          await new Promise(resolve => requestAnimationFrame(resolve));
          await Promise.all(document.querySelector(".main").getAnimations().map(animation => animation.finished.catch(() => {})));
          await document.fonts.ready;
        });
        assert.equal(await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 1);
        assert.equal(await area.getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 0);
        const cards = area.locator(".account-detail-card, .account-role-card, .account-password-card");
        assert.equal(await cards.count(), 3, "Every account uses the same three cards");
        const layout = await area.evaluate(node => {
          const box = element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width }; };
          const cardNodes = [...node.querySelectorAll(".account-detail-card, .account-role-card, .account-password-card")];
          const roleSelects = node.querySelectorAll(".account-role-card select");
          return {
            cards: cardNodes.map(card => ({ ...box(card), columns: getComputedStyle(card).gridTemplateColumns.split(" ").length, radius: getComputedStyle(card).borderRadius, background: getComputedStyle(card).backgroundColor })),
            info: [...node.querySelectorAll(".account-detail-card .live-field")].map(box),
            role: [roleSelects[0], node.querySelector("#account-warehouse-query"), roleSelects[1]].filter(Boolean).map(box),
            password: [...node.querySelectorAll(".account-password-card input")].map(box),
          };
        });
        assert.equal(layout.info.length, 8);
        for (const card of layout.cards) {
          assert.equal(card.columns, columns);
          assert.equal(card.radius, "10px");
          assert.equal(card.background, "rgb(255, 255, 255)");
          assert.ok(Math.abs(card.x - layout.cards[0].x) < 1);
          assert.ok(Math.abs(card.width - layout.cards[0].width) < 1);
        }
        for (const [index, field] of layout.role.entries()) assert.ok(Math.abs(field.x - layout.info[index % columns].x) < 1, "Role/search/warehouse positions are shared across accounts");
        for (const [index, field] of layout.password.entries()) assert.ok(Math.abs(field.x - layout.info[index % columns].x) < 1, "Password fields use the common grid");
        const canRole = Boolean(account.ma_nhan_vien) && !account.is_self;
        const canWarehouse = canRole && account.role === "THU_KHO";
        assert.equal(await area.locator(".account-role-card select").first().inputValue(), account.role);
        assert.equal(await area.locator(".account-role-card select").first().isDisabled(), !canRole);
        assert.equal(await area.locator("#account-warehouse-query").count(), canWarehouse ? 1 : 0, "Hide warehouse search when it does not apply");
        assert.equal(await area.locator(".account-role-card select").count(), canWarehouse ? 2 : 1, "Hide warehouse assignment when it does not apply");
        if (canWarehouse) {
          assert.equal(await area.locator("#account-warehouse-query").isDisabled(), false);
          assert.equal(await area.locator(".account-role-card select").last().isDisabled(), false);
        }
        assert.equal(await area.getByRole("button", { name: "Lưu phân quyền", exact: true }).isDisabled(), !canRole);
        assert.equal(await area.getByRole("button", { name: "Cấp lại mật khẩu", exact: true }).isDisabled(), account.is_self);
        const toolbar = area.locator(".live-page-actions");
        assert.equal(await toolbar.getByRole("button").count(), 3, "Back plus two status actions are always present");
        for (const button of await toolbar.locator(".live-page-actions-group button").all()) assert.equal(await button.isDisabled(), account.is_self);
        const editBox = await toolbar.getByRole("link", { name: "Chỉnh sửa", exact: true }).boundingBox();
        const toolbarBox = await toolbar.boundingBox();
        assert.ok(Math.abs(editBox.x + editBox.width - toolbarBox.x - toolbarBox.width) < 1, "Edit stays right-aligned for all account types");
        if (!canRole) await area.locator(".account-role-card").dispatchEvent("submit");
        if (account.is_self) await area.locator(".account-password-card").dispatchEvent("submit");
        if (canRole) {
          const roles = area.locator(".account-role-card select").first();
          await roles.selectOption("ADMIN");
          assert.equal(await area.locator("#account-warehouse-query").count(), 0);
          await roles.selectOption("THU_KHO");
          await area.locator("#account-warehouse-query").waitFor();
          await area.locator(".account-role-card select").last().selectOption("7");
          // Each matrix case tests a new query; repeated queries may be cached.
          const searchTerm = `Kho test ${width} ${account.ma_tk}`;
          const searchResponse = page.waitForResponse(response => {
            const url = new URL(response.url());
            return url.pathname === "/api/backend/data/warehouses" && url.searchParams.get("q") === searchTerm;
          });
          await area.getByLabel("Tìm kho", { exact: true }).fill(searchTerm);
          await area.getByRole("button", { name: "Tìm kho", exact: true }).click();
          await searchResponse;
          await roles.selectOption("ADMIN");
          assert.equal(await area.locator("#account-warehouse-query").count(), 0);
          assert.equal(await area.locator(".account-role-card select").count(), 1);
          await roles.selectOption(account.role);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        if (width === 1440 || (width === 390 && account.role === "KHACH_HANG")) {
          await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), `phub-unified-${account.ma_tk}-${width}.png`), fullPage: true });
        }
        await page.locator(".topbar").getByRole("link", { name: "Tài khoản", exact: true }).click();
        await page.waitForURL(base + "/accounts");
      }
    }
    assert.equal(writes, 0, "Blocked self/customer forms cannot send writes");
    assert.deepEqual(errors, []);
    console.log("PASS: shared account cards at 1440/1100/820/390px; warehouse fields hidden for admin/customer/self; selecting warehouse role reveals searchable/required assignment, switching back hides fields; permissions and navigation preserved; zero live writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
