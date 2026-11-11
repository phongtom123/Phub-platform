import type { DataColumn } from "./inline-table-data";

const hiddenColumns: Record<string, string[]> = {
  customers: ["ngay_tao", "cap_nhat_luc", "luu_tru_luc", "tinh_thanh_md", "xa_phuong_md"],
  products: ["mo_ta", "duong_dan_anh"],
  invoices: ["tong_tien_giam"],
  receipts: ["ghi_chu"], transfers: ["ghi_chu"],
  promotions: ["ngay_tao", "ma_media_banner"], vouchers: ["ngay_tao"],
};

const leadingColumns: Record<string, string[]> = {
  invoices: [
    "ma_hoadon", "ma_donhang",
    "ten_nguoi_mua", "ma_so_thue", "dia_chi_nguoi_mua",
    "tong_tien_truoc_thue", "tong_tien_thue", "tong_tien_sau_thue",
    "nguon_lap", "nguoi_lap", "ma_tk_lap",
  ],
  payments: [
    "ma_thanh_toan", "ma_donhang", "ma_giao_dich",
    "loai_giao_dich", "phuong_thuc", "so_tien", "trang_thai",
    "la_bypass", "ma_tk_ghi_nhan", "thoi_gian",
  ],
};

const trailingColumns: Record<string, string[]> = {
  invoices: ["thoi_gian_lap", "han_thanh_toan", "huy_qua_han_luc"],
};

function orderColumns(resource: string, columns: DataColumn[]): DataColumn[] {
  const leading = leadingColumns[resource] ?? [];
  const trailing = trailingColumns[resource] ?? [];
  if (!leading.length && !trailing.length) return columns;

  const byName = new Map(columns.map(column => [column.name, column]));
  const positioned = new Set([...leading, ...trailing]);
  return [
    ...leading.flatMap(name => byName.get(name) ?? []),
    ...columns.filter(column => !positioned.has(column.name)),
    ...trailing.flatMap(name => byName.get(name) ?? []),
  ];
}

export function listDataColumns(resource: string, columns: DataColumn[]): DataColumn[] {
  const visible = columns.filter(column => !hiddenColumns[resource]?.includes(column.name));
  return orderColumns(resource, visible);
}
