// HTTP fixtures only: no real products, inventory, accounts or transactions are changed.
const assert = require("node:assert/strict");
const os = require("node:os"), path = require("node:path");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_USER_TEST_URL || "http://localhost:3001";
const option = (value, count = 1) => ({ value, label: value, count });
const facet = (key, label, values) => ({ key, label, options: values.map(value => option(value)) });
const categories = [{ id: "DESKTOP", name: "Máy tính để bàn", children: [{ id: "DESKTOP_CUSTOM", name: "PC Custom" }] }, { id: "COMP", name: "Linh kiện", children: [{ id: "CPU", name: "Bộ vi xử lý" }, { id: "RAM", name: "Bộ nhớ RAM" }] }];
function product(id, type) {
  return { id, sku: id, name: `Sản phẩm ${id}`, price: "2000000.00", currency: "VND", category: { id: type === "DESKTOP_CUSTOM" ? "DESKTOP" : "COMP", name: "Category" }, subcategory: { id: type, name: type }, brand: type === "DESKTOP_CUSTOM" ? "Build" : "Intel", description: null, unit: "Cái", warranty_months: 12, images: [], specifications: [], specifications_text: null };
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined, args: ["--disable-features=LocalNetworkAccessChecks"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], calls = [], writes = [];
    let mode = "ready";
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname;
      if (request.method() !== "GET") writes.push(endpoint);
      const ok = json => route.fulfill({ json });
      if (endpoint.endsWith("/auth/me") || endpoint.endsWith("/customer/me")) return route.fulfill({ status: 401, json: { error: { message: "Guest" } } });
      if (endpoint.endsWith("/categories")) return ok({ items: categories });
      if (endpoint.endsWith("/brands")) return ok({ items: [{ name: "Build" }, { name: "Intel" }, { name: "Corsair" }] });
      const type = url.searchParams.get("subcategory_id") || "DESKTOP_CUSTOM";
      const selected = url.searchParams.getAll("spec").map(value => JSON.parse(value));
      if (endpoint === "/api/catalog/facets") {
        calls.push({ kind: "facets", params: url.searchParams });
        if (mode === "error") return route.fulfill({ status: 503, json: { error: { message: "Không tải được thông số thử nghiệm." } } });
        if (type === "CPU") return ok({ specs: [facet("socket", "Socket", ["LGA1700", "AM5"])], brands: [option("Intel"), option("AMD")], total: 2 });
        if (type === "RAM") return ok({ specs: [facet("dung-luong", "Dung lượng", ["16 GB", "32 GB"]), facet("chuan", "Chuẩn RAM", ["DDR4", "DDR5"])], brands: [option("Corsair"), option("G.Skill")], total: 2 });
        const cpu = selected.some(([key, value]) => key === "cpu" && value === "Core i5");
        return ok({ specs: [facet("cpu", "CPU", ["Core i5", "Core i7"]), { key: "ram", label: "RAM", options: [option("16 GB"), option("32 GB", cpu ? 0 : 1)] }], brands: [option("Build", 2)], total: cpu ? 1 : 2 });
      }
      if (endpoint === "/api/catalog/products") {
        calls.push({ kind: "products", params: url.searchParams });
        const items = selected.length ? [product("P1", type)] : [product("P1", type), product("P2", type)];
        return ok({ items, pagination: { page: Number(url.searchParams.get("page") || 1), page_size: Number(url.searchParams.get("page_size") || 20), total: items.length, total_pages: 1 } });
      }
      if (endpoint.endsWith("/availability")) return ok({ id: endpoint.split("/").at(-2), sku: endpoint.split("/").at(-2), quantity: Number(url.searchParams.get("quantity") || 1), available: true });
      if (endpoint.startsWith("/api/catalog/")) return ok({ items: [] });
      throw new Error(`Unexpected API ${endpoint}`);
    });
    const bar = page.getByLabel("Bộ lọc sản phẩm theo loại", { exact: true });
    const popup = label => bar.getByRole("region", { name: `Lọc ${label}`, exact: true });
    const trigger = label => bar.getByRole("button", { name: new RegExp(`^${label}(?:\\s*\\d+)?$`) });
    async function open(label) { await trigger(label).click(); await popup(label).waitFor(); }
    async function apply() { await bar.getByRole("button", { name: "Áp dụng bộ lọc", exact: true }).click(); }
    async function changeType(parent, child) {
      await open("Loại sản phẩm");
      await popup("Loại sản phẩm").getByRole("combobox", { name: "Nhóm sản phẩm", exact: true }).selectOption(parent);
      if (!await popup("Loại sản phẩm").isVisible()) await open("Loại sản phẩm");
      await popup("Loại sản phẩm").getByRole("combobox", { name: "Loại sản phẩm", exact: true }).selectOption(child);
      await apply("Loại sản phẩm");
      await page.waitForURL(url => url.searchParams.get("subcategory_id") === child);
    }
    await page.goto(base + "/main/product?subcategory_id=DESKTOP_CUSTOM");
    await page.getByRole("heading", { name: /^PC Custom/ }).waitFor();
    await trigger("CPU").waitFor();
    assert.equal(await page.getByRole("complementary", { name: "Bộ lọc sản phẩm" }).count(), 0);
    assert.equal(await trigger("Socket").count(), 0);
    await open("CPU");
    const before = calls.length;
    await popup("CPU").getByRole("checkbox", { name: /Core i5/ }).click();
    await popup("CPU").waitFor({ state: "detached" });
    assert.ok(await trigger("CPU").evaluate(element => element === document.activeElement), "Focus returns to the dropdown trigger after selection");
    assert.equal(calls.length, before, "Draft selection stays in memory until Apply");
    assert.equal(await bar.locator('[role="region"] button').filter({hasText: /Áp dụng/}).count(), 0, "No per-dropdown apply button");
    await open("RAM");
    await popup("RAM").getByRole("checkbox", { name: /16 GB/ }).click();
    await popup("RAM").waitFor({ state: "detached" });
    await open("CPU");
    assert.ok(await popup("CPU").getByRole("checkbox", { name: /Core i5/ }).isChecked(), "Switching dropdowns preserves the draft");
    await page.keyboard.press("Escape");
    await open("RAM");
    assert.ok(await popup("RAM").getByRole("checkbox", { name: /16 GB/ }).isChecked(), "Closing and reopening preserves the draft");
    assert.equal(calls.length, before, "Several draft dropdown selections produce no API calls");
    await page.screenshot({ path: path.join(os.tmpdir(), "phub-catalog-dropdown-desktop.png"), fullPage: false });
    await apply("CPU");
    await page.waitForURL(url => url.searchParams.getAll("spec").some(value => value === JSON.stringify(["cpu", "Core i5"])));
    await page.getByRole("heading", { name: "PC Custom (1 sản phẩm)", exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.getAll("spec").length, 2, "One external Apply submits both fields");
    assert.ok(calls.some(call => call.kind === "products" && call.params.get("subcategory_id") === "DESKTOP_CUSTOM" && call.params.getAll("spec").length === 2));
    await open("RAM");
    await popup("RAM").getByRole("checkbox", { name: /32 GB/ }).waitFor();
    assert.ok(await popup("RAM").getByRole("checkbox", { name: /32 GB/ }).isDisabled());
    await page.keyboard.press("Escape");
    await page.reload(); await trigger("CPU").waitFor(); await open("CPU");
    assert.ok(await popup("CPU").getByRole("checkbox", { name: /Core i5/ }).isChecked());
    await page.keyboard.press("Escape");
    await changeType("COMP", "CPU");
    await trigger("Socket").waitFor();
    assert.equal(new URL(page.url()).searchParams.getAll("spec").length, 0);
    assert.equal(await trigger("RAM").count(), 0);
    await open("Thương hiệu");
    assert.equal(await popup("Thương hiệu").getByRole("radio", { name: /Build/ }).count(), 0);
    await popup("Thương hiệu").getByRole("radio", { name: /Intel/ }).click(); await apply("Thương hiệu");
    await page.waitForURL(url => url.searchParams.get("brand") === "Intel");
    await changeType("COMP", "RAM"); await trigger("Dung lượng").waitFor();
    assert.equal(new URL(page.url()).searchParams.get("brand"), null);
    assert.equal(await trigger("Socket").count(), 0);
    await open("Dung lượng"); await popup("Dung lượng").getByRole("checkbox", { name: /16 GB/ }).click(); await apply("Dung lượng");
    await page.waitForURL(url => url.searchParams.getAll("spec").length === 1);
    await bar.getByRole("button", { name: "Xóa điều kiện lọc", exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.getAll("spec").length, 1, "Clearing is staged until Apply");
    await apply();
    await page.waitForURL(url => url.searchParams.get("subcategory_id") === "RAM" && !url.searchParams.has("spec"));
    await page.setViewportSize({ width: 390, height: 844 });
    await trigger("Chuẩn RAM").waitFor(); await open("Chuẩn RAM");
    const box = await popup("Chuẩn RAM").boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 391);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(await bar.getByRole("button", { name: "Áp dụng bộ lọc", exact: true }).count(), 1);
    await page.screenshot({ path: path.join(os.tmpdir(), "phub-catalog-dropdown-mobile.png"), fullPage: false });
    await popup("Chuẩn RAM").getByRole("checkbox", { name: /DDR5/ }).click(); await apply("Chuẩn RAM");
    await popup("Chuẩn RAM").waitFor({ state: "detached" });
    await page.waitForURL(url => url.searchParams.getAll("spec").some(value => value.includes("DDR5")));
    mode = "error"; await page.reload();
    await bar.getByRole("alert").getByText(/Không tải được thông số thử nghiệm/).waitFor();
    mode = "ready"; await bar.getByRole("button", { name: "Thử lại bộ lọc thông số", exact: true }).click();
    await trigger("Chuẩn RAM").waitFor();
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    console.log("PASS: scoped PC/CPU/RAM dropdowns, exact spec queries and totals, disjunctive counts, draft in RAM, URL refresh, type reset, contextual clearing, errors/retry and mobile popups");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
