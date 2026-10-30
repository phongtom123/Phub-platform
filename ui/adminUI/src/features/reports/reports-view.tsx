"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, RefreshCw } from "lucide-react";
import { formatMoney } from "../operations/financial-summary";
import { ScrollableTable } from "../tables/scrollable-table";
import { sameAdminData } from "@/src/lib/admin-fetch";
import { useAdminPolling } from "@/src/lib/use-admin-polling";
import { rangeError, readReport, recentRange, reportCsv, reportWarnings, type BusinessReport, type ReportRange } from "./report-data";
import "../operations/operations.css";
import styles from "./reports.module.css";

export function ReportsView() {
  const router = useRouter(), params = useSearchParams();
  const [defaults] = useState(() => recentRange(30));
  const start = params.get("start") ?? defaults.start, end = params.get("end") ?? defaults.end;
  const period = useMemo(() => ({ start, end }), [start, end]);
  const periodError = rangeError(period);
  const [draft, setDraft] = useState<ReportRange>(period);
  const [filterError, setFilterError] = useState("");
  const [summary, setSummary] = useState<BusinessReport | null>(null);
  const [tab, setTab] = useState<"products" | "daily">("products");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const visible = !periodError && summary?.start === start && summary?.end === end ? summary : null;

  useEffect(() => { setDraft(period); setFilterError(""); setPage(1); }, [period]);
  useEffect(() => {
    setSummary(null); setError("");
    if (periodError) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true);
    readReport(period, controller.signal)
      .then(data => { if (!controller.signal.aborted) setSummary(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được báo cáo."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, periodError, version]);

  const pollError = useAdminPolling(JSON.stringify([period, version]), !loading && !periodError && Boolean(visible), async (signal, canApply) => {
    const data = await readReport(period, signal);
    if (canApply()) setSummary(current => sameAdminData(current, data) ? current : data);
  });
  function apply(next: ReportRange) {
    const invalid = rangeError(next);
    setFilterError(invalid);
    if (invalid) return;
    if (next.start === start && next.end === end) setVersion(v => v + 1);
    else router.replace(`/reports?${new URLSearchParams(next)}`, { scroll: false });
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); apply(draft); }
  const amount = (value: string | null) => value === null ? "Chưa đủ dữ liệu" : formatMoney(value);
  const percent = (value: string | null) => value === null ? "Không xác định" : value.replace(".", ",") + "%";
  const filtered = visible?.products.filter(row => `${row.sku} ${row.name}`.toLocaleLowerCase("vi-VN").includes(query.toLocaleLowerCase("vi-VN").trim())) ?? [];
  const currentPage = Math.min(page, Math.max(1, Math.ceil((tab === "products" ? filtered.length : visible?.daily.length ?? 0) / 20)));
  function download() {
    if (!visible || loading || error || pollError) return;
    const url = URL.createObjectURL(new Blob([reportCsv(visible)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `phub-kinh-doanh-${start}-${end}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className={`live-data ${styles.page}`}>
    <header className={styles.heading}>
      <div><h1><BarChart3 size={25} aria-hidden="true" />Báo cáo kinh doanh</h1><p>Kho cố định 2 — Kho trung tâm · doanh thu, giá vốn và lợi nhuận gộp.</p></div>
      <button type="button" disabled={loading || Boolean(periodError)} onClick={() => setVersion(v => v + 1)}><RefreshCw size={15} aria-hidden="true" /> Làm mới báo cáo</button>
    </header>
    <div className={styles.presets} aria-label="Chọn nhanh kỳ báo cáo">{[7, 30, 90].map(days => <button type="button" key={days} onClick={() => apply(recentRange(days))}>{days} ngày gần đây</button>)}</div>
    <form className={styles.filters} onSubmit={submit} aria-label="Kỳ báo cáo">
      <label>Từ ngày<input type="date" required value={draft.start} onChange={event => { setDraft(current => ({ ...current, start: event.target.value })); setFilterError(""); }} /></label>
      <label>Đến ngày<input type="date" required value={draft.end} onChange={event => { setDraft(current => ({ ...current, end: event.target.value })); setFilterError(""); }} /></label>
      <button type="submit" className="live-primary">Xem báo cáo</button>
    </form>
    {(filterError || periodError) && <p className="live-error" role="alert">{filterError || periodError}</p>}
    {loading && <p role="status">Đang tải báo cáo…</p>}
    {error && <p className="live-error" role="alert">{error} <button type="button" onClick={() => setVersion(v => v + 1)}>Thử lại</button></p>}
    {pollError && visible && <p className="live-error" role="alert">Chưa cập nhật được báo cáo; đang giữ số liệu lần tải trước. {pollError}</p>}
    {visible && <section aria-label="Số liệu kinh doanh">
      <div className="live-tools"><p>{start} → {end} · theo ngày hoàn thành đơn, giờ Việt Nam</p><button type="button" onClick={download} disabled={loading || Boolean(error || pollError)}>Xuất báo cáo CSV</button></div>
      {visible.warnings.map(warning => <p className="live-error" role="alert" key={warning}>{reportWarnings[warning]}</p>)}
      <div className={styles.metrics}>
        <article>Doanh thu sau giảm giá<strong>{amount(visible.net_revenue)}</strong><small>Chưa thuế, trước phân bổ hoàn tiền; chỉ đơn hoàn thành.</small></article>
        <article>Giá vốn hàng đã bán<strong>{amount(visible.cost)}</strong><small>{visible.costed_lines}/{visible.total_lines} dòng đã xác định giá vốn.</small></article>
        <article>Lợi nhuận gộp<strong>{amount(visible.gross_profit)}</strong><small>Không phải lợi nhuận ròng.</small></article>
        <article>Biên lợi nhuận gộp<strong>{percent(visible.margin)}</strong><small>Doanh thu bằng 0: không xác định.</small></article>
      </div>
      <div className={styles.cash}><span>{visible.order_count} đơn hoàn thành · {visible.quantity} sản phẩm</span><span>Thuế: {amount(visible.tax)}</span><span>Thu trừ hoàn (đơn chỉ thuộc kho 2): {amount(visible.collected)}</span><span>Hoàn trong kỳ (đơn chỉ thuộc kho 2): {amount(visible.refunds)}</span></div>
      <p className={styles.basis}>Giá vốn tái dựng tại thời điểm xuất kho từ phiếu đã nhập, tính cả lịch sử trước kỳ; không dùng giá nhập tương lai. Doanh thu và giá vốn cùng ghi nhận theo ngày hoàn thành đơn. Khác chỉ tiêu hóa đơn gồm thuế ở Tổng quan. Dòng tiền theo ngày thanh toán, không dùng để suy ra lợi nhuận.</p>
      <section className={styles.details} aria-label="Chi tiết báo cáo">
        <div className="live-tools"><button type="button" aria-pressed={tab === "products"} onClick={() => { setTab("products"); setPage(1); }}>Theo sản phẩm</button><button type="button" aria-pressed={tab === "daily"} onClick={() => { setTab("daily"); setPage(1); }}>Theo ngày</button>
          {tab === "products" && <input className="live-search" aria-label="Tìm SKU hoặc tên sản phẩm trong báo cáo" placeholder="Tìm SKU hoặc tên sản phẩm…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />}</div>
        {tab === "products" ? <ScrollableTable><table><thead><tr><th>Sản phẩm / SKU</th><th>Đã bán</th><th>Doanh thu chưa thuế</th><th>Giá vốn</th><th>Lợi nhuận gộp</th><th>Biên lợi nhuận</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 20, currentPage * 20).map(row => <tr key={row.sku}>
          <td>{row.name}<small className={styles.sku}>{row.sku}{row.unpriced_lines > 0 ? ` · ${row.unpriced_lines} dòng chưa đủ giá vốn` : ""}</small></td><td>{row.quantity.toLocaleString("vi-VN")}</td><td>{amount(row.net_revenue)}</td><td>{amount(row.cost)}</td><td>{amount(row.gross_profit)}</td><td>{percent(row.margin)}</td>
        </tr>)}</tbody></table>{!filtered.length && <p className="live-note">{query ? "Không có sản phẩm khớp tìm kiếm." : "Chưa có đơn hoàn thành trong kỳ này."}</p>}</ScrollableTable>
          : <ScrollableTable><table><thead><tr><th>Ngày hoàn thành</th><th>Doanh thu chưa thuế</th><th>Lợi nhuận gộp</th></tr></thead><tbody>{visible.daily.slice((currentPage - 1) * 20, currentPage * 20).map(row => <tr key={row.day}><td>{row.day}</td><td>{amount(row.net_revenue)}</td><td>{amount(row.gross_profit)}</td></tr>)}</tbody></table></ScrollableTable>}
        <div className="live-tools"><span>{tab === "products" ? filtered.length : visible.daily.length} {tab === "products" ? "sản phẩm" : "ngày"} · Trang {currentPage}</span><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</button><button type="button" disabled={currentPage * 20 >= (tab === "products" ? filtered.length : visible.daily.length)} onClick={() => setPage(currentPage + 1)}>Sau</button></div>
      </section>
    </section>}
    <section className={styles.notice} aria-label="Phương pháp tính giá vốn"><h2>Bình quân gia quyền liên hoàn</h2><p>Sau mỗi lần nhập: đơn giá vốn bình quân = (giá trị tồn trước nhập + giá trị nhập) / (số lượng tồn trước nhập + số lượng nhập). Khi xuất: giá vốn dòng = số lượng xuất × đơn giá bình quân, làm tròn đến 2 chữ số thập phân. Cùng thời điểm ghi nhận thì xử lý phiếu nhập trước xuất. Nếu lịch sử không đối chiếu được với tồn hiện tại, báo cáo cảnh báo thay vì đoán giá vốn. Kết quả được tính lại từ chứng từ, chưa phải sổ giá vốn đã khóa kỳ.</p></section>
    <section className={styles.formulas} aria-label="Công thức báo cáo">
      <h2>Công thức và cách hiểu</h2>
      <div className={styles.formulaList}>
        <article><h3>Doanh thu sau giảm giá, chưa thuế</h3><p className={styles.equation}>Σ (Số lượng × đơn giá − giảm giá dòng − voucher phân bổ)</p><p>Lấy từ chi tiết của đơn hoàn thành trong kỳ. Thuế tách riêng. Nếu có hoàn tiền chưa phân bổ về hàng và thuế, không tự trừ toàn bộ khoản hoàn vào doanh thu chưa thuế hoặc đoán giá vốn hàng trả.</p></article>
        <article><h3>Giá vốn hàng đã bán</h3><p className={styles.equation}>Σ (Số lượng hàng đã bán × đơn giá vốn bình quân lúc xuất)</p><p>Tính riêng từng SKU/kho, dùng phiếu đã nhập và mọi đơn đã xuất. Đơn xuất kỳ trước nhưng hoàn thành kỳ này vẫn mang đúng giá vốn lúc xuất.</p></article>
        <article><h3>Lợi nhuận gộp</h3><p className={styles.equation}>Doanh thu thuần chưa thuế − giá vốn hàng đã bán</p><p>Chưa trừ chi phí vận hành như lương, thuê mặt bằng và quảng cáo; không phải lợi nhuận ròng.</p></article>
        <article><h3>Biên lợi nhuận gộp</h3><p className={styles.equation}>(Lợi nhuận gộp / doanh thu thuần chưa thuế) × 100%</p><p>Doanh thu thuần bằng 0 thì biên lợi nhuận không xác định, không chia cho 0. Đây không phải tỷ lệ cộng lãi trên giá vốn.</p></article>
      </div>
    </section>
  </section>;
}
