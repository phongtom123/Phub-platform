"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, EyeOff, MessageSquareText, RefreshCw, Star } from "lucide-react";
import { adminFetch } from "@internal/lib/admin-fetch";
import { dataHref } from "@internal/lib/data-navigation";
import { useAdminPolling } from "@internal/lib/use-admin-polling";
import { dateTime, engagementRequest, jsonBody, reviewStatus, type Page, type Review } from "../../../../shared/engagement";
import styles from "./engagement.module.css";
import layout from "./review-list.module.css";
export default function ReviewList({ productId }: { productId?: string }){
  const [status,setStatus]=useState(""),[page,setPage]=useState(1),[version,setVersion]=useState(0),[data,setData]=useState<Page<Review>|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const request=useRef<AbortController|null>(null);
  const path=`crm/reviews?page=${page}${status?`&status=${status}`:""}${productId?`&product_id=${encodeURIComponent(productId)}`:""}`;
  useEffect(()=>()=>request.current?.abort(),[]);
  function checked(value:Page<Review>){
    if(!value||!Array.isArray(value.data)||value.page!==page||value.page_size!==20||!Number.isSafeInteger(value.total)||value.total<0||value.data.some(r=>!r.ma_danh_gia||!Number.isInteger(r.so_sao)||r.so_sao<1||r.so_sao>5||!(r.trang_thai in reviewStatus)||(productId&&r.ma_sp!==productId)||(status&&r.trang_thai!==status)))throw new Error("API chưa xác nhận đúng danh sách đánh giá của sản phẩm và bộ lọc.");
    return value;
  }
  useEffect(()=>{const c=new AbortController();setData(null);setLoading(true);setError("");engagementRequest<Page<Review>>(path,{signal:c.signal,cache:version?"reload":"no-store"},adminFetch).then(value=>{if(!c.signal.aborted)setData(checked(value));}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[path,version]);
  const pollError=useAdminPolling(path,!loading&&!busy&&!error,async(signal,canApply)=>{const next=checked(await engagementRequest<Page<Review>>(path,{signal,cache:"no-cache"},adminFetch));if(canApply())setData(next);});
  async function moderate(review:Review,next:"HIEN_THI"|"AN"){
    if(request.current||!window.confirm(next==="HIEN_THI"?"Hiển thị lại nhận xét này trên trang sản phẩm?":"Ẩn nhận xét này khỏi trang sản phẩm?"))return;
    const c=new AbortController();request.current=c;setBusy(true);setError("");setNotice("");
    try{const saved=await engagementRequest<Review>(`crm/reviews/${review.ma_danh_gia}/moderate`,{method:"POST",...jsonBody({status:next,expected_version:review.phien_ban}),signal:c.signal},adminFetch);
      if(c.signal.aborted)return;if(saved.ma_danh_gia!==review.ma_danh_gia||saved.trang_thai!==next)throw new Error("API chưa xác nhận đúng trạng thái đánh giá.");
      setData(current=>current&&({...current,data:status&&status!==next?current.data.filter(r=>r.ma_danh_gia!==saved.ma_danh_gia):current.data.map(r=>r.ma_danh_gia===saved.ma_danh_gia?{...r,...saved}:r),total:current.total-(status&&status!==next?1:0)}));setNotice(next==="HIEN_THI"?"Đã hiển thị lại đánh giá.":"Đã ẩn đánh giá.");
      if(status&&status!==next&&data?.data.length===1&&page>1)setPage(value=>value-1);else setVersion(value=>value+1);
    }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không lưu được trạng thái.");}finally{if(request.current===c){request.current=null;setBusy(false);}}
  }
  return <section className={layout.panel} aria-label="Danh sách đánh giá khách hàng">
    <header className={layout.toolbar}>
      <div className={layout.title}>
        <span className={layout.titleIcon}><MessageSquareText size={21} aria-hidden="true" /></span>
        <div><h2>{productId ? "Danh sách đánh giá" : "Tất cả đánh giá sản phẩm"}</h2><p>Nhận xét và trải nghiệm từ khách đã mua hàng</p></div>
      </div>
      <div className={layout.controls}>
        <label><span>Trạng thái</span><select aria-label="Lọc trạng thái đánh giá" value={status} disabled={busy} onChange={event => { setStatus(event.target.value); setPage(1); setNotice(""); }}>
          <option value="">Tất cả trạng thái</option>{Object.entries(reviewStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <button className={layout.refresh} disabled={busy || loading} onClick={() => setVersion(value => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Làm mới đánh giá</button>
      </div>
    </header>
    {error && <p role="alert" className={`${styles.error} ${layout.feedback}`}>{error}</p>}
    {pollError && <p role="alert" className={`${styles.error} ${layout.feedback}`}>{pollError}</p>}
    {notice && <p role="status" className={`${styles.notice} ${layout.feedback}`}>{notice}</p>}
    {loading ? <div className={layout.loading} role="status"><RefreshCw size={18} aria-hidden="true" /> Đang tải đánh giá…</div> : data && <>
      <div className={layout.list}>{data.data.map(review => <article key={review.ma_danh_gia} className={layout.review}>
        <div className={layout.author}>
          <span className={layout.avatar} aria-hidden="true">{(review.ten_kh || "Khách hàng").trim().split(/\s+/).slice(-2).map(word => word[0]).join("").toLocaleUpperCase("vi-VN")}</span>
          <div className={layout.authorInfo}><strong>{review.ten_kh || "Khách hàng"}</strong><time dateTime={review.cap_nhat_luc}>{dateTime(review.cap_nhat_luc)}</time>
            <Link href={dataHref("orders", { key: JSON.stringify([review.ma_donhang]) })} title={`Xem đơn ${review.ma_donhang}`}>Đơn {review.ma_donhang}</Link>
          </div>
        </div>
        <div className={layout.content}>
          {!productId && <Link className={layout.productName} href={`/reviews?product_id=${encodeURIComponent(review.ma_sp)}`}>{review.ten_sp || review.ma_sp}</Link>}
          <div className={layout.reviewTop}>
            <span className={layout.score} role="img" aria-label={`${review.so_sao} trên 5 sao`}><span className={layout.stars} aria-hidden="true">{[1, 2, 3, 4, 5].map(star => <Star key={star} size={16} fill={star <= review.so_sao ? "currentColor" : "none"} className={star <= review.so_sao ? layout.filledStar : layout.emptyStar} />)}</span></span>
            <span className={`${layout.status} ${review.trang_thai === "AN" ? layout.hidden : layout.visible}`}><i aria-hidden="true" />{reviewStatus[review.trang_thai]}</span>
          </div>
          <p className={layout.comment}>{review.noi_dung}</p>
        </div>
        <div className={layout.moderation}><button disabled={busy} className={review.trang_thai === "AN" ? layout.restore : undefined} onClick={() => void moderate(review, review.trang_thai === "AN" ? "HIEN_THI" : "AN")}>
          {review.trang_thai === "AN" ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}{review.trang_thai === "AN" ? "Hiển thị lại" : "Ẩn đánh giá"}
        </button></div>
      </article>)}</div>
      {!data.data.length && <div className={layout.empty}><span><MessageSquareText size={28} aria-hidden="true" /></span><h3>Chưa có đánh giá phù hợp.</h3><p>{status ? "Thử chọn trạng thái khác để xem các nhận xét còn lại." : "Nhận xét của khách hàng sẽ xuất hiện tại đây sau khi được gửi."}</p></div>}
      <footer className={layout.footer}><span>{data.total} đánh giá · Trang {page}</span><div><button disabled={busy || page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} aria-hidden="true" /> Trước</button><button disabled={busy || page * 20 >= data.total} onClick={() => setPage(value => value + 1)}>Sau <ChevronRight size={16} aria-hidden="true" /></button></div></footer>
    </>}
  </section>;
}
