export type InventoryApiItem = { ma_kho: number; sku: string; so_luong_ton: number; cap_nhat_luc?: string | null };
export type ProductApiItem = { ma_sp: string; sku: string; ten_sp: string; ma_loai_sp?: string | null; thuong_hieu?: string | null; don_vi?: string | null };
export type CategoryApiItem = { ma_loai_sp: string; ten_loai_sp: string };
export type SupplierApiItem = { ma_ncc: number; ten_ncc: string };
export type SupplierRecord = { ma_ncc: number; ten_ncc: string; sdt?: string | null; email?: string | null; dia_chi?: string | null; trang_thai: number };
export type WarehouseApiItem = { ma_kho: number; ten_kho?: string | null };
export type ReceiptApiItem = { ma_phieu_nhap: number; ma_phieu_code: string; ma_ncc: number; ma_kho: number; ngay_tao: string; trang_thai: string; nguoi_tao?: string | null; nguoi_xac_nhan?: string | null; ghi_chu?: string | null };
export type ReceiptLineApiItem = { ma_phieu_nhap: number; sku: string; so_luong_nhap: number; gia_nhap?: string | number | null };
export type TransferApiItem = { ma_phieu_chuyen: number; ma_kho_xuat: number; ma_kho_nhan: number; ngay_tao: string; trang_thai: string; ghi_chu?: string | null };
export type TransferLineApiItem = { ma_phieu_chuyen: number; sku: string; so_luong: number };
type Page<T> = { data: T[]; total: number; page: number; page_size: number };
export type WarehouseOption = { ma_kho: number; ten_kho: string };
export type SupplierOption = { ma_ncc: number; ten_ncc: string };
export type ProductOption = { ma_sp?: string; sku: string; ten_sp: string; don_vi?: string | null; gia_ban_hien_tai?: string | number | null; so_luong_ton?: number };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include", cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: unknown; message?: unknown } | null;
    const raw = body?.detail ?? body?.message;
    const detail = typeof raw === "string" ? raw : raw ? JSON.stringify(raw) : `API error ${response.status}`;
    throw new WarehouseApiError(detail, response.status);
  }
  return response.json() as Promise<T>;
}

export async function login(username: string, password: string) {
  return request<{ username: string; role: string }>("/api/backend/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function changeMyPassword(currentPassword: string, newPassword: string) {
  await request<void>("/api/backend/auth/me/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function getInventory() {
  const [inventory, products] = await Promise.all([
    allRows<InventoryApiItem>("inventory").then(data => ({ data })),
    allRows<ProductApiItem>("products").then(data => ({ data })),
  ]);
  const productMap = new Map(products.data.map(product => [product.sku, product]));
  const totals = new Map<string, number>();
  inventory.data.forEach(item => totals.set(item.sku, (totals.get(item.sku) ?? 0) + item.so_luong_ton));
  return { items: products.data.map(product => {
    const quantity = totals.get(product.sku) ?? 0;
    return {
      warehouse_code: "ALL", warehouse_name: "Tất cả kho", sku: product.sku,
      product_name: product.ten_sp, unit: product.don_vi ?? "cái",
      quantity, location: null, status: quantity === 0 ? "Hết hàng" : quantity <= 5 ? "Sắp hết hàng" : "Còn hàng",
    };
  }) };
}

async function page<T>(resource: string) {
  return request<Page<T>>(`/api/backend/data/${resource}?page=1&page_size=100`);
}

async function allRows<T>(resource: string) {
  const first = await page<T>(resource);
  if (first.total <= first.data.length) return first.data;
  const pages = await Promise.all(Array.from({ length: Math.ceil(first.total / first.page_size) - 1 }, (_, index) => request<Page<T>>(`/api/backend/data/${resource}?page=${index + 2}&page_size=100`)));
  return [first, ...pages].flatMap(result => result.data);
}

export async function getWarehouseOptions() {
  return request<{ warehouses: WarehouseOption[]; suppliers: SupplierOption[]; products: ProductOption[] }>("/api/backend/warehouse/options");
}

export async function getSuppliers() {
  return page<SupplierRecord>("suppliers");
}

export async function createSupplier(body: { ten_ncc: string; sdt?: string; email?: string; dia_chi?: string; trang_thai?: number }) {
  return request<{ data: SupplierRecord[] }>("/api/backend/data/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function updateSupplier(id: number, body: Partial<Omit<SupplierRecord, "ma_ncc">>) {
  const key = encodeURIComponent(JSON.stringify([id]));
  return request<{ data: SupplierRecord[] }>(`/api/backend/data/suppliers?key=${key}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function deactivateSupplier(id: number) {
  return updateSupplier(id, { trang_thai: 0 });
}

export async function getDispatches() {
  return request<{ id: string; recordId: string; order: string; warehouse: string; employeeCode?: string; items: string; created: string; status: string; receiver: string }[]>("/api/backend/warehouse/dispatches");
}
export type DispatchOrderOption = { order_id: string; receiver: string; status: string; dispatchable?: boolean; sku?: string; unit?: string; unit_price?: string | number; ordered_quantity?: number; line_total?: string | number };
export async function getDispatchOrderOptions(sku?: string) { const query = sku ? `?sku=${encodeURIComponent(sku)}` : ""; return request<DispatchOrderOption[]>(`/api/backend/warehouse/dispatches/order-options${query}`); }

export type InvoiceOption = { order_id: string; buyer: string; total: number };
export type InvoiceRow = { id: string; recordId: string; order: string; buyer: string; employeeCode: string; total: string; created: string; status: string };
export async function getInvoices() { return request<InvoiceRow[]>("/api/backend/warehouse/invoices"); }
export type InvoiceDetail = { invoice: { ma_hoadon: string; ma_donhang: string; thoi_gian_lap?: string; ten_nguoi_mua?: string; email_nguoi_mua?: string; ma_so_thue?: string; dia_chi_nguoi_mua?: string; tong_tien_giam?: string; tong_tien_truoc_thue?: string; tong_tien_thue?: string; tong_tien_sau_thue?: string; nguoi_lap?: string }; lines: { sku: string; ten_sp_luc_ban?: string; don_vi_luc_ban?: string; so_luong: number; don_gia: string | number; giam_gia?: string | number; giam_gia_voucher?: string | number }[] };
export async function getInvoiceDetail(invoiceId: string) { return request<InvoiceDetail>(`/api/backend/warehouse/invoices/${encodeURIComponent(invoiceId)}`); }
export async function getInvoiceOptions() { return request<InvoiceOption[]>("/api/backend/warehouse/invoices/options"); }
export type CustomerInvoiceSearch = { customers: { ma_kh: string; ten_kh: string; email?: string | null; sdt?: string | null; dia_chi_chi_tiet_md?: string | null }[]; orders: { ma_donhang: string; ma_kh: string; ten_nguoi_nhan?: string | null; trang_thai: string }[] };
export async function searchInvoiceCustomers(query: string) { return request<CustomerInvoiceSearch>(`/api/backend/warehouse/invoices/customer-search?q=${encodeURIComponent(query)}`); }
export type InvoiceOrderPreview = { order: { ma_donhang: string; ma_kh?: string | null; trang_thai: string; ten_nguoi_nhan?: string | null; dia_chi_chi_tiet?: string | null }; lines: { sku: string; ten_sp_luc_ban?: string | null; don_vi_luc_ban?: string | null; so_luong: number; don_gia: string | number; giam_gia?: string | number; giam_gia_voucher?: string | number }[]; summary: { subtotal: string; discount: string; before_tax: string; tax: string; total: string } };
export async function getInvoiceOrderPreview(orderId: string) { return request<InvoiceOrderPreview>(`/api/backend/warehouse/invoices/order-preview?order_id=${encodeURIComponent(orderId)}`); }
export async function createInvoice(body: { order_id: string; buyer?: string; tax_id?: string; address?: string }) {
  return request<{ data: InvoiceRow }>("/api/backend/warehouse/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
export type ManualInvoiceLine = { sku: string; quantity: number; unit_price: number; discount: number };
export async function createManualInvoice(body: { buyer: string; email: string; tax_id?: string; address?: string; lines: ManualInvoiceLine[] }) {
  return request<{ data: InvoiceRow }>("/api/backend/warehouse/invoices/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function dispatchOrder(orderId: string) {
  return request<{ ma_donhang: string; trang_thai: string; nguoi_xuat: string }>(`/api/backend/warehouse/dispatches/${encodeURIComponent(orderId)}/dispatch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}
export async function createDispatchDraft(body: { order_id: string; warehouse_id?: number; note?: string; lines: { sku: string; warehouse_id?: number; quantity: number }[] }) { return request<{ data: { ma_phieu_xuat: number; ma_phieu_code: string; trang_thai: string } }>("/api/backend/warehouse/dispatches/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
export async function confirmDispatch(dispatchId: number) { return request<{ ma_phieu_xuat: number; ma_phieu_code: string; trang_thai: string }>(`/api/backend/warehouse/dispatches/${dispatchId}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); }
export async function cancelDispatchDraft(dispatchId: number) { return request<{ ma_phieu_xuat: number; ma_phieu_code: string; trang_thai: string }>(`/api/backend/warehouse/dispatches/${dispatchId}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); }
export async function updateDispatchDraft(dispatchId: number, body: { order_id: string; warehouse_id?: number; note?: string; lines: { sku: string; warehouse_id?: number; quantity: number }[] }) { return request<{ data: { ma_phieu_xuat: number; trang_thai: string } }>(`/api/backend/warehouse/dispatches/${dispatchId}/draft`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
export async function getDispatchDraft(dispatchId: number) { return request<{ dispatch: { ma_phieu_xuat: number; ma_donhang: string; ma_kho_xuat: number; ghi_chu?: string; trang_thai: string }; lines: { ma_sp?: string; sku: string; ten_sp?: string; don_vi?: string; don_gia?: string | number; ma_kho_xuat: number; so_luong: number }[] }>(`/api/backend/warehouse/dispatches/${dispatchId}/draft`); }

export function displayDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN").format(date);
}
const formatDate = displayDate;

export const receiptStatus: Record<string, string> = { NHAP: "Nháp", DA_NHAP: "Đã nhập", HUY: "Đã hủy" };

function transferStatus(value: string) {
  return ({ NHAP: "Nháp", DANG_CHUYEN: "Đang chuyển", DA_NHAN: "Đã nhận", HUY: "Đã hủy" } as Record<string, string>)[value] ?? value;
}

export async function getProducts() {
  const [products, inventory, categories] = await Promise.all([page<ProductApiItem>("products"), page<InventoryApiItem>("inventory"), page<CategoryApiItem>("categories")]);
  const quantities = new Map<string, number>();
  inventory.data.forEach(item => quantities.set(item.sku, (quantities.get(item.sku) ?? 0) + item.so_luong_ton));
  const categoryMap = new Map(categories.data.map(category => [category.ma_loai_sp, category.ten_loai_sp]));
  return products.data.map(product => {
    const quantity = quantities.get(product.sku) ?? 0;
    return { id: product.ma_sp, name: product.ten_sp, code: product.sku, category: categoryMap.get(product.ma_loai_sp ?? "") ?? product.ma_loai_sp ?? "—", brand: product.thuong_hieu ?? "—", quantity, status: quantity === 0 ? "Hết hàng" : quantity <= 5 ? "Sắp hết hàng" : "Còn hàng" };
  });
}

export async function getReceipts() {
  const [receipts, suppliers, warehouses, lines] = await Promise.all([
    page<ReceiptApiItem>("receipts"), page<SupplierApiItem>("suppliers"), page<WarehouseApiItem>("warehouses"), page<ReceiptLineApiItem>("receipt-lines"),
  ]);
  const supplierMap = new Map(suppliers.data.map(item => [item.ma_ncc, item.ten_ncc]));
  const warehouseMap = new Map(warehouses.data.map(item => [item.ma_kho, item.ten_kho ?? `Kho #${item.ma_kho}`]));
  const lineMap = new Map<number, ReceiptLineApiItem[]>();
  lines.data.forEach(line => lineMap.set(line.ma_phieu_nhap, [...(lineMap.get(line.ma_phieu_nhap) ?? []), line]));
  return receipts.data.map(receipt => {
    const receiptLines = lineMap.get(receipt.ma_phieu_nhap) ?? [];
    const totalQuantity = receiptLines.reduce((sum, line) => sum + line.so_luong_nhap, 0);
    return { id: receipt.ma_phieu_code, recordId: receipt.ma_phieu_nhap, supplier: supplierMap.get(receipt.ma_ncc) ?? `NCC #${receipt.ma_ncc}`, warehouse: warehouseMap.get(receipt.ma_kho) ?? `Kho #${receipt.ma_kho}`, employeeCode: receipt.nguoi_tao ?? receipt.nguoi_xac_nhan ?? "—", items: `${receiptLines.length} SKU · ${totalQuantity} SP`, created: formatDate(receipt.ngay_tao), status: receiptStatus[receipt.trang_thai] ?? receipt.trang_thai };
  });
}

export async function getReceiptDraft(receiptId: number) {
  const detail = await warehouseApi<{ receipt: { ma_ncc: number; ma_kho: number; ghi_chu?: string | null }; lines: { sku: string; quantity: number; unit_price: string | number }[] }>(`warehouse/receipts/${receiptId}`);
  return { supplier_id: detail.receipt.ma_ncc, warehouse_id: detail.receipt.ma_kho, note: detail.receipt.ghi_chu ?? "", lines: detail.lines.map(line => ({ sku: line.sku, quantity: line.quantity, unit_price: Number(line.unit_price ?? 0) })) };
}

export async function confirmReceipt(receiptId: number) {
  const current = await warehouseApi<{ version: string }>(`warehouse/receipts/${receiptId}`);
  const { pricingRequest } = await import("../../../shared/pricing");
  const quote = await pricingRequest<{ version: string }>(`receipts/${receiptId}`);
  const body = JSON.stringify({ expected_version: current.version, pricing_version: quote.version });
  return warehouseApi<{ ma_phieu_nhap: number; ma_phieu_code: string; ma_kho: number; trang_thai: string; nguoi_xac_nhan: string }>(`warehouse/receipts/${receiptId}/confirm`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": operationKey(null, body).key }, body });
}

export async function cancelReceipt(receiptId: number) {
  const current = await warehouseApi<{ version: string }>(`warehouse/receipts/${receiptId}`);
  const body = JSON.stringify({ expected_version: current.version });
  return warehouseApi<{ ma_phieu_nhap: number; ma_phieu_code: string; trang_thai: string }>(`warehouse/receipts/${receiptId}/cancel`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": operationKey(null, body).key }, body });
}

/** Domain delete for a draft; the backend cancels it to preserve audit history. */
export async function deleteReceiptDraft(receiptId: number) {
  return cancelReceipt(receiptId);
}

export async function createReceiptDraft(body: {
  supplier_id: number;
  warehouse_id: number;
  note?: string;
  lines: { sku: string; quantity: number; unit_price: number }[];
}) {
  return request<{ data: { ma_phieu_nhap: number; ma_phieu_code: string; trang_thai: string } }>("/api/backend/warehouse/receipts/draft", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

export async function updateReceiptDraft(receiptId: number, body: { supplier_id: number; warehouse_id: number; note?: string; lines: { sku: string; quantity: number; unit_price: number }[] }) {
  return request<{ data: { ma_phieu_nhap: number; ma_phieu_code: string; trang_thai: string } }>(`/api/backend/warehouse/receipts/${receiptId}/draft`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function createTransferDraft(body: {
  source_warehouse_id: number;
  destination_warehouse_id: number;
  note?: string;
  lines: { sku: string; quantity: number }[];
}) {
  return request<{ data: { ma_phieu_chuyen: number; trang_thai: string } }>("/api/backend/warehouse/transfers/draft", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

export async function updateTransferDraft(transferId: number, body: { source_warehouse_id: number; destination_warehouse_id: number; note?: string; lines: { sku: string; quantity: number }[] }) {
  return request<{ data: { ma_phieu_chuyen: number; trang_thai: string } }>(`/api/backend/warehouse/transfers/${transferId}/draft`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function getTransfers() {
  const [transfers, warehouses, lines] = await Promise.all([
    page<TransferApiItem>("transfers"), page<WarehouseApiItem>("warehouses"), page<TransferLineApiItem>("transfer-lines"),
  ]);
  const warehouseMap = new Map(warehouses.data.map(item => [item.ma_kho, item.ten_kho ?? `Kho #${item.ma_kho}`]));
  const lineMap = new Map<number, TransferLineApiItem[]>();
  lines.data.forEach(line => lineMap.set(line.ma_phieu_chuyen, [...(lineMap.get(line.ma_phieu_chuyen) ?? []), line]));
  return transfers.data.map(transfer => {
    const transferLines = lineMap.get(transfer.ma_phieu_chuyen) ?? [];
    const totalQuantity = transferLines.reduce((sum, line) => sum + line.so_luong, 0);
    return { id: `CK-${transfer.ma_phieu_chuyen}`, recordId: transfer.ma_phieu_chuyen, from: warehouseMap.get(transfer.ma_kho_xuat) ?? `Kho #${transfer.ma_kho_xuat}`, to: warehouseMap.get(transfer.ma_kho_nhan) ?? `Kho #${transfer.ma_kho_nhan}`, items: `${transferLines.length} SKU · ${totalQuantity} SP`, created: formatDate(transfer.ngay_tao), status: transferStatus(transfer.trang_thai) };
  });
}

export async function getTransferDraft(transferId: number) {
  const [transfers, lines] = await Promise.all([page<TransferApiItem>("transfers"), page<TransferLineApiItem>("transfer-lines")]);
  const transfer = transfers.data.find(item => item.ma_phieu_chuyen === transferId);
  if (!transfer) throw new Error("Không tìm thấy phiếu chuyển.");
  return { source_warehouse_id: transfer.ma_kho_xuat, destination_warehouse_id: transfer.ma_kho_nhan, note: transfer.ghi_chu ?? "", lines: lines.data.filter(line => line.ma_phieu_chuyen === transferId).map(line => ({ sku: line.sku, quantity: line.so_luong })) };
}

export async function getPending() {
  const [receipts, transfers] = await Promise.all([getReceipts(), getTransfers()]);
  return [
    ...receipts.filter(item => ["Nháp", "Chờ xác nhận"].includes(String(item.status))).map(item => ({
      id: item.id, recordId: item.recordId, source: "receipts", type: "Phiếu nhập", partner: item.supplier, items: item.items, created: item.created, status: item.status,
    })),
    ...transfers.filter(item => ["Nháp", "Đang chuyển"].includes(String(item.status))).map(item => ({
      id: item.id, recordId: item.recordId, source: "transfers", type: "Chuyển kho", partner: `${item.from} → ${item.to}`, items: item.items, created: item.created, status: item.status,
    })),
  ];
}

export async function getHistory() {
  const result = await request<{ data: { id: number; sku: string; product_name?: string | null; before_quantity: number; after_quantity: number; actor_name?: string | null; actor?: string | null; reason: string; reference?: string | null; created_at: string }[] }>("/api/backend/warehouse/history?page=1&page_size=100");
  const labels: Record<string, string> = { "receipts:confirm": "Nhập kho", "orders:dispatch": "Xuất đơn hàng", "transfers:dispatch": "Xuất chuyển kho", "transfers:receive": "Nhận chuyển kho", "inventory:adjust": "Điều chỉnh tồn" };
  return result.data.map(item => {
    const change = item.after_quantity - item.before_quantity;
    return { id: `LS-${item.id}`, reference: item.reference ?? "—", type: labels[item.reason] ?? item.reason, product: item.product_name ?? item.sku, quantity: change > 0 ? `+${change}` : String(change), user: item.actor_name ?? item.actor ?? "—", created: formatDate(item.created_at) };
  });
}

export async function dispatchTransfer(transferId: number) {
  return request<{ ma_phieu_chuyen: number; trang_thai: string; nguoi_xuat: string }>(`/api/backend/warehouse/transfers/${transferId}/dispatch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

export async function receiveTransfer(transferId: number) {
  return request<{ ma_phieu_chuyen: number; trang_thai: string; nguoi_nhan: string }>(`/api/backend/warehouse/transfers/${transferId}/receive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

export async function cancelTransfer(transferId: number) {
  return request<{ ma_phieu_chuyen: number; trang_thai: string }>(`/api/backend/warehouse/transfers/${transferId}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

/** Domain delete for a draft; the backend cancels it to preserve audit history. */
export async function deleteTransferDraft(transferId: number) {
  return cancelTransfer(transferId);
}

export function hasApiToken() {
  return true;
}

export class WarehouseApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "WarehouseApiError"; }
}

export function warehouseApi<T>(path: string, init?: RequestInit) {
  return request<T>(`/api/backend/${path.replace(/^\//, "")}`, init);
}

export function cents(value: string | number | bigint) {
  const text = String(value).replace(/,/g, "");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole || "0") * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
}

export function displayMoney(value: bigint) {
  return `${(Number(value) / 100).toLocaleString("vi-VN")} ₫`;
}

export function operationKey(previous: { body: string; key: string } | null, body: string) {
  if (previous?.body === body) return previous;
  return { body, key: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}` };
}
