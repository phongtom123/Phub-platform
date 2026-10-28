import { adminFetch } from "../../lib/admin-fetch";

export type ProductSupplier = { id: number; name: string; phone: string | null; email: string | null; receipts: number };
type ReceiptLine = { ma_phieu_nhap: number; sku: string };
type Receipt = { ma_phieu_nhap: number; ma_ncc: number; trang_thai: string };
type Supplier = { ma_ncc: number; ten_ncc: string; sdt: string | null; email: string | null };

async function read(path: string, signal: AbortSignal) {
  const response = await adminFetch("/api/backend/data/" + path, { signal, cache: "reload" });
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được nhà cung cấp của sản phẩm.");
  return body;
}

async function record<T>(resource: string, id: number, field: string, signal: AbortSignal): Promise<T> {
  const body = await read(resource + "?key=" + encodeURIComponent(JSON.stringify([id])), signal);
  const row = Array.isArray(body?.data) ? body.data.find((item: Record<string, unknown>) => item[field] === id) : undefined;
  if (!row) throw new Error("Chưa tải đủ thông tin phiếu nhập hoặc nhà cung cấp. Hãy thử lại.");
  return row as T;
}

async function mapLimited<T, R>(items: T[], signal: AbortSignal, run: (item: T) => Promise<R>): Promise<R[]> {
  const queue = items.map((value, index) => ({ value, index }));
  const result: R[] = [];
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length && !signal.aborted && !failed) {
      const job = queue.shift()!;
      try { result[job.index] = await run(job.value); }
      catch (error) { failed = true; throw error; }
    }
  }));
  if (signal.aborted) throw new DOMException("Yêu cầu đã bị hủy.", "AbortError");
  return result;
}

/** Supplier relationships come from confirmed receipts, rather than a direct product field. */
export async function readProductSuppliers(sku: string, signal: AbortSignal): Promise<ProductSupplier[]> {
  if (!sku.trim()) throw new Error("Sản phẩm chưa có SKU để tra cứu nhà cung cấp.");
  const ids = new Set<number>();
  let expected: number | null = null;
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ q: sku, page: String(page), page_size: "100" });
    const body = await read("receipt-lines?" + query, signal);
    if (!Array.isArray(body?.data) || !Number.isSafeInteger(body.total) || body.total < 0 || body.total > 10000 ||
      body.page !== page || body.page_size !== 100 || (expected !== null && body.total !== expected) ||
      body.data.length !== Math.min(100, Math.max(0, body.total - (page - 1) * 100))) {
      throw new Error("Dữ liệu phiếu nhập chưa đầy đủ hoặc vừa thay đổi. Hãy tải lại.");
    }
    expected = body.total;
    for (const row of body.data as ReceiptLine[]) {
      if (typeof row?.sku !== "string") throw new Error("Dữ liệu chi tiết phiếu nhập không hợp lệ.");
      if (row.sku !== sku) continue;
      if (!Number.isSafeInteger(row.ma_phieu_nhap) || ids.has(row.ma_phieu_nhap)) throw new Error("Dữ liệu phiếu nhập bị trùng hoặc không hợp lệ.");
      ids.add(row.ma_phieu_nhap);
    }
    if (page * 100 >= body.total) break;
  }

  const receipts = await mapLimited([...ids], signal, id => record<Receipt>("receipts", id, "ma_phieu_nhap", signal));
  const counts = new Map<number, number>();
  for (const receipt of receipts) {
    if (!["NHAP", "DA_NHAP", "HUY"].includes(receipt.trang_thai)) throw new Error("Trạng thái phiếu nhập không hợp lệ.");
    if (receipt.trang_thai !== "DA_NHAP") continue;
    if (!Number.isSafeInteger(receipt.ma_ncc)) throw new Error("Mã nhà cung cấp trên phiếu nhập không hợp lệ.");
    counts.set(receipt.ma_ncc, (counts.get(receipt.ma_ncc) ?? 0) + 1);
  }
  return mapLimited([...counts], signal, async ([id, receipts]) => {
    const row = await record<Supplier>("suppliers", id, "ma_ncc", signal);
    if (typeof row.ten_ncc !== "string" || !row.ten_ncc.trim()) throw new Error("Thông tin nhà cung cấp không hợp lệ.");
    return { id, name: row.ten_ncc, phone: row.sdt, email: row.email, receipts };
  });
}
