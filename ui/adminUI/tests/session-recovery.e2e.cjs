/** Browser HTTP fault injection only: no live database, credentials or writes. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: "phub_session", value: "test-only-session", url: base, httpOnly: true }]);
    const page = await context.newPage();
    const errors = [], calls = [];
    let sessionStatus = 503, loginStatus = 200, writes = 0;
    page.on("pageerror", error => errors.push(error.message));
    const respond = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const sessionBody = () => sessionStatus === 200
      ? { account_id: "TK-TEST", role: "ADMIN", username: "test.admin", name: "Admin Test" }
      : { detail: sessionStatus === 503 ? "Không kết nối được Supabase." : "Chưa đăng nhập." };
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      calls.push({ path: url.pathname, method: request.method() });
      if (url.pathname === "/api/backend/auth/me") {
        return respond(route, sessionBody(), sessionStatus);
      }
      if (request.method() !== "GET") {
        writes++;
        assert.equal(url.pathname, "/api/backend/auth/login");
        return respond(route, loginStatus === 200
          ? { account_id: "TK-TEST", role: "ADMIN", username: "test.admin", name: "Admin Test" }
          : { detail: "Sai thông tin đăng nhập." }, loginStatus);
      }
      if (url.pathname === "/api/backend/data/resources") return respond(route, []);
      return respond(route, { data: [], total: 0, page: Number(url.searchParams.get("page") || 1), page_size: Number(url.searchParams.get("page_size") || 20) });
    });

    await page.goto(base);
    await page.getByRole("button", { name: "Thử kết nối lại", exact: true }).waitFor();
    assert.equal(await page.locator('input[name="username"]').count(), 0);
    assert.equal(await page.locator(".dashboard-chart-card").count(), 0);
    assert.equal(calls.filter(call => call.path.startsWith("/api/backend/data/")).length, 0);
    assert.ok((await context.cookies()).some(cookie => cookie.name === "phub_session"));
    sessionStatus = 200;
    await page.getByRole("button", { name: "Thử kết nối lại", exact: true }).click();
    await page.getByRole("heading", { name: "Thống kê hoạt động" }).waitFor();
    assert.equal(await page.locator(".dashboard-chart-card").count(), 4);

    // Failed revalidation preserves verified UI, never grants new access.
    sessionStatus = 503;
    await page.evaluate(() => window.dispatchEvent(new Event("phub-account-updated")));
    await page.locator(".session-warning").waitFor();
    assert.equal(await page.locator(".dashboard-chart-card").count(), 4);
    assert.equal(await page.locator('input[name="username"]').count(), 0);
    assert.ok((await context.cookies()).some(cookie => cookie.name === "phub_session"));
    sessionStatus = 200;
    await page.getByRole("button", { name: "Thử kết nối lại", exact: true }).click();
    await page.locator(".session-warning").waitFor({ state: "hidden" });
    sessionStatus = 401;
    await page.evaluate(() => window.dispatchEvent(new Event("phub-account-updated")));
    await page.locator('input[name="username"]').waitFor();
    assert.equal(await page.locator(".dashboard-chart-card").count(), 0);

    // Failed login cannot grant access; successful login is already authoritative.
    calls.length = 0;
    sessionStatus = 503;
    loginStatus = 401;
    await page.locator('input[name="username"]').fill("test.admin");
    await page.locator('input[name="password"]').fill("test-only-password");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.locator(".login-error").waitFor();
    assert.equal(writes, 1);
    assert.equal(await page.locator(".dashboard-chart-card").count(), 0);
    assert.equal(calls.filter(call => call.path.startsWith("/api/backend/data/")).length, 0);
    loginStatus = 200;
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.getByRole("heading", { name: "Thống kê hoạt động" }).waitFor();
    assert.equal(await page.locator(".dashboard-chart-card").count(), 4);
    assert.equal(await page.locator(".session-gate").count(), 0);
    assert.equal(calls.filter(call => call.path === "/api/backend/auth/me").length, 0, "No duplicate /me after successful login");
    assert.equal(writes, 2, "Each deliberate login attempt sends exactly one POST");

    // New page must validate again; no cached role can bypass a failed /me.
    sessionStatus = 503;
    await page.reload();
    await page.getByRole("button", { name: "Thử kết nối lại", exact: true }).waitFor();
    assert.equal(await page.locator(".dashboard-chart-card").count(), 0);
    sessionStatus = 403;
    await page.getByRole("button", { name: "Thử kết nối lại", exact: true }).click();
    await page.locator('input[name="username"]').waitFor();
    assert.equal(writes, 2);
    assert.deepEqual(errors, []);
    console.log("PASS: 503 preserves session, 401/403 require login, failed login blocks data, successful login mounts dashboard without another /me, F5 still verifies; no live DB writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
