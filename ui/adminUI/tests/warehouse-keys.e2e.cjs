/** Real local Next pages; HTTP fixtures only. Never writes to Supabase. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    const keys = [];
    page.on("pageerror", error => errors.push(error.message));
    const warehouse = { ma_kho: -900003, ten_kho: "Kho test mã âm", dia_chi: "Địa chỉ test", trang_thai: 1 };
    const metadata = {
      name: "warehouses", title: "Kho", keys: ["ma_kho"], writable: true,
      columns: [
        { name: "ma_kho", type: "int", required: true, generated: true, immutable: true },
        { name: "ten_kho", type: "varchar", required: true },
        { name: "dia_chi", type: "varchar", required: true },
        { name: "trang_thai", type: "int", required: true, default: 1 },
      ],
    };
    await page.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());
      // Refuse external requests and all writes, even if UI env points to Render.
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      assert.equal(request.method(), "GET", "This browser test must not write data");
      const respond = data => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
      if (url.pathname === "/api/backend/auth/me") return respond({ username: "admin.test", role: "ADMIN", name: "Admin Test" });
      if (url.pathname === "/api/backend/data/resources") return respond([metadata]);
      if (url.pathname === "/api/backend/data/warehouses") {
        const key = url.searchParams.get("key");
        if (key !== null) {
          assert.deepEqual(JSON.parse(key), [-900003]);
          keys.push(key);
        }
        return respond({ data: [warehouse], total: 1, page: 1, page_size: 20 });
      }
      throw new Error("Unexpected API request: " + url.pathname);
    });

    await page.goto(base + "/data/warehouses");
    await page.locator(".live-table").getByRole("link", { name: "-900003", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/data/warehouses" && url.searchParams.get("key") === "[-900003]");
    await page.locator(".live-field").getByText("Mã kho", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("edit") === "1");
    await page.getByLabel(/^Tên kho/).waitFor();
    assert.equal(await page.getByLabel(/^Tên kho/).inputValue(), warehouse.ten_kho);
    await page.getByRole("link", { name: "Hủy", exact: true }).click();
    await page.locator(".live-field").getByText("Mã kho", { exact: true }).waitFor();

    // Old detail/edit routes must preserve negative IDs through Next redirects.
    for (const edit of [false, true]) {
      await page.goto(base + "/warehouses/-900003" + (edit ? "/edit" : ""));
      await page.waitForURL(url => url.pathname === "/data/warehouses" && url.searchParams.get("key") === "[-900003]" && url.searchParams.get("edit") === (edit ? "1" : null));
      if (edit) await page.getByLabel(/^Tên kho/).waitFor();
      else await page.locator(".live-field").getByText("Mã kho", { exact: true }).waitFor();
      // Next's route announcer also has role=alert; check only application errors.
      assert.equal(await page.locator('.live-data [role="alert"]').count(), 0);
    }
    assert.ok(keys.length >= 4);
    assert.deepEqual(errors, []);
    console.log("PASS: negative warehouse ID list/detail/edit/cancel and legacy redirects; no live database writes.");
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
