"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { adminFetch, invalidateAdminCache, sameAdminData } from "../../lib/admin-fetch";
import { useAdminPolling } from "../../lib/use-admin-polling";
import { dataHref } from "../../lib/data-navigation";
import type { DataColumn, DataRow } from "../../lib/inline-table-data";
import { useAdminAuth } from "../../components/admin/auth-provider";
import { newestOrderRows, orderListLayout, orderValue, type OrderSummary } from "./order-presentation";
import { formatMoney } from "../operations/financial-summary";
import { OrderBadges, OrderDetail } from "./order-detail";
import type { AdminOrderDetailData } from "./order-detail-data";
import { ScrollableTable } from "../tables/scrollable-table";
import { OperationPanel } from "../operations/operation-panel";
import { OrderSplitPane } from "./order-split-pane";
import styles from "./order-drawer.module.css";

type Person = { resource: "customers" | "employees"; id: string };
type Names = Record<string, string | null>;
const personKey = ({ resource, id }: Person) => JSON.stringify([resource, id]);

/** Resolve only people referenced on the current page, using existing protected APIs. */
function useOrderPeople(rows: DataRow[], version: number) {
  const people = new Map<string, Person>();
  for (const row of rows) {
    for (const [field, resource] of [["ma_kh", "customers"], ["ma_nhan_vien", "employees"]] as const) {
      if (typeof row[field] === "string" && row[field]) {
        const person = { resource, id: row[field] };
        people.set(personKey(person), person);
      }
    }
  }
  const identity = JSON.stringify([...people.values()].sort((a, b) => personKey(a).localeCompare(personKey(b))));
  const [names, setNames] = useState<Names>({});
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState("");
  const requestIdentity = JSON.stringify([identity, version, retry]);

  useEffect(() => {
    const controller = new AbortController();
    const queue: Person[] = JSON.parse(identity);
    setNames({}); setSnapshot(requestIdentity);
    // Bound concurrency; repeated customers/employees are fetched only once.
    const worker = async () => {
      while (queue.length && !controller.signal.aborted) {
        const person = queue.shift()!;
        let name: string | null = null;
        try {
          const key = encodeURIComponent(JSON.stringify([person.id]));
          const response = await adminFetch(`/api/backend/data/${person.resource}?key=${key}`, {
            signal: controller.signal, cache: "no-cache",
          });
          if (!response.ok) throw new Error("Không tải được hồ sơ.");
          const body = await response.json();
          const idField = person.resource === "customers" ? "ma_kh" : "ma_nhan_vien";
          const row = body.data?.find((item: DataRow) => item[idField] === person.id);
          const value = row?.[person.resource === "customers" ? "ten_kh" : "ho_ten"];
          if (typeof value === "string" && value.trim()) name = value.trim();
        } catch { /* Keep the order visible when a related profile cannot be read. */ }
        if (!controller.signal.aborted) setNames(current => ({ ...current, [personKey(person)]: name }));
      }
    };
    void Promise.all(Array.from({ length: Math.min(queue.length, 4) }, worker));
    return () => controller.abort();
  }, [identity, requestIdentity]);

  return { names: snapshot === requestIdentity ? names : {}, retry: () => setRetry(value => value + 1) };
}

type Props = {
  rows: DataRow[]; columns: DataColumn[]; keys: string[]; detail?: boolean; version: number;
  related?: { name: string; title: string }[];
  detailData?: AdminOrderDetailData; onRefresh?: () => void;
  onRowChanged?: (row: DataRow) => void;
  onDetailOpenChange?: (open: boolean) => void;
  initialOrderId?: string | null;
  onDismissInitial?: () => void;
  label: (field: string) => string;
  summaries?: Record<string, OrderSummary>;
};

const detailPath = (orderId: string) => `/api/backend/admin/orders/${encodeURIComponent(orderId)}/detail`;

function validDetail(value: unknown, orderId: string): value is AdminOrderDetailData {
  const detail = value as AdminOrderDetailData;
  return Boolean(detail && detail.order_id === orderId && detail.order?.ma_donhang === orderId && detail.financial &&
    Array.isArray(detail.lines) && Array.isArray(detail.payments) && Array.isArray(detail.voucher_uses) &&
    Array.isArray(detail.history) && (detail.invoice === null || typeof detail.invoice === "object"));
}

const productName = (item: OrderSummary["items"][number]) => item.name || item.sku || "Sản phẩm";

/**
 * The cell is always two short lines: the first product, then a "see all" button when there are more.
 * The full list opens in a native popover (browser top layer), so it floats over the table instead of
 * growing the row, is never clipped by the scrolling table, and closes on outside click or Escape.
 */
const SEARCH_FROM = 9; // A search box only helps once the list no longer fits at a glance.
// Case- and accent-insensitive, so "ban phim" finds "Bàn phím".
const searchable = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

function OrderProducts({ items, onOpenDetail }: { items: OrderSummary["items"]; onOpenDetail: (trigger: HTMLElement) => void }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = element.offsetWidth || 360, height = element.offsetHeight;
      element.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth - width - 8))}px`;
      // Open below the button; flip above when there is not enough room at the bottom.
      const below = anchor.bottom + 6;
      element.style.top = `${height && below + height > innerHeight - 8 ? Math.max(8, anchor.top - height - 6) : below}px`;
    };
    const toggled = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (isOpen) { place(); search.current?.focus(); } else setQuery("");
    };
    element.addEventListener("toggle", toggled);
    return () => element.removeEventListener("toggle", toggled);
  }, [items.length]);
  useEffect(() => {
    if (!open) return;
    // A fixed popover would drift away from its row while the page or table scrolls; close it instead.
    const close = (event: Event) => { if (!panel.current?.contains(event.target as Node)) panel.current?.hidePopover(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  if (!items.length) return <span className={styles.muted}>Chưa có sản phẩm</span>;
  const [first, ...rest] = items;
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const needle = searchable(query.trim());
  const shown = needle ? items.filter(item => searchable(`${item.name ?? ""} ${item.sku ?? ""}`).includes(needle)) : items;
  return <div className={styles.products}>
    <div className={styles.productLine} title={productName(first)}>
      <span className={styles.productName}>{productName(first)}</span>
      <span className={styles.productQty}>×{first.quantity}</span>
    </div>
    {rest.length > 0 && <>
      <button ref={trigger} type="button" className={styles.more} popoverTarget={id} aria-expanded={open}>
        Xem {items.length} sản phẩm <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      <div ref={panel} id={id} popover="auto" className={styles.productPopover} role="dialog" aria-label={`${items.length} sản phẩm trong đơn`}>
        <div className={styles.popoverHead}>
          <div className={styles.popoverTitle}><strong>{items.length} loại sản phẩm</strong><span>{units} món</span></div>
          {items.length >= SEARCH_FROM && <input ref={search} type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Tìm theo tên hoặc SKU…" aria-label="Tìm sản phẩm trong đơn" />}
        </div>
        {shown.length ? <ul>{shown.map((item, index) => <li key={`${item.sku}:${item.name}:${index}`} title={productName(item)}>
          <span className={styles.popoverName}>{productName(item)}</span>
          {item.sku && <small>{item.sku}</small>}
          <span className={styles.popoverQty}>×{item.quantity}</span>
        </li>)}</ul> : <p className={styles.popoverEmpty}>Không có sản phẩm khớp “{query.trim()}”.</p>}
        <div className={styles.popoverFoot}>
          {needle && <span>{shown.length}/{items.length} sản phẩm</span>}
          <button type="button" onClick={() => { panel.current?.hidePopover(); if (trigger.current) onOpenDetail(trigger.current); }}>
            Mở chi tiết đơn →
          </button>
        </div>
      </div>
    </>}
  </div>;
}

export function OrderData({ rows, columns, keys, detail = false, version, label, related = [], detailData, onRefresh, onRowChanged, onDetailOpenChange,
  initialOrderId = null, onDismissInitial, summaries }: Props) {
  const { portal } = useAdminAuth();
  const visibleRows = detail ? rows : newestOrderRows(rows);
  // A summary name is valid only while the row still points at the same person.
  const summaryName = (row: DataRow, field: "ma_kh" | "ma_nhan_vien") => {
    const summary = summaries?.[String(row.ma_donhang ?? "")];
    if (!summary) return undefined;
    const [id, name] = field === "ma_kh" ? [summary.customer_id, summary.customer_name] : [summary.employee_id, summary.employee_name];
    return id === (row[field] ?? null) ? name : undefined;
  };
  const { names, retry } = useOrderPeople(detail ? [] : visibleRows.filter(row =>
    summaryName(row, "ma_kh") === undefined || summaryName(row, "ma_nhan_vien") === undefined), version);
  const firstOrderId = visibleRows.length ? String(visibleRows[0].ma_donhang) : null;
  const rowIds = JSON.stringify(visibleRows.map(row => String(row.ma_donhang)));
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId ?? firstOrderId);
  const [drawerDetail, setDrawerDetail] = useState<AdminOrderDetailData | null>(null);
  const [drawerError, setDrawerError] = useState("");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerVersion, setDrawerVersion] = useState(0);
  const [drawerEditing, setDrawerEditing] = useState(false);
  const paneTitle = useId();
  const detailBody = useRef<HTMLDivElement | null>(null);
  const rowChanged = useRef(onRowChanged);
  rowChanged.current = onRowChanged;
  const activeOrderId = useRef(selectedOrderId);
  activeOrderId.current = selectedOrderId;
  const activeDetail = detail ? detailData : drawerDetail ?? undefined;
  const layout = orderListLayout(columns, Boolean(summaries)).filter(entry =>
    entry.kind !== "people" && entry.kind !== "channel" && entry.kind !== "products");
  const cellKey = (entry: (typeof layout)[number]) => entry.kind === "column" ? entry.column.name : `__${entry.kind}`;
  const header = (entry: (typeof layout)[number]) => entry.kind === "column" ? nameLabel(entry.column.name)
    : { total: "Tổng tiền", channel: "Kênh / nhận hàng", people: "Khách hàng / nhân viên", products: "Sản phẩm" }[entry.kind];
  const listCell = (row: DataRow, entry: (typeof layout)[number]) => {
    if (entry.kind === "column") {
      if (entry.column.name !== "trang_thai") return cell(row, entry.column);
      const status = String(row.trang_thai ?? "");
      return <span className={`${styles.statusPill} ${status === "HOAN_THANH" ? styles.statusDone : status === "HUY" ? styles.statusCancelled : styles.statusOpen}`}>
        {orderValue(row, "trang_thai")}</span>;
    }
    if (entry.kind === "channel") return <div className={styles.stack}>
      <span>{orderValue(row, "kenh_ban")}</span>
      {row.phuong_thuc_nhan ? <small>{orderValue(row, "phuong_thuc_nhan")}</small> : null}
    </div>;
    if (entry.kind === "people") return <div className={styles.stack}>
      <span className={styles.customer}>{personName(row, "ma_kh")}</span>
      <small>NV: <span>{personName(row, "ma_nhan_vien")}</span></small>
    </div>;
    const summary = summaries?.[String(row.ma_donhang ?? "")];
    if (!summary) return "—";
    if (entry.kind === "total") return summary.total === null ? <span className={styles.muted}>Chưa có</span>
      : <strong className={styles.money}>{formatMoney(summary.total)}</strong>;
    return <OrderProducts items={summary.items} onOpenDetail={trigger => openDetail(String(row.ma_donhang), trigger)} />;
  };
  const nameLabel = (field: string) => field === "ma_kh" ? "Khách hàng" : field === "ma_nhan_vien" ? "Nhân viên phụ trách" : label(field);
  const personName = (row: DataRow, field: "ma_kh" | "ma_nhan_vien") => {
    const id = row[field];
    if (!id) return field === "ma_kh" ? String(row.ten_nguoi_nhan || "Khách vãng lai") : "Chưa phân công";
    const resource = field === "ma_kh" ? "customers" : "employees";
    const isDetailRow = activeDetail?.order_id === String(row.ma_donhang ?? "");
    const aggregateName = field === "ma_kh" ? activeDetail?.customer?.ten_kh : activeDetail?.employee?.ho_ten;
    const fromSummary = summaryName(row, field);
    const name = isDetailRow ? (typeof aggregateName === "string" && aggregateName.trim() ? aggregateName : null)
      : fromSummary !== undefined ? fromSummary : names[personKey({ resource, id: String(id) })];
    if (name === undefined) return <span role="status">Đang tải tên…</span>;
    if (name === null) return "Chưa có thông tin tên";
    if (resource === "employees" && portal === "staff") return name;
    return <Link href={dataHref(resource, { key: JSON.stringify([id]) })}>{name}</Link>;
  };
  const cell = (row: DataRow, column: DataColumn) => {
    if (column.name === "ma_kh" || column.name === "ma_nhan_vien") {
      return <>{personName(row, column.name)}{detail && <> · {orderValue(row, column.name)}</>}</>;
    }
    return !detail && keys.includes(column.name) ? <button className={`${styles.detailTrigger} ${styles.orderId}`} type="button"
      title={orderValue(row, column.name)} {...warmProps(String(row.ma_donhang))} onClick={event => openDetail(String(row.ma_donhang), event.currentTarget)}>{orderValue(row, column.name)}</button> : orderValue(row, column.name);
  };

  // Warm an unseen order or reuse its snapshot. Opening the drawer independently
  // revalidates in the background, so an old hover must not delay the next click.
  const warmed = useRef(new Map<string, number>());
  const warmDetail = (orderId: string) => {
    const now = Date.now();
    if (selectedOrderId === orderId || now - (warmed.current.get(orderId) ?? 0) < 5_000) return;
    warmed.current.set(orderId, now);
    void adminFetch(detailPath(orderId), { cache: "no-store" }).catch(() => { /* The click reports errors. */ });
  };
  const warmProps = (orderId: string) => ({
    onPointerEnter: (event: PointerEvent) => { if (event.pointerType === "mouse") warmDetail(orderId); },
    onFocus: () => warmDetail(orderId),
  });

  const openDetail = (orderId: string, _trigger: HTMLElement) => {
    if (orderId === selectedOrderId) return;
    setDrawerDetail(null); setDrawerError(""); setDrawerEditing(false);
    setDrawerVersion(value => value + 1);
    setSelectedOrderId(orderId);
    if (initialOrderId && orderId !== initialOrderId) onDismissInitial?.();
  };

  useEffect(() => {
    if (initialOrderId) setSelectedOrderId(initialOrderId);
  }, [initialOrderId]);
  useEffect(() => {
    if (detail || drawerEditing || drawerLoading) return;
    const ids: string[] = JSON.parse(rowIds);
    // Keep a deep-linked order even when it is outside the current list page.
    if (selectedOrderId === initialOrderId && initialOrderId) return;
    if (selectedOrderId && ids.includes(selectedOrderId)) return;
    setSelectedOrderId(firstOrderId); setDrawerDetail(null); setDrawerError("");
  }, [detail, rowIds, firstOrderId, initialOrderId, selectedOrderId, drawerEditing, drawerLoading]);
  useEffect(() => {
    // The panel is persistent: pause the surrounding list only during edits or
    // foreground reads, rather than freezing it for the whole page visit.
    onDetailOpenChange?.(drawerEditing || drawerLoading);
    return () => onDetailOpenChange?.(false);
  }, [drawerEditing, drawerLoading, onDetailOpenChange]);
  useEffect(() => {
    if (!selectedOrderId || detail) return;
    const controller = new AbortController();
    setDrawerLoading(true); setDrawerError("");
    // adminFetch keeps a private in-memory snapshot even with HTTP no-store.
    // Show it immediately, then let polling check freshness without blanking the drawer.
    // Writes invalidate snapshots, so refreshing after an action still reads the server.
    adminFetch(detailPath(selectedOrderId), { signal: controller.signal, cache: "no-store" }).then(async response => {
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được chi tiết đơn hàng.");
      if (!validDetail(body, selectedOrderId)) throw new Error("API chưa trả đúng chi tiết đơn hàng.");
      if (!controller.signal.aborted) {
        setDrawerDetail(body);
        rowChanged.current?.(body.order);
      }
    }).catch((reason: Error) => {
      if (!controller.signal.aborted) setDrawerError(reason.message || "Không tải được chi tiết đơn hàng.");
    }).finally(() => { if (!controller.signal.aborted) setDrawerLoading(false); });
    return () => controller.abort();
  }, [selectedOrderId, drawerVersion, detail]);
  const drawerPollError = useAdminPolling(JSON.stringify([selectedOrderId, drawerVersion]),
    !detail && Boolean(selectedOrderId && drawerDetail) && !drawerLoading && !drawerError && !drawerEditing,
    async (signal, canApply) => {
      const response = await adminFetch(detailPath(selectedOrderId!), { signal, cache: "no-cache" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không cập nhật được chi tiết đơn hàng.");
      if (!validDetail(body, selectedOrderId!)) throw new Error("API chưa trả đúng chi tiết đơn hàng.");
      if (canApply()) {
        setDrawerDetail(current => sameAdminData(current, body) ? current : body);
        rowChanged.current?.(body.order);
      }
    });
  useEffect(() => { detailBody.current?.scrollTo({ top: 0 }); }, [selectedOrderId]);

  const refreshDetail = (saved?: DataRow) => {
    // Use the committed row immediately, even if the drawer closes before its
    // financial/history refresh completes. Never reload the surrounding list.
    if (saved?.ma_donhang === selectedOrderId && typeof saved.trang_thai === "string") {
      rowChanged.current?.(saved);
      if (activeOrderId.current !== selectedOrderId) return;
      setDrawerDetail(current => current?.order_id === selectedOrderId
        ? { ...current, order: { ...current.order, ...saved } } : current);
    }
    if (activeOrderId.current !== selectedOrderId) return;
    invalidateAdminCache([detailPath(selectedOrderId!)]);
    setDrawerLoading(true);
    setDrawerVersion(value => value + 1);
  };

  return <>
    {Object.values(names).some(name => name === null) && <p className="live-note" role="status">
      Chưa tải được tên của một số hồ sơ. <button type="button" onClick={retry}>Tải lại tên</button>
    </p>}
    {detail ? <OrderDetail row={rows[0]} columns={columns} label={label} personName={personName} related={related} version={version} detailData={detailData} onRefresh={onRefresh} /> : <OrderSplitPane list={<ScrollableTable contained><table className={styles.orderList}>
      <thead><tr>{layout.map(entry => <th key={cellKey(entry)} className={entry.kind === "total" ? styles.numeric : undefined}>{header(entry)}</th>)}</tr></thead>
      <tbody>{visibleRows.map(row => <tr key={JSON.stringify(keys.map(key => row[key]))} className={String(row.ma_donhang) === selectedOrderId ? styles.selectedRow : undefined}
        aria-selected={String(row.ma_donhang) === selectedOrderId}
        onClick={event => {
          if (!(event.target as HTMLElement).closest("a, button, input, select, textarea, [popover]")) openDetail(String(row.ma_donhang), event.currentTarget);
        }}>
        {layout.map(entry => <td key={cellKey(entry)} data-order-cell={entry.kind === "column" ? entry.column.name : entry.kind} className={entry.kind === "total" ? styles.numeric : entry.kind === "products" ? styles.productCell : undefined}>{listCell(row, entry)}</td>)}
      </tr>)}</tbody>
    </table>{!visibleRows.length && <p className="live-note">Chưa có dữ liệu phù hợp.</p>}</ScrollableTable>} detail={
      <section className={styles.drawer} aria-labelledby={paneTitle} data-order-detail-panel>
        <header className={styles.drawerHeader}>
          <div className={styles.drawerTitle}>
            <div><p>Chi tiết đơn hàng</p><h2 id={paneTitle}>{selectedOrderId ?? "Chưa có đơn hàng"}</h2></div>
            {drawerDetail?.order_id === selectedOrderId && <OrderBadges row={drawerDetail.order} />}
          </div>
        </header>
        <div ref={detailBody} className={styles.drawerBody}>
          {!selectedOrderId && <div className={styles.state}>Chưa có đơn hàng phù hợp. Thử thay đổi bộ lọc hoặc tìm kiếm.</div>}
          {selectedOrderId && !drawerDetail && !drawerError && <div className={styles.state} role="status">Đang tải chi tiết đơn hàng…</div>}
          {drawerLoading && drawerDetail && <p role="status">Đang cập nhật chi tiết đơn hàng…</p>}
          {drawerError && <div className={styles.state} role="alert"><p>{drawerError}</p><button type="button" onClick={() => setDrawerVersion(value => value + 1)}>Thử lại</button></div>}
          {drawerPollError && <p className="live-error" role="alert">Chưa cập nhật được dữ liệu mới; đang hiển thị lần tải trước. {drawerPollError}</p>}
          {drawerDetail?.order_id === selectedOrderId && <>
            <fieldset disabled={drawerLoading || Boolean(drawerError)} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              <OperationPanel key={selectedOrderId} resource="orders" row={drawerDetail.order} orderDetail={drawerDetail} onChanged={refreshDetail} onEditingChange={setDrawerEditing} />
            </fieldset>
            <OrderDetail row={drawerDetail.order} columns={columns} label={label} personName={personName}
              related={related} version={version + drawerVersion} detailData={drawerDetail} onRefresh={refreshDetail} hideTitle />
          </>}
        </div>
      </section>} />}
  </>;
}
