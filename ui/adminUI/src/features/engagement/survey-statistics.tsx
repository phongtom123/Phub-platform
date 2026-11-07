"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "@internal/lib/admin-fetch";
import { engagementRequest, type Statistics } from "../../../../shared/engagement";
import styles from "./engagement.module.css";
export function SurveyStatistics({ id, version }: { id:string; version:string }) {
  const [page,setPage]=useState(1),[data,setData]=useState<Statistics|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");
    engagementRequest<Statistics>(`crm/surveys/${id}/statistics?page=${page}`,{signal:controller.signal,cache:"no-cache"},adminFetch)
      .then(value=>{if(!controller.signal.aborted)setData(value);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();},[id,version,page,reload]);
  return <section className={styles.card} aria-label="Thống kê khảo sát"><div className={styles.actions}><h2>Kết quả khảo sát</h2><button onClick={()=>setReload(x=>x+1)} disabled={loading}>Làm mới kết quả</button></div>
    {error&&<p className={styles.error} role="alert">{error}</p>}{loading?<p role="status">Đang tải kết quả…</p>:data&&!error&&<>
      <p>Đã gửi: <strong>{data.sent}</strong> · Đã hoàn thành: <strong>{data.completed}</strong> · Tỷ lệ hoàn thành: <strong>{data.sent?Math.round(data.completed/data.sent*100):0}%</strong></p>
      {data.questions.map(q=><article key={q.ma_cau_hoi} className={styles.card}><h3>{q.noi_dung}</h3><p>{q.answered} câu trả lời{q.average!==null?` · Điểm trung bình: ${q.average}/5`:""}</p>
        {q.options.map(o=><div className={styles.bar} key={o.ma_lua_chon}><span>{o.noi_dung}</span><progress max={Math.max(1,q.answered)} value={o.count}/><span>{o.count} ({q.answered?Math.round(o.count/q.answered*100):0}%)</span></div>)}
        {q.scores.map(o=><div className={styles.bar} key={o.score}><span>{o.score} điểm</span><progress max={Math.max(1,q.answered)} value={o.count}/><span>{o.count}</span></div>)}
        {q.text_total>0&&<><p>Nội dung văn bản/Khác: {q.text_total} · Trang {page}</p>{q.texts.map((text,i)=><p key={i} className={styles.text}>{text}</p>)}</>}
      </article>)}
      <div className={styles.actions}><button disabled={page===1} onClick={()=>setPage(x=>x-1)}>Trang nội dung trước</button><span>Trang {page}</span><button disabled={!data.questions.some(q=>q.text_total>page*20)} onClick={()=>setPage(x=>x+1)}>Trang nội dung sau</button></div>
    </>}
  </section>;
}
