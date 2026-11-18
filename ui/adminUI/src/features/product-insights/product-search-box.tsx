"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import styles from "./product-insights.module.css";
import { StockBadge } from "./stock-badge";
import { fetchStockList, type InsightsRange, type StockListItem, type StockStatus } from "./product-insights-data";

const SUGGESTION_LIMIT = 8;

/** Folds one character at a time so indexes in the folded text match the original (for highlighting). */
function fold(text: string) {
  return Array.from(text, ch => {
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d");
    return base.length === 1 ? base : ch.toLowerCase();
  }).join("");
}

/** Bold the first accent-insensitive match of `needle` inside `text`. */
export function Highlight({ text, needle }: { text: string; needle: string }) {
  const chars = Array.from(text);
  const at = needle ? fold(text).indexOf(fold(needle)) : -1;
  if (at < 0) return <>{text}</>;
  const end = at + Array.from(needle).length;
  return <>{chars.slice(0, at).join("")}<mark className={styles.match}>{chars.slice(at, end).join("")}</mark>{chars.slice(end).join("")}</>;
}

/**
 * Search input with live suggestions (combobox). Suggestions follow the list's status/category filters;
 * picking one puts the product name in the box so the list narrows to it.
 */
export function ProductSearchBox({ value, onChange, onSubmit, status, category, range, threshold }: {
  value: string; onChange: (value: string) => void;
  /** Called only when a search is finished: Enter, a picked suggestion, or an emptied box. */
  onSubmit: (term: string) => void;
  status: StockStatus; category: string | null; range: InsightsRange; threshold: number;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<{ key: string; items: StockListItem[]; total: number; error: boolean }>({ key: "", items: [], total: 0, error: false });

  useEffect(() => {
    const timer = setTimeout(() => setTyped(value.trim()), 200);
    return () => clearTimeout(timer);
  }, [value]);

  const key = JSON.stringify([typed, status, category, range.start, range.end]);
  useEffect(() => {
    if (!typed) return;
    const controller = new AbortController();
    fetchStockList({ view: "products", status, category, q: typed, page: 1, pageSize: SUGGESTION_LIMIT }, range, controller.signal)
      .then(list => { if (!controller.signal.aborted) { setState({ key, items: list.items, total: list.total, error: false }); setActive(-1); } })
      .catch(() => { if (!controller.signal.aborted) setState({ key, items: [], total: 0, error: true }); });
    return () => controller.abort();
    // `key` encodes every input of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ready = state.key === key && typed === value.trim();
  const items = ready ? state.items : [];
  const showList = open && value.trim() !== "";

  const pick = (item: StockListItem) => {
    onChange(item.name);
    onSubmit(item.name);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!items.length) return;
      event.preventDefault();
      setOpen(true);
      setActive(current => event.key === "ArrowDown" ? (current + 1) % items.length : (current <= 0 ? items.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (showList && active >= 0 && items[active]) pick(items[active]);
      else {
        onSubmit(value.trim());
        setOpen(false);
        setActive(-1);
      }
    } else if (event.key === "Escape" && showList) {
      // First Escape closes the suggestions only. React is mounted on `document` (Next.js App Router), the same node
      // as the drawer's key listener, so stopPropagation alone cannot shield it: drawers skip defaultPrevented Escapes.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className={styles.suggestWrap}>
      <label className={styles.searchBox}>
        <Search size={15} aria-hidden="true" />
        <input
          type="search" value={value} maxLength={100} placeholder="Tìm theo tên hoặc SKU…" aria-label="Tìm sản phẩm"
          role="combobox" aria-autocomplete="list" aria-expanded={showList} aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={event => {
            onChange(event.target.value);
            setOpen(true);
            // Emptying the box (typing or the native clear button) restores the full list right away.
            if (!event.target.value.trim()) onSubmit("");
          }}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
        />
      </label>
      {showList && (
        <ul id={listId} role="listbox" className={styles.suggestList} aria-label="Gợi ý sản phẩm">
          {!ready ? (
            <li className={styles.suggestNote} role="presentation">Đang tìm…</li>
          ) : state.error ? (
            <li className={styles.suggestNote} role="presentation">Không tải được gợi ý. Danh sách bên dưới vẫn lọc theo từ khóa.</li>
          ) : items.length === 0 ? (
            <li className={styles.suggestNote} role="presentation">Không có sản phẩm khớp “{value.trim()}”.</li>
          ) : (
            <>
              {items.map((item, index) => (
                <li
                  key={item.sku} id={`${listId}-${index}`} role="option" aria-selected={index === active}
                  className={`${styles.suggestItem} ${index === active ? styles.suggestActive : ""}`}
                  // Keep focus in the input so blur does not close the list before the click lands.
                  onMouseDown={event => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(item)}
                >
                  <span>
                    <strong><Highlight text={item.name} needle={typed} /></strong>
                    <small><Highlight text={item.sku} needle={typed} /> · {item.category_name}{item.brand ? ` · ${item.brand}` : ""}</small>
                  </span>
                  <StockBadge available={item.available_units} threshold={threshold} />
                </li>
              ))}
              <li className={styles.suggestNote} role="presentation">
                {state.total > items.length ? `Còn ${(state.total - items.length).toLocaleString("vi-VN")} sản phẩm khác khớp · ` : ""}
                Nhấn Enter để lọc danh sách theo “{value.trim()}”
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}
