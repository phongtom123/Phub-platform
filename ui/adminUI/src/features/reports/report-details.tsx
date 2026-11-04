"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Package, Search } from "lucide-react";
import { ScrollableTable } from "../tables/scrollable-table";
import type { BusinessReport } from "./report-data";
import { negativeAmount, reportAmount, reportDate, reportPercent } from "./report-format";
import styles from "./reports.module.css";

const PAGE_SIZE = 20;

export function ReportDetails({ report }: { report: BusinessReport }) {
  const [tab, setTab] = useState<"products" | "daily">("products");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // Reuse the loaded list and its search text until the API returns new products.
  const index = useMemo(() => report.products.map(row => ({ row, text: `${row.sku} ${row.name}`.toLocaleLowerCase("vi-VN") })), [report.products]);
  const keyword = useMemo(() => query.trim().toLocaleLowerCase("vi-VN"), [query]);
  const filtered = useMemo(() => keyword ? index.filter(item => item.text.includes(keyword)) : index, [index, keyword]);
  const total = tab === "products" ? filtered.length : report.daily.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages), offset = (current - 1) * PAGE_SIZE;

  return <section className={styles.tableCard} aria-label="Chi tiết báo cáo">
    <div className={styles.tableHeading}><div><h2>Chi tiết hiệu quả kinh doanh</h2><p>Đối chiếu số liệu theo sản phẩm hoặc từng ngày.</p></div><span className={styles.countBadge}>{report.products.length} sản phẩm</span></div>
    <div className={styles.tableTools}>
      <div className={styles.tabs} aria-label="Cách xem chi tiết"><button type="button" aria-pressed={tab === "products"} onClick={() => { setTab("products"); setPage(1); }}><Package size={16} />Theo sản phẩm</button><button type="button" aria-pressed={tab === "daily"} onClick={() => { setTab("daily"); setPage(1); }}><CalendarDays size={16} />Theo ngày</button></div>
      {tab === "products" && <label className={styles.search}><Search size={17} aria-hidden="true" /><input aria-label="Tìm SKU hoặc tên sản phẩm trong báo cáo" placeholder="Tìm tên sản phẩm hoặc SKU…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>}
    </div>
    {tab === "products" ? <ScrollableTable><table className={styles.reportTable}><thead><tr><th>Sản phẩm / SKU</th><th>Đã bán</th><th>Doanh thu chưa thuế</th><th>Giá vốn</th><th>Lợi nhuận gộp</th><th>Biên lợi nhuận</th></tr></thead><tbody>{filtered.slice(offset, offset + PAGE_SIZE).map(({ row }) => <tr key={row.sku}>
      <td><strong className={styles.productName}>{row.name}</strong><small className={styles.sku}>{row.sku}</small>{row.unpriced_lines > 0 && <span className={styles.missingCost}>{row.unpriced_lines} dòng chưa đủ giá vốn</span>}</td>
      <td>{row.quantity.toLocaleString("vi-VN")}</td><td>{reportAmount(row.net_revenue)}</td><td className={row.cost === null ? styles.muted : ""}>{reportAmount(row.cost)}</td>
      <td className={row.gross_profit === null ? styles.muted : negativeAmount(row.gross_profit) ? styles.loss : styles.positive}>{reportAmount(row.gross_profit)}</td><td>{reportPercent(row.margin)}</td>
    </tr>)}</tbody></table>{!filtered.length && <div className={styles.tableEmpty}><Search size={26} aria-hidden="true" /><strong>{keyword ? "Không có sản phẩm khớp tìm kiếm." : "Chưa có đơn hoàn thành trong kỳ này."}</strong><p>{keyword ? "Thử từ khóa khác hoặc xóa nội dung tìm kiếm." : "Sản phẩm sẽ xuất hiện khi đơn hàng được hoàn thành."}</p></div>}</ScrollableTable>
      : <ScrollableTable><table className={styles.reportTable}><thead><tr><th>Ngày hoàn thành</th><th>Doanh thu chưa thuế</th><th>Lợi nhuận gộp</th></tr></thead><tbody>{report.daily.slice(offset, offset + PAGE_SIZE).map(row => <tr key={row.day}><td>{reportDate(row.day)}</td><td>{reportAmount(row.net_revenue)}</td><td className={row.gross_profit === null ? styles.muted : negativeAmount(row.gross_profit) ? styles.loss : styles.positive}>{reportAmount(row.gross_profit)}</td></tr>)}</tbody></table></ScrollableTable>}
    <footer className={styles.pagination}><span>{total ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} / ${total}` : "0"} {tab === "products" ? "sản phẩm" : "ngày"}</span><div><button type="button" aria-label="Trang trước" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft size={17} /></button><span>Trang <strong>{current}</strong> / {pages}</span><button type="button" aria-label="Trang sau" disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight size={17} /></button></div></footer>
  </section>;
}
