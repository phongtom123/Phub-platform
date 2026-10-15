/** Real forms with mocked HTTP only. Never uploads to live Storage or writes a real DB. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAE0lEQVR4nGMUWcGAFTBhF6aPBABw3gDIyPtx/AAAAABJRU5ErkJggg==", "base64");
const savedUrl = "https://media.example.test/storage/v1/object/public/media/products/test.webp";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], uploads = [], writes = [];
    let uploadStatus = 201, failSave = false;
    const record = { ma_sp: "SP1", ten_sp: "Sản phẩm test", duong_dan_anh: "https://media.example.test/old.png" };
    const column = (name, required, immutable = false) => ({ name, type: "varchar", required, immutable, generated: false, default: null, choices: null });
    const columns = [column("ma_sp", true, true), column("ten_sp", true), column("duong_dan_anh", false)];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname === "media.example.test") return route.fulfill({ contentType: "image/png", body: png });
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname.endsWith("/auth/me")) return respond({ account_id: "TK1", username: "admin", name: "Admin Test", role: "ADMIN" });
      if (url.pathname.endsWith("/admin/media/images")) {
        assert.equal(request.method(), "POST");
        assert.equal(request.headers()["content-type"], "image/png");
        assert.deepEqual(request.postDataBuffer(), png);
        uploads.push(request.url());
        return uploadStatus === 201 ? respond({ url: savedUrl }, 201) : respond({ detail: "Storage tạm thời không khả dụng." }, uploadStatus);
      }
      if (url.pathname.endsWith("/data/resources")) return respond([{ name: "products", title: "Sản phẩm", keys: ["ma_sp"], columns, writable: true }]);
      if (url.pathname.endsWith("/data/products")) {
        if (request.method() !== "GET") {
          const body = request.postDataJSON(); writes.push(body);
          if (failSave) return respond({ detail: "Lưu sản phẩm thất bại." }, 503);
          Object.assign(record, body);
        }
        return respond({ data: [record], total: 1, page: 1, page_size: 20 });
      }
      throw new Error("Unexpected API: " + request.url());
    });
    const edit = base + "/data/products?key=%5B%22SP1%22%5D&edit=1";
    const fileInput = () => page.getByLabel("Chọn file ảnh sản phẩm", { exact: true });
    const save = () => page.getByRole("button", { name: "Lưu dữ liệu", exact: true });
    const pick = () => fileInput().setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
    const showEdit = async () => { await page.goto(edit); await save().waitFor(); };
    async function drop(files) {
      await page.locator(".image-dropzone").evaluate((element, files) => {
        const transfer = new DataTransfer();
        for (const file of files) transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
        element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      }, files);
    }
    // Create/cancel: preview only; choosing a file must not upload prematurely.
    await page.goto(base + "/data/products?new=1"); await save().waitFor();
    await pick(); await page.getByText(/Đã chọn: test.png/).waitFor();
    await page.waitForFunction(() => document.querySelector(".image-preview img")?.naturalWidth === 8);
    assert.equal(uploads.length, 0);
    await page.getByRole("link", { name: "Hủy", exact: true }).click(); await page.locator(".live-table").waitFor();
    assert.equal(uploads.length, 0); assert.equal(writes.length, 0);

    await showEdit();
    await fileInput().setInputFiles({ name: "bad.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await page.getByText("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.", { exact: true }).waitFor();
    await fileInput().setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
    await page.getByText("Chọn ảnh không rỗng, dung lượng tối đa 5 MB.", { exact: true }).waitFor();
    await drop([{ name: "a.png", type: "image/png", bytes: [...png] }, { name: "b.png", type: "image/png", bytes: [...png] }]);
    await page.getByText(/Mỗi sản phẩm chỉ hỗ trợ một ảnh/).waitFor();
    assert.equal(uploads.length, 0);

    await drop([{ name: "drop.png", type: "image/png", bytes: [...png] }]);
    await page.getByText(/Đã chọn: drop.png/).waitFor();
    uploadStatus = 503;
    await save().click(); await page.getByText("Storage tạm thời không khả dụng.", { exact: true }).waitFor();
    assert.equal(writes.length, 0, "Upload failure must not write the product");
    assert.equal(await page.getByLabel(/^Tên sản phẩm/).inputValue(), "Sản phẩm test");
    assert.equal(await fileInput().count(), 1, "Keep the form on upload error");
    uploadStatus = 201; failSave = true;
    await save().click(); await page.getByText("Lưu sản phẩm thất bại.", { exact: true }).waitFor();
    const uploaded = uploads.length;
    assert.equal(await page.getByLabel("Hoặc nhập URL hình ảnh", { exact: true }).inputValue(), savedUrl);
    failSave = false;
    await save().click(); await page.locator(".live-field").first().waitFor();
    assert.equal(uploads.length, uploaded, "Retry product save reuses uploaded URL");
    assert.equal(record.duong_dan_anh, savedUrl);
    await page.waitForFunction(() => document.querySelector(".product-image-card img")?.naturalWidth === 8);

    await showEdit();
    await page.getByRole("button", { name: "Gỡ ảnh khỏi sản phẩm", exact: true }).click();
    await save().click(); await page.locator(".live-field").first().waitFor();
    assert.equal(record.duong_dan_anh, null); assert.equal(uploads.length, uploaded);
    await page.getByText("Sản phẩm chưa có hình ảnh.", { exact: true }).waitFor();
    await showEdit();
    await page.getByLabel("Hoặc nhập URL hình ảnh", { exact: true }).fill("https://media.example.test/external.png");
    await save().click(); await page.locator(".live-field").first().waitFor();
    assert.equal(record.duong_dan_anh, "https://media.example.test/external.png");
    assert.equal(uploads.length, uploaded);

    // The same uploader works on product creation and remains usable on mobile.
    await page.goto(base + "/data/products?new=1"); await save().waitFor();
    await page.getByLabel(/^Mã sản phẩm/).fill("SP2");
    await page.getByLabel(/^Tên sản phẩm/).fill("Sản phẩm mới"); await pick();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".main")).paddingLeft === "0px");
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-media-mobile.png"), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await save().click(); await page.locator(".live-field").first().waitFor();
    assert.equal(record.ma_sp, "SP2"); assert.equal(record.duong_dan_anh, savedUrl);
    assert.equal(uploads.length, uploaded + 1);
    await page.waitForFunction(() => document.querySelector(".product-image-card img")?.naturalWidth === 8);

    // Detail BEFORE edit: resolve real shared public assets without a customer dev server.
    const detail = base + "/data/products?key=%5B%22SP2%22%5D";
    record.duong_dan_anh = "/images/figma-mobile/catalog-product-01.png";
    await page.goto(detail);
    await page.waitForFunction(() => document.querySelector(".product-image-card img")?.naturalWidth > 0);
    const openImage = page.getByRole("button", { name: "Xem ảnh gốc", exact: true });
    const dialog = page.getByRole("dialog", { name: "Ảnh gốc Sản phẩm mới", exact: true });
    const pagesBefore = page.context().pages().length;
    const urlBefore = page.url();
    await openImage.click(); await dialog.waitFor();
    await page.waitForFunction(() => document.querySelector(".product-image-viewer img")?.naturalWidth > 0);
    assert.equal(page.context().pages().length, pagesBefore, "Viewer must not open a tab");
    assert.equal(page.url(), urlBefore, "Viewer must stay on the product page");
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    assert.equal(await openImage.evaluate(element => element === document.activeElement), true);
    await openImage.click(); await dialog.waitFor();
    await page.getByRole("button", { name: "Đóng ảnh", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-product-detail-preview.png"), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".product-detail-layout")).gridTemplateColumns.split(" ").length === 2);
    await page.waitForFunction(() => document.querySelector(".main").getAnimations().every(animation => animation.playState !== "running"));
    const layout = await page.locator(".product-detail-layout").evaluate(element => {
      const image = element.querySelector(".product-image-card").getBoundingClientRect();
      const info = element.querySelector(".live-form").getBoundingClientRect();
      const thumb = element.querySelector(".product-image-thumb").getBoundingClientRect();
      const picture = element.querySelector(".product-image-thumb img").getBoundingClientRect();
      return { width: image.width, sameRow: Math.abs(image.top - info.top) < 1, sideBySide: info.left >= image.right,
        centered: Math.abs((picture.left + picture.right) / 2 - (thumb.left + thumb.right) / 2) < 1 && Math.abs((picture.top + picture.bottom) / 2 - (thumb.top + thumb.bottom) / 2) < 1 };
    });
    assert.ok(layout.width <= 340 && layout.sameRow && layout.sideBySide && layout.centered, JSON.stringify(layout));
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-product-detail-balanced.png"), fullPage: true });
    await openImage.click(); await dialog.waitFor();
    await page.waitForFunction(() => {
      const image = document.querySelector(".product-image-viewer img");
      return image?.naturalWidth > 0 && image.getBoundingClientRect().height > 0;
    });
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "phub-product-image-viewer.png") });
    await page.mouse.click(2, 2); await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.body.style.overflow !== "hidden");
    assert.equal((await page.request.get(base + "/images/figma-mobile/catalog-product-01.png")).status(), 200);
    assert.equal((await page.request.get(base + "/images/figma-mobile/%2e%2e%2fpackage.json")).status(), 404);
    assert.equal((await page.request.get(base + "/images/package.json")).status(), 404);
    record.duong_dan_anh = "/images/not-a-real-image.png";
    await page.goto(detail);
    await page.getByText("Không tải được ảnh sản phẩm.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Thử tải lại ảnh", exact: true }).click();
    await page.getByText("Không tải được ảnh sản phẩm.", { exact: true }).waitFor();
    record.duong_dan_anh = "javascript:alert(1)";
    await page.goto(detail);
    await page.getByText("Không tải được ảnh sản phẩm.", { exact: true }).waitFor();
    assert.equal(await page.locator(".product-image-card img, .product-image-card a").count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: upload forms + detail preview (Supabase URL, real shared relative asset, empty/broken/retry/unsafe URL, mobile); static asset route rejects traversal/non-image files; no live writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
