export type OrderStat = { ma_donhang: string; trang_thai: string; kenh_ban: string; thoi_gian_dat: string };
export type InventoryStat = { ma_kho: number; sku: string; so_luong_ton: number };
export type WarehouseStat = { ma_kho: number; ten_kho: string };
export type ChartValue = { label: string; value: number; color: string };
type DataPage<T> = { data: T[]; total: number; page: number; page_size: number };
const palette = ["#14a800", "#2563eb", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444"];
const dayFormatter = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });
const statuses: Record<string, string> = {
  MOI: "Mới", XAC_NHAN: "Đã xác nhận", DANG_CHUAN_BI: "Đang chuẩn bị",
  DA_XUAT_KHO: "Đã xuất kho", HOAN_THANH: "Hoàn thành", HUY: "Đã hủy",
};

async function readPage<T>(resource: string, page: number, signal: AbortSignal): Promise<DataPage<T>> {
  const response = await fetch(`/api/backend/data/${resource}?page=${page}&page_size=100`, { signal, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được dữ liệu thống kê.");
  if (!body || !Array.isArray(body.data) || !Number.isSafeInteger(body.total) || body.total < 0 || body.page !== page || body.page_size !== 100) {
    throw new Error("API trả dữ liệu thống kê không hợp lệ.");
  }
  return body;
}

export async function readAllRows<T>(resource: string, signal: AbortSignal): Promise<T[]> {
  const first = await readPage<T>(resource, 1, signal);
  // Do not silently chart only the first page or a truncated sample.
  if (first.total > 20000) throw new Error("Dữ liệu vượt giới hạn thống kê trên trình duyệt. Cần API tổng hợp riêng cho dữ liệu lớn.");
  const rows = [...first.data];
  for (let page = 2; page <= Math.ceil(first.total / 100); page++) {
    const next = await readPage<T>(resource, page, signal);
    if (next.total !== first.total) throw new Error("Dữ liệu vừa thay đổi. Hãy làm mới thống kê.");
    rows.push(...next.data);
  }
  if (rows.length !== first.total) throw new Error("Chưa tải đủ dữ liệu. Hãy làm mới thống kê.");
  return rows;
}

export async function readCount(resource: string, signal: AbortSignal): Promise<number> {
  return (await readPage(resource, 1, signal)).total;
}

/** Treat timestamps without an offset as Vietnam local time, not browser local time. */
export function vietnamDay(value: string | Date): string | null {
  const input = typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value + "+07:00" : value;
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = dayFormatter.formatToParts(date);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}

export function orderTrend(orders: OrderStat[], today: string, days: number) {
  const end = Date.parse(today + "T00:00:00Z");
  const counts = new Map<string, number>();
  let invalidDates = 0;
  for (const order of orders) {
    const day = typeof order.thoi_gian_dat === "string" ? vietnamDay(order.thoi_gian_dat) : null;
    if (!day) { invalidDates++; continue; }
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const points = Array.from({ length: days }, (_, index) => {
    const day = new Date(end - (days - 1 - index) * 86400000).toISOString().slice(0, 10);
    return { day, value: counts.get(day) ?? 0 };
  });
  return { points, total: points.reduce((sum, point) => sum + point.value, 0), invalidDates };
}

function distribution(orders: OrderStat[], field: "trang_thai" | "kenh_ban", labels: Record<string, string>): ChartValue[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const key = order[field] || "UNKNOWN";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const known = Object.keys(labels);
  const keys = [...known.filter(key => counts.has(key)), ...[...counts.keys()].filter(key => !(key in labels)).sort()];
  return keys.map((key, index) => ({ label: labels[key] ?? (key === "UNKNOWN" ? "Chưa xác định" : key), value: counts.get(key)!, color: palette[(known.includes(key) ? known.indexOf(key) : known.length + index) % palette.length] }));
}

export function orderStatuses(orders: OrderStat[]) {
  return distribution(orders, "trang_thai", statuses);
}
export function salesChannels(orders: OrderStat[]) {
  return distribution(orders, "kenh_ban", { ONLINE: "Online", TAI_QUAY: "Tại quầy" });
}
export function inventoryByWarehouse(rows: InventoryStat[], warehouses: WarehouseStat[]): ChartValue[] {
  const names = new Map(warehouses.map(row => [row.ma_kho, row.ten_kho]));
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.ma_kho) || !Number.isSafeInteger(row.so_luong_ton) || row.so_luong_ton < 0) throw new Error("Dữ liệu tồn kho không hợp lệ.");
    const quantity = (counts.get(row.ma_kho) ?? 0) + row.so_luong_ton;
    if (!Number.isSafeInteger(quantity)) throw new Error("Số lượng tồn vượt giới hạn thống kê.");
    counts.set(row.ma_kho, quantity);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([id, value], index) => ({ label: `${names.get(id) ?? "Kho"} · ${id}`, value, color: palette[index % palette.length] }));
}
