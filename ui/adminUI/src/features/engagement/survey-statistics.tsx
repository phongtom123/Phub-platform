"use client";
import type { Statistics } from "../../../../shared/engagement";
import styles from "./engagement.module.css";
export function SurveyStatistics({ data, onTextPage }: { data:Statistics; onTextPage:(page:number)=>void }) {
  const page=data.text_page;
  return <section className={styles.card} aria-label="Thống kê khảo sát"><h2>Phân tích từng câu hỏi</h2>
      {data.questions.map(q=><article key={q.ma_cau_hoi} className={styles.card}><h3>{q.noi_dung}</h3><p>{q.answered} câu trả lời{q.average!==null?` · Điểm trung bình: ${q.average}/5`:""}</p>
        {q.options.map(o=><div className={styles.bar} key={o.ma_lua_chon}><span>{o.noi_dung}</span><progress max={Math.max(1,q.answered)} value={o.count}/><span>{o.count} ({q.answered?Math.round(o.count/q.answered*100):0}%)</span></div>)}
        {q.scores.map(o=><div className={styles.bar} key={o.score}><span>{o.score} điểm</span><progress max={Math.max(1,q.answered)} value={o.count}/><span>{o.count}</span></div>)}
        {q.text_total>0&&<><p>Nội dung văn bản/Khác: {q.text_total} · Trang {page}</p>{q.texts.map((text,i)=><p key={i} className={styles.text}>{text}</p>)}</>}
      </article>)}
      {data.questions.some(q=>q.text_total>0)&&<div className={styles.actions}><button disabled={page===1} onClick={()=>onTextPage(page-1)}>Trang nội dung trước</button><span>Trang {page}</span><button disabled={!data.questions.some(q=>q.text_total>page*data.page_size)} onClick={()=>onTextPage(page+1)}>Trang nội dung sau</button></div>}
  </section>;
}
