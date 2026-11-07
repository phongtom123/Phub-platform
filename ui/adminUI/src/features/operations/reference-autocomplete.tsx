"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { adminFetch } from "@internal/lib/admin-fetch";
import type { DataRow } from "@internal/lib/inline-table-data";
import styles from "./product-autocomplete.module.css";

const PAGE_SIZE = 10;
const lookups = {
  product: { resource: "products", id: "sku", name: "ten_sp", noun: "sản phẩm", placeholder: "Nhập tên, mã sản phẩm hoặc SKU…" },
  supplier: { resource: "suppliers", id: "ma_ncc", name: "ten_ncc", noun: "nhà cung cấp", placeholder: "Nhập tên hoặc mã nhà cung cấp…" },
} as const;
function itemLabel(kind: keyof typeof lookups, row: DataRow): string {
  const fields = kind === "product" ? [row.ten_sp, row.ma_sp, row.sku] : [row.ten_ncc, `Mã NCC: ${row.ma_ncc}`];
  return fields.filter(value => value !== null && value !== undefined && value !== "").map(String).join(" · ");
}

export interface AutocompleteProps {
  value: string;
  onChange: (value: string, row?: DataRow) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
}
export function ReferenceAutocomplete({ kind, value, onChange, label, required = false, disabled = false }: AutocompleteProps & { kind: keyof typeof lookups }) {
  const lookup = lookups[kind];
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<{ value: string; text: string } | null>(null);
  const [selected, setSelected] = useState<DataRow | null>(null);
  const query = draft?.value === value ? draft.text : value;
  const key = JSON.stringify([lookup.resource, query.trim(), page, revision]);
  const [result, setResult] = useState<{ key: string; rows: DataRow[]; total: number; error: string } | null>(null);
  const current = result?.key === key ? result : null;
  const rows = current?.rows ?? [];
  const chosen = selected && String(selected[lookup.id]) === value ? selected : rows.find(row => String(row[lookup.id]) === value);
  const text = draft?.value === value ? draft.text : chosen ? itemLabel(kind, chosen) : value;

  useEffect(() => {
    input.current?.setCustomValidity(text.trim() && !value ? `Vui lòng chọn ${lookup.noun} trong danh sách gợi ý.` : "");
  }, [text, value, lookup.noun]);

  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim(), page: String(page), page_size: String(PAGE_SIZE) });
      void adminFetch(`/api/backend/data/${lookup.resource}?${params}`, { signal: controller.signal })
        .then(async response => {
          const body = await response.json();
          if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : `Không tải được gợi ý ${lookup.noun}.`);
          if (!body || !Array.isArray(body.data) || !Number.isSafeInteger(body.total) || body.total < 0 ||
              !body.data.every((row: DataRow) => row && (kind === "product"
                ? typeof row.sku === "string" && row.sku
                : Number.isSafeInteger(row.ma_ncc) && Number(row.ma_ncc) >= -2147483648 && Number(row.ma_ncc) <= 2147483647))) {
            throw new Error(`Dữ liệu gợi ý ${lookup.noun} không hợp lệ.`);
          }
          if (!controller.signal.aborted) setResult({ key, rows: body.data, total: body.total, error: "" });
        })
        .catch(error => {
          if (!controller.signal.aborted) setResult({ key, rows: [], total: 0,
            error: error instanceof Error ? error.message : `Không tải được gợi ý ${lookup.noun}.` });
        });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, disabled, key, query, page, kind, lookup.resource, lookup.noun]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || disabled) return;
    const place = () => {
      const rect = input.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 5, margin = 8;
      const below = Math.max(0, window.innerHeight - rect.bottom - gap - margin);
      const above = Math.max(0, rect.top - gap - margin);
      const flip = below < 180 && above > below;
      const width = Math.min(rect.width, Math.max(0, window.innerWidth - margin * 2));
      const next = {
        left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)), width,
        top: flip ? undefined : rect.bottom + gap,
        bottom: flip ? window.innerHeight - rect.top + gap : undefined,
        maxHeight: Math.min(340, flip ? above : below),
      };
      setPosition(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const observer = new ResizeObserver(place);
    if (input.current) observer.observe(input.current);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      observer.disconnect();
    };
  }, [open, disabled]);

  const choose = (row: DataRow) => {
    setSelected(row); setDraft(null); setOpen(false); setActive(0); setPage(1);
    input.current?.setCustomValidity("");
    onChange(String(row[lookup.id]), row);
  };

  return <span ref={root} className={styles.root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !menu.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <input ref={input} role="combobox" aria-label={label} aria-autocomplete="list"
      aria-expanded={open && !disabled} aria-controls={`${id}-options`}
      aria-activedescendant={open && rows[active] ? `${id}-option-${active}` : undefined}
      autoComplete="off" placeholder={lookup.placeholder} required={required}
      disabled={disabled} value={text} maxLength={100}
      onFocus={event => { setOpen(true); event.currentTarget.select(); }}
      onChange={event => {
        setDraft({ value: "", text: event.target.value }); setPage(1); setActive(0); setOpen(true);
        if (value) onChange("");
      }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive(index => rows.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length : 0);
        } else if (event.key === "Enter" && open) {
          event.preventDefault(); if (rows[active]) choose(rows[active]);
        } else if (event.key === "Escape") {
          event.preventDefault(); setOpen(false);
        }
      }} />
    {open && !disabled && position && createPortal(<span ref={menu} className={styles.menu} style={position}>
      {!current && <small role="status" className={styles.message}>Đang tìm {lookup.noun}…</small>}
      {current?.error && <span className={styles.message}>
        <small role="alert">{current.error}</small>
        <button type="button" onClick={() => setRevision(n => n + 1)}>Thử lại</button>
      </span>}
      {current && !current.error && !rows.length && <small role="status" className={styles.message}>Không tìm thấy {lookup.noun} phù hợp.</small>}
      <span role="listbox" id={`${id}-options`} aria-label={`Gợi ý ${lookup.noun}`} className={styles.options}>
        {rows.map((row, index) => <button type="button" role="option" tabIndex={-1}
          id={`${id}-option-${index}`} key={String(row[lookup.id])} aria-selected={index === active}
          className={index === active ? styles.active : undefined}
          onMouseDown={event => event.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => choose(row)}>
          <strong>{String(row[lookup.name] ?? row[lookup.id])}</strong>
          <small>{kind === "product" ? <>Mã SP: {String(row.ma_sp ?? "—")} · SKU: {String(row.sku)}</> : <>Mã NCC: {String(row.ma_ncc)}</>}</small>
        </button>)}
      </span>
      {current && !current.error && current.total > PAGE_SIZE && <span className={styles.pager}>
        <button type="button" disabled={page === 1} onClick={() => { setPage(n => n - 1); setActive(0); }}>Trước</button>
        <small>Trang {page} / {Math.ceil(current.total / PAGE_SIZE)}</small>
        <button type="button" disabled={page * PAGE_SIZE >= current.total} onClick={() => { setPage(n => n + 1); setActive(0); }}>Sau</button>
      </span>}
    </span>, document.body)}
  </span>;
}
