import type { DataColumn } from "./inline-table-data";

const hiddenColumns: Record<string, string[]> = {
  customers: ["ngay_tao", "cap_nhat_luc", "luu_tru_luc"],
  products: ["mo_ta", "duong_dan_anh"],
  invoices: ["tong_tien_giam"],
  receipts: ["ghi_chu"], transfers: ["ghi_chu"],
  promotions: ["ngay_tao", "ma_media_banner"], vouchers: ["ngay_tao"],
};

export function listDataColumns(resource: string, columns: DataColumn[]): DataColumn[] {
  const visible = columns.filter(column => !hiddenColumns[resource]?.includes(column.name));
  if (resource !== "invoices") return visible;
  return visible.filter(column => !["nguoi_lap", "thoi_gian_lap"].includes(column.name))
    .flatMap(column => column.name === "ma_donhang" ? [column, ...visible.filter(item => item.name === "nguoi_lap")] : [column])
    .concat(visible.filter(column => column.name === "thoi_gian_lap"));
}
