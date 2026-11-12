"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ShoppingBag } from "lucide-react";
import { adminFetch, sameAdminData } from "@internal/lib/admin-fetch";
import { useAdminPolling } from "@internal/lib/use-admin-polling";
import { dataHref } from "@internal/lib/data-navigation";
import { customerAge, customerFields, customerIdFromKey, customerPatch, vietnamDate,
  type CustomerDetail as Detail, type CustomerField, type CustomerOrderPage } from "@internal/lib/customer-profile";
import { CustomerProfileView } from "./customer-profile-view";
import { CustomerArchiveButton } from "./customer-archive-button";
import { accountApi, jsonRequest } from "../accounts/api";
import { statusLabels, type Account, type AccountStatus } from "../accounts/types";
import { ScrollableTable } from "../tables/scrollable-table";
import styles from "./customer-detail.module.css";

const fields = Object.keys(customerFields) as CustomerField[];
const orderStatus: Record<string, string> = { MOI: "Mới", XAC_NHAN: "Đã xác nhận", DANG_CHUAN_BI: "Đang chuẩn bị", DA_XUAT_KHO: "Đã xuất kho", HOAN_THANH: "Hoàn thành", HUY: "Đã hủy" };
const displayDate = (value: string | null, dateOnly = false) => !value ? "Chưa có thông tin" :
  dateOnly ? value.split("-").reverse().join("/") : new Date(
    /(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + "+07:00",
  ).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await adminFetch("/api/backend/" + path, options);
  const body = await response.json();
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((e: { msg: string }) => e.msg).join("; ") :
      response.status === 404 ? "Backend chưa có API hồ sơ CRM hoặc khách hàng không tồn tại. Cần kiểm tra phiên bản backend." : "Không thể tải hồ sơ CRM.");
  }
  return body;
}

export function CustomerDetail({ recordKey, editMode }: { recordKey: string; editMode: boolean }) {
  const router = useRouter();
  const id = customerIdFromKey(recordKey);
  const path = `crm/customers/${encodeURIComponent(id ?? "")}`;
  const [data, setData] = useState<Detail | null>(null);
  const profile = data?.profile;
  const [draft, setDraft] = useState<Record<CustomerField, string>>({ ten_kh: "", sdt: "", ngay_sinh: "", dia_chi_chi_tiet_md: "", tinh_thanh_md: "", xa_phuong_md: "" });
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const archiveSaving = useCallback((value: boolean) => { setArchiving(value); if (value) { setNotice(""); setStatusError(""); } }, []);
  const [version, setVersion] = useState(0);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orders, setOrders] = useState<CustomerOrderPage | null>(null);
  const [ordersError, setOrdersError] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [page, setPage] = useState(1);
  const saveController = useRef<AbortController | null>(null);
  const statusController = useRef<AbortController | null>(null);
  const detailHref = dataHref("customers", { key: recordKey });
  useEffect(() => () => saveController.current?.abort(), []);
  useEffect(() => {
    setStatusSaving(false); setStatusError("");
    return () => { statusController.current?.abort(); statusController.current = null; };
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    if (!id) { setError("Mã hồ sơ không hợp lệ. Hãy chọn một khách từ danh sách."); setLoading(false); return; }
    request<Detail>(path, { signal: controller.signal, cache: version ? "reload" : "no-store" })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, path, version]);

  useEffect(() => {
    if (profile && editMode) {
      setDraft(Object.fromEntries(fields.map(field => [field, profile[field] ?? ""])) as Record<CustomerField, string>);
      setSaveError("");
    }
  }, [editMode, profile]);

  useEffect(() => {
    if (!ordersOpen || !id) return;
    const controller = new AbortController();
    setOrdersLoading(true); setOrdersError("");
    request<CustomerOrderPage>(`${path}/orders?page=${page}&page_size=10`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setOrders(result); })
      .catch(reason => { if (!controller.signal.aborted) setOrdersError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setOrdersLoading(false); });
    return () => controller.abort();
  }, [id, path, ordersOpen, page, version]);

  const pollError = useAdminPolling(`${path}:${page}:${ordersOpen}`, Boolean(data) && !loading && !error && !editMode && !saving && !statusSaving && !archiving,
    async (signal, canApply) => {
      const fresh = await request<Detail>(path, { signal, cache: "no-cache" });
      if (canApply()) setData(current => sameAdminData(current, fresh) ? current : fresh);
      if (ordersOpen) {
        const history = await request<CustomerOrderPage>(`${path}/orders?page=${page}&page_size=10`, { signal, cache: "no-cache" });
        if (canApply()) setOrders(current => sameAdminData(current, history) ? current : history);
      }
    });

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!data || saving || archiving || data.profile.luu_tru_luc || saveController.current || statusController.current) return;
    setSaveError(""); setNotice("");
    let patch;
    try { patch = customerPatch(data, draft); }
    catch (cause) { setSaveError((cause as Error).message); return; }
    if (!Object.keys(patch).length) { setSaveError("Chưa có thay đổi."); return; }
    const controller = new AbortController(); saveController.current = controller; setSaving(true);
    try {
      const result = await request<Detail>(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch), signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.profile.ma_kh !== id) throw new Error("API trả về hồ sơ không khớp khách đang sửa.");
      setData(result); setNotice("Đã lưu hồ sơ khách hàng.");
      router.replace(detailHref, { scroll: false });
    } catch (cause) { if (!controller.signal.aborted) setSaveError((cause as Error).message); }
    finally { if (!controller.signal.aborted) { saveController.current = null; setSaving(false); } }
  }

  async function changeAccountStatus(value: AccountStatus) {
    if (!data?.account || saving || archiving || data.profile.luu_tru_luc || statusController.current || ![0, 1, 2].includes(value) || value === data.account.trang_thai) return;
    const account = data.account, customerId = data.profile.ma_kh;
    if (value !== 1 && !window.confirm(`Chuyển tài khoản của ${data.profile.ten_kh} sang “${statusLabels[value]}”? Khách sẽ không đăng nhập được; đơn hàng và lịch sử vẫn được giữ.`)) return;
    const controller = new AbortController(); statusController.current = controller;
    setStatusSaving(true); setStatusError(""); setNotice("");
    try {
      const saved = await accountApi<Account>(`accounts/${encodeURIComponent(account.ma_tk)}/status`, {
        ...jsonRequest("POST", { trang_thai: value }), signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (saved.ma_tk !== account.ma_tk || saved.ma_kh !== customerId || saved.role !== "KHACH_HANG" || saved.trang_thai !== value) {
        throw new Error("API chưa xác nhận đúng trạng thái tài khoản của khách hàng này. Hãy tải lại để đối chiếu.");
      }
      setData(current => current?.profile.ma_kh === customerId && current.account?.ma_tk === account.ma_tk ? {
        ...current, account: { ma_tk: saved.ma_tk, ten_tai_khoan: saved.ten_tai_khoan, email: saved.email, trang_thai: saved.trang_thai },
      } : current);
      setNotice(`Đã cập nhật trạng thái tài khoản khách hàng: ${statusLabels[saved.trang_thai]}.`);
    } catch (cause) {
      if (!controller.signal.aborted) setStatusError(cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái tài khoản.");
    } finally {
      if (statusController.current === controller) { statusController.current = null; setStatusSaving(false); }
    }
  }

  const age = customerAge(data?.profile.ngay_sinh ?? null);
  return <section className={`live-data customer-detail ${styles.page}`}>
    <div className="live-page-actions">
      <button type="button" disabled={saving || statusSaving || archiving} onClick={() => router.push(dataHref("customers"))}>← Quay lại</button>
      {data && !editMode && !error && <div className="live-tools">
        <CustomerArchiveButton customerId={data.profile.ma_kh} archived={Boolean(data.profile.luu_tru_luc)} disabled={statusSaving || archiving || saving}
          onSavingChange={archiveSaving} onSaved={saved => { setData(saved); setStatusError(""); setNotice(saved.profile.luu_tru_luc
            ? "Đã xóa khách hàng; lịch sử đơn hàng và hóa đơn vẫn được giữ." : "Đã khôi phục hồ sơ. Tài khoản vẫn bị ẩn; Admin có thể bật lại."); }} />
        {!data.profile.luu_tru_luc && (statusSaving || archiving ? <button className="live-primary" disabled>Chỉnh sửa</button>
          : <Link className="live-primary" href={dataHref("customers", { key: recordKey, edit: true })}>Chỉnh sửa</Link>)}
      </div>}
    </div>
    {notice && <p className="live-note" role="status">{notice}</p>}
    {pollError && <p className="live-error" role="alert">Tự cập nhật tạm lỗi, đang hiển thị dữ liệu lần trước. {pollError}</p>}
    {error && <p className="live-error" role="alert">{error} <button onClick={() => setVersion(v => v + 1)}>Thử lại</button></p>}
    {loading ? <p role="status">Đang tải hồ sơ khách hàng…</p> : data && !error && <>
      {data.profile.luu_tru_luc && <p className="live-note">Hồ sơ đã xóa. Khôi phục hồ sơ trước khi chỉnh sửa hoặc bật lại tài khoản.
        {editMode && <Link href={detailHref}> Xem hồ sơ để khôi phục</Link>}</p>}
      {editMode && !data.profile.luu_tru_luc ? <form className={`live-form ${styles.editForm}`} onSubmit={save}>
        <fieldset className="live-form-fields" disabled={saving || statusSaving}>
          {fields.map(field => <label key={field}>{customerFields[field]}{field === "ten_kh" && " *"}
            <input aria-label={customerFields[field]} type={field === "ngay_sinh" ? "date" : field === "sdt" ? "tel" : "text"}
              required={field === "ten_kh"} max={field === "ngay_sinh" ? vietnamDate() : undefined} maxLength={field === "sdt" ? 100 : 2000}
              value={draft[field]} onChange={e => setDraft(current => ({ ...current, [field]: e.target.value }))} />
          </label>)}
          <label>Trạng thái tài khoản khách hàng
            {data.account ? <>
              <select aria-label="Trạng thái tài khoản khách hàng" value={data.account.trang_thai}
                aria-invalid={Boolean(statusError)} onChange={event => {
                  const value = Number(event.currentTarget.value) as AccountStatus;
                  event.currentTarget.value = String(data.account!.trang_thai);
                  void changeAccountStatus(value);
                }}>
                {([1, 2, 0] as AccountStatus[]).map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
              </select>
              <small>{statusSaving ? "Đang lưu trạng thái…" : "Trạng thái được lưu ngay khi chọn; các thông tin đang nhập vẫn được giữ."}</small>
            </> : <span>Khách hàng chưa có tài khoản liên kết.</span>}
          </label>
        </fieldset>
        {statusError && <p className="live-error customer-wide" role="alert">{statusError}</p>}
        {saveError && <p className="live-error customer-wide" role="alert">{saveError}</p>}
        <div className="live-form-actions"><button className="live-primary" disabled={saving || statusSaving}>{saving ? "Đang lưu…" : "Lưu hồ sơ"}</button>
          {!saving && !statusSaving && <Link href={detailHref}>Hủy</Link>}</div>
      </form> : <CustomerProfileView data={data} age={age} formatDate={displayDate}
        statusSaving={statusSaving || archiving || Boolean(data.profile.luu_tru_luc)} statusError={statusError} onAccountStatusChange={value => void changeAccountStatus(value)} />}
      <section className={`${styles.card} ${styles.history}`}><div className={styles.historyHeading}>
        <div><h2><ShoppingBag size={20} aria-hidden="true" />Lịch sử đơn hàng</h2><p>Tra cứu các đơn hàng của khách hàng này</p></div>
        <button className={styles.historyToggle} type="button" aria-expanded={ordersOpen} aria-controls="customer-order-history" onClick={() => setOrdersOpen(value => !value)}>
          {ordersOpen ? "Thu gọn" : "Xem đơn hàng"}{ordersOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button></div>
        {ordersOpen && <div id="customer-order-history" className={styles.historyContent}>
          {ordersError && <p className="live-error" role="alert">{ordersError} <button onClick={() => setVersion(v => v + 1)}>Thử lại</button></p>}
          {ordersLoading ? <p role="status">Đang tải đơn hàng…</p> : !ordersError && orders && <>
            {orders.data.length ? <><ScrollableTable><table><thead><tr><th>Mã đơn hàng</th><th>Ngày đặt</th><th>Kênh bán</th><th>Trạng thái</th></tr></thead>
              <tbody>{orders.data.map(order => <tr key={order.ma_donhang}><td><Link href={dataHref("orders", { key: JSON.stringify([order.ma_donhang]) })}>{order.ma_donhang}</Link></td>
                <td>{displayDate(order.thoi_gian_dat)}</td><td>{order.kenh_ban === "ONLINE" ? "Trực tuyến" : order.kenh_ban === "TAI_QUAY" ? "Tại quầy" : "Chưa xác định"}</td>
                <td><span className={`${styles.status} ${order.trang_thai === "HOAN_THANH" ? styles.complete : order.trang_thai === "HUY" ? styles.cancelled : ""}`}>{orderStatus[order.trang_thai] ?? "Chưa xác định"}</span></td></tr>)}</tbody></table></ScrollableTable>
            <div className="live-tools"><span>{orders.total} đơn hàng · Trang {page}</span>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button>
              <button disabled={page * 10 >= orders.total} onClick={() => setPage(p => p + 1)}>Sau</button></div></>
            : <div className={styles.emptyOrders}><ShoppingBag size={30} aria-hidden="true" /><p>Khách hàng chưa có đơn hàng.</p></div>}
          </>}
        </div>}
      </section>
    </>}
  </section>;
}
