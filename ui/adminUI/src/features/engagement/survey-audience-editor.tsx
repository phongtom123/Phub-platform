"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@internal/lib/admin-fetch";
import { engagementRequest, jsonBody, type AudiencePreview, type SurveyAudience } from "../../../../shared/engagement";
import styles from "./engagement.module.css";

function useAudience(config: string, scope: "selected" | "candidates", query: string, page: number, enabled: boolean, reload: number) {
  const [data, setData] = useState<AudiencePreview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(""); setLoading(enabled);
    if (!enabled) return () => controller.abort();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ scope, q: query.trim(), page: String(page) });
      engagementRequest<AudiencePreview>(`crm/survey-audience?${params}`, { method: "POST", ...jsonBody(JSON.parse(config)), signal: controller.signal, cache: "no-store" }, adminFetch)
        .then(next => { if (!controller.signal.aborted) setData(next); })
        .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được danh sách khách hàng."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [config, scope, query, page, enabled, reload]);
  return { data, error, loading };
}

export function SurveyAudienceEditor({ audience, disabled, onChange }: { audience: SurveyAudience; disabled: boolean; onChange: (value: SurveyAudience) => void }) {
  const [selectedQuery, setSelectedQuery] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [selectedPage, setSelectedPage] = useState(1);
  const [candidatePage, setCandidatePage] = useState(1);
  const [openCandidates, setOpenCandidates] = useState(false);
  const [reload, setReload] = useState(0);
  const config = JSON.stringify({ loai_doi_tuong: audience.loai_doi_tuong, tuoi_tu: audience.tuoi_tu, tuoi_den: audience.tuoi_den, khach_them: audience.khach_them ?? [], khach_loai: audience.khach_loai ?? [] });
  const valid = audience.loai_doi_tuong !== "DO_TUOI" || (audience.tuoi_tu !== null && audience.tuoi_den !== null && audience.tuoi_tu >= 0 && audience.tuoi_den <= 130 && audience.tuoi_tu <= audience.tuoi_den);
  useEffect(() => { setSelectedPage(1); setCandidatePage(1); }, [config]);
  const selected = useAudience(config, "selected", selectedQuery, selectedPage, valid, reload);
  const candidates = useAudience(config, "candidates", candidateQuery, candidatePage, valid && openCandidates, reload);
  function choose(id: string, add: boolean) {
    const included = new Set(audience.khach_them ?? []), excluded = new Set(audience.khach_loai ?? []);
    if (add) { included.add(id); excluded.delete(id); } else { included.delete(id); excluded.add(id); }
    setSelectedPage(1); setCandidatePage(1);
    onChange({ ...audience, khach_them: [...included].sort(), khach_loai: [...excluded].sort() });
  }
  function pagination(scope: "selected" | "candidates") {
    const state = scope === "selected" ? selected : candidates, page = scope === "selected" ? selectedPage : candidatePage;
    const setPage = scope === "selected" ? setSelectedPage : setCandidatePage;
    return state.data && <div className={styles.actions}><span>{state.data.total} khách phù hợp · Trang {page}</span><div className={styles.actions}><button type="button" disabled={state.loading || page === 1} onClick={() => setPage(value => value - 1)}>Trước</button><button type="button" disabled={state.loading || page * state.data.page_size >= state.data.total} onClick={() => setPage(value => value + 1)}>Sau</button></div></div>;
  }
  const stopEnter = (event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") event.preventDefault(); };
  return <section className={`${styles.card} ${styles.audienceEditor}`} aria-label="Chọn người nhận khảo sát">
    <div className={styles.actions}><div><h3>Danh sách dự kiến nhận khảo sát</h3><p className={styles.muted}>{selected.data ? `${selected.data.selected_total} khách đang hoạt động` : "Tự cập nhật theo đối tượng đã chọn"}</p></div><button type="button" disabled={disabled || !(audience.khach_them?.length || audience.khach_loai?.length)} onClick={() => onChange({ ...audience, khach_them: [], khach_loai: [] })}>Đặt lại thêm/bỏ</button></div>
    <p className={styles.muted}>Bạn có thể bỏ khách hoặc thêm khách ngoài bộ lọc tuổi. Các lựa chọn thủ công được giữ khi đổi bộ lọc và lưu cùng bản nháp. Khi phát hành, hệ thống kiểm tra lại tình trạng hoạt động trước khi chốt người nhận.</p>
    {!valid ? <p className={styles.notice}>Nhập khoảng tuổi hợp lệ để xem danh sách người nhận.</p> : <>
      <label>Tìm trong danh sách nhận<input aria-label="Tìm người nhận khảo sát" maxLength={100} placeholder="Tên hoặc mã khách…" value={selectedQuery} onKeyDown={stopEnter} onChange={event => { setSelectedQuery(event.target.value); setSelectedPage(1); }} /></label>
      {selected.loading ? <p role="status">Đang cập nhật danh sách người nhận…</p> : selected.error ? <p className={styles.error} role="alert">{selected.error} <button type="button" onClick={() => setReload(value => value + 1)}>Thử lại</button></p> : selected.data && <>
        {selected.data.unavailable_added_ids.length > 0 && <div className={styles.error} role="alert"><p>Một số khách thêm thủ công không còn khả dụng. Bỏ các khách này trước khi lưu/phát hành:</p>{selected.data.unavailable_added_ids.map(id => <button type="button" key={id} disabled={disabled} onClick={() => choose(id, false)}>Bỏ {id}</button>)}</div>}
        {selected.data.data.length ? <div className={styles.scroll}><table><thead><tr><th>Khách nhận khảo sát</th><th>Tuổi hiện tại</th><th>Lựa chọn</th></tr></thead><tbody>{selected.data.data.map(customer => <tr key={customer.ma_kh}><td><strong>{customer.ten_kh}</strong><div className={styles.muted}>{customer.ma_kh}</div>{customer.added_manually && <small className={styles.muted}>Thêm thủ công ngoài bộ lọc</small>}</td><td>{customer.tuoi ?? "Chưa có ngày sinh"}</td><td><button type="button" aria-label={`Bỏ người nhận ${customer.ma_kh}`} disabled={disabled} onClick={() => choose(customer.ma_kh, false)}>Bỏ khỏi danh sách</button></td></tr>)}</tbody></table></div> : <p>{selectedQuery ? "Không có người nhận phù hợp với tìm kiếm." : "Chưa có người nhận. Bạn có thể thêm khách bên dưới."}</p>}
        {pagination("selected")}
      </>}
      <details onToggle={event => setOpenCandidates(event.currentTarget.open)} className={styles.audienceCandidates}><summary>+ Thêm khách hàng vào danh sách</summary>
        <label>Tìm khách để thêm<input aria-label="Tìm khách để thêm vào khảo sát" maxLength={100} placeholder="Tên hoặc mã khách đang hoạt động…" value={candidateQuery} onKeyDown={stopEnter} onChange={event => { setCandidateQuery(event.target.value); setCandidatePage(1); }} /></label>
        {candidates.loading ? <p role="status">Đang tìm khách hàng…</p> : candidates.error ? <p className={styles.error} role="alert">{candidates.error} <button type="button" onClick={() => setReload(value => value + 1)}>Thử lại</button></p> : candidates.data && <>
          {candidates.data.data.length ? <div className={styles.scroll}><table><thead><tr><th>Khách chưa có trong danh sách</th><th>Tuổi hiện tại</th><th>Lựa chọn</th></tr></thead><tbody>{candidates.data.data.map(customer => <tr key={customer.ma_kh}><td><strong>{customer.ten_kh}</strong><div className={styles.muted}>{customer.ma_kh}</div></td><td>{customer.tuoi ?? "Chưa có ngày sinh"}</td><td><button type="button" aria-label={`Thêm người nhận ${customer.ma_kh}`} disabled={disabled || selected.loading} onClick={() => choose(customer.ma_kh, true)}>Thêm người nhận</button></td></tr>)}</tbody></table></div> : <p>Không còn khách đang hoạt động phù hợp để thêm.</p>}
          {pagination("candidates")}
        </>}
      </details>
    </>}
  </section>;
}
