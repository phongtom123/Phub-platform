// Isolated browser HTTP fixtures: no real receipt, product or stock writes.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3001";
const col = name => ({ name, type: "varchar", required: false, generated: false, immutable: false, choices: null, system: false });
const resources = [
  { name: "receipts", title: "Phiếu nhập", keys: ["ma_phieu_nhap"], writable: false, columns: [col("ma_phieu_nhap"), col("trang_thai")] },
  { name: "warehouses", title: "Kho", keys: ["ma_kho"], columns: [col("ma_kho"), col("ten_kho")] },
  { name: "suppliers", title: "NCC", keys: ["ma_ncc"], columns: [col("ma_ncc"), col("ten_ncc")] },
  { name: "products", title: "Sản phẩm", keys: ["ma_sp"], columns: [col("ma_sp"), col("sku"), col("ten_sp")] },
];
const products = [
  { ma_sp: "SP1", sku: "SKU-ALPHA", ten_sp: "CPU Alpha", gia_ban_hien_tai: "100.00" },
  { ma_sp: "SP2", sku: "DEMO-SKU", ten_sp: "Điện thoại Demo A", gia_ban_hien_tai: "100.00" },
  { ma_sp: "SP3", sku: "SKU-BETA", ten_sp: `CPU Alpha ${"tên sản phẩm dài ".repeat(15)}`, gia_ban_hien_tai: "100.00" },
];
const suppliers = [
  { ma_ncc: 1, ten_ncc: "NCC test" },
  { ma_ncc: 12, ten_ncc: "Công ty Alpha" },
  { ma_ncc: -5, ten_ncc: "Công ty Alpha" },
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PHUB_CHROMIUM_CHANNEL || "chrome" });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [], commands = [], searches = [];
      let failSearch = false, failSuppliers = false;
      page.on("pageerror", error => errors.push(error.message));
      const header = { ma_phieu_nhap: 7, ma_kho: 2, ma_ncc: 1, trang_thai: "NHAP" };
      await page.route("**/api/backend/**", async route => {
        const request = route.request(), url = new URL(request.url());
        const path = url.pathname.replace("/api/backend/", "");
        const ok = json => route.fulfill({ json });
        if (path === "auth/me") return ok({ account_id: "AUDIT-A", username: "admin", role: "ADMIN", name: "Test Admin", employee_id: "AD", customer_id: null, warehouse_id: null });
        if (path === "data/resources") return ok(resources);
        if (path === "data/warehouses") return ok({ data: [{ ma_kho: 2, ten_kho: "Kho test" }], total: 1, filters: {} });
        if (path === "data/suppliers") {
          const q = (url.searchParams.get("q") || "").toLowerCase();
          if (failSuppliers && q) return route.fulfill({ status: 503, json: { detail: "Lỗi tìm nhà cung cấp thử nghiệm" } });
          const data = suppliers.filter(item => item.ten_ncc.toLowerCase().includes(q) || String(item.ma_ncc) === q);
          return ok({ data, total: data.length, filters: {} });
        }
        if (path === "data/products") {
          const q = (url.searchParams.get("q") || "").toLowerCase();
          searches.push(q);
          if (failSearch && q) return route.fulfill({ status: 503, json: { detail: "Lỗi tìm kiếm thử nghiệm" } });
          const data = products.filter(p => [p.ma_sp, p.sku, p.ten_sp].some(v => v.toLowerCase().includes(q)));
          return ok({ data, total: data.length, page: 1, page_size: 10 });
        }
        if (path === "data/receipts") return ok({ data: [header], total: 1, page: 1, page_size: 20, filters: {} });
        if (path === "pricing/preview") {
          const body = request.postDataJSON();
          return ok({ unit_cost: body.unit_cost, markup_rate: "0", profit: "0", pre_tax: body.unit_cost, after_tax: body.unit_cost,
            total_tax: "0", taxes: [], actual_markup: "0", margin: "0", context: { sku: body.sku, markup_rate: "0", taxes: [], catalog: [], current_price: "100.00", version: "a".repeat(64), can_edit: true, history: [] } });
        }
        if (path === "admin/operations/receipts") {
          commands.push(request.postDataJSON());
          header.ma_ncc = commands.at(-1).data.supplier_id;
          return ok({ data: [header], replayed: false });
        }
        if (path === "pricing/receipts/7") return ok({ receipt_id: 7, status: "NHAP", applied: false, version: "b".repeat(64), lines: [] });
        return ok({ data: [], total: 0, filters: {} });
      });
      await page.goto(base + "/data/receipts?workflow=new");
      await page.getByRole("combobox", { name: "Chọn kho", exact: true }).selectOption("2");
      const supplier = page.getByRole("combobox", { name: "Chọn nhà cung cấp", exact: true });
      await supplier.scrollIntoViewIfNeeded();
      const fieldBox = () => supplier.evaluate(element => {
        const r = element.getBoundingClientRect();
        return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
      });
      const supplierBefore = await fieldBox();
      const warehouseBefore = await page.getByRole("combobox", { name: "Chọn kho", exact: true }).evaluate(element => {
        const r = element.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
      });
      await supplier.fill("Alpha");
      await page.getByRole("option", { name: /Mã NCC: 12$/ }).waitFor();
      assert.equal(await page.getByRole("option", { name: /Công ty Alpha/ }).count(), 2);
      assert.deepEqual(await fieldBox(), supplierBefore, "Supplier suggestions never resize the field");
      const warehouseOpen = await page.getByRole("combobox", { name: "Chọn kho", exact: true }).evaluate(element => {
        const r = element.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
      });
      assert.deepEqual(warehouseOpen, warehouseBefore, "Supplier dropdown must not move the warehouse field");
      const supplierPopup = page.getByRole("listbox", { name: "Gợi ý nhà cung cấp" }).locator("..");
      assert.equal(await supplierPopup.evaluate(element => getComputedStyle(element).position), "fixed");
      await page.getByRole("option", { name: /Mã NCC: -5$/ }).click();
      assert.ok((await supplier.inputValue()).includes("Mã NCC: -5"));
      await supplier.fill("NO-SUCH-SUPPLIER");
      await page.getByText("Không tìm thấy nhà cung cấp phù hợp.", { exact: true }).waitFor();
      assert.equal(await supplier.evaluate(element => element.checkValidity()), false);
      failSuppliers = true;
      await supplier.fill("Công ty");
      await page.getByRole("alert").filter({ hasText: "Lỗi tìm nhà cung cấp thử nghiệm" }).waitFor();
      failSuppliers = false;
      await page.getByRole("button", { name: "Thử lại", exact: true }).click();
      await page.getByRole("option", { name: /Mã NCC: 12$/ }).waitFor();
      await supplier.fill("12");
      await page.getByRole("option", { name: /Mã NCC: 12$/ }).waitFor();
      await supplier.press("Enter");
      assert.ok((await supplier.inputValue()).includes("Mã NCC: 12"));
      assert.equal(commands.length, 0, "Supplier keyboard selection does not submit");
      const product = page.getByRole("combobox", { name: "Chọn sản phẩm dòng 1", exact: true });
      await product.scrollIntoViewIfNeeded();
      const measure = () => page.evaluate(() => {
        const box = element => {
          const r = element.getBoundingClientRect();
          return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
        };
        return { product: box(document.querySelector('[role="combobox"][aria-label="Chọn sản phẩm dòng 1"]')),
          price: box(document.querySelector('[aria-label="Giá dòng 1"]')), width: document.documentElement.scrollWidth };
      });
      const layoutBefore = await measure();
      await product.fill("CPU");
      const alpha = page.getByRole("option", { name: /Mã SP: SP1 · SKU: SKU-ALPHA/ });
      await alpha.waitFor();
      const layoutOpen = await measure();
      assert.deepEqual(layoutOpen, layoutBefore, "Opening suggestions must not move or resize the form, other controls, or page");
      const popup = page.getByRole("listbox", { name: "Gợi ý sản phẩm" }).locator("..");
      assert.equal(await popup.evaluate(element => getComputedStyle(element).position), "fixed");
      const inputBox = await product.boundingBox(), popupBox = await popup.boundingBox();
      assert.ok(popupBox.width <= inputBox.width + 1 && popupBox.x >= 0 && popupBox.x + popupBox.width <= width + 1);
      assert.ok(popupBox.y >= 0 && popupBox.y + popupBox.height <= 1001, "Popup stays within the viewport");
      assert.equal(await page.getByRole("option", { name: /CPU Alpha/ }).count(), 2, "Duplicate names are distinguished by product ID and SKU");
      await alpha.click();
      assert.ok((await product.inputValue()).includes("SP1 · SKU-ALPHA"));

      await product.fill("SP2");
      await page.getByRole("option", { name: /Điện thoại Demo A/ }).waitFor();
      await product.press("Enter");
      assert.ok((await product.inputValue()).includes("SP2 · DEMO-SKU"));
      assert.equal(commands.length, 0, "Enter selects a product instead of submitting the receipt");
      await product.fill("SKU-BETA");
      await page.getByRole("option", { name: /SKU: SKU-BETA/ }).waitFor();
      await product.press("ArrowDown");
      await product.press("Enter");
      assert.ok((await product.inputValue()).includes("SP3 · SKU-BETA"));
      assert.deepEqual((await measure()).product, layoutBefore.product, "A long selected product name must not resize the field");

      await product.fill("NO-SUCH-PRODUCT");
      await page.getByText("Không tìm thấy sản phẩm phù hợp.", { exact: true }).waitFor();
      assert.equal(await product.evaluate(input => input.checkValidity()), false, "Free text cannot be submitted as a SKU");
      await page.getByLabel("Giá dòng 1", { exact: true }).fill("100");
      await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
      assert.equal(commands.length, 0);

      failSearch = true;
      await product.fill("Demo");
      await page.getByRole("alert").filter({ hasText: "Lỗi tìm kiếm thử nghiệm" }).waitFor();
      failSearch = false;
      await page.getByRole("button", { name: "Thử lại", exact: true }).click();
      await page.getByRole("option", { name: /Điện thoại Demo A/ }).waitFor();
      await product.press("Escape");
      assert.equal(await page.getByRole("listbox", { name: "Gợi ý sản phẩm" }).count(), 0);

      await product.fill("CPU");
      await alpha.click();
      await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await page.waitForURL(url => url.searchParams.has("key"));
      assert.equal(commands.length, 1);
      assert.equal(commands[0].data.supplier_id, 12, "Persist the selected numeric supplier ID");
      assert.equal(commands[0].data.lines[0].sku, "SKU-ALPHA", "Persist SKU, never product name or product ID");
      assert.ok(searches.includes("cpu") && searches.includes("sp2") && searches.includes("sku-beta"));
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: supplier and product floating suggestions preserve layout; name/code/SKU, duplicate names, keyboard/mouse, validation/retry, correct supplier ID and SKU payload`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
