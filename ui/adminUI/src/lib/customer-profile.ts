export type Customer = {
  ma_kh: string; ten_kh: string; sdt: string | null; dia_chi_chi_tiet_md: string | null;
  tinh_thanh_md: string | null; xa_phuong_md: string | null; ngay_sinh: string | null;
  ngay_tao: string | null; cap_nhat_luc: string | null; luu_tru_luc: string | null;
};
export type CustomerDetail = {
  profile: Customer;
  account: { ma_tk: string; ten_tai_khoan: string; email: string | null; trang_thai: number } | null;
  so_thich: string[];
  danh_muc_so_thich: { ma_so_thich: string; ten_so_thich: string; trang_thai: number }[];
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
export function vietnamDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)?.value).join("-");
}
export function customerAge(birthday: string | null, today = vietnamDate()): number | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday) || birthday > today) return null;
  const [year, month, day] = birthday.split("-").map(Number), [y, m, d] = today.split("-").map(Number);
  return y - year - (m < month || (m === month && d < day) ? 1 : 0);
}
export function customerPatch(data: CustomerDetail, draft: Record<CustomerField, string>, selected: string[]) {
  const patch: Record<string, string | string[] | null> = {};
  for (const key of Object.keys(customerFields) as CustomerField[]) {
    const value = draft[key].trim();
    if (key === "ten_kh" && !value) throw new Error("Tên khách hàng không được để trống.");
    if (key === "ngay_sinh" && value && value > vietnamDate()) throw new Error("Ngày sinh không được ở tương lai.");
    if ((value || null) !== (data.profile[key] || null)) patch[key] = value || null;
  }
  if (JSON.stringify([...new Set(selected)].sort()) !== JSON.stringify([...data.so_thich].sort())) patch.so_thich = [...new Set(selected)].sort();
  return patch;
}
