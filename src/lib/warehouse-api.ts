export type InventoryApiItem = { ma_kho: number; sku: string; so_luong_ton: number; cap_nhat_luc?: string | null };
export type ProductApiItem = { ma_sp: string; sku: string; ten_sp: string; don_vi?: string | null };
export type SupplierApiItem = { ma_ncc: number; ten_ncc: string };
export type WarehouseApiItem = { ma_kho: number; ten_kho?: string | null };
export type ReceiptApiItem = { ma_phieu_nhap: number; ma_phieu_code: string; ma_ncc: number; ma_kho: number; ngay_tao: string; trang_thai: string; ghi_chu?: string | null };
export type ReceiptLineApiItem = { ma_phieu_nhap: number; sku: string; so_luong_nhap: number; gia_nhap?: string | number | null };
export type TransferApiItem = { ma_phieu_chuyen: number; ma_kho_xuat: number; ma_kho_nhan: number; ngay_tao: string; trang_thai: string; ghi_chu?: string | null };
export type TransferLineApiItem = { ma_phieu_chuyen: number; sku: string; so_luong: number };
type Page<T> = { data: T[]; total: number; page: number; page_size: number };
export type WarehouseOption = { ma_kho: number; ten_kho: string };
export type SupplierOption = { ma_ncc: number; ten_ncc: string };
export type ProductOption = { sku: string; ten_sp: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail ?? `API error ${response.status}`);
  return response.json() as Promise<T>;
}

export async function login(username: string, password: string) {
  return request<{ username: string; role: string }>("/api/backend/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function getInventory() {
  const [inventory, products] = await Promise.all([
    request<{ data: InventoryApiItem[] }>("/api/backend/data/inventory?page=1&page_size=100"),
    request<{ data: ProductApiItem[] }>("/api/backend/data/products?page=1&page_size=100"),
  ]);
  const productMap = new Map(products.data.map(product => [product.sku, product]));
  return { items: inventory.data.map(item => ({
    warehouse_code: String(item.ma_kho), warehouse_name: `Kho #${item.ma_kho}`, sku: item.sku,
    product_name: productMap.get(item.sku)?.ten_sp ?? item.sku, unit: productMap.get(item.sku)?.don_vi ?? "cái",
    quantity: item.so_luong_ton, location: null, status: item.so_luong_ton === 0 ? "Hết hàng" : "Còn hàng",
  })) };
}

async function page<T>(resource: string) {
  return request<Page<T>>(`/api/backend/data/${resource}?page=1&page_size=100`);
}

export async function getWarehouseOptions() {
  return request<{ warehouses: WarehouseOption[]; suppliers: SupplierOption[]; products: ProductOption[] }>("/api/backend/warehouse/options");
}

export async function getDispatches() {
  return request<{ id: string; recordId: string; order: string; warehouse: string; items: string; created: string; status: string; receiver: string }[]>("/api/backend/warehouse/dispatches");
}

export async function dispatchOrder(orderId: string) {
  return request<{ ma_donhang: string; trang_thai: string; nguoi_xuat: string }>(`/api/backend/warehouse/dispatches/${encodeURIComponent(orderId)}/dispatch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN").format(date);
}

function receiptStatus(value: string) {
  return ({ NHAP: "Nháp", DA_NHAP: "Đã nhập", HUY: "Đã hủy" } as Record<string, string>)[value] ?? value;
}

function transferStatus(value: string) {
  return ({ NHAP: "Nháp", DANG_CHUYEN: "Đang chuyển", DA_NHAN: "Đã nhận", HUY: "Đã hủy" } as Record<string, string>)[value] ?? value;
}

export async function getProducts() {
  const [products, inventory] = await Promise.all([page<ProductApiItem>("products"), page<InventoryApiItem>("inventory")]);
  const quantities = new Map<string, number>();
  inventory.data.forEach(item => quantities.set(item.sku, (quantities.get(item.sku) ?? 0) + item.so_luong_ton));
  return products.data.map(product => {
    const quantity = quantities.get(product.sku) ?? 0;
    return { id: product.ma_sp, name: product.ten_sp, code: product.sku, category: "—", brand: "—", quantity, status: quantity > 0 ? "Còn hàng" : "Hết hàng" };
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
    return { id: receipt.ma_phieu_code, recordId: receipt.ma_phieu_nhap, supplier: supplierMap.get(receipt.ma_ncc) ?? `NCC #${receipt.ma_ncc}`, warehouse: warehouseMap.get(receipt.ma_kho) ?? `Kho #${receipt.ma_kho}`, items: `${receiptLines.length} SKU · ${totalQuantity} SP`, created: formatDate(receipt.ngay_tao), status: receiptStatus(receipt.trang_thai) };
  });
}

export async function getReceiptDraft(receiptId: number) {
  const [receipts, lines] = await Promise.all([page<ReceiptApiItem>("receipts"), page<ReceiptLineApiItem>("receipt-lines")]);
  const receipt = receipts.data.find(item => item.ma_phieu_nhap === receiptId);
  if (!receipt) throw new Error("Không tìm thấy phiếu nhập.");
  return { supplier_id: receipt.ma_ncc, warehouse_id: receipt.ma_kho, note: receipt.ghi_chu ?? "", lines: lines.data.filter(line => line.ma_phieu_nhap === receiptId).map(line => ({ sku: line.sku, quantity: line.so_luong_nhap, unit_price: Number(line.gia_nhap ?? 0) })) };
}

export async function confirmReceipt(receiptId: number) {
  return request<{ ma_phieu_nhap: number; ma_phieu_code: string; ma_kho: number; trang_thai: string; nguoi_xac_nhan: string }>(`/api/backend/warehouse/receipts/${receiptId}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

export async function cancelReceipt(receiptId: number) {
  return request<{ ma_phieu_nhap: number; ma_phieu_code: string; trang_thai: string }>(`/api/backend/warehouse/receipts/${receiptId}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
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
      id: item.id, type: "Phiếu nhập", partner: item.supplier, items: item.items, created: item.created, status: item.status,
    })),
    ...transfers.filter(item => ["Nháp", "Đang chuyển"].includes(String(item.status))).map(item => ({
      id: item.id, type: "Chuyển kho", partner: `${item.from} → ${item.to}`, items: item.items, created: item.created, status: item.status,
    })),
  ];
}

export async function getHistory() {
  const movements = await page<{ ma_lich_su: number; sku: string; loai_giao_dich: string; so_luong_thay_doi: number; nguoi_thuc_hien?: string | null; tao_luc: string; ma_tham_chieu?: string | null }>("stock-movements");
  return movements.data.map(item => ({
    id: item.ma_tham_chieu ? `${item.loai_giao_dich}-${item.ma_tham_chieu}` : `LS-${item.ma_lich_su}`,
    type: ({ NHAP_KHO: "Nhập kho", XUAT_CHUYEN_KHO: "Xuất chuyển kho", NHAN_CHUYEN_KHO: "Nhận chuyển kho", XUAT_DON_HANG: "Xuất đơn hàng" } as Record<string, string>)[item.loai_giao_dich] ?? item.loai_giao_dich,
    product: item.sku, quantity: item.so_luong_thay_doi > 0 ? `+${item.so_luong_thay_doi}` : String(item.so_luong_thay_doi), user: item.nguoi_thuc_hien ?? "—", created: formatDate(item.tao_luc),
  }));
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

export function hasApiToken() {
  return true;
}

