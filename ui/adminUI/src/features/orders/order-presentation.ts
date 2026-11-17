import type { DataColumn, DataRow } from "../../lib/inline-table-data";

const statuses: Record<string, string> = {
  MOI: "Mới", XAC_NHAN: "Đã xác nhận", DANG_CHUAN_BI: "Đang chuẩn bị",
  DA_XUAT_KHO: "Đã xuất kho", HOAN_THANH: "Hoàn thành", HUY: "Đã hủy",
};
const channels: Record<string, string> = { ONLINE: "Trực tuyến", TAI_QUAY: "Tại quầy" };

/** Per-order extras from the list API (`order_summaries`), read in the same request as the rows. */
export type OrderSummary = {
  total: string | null;
  items: { sku: string | null; name: string | null; quantity: number }[];
  customer_id: string | null; customer_name: string | null;
  employee_id: string | null; employee_name: string | null;
};
export type OrderListCell = { kind: "column"; column: DataColumn } | { kind: "total" | "channel" | "people" | "products" };

/**
 * Table layout, left to right: ID, date, total, status, channel + pickup, customer + staff, products.
 * Channel/pickup and customer/staff share a cell so the products stay visible without
 * horizontal scrolling. Total and products exist only when the API sent summaries.
 */
export function orderListLayout(columns: DataColumn[], withSummary: boolean): OrderListCell[] {
  const column = (name: string): OrderListCell[] => columns.filter(item => item.name === name).map(item => ({ kind: "column", column: item }));
  const has = (...names: string[]) => columns.some(item => names.includes(item.name));
  return [
    ...column("ma_donhang"), ...column("thoi_gian_dat"),
    ...(withSummary ? [{ kind: "total" } as const] : []),
    ...column("trang_thai"),
    ...(has("kenh_ban", "phuong_thuc_nhan") ? [{ kind: "channel" } as const] : []),
    ...(has("ma_kh", "ma_nhan_vien") ? [{ kind: "people" } as const] : []),
    ...(withSummary ? [{ kind: "products" } as const] : []),
  ];
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function orderTime(value: unknown): number {
  if (typeof value !== "string" || !value) return Number.NEGATIVE_INFINITY;
  const input = /(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + "+07:00";
  const timestamp = Date.parse(input);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

/** Defensive UI ordering while the backend also paginates newest-first. */
export function newestOrderRows(rows: DataRow[]): DataRow[] {
  return [...rows].sort((left, right) => orderTime(right.thoi_gian_dat) - orderTime(left.thoi_gian_dat)
    || String(right.ma_donhang ?? "").localeCompare(String(left.ma_donhang ?? "")));
}

export function orderValue(row: DataRow, field: string): string {
  const value = row[field];
  if (value === null || value === undefined || value === "") return "—";
  if (field === "trang_thai") return statuses[String(value)] ?? "Chưa xác định";
  if (field === "kenh_ban") return channels[String(value)] ?? "Chưa xác định";
  if (field === "phuong_thuc_nhan") return value === "TAI_CUA_HANG" ? "Nhận tại cửa hàng" : value === "GIAO_HANG" ? "Giao hàng tận nơi" : "Chưa ghi nhận";
  if (field.startsWith("thoi_gian_")) {
    // Database timestamps without an offset represent Vietnam local time.
    const input = String(value);
    const date = new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(input) ? input : input + "+07:00");
    return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : "Thời gian không hợp lệ";
  }
  return String(value);
}
