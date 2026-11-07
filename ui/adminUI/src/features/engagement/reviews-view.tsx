"use client";
import { useEffect, useRef, useState } from "react";
import { adminFetch } from "@internal/lib/admin-fetch";
import { useAdminPolling } from "@internal/lib/use-admin-polling";
import { dateTime, engagementRequest, jsonBody, reviewStatus, type Page, type Review } from "../../../../shared/engagement";
import styles from "./engagement.module.css";
export default function ReviewsView(){
  const [status,setStatus]=useState(""),[page,setPage]=useState(1),[version,setVersion]=useState(0),[data,setData]=useState<Page<Review>|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const request=useRef<AbortController|null>(null);
  const path=`crm/reviews?page=${page}${status?`&status=${status}`:""}`;
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>{const c=new AbortController();setLoading(true);setError("");setNotice("");engagementRequest<Page<Review>>(path,{signal:c.signal,cache:version?"reload":"no-store"},adminFetch).then(value=>{if(!c.signal.aborted)setData(value);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[path,version]);
  const pollError=useAdminPolling(path,!loading&&!busy&&!error,async(signal,canApply)=>{const next=await engagementRequest<Page<Review>>(path,{signal,cache:"no-cache"},adminFetch);if(canApply())setData(next);});
  async function moderate(review:Review,next:"HIEN_THI"|"AN"){
    if(request.current||!window.confirm(next==="HIEN_THI"?"Hiển thị lại nhận xét này trên trang sản phẩm?":"Ẩn nhận xét này khỏi trang sản phẩm?"))return;
    const c=new AbortController();request.current=c;setBusy(true);setError("");setNotice("");
    try{const saved=await engagementRequest<Review>(`crm/reviews/${review.ma_danh_gia}/moderate`,{method:"POST",...jsonBody({status:next,expected_version:review.phien_ban}),signal:c.signal},adminFetch);
      if(c.signal.aborted)return;if(saved.ma_danh_gia!==review.ma_danh_gia||saved.trang_thai!==next)throw new Error("API chưa xác nhận đúng trạng thái đánh giá.");
      setData(current=>current&&({...current,data:status&&status!==next?current.data.filter(r=>r.ma_danh_gia!==saved.ma_danh_gia):current.data.map(r=>r.ma_danh_gia===saved.ma_danh_gia?{...r,...saved}:r),total:current.total-(status&&status!==next?1:0)}));setNotice(next==="HIEN_THI"?"Đã hiển thị lại đánh giá.":"Đã ẩn đánh giá.");
    }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không lưu được trạng thái.");}finally{if(request.current===c){request.current=null;setBusy(false);}}
  }
  return <section className={styles.page}><header className={styles.heading}><div><h1>Đánh giá sản phẩm</h1><p className={styles.muted}>Nhận xét hiển thị ngay khi khách gửi. Có thể ẩn nội dung không phù hợp hoặc hiển thị lại.</p></div><button disabled={busy||loading} onClick={()=>setVersion(x=>x+1)}>Làm mới</button></header>
    <label>Trạng thái<select aria-label="Lọc trạng thái đánh giá" value={status} disabled={busy} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Tất cả</option>{Object.entries(reviewStatus).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{pollError&&<p role="alert" className={styles.error}>{pollError}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
    {loading?<p role="status">Đang tải đánh giá…</p>:data&&<><div className={styles.grid}>{data.data.map(r=><article key={r.ma_danh_gia} className={styles.card}><h2>{r.ten_sp}</h2><p><strong>{r.so_sao}/5 sao</strong> · {reviewStatus[r.trang_thai]}</p><p className={styles.text}>{r.noi_dung}</p><p className={styles.muted}>{r.ten_kh} · Đơn {r.ma_donhang} · {dateTime(r.cap_nhat_luc)}</p>
      <div className={styles.actions}>{r.trang_thai==="AN"?<button className={styles.primary} disabled={busy} onClick={()=>void moderate(r,"HIEN_THI")}>Hiển thị lại</button>:<button disabled={busy} onClick={()=>void moderate(r,"AN")}>Ẩn đánh giá</button>}</div></article>)}</div>
      {!data.data.length&&<p>Chưa có đánh giá phù hợp.</p>}<div className={styles.actions}><button disabled={busy||page===1} onClick={()=>setPage(x=>x-1)}>Trước</button><span>{data.total} đánh giá · Trang {page}</span><button disabled={busy||page*20>=data.total} onClick={()=>setPage(x=>x+1)}>Sau</button></div></>}
  </section>;
}
