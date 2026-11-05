"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Ticket } from "lucide-react";
import { adminFetch, sameAdminData } from "@/src/lib/admin-fetch";
import { dataHref } from "@/src/lib/data-navigation";
import { inlineChoiceLabel, type DataRow } from "@/src/lib/inline-table-data";
import { useAdminPolling } from "@/src/lib/use-admin-polling";
import { ScrollableTable } from "../tables/scrollable-table";
import styles from "./promotion-vouchers.module.css";

type VoucherPage = { data: DataRow[]; total: number; page: number; page_size: number };
const pageSize = 10;
const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const numeric = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
function amount(value: DataRow[string]) {
  return value !== null && value !== undefined && Number.isFinite(Number(value)) ? currency.format(Number(value)) : "—";
}

async function readVouchers(promotionId: number, page: number, q: string, signal: AbortSignal, cache?: RequestCache): Promise<VoucherPage> {
  const filters = { ma_ctkm: promotionId };
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), q, filters: JSON.stringify(filters) });
  const response = await adminFetch(`/api/backend/data/vouchers?${params}`, { signal, cache });
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được voucher của chương trình.");
  if (!Array.isArray(body?.data) || !Number.isInteger(body.total) || body.total < 0) throw new Error("API chưa trả về danh sách voucher hợp lệ.");
  // An old backend can ignore filters. Never present another program's vouchers as this program's.
  if (String(body.filters?.ma_ctkm) !== String(promotionId) || body.data.some((row: DataRow) => String(row.ma_ctkm) !== String(promotionId))) {
    throw new Error("Backend chưa lọc đúng chương trình. Cần cập nhật API trước khi xem voucher liên quan.");
  }
  return body;
}

export function PromotionVouchers({ promotionId, writable }: { promotionId: number; writable: boolean }) {
  const [result, setResult] = useState<VoucherPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const filters = { ma_ctkm: promotionId };
  const createHref = dataHref("vouchers", { create: true, filters });
  const identity = JSON.stringify([promotionId, page, search, version]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    readVouchers(promotionId, page, search, controller.signal, version ? "reload" : undefined)
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được voucher."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [promotionId, page, search, version]);

  const pollError = useAdminPolling(identity, !loading && !error && Boolean(result), async (signal, canApply) => {
    const data = await readVouchers(promotionId, page, search, signal, "no-cache");
    if (canApply()) setResult(current => sameAdminData(current, data) ? current : data);
  });

  return <section className={styles.card} aria-label="Voucher của chương trình" aria-busy={loading}>
    <header className={styles.header}>
      <div><h2><Ticket size={22} aria-hidden="true" />Voucher của chương trình</h2><p>Danh sách mã giảm giá thuộc chương trình này.</p></div>
      <div className={styles.actions}>
        <Link href={dataHref("vouchers", { filters })}>Mở danh sách voucher</Link>
        {writable && <Link className="live-primary" href={createHref}><Plus size={16} aria-hidden="true" />Thêm voucher</Link>}
      </div>
    </header>
    <form className="live-tools" onSubmit={event => { event.preventDefault(); setPage(1); setSearch(query.trim()); }}>
      <input className="live-search" aria-label="Tìm mã voucher trong chương trình" placeholder="Tìm mã voucher…" value={query} onChange={event => setQuery(event.target.value)} />
      <button type="submit">Tìm kiếm</button>
      <button type="button" disabled={loading} onClick={() => setVersion(v => v + 1)}>Làm mới voucher</button>
    </form>
    {pollError && <p className="live-error" role="alert">Chưa cập nhật được voucher; đang giữ dữ liệu lần tải trước. {pollError}</p>}
    {loading ? <p role="status">Đang tải voucher…</p> : error ? <p className="live-error" role="alert">{error} <button type="button" onClick={() => setVersion(v => v + 1)}>Thử lại</button></p>
      : result?.data.length ? <ScrollableTable><table><thead><tr><th>Mã voucher</th><th>Mức giảm</th><th>Đơn tối thiểu</th><th>Giới hạn lượt</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>{result.data.map(row => <tr key={String(row.ma_voucher)}>
          <td><Link href={dataHref("vouchers", { key: JSON.stringify([row.ma_voucher]) })}>{row.ma_code}</Link></td>
          <td>{row.loai_giam === "PHAN_TRAM" ? `${numeric.format(Number(row.gia_tri_giam))}%` : amount(row.gia_tri_giam)}
            {row.loai_giam === "PHAN_TRAM" && row.giam_toi_da != null && <span className={styles.muted}>Tối đa {amount(row.giam_toi_da)}</span>}</td>
          <td>{amount(row.gia_tri_don_toi_thieu)}</td>
          <td>{row.gioi_han_tong_luot == null ? "Không giới hạn tổng lượt" : `Tổng tối đa ${row.gioi_han_tong_luot} lượt`}<span className={styles.muted}>Mỗi khách: {row.gioi_han_moi_khach ?? "—"} lượt</span></td>
          <td><span className={`${styles.status} ${row.trang_thai === "HOAT_DONG" ? styles.active : ""}`}>{inlineChoiceLabel("trang_thai", row.trang_thai)}</span></td>
          <td><Link href={dataHref("vouchers", { key: JSON.stringify([row.ma_voucher]) })}>Chi tiết</Link>{writable && <> · <Link href={dataHref("vouchers", { key: JSON.stringify([row.ma_voucher]), edit: true })}>Chỉnh sửa</Link></>}</td>
        </tr>)}</tbody></table></ScrollableTable>
      : <div className={styles.empty}><p>{search ? "Không có voucher khớp mã tìm kiếm trong chương trình này." : page > 1 ? "Trang này không còn voucher. Hãy quay lại trang trước." : "Chương trình chưa có voucher."}</p>{writable && !search && page === 1 && <Link href={createHref}>Tạo voucher đầu tiên</Link>}</div>}
    {result && <div className={styles.pagination}>
      <span>{result.total} voucher · Trang {page}</span>
      <button type="button" disabled={loading || page <= 1} onClick={() => setPage(v => v - 1)}>Trước</button>
      <button type="button" disabled={loading || page * pageSize >= result.total} onClick={() => setPage(v => v + 1)}>Sau</button>
    </div>}
  </section>;
}
