/** Real Next UI with intercepted HTTP; business SQL runs separately in PostgreSQL. */
const assert = require("node:assert/strict");
const { chromium } = require(
  process.env.PHUB_PLAYWRIGHT_MODULE || "playwright",
);
const base = process.env.PHUB_ADMIN_TEST_URL || "http://localhost:3000";
const column = (name, type = "varchar", extra = {}) => ({
  name,
  type,
  required: false,
  generated: false,
  immutable: false,
  choices: null,
  system: false,
  default: null,
  ...extra,
});
const definitions = {
  orders: [
    "ma_donhang",
    "Đơn hàng",
    [
      column("trang_thai", "varchar", {
        choices: [
          "MOI",
          "XAC_NHAN",
          "DANG_CHUAN_BI",
          "DA_XUAT_KHO",
          "HOAN_THANH",
          "HUY",
        ],
      }),
      column("ma_kh"),
      column("ma_nhan_vien"),
      column("kenh_ban"),
      column("ten_nguoi_nhan"),
      column("thoi_gian_dat"),
    ],
  ],
  receipts: [
    "ma_phieu_nhap",
    "Phiếu nhập",
    [
      column("trang_thai"),
      column("ma_phieu_code"),
      column("ma_ncc", "int"),
      column("ma_kho", "int"),
    ],
  ],
  transfers: [
    "ma_phieu_chuyen",
    "Chuyển kho",
    [
      column("trang_thai"),
      column("ma_kho_xuat", "int"),
      column("ma_kho_nhan", "int"),
    ],
  ],
  products: [
    "ma_sp",
    "Sản phẩm",
    [
      column("sku"),
      column("ten_sp"),
      column("gia_ban_hien_tai", "decimal(18,2)"),
    ],
  ],
  warehouses: ["ma_kho", "Kho", [column("ten_kho")]],
  suppliers: ["ma_ncc", "Nhà cung cấp", [column("ten_ncc")]],
  customers: ["ma_kh", "Khách hàng", [column("ten_kh")]],
  employees: ["ma_nhan_vien", "Nhân viên", [column("ho_ten")]],
};
const resources = Object.entries(definitions).map(
  ([name, [id, title, columns]]) => ({
    name,
    title,
    keys: [id],
    writable: false,
    columns: [
      column(
        id,
        ["ma_kho", "ma_ncc", "ma_phieu_nhap", "ma_phieu_chuyen"].includes(id)
          ? "int"
          : "varchar",
      ),
      ...columns,
    ],
  }),
);
const rows = {
  inventory: [{ ma_kho: -1, sku: "SKU1", so_luong_ton: 5 }],
  orders: [
    {
      ma_donhang: "DH1",
      trang_thai: "MOI",
      ma_kh: null,
      ma_nhan_vien: null,
      kenh_ban: "ONLINE",
      ten_nguoi_nhan: "Khách A",
      thoi_gian_dat: "2026-10-28T01:00:00Z",
    },
  ],
  receipts: [
    {
      ma_phieu_nhap: -5,
      ma_phieu_code: "PN-5",
      trang_thai: "NHAP",
      ma_ncc: -1,
      ma_kho: -1,
    },
  ],
  transfers: [
    {
      ma_phieu_chuyen: -6,
      trang_thai: "NHAP",
      ma_kho_xuat: -1,
      ma_kho_nhan: -2,
    },
  ],
  products: [
    {
      ma_sp: "SP1",
      sku: "SKU1",
      ten_sp: "CPU Test",
      gia_ban_hien_tai: "100.00",
    },
  ],
  warehouses: [
    { ma_kho: -1, ten_kho: "Kho A" },
    { ma_kho: -2, ten_kho: "Kho B" },
  ],
  suppliers: [{ ma_ncc: -1, ten_ncc: "Nhà cung cấp A" }],
  customers: [{ ma_kh: "KH1", ten_kh: "Khách A" }],
  employees: [{ ma_nhan_vien: "NV1", ho_ten: "Admin A" }],
};
(async () => {
  resources.push({
    name: "inventory",
    title: "Tồn kho",
    keys: ["ma_kho", "sku"],
    writable: false,
    columns: [
      column("ma_kho", "int"),
      column("sku"),
      column("so_luong_ton", "int"),
    ],
  });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PHUB_CHROMIUM_EXECUTABLE,
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1500, height: 1000 },
      }),
      errors = [],
      writes = [];
    let timeout = false;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (dialog) => dialog.accept());
    await page.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/backend/")) return route.continue();
      const respond = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      const p = url.pathname.replace("/api/backend/", "");
      if (p === "auth/me")
        return respond({
          account_id: "AD1",
          username: "admin",
          name: "Admin A",
          role: "ADMIN",
          employee_id: "NV1",
        });
      if (p === "data/resources") return respond(resources);
      if (p.startsWith("admin/operations/read/")) {
        const kind = p.split("/").pop();
        if (kind === "settings")
          return respond({
            store_name: "PHUB",
            store_address: "Address",
            store_phone: "090",
            low_stock_threshold: 5,
          });
        if (kind === "search")
          return respond([{ resource: "orders", id: "DH1", title: "Khách A" }]);
        if (kind === "notifications")
          return respond([
            {
              id: "order:DH1",
              title: "Đơn mới DH1",
              resource: "orders",
              key: ["DH1"],
              created_at: "2026-10-28T01:00:00Z",
              read: false,
            },
          ]);
        return respond({ data: [], total: 0 });
      }
      if (p.startsWith("admin/operations/") && request.method() === "POST") {
        const body = request.postDataJSON(),
          key = request.headers()["idempotency-key"];
        assert.match(key, /^[0-9a-f-]{36}$/);
        writes.push({ body, key });
        if (timeout) {
          timeout = false;
          return respond({ detail: "Tạm mất kết nối" }, 503);
        }
        const resource = p.split("/").pop();
        const row = rows[resource]?.[0] || {};
        if (body.action === "confirm")
          row.trang_thai = resource === "orders" ? "XAC_NHAN" : "DA_NHAP";
        if (body.action === "prepare") row.trang_thai = "DANG_CHUAN_BI";
        if (body.action === "dispatch") row.trang_thai = "DA_XUAT_KHO";
        if (body.action === "adjust") row.so_luong_ton = body.data.quantity;
        return respond({ data: [row], replayed: false });
      }
      if (p.startsWith("data/")) {
        const resource = p.split("/")[1],
          data = rows[resource] || [];
        return respond({
          data,
          total: data.length,
          page: Number(url.searchParams.get("page") || 1),
          page_size: Number(url.searchParams.get("page_size") || 20),
          filters: JSON.parse(url.searchParams.get("filters") || "{}"),
        });
      }
      return respond({ detail: "Unexpected fixture endpoint " + p }, 404);
    });
    await page.goto(base + "/data/orders?key=" + encodeURIComponent('["DH1"]'));
    await page
      .getByRole("button", { name: "Xác nhận đơn", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Chuẩn bị hàng", exact: true })
      .waitFor();
    assert.equal(writes.at(-1).body.expected_status, "MOI");
    timeout = true;
    await page
      .getByRole("button", { name: "Chuẩn bị hàng", exact: true })
      .click();
    await page.getByRole("button", { name: "Thử lại cùng yêu cầu" }).waitFor();
    const first = writes.at(-1);
    await page.reload();
    await page.getByRole("button", { name: "Thử lại cùng yêu cầu" }).waitFor();
    await page.getByRole("button", { name: "Thử lại cùng yêu cầu" }).click();
    await page.getByText("Đang chuẩn bị", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Xác nhận xuất kho" }).count(),
      0,
    );
    assert.deepEqual(writes.at(-1), first);
    await page.goto(
      base + "/data/inventory?key=" + encodeURIComponent('[-1,"SKU1"]'),
    );
    await page.getByRole("button", { name: "Kiểm kê / điều chỉnh" }).click();
    await page.getByRole("spinbutton", { name: /Số lượng thực tế/ }).fill("7");
    await page
      .getByRole("textbox", { name: /Lý do chênh lệch/ })
      .fill("Kiểm kê lại hàng nhận");
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await page.getByRole("button", { name: "Kiểm kê / điều chỉnh" }).waitFor();
    assert.equal(writes.at(-1).body.record_id, null);
    assert.equal(writes.at(-1).body.data.expected_quantity, 5);
    await page.goto(base + "/data/receipts?workflow=new");
    await page
      .getByRole("combobox", { name: "Chọn kho", exact: true })
      .selectOption("-1");
    await page
      .getByRole("combobox", { name: "Chọn nhà cung cấp", exact: true })
      .selectOption("-1");
    await page
      .getByRole("combobox", { name: "Chọn sản phẩm dòng 1", exact: true })
      .selectOption("SKU1");
    await page.getByRole("spinbutton", { name: "Số lượng dòng 1" }).fill("3");
    await page.getByRole("spinbutton", { name: "Giá dòng 1" }).fill("50.25");
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await page.waitForURL(/key=/);
    assert.equal(writes.at(-1).body.data.warehouse_id, -1);
    assert.equal(writes.at(-1).body.data.supplier_id, -1);
    assert.equal(writes.at(-1).body.data.lines[0].unit_price, "50.25");
    await page.goto(base + "/data/orders");
    await page.getByText("Bộ lọc", { exact: true }).click();
    await page
      .getByRole("combobox", { name: "Lọc trạng thái", exact: true })
      .selectOption("XAC_NHAN");
    await page.waitForURL(/filters=/);
    assert.equal(
      JSON.parse(new URL(page.url()).searchParams.get("filters")).trang_thai,
      "XAC_NHAN",
    );
    await page
      .getByRole("textbox", { name: "Tìm kiếm toàn hệ thống" })
      .fill("Khách");
    await page
      .getByRole("region", { name: "Kết quả tìm kiếm" })
      .getByRole("link")
      .first()
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/data/receipts?workflow=new");
    await page
      .getByRole("heading", { name: "Lập phiếu nhập", exact: true })
      .waitFor();
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 12)
        .map((e) => ({
          tag: e.tagName,
          class: e.className,
          width: e.getBoundingClientRect().width,
          right: e.getBoundingClientRect().right,
        })),
    );
    if (overflow.length) console.log("Mobile overflow:", overflow);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: status actions, stable retry key/body, signed document IDs, real create form, filters, search and mobile layout.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
