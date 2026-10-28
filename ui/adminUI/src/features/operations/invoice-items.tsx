"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/admin-fetch";
import type { DataRow } from "../../lib/inline-table-data";
import { ScrollableTable } from "../tables/scrollable-table";
import { formatMoney } from "./financial-summary";
export function InvoiceItems({
  orderId,
  onReady,
}: {
  orderId: string;
  onReady: (ready: boolean) => void;
}) {
  const [rows, setRows] = useState<DataRow[] | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    onReady(false);
    setRows(null);
    setError("");
    async function read() {
      const result: DataRow[] = [];
      let total = 0;
      for (let page = 1; page === 1 || result.length < total; page++) {
        const response = await adminFetch(
          `/api/backend/data/order-lines?order_id=${encodeURIComponent(orderId)}&page_size=100&page=${page}`,
          { signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.detail || "Không tải được sản phẩm của hóa đơn.",
          );
        if (
          body.order_id !== orderId ||
          !Array.isArray(body.data) ||
          body.data.some((r: DataRow) => r.ma_donhang !== orderId) ||
          !Number.isSafeInteger(body.total) ||
          body.total > 2000 ||
          (page > 1 && body.total !== total)
        )
          throw new Error("API chưa trả đầy đủ sản phẩm của đúng đơn hàng.");
        total = body.total;
        if (!body.data.length && result.length < total)
          throw new Error("Chưa tải đủ dòng hóa đơn.");
        result.push(...body.data);
      }
      if (
        !result.length ||
        result.length !== total ||
        new Set(result.map((r) => r.ma_ct_donhang)).size !== result.length
      )
        throw new Error("Chi tiết hóa đơn thiếu hoặc trùng dòng.");
      if (!controller.signal.aborted) {
        setRows(result);
        onReady(true);
      }
    }
    void read().catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, [orderId, onReady, version]);
  return (
    <section className="operation-history">
      <h2>Sản phẩm trên hóa đơn</h2>
      {error ? (
        <p className="live-error" role="alert">
          {error}
          <button onClick={() => setVersion((v) => v + 1)}>Thử lại</button>
        </p>
      ) : !rows ? (
        <p>Đang tải sản phẩm…</p>
      ) : (
        <ScrollableTable>
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>SKU</th>
                <th>SL</th>
                <th>Đơn giá</th>
                <th>Giảm dòng</th>
                <th>Giảm voucher</th>
                <th>Thuế</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.ma_ct_donhang)}>
                  <td>{String(r.ten_sp_luc_ban)}</td>
                  <td>{String(r.sku)}</td>
                  <td>{r.so_luong}</td>
                  <td>{formatMoney(String(r.don_gia))}</td>
                  <td>{formatMoney(String(r.giam_gia))}</td>
                  <td>{formatMoney(String(r.giam_gia_voucher))}</td>
                  <td>{formatMoney(String(r.tien_thue))}</td>
                  <td>{formatMoney(String(r.thanh_tien))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}
    </section>
  );
}
