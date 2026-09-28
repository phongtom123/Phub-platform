export type ModuleKey = "dashboard" | "inventory" | "receipts" | "dispatches" | "transfers" | "products" | "history" | "pending" | "account" | "settings";
export type Status = "Còn hàng" | "Hết hàng" | "Nháp" | "Chờ xác nhận" | "Đã nhập" | "Đã xuất" | "Đang soạn" | "Đang chuyển" | "Đã nhận" | "Hoàn tất";
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
