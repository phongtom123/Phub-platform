import { vietnamDate } from "../../../shared/customer-age";
export { customerAge, vietnamDate } from "../../../shared/customer-age";

export type Customer = {
  ma_kh: string; ten_kh: string; sdt: string | null; dia_chi_chi_tiet_md: string | null;
  tinh_thanh_md: string | null; xa_phuong_md: string | null; ngay_sinh: string | null;
  ngay_tao: string | null; cap_nhat_luc: string | null; luu_tru_luc: string | null;
};
export type CustomerDetail = {
  profile: Customer;
  account: { ma_tk: string; ten_tai_khoan: string; email: string | null; trang_thai: number } | null;
};
export type CustomerOrderPage = {
  data: { ma_donhang: string; trang_thai: string; kenh_ban: string; thoi_gian_dat: string }[];
  total: number; page: number; page_size: number;
};
export const customerFields = {
  ten_kh: "Tên khách hàng", sdt: "Số điện thoại", ngay_sinh: "Ngày sinh",
  dia_chi_chi_tiet_md: "Địa chỉ mặc định", tinh_thanh_md: "Tỉnh / thành phố", xa_phuong_md: "Xã / phường",
} as const;
export type CustomerField = keyof typeof customerFields;
export function customerIdFromKey(key: string): string | null {
  try {
    const ids: unknown = JSON.parse(key);
    return Array.isArray(ids) && ids.length === 1 && typeof ids[0] === "string" && ids[0].trim().length > 0 && ids[0].length <= 200 ? ids[0] : null;
  } catch { return null; }
}
export function customerPatch(data: CustomerDetail, draft: Record<CustomerField, string>) {
  const patch: Record<string, string | null> = {};
  for (const key of Object.keys(customerFields) as CustomerField[]) {
    const value = draft[key].trim();
    if (key === "ten_kh" && !value) throw new Error("Tên khách hàng không được để trống.");
    if (key === "ngay_sinh" && value && value > vietnamDate()) throw new Error("Ngày sinh không được ở tương lai.");
    if ((value || null) !== (data.profile[key] || null)) patch[key] = value || null;
  }
  return patch;
}
