"use client";

import { useRef, useState, type FormEvent } from "react";
import { vietnamDay } from "../dashboard/dashboard-data";
import base from "../customer-insights/customer-insights.module.css";
import styles from "./product-insights.module.css";
import { PRESET_LABELS, presetRange, selectedDateRange, type DateSelection, type InsightsPeriod, type InsightsRange, type RangePreset } from "./product-insights-data";

const PERIOD_LABELS: Record<InsightsPeriod, string> = { day: "Ngày", month: "Tháng", quarter: "Quý", year: "Năm" };

export function InsightsDateFilter({ period, range, onChange }: {
  period: InsightsPeriod; range: InsightsRange; onChange: (period: InsightsPeriod, range: InsightsRange) => void;
}) {
  const [mode, setMode] = useState<DateSelection>(range.start ? "custom" : "all");
  const [start, setStart] = useState(range.start ?? "");
  const [end, setEnd] = useState(range.end ?? "");
  const [error, setError] = useState("");
  const endInput = useRef<HTMLInputElement>(null);
  const today = vietnamDay(new Date())!;

  const choosePreset = (preset: RangePreset) => {
    const next = presetRange(preset);
    setMode(preset === "all" ? "all" : "custom");
    setStart(next.start ?? ""); setEnd(next.end ?? ""); setError("");
    onChange(period, next);
  };
  const apply = (event: FormEvent) => {
    event.preventDefault();
    try {
      const next = selectedDateRange(mode, start, end);
      setError("");
      onChange(period, next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Khoảng thời gian không hợp lệ."); }
  };

  return <form className={styles.dateFilter} onSubmit={apply}>
    <div className={styles.dateFilterTabs}>
      <div className={base.periodTabs} aria-label="Khoảng thời gian lập hóa đơn">
        {(Object.keys(PRESET_LABELS) as RangePreset[]).map(preset => {
          const candidate = presetRange(preset);
          const active = candidate.start === range.start && candidate.end === range.end;
          return <button key={preset} type="button" aria-pressed={active}
            className={`${base.periodTab} ${active ? base.periodTabActive : ""}`} onClick={() => choosePreset(preset)}>{PRESET_LABELS[preset]}</button>;
        })}
      </div>
      <div className={base.periodTabs} aria-label="Gom xu hướng theo">
        {(Object.keys(PERIOD_LABELS) as InsightsPeriod[]).map(option => <button key={option} type="button" aria-pressed={period === option}
          className={`${base.periodTab} ${period === option ? base.periodTabActive : ""}`} onClick={() => onChange(option, range)}>
          Theo {PERIOD_LABELS[option]}
        </button>)}
      </div>
    </div>
    <div className={styles.dateFilterForm}>
      <label className={styles.dateFilterMode}>Chọn thời gian<select value={mode} onChange={event => {
        const next = event.target.value as DateSelection;
        setMode(next); setError("");
        setStart(next === "month" ? (range.start?.slice(0, 7) ?? "") : (range.start ?? ""));
        setEnd(range.end ?? "");
      }}>
        <option value="all">Toàn thời gian</option><option value="day">Một ngày</option>
        <option value="month">Một tháng</option><option value="custom">Khoảng ngày tùy chỉnh</option>
      </select></label>
      {mode !== "all" && <label>{mode === "month" ? "Tháng" : mode === "day" ? "Ngày" : "Từ ngày"}
        <input type={mode === "month" ? "month" : "date"} required value={start} min={mode === "month" ? "0001-01" : "0001-01-01"}
          max={mode === "month" ? today.slice(0, 7) : today} onChange={event => {
            setStart(event.target.value); setError("");
            if (mode === "custom" && event.target.value && event.target.validity.valid) {
              const target = endInput.current;
              target?.focus();
              try { target?.showPicker?.(); } catch { /* Keep focus when the browser disallows opening its native picker. */ }
            }
          }} />
      </label>}
      {mode === "custom" && <label>Đến ngày<input ref={endInput} type="date" required value={end} min="0001-01-01" max={today}
        onChange={event => { setEnd(event.target.value); setError(""); }} /></label>}
      <div className={styles.dateFilterActions}>
        <button type="submit" className={`${base.btn} ${base.btnPrimary}`}>Áp dụng</button>
        <button type="button" className={base.btn} disabled={!start && !end}
          onClick={() => { setStart(""); setEnd(""); setError(""); }}>Xóa ngày</button>
      </div>
    </div>
    {error && <p className={styles.dateFilterError} role="alert">{error}</p>}
  </form>;
}
