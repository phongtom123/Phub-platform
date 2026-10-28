"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminFetch, sameAdminData } from "@/src/lib/admin-fetch";
import { useAdminPolling } from "@/src/lib/use-admin-polling";
import { dataHref } from "@/src/lib/data-navigation";
import "./support.css";
import { SupportThread } from "../operations/support-thread";

const statuses: Record<string, string> = { MOI: "Mới tiếp nhận", DANG_XU_LY: "Đang xử lý", DA_GIAI_QUYET: "Đã giải quyết", DA_DONG: "Đã đóng" };
const priorities: Record<string, string> = { THAP: "Thấp", BINH_THUONG: "Bình thường", CAO: "Cao", KHAN_CAP: "Khẩn cấp" };
type Ticket = { ma_phan_hoi: string; ma_kh: string; ten_kh: string | null; tieu_de: string; noi_dung: string;
  ma_sp: string | null; ma_donhang: string | null; trang_thai: string; muc_do_uu_tien: string; nguoi_xu_ly: string | null;
  ten_nguoi_xu_ly: string | null; phan_hoi_quan_ly: string | null; ngay_phan_hoi: string | null; ngay_tao: string; cap_nhat_luc: string };
type TicketPage = { data: Ticket[]; total: number; page: number; page_size: number };
const ticketCode = (id: string) => `PH-${id.slice(0, 8).toUpperCase()}`;
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await adminFetch("/api/backend/crm/feedback" + path, options);
  const body = await response.json().catch(() => null);
  if (response.status === 404 && ["Not Found", "Endpoint không tồn tại."].includes(body?.detail)) {
    throw new Error("Backend chưa có API hỗ trợ khách hàng. Cần cập nhật backend mới.");
  }
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : Array.isArray(body?.detail)
    ? body.detail.map((e: { msg: string }) => e.msg).join("; ") : "Không thể truy cập ticket hỗ trợ.");
  return body;
}

export default function SupportView() {
  const router = useRouter(), params = useSearchParams(), id = params.get("ticket");
  const validId = id && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<TicketPage | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [listLoading, setListLoading] = useState(true), [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState(""), [detailError, setDetailError] = useState("");
  const [saveError, setSaveError] = useState(""), [notice, setNotice] = useState("");
  const [reply, setReply] = useState(""), [draftStatus, setDraftStatus] = useState(""), [draftPriority, setDraftPriority] = useState("");
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0), [listVersion, setListVersion] = useState(0);
  const write = useRef<AbortController | null>(null);
  const dirty = Boolean(ticket && (reply !== (ticket.phan_hoi_quan_ly ?? "") || draftStatus !== ticket.trang_thai || draftPriority !== ticket.muc_do_uu_tien));
  const queryString = new URLSearchParams({ page: String(page), page_size: "20", q: query, ...(status ? { status } : {}), ...(priority ? { priority } : {}) }).toString();

  function adopt(value: Ticket) { setTicket(value); setReply(value.phan_hoi_quan_ly ?? ""); setDraftStatus(value.trang_thai); setDraftPriority(value.muc_do_uu_tien); }
  useEffect(() => {
    const controller = new AbortController(); setListLoading(true); setListError("");
    api<TicketPage>("?" + queryString, { signal: controller.signal, cache: version || listVersion ? "reload" : "no-store" })
      .then(result => { if (!controller.signal.aborted) setList(result); })
      .catch(e => { if (!controller.signal.aborted) setListError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [queryString, version, listVersion]);
  useEffect(() => {
    const controller = new AbortController(); write.current?.abort(); write.current = null;
    setSaving(false); setTicket(null); setSaveError(""); setNotice(""); setDetailError("");
    if (!id) { setDetailLoading(false); return; }
    if (!validId) { setDetailError("Mã ticket không hợp lệ."); setDetailLoading(false); return; }
    setDetailLoading(true);
    api<Ticket>("/" + id, { signal: controller.signal, cache: version ? "reload" : "no-store" })
      .then(result => { if (!controller.signal.aborted) adopt(result); })
      .catch(e => { if (!controller.signal.aborted) setDetailError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => { controller.abort(); write.current?.abort(); };
  }, [id, validId, version]);
  const pollError = useAdminPolling(`${queryString}:${id}`, !saving && !dirty && !listLoading && !detailLoading && !listError && !detailError,
    async (signal, canApply) => {
      const result = await api<TicketPage>("?" + queryString, { signal, cache: "no-cache" });
      if (canApply()) setList(current => sameAdminData(current, result) ? current : result);
      if (validId) {
        const fresh = await api<Ticket>("/" + id, { signal, cache: "no-cache" });
        if (canApply()) adopt(fresh);
      }
    });

  function selectTicket(next: string | null) {
    if (saving || dirty && !window.confirm("Bỏ các thay đổi chưa lưu để chuyển ticket?")) return;
    router.push(next ? `/support?ticket=${encodeURIComponent(next)}` : "/support", { scroll: false });
  }
  async function save(event?: FormEvent, claim = false) {
    event?.preventDefault();
    if (!ticket || saving || write.current) return;
    const patch: Record<string, string | boolean | null> = {};
    if (reply !== (ticket.phan_hoi_quan_ly ?? "")) patch.phan_hoi_quan_ly = reply.trim() || null;
    if (draftStatus !== ticket.trang_thai) patch.trang_thai = draftStatus;
    if (draftPriority !== ticket.muc_do_uu_tien) patch.muc_do_uu_tien = draftPriority;
    if (claim) { patch.nhan_xu_ly = true; patch.trang_thai = "DANG_XU_LY"; }
    if (!Object.keys(patch).length) return;
    const controller = new AbortController(); write.current = controller;
    setSaving(true); setSaveError(""); setNotice("");
    try {
      const result = await api<Ticket>("/" + ticket.ma_phan_hoi, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch), signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.ma_phan_hoi !== ticket.ma_phan_hoi) throw new Error("API trả về ticket không khớp.");
      adopt(result); setNotice(claim ? "Đã nhận xử lý ticket." : "Đã lưu kết quả xử lý.");
      setListVersion(v => v + 1); // Refresh only the inbox; keep the saved detail mounted.
    } catch (e) { if (!controller.signal.aborted) setSaveError((e as Error).message); }
    finally { if (!controller.signal.aborted) { setSaving(false); write.current = null; } }
  }

  return <section className="live-data support-page" aria-label="Hỗ trợ khách hàng">
    {pollError && <p className="live-error" role="alert">Tự cập nhật tạm lỗi; đang giữ dữ liệu lần trước. {pollError}</p>}
    <form className="live-tools support-filters" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}>
      <input aria-label="Tìm ticket" value={search} maxLength={100} placeholder="Tìm mã thẻ, tiêu đề, nội dung…" onChange={e => setSearch(e.target.value)} />
      <select aria-label="Lọc trạng thái" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
      <select aria-label="Lọc ưu tiên" value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}><option value="">Tất cả ưu tiên</option>{Object.entries(priorities).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
      <button type="submit">Tìm kiếm</button>
      <button type="button" disabled={saving || dirty} onClick={() => setVersion(v => v + 1)}>Làm mới</button>
    </form>
    <div className={`support-layout ${id ? "has-selection" : ""}`}>
      <section className="support-inbox" aria-label="Danh sách ticket">
        <div className="support-inbox-heading"><h2>Hộp thư hỗ trợ</h2><span>{list ? `${list.total} kết quả` : ""}{listLoading && list ? " · Đang cập nhật…" : ""}</span></div>
        {listError && <p className="live-error" role="alert">{listError} <button onClick={() => setListVersion(v => v + 1)}>Thử lại</button></p>}
        {listLoading && !list ? <p role="status">Đang tải ticket…</p> : !listError && list && <>
          {!list.data.length ? <div className="support-empty"><h3>Chưa có ticket phù hợp</h3><p>Phản hồi gửi qua API khách hàng sẽ xuất hiện tại đây. Không sử dụng dữ liệu mẫu thay thế.</p></div> :
          <div className="support-ticket-list">{list.data.map(item => <button key={item.ma_phan_hoi} type="button" disabled={saving}
            className={`support-ticket ${id === item.ma_phan_hoi ? "selected" : ""}`} onClick={() => selectTicket(item.ma_phan_hoi)}>
            <span className="support-ticket-line"><strong>{ticketCode(item.ma_phan_hoi)}</strong><span className={`support-badge status-${item.trang_thai}`}>{statuses[item.trang_thai]}</span></span>
            <b className="support-subject">{item.tieu_de}</b><span>{item.ten_kh ?? item.ma_kh}</span>
            <span className="support-ticket-line"><small>{time(item.ngay_tao)}</small><span className={`support-priority priority-${item.muc_do_uu_tien}`}>{priorities[item.muc_do_uu_tien]}</span></span>
          </button>)}</div>}
          <div className="live-tools"><span>Trang {page}</span><button disabled={page <= 1 || listLoading} onClick={() => setPage(p => p - 1)}>Trước</button>
            <button disabled={page * 20 >= list.total || listLoading} onClick={() => setPage(p => p + 1)}>Sau</button></div>
        </>}
      </section>
      <section className="support-detail" aria-label="Chi tiết ticket">
        {!id ? <div className="support-empty"><h2>Chọn một ticket</h2><p>Xem nội dung, nhận xử lý và phản hồi cho khách tại đây.</p></div> : <>
          <div className="support-detail-actions"><button type="button" disabled={saving} onClick={() => selectTicket(null)}>← Danh sách ticket</button>
            {ticket && <button className="live-primary" type="button" disabled={saving} onClick={() => void save(undefined, true)}>Nhận xử lý</button>}</div>
          {detailError && <p className="live-error" role="alert">{detailError}</p>}
          {detailLoading && <p role="status">Đang tải nội dung…</p>}
          {ticket && !detailLoading && !detailError && <>
            <div className="support-ticket-line"><strong>{ticketCode(ticket.ma_phan_hoi)}</strong><span className={`support-badge status-${ticket.trang_thai}`}>{statuses[ticket.trang_thai]}</span></div>
            <h2 className="support-title">{ticket.tieu_de}</h2>
            <dl className="support-meta"><div><dt>Khách hàng</dt><dd><Link href={dataHref("customers", { key: JSON.stringify([ticket.ma_kh]) })}>{ticket.ten_kh ?? ticket.ma_kh}</Link></dd></div>
              <div><dt>Người xử lý</dt><dd>{ticket.ten_nguoi_xu_ly ?? ticket.nguoi_xu_ly ?? "Chưa phân công"}</dd></div>
              <div><dt>Ngày tiếp nhận</dt><dd>{time(ticket.ngay_tao)}</dd></div><div><dt>Cập nhật lần cuối</dt><dd>{time(ticket.cap_nhat_luc)}</dd></div>
              {ticket.ma_sp && <div><dt>Sản phẩm</dt><dd><Link href={dataHref("products", { key: JSON.stringify([ticket.ma_sp]) })}>{ticket.ma_sp}</Link></dd></div>}
              {ticket.ma_donhang && <div><dt>Đơn hàng</dt><dd><Link href={dataHref("orders", { key: JSON.stringify([ticket.ma_donhang]) })}>{ticket.ma_donhang}</Link></dd></div>}
            </dl>
            <section className="support-content"><h3>Nội dung khách gửi</h3><p>{ticket.noi_dung}</p></section>
            <SupportThread key={ticket.ma_phan_hoi} ticketId={ticket.ma_phan_hoi} version={ticket.cap_nhat_luc} />
            <form className="support-response" onSubmit={save}>
              <fieldset disabled={saving}><div className="support-control-grid">
                <label>Trạng thái xử lý<select aria-label="Trạng thái xử lý" value={draftStatus} onChange={e => setDraftStatus(e.target.value)}>{Object.entries(statuses).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
                <label>Mức độ ưu tiên<select aria-label="Mức độ ưu tiên" value={draftPriority} onChange={e => setDraftPriority(e.target.value)}>{Object.entries(priorities).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
              </div><label>Phản hồi gửi khách<textarea aria-label="Phản hồi gửi khách" value={reply} maxLength={10000} rows={6} placeholder="Nhập kết quả tư vấn hoặc hướng xử lý…" onChange={e => setReply(e.target.value)} /></label>
                <p className="support-help">Phản hồi mới được lưu vào lịch sử trao đổi và hiển thị cho khách. Phần này hiển thị phản hồi quản trị gần nhất.</p>
                {ticket.ngay_phan_hoi && <p className="support-help">Lần phản hồi gần nhất: {time(ticket.ngay_phan_hoi)}</p>}
              </fieldset>
              {saveError && <p className="live-error" role="alert">{saveError}</p>}{notice && <p className="live-note" role="status">{notice}</p>}
              <button className="live-primary" disabled={saving || !dirty}>{saving ? "Đang lưu…" : "Lưu xử lý"}</button>
            </form>
          </>}
        </>}
      </section>
    </div>
  </section>;
}
