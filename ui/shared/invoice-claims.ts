export type ClaimTicket = {
  ma_phan_hoi: string; ma_kh: string; ten_kh: string | null; noi_dung: string;
  ma_hoa_don_yeu_cau: string; ma_donhang: string | null; trang_thai: string;
  phien_ban_lien_ket: string; ket_qua_lien_ket: "DA_LIEN_KET" | "TU_CHOI" | null;
  ngay_tao: string; xac_minh_luc: string | null; tai_khoan_xac_minh: string | null; ghi_chu_xac_minh: string | null;
};
export type ClaimDetail = {
  ticket: ClaimTicket;
  customer: { ma_kh: string; ten_kh: string; sdt: string | null; tai_khoan: string | null };
  invoice: { ma_hoadon: string; ma_donhang: string; ten_nguoi_mua: string; sdt_nguoi_nhan: string | null;
    tong_tien_sau_thue: number | string; thoi_gian_lap: string; trang_thai: string; kenh_ban: string } | null;
  invoice_version?: string; can_link: boolean; reason: string | null;
};
export async function staffRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/staff/${path}`, { ...init, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail :
    Array.isArray(body?.detail) ? body.detail.map((e: {msg: string}) => e.msg).join("; ") :
      "Không thực hiện được yêu cầu. Hãy kiểm tra kết nối và thử lại.");
  return body;
}
export const claimLabel = (value: ClaimTicket["ket_qua_lien_ket"]) => value === "DA_LIEN_KET" ? "Đã liên kết" : value === "TU_CHOI" ? "Từ chối" : "Chờ xác minh";
