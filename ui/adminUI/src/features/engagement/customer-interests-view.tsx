"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { adminFetch } from "@internal/lib/admin-fetch";
import { useAdminPolling } from "@internal/lib/use-admin-polling";
import { dateTime, engagementRequest, surveyResultsHref, type CustomerInterests, type InterestSurvey } from "../../../../shared/engagement";
import styles from "./engagement.module.css";

const resultsHref = surveyResultsHref;
const api = (filters: { survey: string; q: string; page: number }, signal: AbortSignal) => {
  const params = new URLSearchParams({ q: filters.q, page: String(filters.page) });
  if (filters.survey) params.set("survey_id", filters.survey);
  return engagementRequest<CustomerInterests>(`crm/interests?${params}`, { signal, cache: "no-store" }, adminFetch);
};

export default function CustomerInterestsView() {
  const [filters, setFilters] = useState({ survey: "", q: "", page: 1 });
  const [query, setQuery] = useState("");
  const [data, setData] = useState<CustomerInterests | null>(null);
  const [surveys, setSurveys] = useState<InterestSurvey[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null);
    api(filters, controller.signal).then(next => {
      if (!controller.signal.aborted) { setData(next); setSurveys(next.surveys); }
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được sở thích khách hàng.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, version]);
  const pollError = useAdminPolling(JSON.stringify(["interests", filters, version]), !loading && !error, async (signal, canApply) => {
    const next = await api(filters, signal);
    if (canApply()) { setData(next); setSurveys(next.surveys); }
  });
  function search(event: FormEvent) {
    event.preventDefault(); setFilters(current => ({ ...current, q: query.trim(), page: 1 }));
  }
  return <section className={styles.page}>
    <header className={styles.heading}><div><h1>Sở thích khách hàng</h1><p className={styles.muted}>Nhu cầu khách tự khai báo trong các bài khảo sát đã hoàn thành.</p></div><Link href="/surveys">Khảo sát khách hàng →</Link></header>
    <form className={`${styles.card} ${styles.interestFilters}`} onSubmit={search}>
      <label>Tìm kiếm<input aria-label="Tìm sở thích" placeholder="Tên/mã khách, câu hỏi hoặc câu trả lời…" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>Khảo sát<select aria-label="Lọc khảo sát sở thích" value={filters.survey} onChange={event => setFilters(current => ({ ...current, survey: event.target.value, page: 1 }))}><option value="">Tất cả khảo sát sở thích</option>{surveys.map(survey => <option key={survey.ma_khao_sat} value={survey.ma_khao_sat}>{survey.tieu_de}</option>)}</select></label>
      <div className={styles.actions}><button type="submit" className={styles.primary}>Tìm kiếm</button><button type="button" disabled={loading} onClick={() => setVersion(value => value + 1)}>Làm mới</button></div>
    </form>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {pollError && <p className={styles.error} role="alert">Chưa tự cập nhật được; đang hiển thị lần tải gần nhất. {pollError}</p>}
    {loading ? <p role="status">Đang tải sở thích…</p> : data && !error && <>
      <div className={styles.interestMetrics}>{[["Khách đã phản hồi", data.customers], ["Câu trả lời sở thích", data.total], ["Khảo sát có phản hồi", data.survey_count]].map(([label, value]) => <section className={styles.card} key={label}><span className={styles.muted}>{label}</span><strong className={styles.metric}>{value}</strong></section>)}</div>
      {!data.total ? <section className={styles.card}><h2>Chưa có phản hồi sở thích phù hợp</h2><p>Chọn nhóm “Nhu cầu / sở thích” cho câu hỏi khi soạn khảo sát, phát hành và chờ khách gửi bài. Các câu thuộc nhóm Chung hoặc Mức hài lòng không được tính vào đây.</p></section> : <>
        <section className={styles.page} aria-label="Tổng hợp sở thích"><div><h2>Phân bố câu trả lời</h2><p className={styles.muted}>Hiển thị {data.summaries.length}/{data.question_count} câu hỏi có nhiều phản hồi nhất theo bộ lọc. Mỗi câu hỏi được thống kê riêng theo khảo sát nguồn.</p></div>
          <div className={styles.grid}>{data.summaries.map(summary => <article className={styles.card} key={summary.ma_cau_hoi}><span className={styles.muted}>{summary.tieu_de}</span><h3>{summary.cau_hoi}</h3><p>{summary.answered} câu trả lời</p>
            {summary.options.length ? summary.options.map(option => <div className={styles.bar} key={option.label}><span>{option.label}</span><progress aria-label={option.label} max={summary.answered} value={option.count} /><span>{option.count} ({Math.round(option.count / summary.answered * 100)}%)</span></div>) : <p className={styles.muted}>Câu trả lời văn bản được hiển thị trong bảng bên dưới.</p>}
            <Link href={resultsHref(summary.ma_khao_sat)}>Xem kết quả khảo sát →</Link>
          </article>)}</div>
        </section>
        <section className={styles.card}><h2>Phản hồi của từng khách hàng</h2><p className={styles.muted}>Chỉ lấy câu hỏi “Nhu cầu / sở thích” và bài đã gửi. Nội dung “Khác” giữ nguyên lời khách; hồ sơ đã xóa mềm không xuất hiện.</p>
          <div className={styles.scroll}><table><thead><tr><th>Khách hàng</th><th>Tuổi hiện tại</th><th>Khảo sát / Câu hỏi</th><th>Sở thích / Nhu cầu đã trả lời</th><th>Ngày trả lời</th></tr></thead><tbody>{data.data.map(answer => <tr key={answer.ma_tra_loi}>
            <td><Link href={`/data/customers?key=${encodeURIComponent(JSON.stringify([answer.ma_kh]))}`}>{answer.ten_kh}</Link><div className={styles.muted}>{answer.ma_kh}</div></td><td>{answer.tuoi ?? "Chưa có ngày sinh"}</td>
            <td><Link href={resultsHref(answer.ma_khao_sat)}>{answer.tieu_de}</Link><p>{answer.cau_hoi}</p></td><td className={styles.text}>{answer.lua_chon && <strong>{answer.lua_chon}</strong>}{answer.noi_dung && <p>{answer.noi_dung}</p>}{answer.diem !== null && <span>{answer.diem}/5</span>}</td><td>{dateTime(answer.hoan_thanh_luc)}</td>
          </tr>)}</tbody></table></div>
          <div className={styles.actions}><span>{data.total} câu trả lời · Trang {data.page}</span><div className={styles.actions}><button disabled={filters.page === 1} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>Trước</button><button disabled={data.page * data.page_size >= data.total} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Sau</button></div></div>
        </section>
      </>}
    </>}
  </section>;
}
