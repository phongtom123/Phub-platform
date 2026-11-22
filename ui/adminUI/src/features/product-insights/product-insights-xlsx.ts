import type ExcelJSNamespace from "exceljs";
import type { Workbook, Worksheet } from "exceljs";
import type { BreakdownItem, CategoryStat, ProductInvoiceReport, StockListItem } from "./product-insights-data";

type ExcelJS = typeof ExcelJSNamespace;

// Amounts stay numeric (so Excel can sum/filter them) but always display in full, never as 2.01E+11.
const MONEY = '#,##0 "đ"';
const INTEGER = "#,##0";
const PERCENT = "0.0%";
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEEF7EA" } };
const PERIOD_NAMES = { day: "Theo ngày", month: "Theo tháng", quarter: "Theo quý", year: "Theo năm" } as const;
const PRODUCT_STATUS: Record<number, string> = { 1: "Đang bán", 2: "Tạm ngưng", 0: "Đã ẩn" };

type Column = { header: string; width: number; format?: string };

const money = (value: string) => Number(value);
const share = (percentage: number) => percentage / 100;

/** A filterable table: bold frozen header, autofilter, fixed widths and per-column number formats. */
function table(sheet: Worksheet, columns: Column[], rows: (string | number | null)[][]) {
  sheet.columns = columns.map(column => ({ header: column.header, width: column.width, style: column.format ? { numFmt: column.format } : {} }));
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  rows.forEach(row => sheet.addRow(row));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + rows.length, column: columns.length } };
}

function breakdownRows(group: string, items: BreakdownItem[]) {
  return items.map(item => [group, item.label, item.count, share(item.percentage), money(item.amount), share(item.amount_percentage)]);
}

function categoryRows(scope: string, items: CategoryStat[]) {
  return items.map(c => [scope, c.category_name, c.product_count, c.quantity_sold, money(c.revenue), share(c.revenue_percentage),
    c.available_units, money(c.inventory_value)]);
}

export function productInsightsFileName(report: ProductInvoiceReport, today: string) {
  return `phub-san-pham-hoa-don-${report.range.start ?? "toan-bo"}-${report.range.end ?? today}.xlsx`;
}

/**
 * Builds the export workbook. `products` is the complete product list (every status), not only the top rows on screen.
 * ExcelJS is passed in so the page can load it lazily and tests can use the Node build.
 */
export function buildProductInsightsWorkbook(Excel: ExcelJS, report: ProductInvoiceReport, products: StockListItem[], exportedAt: Date,
  trend: Pick<ProductInvoiceReport, "range" | "timeline"> = report): Workbook {
  const book = new Excel.Workbook();
  book.creator = "PHUB";
  book.created = exportedAt;
  const p = report.product_summary, i = report.invoice_summary;
  const rangeLabel = report.range.start ? `${report.range.start} → ${report.range.end}` : "Toàn thời gian";

  // ---- Tổng quan ----
  const overview = book.addWorksheet("Tổng quan");
  overview.columns = [{ width: 46 }, { width: 24 }, { width: 70 }];
  overview.addRow(["THỐNG KÊ SẢN PHẨM & HÓA ĐƠN"]).font = { bold: true, size: 14 };
  overview.addRow(["Thời gian xuất", exportedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })]);
  overview.addRow(["Kỳ lập hóa đơn", rangeLabel]);
  overview.addRow(["Kỳ biểu đồ hóa đơn", trend.range.start ? `${trend.range.start} → ${trend.range.end}` : "Toàn thời gian"]);
  overview.addRow(["Gom xu hướng", PERIOD_NAMES[trend.range.period_type]]);
  overview.addRow(["Ghi nhận", "Doanh số tính trên hóa đơn của đơn chưa hủy; doanh thu sản phẩm là giá trị chưa thuế sau giảm giá. Có hóa đơn không đồng nghĩa đã thanh toán."]);
  const section = (title: string, rows: [string, number, string, string?][]) => {
    overview.addRow([]);
    const head = overview.addRow([title, "Giá trị", "Ghi chú"]);
    head.font = { bold: true };
    head.fill = HEADER_FILL;
    for (const [label, value, format, note] of rows) {
      const row = overview.addRow([label, value, note ?? ""]);
      row.getCell(2).numFmt = format;
    }
  };
  section("SẢN PHẨM & TỒN KHO", [
    ["Sản phẩm (chưa ẩn)", p.total_products, INTEGER],
    ["Đang bán", p.active_products, INTEGER],
    ["Tạm ngưng", p.paused_products, INTEGER],
    ["Đã ẩn", p.hidden_products, INTEGER],
    ["Loại sản phẩm hoạt động", p.total_categories, INTEGER],
    ["Tồn thực tế (kho đang hoạt động)", p.physical_units, INTEGER, "Gồm cả sản phẩm đã ẩn còn trong kho"],
    ["Đang giữ cho đơn", p.held_units, INTEGER, "Đơn Mới/Xác nhận/Đang chuẩn bị có hóa đơn hoặc khoản thu thành công"],
    ["Tồn khả dụng", p.available_units, INTEGER, "Tồn thực tế trừ phần đang giữ"],
    ["Hết hàng", p.out_of_stock_products, INTEGER, "Sản phẩm đang bán có tồn khả dụng = 0"],
    [`Sắp hết (≤ ${p.low_stock_threshold})`, p.low_stock_products, INTEGER],
    ["Giá trị tồn khả dụng (giá bán)", money(p.inventory_value), MONEY, "Sản phẩm đang bán; theo giá bán hiện tại, không phải giá vốn"],
  ]);
  section("HÓA ĐƠN", [
    ["Tổng hóa đơn", i.total_invoices, INTEGER],
    ["Hóa đơn của đơn chưa hủy", i.valid_invoices, INTEGER],
    ["Hóa đơn của đơn đã hủy", i.cancelled_invoices, INTEGER, "Không tính vào doanh số"],
    ["Tổng sau thuế", money(i.total_amount), MONEY],
    ["Trước thuế", money(i.pre_tax_amount), MONEY],
    ["Thuế", money(i.tax_amount), MONEY],
    ["Giảm giá", money(i.discount_amount), MONEY],
    ["Giá trị trung bình / hóa đơn", money(i.avg_invoice_value), MONEY],
    ["Đã thu (trừ hoàn tiền)", money(i.collected_amount), MONEY],
    ["Còn phải thu", money(i.outstanding_amount), MONEY],
    ["Đã thanh toán đủ", i.paid_invoices, INTEGER],
    ["Thanh toán một phần", i.partial_invoices, INTEGER],
    ["Chưa thanh toán", i.unpaid_invoices, INTEGER],
    ["Số sản phẩm đã bán", i.items_sold, INTEGER],
  ]);

  // ---- Hóa đơn theo kỳ ----
  table(book.addWorksheet("Hóa đơn theo kỳ"), [
    { header: "Kỳ", width: 18 }, { header: "Mã kỳ", width: 10 }, { header: "Số hóa đơn", width: 12, format: INTEGER },
    { header: "SL sản phẩm", width: 12, format: INTEGER }, { header: "Trước thuế", width: 20, format: MONEY }, { header: "Thuế", width: 18, format: MONEY },
    { header: "Tổng sau thuế", width: 20, format: MONEY }, { header: "Đã thu", width: 20, format: MONEY }, { header: "Còn phải thu", width: 20, format: MONEY },
    { header: "Tỷ lệ thu", width: 11, format: PERCENT },
  ], trend.timeline.map(row => {
    const total = money(row.total), collected = money(row.collected);
    return [row.label, row.period, row.invoice_count, row.items_sold, money(row.pre_tax), money(row.tax), total, collected,
      Math.max(0, total - collected), total > 0 ? collected / total : null];
  }));

  // ---- Phân tích hóa đơn ----
  table(book.addWorksheet("Phân tích hóa đơn"), [
    { header: "Nhóm phân tích", width: 26 }, { header: "Mục", width: 26 }, { header: "Số lượng", width: 12, format: INTEGER },
    { header: "Tỷ lệ số lượng", width: 14, format: PERCENT }, { header: "Số tiền", width: 20, format: MONEY }, { header: "Tỷ lệ số tiền", width: 14, format: PERCENT },
  ], [
    ...breakdownRows("Trạng thái thanh toán", report.invoice_status),
    ...breakdownRows("Phương thức thanh toán (khoản thu thành công)", report.payment_methods),
    ...breakdownRows("Kênh bán", report.sales_channels),
    ...breakdownRows("Nguồn lập hóa đơn", report.invoice_sources),
  ]);

  // ---- Loại sản phẩm (overall, then per price range and per brand) ----
  table(book.addWorksheet("Loại sản phẩm"), [
    { header: "Phạm vi", width: 30 }, { header: "Loại sản phẩm", width: 30 }, { header: "SP đang bán", width: 12, format: INTEGER },
    { header: "Đã bán", width: 10, format: INTEGER }, { header: "Doanh thu chưa thuế", width: 20, format: MONEY },
    { header: "Tỷ trọng doanh thu", width: 14, format: PERCENT }, { header: "Tồn khả dụng", width: 13, format: INTEGER },
    { header: "Giá trị tồn (giá bán)", width: 22, format: MONEY },
  ], [
    ...categoryRows("Tất cả", report.categories),
    ...report.price_ranges.flatMap(range => categoryRows(`Khoảng giá: ${range.label}`, range.categories)),
    ...report.top_brands.flatMap(brand => categoryRows(`Thương hiệu: ${brand.brand}`, brand.categories)),
  ]);

  // ---- Sản phẩm (complete list) ----
  const threshold = p.low_stock_threshold;
  table(book.addWorksheet("Sản phẩm"), [
    { header: "SKU", width: 22 }, { header: "Tên sản phẩm", width: 56 }, { header: "Loại", width: 24 }, { header: "Thương hiệu", width: 18 },
    { header: "Trạng thái", width: 12 }, { header: "Giá bán hiện tại", width: 18, format: MONEY }, { header: "Đã bán trong kỳ", width: 14, format: INTEGER },
    { header: "Doanh thu trong kỳ (chưa thuế)", width: 22, format: MONEY }, { header: "Tồn thực tế", width: 12, format: INTEGER },
    { header: "Đang giữ", width: 10, format: INTEGER }, { header: "Tồn khả dụng", width: 13, format: INTEGER },
    { header: "Giá trị tồn (giá bán)", width: 20, format: MONEY }, { header: "Tình trạng tồn", width: 14 },
  ], products.map(item => [
    item.sku, item.name, item.category_name, item.brand ?? "", PRODUCT_STATUS[item.status] ?? String(item.status), money(item.price),
    item.quantity_sold, money(item.revenue), item.physical_units, item.held_units, item.available_units, money(item.inventory_value),
    item.available_units === 0 ? "Hết hàng" : item.available_units <= threshold ? "Sắp hết" : "Còn hàng",
  ]));

  return book;
}
