"use client";
import { useEffect, useState } from "react";
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
export function StockHistory({ sku }: { sku?: string }) {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
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
      { page: String(page), ...(sku ? { record_id: sku } : {}) },
      controller.signal,
    )
      .then(setResult)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [open, page, version, sku]);
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
                    <td>{r.reason}</td>
                    <td>{r.reference}</td>
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
