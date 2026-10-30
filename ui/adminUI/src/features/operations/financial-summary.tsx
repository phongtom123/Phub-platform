"use client";
import type { Summary } from "../dashboard/use-dashboard-data";
import Link from "next/link";
import { ScrollableTable } from "../tables/scrollable-table";
export type FinancialSummaryData = Pick<Summary, "start" | "end" | "revenue" | "collected" | "top_products">;
export function formatMoney(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return "—";
  const [, negative, whole, fraction = "00"] = match;
  const part = fraction.padEnd(2, "0");
  try {
    const sign = negative && (BigInt(whole) !== BigInt(0) || part !== "00") ? "-" : "";
    return `${sign}${BigInt(whole).toLocaleString("vi-VN")}${part !== "00" ? "," + part : ""} ₫`;
  } catch {
    return "—";
  }
}
function csvValue(value: unknown) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') +
    '"'
  );
}
export function FinancialSummary({ summary, disabled = false, reportHref }: { summary: FinancialSummaryData | null; disabled?: boolean; reportHref?: string }) {
  if (!summary) return null;
  function download() {
    if (!summary || disabled) return;
    const rows: unknown[][] = [
      ["Báo cáo", summary.start, summary.end],
      ["Doanh thu hóa đơn (gồm thuế)", summary.revenue],
      ["Tiền thu trừ hoàn", summary.collected],
      ["SKU", "Tên sản phẩm", "Số lượng bán", "Thành tiền"],
    ];
    rows.push(
      ...summary.top_products.map((r) => [r.sku, r.name, r.quantity, r.total]),
    );
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(csvValue).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `phub-bao-cao-${summary.start}-${summary.end}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="operation-history" aria-label="Báo cáo tài chính">
      <div className="live-tools">
        <h2>Doanh thu và thu tiền</h2>
        <button onClick={download} disabled={disabled}>Xuất báo cáo CSV</button>
        {reportHref && <Link href={reportHref}>Xem báo cáo chi tiết →</Link>}
      </div>
      <p>
        {summary.start} → {summary.end} · theo giờ Việt Nam
      </p>
      <div className="operation-summary">
        <article>
          Doanh thu hóa đơn<strong>{formatMoney(summary.revenue)}</strong>
          <small>Gồm thuế; không gồm đơn hủy.</small>
        </article>
        <article>
          Thu tiền thực nhận<strong>{formatMoney(summary.collected)}</strong>
          <small>Khoản thu thành công trừ khoản hoàn trong kỳ.</small>
        </article>
        <article>
          Phạm vi<strong>{summary.top_products.length}</strong>
          <small>Sản phẩm trong top bán chạy của đơn hoàn thành.</small>
        </article>
      </div>
      <h3>Sản phẩm bán chạy</h3>
      {summary.top_products.length ? (
        <ScrollableTable><table>
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>SKU</th>
              <th>Đã bán</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {summary.top_products.map((r) => (
              <tr key={r.sku}>
                <td>{r.name}</td>
                <td>{r.sku}</td>
                <td>{r.quantity}</td>
                <td>{formatMoney(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table></ScrollableTable>
      ) : (
        <p>Chưa có đơn hoàn thành trong khoảng thời gian đã chọn.</p>
      )}
    </section>
  );
}
