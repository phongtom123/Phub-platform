/** Shared detail toolbars: mocked read-only HTTP, no production/API writes. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const definitions = [
  ["warehouses", "Kho", ["ma_kho"], true],
  ["employees", "Nhân viên", ["ma_nhan_vien"], true],
  ["customers", "Khách hàng", ["ma_kh"], true],
  ["categories", "Loại sản phẩm", ["ma_loai_sp"], true],
  ["subcategories", "Loại sản phẩm con", ["ma_loai_sp_con"], true],
  ["products", "Sản phẩm", ["ma_sp"], true],
  ["suppliers", "Nhà cung cấp", ["ma_ncc"], true],
  ["promotions", "Khuyến mãi", ["ma_ctkm"], true],
  ["vouchers", "Voucher", ["ma_voucher"], true],
  ["inventory", "Tồn kho", ["ma_kho", "sku"], false],
  ["receipts", "Phiếu nhập", ["ma_phieu_nhap"], false],
  ["receipt-lines", "Chi tiết phiếu nhập", ["ma_phieu_nhap", "sku"], false],
  ["transfers", "Chuyển kho", ["ma_phieu_chuyen"], false],
  ["transfer-lines", "Chi tiết chuyển kho", ["ma_phieu_chuyen", "sku"], false],
  ["orders", "Đơn hàng", ["ma_donhang"], false],
  ["order-lines", "Chi tiết đơn hàng", ["ma_ct_donhang"], false],
  ["invoices", "Hóa đơn", ["ma_hoadon"], false],
  ["payments", "Thanh toán", ["ma_thanh_toan"], false],
  ["voucher-uses", "Sử dụng voucher", ["ma_su_dung"], false],
];
const resources = definitions.map(([name, title, keys, writable]) => ({ name, title, keys, writable,
  columns: [...keys, "ten", ...(name === "products" ? ["duong_dan_anh"] : [])].map(key => ({
    name: key, type: "varchar", generated: false, immutable: keys.includes(key), required: key !== "duong_dan_anh", choices: null,
  })),
}));
const account = { ma_tk: "TK1", ten_tai_khoan: "admin.test", email: null, ma_nhan_vien: "NV1", ma_kh: null,
  trang_thai: 1, role: "ADMIN", ho_ten: "Admin Test", ma_kho: null, owner_active: true, is_self: true };

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      assert.equal(request.method(), "GET", "Never write live data in a layout test");
      const respond = data => route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
      if (url.pathname.endsWith("/auth/me")) return respond({ account_id: "TK1", username: "admin.test", role: "ADMIN", name: "Admin Test" });
      if (url.pathname.endsWith("/data/resources")) return respond(resources);
      if (url.pathname === "/api/backend/admin/accounts/TK1") return respond(account);
      if (url.pathname === "/api/backend/admin/accounts") return respond({ data: [account], total: 1, page: 1, page_size: 20 });
      const meta = resources.find(item => url.pathname === "/api/backend/data/" + item.name);
      assert.ok(meta, "Unexpected API: " + url.pathname);
      const row = Object.fromEntries(meta.keys.map(key => [key, "TEST-1"]));
      row.ten = "Bản ghi kiểm thử";
      if (meta.name === "products") row.duong_dan_anh = "/images/figma-mobile/catalog-product-01.png";
      return respond({ data: [row], total: 1, page: 1, page_size: 20 });
    });
    async function assertActions(writable) {
      await page.locator(".live-field").first().waitFor();
      const actions = page.locator(".live-page-actions");
      assert.equal(await actions.count(), 1);
      assert.equal(await actions.getByRole("button", { name: "← Quay lại", exact: true }).count(), 1);
      assert.equal(await page.locator(".live-data h2").count(), 0, "No duplicate detail heading");
      const edit = actions.getByRole("link", { name: "Chỉnh sửa", exact: true });
      assert.equal(await edit.count(), writable ? 1 : 0);
      if (writable) {
        const backBox = await actions.getByRole("button", { name: "← Quay lại", exact: true }).boundingBox();
        const editBox = await edit.boundingBox();
        const actionsBox = await actions.boundingBox();
        const group = actions.locator(".live-page-actions-group");
        const groupBox = await group.count() ? await group.boundingBox() : editBox;
        if (backBox.width + groupBox.width + 12 <= actionsBox.width + 1) {
          assert.ok(Math.abs(backBox.y - editBox.y) < 1, "Back and edit must share the same row when the action group fits");
        } else assert.ok(backBox.y < editBox.y, "Narrow screens wrap the complete action group below back");
        assert.ok(Math.abs(backBox.x - actionsBox.x) < 1, "Back must align with the left edge");
        assert.ok(Math.abs(editBox.x + editBox.width - actionsBox.x - actionsBox.width) < 1, "Edit must align with the right edge");
      }
    }
    for (const meta of resources) {
      await page.goto(base + "/data/" + meta.name + "?key=" + encodeURIComponent(JSON.stringify(meta.keys.map(() => "TEST-1"))));
      await assertActions(meta.writable);
    }
    await page.goto(base + "/accounts/TK1"); await assertActions(true);
    await page.locator(".live-page-actions").getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    await page.getByLabel("Tên đăng nhập TK1", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/accounts");
    await page.getByLabel("Tên đăng nhập TK1", { exact: true }).press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/accounts/TK1"); await assertActions(true);
    await page.goto(base + "/data/products?key=%5B%22TEST-1%22%5D"); await assertActions(true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-page-actions-mobile.png"), fullPage: true });
    await page.locator(".live-page-actions").getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    await page.getByRole("button", { name: "Lưu dữ liệu", exact: true }).waitFor();
    assert.equal(await page.locator(".live-page-actions").getByRole("link", { name: "Chỉnh sửa", exact: true }).count(), 0);
    await page.getByRole("link", { name: "Hủy", exact: true }).click(); await assertActions(true);
    await page.goto(base + "/data/products");
    await page.getByRole("heading", { name: "Sản phẩm", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: all 19 generic detail modules + account detail; no duplicate heading; back left/edit right on the same row on desktop/mobile; read-only has no edit; edit/cancel and list/form headings preserved. No live writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
