"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpFromLine, RefreshCw } from "lucide-react";
import { adminFetch } from "@internal/lib/admin-fetch";
import { dataHref } from "@internal/lib/data-navigation";
import { ScrollableTable } from "@internal/features/tables/scrollable-table";
import { orderValue } from "@internal/features/orders/order-presentation";
import styles from "./dispatch-orders.module.css";

const statuses = {
  DANG_CHUAN_BI: "Chờ xuất kho",
  XAC_NHAN: "Chờ chuẩn bị",
  DA_XUAT_KHO: "Đã xuất kho",
  HOAN_THANH: "Đã hoàn thành",
} as const;
type Status = keyof typeof statuses;
type Order = {
  ma_donhang: string;
  ten_nguoi_nhan: string | null;
  sdt_nguoi_nhan: string | null;
  kenh_ban: string;
  trang_thai: Status;
  thoi_gian_dat: string;
  thoi_gian_xuat_kho: string | null;
};
type Result = { data: Order[]; total: number; page: number; page_size: number };
const pageSize = 20;

/** This is an order queue, not a second stock deduction/document implementation. */
export default function DispatchOrders() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedStatus = params.get("status") ?? "";
  const status: Status = Object.hasOwn(statuses, requestedStatus) ? requestedStatus as Status : "DANG_CHUAN_BI";
  const pageNumber = Number(params.get("page") ?? "1");
  const page = Number.isSafeInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 10000 ? pageNumber : 1;
  const search = params.get("q") ?? "";
  const [query, setQuery] = useState(search);
  const [reload, setReload] = useState(0);
  const identity = JSON.stringify([status, page, search, reload]);
  const [state, setState] = useState<{ identity: string; result: Result | null; error: string; loading: boolean } | null>(null);
  const current = state?.identity === identity ? state : null;
  const result = current?.result ?? null;
  const error = current?.error ?? "";
  const loading = current?.loading ?? true;

  useEffect(() => setQuery(search), [search]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ identity, result: null, error: "", loading: true });
    const options = new URLSearchParams({ page: String(page), page_size: String(pageSize), q: search,
      filters: JSON.stringify({ trang_thai: status }) });
    void adminFetch(`/api/backend/data/orders?${options}`, { signal: controller.signal, cache: "reload" })
      .then(async response => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được danh sách xuất hàng.");
        if (!body || !Array.isArray(body.data) || !Number.isSafeInteger(body.total) || body.total < 0 ||
          body.page !== page || body.page_size !== pageSize || body.data.length > pageSize ||
          body.data.some((row: Order) => !row || typeof row.ma_donhang !== "string" || row.trang_thai !== status) ||
          new Set(body.data.map((row: Order) => row.ma_donhang)).size !== body.data.length) {
          throw new Error("API trả danh sách không đúng trạng thái yêu cầu. Hãy tải lại.");
        }
        if (!controller.signal.aborted) setState({ identity, result: body, error: "", loading: false });
      })
      .catch(reason => { if (!controller.signal.aborted) setState({ identity, result: null,
        error: reason instanceof Error ? reason.message : "Không tải được danh sách xuất hàng.", loading: false }); });
    return () => controller.abort();
  }, [identity, page, search, status]);

  function navigate(next: { status?: Status; page?: number; q?: string }) {
    const updated = new URLSearchParams({ status: next.status ?? status, page: String(next.page ?? 1) });
    const term = (next.q ?? search).trim();
    if (term) updated.set("q", term);
    router.push(`/dispatches?${updated}`);
  }
  function submit(event: FormEvent) {
    event.preventDefault(); navigate({ q: query, page: 1 });
  }

  return <section className={`live-data ${styles.workspace}`} aria-label="Phiếu xuất theo đơn hàng">
    <div className={styles.description}><ArrowUpFromLine size={20}/><p>Xuất hàng theo đơn đã xác nhận. Mở chi tiết để kiểm tra sản phẩm và kho trước khi xác nhận xuất.</p></div>
    <form className="live-tools" onSubmit={submit}>
      <input className="live-search" aria-label="Tìm đơn xuất hàng" placeholder="Tìm mã đơn hoặc tên người nhận…" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} />
      <select aria-label="Trạng thái xuất hàng" value={status} onChange={event => navigate({ status: event.target.value as Status, page: 1 })}>
        {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button type="submit">Tìm kiếm</button>
      <button type="button" onClick={() => setReload(value => value + 1)} disabled={loading}><RefreshCw size={15}/> Làm mới</button>
    </form>
    {error && <p className="live-error" role="alert">{error}</p>}
    {loading ? <p role="status">Đang tải đơn xuất hàng…</p> : !error && result && <>
      <ScrollableTable><table><thead><tr><th>Mã đơn hàng</th><th>Người nhận</th><th>Số điện thoại</th><th>Kênh bán</th><th>Trạng thái</th><th>Thời gian đặt</th><th>Thời gian xuất</th><th>Thao tác</th></tr></thead>
        <tbody>{result.data.map(row => <tr key={row.ma_donhang}>
          <td><Link href={dataHref("orders", { key: JSON.stringify([row.ma_donhang]) })}>{row.ma_donhang}</Link></td>
          <td>{row.ten_nguoi_nhan || "Chưa có thông tin"}</td><td>{row.sdt_nguoi_nhan || "—"}</td>
          <td>{orderValue(row, "kenh_ban")}</td>
          <td><span className={styles.status}>{statuses[row.trang_thai]}</span></td>
          <td>{orderValue(row, "thoi_gian_dat")}</td><td>{orderValue(row, "thoi_gian_xuat_kho")}</td>
          <td><Link className={styles.action} href={dataHref("orders", { key: JSON.stringify([row.ma_donhang]) })}>
            {row.trang_thai === "DANG_CHUAN_BI" ? "Kiểm tra và xuất" : row.trang_thai === "XAC_NHAN" ? "Chuẩn bị đơn" : "Xem đơn đã xuất"}
          </Link></td>
        </tr>)}</tbody>
      </table>{!result.data.length && <p className="live-note">Không có đơn hàng phù hợp.</p>}</ScrollableTable>
      <div className={styles.pagination}><span>{result.total} đơn · Trang {page}</span>
        <button type="button" disabled={page <= 1} onClick={() => navigate({ page: page - 1 })}>Trước</button>
        <button type="button" disabled={page * pageSize >= result.total} onClick={() => navigate({ page: page + 1 })}>Sau</button>
      </div>
    </>}
  </section>;
}
