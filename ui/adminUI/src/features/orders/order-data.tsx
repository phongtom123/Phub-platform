"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { adminFetch } from "../../lib/admin-fetch";
import { dataHref } from "../../lib/data-navigation";
import type { DataColumn, DataRow } from "../../lib/inline-table-data";
import { useAdminAuth } from "../../components/admin/auth-provider";
import { orderListColumns, orderValue } from "./order-presentation";
import { OrderDetail } from "./order-detail";
import type { AdminOrderDetailData } from "./order-detail-data";
import { ScrollableTable } from "../tables/scrollable-table";
import { OperationPanel } from "../operations/operation-panel";
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
  initialOrderId?: string | null;
  onDismissInitial?: () => void;
  label: (field: string) => string;
};

function validDetail(value: unknown, orderId: string): value is AdminOrderDetailData {
  const detail = value as AdminOrderDetailData;
  return Boolean(detail && detail.order_id === orderId && detail.order?.ma_donhang === orderId && detail.financial &&
    Array.isArray(detail.lines) && Array.isArray(detail.payments) && Array.isArray(detail.voucher_uses) &&
    Array.isArray(detail.history) && (detail.invoice === null || typeof detail.invoice === "object"));
}

export function OrderData({ rows, columns, keys, detail = false, version, label, related = [], detailData, onRefresh,
  initialOrderId = null, onDismissInitial }: Props) {
  const { portal } = useAdminAuth();
  const { names, retry } = useOrderPeople(detail ? [] : rows, version);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId);
  const [drawerDetail, setDrawerDetail] = useState<AdminOrderDetailData | null>(null);
  const [drawerError, setDrawerError] = useState("");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerVersion, setDrawerVersion] = useState(0);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const activeDetail = detail ? detailData : drawerDetail ?? undefined;
  const visibleColumns = detail ? columns : orderListColumns(columns);
  const nameLabel = (field: string) => field === "ma_kh" ? "Khách hàng" : field === "ma_nhan_vien" ? "Nhân viên phụ trách" : label(field);
  const personName = (row: DataRow, field: "ma_kh" | "ma_nhan_vien") => {
    const id = row[field];
    if (!id) return field === "ma_kh" ? String(row.ten_nguoi_nhan || "Khách vãng lai") : "Chưa phân công";
    const resource = field === "ma_kh" ? "customers" : "employees";
    const isDetailRow = activeDetail?.order_id === String(row.ma_donhang ?? "");
    const aggregateName = field === "ma_kh" ? activeDetail?.customer?.ten_kh : activeDetail?.employee?.ho_ten;
    const name = isDetailRow ? (typeof aggregateName === "string" && aggregateName.trim() ? aggregateName : null)
      : names[personKey({ resource, id: String(id) })];
    if (name === undefined) return <span role="status">Đang tải tên…</span>;
    if (name === null) return "Chưa có thông tin tên";
    if (resource === "employees" && portal === "staff") return name;
    return <Link href={dataHref(resource, { key: JSON.stringify([id]) })}>{name}</Link>;
  };
  const cell = (row: DataRow, column: DataColumn) => {
    if (column.name === "ma_kh" || column.name === "ma_nhan_vien") {
      return <>{personName(row, column.name)}{detail && <> · {orderValue(row, column.name)}</>}</>;
    }
    return !detail && keys.includes(column.name) ? <button className={styles.detailTrigger} type="button"
      onClick={event => openDetail(String(row.ma_donhang), event.currentTarget)}>{orderValue(row, column.name)}</button> : orderValue(row, column.name);
  };

  const openDetail = (orderId: string, trigger: HTMLElement) => {
    returnFocus.current = trigger;
    setSelectedOrderId(orderId);
  };
  const closeDetail = useCallback(() => {
    if (selectedOrderId && selectedOrderId === initialOrderId) onDismissInitial?.();
    setSelectedOrderId(null); setDrawerDetail(null); setDrawerError("");
    requestAnimationFrame(() => returnFocus.current?.focus());
  }, [selectedOrderId, initialOrderId, onDismissInitial]);

  useEffect(() => {
    if (initialOrderId) setSelectedOrderId(initialOrderId);
  }, [initialOrderId]);
  useEffect(() => {
    if (!selectedOrderId) return;
    const controller = new AbortController();
    setDrawerLoading(true); setDrawerError(""); setDrawerDetail(null);
    adminFetch(`/api/backend/admin/orders/${encodeURIComponent(selectedOrderId)}/detail`, {
      signal: controller.signal, cache: "no-store",
    }).then(async response => {
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được chi tiết đơn hàng.");
      if (!validDetail(body, selectedOrderId)) throw new Error("API chưa trả đúng chi tiết đơn hàng.");
      if (!controller.signal.aborted) setDrawerDetail(body);
    }).catch((reason: Error) => {
      if (!controller.signal.aborted) setDrawerError(reason.message || "Không tải được chi tiết đơn hàng.");
    }).finally(() => { if (!controller.signal.aborted) setDrawerLoading(false); });
    return () => controller.abort();
  }, [selectedOrderId, drawerVersion]);
  useEffect(() => {
    if (!selectedOrderId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") closeDetail(); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", escape); };
  }, [selectedOrderId, closeDetail]);

  const refreshDetail = () => {
    onRefresh?.();
    setDrawerVersion(value => value + 1);
  };

  return <>
    {Object.values(names).some(name => name === null) && <p className="live-note" role="status">
      Chưa tải được tên của một số hồ sơ. <button type="button" onClick={retry}>Tải lại tên</button>
    </p>}
    {detail ? <OrderDetail row={rows[0]} columns={columns} label={label} personName={personName} related={related} version={version} detailData={detailData} onRefresh={onRefresh} /> : <ScrollableTable><table>
      <thead><tr>{visibleColumns.map(column => <th key={column.name}>{nameLabel(column.name)}</th>)}<th>Thao tác</th></tr></thead>
      <tbody>{rows.map(row => <tr key={JSON.stringify(keys.map(key => row[key]))}>
        {visibleColumns.map(column => <td key={column.name}>{cell(row, column)}</td>)}
        <td><button className={styles.actionButton} type="button" onClick={event => openDetail(String(row.ma_donhang), event.currentTarget)}>Chi tiết</button></td>
      </tr>)}</tbody>
    </table>{!rows.length && <p className="live-note">Chưa có dữ liệu phù hợp.</p>}</ScrollableTable>}
    {!detail && selectedOrderId && <div className={styles.backdrop} onMouseDown={event => event.target === event.currentTarget && closeDetail()}>
      <section className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="order-drawer-title">
        <header className={styles.drawerHeader}>
          <div><p>Đơn hàng</p><h2 id="order-drawer-title">{selectedOrderId}</h2></div>
          <button ref={closeButton} type="button" onClick={closeDetail} aria-label="Đóng chi tiết đơn hàng"><X aria-hidden="true" /></button>
        </header>
        <div className={styles.drawerBody}>
          {drawerLoading && <div className={styles.state} role="status">Đang tải chi tiết đơn hàng…</div>}
          {drawerError && <div className={styles.state} role="alert"><p>{drawerError}</p><button type="button" onClick={() => setDrawerVersion(value => value + 1)}>Thử lại</button></div>}
          {drawerDetail && <>
            <OperationPanel resource="orders" row={drawerDetail.order} orderDetail={drawerDetail} onChanged={refreshDetail} />
            <OrderDetail row={drawerDetail.order} columns={columns} label={label} personName={personName}
              related={related} version={version + drawerVersion} detailData={drawerDetail} onRefresh={refreshDetail} />
          </>}
        </div>
      </section>
    </div>}
  </>;
}
