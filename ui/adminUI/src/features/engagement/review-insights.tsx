"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminFetch } from "@internal/lib/admin-fetch";
import { dateTime, engagementRequest } from "../../../../shared/engagement";
import styles from "./engagement.module.css";

type Product = { ma_sp: string; sku: string; ten_sp: string; review_count: number; average: number; low_count: number; low_rate: number; latest_at: string };
type Report = { data: Product[]; total: number; page: number; page_size: number;
  summary: { products: number; reviews: number; average: number | null; low_count: number; low_rate: number };
  details: { product: Product; data: { ma_danh_gia: string; so_sao: number; author: string; noi_dung: string; ngay_tao: string; cap_nhat_luc: string }[]; total: number; page: number; page_size: number; low_only: boolean } | null };
const defaults = { q: "", from: "", to: "", minimum: "1", sort: "LOW_RATING" };
type Filters = typeof defaults;
const score = (value: number | null) => value === null ? "—" : `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}/5`;

export function ReviewInsights({ refreshKey }: { refreshKey: number }) {
  const detailsRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<Filters>(defaults);
  const [request, setRequest] = useState({ filters: defaults, page: 1, product: "", reviewPage: 1, lowOnly: false });
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null);
    const { filters } = request;
    const params = new URLSearchParams({ q: filters.q, min_reviews: filters.minimum, sort: filters.sort, page: String(request.page), review_page: String(request.reviewPage), low_only: String(request.lowOnly) });
    if (filters.from) params.set("date_from", filters.from);
    if (filters.to) params.set("date_to", filters.to);
    if (request.product) params.set("product_id", request.product);
    engagementRequest<Report>(`crm/review-insights?${params}`, { signal: controller.signal, cache: "no-store" }, adminFetch)
      .then(next => {
        if (controller.signal.aborted) return;
        if (next.page !== request.page || (request.product && (next.details?.product.ma_sp !== request.product || next.details.page !== request.reviewPage))) throw new Error("API chưa trả đúng sản phẩm hoặc trang báo cáo đang xem.");
        setData(next);
      }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được báo cáo đánh giá."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request, refreshKey, reload]);
  useEffect(() => { if (!loading && data?.details) detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [loading, data?.details?.product.ma_sp]);
  function apply(event: FormEvent) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) { setError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc."); return; }
    setRequest({ filters: { ...draft, q: draft.q.trim() }, page: 1, product: "", reviewPage: 1, lowOnly: false });
  }
  return <section className={`${styles.card} ${styles.reviewReport}`} aria-label="Phân tích đánh giá sản phẩm">
    <header className={styles.heading}><div><h2>Phân tích đánh giá sản phẩm</h2><p className={styles.muted}>Xác định sản phẩm cần xem xét từ điểm số, lượng phản hồi và nhận xét thực tế.</p></div><button disabled={loading} onClick={() => setReload(value => value + 1)}>Làm mới đánh giá</button></header>
    <form className={styles.reviewFilters} onSubmit={apply}>
      <label className={styles.reviewSearch}>Sản phẩm<input aria-label="Tìm sản phẩm trong báo cáo" placeholder="Tên sản phẩm, mã hoặc SKU…" maxLength={100} value={draft.q} onChange={event => setDraft(current => ({ ...current, q: event.target.value }))} /></label>
      <label>Từ ngày<input type="date" aria-label="Đánh giá từ ngày" value={draft.from} onChange={event => setDraft(current => ({ ...current, from: event.target.value }))} /></label>
      <label>Đến ngày<input type="date" aria-label="Đánh giá đến ngày" min={draft.from || undefined} value={draft.to} onChange={event => setDraft(current => ({ ...current, to: event.target.value }))} /></label>
      <label>Số đánh giá tối thiểu<select aria-label="Số đánh giá tối thiểu" value={draft.minimum} onChange={event => setDraft(current => ({ ...current, minimum: event.target.value }))}>{[1, 5, 10, 20, 50].map(count => <option key={count} value={count}>Từ {count} đánh giá</option>)}</select></label>
      <label>Sắp xếp<select aria-label="Sắp xếp đánh giá sản phẩm" value={draft.sort} onChange={event => setDraft(current => ({ ...current, sort: event.target.value }))}><option value="LOW_RATING">Nhiều đánh giá 1–2 sao</option><option value="LOWEST_SCORE">Điểm trung bình thấp</option><option value="MOST_REVIEWS">Nhiều đánh giá nhất</option><option value="NEWEST">Có đánh giá mới nhất</option></select></label>
      <div className={styles.actions}><button type="submit" className={styles.primary}>Áp dụng bộ lọc</button><button type="button" onClick={() => { setDraft(defaults); setRequest({ filters: defaults, page: 1, product: "", reviewPage: 1, lowOnly: false }); }}>Bỏ lọc</button></div>
    </form>
    <p className={styles.muted}>Chỉ tính đánh giá đang hiển thị. Lọc theo ngày tạo đánh giá, giờ Việt Nam; điểm và nội dung là phiên bản hiện tại. Điểm chung tính từ từng đánh giá trong bộ lọc.</p>
    {error && <div className={styles.error} role="alert">{error}{request.product && <p><button onClick={() => setRequest(current => ({ ...current, product: "", reviewPage: 1 }))}>Quay lại bảng sản phẩm</button></p>}</div>}
    {loading ? <p role="status">Đang tổng hợp đánh giá…</p> : data && !error && <>
      <div className={styles.reviewMetrics}>{[["Sản phẩm có phản hồi", data.summary.products], ["Tổng số đánh giá", data.summary.reviews], ["Điểm trung bình", score(data.summary.average)], ["Đánh giá 1–2 sao", `${data.summary.low_count} (${data.summary.low_rate}%)`]].map(([label, value]) => <div className={styles.reviewMetric} key={label}><span className={styles.muted}>{label}</span><strong>{value}</strong></div>)}</div>
      {!data.data.length ? <p>Không có sản phẩm đủ số đánh giá trong bộ lọc này.</p> : <div className={styles.scroll}><table aria-label="Đánh giá theo từng sản phẩm"><thead><tr><th>Sản phẩm</th><th>Số đánh giá</th><th>Điểm trung bình</th><th>Đánh giá 1–2 sao</th><th>Phản hồi mới nhất</th><th>Chi tiết</th></tr></thead><tbody>{data.data.map(product => <tr key={product.ma_sp} className={product.low_count ? styles.reviewAttention : undefined}>
        <td><strong>{product.ten_sp}</strong><div className={styles.muted}>{product.sku} · {product.ma_sp}</div></td><td>{product.review_count}{product.review_count < 5 && <div className={styles.muted}>Ít đánh giá (&lt;5)</div>}</td><td>{score(product.average)}</td><td>{product.low_count} ({product.low_rate}%){product.low_count > 0 && <div className={styles.muted}>Cần đọc phản hồi cụ thể</div>}</td><td>{dateTime(product.latest_at)}</td>
        <td><button onClick={() => setRequest(current => ({ ...current, product: product.ma_sp, reviewPage: 1, lowOnly: product.low_count > 0 }))}>Xem nhận xét</button></td>
      </tr>)}</tbody></table></div>}
      <div className={styles.actions}><span>{data.total} sản phẩm phù hợp · Trang {data.page}</span><div className={styles.actions}><button disabled={request.page === 1} onClick={() => setRequest(current => ({ ...current, page: current.page - 1, product: "", reviewPage: 1 }))}>Sản phẩm trước</button><button disabled={data.page * data.page_size >= data.total} onClick={() => setRequest(current => ({ ...current, page: current.page + 1, product: "", reviewPage: 1 }))}>Sản phẩm sau</button></div></div>
      {data.details && <section ref={detailsRef} className={styles.card} aria-label="Nhận xét sản phẩm đang chọn"><div className={styles.actions}><h3>Nhận xét: {data.details.product.ten_sp}</h3><button onClick={() => setRequest(current => ({ ...current, product: "", reviewPage: 1 }))}>Đóng nhận xét</button></div>
        <label className={styles.check}><input type="checkbox" checked={request.lowOnly} onChange={event => setRequest(current => ({ ...current, lowOnly: event.target.checked, reviewPage: 1 }))} />Chỉ xem đánh giá 1–2 sao</label><p className={styles.muted}>Cùng khoảng thời gian và bộ lọc với báo cáo phía trên. Đây là nội dung khách phản ánh; cần kiểm tra trước khi kết luận nguyên nhân.</p>
        {data.details.data.length ? data.details.data.map(review => <article className={styles.reviewComment} key={review.ma_danh_gia}><div className={styles.actions}><strong>{review.author} · {review.so_sao}/5 sao</strong><small className={styles.muted}>{dateTime(review.ngay_tao)}</small></div><p className={styles.text}>{review.noi_dung}</p></article>) : <p>Không có nhận xét phù hợp.</p>}
        <div className={styles.actions}><span>{data.details.total} nhận xét · Trang {data.details.page}</span><div className={styles.actions}><button disabled={request.reviewPage === 1} onClick={() => setRequest(current => ({ ...current, reviewPage: current.reviewPage - 1 }))}>Nhận xét trước</button><button disabled={data.details.page * data.details.page_size >= data.details.total} onClick={() => setRequest(current => ({ ...current, reviewPage: current.reviewPage + 1 }))}>Nhận xét sau</button></div></div>
      </section>}
    </>}
  </section>;
}
