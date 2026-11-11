const assert = require("node:assert/strict");
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || "playwright");

const base = process.env.PHUB_STAFF_TEST_URL || "http://localhost:3002";
const column = (name, type = "varchar") => ({
  name, type, required: false, generated: false, immutable: true,
  choices: null, system: false, default: null,
});

const resources = [
  {
    name: "invoices", title: "Hóa đơn", keys: ["ma_hoadon"], writable: false,
    // Mirrors the new schema: deadline fields were added before the identifiers.
    columns: [
      column("han_thanh_toan", "timestamptz"), column("huy_qua_han_luc", "timestamptz"),
      column("ma_hoadon"), column("ma_donhang"), column("thoi_gian_lap", "datetime"),
      column("ten_nguoi_mua"), column("ma_so_thue"), column("dia_chi_nguoi_mua"),
      column("tong_tien_giam", "decimal(18,2)"), column("tong_tien_truoc_thue", "decimal(18,2)"),
      column("tong_tien_thue", "decimal(18,2)"), column("tong_tien_sau_thue", "decimal(18,2)"),
      column("nguoi_lap"), column("nguon_lap"), column("ma_tk_lap"),
    ],
  },
  {
    name: "payments", title: "Thanh toán", keys: ["ma_thanh_toan"], writable: false,
    columns: [
      column("thoi_gian", "datetime"), column("la_bypass", "boolean"), column("ma_tk_ghi_nhan"),
      column("ma_thanh_toan", "int"), column("ma_donhang"), column("so_tien", "decimal(18,2)"),
      column("loai_giao_dich"), column("phuong_thuc"), column("trang_thai"), column("ma_giao_dich"),
    ],
  },
];

const rows = {
  invoices: [{
    han_thanh_toan: "2026-11-10T00:00:00Z", huy_qua_han_luc: null,
    ma_hoadon: "HD-1", ma_donhang: "DH-1", thoi_gian_lap: "2026-11-09T00:00:00Z",
    ten_nguoi_mua: "Khách thử", ma_so_thue: null, dia_chi_nguoi_mua: "TP.HCM",
    tong_tien_giam: "0.00", tong_tien_truoc_thue: "100000.00", tong_tien_thue: "8000.00",
    tong_tien_sau_thue: "108000.00", nguoi_lap: null, nguon_lap: "TU_DONG", ma_tk_lap: "TK-1",
  }],
  payments: [{
    thoi_gian: "2026-11-09T00:05:00Z", la_bypass: false, ma_tk_ghi_nhan: null,
    ma_thanh_toan: 1, ma_donhang: "DH-1", so_tien: "108000.00", loai_giao_dich: "THU",
    phuong_thuc: "CHUYEN_KHOAN", trang_thai: "THANH_CONG", ma_giao_dich: "GD-1",
  }],
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage({ viewport: { width: 1800, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const reply = body => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname.endsWith("/auth/me")) return reply({
        account_id: "NV1", username: "staff", name: "Nhân viên", role: "NHAN_VIEN", warehouse_id: 1,
      });
      if (url.pathname.endsWith("/data/resources")) return reply(resources);
      if (url.pathname.endsWith("/admin/operations/read/settings")) return reply({ store_name: "PHUB", store_address: "", store_phone: "" });
      if (url.pathname.endsWith("/data/order-lines")) return reply({
        data: [{ ma_ct_donhang: 1, ma_donhang: "DH-1", sku: "SKU-1", ten_sp_luc_ban: "Sản phẩm thử", so_luong: 1,
          don_gia: "100000.00", giam_gia: "0.00", giam_gia_voucher: "0.00", tien_thue: "8000.00", thanh_tien: "108000.00" }],
        total: 1, page: 1, page_size: 100, order_id: "DH-1",
      });
      const resource = resources.find(item => url.pathname.endsWith(`/data/${item.name}`));
      assert.ok(resource, `Unexpected API: ${url.pathname}`);
      return reply({ data: rows[resource.name], total: 1, page: 1, page_size: 20 });
    });

    const headers = async resource => {
      await page.goto(`${base}/data/${resource}`);
      try {
        await page.locator("tbody tr").first().waitFor();
      } catch (error) {
        throw new Error(`${error.message}\nURL: ${page.url()}\nPage errors: ${pageErrors.join(" | ")}\nBody: ${(await page.locator("body").innerText()).slice(0, 2000)}`);
      }
      return page.locator("thead th").allTextContents();
    };

    assert.deepEqual(await headers("invoices"), [
      "Mã hóa đơn", "Mã đơn hàng", "Tên người mua", "Mã số thuế", "Địa chỉ người mua",
      "Tổng trước thuế", "Tiền thuế", "Tổng sau thuế", "Nguồn lập", "Người lập",
      "Tài khoản kích hoạt hóa đơn", "Thời gian lập", "Hạn thanh toán (đơn online)", "Hệ thống hủy quá hạn lúc", "Thao tác",
    ]);
    await page.getByRole("link", { name: "HD-1", exact: true }).click();
    const deadlineField = page.locator(".live-field").filter({ hasText: "Hạn thanh toán (đơn online)" });
    await deadlineField.waitFor();
    assert.match(await deadlineField.innerText(), /10\/11\/2026/);
    assert.ok(!(await deadlineField.innerText()).includes("2026-11-10T00:00:00Z"), "deadline must be shown as a local date, not a raw timestamp");
    assert.deepEqual(await headers("payments"), [
      "Mã thanh toán", "Mã đơn hàng", "Mã giao dịch", "Loại giao dịch", "Phương thức",
      "Số tiền", "Trạng thái", "Ghi nhận trực tiếp", "Tài khoản yêu cầu ghi nhận", "Thời gian", "Thao tác",
    ]);
    console.log("PASS: billing tables keep identifiers and related fields first, deadlines last.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
