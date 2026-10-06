export type ModuleKey = "dashboard" | "inventory" | "receipts" | "transfers" | "stocktake" | "products" | "history" | "account" | "settings";
export type Status = "Còn hàng" | "Sắp hết" | "Hết hàng" | "Nháp" | "Chờ xác nhận" | "Đã nhập" | "Đang chuyển" | "Đã nhận" | "Đang kiểm kê" | "Hoàn tất";
export type DataRow = Record<string, string | number> & { id: string };
export type ColumnDefinition = { key: string; label: string; kind?: "link" | "strong" | "status" | "product" };
export type ModuleDefinition = {
  title: string;
  description: string;
  searchPlaceholder: string;
  addLabel?: string;
  filters?: string[];
  columns: ColumnDefinition[];
  rows: DataRow[];
  note?: string;
};
export type FormFieldDefinition = { name: string; label: string; placeholder: string; type?: "text" | "number" | "textarea"; wide?: boolean };
