"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { dateTime, engagementRequest, type PublicReviews } from "../../../../../shared/engagement";
import styles from "./engagement.module.css";
export function ProductReviews({productId}:{productId:string}){
  const [page,setPage]=useState(1),[data,setData]=useState<PublicReviews|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[version,setVersion]=useState(0);
  useEffect(()=>{setPage(1);setData(null);},[productId]);
  useEffect(()=>{const c=new AbortController();setLoading(true);setError("");engagementRequest<PublicReviews>(`catalog/products/${encodeURIComponent(productId)}/reviews?page=${page}`,{signal:c.signal})
    .then(value=>{if(!c.signal.aborted)setData(value);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[productId,page,version]);
  return <section id="product-reviews" className={styles.public} aria-label="Đánh giá sản phẩm"><div className={styles.card}><div className={styles.actions}><h2>Đánh giá sản phẩm</h2><Link href="/main/reviews">Đánh giá sản phẩm đã mua →</Link></div>
    {error&&<p className={styles.error} role="alert">{error} <button onClick={()=>setVersion(x=>x+1)}>Thử lại</button></p>}{loading?<p role="status">Đang tải đánh giá…</p>:data&&!error&&<>
      <p><strong>{data.average===null?"Chưa có điểm đánh giá":`${data.average}/5 sao`}</strong> · {data.total} đánh giá</p>
      {data.stars.map(s=><div className={styles.bar} key={s.stars}><span>{s.stars} sao</span><progress max={Math.max(1,data.total)} value={s.count}/><span>{s.count}</span></div>)}
      {!data.data.length&&<p>Chưa có nhận xét được hiển thị.</p>}{data.data.map((r,i)=><article key={`${r.ngay_tao}:${i}`} className={styles.card}><div className={styles.actions}><strong>{r.author}</strong><span className={styles.stars} aria-label={`${r.so_sao} trên 5 sao`}>{"★".repeat(r.so_sao)}{"☆".repeat(5-r.so_sao)}</span></div><p className={styles.text}>{r.noi_dung}</p><p className={styles.muted}>Đã mua hàng · {dateTime(r.ngay_tao)}</p></article>)}
      {data.total>20&&<div className={styles.actions}><button disabled={page===1} onClick={()=>setPage(x=>x-1)}>Trước</button><span>Trang {page}</span><button disabled={page*20>=data.total} onClick={()=>setPage(x=>x+1)}>Sau</button></div>}
    </>}
  </div></section>;
}
