export type Choice = { ma_lua_chon: string; noi_dung: string; cho_phep_nhap_khac: boolean; thu_tu: number };
export type Question = { ma_cau_hoi: string; noi_dung: string; loai_cau_hoi: "MOT_LUA_CHON" | "DIEM_1_5" | "VAN_BAN";
  nhom_noi_dung: "CHUNG" | "SO_THICH" | "HAI_LONG"; bat_buoc: boolean; options: Choice[] };
export type Survey = { ma_khao_sat: string; tieu_de: string; mo_ta: string; trang_thai: "NHAP" | "DANG_MO" | "DONG";
  loai_doi_tuong: "TAT_CA" | "DO_TUOI" | "CHUA_NGAY_SINH"; tuoi_tu: number | null; tuoi_den: number | null;
  han_tra_loi: string; phien_ban: string; ngay_tao: string; ngay_chot_doi_tuong?: string | null; khach_them?: string[]; khach_loai?: string[] };
export type SurveyAudience = Pick<Survey, "loai_doi_tuong" | "tuoi_tu" | "tuoi_den"> & { khach_them?: string[]; khach_loai?: string[] };
export type Answer = { ma_cau_hoi: string; ma_lua_chon?: string | null; diem?: number | null; noi_dung?: string | null };
export type SurveyDetail = { survey: Survey; questions: Question[]; recipient: { ma_gui: string; hoan_thanh_luc: string | null } | null; answers: Answer[] };
export type Page<T> = { data: T[]; total: number; page: number; page_size: number };
export type SurveyItem = Survey & { da_gui: number; da_tra_loi: number; hoan_thanh_luc: string | null };
export type DraftQuestion = Pick<Question, "noi_dung" | "loai_cau_hoi" | "nhom_noi_dung" | "bat_buoc"> & {
  options: { noi_dung: string; cho_phep_nhap_khac: boolean }[] };
export type SurveyDraft = Pick<Survey, "tieu_de" | "mo_ta" | "loai_doi_tuong" | "tuoi_tu" | "tuoi_den" | "han_tra_loi"> & { questions: DraftQuestion[]; khach_them?: string[]; khach_loai?: string[] };
export type AudiencePreview = Page<{ ma_kh: string; ten_kh: string; tuoi: number | null; added_manually: boolean }> & { selected_total: number; unavailable_added_ids: string[] };
export type Preview = Page<{ ma_kh: string; ten_kh: string; tuoi: number | null }> & { phien_ban: string; is_snapshot: boolean };
export type Statistics = { survey: Survey; sent: number; completed: number; text_page: number; page_size: number;
  questions: (Omit<Question, "options"> & { answered: number; average: number | null; options: { ma_lua_chon: string; noi_dung: string; count: number }[];
    scores: { score: number; count: number }[]; texts: string[]; text_total: number })[] };
export type SurveyRespondent = { ma_gui: string; ma_kh: string; ten_kh: string; tuoi: number | null; luu_tru_luc: string | null;
  hoan_thanh_luc: string; answers: { ma_cau_hoi: string; cau_hoi: string; nhom_noi_dung: Question["nhom_noi_dung"];
    lua_chon: string | null; noi_dung: string | null; diem: number | null }[] };
export type SurveyResults = { statistics: Statistics; creator: { ma_tk: string; ho_ten: string } | null;
  respondents: Page<SurveyRespondent> };
export const surveyResultsHref = (id: string) => `/surveys/${encodeURIComponent(id)}/results`;
export type Review = { ma_danh_gia: string; ma_kh: string; ma_sp: string; ma_donhang: string; so_sao: number;
  noi_dung: string; trang_thai: "HIEN_THI" | "AN"; phien_ban: string; ngay_tao: string; cap_nhat_luc: string;
  ten_kh?: string; ten_sp?: string };
export type EligibleReview = { ma_donhang: string; ma_sp: string; ten_sp: string; sku: string; thoi_gian_dat: string;
  ma_danh_gia: string | null; so_sao: number | null; noi_dung: string | null; trang_thai: Review["trang_thai"] | null; phien_ban: string | null };
export type PublicReviews = Page<{ author: string; so_sao: number; noi_dung: string; ngay_tao: string }> & {
  average: number | null; stars: { stars: number; count: number }[] };
export type CrmReport = { as_of: string; total_customers: number; age_groups: { label: string; count: number }[];
  review_stars: { stars: number; count: number }[]; review_status: { pending: number; visible: number; hidden: number };
  interest_surveys: { ma_khao_sat: string; tieu_de: string }[] };
export type InterestSurvey = { ma_khao_sat: string; tieu_de: string };
export type InterestAnswer = InterestSurvey & { ma_tra_loi: string; ma_kh: string; ten_kh: string; tuoi: number | null;
  ma_cau_hoi: string; cau_hoi: string; loai_cau_hoi: Question["loai_cau_hoi"]; lua_chon: string | null;
  noi_dung: string | null; diem: number | null; hoan_thanh_luc: string };
export type InterestSummary = InterestSurvey & { ma_cau_hoi: string; cau_hoi: string; loai_cau_hoi: Question["loai_cau_hoi"];
  answered: number; options: { label: string; count: number }[] };
export type CustomerInterests = Page<InterestAnswer> & { customers: number; survey_count: number; question_count: number;
  summaries: InterestSummary[]; surveys: InterestSurvey[] };
export const surveyStatus = { NHAP: "Bản nháp", DANG_MO: "Đã phát hành", DONG: "Đã đóng" };
export const reviewStatus = { HIEN_THI: "Đang hiển thị", AN: "Đã ẩn" };
export function surveyCanAnswer(detail: SurveyDetail): boolean {
  return Boolean(detail.recipient && !detail.recipient.hoan_thanh_luc && detail.survey.trang_thai === "DANG_MO" && Date.parse(detail.survey.han_tra_loi) > Date.now());
}
export function jsonBody(body: unknown): RequestInit {
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
export async function engagementRequest<T>(path: string, options: RequestInit = {}, requester: typeof fetch = fetch): Promise<T> {
  const response = await requester("/api/backend/" + path, { credentials: "same-origin", cache: "no-store", ...options });
  let body;
  try { body = await response.json(); } catch { throw new Error("API trả dữ liệu không hợp lệ. Hãy thử lại cùng thao tác."); }
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : Array.isArray(body?.detail)
    ? body.detail.map((e: { msg: string }) => e.msg).join("; ") : "Không thể xử lý yêu cầu. Hãy thử lại cùng thao tác.");
  return body as T;
}
export function dateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
}
