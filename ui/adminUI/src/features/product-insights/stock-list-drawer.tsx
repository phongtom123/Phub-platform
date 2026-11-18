"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import base from "../customer-insights/customer-insights.module.css";
import styles from "./product-insights.module.css";
import { StockBadge } from "./stock-badge";
import { ProductSearchBox } from "./product-search-box";
import { ProductName } from "./product-name";
import {
  STOCK_VIEW_DEFAULT_STATUS,
  fetchStockList,
  formatNumber,
  formatVND,
  type InsightsRange,
  type ProductStockList,
  type StockQuery,
  type StockStatus,
  type StockView,
} from "./product-insights-data";

const PAGE_SIZE = 20;
const TITLES: Record<Exclude<StockView, "sales">, { title: string; sub: string }> = {
  products: { title: "Danh sách sản phẩm", sub: "Sắp theo tên · số đã bán tính trong kỳ đang chọn" },
  stock: { title: "Tồn khả dụng theo sản phẩm", sub: "Tồn trong các kho đang hoạt động, đã trừ phần đang giữ cho đơn" },
  low: { title: "Hết hàng & sắp hết hàng", sub: "Tồn khả dụng thấp nhất trước; cùng mức tồn thì mặt hàng bán chạy trước" },
  value: { title: "Giá trị tồn theo giá bán", sub: "Tồn khả dụng × giá bán hiện tại, không phải giá vốn" },
};
const STATUS_LABELS: Record<StockStatus, string> = { ACTIVE: "Đang bán", PAUSED: "Tạm ngưng", HIDDEN: "Đã ẩn", ALL: "Tất cả trạng thái" };
const PRODUCT_STATUS: Record<number, string> = { 1: "Đang bán", 2: "Tạm ngưng", 0: "Đã ẩn" };

export function StockListDrawer({ view, range, suspended, onSelectProduct, onClose }: {
  view: Exclude<StockView, "sales">; range: InsightsRange; suspended: boolean; onSelectProduct: (sku: string) => void; onClose: () => void;
}) {
  const [status, setStatus] = useState<StockStatus>(STOCK_VIEW_DEFAULT_STATUS[view]);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  // The list only reloads for a finished search (Enter / picked suggestion / emptied box), never while typing.
  const [term, setTerm] = useState("");
  const query: StockQuery = { view, status, category, q: term || null, page, pageSize: PAGE_SIZE };
  const key = JSON.stringify([query, range.start, range.end, revision]);
  const [state, setState] = useState<{ key: string; list: ProductStockList | null; error: string | null }>({ key: "", list: null, error: null });
  const [categories, setCategories] = useState<ProductStockList["categories"]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;

  // A new filter or search always starts from the first page.
  useEffect(() => { setPage(1); }, [status, category, term]);

  useEffect(() => {
    const controller = new AbortController();
    fetchStockList(JSON.parse(key)[0], range, controller.signal)
      .then(list => {
        if (controller.signal.aborted) return;
        setState({ key, list, error: null });
        setCategories(list.categories);
      })
      .catch(error => { if (!controller.signal.aborted) setState({ key, list: null, error: error instanceof Error ? error.message : "Không thể tải danh sách sản phẩm." }); });
    return () => controller.abort();
    // `key` encodes every input of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    // While a product chart is open on top, Escape belongs to that drawer.
    // An Escape already handled inside the drawer (e.g. closing search suggestions) is marked defaultPrevented.
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented && !suspendedRef.current) onCloseRef.current(); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", escape); opener?.focus?.(); };
  }, []);

  const current = state.key === key ? state : { list: null, error: null };
  const list = current.list;
  const pages = list ? Math.max(1, Math.ceil(list.total / list.page_size)) : 1;
  const threshold = list?.low_stock_threshold ?? 5;
  const { title, sub } = TITLES[view];

  return (
    <div className={styles.backdrop} onMouseDown={event => event.target === event.currentTarget && !suspended && onClose()}>
      <section className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="stock-list-title">
        <header className={styles.drawerHeader}>
          <div>
            <p>Sản phẩm & tồn kho</p>
            <h2 id="stock-list-title">{title}</h2>
            <small className={styles.muted}>{sub}</small>
          </div>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Đóng danh sách"><X aria-hidden="true" /></button>
        </header>

        <div className={styles.drawerBody}>
          <div className={styles.listToolbar}>
            <ProductSearchBox value={search} onChange={setSearch} onSubmit={next => setTerm(next.trim())} status={status} category={category} range={range} threshold={threshold} />
            <select value={category ?? ""} onChange={event => setCategory(event.target.value || null)} aria-label="Lọc theo loại sản phẩm">
              <option value="">Tất cả loại</option>
              {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
            </select>
            <select value={status} onChange={event => setStatus(event.target.value as StockStatus)} aria-label="Lọc theo trạng thái">
              {(Object.keys(STATUS_LABELS) as StockStatus[]).map(key => <option key={key} value={key}>{STATUS_LABELS[key]}</option>)}
            </select>
          </div>

          {term && (
            <p className={styles.searchState}>
              Kết quả cho “<strong>{term}</strong>”
              <button type="button" onClick={() => { setSearch(""); setTerm(""); }}>Bỏ lọc tìm kiếm</button>
            </p>
          )}
          {current.error && (
            <div className={`${base.stateBox} ${base.errorBox}`} role="alert">
              <span>{current.error}</span>
              <button type="button" className={base.btn} onClick={() => setRevision(value => value + 1)}>Thử lại</button>
            </div>
          )}
          {!list && !current.error && <div className={base.stateBox} role="status"><span>Đang tải danh sách…</span></div>}
          {list && (
            <>
              <div className={styles.drawerMetrics}>
                <div><span>Sản phẩm</span><strong>{formatNumber(list.totals.products)}</strong><small>{STATUS_LABELS[list.status].toLowerCase()}</small></div>
                <div><span>Tồn khả dụng</span><strong>{formatNumber(list.totals.available_units)}</strong><small>thực tế {formatNumber(list.totals.physical_units)} · giữ {formatNumber(list.totals.held_units)}</small></div>
                <div><span>Giá trị tồn (giá bán)</span><strong>{formatVND(list.totals.inventory_value)}</strong><small>của danh sách đã lọc</small></div>
                <div><span>Kho đang hoạt động</span><strong>{formatNumber(list.warehouses.length)}</strong><small>có tồn của danh sách này</small></div>
              </div>

              {view === "stock" && list.warehouses.length > 0 && (
                <div className={base.card}>
                  <h3 className={styles.drawerCardTitle}>Theo kho</h3>
                  <div style={{ overflowX: "auto" }}>
                    <table className={base.timelineTable}>
                      <thead><tr><th>Kho</th><th className={styles.num}>Thực tế</th><th className={styles.num}>Đang giữ</th><th className={styles.num}>Khả dụng</th></tr></thead>
                      <tbody>
                        {list.warehouses.map(w => (
                          <tr key={w.warehouse_id}><td>{w.name}</td><td className={styles.num}>{formatNumber(w.physical_units)}</td>
                            <td className={styles.num}>{formatNumber(w.held_units)}</td><td className={styles.num}><strong>{formatNumber(w.available_units)}</strong></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className={base.card}>
                {list.items.length === 0 ? (
                  <p className={styles.empty}>{list.total === 0 ? "Không có sản phẩm nào khớp bộ lọc." : "Trang này không còn sản phẩm."}</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    {/* Fixed layout: numeric columns keep their width, the name column takes the rest and truncates. */}
                    <table className={`${base.timelineTable} ${styles.listTable}`}>
                      <thead>
                        <tr>
                          <th>Sản phẩm</th>
                          {view === "products" && <th className={`${styles.num} ${styles.colMoney}`}>Giá bán</th>}
                          {view !== "stock" && view !== "value" && <th className={`${styles.num} ${styles.colCount}`}>Đã bán</th>}
                          {view === "stock" && <th className={`${styles.num} ${styles.colCount}`}>Thực tế</th>}
                          {view !== "products" && view !== "value" && <th className={`${styles.num} ${styles.colCount}`}>Đang giữ</th>}
                          {view === "value" && <th className={`${styles.num} ${styles.colMoney}`}>Giá bán</th>}
                          <th className={`${styles.num} ${styles.colStock}`}>Khả dụng</th>
                          {view === "value" && <th className={`${styles.num} ${styles.colValue}`}>Giá trị tồn</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {list.items.map(item => (
                          <tr key={item.sku} className={styles.clickableRow} onClick={() => onSelectProduct(item.sku)}>
                            <td>
                              <ProductName name={item.name} onOpen={() => onSelectProduct(item.sku)} />
                              <small className={`${styles.muted} ${styles.truncate}`}
                                title={`${item.sku} · ${item.category_name}${item.brand ? ` · ${item.brand}` : ""}`}>
                                {item.sku} · {item.category_name}{item.brand ? ` · ${item.brand}` : ""}
                                {item.status !== 1 ? ` · ${PRODUCT_STATUS[item.status] ?? "Trạng thái khác"}` : ""}
                              </small>
                            </td>
                            {view === "products" && <td className={styles.num}>{formatVND(item.price)}</td>}
                            {view !== "stock" && view !== "value" && <td className={styles.num}>{formatNumber(item.quantity_sold)}</td>}
                            {view === "stock" && <td className={styles.num}>{formatNumber(item.physical_units)}</td>}
                            {view !== "products" && view !== "value" && <td className={styles.num}>{formatNumber(item.held_units)}</td>}
                            {view === "value" && <td className={styles.num}>{formatVND(item.price)}</td>}
                            <td className={styles.num}><StockBadge available={item.available_units} threshold={threshold} /></td>
                            {view === "value" && (
                              <td className={styles.num}>
                                <strong>{formatVND(item.inventory_value)}</strong>
                                <small className={styles.muted} style={{ display: "block" }}>{item.value_percentage}%</small>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <nav className={styles.pager} aria-label="Phân trang">
                  <span>Trang {formatNumber(list.page)} / {formatNumber(pages)} · {formatNumber(list.total)} sản phẩm</span>
                  <div>
                    <button type="button" className={base.btn} disabled={list.page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>
                      <ChevronLeft size={15} aria-hidden="true" /> Trước
                    </button>
                    <button type="button" className={base.btn} disabled={list.page >= pages} onClick={() => setPage(value => value + 1)}>
                      Sau <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                </nav>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
