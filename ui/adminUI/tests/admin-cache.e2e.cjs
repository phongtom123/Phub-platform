/** Cache/navigation regression with HTTP fixtures only; no live writes. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const column = (name, required = false, immutable = false, type = "varchar") => ({ name, type, required, immutable, generated: false, default: null, choices: null });

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.addInitScript(() => {
      const originalNow = Date.now.bind(Date); window.cacheTimeOffset = 0;
      Date.now = () => originalNow() + window.cacheTimeOffset;
    });
    const errors = [], reads = { session: 0, metadata: 0, data: 0, documents: 0 }, writes = [];
    let customerName = "Khách ban đầu", loggedIn = true, denyData = false, actor = "AD1";
    const user = () => ({ account_id: actor, role: "ADMIN", username: actor.toLowerCase(), name: "Admin " + actor });
    const resources = [
      { name: "customers", title: "Khách hàng", keys: ["ma_kh"], writable: true, columns: [column("ma_kh", true, true), column("ten_kh", true)] },
      { name: "warehouses", title: "Kho", keys: ["ma_kho"], writable: true, columns: [column("ma_kho", true, true, "int"), column("ten_kho", true), column("dia_chi", true), column("trang_thai", true, false, "int")] },
    ];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) reads.documents++; });
    const respond = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      if (url.pathname.endsWith("/auth/me")) { reads.session++; return respond(route, loggedIn ? user() : { detail: "Hết phiên" }, loggedIn ? 200 : 401); }
      if (url.pathname.endsWith("/auth/login")) { writes.push("login"); loggedIn = true; return respond(route, user()); }
      if (url.pathname.endsWith("/auth/logout")) { writes.push("logout"); loggedIn = false; return route.fulfill({ status: 204 }); }
      if (url.pathname.endsWith("/data/resources")) { reads.metadata++; return respond(route, resources); }
      if (request.method() === "PATCH") {
        assert.equal(url.pathname, "/api/backend/data/customers");
        const body = request.postDataJSON(); writes.push(body); customerName = body.ten_kh;
        return respond(route, { data: [{ ma_kh: "KH1", ten_kh: customerName }] });
      }
      assert.equal(request.method(), "GET"); reads.data++;
      if (denyData) { loggedIn = false; return respond(route, { detail: "Hết phiên" }, 401); }
      const data = url.pathname.endsWith("/customers") ? [{ ma_kh: "KH1", ten_kh: customerName }]
        : url.pathname.endsWith("/warehouses") ? [{ ma_kho: -1, ten_kho: "Kho test", dia_chi: "Hà Nội", trang_thai: 1 }] : [];
      return respond(route, { data, total: data.length, page: 1, page_size: Number(url.searchParams.get("page_size") || 20) });
    });
    const row = () => page.locator("tbody tr").filter({ has: page.getByRole("link", { name: "KH1", exact: true }) });
    const waitCustomers = () => row().waitFor();
    const sidebar = page.locator("aside");
    async function navigate(name, group) {
      const button = sidebar.getByRole("button", { name, exact: true });
      if (!await button.isVisible()) await sidebar.getByRole("button", { name: group, exact: true }).click();
      await button.click();
      await page.waitForURL(url => url.searchParams.get("module") === (name === "Kho" ? "branches" : "customers"));
      await page.locator(".live-table tbody tr").first().waitFor();
    }
    async function detailAndBack() {
      await row().getByRole("link", { name: "Chi tiết", exact: true }).click();
      await page.locator(".live-field").first().waitFor();
      await page.getByRole("button", { name: "← Quay lại", exact: true }).click();
      await waitCustomers();
    }

    await page.goto(base + "/data/customers"); await waitCustomers();
    assert.equal(reads.session, 1); assert.equal(reads.metadata, 1);
    await detailAndBack(); const warm = { ...reads };
    await detailAndBack(); assert.equal(reads.session, warm.session, "Navigation never checks the session again");
    await navigate("Kho", "TỔ CHỨC");
    assert.equal(reads.metadata, 1, "Metadata is shared between resources");
    await navigate("Khách hàng", "BÁN HÀNG"); const bothWarm = { ...reads };
    await navigate("Kho", "TỔ CHỨC"); await navigate("Khách hàng", "BÁN HÀNG");
    assert.equal(reads.metadata, bothWarm.metadata, "Navigation keeps cached metadata");
    assert.equal(reads.documents, 1);

    customerName = "Thay đổi ngoài ứng dụng";
    await page.evaluate(() => { window.cacheTimeOffset += 2_000; });
    await navigate("Kho", "TỔ CHỨC"); await navigate("Khách hàng", "BÁN HÀNG");
    await row().getByText(customerName, { exact: true }).waitFor();
    const beforeRefresh = { ...reads };
    await page.getByRole("button", { name: "Làm mới", exact: true }).click();
    await row().getByText("Thay đổi ngoài ứng dụng", { exact: true }).waitFor();
    assert.ok(reads.data >= beforeRefresh.data + 1); assert.equal(reads.metadata, beforeRefresh.metadata + 1);
    await navigate("Kho", "TỔ CHỨC"); await navigate("Khách hàng", "BÁN HÀNG");
    const beforeTTL = { ...reads };
    await page.evaluate(() => { window.cacheTimeOffset += 365 * 24 * 3600_000; });
    customerName = "Dữ liệu sau một năm";
    await navigate("Kho", "TỔ CHỨC"); await navigate("Khách hàng", "BÁN HÀNG");
    await row().getByText(customerName, { exact: true }).waitFor();
    assert.equal(reads.metadata, beforeTTL.metadata, "Metadata has no time expiry; visible data revalidates immediately");

    await row().locator('[data-field="ten_kh"]').dblclick();
    const beforeSave = { ...reads };
    const input = page.getByLabel("Tên khách hàng KH1", { exact: true });
    await input.fill("Khách đã chỉnh sửa"); await input.press("Enter");
    await page.getByRole("status").filter({ hasText: "Đã lưu thay đổi." }).waitFor();
    assert.deepEqual(reads, beforeSave, "Mutation updates only the row; invalidation does not refetch eagerly");
    await navigate("Kho", "TỔ CHỨC"); await navigate("Khách hàng", "BÁN HÀNG");
    await row().getByText("Khách đã chỉnh sửa", { exact: true }).waitFor();
    assert.ok(reads.data > beforeSave.data); assert.ok(reads.metadata > beforeSave.metadata);
    const warmAgain = { ...reads };
    await navigate("Kho", "TỔ CHỨC"); await navigate("Khách hàng", "BÁN HÀNG"); assert.equal(reads.metadata, warmAgain.metadata);

    // Cache cannot preserve access after a real data 401, or cross a login boundary.
    denyData = true;
    await page.getByRole("button", { name: "Làm mới", exact: true }).click();
    await page.locator('input[name="username"]').waitFor();
    assert.equal(await page.locator(".shell").count(), 0);
    actor = "AD2"; denyData = false; customerName = "Dữ liệu phiên AD2";
    const checksBeforeLogin = reads.session;
    await page.locator('input[name="username"]').fill("ad2"); await page.locator('input[name="password"]').fill("test-only-password");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.locator(".shell").waitFor();
    // The login keeps the current URL; it must fetch the new user's current page.
    await row().getByText("Dữ liệu phiên AD2", { exact: true }).waitFor();
    assert.equal(reads.session, checksBeforeLogin, "Login uses its response, never another /me");
    await sidebar.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.locator('input[name="username"]').waitFor();
    await page.reload(); await page.locator('input[name="username"]').waitFor();
    assert.equal(await page.locator(".shell").count(), 0);
    assert.deepEqual(writes, [{ ten_kh: "Khách đã chỉnh sửa" }, "login", "logout"]);
    assert.deepEqual(errors, []);
    console.log("PASS: cached navigation with immediate background validation; 1 document; no TTL, metadata reuse, manual refresh, mutation invalidation and 401/login/logout/F5 privacy boundaries; no live writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
