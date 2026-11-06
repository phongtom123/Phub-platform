"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AUTH_SESSION_EVENT, AuthRequestError, getSession } from "../../../../../shared/auth-client";
import { engagementRequest, jsonBody, type EligibleReview, type Page, type Review } from "../../../../../shared/engagement";
import styles from "./product-reviews.module.css";

type Access = { kind: "loading" } | { kind: "ready"; item: EligibleReview; accountId: string }
  | { kind: "message"; message: string; login?: boolean; storePurchase?: boolean } | { kind: "error"; message: string };

export function ProductReviewComposer({ productId, onClose, onSaved }: {
  productId: string; onClose: () => void; onSaved: (review: Review) => void;
}) {
  const [access, setAccess] = useState<Access>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      try {
        const account = await getSession(controller.signal);
        if (controller.signal.aborted) return;
        if (account.role !== "KHACH_HANG") {
          setAccess({ kind: "message", message: "Chỉ tài khoản khách hàng có thể đánh giá sản phẩm." });
          return;
        }
        const eligible = await engagementRequest<Page<EligibleReview>>(`customer/crm/reviews/eligible?product_id=${encodeURIComponent(productId)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const item = eligible.data.find(row => row.ma_sp === productId);
        setAccess(item ? { kind: "ready", item, accountId: account.account_id } : {
          kind: "message", message: "Bạn chưa có đơn hàng đã hoàn thành cho sản phẩm này. Bạn có thể đánh giá sau khi mua hàng và hoàn thành đơn.", storePurchase: true,
        });
      } catch (reason) {
        if (controller.signal.aborted) return;
        if (reason instanceof AuthRequestError && reason.status === 401) {
          setAccess({ kind: "message", message: "Bạn cần đăng nhập tài khoản khách hàng để viết đánh giá.", login: true });
        } else {
          setAccess({ kind: "error", message: reason instanceof Error ? reason.message : "Chưa kiểm tra được đơn đã mua. Vui lòng thử lại." });
        }
      }
    }
    void check();
    const reset = () => { controller.abort(); onClose(); };
    window.addEventListener(AUTH_SESSION_EVENT, reset);
    return () => { controller.abort(); window.removeEventListener(AUTH_SESSION_EVENT, reset); };
  }, [productId, attempt, onClose]);

  return <div id="product-review-composer" className={styles.composer}>
    {access.kind === "loading" && <p role="status" className={styles.composerMessage}>Đang kiểm tra sản phẩm đã mua…</p>}
    {access.kind === "ready" ? <ReviewForm key={`${access.accountId}:${access.item.ma_sp}`} item={access.item} onSaved={onSaved} onClose={onClose} />
      : <div className={styles.composerPrompt}>
        {access.kind !== "loading" && <p role={access.kind === "error" ? "alert" : "status"}>{access.message}</p>}
        <div className={styles.composerActions}>
          {access.kind === "message" && access.login && <Link className={styles.writeLink} href={`/auth/login?redirect=${encodeURIComponent(`/main/product/${productId}#product-reviews`)}`}>Đăng nhập</Link>}
          {access.kind === "message" && access.storePurchase && <Link className={styles.writeLink} href="/contact-us?invoice_link=1">Đã mua tại cửa hàng? Liên kết hóa đơn</Link>}
          {access.kind === "error" && <button type="button" className={styles.secondaryButton} onClick={() => { setAccess({ kind: "loading" }); setAttempt(value => value + 1); }}>Thử lại</button>}
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Đóng</button>
        </div>
      </div>}
  </div>;
}

function ReviewForm({ item, onClose, onSaved }: { item: EligibleReview; onClose: () => void; onSaved: (review: Review) => void }) {
  const [stars, setStars] = useState(item.so_sao ?? 5);
  const [content, setContent] = useState(item.noi_dung ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const ratingName = useId();
  const contentId = useId();
  useEffect(() => { textarea.current?.focus(); return () => request.current?.abort(); }, []);

  async function save() {
    if (request.current || !content.trim()) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try {
      const saved = await engagementRequest<Review>("customer/crm/reviews", {
        method: "POST", signal: controller.signal,
        ...jsonBody({ product_id: item.ma_sp, order_id: item.ma_donhang, stars, content: content.trim(), expected_version: item.phien_ban }),
      });
      if (controller.signal.aborted) return;
      if (saved.ma_sp !== item.ma_sp || saved.so_sao !== stars || saved.noi_dung !== content.trim()
        || !["HIEN_THI", "AN"].includes(saved.trang_thai)) throw new Error("API chưa xác nhận đúng đánh giá đã lưu. Vui lòng thử lại hoặc tải lại để kiểm tra.");
      onSaved(saved);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Chưa gửi được đánh giá. Vui lòng thử lại.");
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }

  return <form className={styles.composerForm} aria-label={item.ma_danh_gia ? "Sửa đánh giá sản phẩm" : "Viết đánh giá sản phẩm"} onSubmit={event => { event.preventDefault(); void save(); }}>
    <div className={styles.composerHeading}><h3>{item.ma_danh_gia ? "Chỉnh sửa đánh giá của bạn" : "Chia sẻ trải nghiệm của bạn"}</h3><p>{item.ten_sp}</p></div>
    <fieldset className={styles.ratingPicker} disabled={busy}><legend>Bạn đánh giá sản phẩm này thế nào?</legend><div className={styles.ratingChoices}>
      {[1, 2, 3, 4, 5].map(point => <label key={point} className={`${styles.ratingOption} ${point <= stars ? styles.ratingSelected : ""}`} title={`${point} sao`}>
        <input type="radio" name={ratingName} value={point} checked={stars === point} onChange={() => setStars(point)} aria-label={`${point} sao`} />
        <span aria-hidden="true">★</span>
      </label>)}
      <span className={styles.ratingDescription}>{["Không hài lòng", "Chưa hài lòng", "Bình thường", "Hài lòng", "Rất hài lòng"][stars - 1]}</span>
    </div></fieldset>
    <div className={styles.contentField}><label htmlFor={contentId}>Nhận xét của bạn</label><textarea ref={textarea} id={contentId} aria-label="Nội dung đánh giá" required maxLength={4000} rows={4} disabled={busy} placeholder="Chia sẻ điều bạn thích hoặc trải nghiệm khi sử dụng sản phẩm…" value={content} onChange={event => setContent(event.target.value)} /><span className={styles.characterCount}>{content.length.toLocaleString("vi-VN")} / 4.000 ký tự</span></div>
    <p className={styles.composerNote}>{item.trang_thai === "AN" ? "Đánh giá của bạn đang bị ẩn. Sửa nội dung không tự hiển thị lại đánh giá." : "Tên và nhận xét của bạn hiển thị công khai ngay sau khi gửi. Mỗi sản phẩm có một đánh giá và bạn có thể sửa lại."}</p>
    {error && <p role="alert" className={styles.composerError}>{error}</p>}
    <div className={styles.composerActions}><button className={styles.submitButton} disabled={busy || !content.trim()}>{busy ? "Đang gửi…" : item.ma_danh_gia ? "Lưu thay đổi" : "Gửi đánh giá"}</button><button className={styles.secondaryButton} type="button" disabled={busy} onClick={onClose}>Hủy</button></div>
  </form>;
}
