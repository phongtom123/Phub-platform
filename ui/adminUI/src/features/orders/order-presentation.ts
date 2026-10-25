import type { DataColumn, DataRow } from "../../lib/inline-table-data";

const statuses: Record<string, string> = {
  MOI: "Mới", XAC_NHAN: "Đã xác nhận", DANG_CHUAN_BI: "Đang chuẩn bị",
  DA_XUAT_KHO: "Đã xuất kho", HOAN_THANH: "Hoàn thành", HUY: "Đã hủy",
};
const channels: Record<string, string> = { ONLINE: "Trực tuyến", TAI_QUAY: "Tại quầy" };
const listFields = ["ma_donhang", "ma_kh", "ma_nhan_vien", "kenh_ban", "trang_thai", "thoi_gian_dat"];
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function orderListColumns(columns: DataColumn[]) {
  return listFields.flatMap(name => columns.filter(column => column.name === name));
}

export function orderValue(row: DataRow, field: string): string {
  const value = row[field];
  if (value === null || value === undefined || value === "") return "—";
  if (field === "trang_thai") return statuses[String(value)] ?? "Chưa xác định";
  if (field === "kenh_ban") return channels[String(value)] ?? "Chưa xác định";
  if (field.startsWith("thoi_gian_")) {
    // Database timestamps without an offset represent Vietnam local time.
    const input = String(value);
    const date = new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(input) ? input : input + "+07:00");
    return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : "Thời gian không hợp lệ";
  }
  return String(value);
}
