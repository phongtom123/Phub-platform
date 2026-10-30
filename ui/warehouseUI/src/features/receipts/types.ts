export type ReceiptHeader = {
  ma_phieu_nhap: number; ma_phieu_code: string; ma_ncc: number; ma_kho: number;
  supplier_name: string; ngay_tao: string; ngay_nhap: string | null;
  trang_thai: "NHAP" | "DA_NHAP" | "HUY"; ghi_chu: string | null;
  dinh_gia_da_ap_dung?: boolean;
  nguoi_tao: string; nguoi_xac_nhan: string | null; nguoi_cap_nhat: string | null;
};
export type ReceiptLine = { sku: string; product_name: string; quantity: number; unit_price: string; unit: string; pricing?: import("../../../../shared/pricing").Price | null };
export type Receipt = { receipt: ReceiptHeader; lines: ReceiptLine[]; version: string; replayed: boolean };
export type Page<T> = { data: T[]; total: number; page: number; page_size: number; warehouse_id?: number };
export type ReceiptListItem = ReceiptHeader & { creator_name: string | null; line_count: number };
