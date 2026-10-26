export type DataCrumb = { label: string; href: string };

export const resourceTitles: Record<string, string> = {
  warehouses: "Kho", employees: "Nhân viên", accounts: "Tài khoản", customers: "Khách hàng",
  categories: "Loại sản phẩm", products: "Sản phẩm", inventory: "Tồn kho", suppliers: "Nhà cung cấp",
  receipts: "Phiếu nhập", "receipt-lines": "Chi tiết phiếu nhập", transfers: "Chuyển kho",
  "transfer-lines": "Chi tiết chuyển kho", orders: "Đơn hàng", "order-lines": "Chi tiết đơn hàng",
  invoices: "Hóa đơn", payments: "Thanh toán", promotions: "Khuyến mãi", vouchers: "Voucher",
  "voucher-uses": "Sử dụng voucher",
};
export const orderChildren = ["order-lines", "invoices", "payments", "voucher-uses"];

export function dataHref(resource: string, options: { key?: string | null; orderId?: string | null; edit?: boolean; create?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.orderId) params.set("order_id", options.orderId);
  if (options.key) params.set("key", options.key);
  if (options.edit) params.set("edit", "1");
  if (options.create) params.set("new", "1");
  return `/data/${resource}${params.size ? "?" + params.toString() : ""}`;
}

export function dataBreadcrumbs(resource: string, search: string): DataCrumb[] {
  const params = new URLSearchParams(search);
  const orderId = orderChildren.includes(resource) ? params.get("order_id") : null;
  const key = params.get("key");
  const crumbs: DataCrumb[] = [{ label: "Quản trị", href: "/" }];
  if (orderId) {
    crumbs.push({ label: "Đơn hàng", href: dataHref("orders") });
    crumbs.push({ label: orderId, href: dataHref("orders", { key: JSON.stringify([orderId]) }) });
  }
  crumbs.push({ label: resourceTitles[resource] ?? resource, href: dataHref(resource, { orderId }) });
  if (key) {
    let label = "Chi tiết";
    try {
      const keys = JSON.parse(key);
      if (Array.isArray(keys) && keys.length && keys.every(value => typeof value === "string" || typeof value === "number")) label = keys.join(" · ");
    } catch { /* Invalid keys are reported by the data API, not breadcrumb rendering. */ }
    crumbs.push({ label, href: dataHref(resource, { key, orderId }) });
  }
  if (params.get("edit") === "1" || params.get("new") === "1") {
    const create = params.get("new") === "1";
    crumbs.push({ label: create ? "Thêm mới" : "Chỉnh sửa", href: dataHref(resource, { key, orderId, create, edit: !create }) });
  }
  return crumbs;
}
