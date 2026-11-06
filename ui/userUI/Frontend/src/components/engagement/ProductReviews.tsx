"use client";

import { useCallback, useEffect, useState } from "react";
import { dateTime, engagementRequest, type PublicReviews, type Review } from "../../../../../shared/engagement";
import { ProductReviewComposer } from "./ProductReviewComposer";
import styles from "./product-reviews.module.css";

function ReviewIcon({ kind }: { kind: "write" | "check" | "message" }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "write" ? <><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /><path d="m13 6 5 5" /></>
      : kind === "check" ? <><path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="9" /></>
        : <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-5 2 2-5v-5.5a8.5 8.5 0 0 1 17 0Z" />}
  </svg>;
}

function Stars({ value }: { value: number }) {
  return <span className={styles.stars} role="img" aria-label={`${value} trên 5 sao`}>
    <span aria-hidden="true">★★★★★</span>
    <span className={styles.starFill} style={{ width: `${Math.min(5, Math.max(0, value)) * 20}%` }} aria-hidden="true">★★★★★</span>
  </span>;
}

export function ProductReviews({ productId }: { productId: string }) {
  return <ReviewsContent key={productId} productId={productId} />;
}

function ReviewsContent({ productId }: { productId: string }) {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const closeEditor = useCallback(() => setEditing(false), []);
  const reviewSaved = useCallback((saved: Review) => {
    setEditing(false);
    setNotice(saved.trang_thai === "AN" ? "Đã lưu thay đổi. Đánh giá của bạn hiện đang bị ẩn." : "Đánh giá của bạn đã được cập nhật. Cảm ơn bạn đã chia sẻ!");
    setPage(1); setVersion(value => value + 1);
  }, []);
  const [result, setResult] = useState<{ key: string; data: PublicReviews | null; error: string }>({ key: "", data: null, error: "" });
  const path = `catalog/products/${encodeURIComponent(productId)}/reviews?page=${page}`;
  const requestKey = `${path}:${version}`;
  const loading = result.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? "" : result.error;

  useEffect(() => {
    const controller = new AbortController();
    engagementRequest<PublicReviews>(path, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setResult({ key: requestKey, data: value, error: "" }); })
      .catch(reason => { if (!controller.signal.aborted) setResult({ key: requestKey, data: null, error: reason instanceof Error ? reason.message : "Chưa tải được đánh giá. Vui lòng thử lại." }); });
    return () => controller.abort();
  }, [path, requestKey]);

  return <section id="product-reviews" className={styles.section} aria-label="Đánh giá sản phẩm" aria-busy={loading}>
    <div className={styles.panel}>
      <header className={styles.header}>
        <div><h2>Đánh giá sản phẩm</h2><p>Trải nghiệm từ khách hàng đã mua sản phẩm.</p></div>
        <button type="button" className={styles.writeLink} disabled={editing} aria-expanded={editing} aria-controls="product-review-composer" onClick={() => { setNotice(""); setEditing(true); }}><ReviewIcon kind="write" />Viết đánh giá</button>
      </header>

      {editing && <ProductReviewComposer productId={productId} onClose={closeEditor} onSaved={reviewSaved} />}
      {notice && <p role="status" className={styles.savedNotice}>{notice}</p>}

      {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" className={styles.secondaryButton} onClick={() => setVersion(value => value + 1)}>Thử lại</button></div>}
      {loading && <div className={styles.loading} role="status"><span className={styles.loadingDot} />Đang tải đánh giá…</div>}
      {data && !error && <>
        <div className={styles.summary}>
          <div className={styles.scoreCard}>
            <div className={styles.scoreNumber}>{data.average === null ? "—" : data.average.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span>/5</span></div>
            <div className={styles.scoreInfo}><Stars value={data.average ?? 0} /><p>{data.total.toLocaleString("vi-VN")} đánh giá từ người mua</p></div>
          </div>
          <div className={styles.distribution} aria-label="Phân bố số sao">
            {[5, 4, 3, 2, 1].map(stars => {
              const count = data.stars.find(item => item.stars === stars)?.count ?? 0;
              return <div key={stars} className={styles.ratingRow}>
                <span className={styles.ratingLabel}>{stars}<span aria-hidden="true">★</span></span>
                <progress className={styles.progress} max={Math.max(1, data.total)} value={count} aria-label={`${stars} sao: ${count} đánh giá`} />
                <span className={styles.ratingCount}>{count.toLocaleString("vi-VN")}</span>
              </div>;
            })}
          </div>
        </div>

        <div className={styles.listHeading}><h3>Nhận xét từ khách hàng <span>{data.total.toLocaleString("vi-VN")}</span></h3>{data.data.length > 0 && <span className={styles.orderHint}>Mới nhất</span>}</div>
        <div className={styles.reviewList}>
          {data.data.map((review, index) => <article key={`${review.ngay_tao}:${index}`} className={styles.review}>
            <div className={styles.avatar} aria-hidden="true">{review.author.trim().split(/\s+/).slice(-2).map(part => Array.from(part)[0]).join("").toUpperCase() || "KH"}</div>
            <div className={styles.reviewBody}>
              <div className={styles.reviewHeader}><div className={styles.author}><strong>{review.author}</strong><span className={styles.verified}><ReviewIcon kind="check" />Đã mua hàng</span></div><time dateTime={review.ngay_tao}>{dateTime(review.ngay_tao)}</time></div>
              <Stars value={review.so_sao} />
              <p className={styles.reviewText}>{review.noi_dung}</p>
            </div>
          </article>)}
        </div>
        {!data.data.length && <div className={styles.empty}><span className={styles.emptyIcon}><ReviewIcon kind="message" /></span><h4>{data.total ? "Chưa có nhận xét trên trang này" : "Hãy chia sẻ trải nghiệm của bạn"}</h4><p>{data.total ? "Chọn trang trước để xem các nhận xét khác." : "Nếu đã mua sản phẩm, bạn có thể để lại đánh giá đầu tiên."}</p></div>}
        {(data.total > 20 || page > 1) && <nav className={styles.pagination} aria-label="Phân trang đánh giá"><button type="button" className={styles.secondaryButton} disabled={page === 1} onClick={() => setPage(value => value - 1)}>← Trước</button><span>Trang {page} / {Math.max(1, Math.ceil(data.total / 20))}</span><button type="button" className={styles.secondaryButton} disabled={page * 20 >= data.total} onClick={() => setPage(value => value + 1)}>Sau →</button></nav>}
      </>}
    </div>
  </section>;
}
