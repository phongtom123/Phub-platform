// Run after npm run build. Isolated HTTP fixtures; no live backend or DB writes.
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const product = {
  id: "SP-TEST-01", sku: "TEST-01", name: "Sản phẩm kiểm tra điều hướng",
  category: { id: "CPU", name: "Vi xử lý" }, brand: "PHUB",
  price: "1500000", currency: "VND", description: "Mô tả sản phẩm kiểm tra.",
  unit: "Chiếc", warranty_months: 12, images: [],
  specifications: [{ label: "Dòng", value: "Test" }], specifications_text: null,
};
const detailPath = `/main/product/${encodeURIComponent(product.id)}`;

async function main() {
  const backend = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    let body;
    if (url.pathname === "/api/catalog/products") body = { items: [product], pagination: { page: 1, page_size: Number(url.searchParams.get("page_size") || 20), total: 1, total_pages: 1 } };
    else if (decodeURIComponent(url.pathname) === `/api/catalog/products/${product.id}`) body = product;
    else if (url.pathname === "/api/catalog/categories") body = { items: [product.category] };
    else if (url.pathname === "/api/catalog/brands") body = { items: [{ name: "PHUB" }] };
    else { response.statusCode = 404; body = { error: { message: "Fixture not found" } }; }
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(body));
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const frontend = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PHUB_API_BASE_URL: `http://127.0.0.1:${backend.address().port}` },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let output = "";
  frontend.stdout.on("data", chunk => { output += chunk; });
  frontend.stderr.on("data", chunk => { output += chunk; });
  let browser;
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error(`Next startup timed out: ${output}`)), 30000);
      const poll = setInterval(() => {
        const address = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
        if (address && output.includes("Ready")) finish(null, address[0]);
      }, 100);
      function finish(error, value) { clearTimeout(timeout); clearInterval(poll); error ? reject(error) : resolve(value); }
      frontend.once("error", finish);
      frontend.once("exit", code => finish(new Error(`Next exited (${code}): ${output}`)));
    });
    browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/auth/**", route => route.fulfill({ status: 401, json: { error: { message: "Not signed in" } } }));
    async function checkDetail(link, keyboard = false) {
      assert.equal(await link.getAttribute("href"), detailPath);
      if (keyboard) { await link.focus(); await page.keyboard.press("Enter"); }
      else await link.click();
      await page.waitForURL(url => url.pathname === detailPath);
      try { await page.getByRole("heading", { name: product.name, exact: true }).waitFor(); }
      catch (error) { console.error(await page.locator("body").innerText(), output); throw error; }
      assert.equal(await page.getByRole("dialog").count(), 0);
    }
    for (const width of [1440, 390]) {
      console.log(`Checking navigation at ${width}px`);
      await page.setViewportSize({ width, height: 960 });
      await page.goto(base);
      await checkDetail(page.locator("#new-products article a").first());
      await page.goto(base);
      await checkDetail(page.locator("#CPU article a").nth(1), true);
      await page.goto(base + "/main/product");
      const results = page.locator(width === 1440 ? "#catalog-results" : "#homepage2-results");
      await checkDetail(results.locator("article a").first());
      await page.goto(base + "/main/product?q=kiểm+tra");
      await checkDetail(results.locator("article a").nth(1), true);
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(base + "/main/product?view=list");
    const row = page.locator("#catalog-results article").first();
    await row.getByRole("button", { name: `Add to comparison: ${product.name}`, exact: true }).click();
    await row.getByRole("button", { name: `Add to wish list: ${product.name}`, exact: true }).click();
    assert.equal(new URL(page.url()).pathname, "/main/product");
    const compared = page.getByRole("region", { name: "So sánh sản phẩm", exact: true });
    const wished = page.getByRole("region", { name: "Danh sách yêu thích", exact: true });
    assert.equal(await wished.getByRole("link", { name: product.name }).getAttribute("href"), detailPath);
    await checkDetail(compared.getByRole("link", { name: product.name }));
    await page.goto(base + "/main/product?view=list");
    await checkDetail(row.locator("a").first());
    await page.goto(base + "/main/product?view=list");
    await checkDetail(row.locator("h2 a"), true);
    assert.deepEqual(errors, []);
    console.log("PASS: home shelves, catalog grid/list, search, saved items, desktop/mobile, keyboard links and rendered detail.");
  } finally {
    if (browser) await browser.close();
    if (frontend.exitCode === null) { const stopped = once(frontend, "exit"); frontend.kill(); await stopped; }
    backend.closeAllConnections();
    await new Promise(resolve => backend.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
