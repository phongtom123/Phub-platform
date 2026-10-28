import { adminFetch } from "../../lib/admin-fetch";

type InventoryRow = { ma_kho: number; sku: string; so_luong_ton: number };
type Page = { data: InventoryRow[]; total: number; page: number; page_size: number };
export type ProductStockData = { total: number; rows: { warehouseId: number; warehouseName: string | null; quantity: number }[] };
const PAGE_SIZE = 100;

async function read(path: string, signal: AbortSignal) {
  const response = await adminFetch("/api/backend/data/" + path, { signal, cache: "reload" });
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được tồn kho sản phẩm.");
  return body;
}

export async function readProductStock(sku: string, signal: AbortSignal): Promise<ProductStockData> {
  if (!sku.trim()) throw new Error("Sản phẩm chưa có SKU để tra cứu tồn kho.");
  const rows: ProductStockData["rows"] = [];
  const warehouses = new Set<number>();
  let total = 0, expected: number | null = null;
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ q: sku, page: String(page), page_size: String(PAGE_SIZE) });
    const body: Page = await read("inventory?" + query, signal);
    if (!body || !Array.isArray(body.data) || !Number.isSafeInteger(body.total) || body.total < 0 ||
      body.page !== page || body.page_size !== PAGE_SIZE || body.total > 10000) throw new Error("API trả dữ liệu tồn kho không hợp lệ hoặc vượt giới hạn tra cứu.");
    if (expected !== null && body.total !== expected) throw new Error("Tồn kho vừa thay đổi. Hãy tải lại để xem đủ dữ liệu.");
    expected = body.total;
    if (body.data.length !== Math.min(PAGE_SIZE, Math.max(0, expected - (page - 1) * PAGE_SIZE))) {
      throw new Error("Chưa tải đủ tồn kho. Hãy thử lại.");
    }
    for (const row of body.data) {
      if (typeof row?.sku !== "string") throw new Error("Dữ liệu tồn kho không hợp lệ.");
      // Generic q is a substring search. Only this exact SKU contributes to stock.
      if (row.sku !== sku) continue;
      if (!Number.isSafeInteger(row.ma_kho) || !Number.isSafeInteger(row.so_luong_ton) || row.so_luong_ton < 0 || warehouses.has(row.ma_kho)) {
        throw new Error("Dữ liệu tồn kho bị trùng hoặc số lượng không hợp lệ.");
      }
      total += row.so_luong_ton;
      if (!Number.isSafeInteger(total)) throw new Error("Số lượng tồn vượt giới hạn hiển thị.");
      warehouses.add(row.ma_kho);
      rows.push({ warehouseId: row.ma_kho, warehouseName: null, quantity: row.so_luong_ton });
    }
    if (page * PAGE_SIZE >= expected) break;
  }

  const queue = [...rows];
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length && !signal.aborted) {
      const row = queue.shift()!;
      try {
        const body = await read("warehouses?key=" + encodeURIComponent(JSON.stringify([row.warehouseId])), signal);
        const warehouse = body.data?.find((item: { ma_kho: number; ten_kho: string }) => item.ma_kho === row.warehouseId);
        if (typeof warehouse?.ten_kho === "string" && warehouse.ten_kho.trim()) row.warehouseName = warehouse.ten_kho;
      } catch (error) {
        if (signal.aborted) throw error;
        // A missing warehouse name does not invalidate its recorded stock.
      }
    }
  }));
  return { total, rows };
}
