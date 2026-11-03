"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, AlertTriangle, CalendarDays, Info, RefreshCw, Warehouse } from "lucide-react";
import { ExportCsvButton } from "../../components/export-csv-button";
import { sameAdminData } from "@/src/lib/admin-fetch";
import { useAdminPolling } from "@/src/lib/use-admin-polling";
import { rangeError, readReport, recentRange, reportCsv, reportWarnings, type BusinessReport, type ReportRange } from "./report-data";
import { ReportMetrics, ReportOverview } from "./report-overview";
import { ReportDetails } from "./report-details";
import { ReportGuide } from "./report-guide";
import { ReportWarehouseSelect } from "./report-warehouse-select";
import { reportDate } from "./report-format";
import styles from "./reports.module.css";

export function ReportsView() {
  const router = useRouter(), params = useSearchParams();
  const [defaults] = useState(() => recentRange(30));
  const start = params.get("start") ?? defaults.start, end = params.get("end") ?? defaults.end;
  const warehouseParam = params.get("warehouse_id"), warehouseId = warehouseParam ? Number(warehouseParam) : null;
  const warehouseError = warehouseParam !== null && (!/^[1-9]\d*$/.test(warehouseParam) || !Number.isSafeInteger(warehouseId) || warehouseId! > 2147483647) ? "Chọn một kho báo cáo hợp lệ." : "";
  const period = useMemo(() => ({ start, end }), [start, end]);
  const periodError = rangeError(period) || warehouseError;
  const [draft, setDraft] = useState<ReportRange>(period);
  const [draftWarehouse, setDraftWarehouse] = useState(warehouseParam ?? "");
  const [filterError, setFilterError] = useState("");
  const [summary, setSummary] = useState<BusinessReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const visible = !periodError && summary?.start === start && summary?.end === end && summary?.warehouse_id === warehouseId ? summary : null;

  useEffect(() => { setDraft(period); setDraftWarehouse(warehouseParam ?? ""); setFilterError(""); }, [period, warehouseParam]);
  useEffect(() => {
    setSummary(null); setError("");
    if (periodError) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true);
    readReport(period, controller.signal, warehouseId)
      .then(data => { if (!controller.signal.aborted) setSummary(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được báo cáo."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, periodError, warehouseId, version]);

  const pollError = useAdminPolling(JSON.stringify([period, warehouseId, version]), !loading && !periodError && Boolean(visible), async (signal, canApply) => {
    const data = await readReport(period, signal, warehouseId);
    if (canApply()) setSummary(current => sameAdminData(current, data) ? current : data);
  });
  function apply(next: ReportRange, selectedWarehouse = warehouseParam ?? "") {
    const invalid = rangeError(next);
    setFilterError(invalid);
    if (invalid) return;
    const query = new URLSearchParams(next);
    if (selectedWarehouse) query.set("warehouse_id", selectedWarehouse);
    if (next.start === start && next.end === end && selectedWarehouse === (warehouseParam ?? "")) setVersion(v => v + 1);
    else router.replace(`/reports?${query}`, { scroll: false });
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); apply(draft, draftWarehouse); }
  function download() {
    if (!visible || loading || error || pollError) return;
    const url = URL.createObjectURL(new Blob([reportCsv(visible)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `phub-kinh-doanh-${start}-${end}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className={`live-data ${styles.page}`} aria-label="Báo cáo kinh doanh">
    <header className={styles.heading}>
      <div className={styles.headingActions}><span className={styles.warehouseBadge}><Warehouse size={15} />{warehouseId === null ? "Tất cả kho" : `Kho #${warehouseId}`}</span><button type="button" disabled={loading || Boolean(periodError)} onClick={() => setVersion(value => value + 1)}><RefreshCw size={16} className={loading ? styles.spinning : ""} aria-hidden="true" /><span>Làm mới báo cáo</span></button></div>
    </header>

    <div className={styles.periodCard}>
      <div className={styles.periodLabel}><CalendarDays size={18} aria-hidden="true" /><span>Kỳ báo cáo</span></div>
      <div className={styles.presets} aria-label="Chọn nhanh kỳ báo cáo">{[7, 30, 90].map(days => {
        const range = recentRange(days);
        const selected = start === range.start && end === range.end;
        return <button type="button" key={days} aria-pressed={selected} onClick={() => apply(range)}>{days} ngày gần đây</button>;
      })}</div>
      <form className={styles.filters} onSubmit={submit} aria-label="Kỳ báo cáo">
        <ReportWarehouseSelect value={draftWarehouse} onChange={setDraftWarehouse} />
        <label><span>Từ ngày</span><input type="date" required value={draft.start} onChange={event => { setDraft(current => ({ ...current, start: event.target.value })); setFilterError(""); }} /></label>
        <span className={styles.dateSeparator} aria-hidden="true">—</span>
        <label><span>Đến ngày</span><input type="date" required value={draft.end} onChange={event => { setDraft(current => ({ ...current, end: event.target.value })); setFilterError(""); }} /></label>
        <button type="submit" className={styles.applyButton}>Xem báo cáo</button>
      </form>
    </div>

    {(filterError || periodError) && <p className={styles.error} role="alert"><AlertCircle size={18} /><span>{filterError || periodError}</span></p>}
    {loading && <div className={styles.loading} role="status"><span className={styles.loadingLabel}><RefreshCw size={16} className={styles.spinning} />Đang tải báo cáo…</span><div className={styles.skeletons}>{[0, 1, 2, 3].map(index => <div key={index}><i /><i /><i /></div>)}</div></div>}
    {error && <div className={styles.error} role="alert"><AlertCircle size={20} /><span>{error}</span><button type="button" onClick={() => setVersion(value => value + 1)}>Thử lại</button></div>}
    {pollError && visible && <p className={styles.warning} role="alert"><AlertTriangle size={18} /><span>Chưa cập nhật được báo cáo; đang giữ số liệu lần tải trước. {pollError}</span></p>}

    {visible && <section className={styles.results} aria-label="Số liệu kinh doanh">
      <div className={styles.resultHeading}><div><h2>Tổng quan trong kỳ</h2><p><span>{reportDate(start)} — {reportDate(end)}</span><span className={styles.periodHint}>Theo ngày hoàn thành · Giờ Việt Nam</span></p></div><ExportCsvButton onClick={download} disabled={loading || Boolean(error || pollError)} /></div>
      {visible.warnings.map(warning => <div className={styles.warning} role="alert" key={warning}><AlertTriangle size={19} /><div><strong>Chưa đủ dữ liệu để xác định đầy đủ lợi nhuận</strong><p>{reportWarnings[warning]}</p></div></div>)}
      {visible.order_count === 0 && <div className={styles.emptyPeriod}><Info size={19} /><div><strong>Kỳ này chưa có đơn hàng hoàn thành</strong><p>Khoản thanh toán thành công vẫn tính trong dòng tiền. Doanh thu và lợi nhuận được ghi nhận khi đơn hoàn thành.</p></div><button type="button" onClick={() => apply(recentRange(90))}>Xem 90 ngày gần đây</button></div>}
      <ReportMetrics report={visible} />
      <ReportOverview key={`overview:${start}:${end}:${warehouseId}`} report={visible} />
      <ReportDetails key={`details:${start}:${end}:${warehouseId}`} report={visible} />
    </section>}
    <ReportGuide />
  </section>;
}
