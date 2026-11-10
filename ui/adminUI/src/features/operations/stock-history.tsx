"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { dataHref } from "../../lib/data-navigation";
import { operationRead } from "./api";
import { ScrollableTable } from "../tables/scrollable-table";
type Event = {
  id: number;
  warehouse_id: number;
  sku: string;
  before_quantity: number;
  after_quantity: number;
  reason: string;
  reference: string;
  created_at: string;
};
const reasonLabels: Record<string, string> = {
  "receipts:confirm": "Nhập hàng",
  "inventory:adjust": "Điều chỉnh tồn",
  "orders:dispatch": "Xuất theo đơn hàng",
  "orders:cancel": "Hủy đơn hàng",
  "invoices:manual": "Xuất hóa đơn",
};
function localDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export function StockHistory({ sku }: { sku?: string }) {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  const [range, setRange] = useState("all"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [result, setResult] = useState<{ data: Event[]; total: number } | null>(
      null,
    ),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setError("");
    void operationRead<{ data: Event[]; total: number }>(
      "history",
      { page: String(page), ...(sku ? { record_id: sku } : {}), ...(start ? { start } : {}), ...(end ? { end } : {}) },
      controller.signal,
    )
      .then(setResult)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [open, page, version, sku, start, end]);
  function changeRange(value: string) {
    setRange(value);
    setPage(1);
    if (value === "custom") return;
    if (value === "all") {
      setStart("");
      setEnd("");
      return;
    }
    const finish = new Date();
    const begin = new Date(finish.getFullYear(), finish.getMonth(), finish.getDate());
    begin.setDate(begin.getDate() - (value === "today" ? 0 : value === "7d" ? 6 : 29));
    setStart(localDate(begin));
    setEnd(localDate(finish));
  }
  return (
    <details
      className="operation-history"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Lịch sử biến động tồn kho</summary>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      <div className="live-tools">
        <label>Khoảng thời gian
          <select aria-label="Khoảng thời gian lịch sử kho" value={range} onChange={event => changeRange(event.target.value)}>
            <option value="all">Tất cả thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="7d">7 ngày qua</option>
            <option value="30d">30 ngày qua</option>
            <option value="custom">Tùy chỉnh</option>
          </select>
        </label>
        {range === "custom" && <>
          <label>Từ ngày<input type="date" value={start} max={end || undefined} onChange={event => { setStart(event.target.value); setPage(1); }} /></label>
          <label>Đến ngày<input type="date" value={end} min={start || undefined} onChange={event => { setEnd(event.target.value); setPage(1); }} /></label>
        </>}
      </div>
      {!result && !error && open && <p>Đang tải lịch sử…</p>}
      {result && (
        <>
          <ScrollableTable>
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Kho</th>
                  <th>SKU</th>
                  <th>Trước</th>
                  <th>Thay đổi</th>
                  <th>Sau</th>
                  <th>Lý do</th>
                  <th>Tham chiếu</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.created_at).toLocaleString("vi-VN")}</td>
                    <td>{r.warehouse_id}</td>
                    <td>{r.sku}</td>
                    <td>{r.before_quantity}</td>
                    <td>{r.after_quantity - r.before_quantity}</td>
                    <td>{r.after_quantity}</td>
                    <td>{reasonLabels[r.reason] ?? r.reason}</td>
                    <td>{r.reason === "invoices:manual" && r.reference?.startsWith("HD-")
                      ? <Link href={dataHref("invoices", { key: JSON.stringify([r.reference]) })}>{r.reference}</Link>
                      : r.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          {result.total === 0 && (
            <p>Chưa có biến động được ghi nhận kể từ khi cài chức năng.</p>
          )}
          <div className="live-tools">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Trước
            </button>
            <span>Trang {page}</span>
            <button
              disabled={page * 20 >= result.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </button>
            <button onClick={() => setVersion((v) => v + 1)}>Làm mới</button>
          </div>
        </>
      )}
    </details>
  );
}
