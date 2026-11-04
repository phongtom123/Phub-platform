import type { ModuleKey } from "@/src/types/admin";

/** Navigation labels only. Table metadata and records come from the backend. */
export const moduleNames: Record<ModuleKey, string> = {
  dashboard: "Tổng quan",
  reports: "Báo cáo kinh doanh",
  orders: "Đơn hàng",
  billing: "Hóa đơn & thanh toán",
  customers: "Khách hàng",
  products: "Sản phẩm",
  categories: "Loại sản phẩm",
  inventory: "Tồn kho",
  receipts: "Phiếu nhập",
  transfers: "Chuyển kho",
  suppliers: "Nhà cung cấp",
  branches: "Kho",
  employees: "Nhân viên",
  accounts: "Tài khoản",
  promotions: "Khuyến mãi",
  vouchers: "Voucher",
  support: "Hỗ trợ khách hàng",
};
