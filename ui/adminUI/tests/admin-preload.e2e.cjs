/** Warm navigation under slow API fixtures. No requests reach a live backend. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); await page.clock.install();
    const calls = [], warmed = new Set(), errors = [];
    let documents = 0, blocked = false, finish, signedIn = true;
    const columns = names => names.map((name, index) => ({ name, type: name === "ma_kho" ? "int" : "varchar", required: true, immutable: index === 0, generated: false }));
    const resources = [
      { name: "customers", title: "Khách hàng", keys: ["ma_kh"], columns: columns(["ma_kh", "ten_kh"]), writable: false },
      { name: "products", title: "Sản phẩm", keys: ["ma_sp"], columns: columns(["ma_sp", "ten_sp"]), writable: false },
      { name: "warehouses", title: "Kho", keys: ["ma_kho"], columns: columns(["ma_kho", "ten_kho"]), writable: false },
      { name: "accounts", title: "Tài khoản", keys: ["ma_tk"], columns: [], writable: false },
    ];
    const rows = { customers: [{ ma_kh: "KH1", ten_kh: "Khách ban đầu" }], products: [{ ma_sp: "SP1", ten_sp: "Sản phẩm tải trước" }], warehouses: [{ ma_kho: 1, ten_kho: "Kho tải trước" }] };
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      assert.equal(request.method(), "GET"); calls.push(url.pathname + url.search);
      const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname.endsWith("/auth/me")) return respond(signedIn ? { account_id: "AD1", username: "admin", role: "ADMIN", name: "Admin" } : { detail: "Hết phiên" }, signedIn ? 200 : 401);
      if (!signedIn) return respond({ detail: "Hết phiên" }, 401);
      if (url.pathname.endsWith("/data/resources")) return respond(resources);
      if (url.pathname === "/api/backend/admin/accounts") { warmed.add("accounts"); return respond({ data: [], total: 0, page: 1, page_size: 20 }); }
      const resource = url.pathname.split("/").pop(); assert.ok(rows[resource], "Unexpected endpoint: " + url.pathname);
      warmed.add(resource);
      const payload = { data: rows[resource], total: rows[resource].length, page: 1, page_size: 20 };
      if (blocked && resource === "warehouses") { finish = () => respond({ ...payload, data: [{ ma_kho: 1, ten_kho: "Kho đã thay đổi" }] }); return; }
      return respond(payload);
    });
    await page.goto(base + "/data/customers"); await page.getByText("Khách ban đầu", { exact: true }).waitFor();
    for (let step = 0; step < 20 && warmed.size < 4; step++) { await page.clock.runFor(500); await page.evaluate(() => Promise.resolve()); }
    assert.deepEqual([...warmed].sort(), ["accounts", "customers", "products", "warehouses"]);
    assert.equal(calls.filter(url => url.includes("/data/resources")).length, 1);
    assert.equal(calls.filter(url => url.includes("/data/customers")).length, 1, "Preload joins/reuses foreground data");
    assert.ok(!calls.some(url => url.includes("page=2") || url.includes("key=")), "No exhaustive database/detail crawl");
    await page.clock.runFor(2_000); blocked = true;
    const sidebar = page.locator("aside");
    if (!await sidebar.getByRole("button", { name: "Kho", exact: true }).isVisible()) await sidebar.getByRole("button", { name: "TỔ CHỨC", exact: true }).click();
    await sidebar.getByRole("button", { name: "Kho", exact: true }).click();
    await page.getByText("Kho tải trước", { exact: true }).waitFor();
    assert.equal(await page.getByText("Đang tải dữ liệu…", { exact: true }).count(), 0);
    assert.equal(documents, 1);
    for (let step = 0; step < 10 && !finish; step++) { await page.clock.runFor(100); await page.evaluate(() => Promise.resolve()); }
    assert.equal(typeof finish, "function", "Warm page starts background verification immediately");
    const stable = await page.locator("tbody tr").first().elementHandle();
    await finish(); await page.getByText("Kho đã thay đổi", { exact: true }).waitFor();
    assert.equal(await stable.evaluate(node => node.isConnected), true);
    assert.equal(calls.filter(url => url.endsWith("/auth/me")).length, 1);
    signedIn = false; await page.clock.runFor(10_100); await page.locator('input[name="username"]').waitFor();
    const stopped = calls.length; await page.clock.runFor(30_000); assert.equal(calls.length, stopped);
    assert.deepEqual(errors, []);
    console.log("PASS: authenticated bounded first-page preload; shared cache; warm page displayed while fresh API is held; immediate update without remount/reload; logout cleanup; no live writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
