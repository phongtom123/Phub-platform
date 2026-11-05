/** Real Next UI, mocked APIs only. Never writes production data. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const column = (name, options = {}) => ({ name, type: "varchar", required: false, immutable: false, generated: false, choices: null, default: null, ...options });
const resources = [
  { name: "customers", title: "Khách hàng", keys: ["ma_kh"], writable: true, columns: [column("ma_kh", { immutable: true }), column("ten_kh", { required: true }), column("sdt"), column("dia_chi_chi_tiet_md"), column("tinh_thanh_md"), column("xa_phuong_md")] },
  { name: "warehouses", title: "Kho", keys: ["ma_kho"], writable: true, columns: [column("ma_kho", { type: "int", generated: true, immutable: true }), column("ten_kho", { required: true }), column("dia_chi", { required: true }), column("trang_thai", { type: "int", required: true })] },
  { name: "orders", title: "Đơn hàng", keys: ["ma_donhang"], writable: false, columns: [column("ma_donhang"), column("kenh_ban")] },
  { name: "categories", title: "Loại sản phẩm", keys: ["ma_loai_sp"], writable: true, columns: [column("ma_loai_sp", {immutable:true}), column("ten_loai_sp", {required:true}), column("trang_thai", {type:"int",required:true})] },
  { name: "products", title: "Sản phẩm", keys: ["ma_sp"], writable: true, columns: [
    column("ma_sp", { immutable: true }), column("sku", { immutable: true }), column("ten_sp", { required: true }),
    column("ma_loai_sp"), column("thuong_hieu"), column("gia_ban_hien_tai", { type: "decimal(18,2)", required: true }),
    column("mo_ta", { type: "text" }), column("duong_dan_anh"), column("thong_so_ky_thuat", { type: "text" }),
    column("don_vi", { required: true }), column("bao_hanh_thang", { type: "int", required: true }), column("trang_thai", { type: "int", required: true }),
  ] },
];
const data = {
  customers: [{ ma_kh: "KH1", ten_kh: "Khách thứ nhất", sdt: null, dia_chi_chi_tiet_md: null, tinh_thanh_md: "Hà Nội", xa_phuong_md: null }, { ma_kh: "KH2", ten_kh: "Khách thứ hai", sdt: "0123456789", dia_chi_chi_tiet_md: null, tinh_thanh_md: null, xa_phuong_md: null }],
  warehouses: [{ ma_kho: -900001, ten_kho: "Kho một", dia_chi: "Hà Nội", trang_thai: 1 }, { ma_kho: 2, ten_kho: "Kho hai", dia_chi: "Đà Nẵng", trang_thai: 1 }],
  orders: [{ ma_donhang: "DH1", kenh_ban: "ONLINE" }],
  categories: [{ma_loai_sp:"L1",ten_loai_sp:"Linh kiện",trang_thai:1}],
  products: [{ ma_sp: "SP1", sku: "SKU-1", ten_sp: "Bàn phím", ma_loai_sp: "L1", thuong_hieu: "Test Brand",
    gia_ban_hien_tai: "1790000.00", mo_ta: "Mô tả giữ nguyên", duong_dan_anh: "/original-image.png", thong_so_ky_thuat: "Thông số giữ nguyên",
    don_vi: "Cái", bao_hanh_thang: 12, trang_thai: 1 }],
};
for (let index = 2; index <= 30; index++) data.products.push({ ...data.products[0], ma_sp: `SP${index}`, sku: `SKU-${index}` });

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1100 } });
    const errors = [], writes = [], reads = { documents: 0, rsc: 0, session: 0, metadata: 0, data: 0 };
    let failNext = false, holdNext = false, held, readOnly = false;
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) reads.documents++;
      if (new URL(request.url()).searchParams.has("_rsc")) reads.rsc++;
    });
    const respond = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      if (url.pathname.endsWith("/auth/me")) { reads.session++; return respond(route, { account_id: "AD1", username: "admin", name: "Admin Test", role: "ADMIN" }); }
      if (url.pathname === "/api/backend/crm/customers/KH1") return respond(route, { profile: {
        ...data.customers[0], ngay_sinh: null, ngay_tao: null, cap_nhat_luc: null, luu_tru_luc: null,
      }, account: null });
      if (url.pathname.endsWith("/data/resources")) { reads.metadata++; return respond(route, resources.map(resource => ({ ...resource, writable: readOnly ? false : resource.writable }))); }
      const resource = resources.find(item => url.pathname === "/api/backend/data/" + item.name);
      assert.ok(resource, request.url());
      const key = url.searchParams.get("key");
      const rows = key ? data[resource.name].filter(row => JSON.stringify(resource.keys.map(name => row[name])) === key) : data[resource.name];
      if (request.method() === "PATCH") {
        assert.equal(readOnly, false); assert.equal(resource.writable, true);
        const patch = request.postDataJSON();
        assert.ok(resource.keys.every(key => !(key in patch)), "PK must never be sent");
        writes.push({ resource: resource.name, key: JSON.parse(key), patch });
        if (holdNext) { holdNext = false; held = { route, row: rows[0], patch }; return; }
        if (failNext) { failNext = false; return respond(route, { detail: "Lỗi lưu kiểm thử." }, 503); }
        Object.assign(rows[0], patch);
        return respond(route, { data: rows });
      }
      assert.equal(request.method(), "GET"); reads.data++;
      return respond(route, { data: rows, total: 42, page: 1, page_size: 20 });
    });
    const row = id => page.locator("tbody tr").filter({ has: page.getByRole("link", { name: id, exact: true }) });
    const outside = () => page.locator("thead th").last().click();
    const waitSaved = () => page.getByRole("status").filter({ hasText: "Đã lưu thay đổi." }).waitFor();
    const edit = async (id, field) => { await row(id).locator(`[data-field="${field}"]`).dblclick(); };
    const assertNoButtons = async () => {
      assert.equal(await page.locator("tbody button").count(), 0);
      assert.equal(await page.getByRole("link", { name: "Sửa", exact: true }).count(), 0);
    };

    await page.goto(base + "/data/customers"); await row("KH1").waitFor();
    await assertNoButtons();
    assert.equal(await page.getByText(/Nguồn: API Python|Chế độ chỉ xem dữ liệu thật/).count(), 0);
    assert.equal(await page.locator("h2").evaluate(element => element.getBoundingClientRect().width <= 1), true);
    const widthBefore = await page.locator(".live-table").evaluate(element => element.getBoundingClientRect().width);
    await page.getByRole("button", { name: "Đóng mở thanh điều hướng", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".main").getAnimations().every(animation => animation.playState !== "running"));
    const geometry = await page.locator(".live-table").evaluate(element => {
      const bounds = element.getBoundingClientRect(); return { width: bounds.width, rightGap: innerWidth - bounds.right };
    });
    assert.ok(Math.abs(geometry.width - widthBefore - 190) < 2, JSON.stringify({ widthBefore, geometry }));
    assert.ok(geometry.rightGap <= 40, "No unused max-width whitespace on wide screens");
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-customers-collapsed.png"), fullPage: true });

    await edit("KH1", "ten_kh");
    const firstRow = await row("KH1").elementHandle(), otherRow = await row("KH2").elementHandle();
    const name = page.getByLabel("Tên khách hàng KH1", { exact: true });
    const phone = page.getByLabel("Số điện thoại KH1", { exact: true });
    const before = { ...reads };
    await name.fill("Tên khách mới"); await phone.fill("0012345678"); await outside(); await waitSaved();
    assert.deepEqual(writes.at(-1).patch, { ten_kh: "Tên khách mới", sdt: "0012345678" });
    assert.deepEqual(reads, before, "Inline save must not refetch session/list/metadata/document/RSC");
    for (const node of [firstRow, otherRow]) assert.equal(await node.evaluate(node => node.isConnected), true);
    await edit("KH1", "sdt"); await phone.fill(""); await phone.press("Enter"); await waitSaved();
    assert.deepEqual(writes.at(-1).patch, { sdt: null });
    let count = writes.length;
    await edit("KH1", "ten_kh"); await outside(); assert.equal(writes.length, count);
    await edit("KH1", "ten_kh"); await name.fill("Hủy thay đổi"); await name.press("Escape"); assert.equal(writes.length, count);
    await edit("KH1", "ten_kh"); await name.fill(" "); await outside(); await page.locator('.live-error[role="alert"]').waitFor();
    assert.equal(writes.length, count); assert.equal(await name.count(), 1);
    failNext = true; await name.fill("Thử lại tên"); await outside(); await page.getByText("Lỗi lưu kiểm thử.", { exact: true }).waitFor();
    assert.equal(await name.inputValue(), "Thử lại tên"); assert.equal(writes.length, ++count);
    await name.press("Enter"); await waitSaved(); assert.equal(writes.length, ++count);

    // Navigation waits for the pending save and must not replay the write.
    await edit("KH1", "ten_kh"); await name.fill("Lưu trước chi tiết"); holdNext = true; held = null;
    await row("KH1").getByRole("link", { name: "Chi tiết", exact: true }).click();
    for (let i = 0; !held && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(held); assert.equal(new URL(page.url()).searchParams.has("key"), false);
    assert.equal(await page.getByRole("button", { name: "Sau", exact: true }).isDisabled(), true);
    await page.locator("thead th").last().click(); assert.equal(writes.length, ++count);
    Object.assign(held.row, held.patch); await respond(held.route, { data: [held.row] });
    await page.waitForURL(url => url.searchParams.has("key")); await page.locator(".live-field").first().waitFor();
    assert.equal(await page.getByRole("heading", { name: "Lưu trước chi tiết", exact: true }).count(), 1);

    await page.goto(base + "/data/warehouses"); await row("-900001").waitFor(); await assertNoButtons();
    await edit("-900001", "ten_kho"); await page.getByLabel("Tên kho -900001", { exact: true }).fill("Kho sửa trực tiếp");
    await outside(); await waitSaved(); assert.deepEqual(writes.at(-1).key, [-900001]);
    assert.deepEqual(writes.at(-1).patch, { ten_kho: "Kho sửa trực tiếp" });
    const status = page.getByLabel("Trạng thái -900001", { exact: true });
    page.on("dialog", dialog => dialog.accept());
    const statusReads = { ...reads };
    await status.selectOption("2"); await waitSaved(); assert.equal(await status.inputValue(), "2");
    assert.deepEqual(writes.at(-1).patch, { trang_thai: 2 }); assert.deepEqual(reads, statusReads);
    failNext = true; await status.selectOption("1"); await page.getByText("Lỗi lưu kiểm thử.", { exact: true }).waitFor();
    assert.equal(await status.inputValue(), "2");
    await status.selectOption("1"); await waitSaved(); assert.equal(await status.inputValue(), "1");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector(".main").getAnimations().every(animation => animation.playState !== "running"));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-warehouses-inline-mobile.png"), fullPage: true });

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto(base + "/data/products"); await row("SP1").waitFor();
    const rail = page.getByRole("region", { name: "Cuộn ngang bảng", exact: true });
    await rail.waitFor();
    await rail.evaluate(element => { element.scrollLeft = 200; });
    await page.waitForFunction(() => Math.abs(document.querySelector('[data-table-scrollbar]').scrollLeft - document.querySelector('.live-table').scrollLeft) < 1);
    assert.ok(await page.locator('.live-table').evaluate(element => element.scrollLeft > 0));
    await page.locator('.live-table').evaluate(element => { element.scrollLeft = 100; });
    await page.waitForFunction(() => Math.abs(document.querySelector('[data-table-scrollbar]').scrollLeft - 100) < 1);
    await page.evaluate(() => scrollTo(0, document.querySelector('.live-table').getBoundingClientRect().top + scrollY + 300));
    assert.ok(Math.abs((await rail.boundingBox()).y - 72) < 2, 'Top scrollbar stays below the header midway through the table');
    assert.ok(await page.locator('.live-table').evaluate(element => element.getBoundingClientRect().bottom > innerHeight), 'Bottom scrollbar remains below the viewport');
    await rail.press('End');
    await page.waitForFunction(() => {
      const element = document.querySelector('.live-table');
      return Math.abs(element.scrollLeft - (element.scrollWidth - element.clientWidth)) < 2;
    });
    await rail.press('Home');
    const headers = await page.locator("thead th").allTextContents();
    assert.ok(!headers.includes("Mô tả")); assert.ok(!headers.includes("URL hình ảnh"));
    assert.equal(await page.getByRole("button", { name: "Sửa nhanh", exact: true }).count(), 0);
    await edit("SP1", "ten_sp");
    for (const field of ["ma_sp", "sku", "ma_loai_sp", "thong_so_ky_thuat"]) assert.equal(await row("SP1").locator(`[data-field="${field}"] input`).count(), 0);
    const price = page.getByLabel("Giá bán SP1", { exact: true });
    const productName = page.getByLabel("Tên sản phẩm SP1", { exact: true });
    const beforeScrolling = writes.length;
    await productName.fill("Bản nháp khi cuộn");
    await rail.click({ position: { x: 100, y: 4 } });
    await rail.press('End');
    assert.equal(writes.length, beforeScrolling, 'Using the top scrollbar must not auto-save a draft');
    assert.equal(await productName.inputValue(), "Bản nháp khi cuộn");
    await productName.fill("Bàn phím mới"); await price.fill("9999999999999999.99");
    await row("SP1").getByRole("button", { name: "Lưu", exact: true }).click(); await waitSaved();
    assert.deepEqual(writes.at(-1).patch, { ten_sp: "Bàn phím mới", gia_ban_hien_tai: "9999999999999999.99" });
    assert.equal(data.products[0].mo_ta, "Mô tả giữ nguyên"); assert.equal(data.products[0].duong_dan_anh, "/original-image.png");
    const productWrites = writes.length;
    await edit("SP1", "ten_sp");
    await productName.fill("Hủy tên"); await row("SP1").getByRole("button", { name: "Hủy", exact: true }).click();
    assert.equal(writes.length, productWrites);
    await edit("SP1", "gia_ban_hien_tai"); await price.fill("-1"); await price.press("Enter");
    await page.getByRole("alert").filter({ hasText: "không âm" }).waitFor(); assert.equal(writes.length, productWrites);
    failNext = true; await price.fill("2000000"); await price.press("Enter");
    await page.getByRole("alert").filter({ hasText: "Lỗi lưu kiểm thử" }).waitFor(); assert.equal(await price.inputValue(), "2000000");
    await price.press("Enter"); await waitSaved(); assert.equal(data.products[0].gia_ban_hien_tai, "2000000");
    await page.getByLabel("Trạng thái SP1", { exact: true }).selectOption("2"); await waitSaved();
    assert.deepEqual(writes.at(-1).patch, { trang_thai: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector(".main").getAnimations().every(animation => animation.playState !== "running"));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await row("SP1").getByRole("link", { name: "Chi tiết", exact: true }).click();
    await page.locator(".live-field").filter({ hasText: "Mô tả giữ nguyên" }).waitFor();
    await page.locator(".live-field").filter({ hasText: "/original-image.png" }).waitFor();
    await page.locator(".live-field").filter({ hasText: "Trạng thái" }).filter({ hasText: "Tạm ngưng" }).waitFor();
    await page.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    const formStatus = page.getByRole("combobox", { name: /Trạng thái/ });
    await formStatus.waitFor();
    assert.deepEqual(await formStatus.locator("option").allTextContents(), ["Chọn trạng thái", "Hoạt động", "Tạm ngưng", "Đã ẩn"]);
    assert.equal(await formStatus.inputValue(), "2");
    await formStatus.selectOption({ label: "Đã ẩn" });
    await page.getByRole("button", { name: "Lưu dữ liệu", exact: true }).click(); await waitSaved();
    assert.deepEqual(writes.at(-1).patch, { trang_thai: 0 });
    await page.getByRole("link", { name: "Xem chi tiết", exact: true }).click();
    await page.locator(".live-field").filter({ hasText: "Trạng thái" }).filter({ hasText: "Đã ẩn" }).waitFor();
    await page.goto(base + "/data/categories"); await row("L1").waitFor(); await assertNoButtons();
    await edit("L1", "ten_loai_sp");
    assert.equal(await row("L1").locator('[data-field="ma_loai_sp"] input').count(),0);
    await page.getByLabel("Tên loại sản phẩm L1",{exact:true}).fill("Linh kiện máy tính");
    await outside(); await waitSaved();
    assert.deepEqual(writes.at(-1),{resource:"categories",key:["L1"],patch:{ten_loai_sp:"Linh kiện máy tính"}});
    await page.getByLabel("Trạng thái L1",{exact:true}).selectOption("2"); await waitSaved();
    assert.deepEqual(writes.at(-1).patch,{trang_thai:2});
    readOnly = true; await page.goto(base + "/data/categories"); await row("L1").waitFor();
    assert.equal(await page.locator("tbody select").count(),0);
    await page.goto(base + "/data/products"); await row("SP1").waitFor();
    assert.equal(await page.getByRole("button", { name: "Sửa nhanh", exact: true }).count(), 0);
    await page.goto(base + "/data/warehouses"); await row("-900001").waitFor();
    await row("-900001").locator("td").nth(1).dblclick();
    assert.equal(await page.locator("tbody input, tbody select").count(), 0);
    await page.goto(base + "/data/orders"); await row("DH1").waitFor();
    await page.setViewportSize({width:1600,height:1000});
    await page.waitForFunction(() => document.querySelector('[data-table-scrollbar]').hidden);
    assert.equal(await page.getByText(/Nguồn: API Python|Chế độ chỉ xem dữ liệu thật/).count(), 0);
    assert.equal(await page.locator("tbody input, tbody select").count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: customer/warehouse inline editing; product hidden columns, quick edit/save/cancel, exact decimal prices, validation/retry, protected identifiers, status updates, full details, read-only permissions and mobile. Mocked API writes only.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
