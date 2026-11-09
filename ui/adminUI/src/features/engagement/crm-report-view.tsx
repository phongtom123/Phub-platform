"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminFetch } from "@internal/lib/admin-fetch";
import { engagementRequest, type CrmReport } from "../../../../shared/engagement";
import styles from "./engagement.module.css";
import { ReviewInsights } from "./review-insights";
export default function CrmReportView(){
  const [data,setData]=useState<CrmReport|null>(null),[error,setError]=useState(""),[version,setVersion]=useState(0),[loading,setLoading]=useState(true);
  useEffect(()=>{const c=new AbortController();setLoading(true);setError("");engagementRequest<CrmReport>("crm/report",{signal:c.signal,cache:version?"reload":"no-store"},adminFetch).then(value=>{if(!c.signal.aborted)setData(value);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[version]);
  return <section className={styles.page}><header className={styles.heading}><div><h1>Báo cáo CRM</h1><p className={styles.muted}>Độ tuổi, nhu cầu khách hàng và mức hài lòng qua khảo sát/đánh giá.</p></div><button disabled={loading} onClick={()=>setVersion(x=>x+1)}>Làm mới báo cáo</button></header>
    {error&&<p className={styles.error} role="alert">{error}</p>}{loading?<p role="status">Đang tải báo cáo…</p>:data&&!error&&<>
      <p>Ngày thống kê: {data.as_of.split("-").reverse().join("/")} · {data.total_customers} hồ sơ đang sử dụng</p>
      <section className={styles.card}><h2>Phân bố độ tuổi</h2><p className={styles.muted}>Tính từ ngày sinh theo ngày Việt Nam, bao gồm nhóm chưa có thông tin.</p>
        {data.age_groups.map(g=><div key={g.label} className={styles.bar}><span>{g.label}</span><progress max={Math.max(1,data.total_customers)} value={g.count}/><span>{g.count} ({data.total_customers?Math.round(g.count/data.total_customers*100):0}%)</span></div>)}</section>
    </>}
    <ReviewInsights refreshKey={version} />
    {!loading&&data&&!error&&<>
      <section className={styles.card}>
        <h2>Nhu cầu / sở thích và mức hài lòng</h2>
        <p>Chọn khảo sát để xem kết quả từng câu, tỷ lệ hoàn thành và điểm hài lòng.</p>
        <p className={styles.muted}>Sở thích là câu trả lời khách tự khai báo; đánh dấu câu hỏi “Nhu cầu / sở thích” khi soạn khảo sát.</p>
        <div>
          <Link href="/surveys" className={styles.surveyLinkBtn}>
            <span>Tất cả khảo sát</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </section>
    </>}
  </section>;
}
