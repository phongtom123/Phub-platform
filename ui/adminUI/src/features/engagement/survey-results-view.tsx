"use client";

import Link from "next/link";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useAdminAuth } from "@internal/components/admin/auth-provider";
import { adminFetch } from "@internal/lib/admin-fetch";
import { dateTime, engagementRequest, surveyStatus, type SurveyResults } from "../../../../shared/engagement";
import { SurveyStatistics } from "./survey-statistics";
import styles from "./engagement.module.css";

export default function SurveyResultsView({ id }: { id: string }) {
  const { portal } = useAdminAuth();
  const tabId = useId();
  const [tab, setTab] = useState<"respondents" | "statistics">("respondents");
  const [filters, setFilters] = useState({ q: "", page: 1, textPage: 1 });
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SurveyResults | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null);
    const params = new URLSearchParams({ q: filters.q, page: String(filters.page), text_page: String(filters.textPage) });
    engagementRequest<SurveyResults>(`crm/surveys/${encodeURIComponent(id)}/results?${params}`, { signal: controller.signal, cache: "no-store" }, adminFetch)
      .then(next => {
        if (controller.signal.aborted) return;
        if (next.statistics.survey.ma_khao_sat !== id || next.respondents.page !== filters.page || next.statistics.text_page !== filters.textPage) throw new Error("API trả kết quả không đúng khảo sát hoặc trang đang xem.");
        setData(next);
      }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được kết quả khảo sát."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, filters, reload]);
  function search(event: FormEvent) {
    event.preventDefault(); setFilters(current => ({ ...current, q: query.trim(), page: 1 }));
  }
  return <section className={styles.page}>
    <header className={styles.heading}><div><Link href="/surveys">← Danh sách khảo sát</Link><h1>Kết quả khảo sát</h1><p className={styles.muted}>Thống kê và bài trả lời của từng khách hàng.</p></div><button disabled={loading} onClick={() => setReload(value => value + 1)}>Làm mới kết quả</button></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading ? <p role="status">Đang tải kết quả khảo sát…</p> : data && !error && <>
      <section className={styles.card}><div className={styles.actions}><h2>{data.statistics.survey.tieu_de}</h2><span className={styles.resultBadge}>{surveyStatus[data.statistics.survey.trang_thai]}</span></div>
        {data.statistics.survey.mo_ta && <p className={styles.muted}>{data.statistics.survey.mo_ta}</p>}
        <dl className={styles.resultMetadata}><div><dt>Người tạo khảo sát</dt><dd>{data.creator?.ho_ten ?? "Chưa xác định"}</dd></div><div><dt>Ngày tạo</dt><dd>{dateTime(data.statistics.survey.ngay_tao)}</dd></div><div><dt>Hạn trả lời</dt><dd>{dateTime(data.statistics.survey.han_tra_loi)}</dd></div><div><dt>Đối tượng</dt><dd>{data.statistics.survey.loai_doi_tuong === "DO_TUOI" ? `${data.statistics.survey.tuoi_tu}–${data.statistics.survey.tuoi_den} tuổi` : data.statistics.survey.loai_doi_tuong === "CHUA_NGAY_SINH" ? "Chưa cung cấp ngày sinh" : data.statistics.survey.loai_doi_tuong === "DA_CO_DON" ? "Khách hàng đã có đơn hàng" : data.statistics.survey.loai_doi_tuong === "CHUA_CO_DON" ? "Khách hàng chưa có đơn hàng" : "Tất cả khách phù hợp khi phát hành"}</dd></div></dl>
      </section>
      <div className={styles.interestMetrics}>{[["Khách đã nhận", data.statistics.sent], ["Khách đã trả lời", data.statistics.completed], ["Tỷ lệ hoàn thành", `${data.statistics.sent ? Math.round(data.statistics.completed / data.statistics.sent * 100) : 0}%`]].map(([label, value]) => <section className={styles.card} key={label}><span className={styles.muted}>{label}</span><strong className={styles.metric}>{value}</strong></section>)}</div>
      {data.statistics.survey.trang_thai === "NHAP" && <p className={styles.notice}>Khảo sát còn là bản nháp, chưa có phản hồi của khách hàng.</p>}
      <div className={styles.resultTabs} role="tablist" aria-label="Nội dung kết quả khảo sát">{([['respondents', 'Người trả lời'], ['statistics', 'Thống kê câu hỏi']] as const).map(([key, label]) => <button key={key} id={`${tabId}-${key}-tab`} role="tab" aria-selected={tab === key} aria-controls={`${tabId}-${key}-panel`} className={tab === key ? styles.primary : undefined} onClick={() => setTab(key)}>{label}{key === "respondents" ? ` (${data.statistics.completed})` : ""}</button>)}</div>
      {tab === "respondents" ? <section id={`${tabId}-respondents-panel`} role="tabpanel" aria-labelledby={`${tabId}-respondents-tab`} className={styles.card}>
        <h2>Danh sách người trả lời</h2><p className={styles.muted}>Tuổi hiện tại được tính từ ngày sinh khách đã cung cấp. Mở “Xem câu trả lời” để xem bài đã gửi của người đó.</p>
        <form className={styles.respondentSearch} onSubmit={search}><input aria-label="Tìm người trả lời" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc mã khách hàng…" /><button type="submit">Tìm kiếm</button></form>
        {data.respondents.data.length ? <div className={styles.scroll}><table><thead><tr><th>Người trả lời</th><th>Tuổi hiện tại</th><th>Thời điểm gửi</th><th>Bài trả lời</th></tr></thead><tbody>{data.respondents.data.map(person => <tr key={person.ma_gui}>
          <td>{portal === "staff" && !person.luu_tru_luc ? <Link href={`/data/customers?key=${encodeURIComponent(JSON.stringify([person.ma_kh]))}`}>{person.ten_kh}</Link> : <strong>{person.ten_kh}</strong>}<div className={styles.muted}>{person.ma_kh}</div>{person.luu_tru_luc && <small className={styles.muted}>Hồ sơ đã lưu trữ</small>}</td>
          <td>{person.tuoi !== null ? `${person.tuoi} tuổi` : "Chưa xác định"}</td><td>{dateTime(person.hoan_thanh_luc)}</td>
          <td><details className={styles.respondentAnswers}><summary>Xem câu trả lời ({person.answers.length})</summary><ol>{person.answers.map(answer => <li key={answer.ma_cau_hoi}><strong>{answer.cau_hoi}</strong><div className={styles.text}>{answer.lua_chon && <p>{answer.lua_chon}</p>}{answer.noi_dung && <p>{answer.noi_dung}</p>}{answer.diem !== null && <p>{answer.diem}/5 điểm</p>}</div></li>)}</ol></details></td>
        </tr>)}</tbody></table></div> : <p>{filters.q ? "Không có người trả lời phù hợp với tìm kiếm." : "Chưa có khách gửi bài trả lời."}</p>}
        <div className={styles.actions}><span>{data.respondents.total} người phù hợp · Trang {data.respondents.page}</span><div className={styles.actions}><button disabled={filters.page === 1} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>Người trả lời trước</button><button disabled={data.respondents.page * data.respondents.page_size >= data.respondents.total} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Người trả lời sau</button></div></div>
      </section> : <section id={`${tabId}-statistics-panel`} role="tabpanel" aria-labelledby={`${tabId}-statistics-tab`}><SurveyStatistics data={data.statistics} onTextPage={page => setFilters(current => ({ ...current, textPage: page }))} /></section>}
      {portal === "staff" && <Link href="/interests">Sở thích khách hàng từ khảo sát →</Link>}
    </>}
  </section>;
}
